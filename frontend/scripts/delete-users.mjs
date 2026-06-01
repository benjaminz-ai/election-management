// One-time cleanup: permanently delete the demo users from Firebase Auth
// AND from Firestore (every doc whose email matches — old usrN docs and the
// new uid-keyed docs alike).
//
// Run from the frontend folder:
//   node scripts/delete-users.mjs

import { readFileSync } from "fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

// Emails to remove (confirmed by the user)
const EMAILS_TO_DELETE = [
  "admin@election.co.il",
  "dana@election.co.il",
  "uri@election.co.il",
  "michal@election.co.il",
  "roi@election.co.il",
  "benntzy@gmail.com",
];

function loadEnvLocal() {
  try {
    const txt = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
    for (const line of txt.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) process.env[m[1]] = m[2];
    }
  } catch {}
}
loadEnvLocal();

const keyPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
if (!keyPath) { console.error("FIREBASE_SERVICE_ACCOUNT_PATH not set"); process.exit(1); }

initializeApp({ credential: cert(JSON.parse(readFileSync(keyPath, "utf8"))) });
const auth = getAuth();
const db = getFirestore();

async function run() {
  for (const email of EMAILS_TO_DELETE) {
    const target = email.trim().toLowerCase();

    // 1) Delete from Firebase Auth
    try {
      const rec = await auth.getUserByEmail(target);
      await auth.deleteUser(rec.uid);
      console.log(`AUTH  deleted ${target} (${rec.uid})`);
    } catch (e) {
      console.log(`AUTH  not found ${target} (${e.code || e.message})`);
    }

    // 2) Delete every Firestore users doc with this email
    const snap = await db.collection("users").where("email", "==", target).get();
    if (snap.empty) {
      console.log(`FS    no docs for ${target}`);
    } else {
      for (const doc of snap.docs) {
        await doc.ref.delete();
        console.log(`FS    deleted doc ${doc.id} (${target})`);
      }
    }
  }
  console.log("\nDone.");
  process.exit(0);
}

run().catch((e) => { console.error(e); process.exit(1); });
