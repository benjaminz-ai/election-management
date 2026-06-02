// RECOVERY: a company freeze disabled the super admin (because the
// isSuperAdmin claim was missing). This:
//   1) prints the super admin's current state (diagnostic),
//   2) re-enables the super admin + restores claims (role/admin, tenantId, isSuperAdmin),
//   3) unfreezes the home tenant and re-enables all its users.
//
// Run from the frontend folder:
//   node scripts/recover-superadmin.mjs

import { readFileSync } from "fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const SUPER_EMAIL = "binyamin.zaidner@gmail.com";
const TENANT_ID = "tzachi-zelicha";

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
  // 1) Diagnostic + fix super admin.
  const rec = await auth.getUserByEmail(SUPER_EMAIL);
  console.log(`BEFORE: ${SUPER_EMAIL} disabled=${rec.disabled} claims=${JSON.stringify(rec.customClaims || {})}`);

  await auth.updateUser(rec.uid, { disabled: false });
  await auth.setCustomUserClaims(rec.uid, {
    ...(rec.customClaims || {}),
    role: "admin",
    tenantId: TENANT_ID,
    isSuperAdmin: true,
  });
  await db.collection("users").doc(rec.uid).set({ tenantId: TENANT_ID, isSuperAdmin: true, isFrozen: false }, { merge: true });
  console.log(`FIXED super admin: re-enabled + role/tenant/isSuperAdmin restored.`);

  // 2) Unfreeze the home tenant.
  await db.collection("tenants").doc(TENANT_ID).set({ isFrozen: false }, { merge: true });
  console.log(`UNFROZE tenant ${TENANT_ID}.`);

  // 3) Re-enable all users of that tenant.
  let token, reenabled = 0;
  do {
    const res = await auth.listUsers(1000, token);
    for (const u of res.users) {
      if ((u.customClaims || {}).tenantId === TENANT_ID && u.disabled) {
        await auth.updateUser(u.uid, { disabled: false });
        console.log(`RE-ENABLE ${u.email}`);
        reenabled++;
      }
    }
    token = res.pageToken;
  } while (token);

  console.log(`\nDone. Re-enabled ${reenabled} additional users. Try logging in now.`);
  process.exit(0);
}

run().catch((e) => { console.error(e); process.exit(1); });
