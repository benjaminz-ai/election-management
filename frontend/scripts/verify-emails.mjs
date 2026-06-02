// One-time: mark every Firebase Auth user's email as verified, so they can
// enroll in two-factor (MFA). Firebase blocks MFA enrollment for unverified
// emails. Admins create these accounts with known, trusted emails.
//
// Run from the frontend folder:
//   node scripts/verify-emails.mjs

import { readFileSync } from "fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

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
if (!keyPath) { console.error("FIREBASE_SERVICE_ACCOUNT_PATH not set (check .env.local)"); process.exit(1); }

initializeApp({ credential: cert(JSON.parse(readFileSync(keyPath, "utf8"))) });
const auth = getAuth();

async function run() {
  let token, updated = 0, already = 0;
  do {
    const res = await auth.listUsers(1000, token);
    for (const u of res.users) {
      if (u.emailVerified) { already++; continue; }
      await auth.updateUser(u.uid, { emailVerified: true });
      console.log(`VERIFIED ${u.email}`);
      updated++;
    }
    token = res.pageToken;
  } while (token);
  console.log(`\nDone. verified=${updated} alreadyVerified=${already}`);
  process.exit(0);
}

run().catch((e) => { console.error(e); process.exit(1); });
