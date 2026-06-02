// READ-ONLY inspection of the `users` collection.
// Shows how many docs exist, which are "old" (have a password field /
// non-uid key) vs "clean" (uid-keyed, no password), grouped by email so we
// can confirm every old doc has a matching clean profile before deleting.
//
//   node scripts/inspect-users.mjs

import { readFileSync } from "fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

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

const keyPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
if (!keyPath) { console.error("FIREBASE_SERVICE_ACCOUNT_PATH not set"); process.exit(1); }

initializeApp({ credential: cert(JSON.parse(readFileSync(keyPath, "utf8"))) });
const auth = getAuth();
const db = getFirestore();

// Build a set of valid Auth uids so we can tell uid-keyed docs apart.
async function authUidSet() {
  const set = new Set();
  let token;
  do {
    const res = await auth.listUsers(1000, token);
    res.users.forEach((u) => set.add(u.uid));
    token = res.pageToken;
  } while (token);
  return set;
}

async function run() {
  const authUids = await authUidSet();
  const snap = await db.collection("users").get();
  console.log(`Auth accounts: ${authUids.size}`);
  console.log(`Firestore users docs: ${snap.size}\n`);

  const byEmail = {};
  const oldDocs = [];
  const cleanDocs = [];

  for (const doc of snap.docs) {
    const u = doc.data();
    const email = (u.email || "").trim().toLowerCase();
    const hasPassword = Object.prototype.hasOwnProperty.call(u, "password");
    const isUidKeyed = authUids.has(doc.id);
    const entry = { id: doc.id, email, hasPassword, isUidKeyed, role: u.role };
    (byEmail[email] ||= []).push(entry);
    if (hasPassword || !isUidKeyed) oldDocs.push(entry);
    else cleanDocs.push(entry);
  }

  console.log(`=== Classification ===`);
  console.log(`Clean (uid-keyed, no password): ${cleanDocs.length}`);
  console.log(`Old (has password OR non-uid key): ${oldDocs.length}\n`);

  console.log(`=== Per-email breakdown ===`);
  let safe = 0, unsafe = 0;
  for (const [email, docs] of Object.entries(byEmail)) {
    const clean = docs.filter((d) => d.isUidKeyed && !d.hasPassword);
    const old = docs.filter((d) => d.hasPassword || !d.isUidKeyed);
    const ok = clean.length >= 1; // has a clean profile -> safe to delete old
    if (old.length) (ok ? safe++ : unsafe++);
    const flag = old.length === 0 ? "    " : ok ? "OK  " : "WARN";
    console.log(`${flag} ${email || "(no email)"} | clean=${clean.length} old=${old.length} | ids: ${docs.map((d)=>d.id).join(", ")}`);
  }

  console.log(`\nEmails with old docs safe to delete (clean profile exists): ${safe}`);
  console.log(`Emails with old docs but NO clean profile (DO NOT delete): ${unsafe}`);
  process.exit(0);
}

run().catch((e) => { console.error(e); process.exit(1); });
