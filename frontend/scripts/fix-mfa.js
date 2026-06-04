/**
 * fix-mfa.js — manage a user's SMS second factor (MFA) in Firebase Auth.
 *
 * WHY THIS EXISTS
 * ---------------
 * When a user's enrolled MFA phone number cannot receive Firebase's verification
 * SMS, login fails at the SMS step. Because the app reused the same error result
 * for "wrong password" and "SMS send failed", it showed a misleading
 * "wrong email or password" message even though the password was correct.
 *
 * The Firebase console only lets you set ONE phone per user and the in-app
 * enrollment screen is admin-set / read-only, so this Admin-SDK script is the
 * clean way to inspect, REPLACE, or REMOVE a user's enrolled phone factor.
 * It also keeps the Firestore `users/{uid}.phone` field in sync, because the
 * in-app enrollment screen pre-fills the phone from that field.
 *
 * USAGE
 * -----
 *   node scripts/fix-mfa.js list   <email>
 *   node scripts/fix-mfa.js set    <email> <+972xxxxxxxxx>
 *   node scripts/fix-mfa.js remove <email>
 *
 *   # list   → show the user's enrolled second factors + disabled status
 *   # set    → replace the SMS second factor with a NEW phone (E.164) and sync Firestore
 *   # remove → clear all second factors so the user re-enrolls fresh from the app
 *
 * CREDENTIALS (pick one — checked in this order)
 * ----------------------------------------------
 *   1. env GOOGLE_APPLICATION_CREDENTIALS = absolute path to the service-account JSON
 *   2. ./serviceAccountKey.json next to this script
 *   3. ../election-management-145fc-firebase-adminsdk-fbsvc-3218279cc5.json (your existing key)
 *
 * NOTE: never commit the service-account key. It is already covered by .gitignore.
 */

const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

function loadCredential() {
  const candidates = [
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
    path.join(__dirname, "serviceAccountKey.json"),
    path.join(__dirname, "..", "election-management-145fc-firebase-adminsdk-fbsvc-3218279cc5.json"),
  ].filter(Boolean);

  for (const p of candidates) {
    if (fs.existsSync(p)) {
      console.log(`Using service account: ${p}`);
      return admin.credential.cert(require(p));
    }
  }
  throw new Error(
    "No service account key found. Set GOOGLE_APPLICATION_CREDENTIALS to your key file path."
  );
}

admin.initializeApp({ credential: loadCredential() });
const auth = admin.auth();
const db = admin.firestore();

// Israeli/E.164 phone validation. Firebase requires E.164 (e.g. +972501234567).
const E164 = /^\+\d{8,15}$/;

function usageAndExit() {
  console.log(
    [
      "Usage:",
      "  node scripts/fix-mfa.js list   <email>",
      "  node scripts/fix-mfa.js set    <email> <+972xxxxxxxxx>",
      "  node scripts/fix-mfa.js remove <email>",
    ].join("\n")
  );
  process.exit(1);
}

async function main() {
  const [cmd, emailArg, phoneArg] = process.argv.slice(2);
  if (!cmd || !emailArg) usageAndExit();

  const email = emailArg.trim().toLowerCase();
  const user = await auth.getUserByEmail(email);
  const factors = (user.multiFactor && user.multiFactor.enrolledFactors) || [];

  if (cmd === "list") {
    console.log(`\nUser:     ${user.email}`);
    console.log(`UID:      ${user.uid}`);
    console.log(`Disabled: ${user.disabled}`);
    if (!factors.length) {
      console.log("Second factors: (none enrolled)\n");
    } else {
      console.log("Second factors:");
      factors.forEach((f, i) =>
        console.log(`  [${i}] factorId=${f.factorId}  phone=${f.phoneNumber || "-"}  name=${f.displayName || "-"}`)
      );
      console.log("");
    }
    return;
  }

  if (cmd === "remove") {
    await auth.updateUser(user.uid, { multiFactor: { enrolledFactors: null } });
    console.log(`\n✅ Removed all second factors for ${user.email}.`);
    console.log("   The user can now log in with email+password and re-enroll MFA from the app.\n");
    return;
  }

  if (cmd === "set") {
    if (!phoneArg || !E164.test(phoneArg)) {
      console.error(`\n❌ Phone must be E.164, e.g. +972501234567 (got: ${phoneArg || "nothing"})\n`);
      process.exit(1);
    }
    await auth.updateUser(user.uid, {
      multiFactor: {
        enrolledFactors: [
          { phoneNumber: phoneArg, displayName: "טלפון", factorId: "phone" },
        ],
      },
    });
    // Keep the app profile phone in sync (enrollment screen reads users/{uid}.phone).
    const local = phoneArg.replace(/^\+972/, "0");
    await db.collection("users").doc(user.uid).set({ phone: local }, { merge: true });
    console.log(`\n✅ Set SMS second factor for ${user.email} to ${phoneArg}.`);
    console.log(`   Synced Firestore users/${user.uid}.phone = ${local}.`);
    console.log("   Ask the user to log in — the code will now be sent to the new number.\n");
    return;
  }

  usageAndExit();
}

main().catch((e) => {
  console.error("\nERROR:", e && e.message ? e.message : e, "\n");
  process.exit(1);
});
