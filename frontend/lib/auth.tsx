"use client";

import React, { createContext, useContext, useState, useRef, useCallback, useMemo, useEffect, ReactNode } from "react";
import {
  signInWithEmailAndPassword, signOut,
  getMultiFactorResolver, PhoneAuthProvider, PhoneMultiFactorGenerator,
  RecaptchaVerifier, type MultiFactorResolver,
} from "firebase/auth";
import { auth as fbAuth } from "./firebase";
import { useStore } from "./store";
import { AppUser } from "@/types";

// login() result:
//   "ok"      → signed in (no second factor required)
//   "frozen"  → account frozen
//   "invalid" → wrong email/password
//   "mfa"     → password verified; a second factor is required. NO SMS is sent
//               yet — the login page shows the OTP screen where the user clicks
//               to send the code (sendMfaCode).
export type LoginResult = "ok" | "frozen" | "invalid" | "mfa";

// sendMfaCode() result:
//   "sent"       → SMS code sent, waiting for the user to enter it
//   "too_many"   → Firebase temporarily blocked SMS (auth/too-many-requests)
//   "sms_failed" → sending failed for another reason
export type SendCodeResult = "sent" | "too_many" | "sms_failed";

type AuthCtx = {
  currentUser: AppUser | null;
  login: (email: string, password: string) => Promise<LoginResult>;
  // After login() returns "mfa": send the SMS code (triggered by user click).
  sendMfaCode: () => Promise<SendCodeResult>;
  // Completes the login using the SMS code the user received.
  completeMfa: (code: string) => Promise<LoginResult>;
  logout: () => void;
};

const AuthContext = createContext<AuthCtx>({
  currentUser: null,
  login: async () => "invalid",
  sendMfaCode: async () => "sms_failed",
  completeMfa: async () => "invalid",
  logout: () => {},
});

const STORAGE_KEY = "mvp_uid";
const SESSION_KEY = "mvp_login_at";
const ACTIVITY_KEY = "mvp_last_activity";
const SESSION_DURATION = 24 * 60 * 60 * 1000;     // absolute cap: 24 hours from login
const INACTIVITY_DURATION = 60 * 60 * 1000;       // idle timeout: 1 hour of no activity

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

  // Freeze enforcement is handled by DISABLING the Firebase Auth account
  // (server-side). A frozen user cannot sign in, and an active session is
  // dropped automatically when its token refreshes — so no client-side
  // polling or real-time listener is needed here.

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
      // ── Two-factor required: password is valid. Store the resolver and let
      //    the login page move to the OTP screen. The SMS is NOT sent here —
      //    the user sends it explicitly via sendMfaCode() (a button click).
      if ((e as { code?: string })?.code === "auth/multi-factor-auth-required") {
        const resolver = getMultiFactorResolver(fbAuth, e as Parameters<typeof getMultiFactorResolver>[1]);
        mfaRef.current = { resolver, verificationId: "" };
        return "mfa";
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

  // Send the SMS code for the pending MFA challenge (user-triggered).
  const sendMfaCode = useCallback(async (): Promise<SendCodeResult> => {
    const ctx = mfaRef.current;
    if (!ctx) return "sms_failed";
    try {
      const verifier = getRecaptcha();
      await verifier.render(); // idempotent; ensures the invisible widget exists
      const phoneProvider = new PhoneAuthProvider(fbAuth);
      const verificationId = await phoneProvider.verifyPhoneNumber(
        { multiFactorHint: ctx.resolver.hints[0], session: ctx.resolver.session },
        verifier
      );
      mfaRef.current = { ...ctx, verificationId };
      return "sent";
    } catch (smsErr: unknown) {
      const smsCode = (smsErr as { code?: string })?.code || "";
      console.error("MFA SMS send failed:", smsCode || smsErr);
      if (smsCode === "auth/too-many-requests") return "too_many";
      return "sms_failed";
    }
  }, [getRecaptcha]);

  const completeMfa = useCallback(async (code: string): Promise<LoginResult> => {
    const ctx = mfaRef.current;
    if (!ctx || !ctx.verificationId) return "invalid";
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
    <AuthContext.Provider value={{ currentUser, login, sendMfaCode, completeMfa, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
// end of auth.tsx
