# MFA fix + deployment

## 1. Fix a user's MFA phone (root cause of the login failure)

The login failure was at the **SMS step**: the verification code could not be
sent to the user's enrolled phone number, and the app mislabeled it as
"wrong email or password". `fix-mfa.js` inspects/replaces/removes a user's
enrolled SMS second factor (and syncs the Firestore `phone` field).

### Run

```bash
cd frontend

# 1) Inspect the current state
node scripts/fix-mfa.js list binyamin.zaidner@gmail.com

# 2a) Point MFA at a number that CAN receive SMS (E.164, recommended fix)
node scripts/fix-mfa.js set binyamin.zaidner@gmail.com +972XXXXXXXXX

#  or 2b) Remove MFA so the user re-enrolls fresh from the app
node scripts/fix-mfa.js remove binyamin.zaidner@gmail.com
```

`firebase-admin` is already installed in `frontend/`. The script auto-detects the
service-account key already in `frontend/` (or set
`GOOGLE_APPLICATION_CREDENTIALS`). **Never commit the key** — it's in `.gitignore`.

After `set`, ask the user to log in: the code is now sent to the new number.

## 2. Deploy the code fix (better error messages)

Changed files: `frontend/lib/auth.tsx`, `frontend/app/login/page.tsx`
(distinguish "SMS send failed" / "too many requests" from "wrong password",
and log the real Firebase error code to the console).

Project: `election-management-145fc` · App Hosting backend: `frontend`

```bash
# Sanity check before deploy
cd frontend && npx tsc --noEmit && npm run build

# Option A — App Hosting connected to GitHub (most common):
git add frontend/lib/auth.tsx frontend/app/login/page.tsx frontend/scripts
git commit -m "fix(auth): distinguish SMS-send failure from wrong password + admin MFA script"
git push            # App Hosting builds & rolls out automatically

# Option B — manual rollout via CLI (firebase-tools logged in):
firebase apphosting:rollouts:create frontend --project election-management-145fc
```

> Firestore rules were not changed. If you ever do change them:
> `firebase deploy --only firestore:rules --project election-management-145fc`

## 3. Clean up

Remove the temporary **test phone number** (fixed code) from
Authentication → Sign-in method → Phone → "Phone numbers for testing" once real
SMS works — leaving it in production is a security hole.
