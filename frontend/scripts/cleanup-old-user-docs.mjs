// Safe cleanup of leftover OLD user docs after the Firebase Auth migration.
//
// Background: import-users-to-auth.mjs created a CLEAN profile doc keyed by the
// Auth uid (no password field) for every user. The ORIGINAL docs (keyed by the
// old id like "usr1", still containing a `password` field) were left in place
// on purpose. Now that login + reset are verified, this removes them.
//
// Safety design:
//   * DRY RUN by default. It only reports. Pass --apply to actually write.
//   * An OLD doc is deleted ONLY if a matching CLEAN profile (uid-keyed, no
//     password) with the same email exists. Otherwise it is skipped + WARNed,
//     so no user is ever orphaned.
//   * Any stray `password` field found on a CLEAN (uid-keyed) doc is removed
//     with FieldValue.delete() — the doc itself is kept.
//
// Run from the frontend folder:
//   node scripts/cleanup-old-user-docs.mjs            # dry run (safe preview)
//   node scripts/cleanup-old-user-docs.mjs --apply    # perform the changes

import { readFileSync } from "fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

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
  console.log(APPLY ? "=== APPLY MODE — changes WILL be written ===\n"
                    : "=== DRY RUN — no changes will be written (use --apply) ===\n");

  const authUids = await authUidSet();
  const snap = await db.collection("users").get();

  // Index clean profiles by email so we can verify before deleting.
  const cleanEmails = new Set();
  const cleanWithPassword = [];
  const oldDocs = [];

  for (const doc of snap.docs) {
    const u = doc.data();
    const email = (u.email || "").trim().toLowerCase();
    const hasPassword = Object.prototype.hasOwnProperty.call(u, "password");
    const isUidKeyed = authUids.has(doc.id);

    if (isUidKeyed) {
      if (email) cleanEmails.add(email);
      if (hasPassword) cleanWithPassword.push({ ref: doc.ref, id: doc.id, email });
    } else {
      oldDocs.push({ ref: doc.ref, id: doc.id, email, hasPassword });
    }
  }

  console.log(`Auth accounts: ${authUids.size}`);
  console.log(`Total Firestore user docs: ${snap.size}`);
  console.log(`Clean (uid-keyed) profiles: ${snap.size - oldDocs.length}`);
  console.log(`Old (non-uid-keyed) docs: ${oldDocs.length}`);
  console.log(`Clean docs still carrying a password field: ${cleanWithPassword.length}\n`);

  let deleted = 0, skippedNoProfile = 0, strippedPw = 0;

  // 1) Strip stray password fields from clean profiles.
  for (const c of cleanWithPassword) {
    console.log(`STRIP password from clean doc ${c.id} (${c.email})`);
    if (APPLY) { await c.ref.update({ password: FieldValue.delete() }); }
    strippedPw++;
  }

  // 2) Delete old docs that have a verified clean profile for the same email.
  for (const o of oldDocs) {
    if (o.email && cleanEmails.has(o.email)) {
      console.log(`DELETE old doc ${o.id} (${o.email})`);
      if (APPLY) { await o.ref.delete(); }
      deleted++;
    } else {
      console.log(`WARN  keep old doc ${o.id} (${o.email || "no email"}) — no clean profile, NOT deleting`);
      skippedNoProfile++;
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Old docs deleted${APPLY ? "" : " (would delete)"}: ${deleted}`);
  console.log(`Old docs kept (no clean profile): ${skippedNoProfile}`);
  console.log(`Password fields stripped${APPLY ? "" : " (would strip)"}: ${strippedPw}`);
  if (!APPLY) console.log(`\nThis was a DRY RUN. Re-run with --apply to perform the changes.`);
  process.exit(0);
}

run().catch((e) => { console.error(e); process.exit(1); });
