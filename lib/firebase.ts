import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyB6f5AkDkvsDqI99aIyj_sopKAbBlybT78",
  authDomain: "election-management-145fc.firebaseapp.com",
  projectId: "election-management-145fc",
  storageBucket: "election-management-145fc.firebasestorage.app",
  messagingSenderId: "206017653153",
  appId: "1:206017653153:web:1dfa650c6b6f1fe5d903e0",
  measurementId: "G-VTSDMX4WDD",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const db = getFirestore(app);
