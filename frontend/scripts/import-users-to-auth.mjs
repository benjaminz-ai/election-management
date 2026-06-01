// One-time migration: create a Firebase Auth account for every existing
// Firestore `users` document, preserving email + password + role.
//
// Run locally from the frontend folder:
//   node scripts/import-users-to-auth.mjs
//
// Requires FIREBASE_SERVICE_ACCOUNT_PATH (set in .env.local) — this script
// reads it directly from the environment.

import { readFileSync } from "fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

// Load .env.local manually (this is a plain node script, not Next.js)
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
if (!keyPath) {
  console.error("FIREBASE_SERVICE_ACCOUNT_PATH is not set (check .env.local)");
  process.exit(1);
}

const serviceAccount = JSON.parse(readFileSync(keyPath, "utf8"));
initializeApp({ credential: cert(serviceAccount) });

const auth = getAuth();
const db = getFirestore();

const VALID_ROLES = ["admin", "field", "telemarketing", "group_leader", "division_head"];

async function run() {
  const snap = await db.collection("users").get();
  console.log(`Found ${snap.size} user document(s) in Firestore.\n`);

  let created = 0, skipped = 0, failed = 0;

  for (const doc of snap.docs) {
    const u = doc.data();
    const email = (u.email || "").trim().toLowerCase();
    const password = u.password;
    const role = VALID_ROLES.includes(u.role) ? u.role : "field";
    const displayName = `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim();

    if (!email || !password) {
      console.warn(`SKIP  ${doc.id}: missing email or password`);
      skipped++;
      continue;
    }

    try {
      // Already exists? (re-running the script is safe)
      let userRecord;
      try {
        userRecord = await auth.getUserByEmail(email);
        console.log(`EXISTS ${email} -> ${userRecord.uid} (updating role claim)`);
      } catch {
        userRecord = await auth.createUser({ email, password, displayName });
        console.log(`CREATE ${email} -> ${userRecord.uid} (role: ${role})`);
        created++;
      }

      // Set / refresh role claim
      await auth.setCustomUserClaims(userRecord.uid, { role });

      // Write a clean profile doc keyed by the Auth uid (no password field)
      await db.collection("users").doc(userRecord.uid).set({
        id: userRecord.uid,
        firstName: u.firstName ?? "",
        lastName: u.lastName ?? "",
        email,
        phone: u.phone ?? "",
        role,
        isFrozen: Boolean(u.isFrozen),
        createdAt: u.createdAt ?? new Date().toISOString(),
      }, { merge: true });

    } catch (e) {
      console.error(`FAIL  ${email}: ${e.message}`);
      failed++;
    }
  }

  console.log(`\nDone. created=${created} skipped=${skipped} failed=${failed}`);
  console.log("NOTE: old Firestore user docs keyed by the old id (usr1...) still exist.");
  console.log("Do NOT delete the 'password' field or old docs until login is fully migrated and verified.");
  process.exit(0);
}

run().catch((e) => { console.error(e); process.exit(1); });
