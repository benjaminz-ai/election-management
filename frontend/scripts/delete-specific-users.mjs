// Targeted deletion of specific users by email — removes the Firebase Auth
// account (if any) AND every Firestore `users` doc with that email.
//
// Edit EMAILS_TO_DELETE below, then run from the frontend folder:
//   node scripts/delete-specific-users.mjs            # dry run (preview)
//   node scripts/delete-specific-users.mjs --apply    # perform deletion

import { readFileSync } from "fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

// Confirmed for deletion by the user:
const EMAILS_TO_DELETE = [
  "a@b.xo.il",
];

function loadEnvLocal() {
  try {
    const txt = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
    for (const line of txt.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {}
}
loadEnvLocal();

const APPLY = process.argv.includes("--apply");

const keyPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
if (!keyPath) { console.error("FIREBASE_SERVICE_ACCOUNT_PATH not set (check .env.local)"); process.exit(1); }

initializeApp({ credential: cert(JSON.parse(readFileSync(keyPath, "utf8"))) });
const auth = getAuth();
const db = getFirestore();

async function run() {
  console.log(APPLY ? "=== APPLY MODE — deletions WILL happen ===\n"
                    : "=== DRY RUN — nothing deleted (use --apply) ===\n");

  for (const email of EMAILS_TO_DELETE) {
    const target = email.trim().toLowerCase();

    // 1) Firebase Auth account (if it exists)
    try {
      const rec = await auth.getUserByEmail(target);
      console.log(`AUTH  delete ${target} (${rec.uid})`);
      if (APPLY) await auth.deleteUser(rec.uid);
    } catch (e) {
      console.log(`AUTH  none for ${target} (${e.code || e.message})`);
    }

    // 2) Every Firestore users doc with this email
    const snap = await db.collection("users").where("email", "==", target).get();
    if (snap.empty) {
      console.log(`FS    no docs for ${target}`);
    } else {
      for (const doc of snap.docs) {
        console.log(`FS    delete doc ${doc.id} (${target})`);
        if (APPLY) await doc.ref.delete();
      }
    }
  }

  console.log(APPLY ? "\nDone." : "\nDRY RUN complete. Re-run with --apply to delete.");
  process.exit(0);
}

run().catch((e) => { console.error(e); process.exit(1); });
