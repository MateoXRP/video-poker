import { useState, useEffect } from "react";
import Cookies from "js-cookie";
import { db, fetchLeaderboard, submitScore, getTokenBalance, setTokenBalance } from "./firebase";

const suits = ["♠", "♥", "♦", "♣"];
const ranks = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];

function createDeck() {
  return suits.flatMap(suit => ranks.map(rank => ({ rank, suit })));
}

function shuffleDeck(deck) {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function evaluateHand(hand) {
  const rankCounts = {};
  const suitCounts = {};
  const rankValues = hand.map(card => ranks.indexOf(card.rank));
  hand.forEach(card => {
    rankCounts[card.rank] = (rankCounts[card.rank] || 0) + 1;
    suitCounts[card.suit] = (suitCounts[card.suit] || 0) + 1;
  });
  const isFlush = Object.keys(suitCounts).length === 1;
  const sortedRanks = [...new Set(rankValues)].sort((a, b) => a - b);
  const isStraight = sortedRanks.length === 5 && (sortedRanks[4] - sortedRanks[0] === 4 || JSON.stringify(sortedRanks) === JSON.stringify([0,1,2,3,12]));
  const values = Object.values(rankCounts).sort((a, b) => b - a);
  const hasJacksOrBetter = Object.keys(rankCounts).some(rank => rankCounts[rank] === 2 && ["J", "Q", "K", "A"].includes(rank));

  if (isFlush && isStraight && rankValues.includes(8) && rankValues.includes(9) && rankValues.includes(10) && rankValues.includes(11) && rankValues.includes(12)) return { name: "Royal Flush", multiplier: 250 };
  if (isFlush && isStraight) return { name: "Straight Flush", multiplier: 50 };
  if (values[0] === 4) return { name: "Four of a Kind", multiplier: 25 };
  if (values[0] === 3 && values[1] === 2) return { name: "Full House", multiplier: 9 };
  if (isFlush) return { name: "Flush", multiplier: 6 };
  if (isStraight) return { name: "Straight", multiplier: 4 };
  if (values[0] === 3) return { name: "Three of a Kind", multiplier: 3 };
  if (values[0] === 2 && values[1] === 2) return { name: "Two Pair", multiplier: 2 };
  if (hasJacksOrBetter) return { name: "Jacks or Better", multiplier: 1 };
  return { name: "No Win", multiplier: 0 };
}

export default function VideoPoker() {
  const [name, setName] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [tokens, setTokens] = useState(100);
  const [tokensLoaded, setTokensLoaded] = useState(false);
  const [hand, setHand] = useState([]);
  const [deck, setDeck] = useState([]);
  const [isHolding, setIsHolding] = useState([false, false, false, false, false]);
  const [drawPhase, setDrawPhase] = useState(false);
  const [globalScores, setGlobalScores] = useState([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const savedName = Cookies.get("vpPlayer");
    if (savedName) loadUser(savedName);
  }, []);

  useEffect(() => {
    if (tokensLoaded && name && typeof tokens === "number") {
      setTokenBalance(db, name, tokens);
    }
  }, [tokens, name, tokensLoaded]);

  async function loadUser(playerName) {
    Cookies.set("vpPlayer", playerName);
    setName(playerName);
    const startingTokens = await getTokenBalance(db, playerName);
    setTokens(startingTokens);
    setTokensLoaded(true);
    const scores = await fetchLeaderboard(db, "vp_leaderboard");
    setGlobalScores(scores);
  }

  async function handleStart() {
    if (!nameInput) return;
    await loadUser(nameInput);
  }

  function handleSwitchUser() {
    Cookies.remove("vpPlayer");
    setName("");
    setNameInput("");
    setTokens(100);
    setTokensLoaded(false);
    setHand([]);
    setDeck([]);
    setIsHolding([false, false, false, false, false]);
    setDrawPhase(false);
    setMessage("");
  }

  function dealHand() {
    if (tokens <= 0) {
      setMessage("You're out of tokens. Request 10 more to keep playing.");
      return;
    }
    const newDeck = shuffleDeck(createDeck());
    const newHand = newDeck.slice(0, 5);
    setDeck(newDeck.slice(5));
    setHand(newHand);
    setIsHolding([false, false, false, false, false]);
    setDrawPhase(true);
    setTokens(tokens - 1);
    setMessage("Click cards to hold, then click Draw.");
  }

  async function handleDraw() {
    const newHand = hand.map((card, idx) =>
      isHolding[idx] ? card : deck.pop()
    );
    setHand(newHand);
    setDeck([...deck]);
    const result = evaluateHand(newHand);
    const payout = result.multiplier;
    setTokens(tokens + payout);
    setMessage(
      payout > 0
        ? `${result.name} – You win ${payout} token${payout > 1 ? "s" : ""}!`
        : "No win – Better luck next time!"
    );
    setDrawPhase(false);
    setIsHolding([false, false, false, false, false]);

    try {
      await submitScore(db, "vp_leaderboard", name, payout > 0 ? 1 : 0, payout === 0 ? 1 : 0, 0);
      const scores = await fetchLeaderboard(db, "vp_leaderboard");
      setGlobalScores(scores);
    } catch (err) {
      console.error("Failed to submit score:", err);
    }
  }

  function toggleHold(index) {
    if (!drawPhase) return;
    const updated = [...isHolding];
    updated[index] = !updated[index];
    setIsHolding(updated);
  }

  function requestTokens() {
    setTokens(tokens + 10);
    setMessage("You've received 10 more tokens.");
  }

  function getCardString(card) {
    return `${card.rank}${card.suit}`;
  }

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center flex-col p-4">
      <h1 className="text-4xl font-bold mb-4">🎰 Video Poker</h1>

      {!name ? (
        <div className="flex flex-col items-center">
          <input
            type="text"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            placeholder="Enter your name"
            className="p-2 rounded text-black"
          />
          <button
            className="mt-2 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded text-white"
            onClick={handleStart}
          >
            Start
          </button>
        </div>
      ) : (
        <>
          <div className="mb-2 text-lg">Welcome, {name}</div>
          <div className="mb-2">Tokens: {tokens}</div>
          <button
            onClick={handleSwitchUser}
            className="mb-2 bg-red-500 hover:bg-red-600 px-4 py-1 rounded"
          >
            Switch User
          </button>
          {!drawPhase ? (
            <button
              onClick={dealHand}
              disabled={tokens <= 0}
              className={`mt-2 px-4 py-2 rounded ${
                tokens > 0
                  ? "bg-green-600 hover:bg-green-700"
                  : "bg-gray-600 cursor-not-allowed"
              }`}
            >
              Play (1 token)
            </button>
          ) : (
            <button
              onClick={handleDraw}
              className="mt-2 bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded"
            >
              Draw
            </button>
          )}

          {tokens <= 0 && !drawPhase && (
            <button
              onClick={requestTokens}
              className="mt-2 bg-yellow-600 hover:bg-yellow-700 px-4 py-2 rounded"
            >
              Request 10 Tokens
            </button>
          )}

          {hand.length > 0 && (
            <div className="mt-4 flex gap-2">
              {hand.map((card, idx) => (
                <div
                  key={idx}
                  onClick={() => toggleHold(idx)}
                  className={`p-4 bg-white text-black rounded text-xl flex flex-col items-center cursor-pointer transition duration-150 ease-in-out ${
                    isHolding[idx] ? "ring-4 ring-yellow-400 shadow-md" : ""
                  }`}
                >
                  <span className={["♥", "♦"].includes(card.suit) ? "text-red-600" : ""}>
                    {getCardString(card)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {message && <div className="mt-2 text-yellow-400">{message}</div>}

          <h2 className="mt-6 text-2xl font-bold">Global Leaderboard</h2>
          <ul className="mt-2">
            {globalScores.map((entry, index) => (
              <li key={index}>
                {entry.name}: {entry.wins}W / {entry.losses}L / {entry.ties}T
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

