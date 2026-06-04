"use client";

import React, { createContext, useContext, useState, useRef, useCallback, useMemo, useEffect, ReactNode } from "react";
import {
  signInWithEmailAndPassword, signOut,
  getMultiFactorResolver, PhoneAuthProvider, PhoneMultiFactorGenerator,
  RecaptchaVerifier, type MultiFactorResolver,
} from "firebase/auth";
import { auth as fbAuth, db } from "./firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { useStore } from "./store";
import { AppUser } from "@/types";

// "invalid"     → wrong email/password (or legacy fallback failed)
// "mfa"          → password OK, SMS code sent, waiting for the code
// "sms_failed"   → password OK, but sending the SMS code failed (e.g. the
//                  registered phone can't receive Firebase's verification SMS).
//                  IMPORTANT: this is NOT a wrong password — see the login page.
// "too_many"     → password OK, but Firebase temporarily blocked SMS to this
//                  number after too many attempts (auth/too-many-requests).
export type LoginResult = "ok" | "frozen" | "invalid" | "mfa" | "sms_failed" | "too_many";

type AuthCtx = {
  currentUser: AppUser | null;
  login: (email: string, password: string) => Promise<LoginResult>;
  // Completes a login that returned "mfa", using the SMS code the user received.
  completeMfa: (code: string) => Promise<LoginResult>;
  logout: () => void;
};

const AuthContext = createContext<AuthCtx>({
  currentUser: null,
  login: async () => "invalid",
  completeMfa: async () => "invalid",
  logout: () => {},
});

const STORAGE_KEY = "mvp_uid";
const SESSION_KEY = "mvp_login_at";
const ACTIVITY_KEY = "mvp_last_activity";
const SESSION_DURATION = 8 * 60 * 60 * 1000;      // absolute cap: 8 hours from login
const INACTIVITY_DURATION = 30 * 60 * 1000;       // idle timeout: 30 minutes of no activity

// Session is valid only if BOTH the absolute cap and the inactivity window hold.
function isSessionValid(): boolean {
  if (typeof window === "undefined") return false;
  const loginAt = localStorage.getItem(SESSION_KEY);
  if (!loginAt) return false;
  if (Date.now() - parseInt(loginAt, 10) >= SESSION_DURATION) return false;
  const lastActivity = localStorage.getItem(ACTIVITY_KEY);
  if (lastActivity && Date.now() - parseInt(lastActivity, 10) >= INACTIVITY_DURATION) return false;
  return true;
}

function markActivity() {
  if (typeof window === "undefined") return;
  localStorage.setItem(ACTIVITY_KEY, Date.now().toString());
}

function clearSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(ACTIVITY_KEY);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { state, refreshUsers } = useStore();

  // Always-current refs so callbacks never have stale closures
  const usersRef = useRef<AppUser[]>(state.users);
  usersRef.current = state.users;

  const refreshUsersRef = useRef(refreshUsers);
  refreshUsersRef.current = refreshUsers;

  // Holds the in-progress MFA challenge between login() and completeMfa().
  const mfaRef = useRef<{ resolver: MultiFactorResolver; verificationId: string; verifier?: RecaptchaVerifier } | null>(null);

  // ONE persistent invisible reCAPTCHA verifier, reused for every attempt.
  // Creating a NEW verifier and calling .clear() on each attempt is what caused
  //   "Uncaught TypeError: Cannot read properties of null (reading 'style')"
  //   in recaptcha__iw.js
  // which silently broke SMS sending (verifyPhoneNumber threw → the app showed
  // a misleading "wrong password"). We create it lazily, once, and never clear it.
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);
  const getRecaptcha = useCallback((): RecaptchaVerifier => {
    if (!recaptchaRef.current) {
      recaptchaRef.current = new RecaptchaVerifier(fbAuth, "recaptcha-container", { size: "invisible" });
    }
    return recaptchaRef.current;
  }, []);

  const [currentUserId, setCurrentUserId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const uid = localStorage.getItem(STORAGE_KEY);
    if (!uid) return null;
    // Clear expired sessions on load
    if (!isSessionValid()) {
      clearSession();
      return null;
    }
    return uid;
  });

  // Derive currentUser — returns null if user is frozen or not found
  const currentUser = useMemo(() => {
    if (!currentUserId) return null;
    const user = state.users.find((u) => u.id === currentUserId);
    if (!user || user.isFrozen) return null;
    return user;
  }, [state.users, currentUserId]);

  // Auto-logout: when user is frozen while logged in, clear session immediately
  useEffect(() => {
    if (!currentUserId || state.users.length === 0) return;
    const user = state.users.find((u) => u.id === currentUserId);
    if (!user || user.isFrozen) {
      clearSession();
      setCurrentUserId(null);
    }
  }, [state.users, currentUserId]);

  // Session expiry: check every minute (absolute cap + inactivity)
  useEffect(() => {
    const interval = setInterval(() => {
      if (currentUserId && !isSessionValid()) {
        clearSession();
        setCurrentUserId(null);
      }
    }, 60 * 1000);
    return () => clearInterval(interval);
  }, [currentUserId]);

  // Track user activity to drive the inactivity timeout
  useEffect(() => {
    if (!currentUserId) return;
    let throttled = false;
    const onActivity = () => {
      if (throttled) return;
      throttled = true;
      markActivity();
      setTimeout(() => { throttled = false; }, 10 * 1000); // at most once / 10s
    };
    const events: (keyof WindowEventMap)[] = ["mousedown", "keydown", "scroll", "touchstart", "mousemove"];
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    return () => events.forEach((e) => window.removeEventListener(e, onActivity));
  }, [currentUserId]);

  // Real-time: if THIS user is frozen (or deleted) elsewhere, log out at once.
  useEffect(() => {
    if (!currentUserId) return;
    const unsub = onSnapshot(
      doc(db, "users", currentUserId),
      (snap) => {
        if (!snap.exists() || snap.data()?.isFrozen) {
          clearSession();
          setCurrentUserId(null);
        }
      },
      () => {}
    );
    return () => unsub();
  }, [currentUserId]);

  const startSession = (id: string) => {
    setCurrentUserId(id);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, id);
      localStorage.setItem(SESSION_KEY, Date.now().toString());
      markActivity();
    }
  };

  const login = useCallback(async (email: string, password: string): Promise<LoginResult> => {
    const normalizedEmail = email.trim().toLowerCase();

    // ── Primary path: Firebase Authentication ────────────────────────────────
    try {
      const cred = await signInWithEmailAndPassword(fbAuth, normalizedEmail, password);
      const uid = cred.user.uid;
      // NOW authenticated — only now is it safe to read the tenant-scoped users
      // list. Reading it BEFORE sign-in caused the console error
      //   "refreshUsers failed FirebaseError: Missing or insufficient permissions"
      // because Firestore rules require an authenticated request.
      await refreshUsersRef.current();
      const users = usersRef.current;
      // Profile is keyed by the Firebase uid; fall back to email match if needed.
      const profile = users.find((u) => u.id === uid)
        ?? users.find((u) => u.email.toLowerCase() === normalizedEmail);
      if (profile?.isFrozen) { await signOut(fbAuth); return "frozen"; }
      startSession(profile?.id ?? uid);
      return "ok";
    } catch (e: unknown) {
      // ── Two-factor required: send the SMS and ask the page for the code ──────
      if ((e as { code?: string })?.code === "auth/multi-factor-auth-required") {
        // Reuse the ONE persistent invisible reCAPTCHA (see getRecaptcha).
        // Do NOT create-and-clear a new verifier per attempt — that is what
        // crashed recaptcha__iw.js ("Cannot read properties of null") and
        // silently broke SMS sending for already-enrolled users.
        try {
          const verifier = getRecaptcha();
          await verifier.render(); // idempotent; guarantees the widget exists
          const resolver = getMultiFactorResolver(fbAuth, e as Parameters<typeof getMultiFactorResolver>[1]);
          const phoneProvider = new PhoneAuthProvider(fbAuth);
          const verificationId = await phoneProvider.verifyPhoneNumber(
            { multiFactorHint: resolver.hints[0], session: resolver.session },
            verifier
          );
          mfaRef.current = { resolver, verificationId };
          return "mfa";
        } catch (smsErr: unknown) {
          // The password was already accepted (that's why we're inside the
          // multi-factor branch). What failed here is SENDING the SMS code
          // (most often a reCAPTCHA failure). Do NOT report this as "invalid" —
          // that would show a misleading "wrong password" message.
          const smsCode = (smsErr as { code?: string })?.code || "";
          console.error("MFA SMS send failed (password was valid):", smsCode || smsErr);
          if (smsCode === "auth/too-many-requests") return "too_many";
          return "sms_failed";
        }
      }
      // ── Fallback: legacy Firestore check (transition safety net) ────────────
      // Best-effort; the users list may be empty here (rules require auth).
      const users = usersRef.current;
      const user = users.find((u) => u.email.toLowerCase() === normalizedEmail && u.password === password);
      if (!user) return "invalid";
      if (user.isFrozen) return "frozen";
      startSession(user.id);
      return "ok";
    }
  }, []); // stable — reads via refs

  const completeMfa = useCallback(async (code: string): Promise<LoginResult> => {
    const ctx = mfaRef.current;
    if (!ctx) return "invalid";
    try {
      const cred = PhoneAuthProvider.credential(ctx.verificationId, code);
      const assertion = PhoneMultiFactorGenerator.assertion(cred);
      const userCred = await ctx.resolver.resolveSignIn(assertion);
      mfaRef.current = null;
      const uid = userCred.user.uid;
      await refreshUsersRef.current();
      const users = usersRef.current;
      const profile = users.find((u) => u.id === uid)
        ?? users.find((u) => u.email.toLowerCase() === (userCred.user.email || "").toLowerCase());
      if (profile?.isFrozen) { await signOut(fbAuth); return "frozen"; }
      startSession(profile?.id ?? uid);
      return "ok";
    } catch {
      return "invalid";
    }
  }, []);

  const logout = useCallback(() => {
    setCurrentUserId(null);
    clearSession();
    signOut(fbAuth).catch(() => {});
  }, []);

  return (
    <AuthContext.Provider value={{ currentUser, login, completeMfa, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
// end of auth.tsx
