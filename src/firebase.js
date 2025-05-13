import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc
} from "firebase/firestore";

// ✅ Load from environment variables (VITE_ prefix required in Vite)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Initialize Firebase app + Firestore
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// --- Leaderboard Helpers ---
export async function submitScore(db, collectionName, playerName, wins, losses, ties) {
  const ref = doc(db, collectionName, playerName);
  const existing = await getDoc(ref);

  if (existing.exists()) {
    const data = existing.data();
    await updateDoc(ref, {
      wins: data.wins + wins,
      losses: data.losses + losses,
      ties: data.ties + ties
    });
  } else {
    await setDoc(ref, {
      name: playerName,
      wins,
      losses,
      ties
    });
  }
}

export async function fetchLeaderboard(db, collectionName) {
  const snapshot = await getDocs(collection(db, collectionName));
  const results = [];

  snapshot.forEach(doc => {
    results.push(doc.data());
  });

  results.sort((a, b) => (b.wins - b.losses) - (a.wins - a.losses));
  return results;
}

// --- Token Storage Helpers ---
export async function getTokenBalance(db, userId) {
  const ref = doc(db, "vp_tokens", userId);
  const snapshot = await getDoc(ref);

  if (snapshot.exists()) {
    return snapshot.data().tokens;
  } else {
    await setDoc(ref, { tokens: 100 }, { merge: true }); // ✅ safer initial write
    return 100;
  }
}

export async function setTokenBalance(db, userId, amount) {
  const ref = doc(db, "vp_tokens", userId);
  await setDoc(ref, { tokens: amount }, { merge: true }); // ✅ prevent overwrite errors
}

