// Removes the super admin's enrolled MFA factor so they re-enroll fresh
// (with a real phone) on next login — the same working flow other users use.
// Also re-enables the account just in case.
//
//   node scripts/reset-superadmin-mfa.mjs

import { readFileSync } from "fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const EMAIL = "binyamin.zaidner@gmail.com";

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

async function run() {
  const rec = await auth.getUserByEmail(EMAIL);
  const factors = (rec.multiFactor?.enrolledFactors || []).map((f) => f.phoneNumber || f.factorId);
  console.log(`BEFORE: ${EMAIL} disabled=${rec.disabled} enrolledFactors=${JSON.stringify(factors)}`);

  await auth.updateUser(rec.uid, { disabled: false, multiFactor: { enrolledFactors: null } });
  console.log(`Removed MFA factors + re-enabled. On next login you'll be sent to /enroll-mfa to enroll fresh.`);
  process.exit(0);
}
run().catch((e) => { console.error(e); process.exit(1); });
