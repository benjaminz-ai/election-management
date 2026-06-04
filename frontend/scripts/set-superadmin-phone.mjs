// Re-points the super admin to a REAL phone for MFA:
//   1) removes the old enrolled MFA factor (so they re-enroll fresh),
//   2) sets their profile phone to the number you pass,
//   3) re-enables the account.
//
// Pass a real mobile that can receive SMS right now (local or +972 form):
//   node scripts/set-superadmin-phone.mjs 0501234567
//   node scripts/set-superadmin-phone.mjs +972501234567

import { readFileSync } from "fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const EMAIL = "binyamin.zaidner@gmail.com";

function toE164(p) {
  p = (p || "").replace(/[^\d+]/g, "");
  if (!p) return "";
  if (p.startsWith("+")) return p;
  if (p.startsWith("00")) return "+" + p.slice(2);
  if (p.startsWith("972")) return "+" + p;
  if (p.startsWith("0")) return "+972" + p.slice(1);
  return "+972" + p;
}

const raw = process.argv[2];
if (!raw) { console.error("Usage: node scripts/set-superadmin-phone.mjs <mobile>"); process.exit(1); }
const phoneLocal = raw;
const phoneE164 = toE164(raw);

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

async function run() {
  const rec = await auth.getUserByEmail(EMAIL);
  const before = (rec.multiFactor?.enrolledFactors || []).map((f) => f.phoneNumber || f.factorId);
  console.log(`BEFORE: enrolledFactors=${JSON.stringify(before)}`);

  await auth.updateUser(rec.uid, { disabled: false, multiFactor: { enrolledFactors: null } });
  await db.collection("users").doc(rec.uid).set({ phone: phoneLocal }, { merge: true });

  console.log(`Removed old MFA. Profile phone set to "${phoneLocal}" (will dial ${phoneE164}).`);
  console.log(`Now log in → you'll be sent to /enroll-mfa → "שלח קוד" → real OTP to ${phoneE164}.`);
  process.exit(0);
}
run().catch((e) => { console.error(e); process.exit(1); });
