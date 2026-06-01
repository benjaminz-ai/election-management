import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "fs";

// Credentials are provided WITHOUT ever appearing in the repo:
//  - Production (App Hosting): FIREBASE_SERVICE_ACCOUNT = the JSON content (as a secret)
//  - Local dev: FIREBASE_SERVICE_ACCOUNT_PATH = absolute path to the downloaded key file
function loadServiceAccount(): Record<string, unknown> {
  // Production (App Hosting): the secret is exposed as SERVICE_ACCOUNT_KEY
  // (FIREBASE_* env-var names are reserved by App Hosting).
  const raw = process.env.SERVICE_ACCOUNT_KEY ?? process.env.FIREBASE_SERVICE_ACCOUNT;
  if (raw && raw.trim().startsWith("{")) return JSON.parse(raw);

  // Local dev: a file path in .env.local
  const path = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (path) return JSON.parse(readFileSync(path, "utf8"));

  throw new Error(
    "No service account: set SERVICE_ACCOUNT_KEY (JSON) or FIREBASE_SERVICE_ACCOUNT_PATH (file path)"
  );
}

function getAdminApp(): App {
  const existing = getApps();
  if (existing.length > 0) return existing[0];
  return initializeApp({ credential: cert(loadServiceAccount() as never) });
}

export const adminAuth = () => getAuth(getAdminApp());
export const adminDb = () => getFirestore(getAdminApp());
