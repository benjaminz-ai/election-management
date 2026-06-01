// reset_voters.mjs  —  Run from C:\MVP\frontend: node reset_voters.mjs
// Deletes all voters and clears voterIds from all groups.

import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, writeBatch } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyB6f5AkDkvsDqI99aIyj_sopKAbBlybT78",
  authDomain: "election-management-145fc.firebaseapp.com",
  projectId: "election-management-145fc",
  storageBucket: "election-management-145fc.firebasestorage.app",
  messagingSenderId: "206017653153",
  appId: "1:206017653153:web:1dfa650c6b6f1fe5d903e0",
};

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

async function main() {
  // ── 1. Delete all voters ──────────────────────────────────────────────────
  console.log("שלב 1: מוחק בוחרים...");
  const votersSnap = await getDocs(collection(db, "voters"));
  console.log(`  נמצאו ${votersSnap.size} בוחרים`);

  let deleted = 0;
  // Firestore batch limit = 500 ops
  const chunks = [];
  for (let i = 0; i < votersSnap.docs.length; i += 400) {
    chunks.push(votersSnap.docs.slice(i, i + 400));
  }
  for (const chunk of chunks) {
    const b = writeBatch(db);
    chunk.forEach((d) => b.delete(doc(db, "voters", d.id)));
    await b.commit();
    deleted += chunk.length;
    console.log(`  מחקתי ${deleted}/${votersSnap.size}...`);
  }
  console.log(`  ✓ נמחקו ${deleted} בוחרים`);

  // ── 2. Reset voterIds in all groups ───────────────────────────────────────
  console.log("\nשלב 2: מאפס voterIds בקבוצות...");
  const groupsSnap = await getDocs(collection(db, "groups"));
  console.log(`  נמצאו ${groupsSnap.size} קבוצות`);

  if (groupsSnap.size > 0) {
    const b = writeBatch(db);
    groupsSnap.docs.forEach((d) => b.update(doc(db, "groups", d.id), { voterIds: [] }));
    await b.commit();
    console.log(`  ✓ אופסו voterIds ב-${groupsSnap.size} קבוצות`);
  }

  console.log("\n✅ הכל הושלם — ניתן לייבא בוחרים חדשים");
  process.exit(0);
}

main().catch((e) => { console.error("שגיאה:", e.message); process.exit(1); });
