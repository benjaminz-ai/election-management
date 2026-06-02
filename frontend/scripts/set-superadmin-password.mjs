// Sets a KNOWN password for the super admin, directly via Admin SDK, so we
// can rule out any password ambiguity. Also ensures the account is enabled.
//
//   node scripts/set-superadmin-password.mjs
//
// Then log in with exactly the password below.

import { readFileSync } from "fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const EMAIL = "binyamin.zaidner@gmail.com";
const NEW_PASSWORD = "Recover2026!";

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
  console.log(`Found ${EMAIL} (uid ${rec.uid}) disabled=${rec.disabled} mfaFactors=${(rec.multiFactor?.enrolledFactors || []).length}`);
  await auth.updateUser(rec.uid, { password: NEW_PASSWORD, disabled: false });
  console.log(`\nPassword set. Log in with:\n  email:    ${EMAIL}\n  password: ${NEW_PASSWORD}\n`);
  console.log("After the password, you'll get an SMS code (MFA is enrolled). Enter it to finish.");
  process.exit(0);
}
run().catch((e) => { console.error(e); process.exit(1); });
