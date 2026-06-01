const { initializeApp } = require("firebase/app");
const { getFirestore, collection, getDocs, updateDoc, doc } = require("firebase/firestore");

const firebaseConfig = {
  apiKey: "AIzaSyB6f5AkDkvsDqI99aIyj_sopKAbBlybT78",
  authDomain: "election-management-145fc.firebaseapp.com",
  projectId: "election-management-145fc",
  storageBucket: "election-management-145fc.firebasestorage.app",
  messagingSenderId: "206017653153",
  appId: "1:206017653153:web:1dfa650c6b6f1fe5d903e0",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function resetGroupVoterIds() {
  const snapshot = await getDocs(collection(db, "groups"));
  if (snapshot.empty) {
    console.log("No groups found.");
    process.exit(0);
  }
  let count = 0;
  for (const docSnap of snapshot.docs) {
    await updateDoc(doc(db, "groups", docSnap.id), { voterIds: [] });
    console.log(`  Reset voterIds for group: ${docSnap.data().name || docSnap.id}`);
    count++;
  }
  console.log(`\nDone — reset voterIds in ${count} groups.`);
  process.exit(0);
}

resetGroupVoterIds().catch((e) => { console.error(e); process.exit(1); });
