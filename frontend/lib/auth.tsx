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

export type LoginResult = "ok" | "frozen" | "invalid" | "mfa";

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
const USER_REFRESH_INTERVAL = 2 * 60 * 1000;      // re-check freeze/deletion every 2 minutes

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

  // Periodically re-fetch users so a freeze / deletion done elsewhere is enforced
  // on this session within a couple of minutes (not only on reload).
  useEffect(() => {
    if (!currentUserId) return;
    const interval = setInterval(() => {
      refreshUsersRef.current();
    }, USER_REFRESH_INTERVAL);
    return () => clearInterval(interval);
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
    // Refresh users so freeze/profile changes are reflected immediately.
    await refreshUsersRef.current();
    const users = usersRef.current;
    const normalizedEmail = email.trim().toLowerCase();

    // ── Primary path: Firebase Authentication ────────────────────────────────
    try {
      const cred = await signInWithEmailAndPassword(fbAuth, normalizedEmail, password);
      const uid = cred.user.uid;
      // Profile is keyed by the Firebase uid; fall back to email match if needed.
      const profile = users.find((u) => u.id === uid)
        ?? users.find((u) => u.email.toLowerCase() === normalizedEmail);
      if (profile?.isFrozen) { await signOut(fbAuth); return "frozen"; }
      startSession(profile?.id ?? uid);
      return "ok";
    } catch (e: unknown) {
      // ── Two-factor required: send the SMS and ask the page for the code ──────
      if ((e as { code?: string })?.code === "auth/multi-factor-auth-required") {
        try {
          if (mfaRef.current?.verifier) { try { mfaRef.current.verifier.clear(); } catch {} }
          const resolver = getMultiFactorResolver(fbAuth, e as Parameters<typeof getMultiFactorResolver>[1]);
          const verifier = new RecaptchaVerifier(fbAuth, "recaptcha-container", { size: "invisible" });
          const phoneProvider = new PhoneAuthProvider(fbAuth);
          const verificationId = await phoneProvider.verifyPhoneNumber(
            { multiFactorHint: resolver.hints[0], session: resolver.session },
            verifier
          );
          mfaRef.current = { resolver, verificationId, verifier };
          return "mfa";
        } catch {
          return "invalid";
        }
      }
      // ── Fallback: legacy Firestore check (transition safety net) ────────────
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
