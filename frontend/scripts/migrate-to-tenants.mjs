// PHASE 1 of multi-tenancy: move all existing data into a first tenant
// ("המרכז למוסיקה"), stamp every document with tenantId, and set the
// tenant + super-admin custom claims on every user.
//
// This is ADDITIVE and safe — it only adds a tenantId field / claims; the
// app keeps working (extra fields/claims are ignored until phase 2).
//
// Run from the frontend folder:
//   node scripts/migrate-to-tenants.mjs            # dry run (preview)
//   node scripts/migrate-to-tenants.mjs --apply    # perform the migration

import { readFileSync } from "fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

// ── Config ────────────────────────────────────────────────────────────────────
const FIRST_TENANT_ID = "tzachi-zelicha";
const FIRST_TENANT_NAME = "רשימה של צחי זליכה";
const SUPER_ADMIN_EMAIL = "binyamin.zaidner@gmail.com";

// Every collection that holds tenant-scoped data.
const COLLECTIONS = [
  "voters", "groups", "subGroups", "groupLeaders", "divisionHeads",
  "statuses", "callStatuses", "users", "reminders", "conversationLogs",
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
  console.log(APPLY ? "=== APPLY MODE — changes WILL be written ===\n"
                    : "=== DRY RUN — no changes (use --apply) ===\n");

  // 1) Create the first tenant document.
  console.log(`TENANT  ${FIRST_TENANT_ID} ("${FIRST_TENANT_NAME}")`);
  if (APPLY) {
    await db.collection("tenants").doc(FIRST_TENANT_ID).set({
      id: FIRST_TENANT_ID,
      name: FIRST_TENANT_NAME,
      isFrozen: false,
      createdAt: new Date().toISOString(),
    }, { merge: true });
  }

  // 2) Stamp tenantId on every existing document (skip ones already stamped).
  for (const col of COLLECTIONS) {
    const snap = await db.collection(col).get();
    let toUpdate = snap.docs.filter((d) => !d.data().tenantId);
    console.log(`FS      ${col}: ${snap.size} docs, ${toUpdate.length} need tenantId`);
    if (APPLY) {
      for (let i = 0; i < toUpdate.length; i += 400) {
        const batch = db.batch();
        for (const d of toUpdate.slice(i, i + 400)) batch.update(d.ref, { tenantId: FIRST_TENANT_ID });
        await batch.commit();
      }
    }
  }

  // 3) Set custom claims (tenantId + isSuperAdmin) on every Auth user,
  //    preserving the existing role claim.
  let token, users = 0, supers = 0;
  do {
    const res = await auth.listUsers(1000, token);
    for (const u of res.users) {
      const email = (u.email || "").toLowerCase();
      const isSuper = email === SUPER_ADMIN_EMAIL;
      const claims = { ...(u.customClaims || {}), tenantId: FIRST_TENANT_ID };
      if (isSuper) claims.isSuperAdmin = true;
      console.log(`CLAIMS  ${email} -> tenantId=${FIRST_TENANT_ID}${isSuper ? " +isSuperAdmin" : ""}`);
      if (APPLY) await auth.setCustomUserClaims(u.uid, claims);
      users++;
      if (isSuper) supers++;
    }
    token = res.pageToken;
  } while (token);

  // 4) Mirror tenantId (and isSuperAdmin) onto the users profile docs.
  if (APPLY) {
    const usersSnap = await db.collection("users").get();
    for (let i = 0; i < usersSnap.docs.length; i += 400) {
      const batch = db.batch();
      for (const d of usersSnap.docs.slice(i, i + 400)) {
        const email = (d.data().email || "").toLowerCase();
        const patch = { tenantId: FIRST_TENANT_ID };
        if (email === SUPER_ADMIN_EMAIL) patch.isSuperAdmin = true;
        batch.set(d.ref, patch, { merge: true });
      }
      await batch.commit();
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Tenant: ${FIRST_TENANT_NAME} (${FIRST_TENANT_ID})`);
  console.log(`Users updated: ${users} (super admins: ${supers})`);
  if (!APPLY) console.log(`\nDRY RUN — re-run with --apply to perform the migration.`);
  process.exit(0);
}

run().catch((e) => { console.error(e); process.exit(1); });
