import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
} from "firebase/firestore";

// Firebase config using Vite env vars
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

export async function getTokenBalance(db, name) {
  const ref = doc(db, "vp_tokens", name);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data().tokens : 100;
}

export async function setTokenBalance(db, name, tokens) {
  const ref = doc(db, "vp_tokens", name);
  await setDoc(ref, { tokens });
}

export async function submitScore(db, collectionName, name, wins, losses, ties) {
  const ref = doc(db, collectionName, name);
  const existing = await getDoc(ref);
  if (existing.exists()) {
    const data = existing.data();
    await updateDoc(ref, {
      wins: data.wins + wins,
      losses: data.losses + losses,
      ties: data.ties + ties,
    });
  } else {
    await setDoc(ref, {
      name,
      wins,
      losses,
      ties,
    });
  }
}

export async function fetchLeaderboard(db, collectionName) {
  const snapshot = await getDocs(collection(db, collectionName));
  const results = [];

  snapshot.forEach((doc) => {
    results.push(doc.data());
  });

  results.sort(
    (a, b) => b.wins - b.losses - (a.wins - a.losses)
  );
  return results;
}

