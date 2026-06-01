"use client";

import React, { createContext, useContext, useState, useRef, useCallback, useMemo, useEffect, ReactNode } from "react";
import { useStore } from "./store";
import { AppUser } from "@/types";

export type LoginResult = "ok" | "frozen" | "invalid";

type AuthCtx = {
  currentUser: AppUser | null;
  login: (email: string, password: string) => Promise<LoginResult>;
  logout: () => void;
};

const AuthContext = createContext<AuthCtx>({
  currentUser: null,
  login: async () => "invalid",
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

  const login = useCallback(async (email: string, password: string): Promise<LoginResult> => {
    // Always fetch fresh users from Firestore before checking credentials.
    // This ensures a password reset is immediately reflected — the old password
    // cannot work after a reset even if the in-memory store is stale.
    await refreshUsersRef.current();

    // Only real users from Firestore are accepted — no demo fallback.
    const users = usersRef.current;

    const normalizedEmail = email.trim().toLowerCase();
    const user = users.find((u) => u.email.toLowerCase() === normalizedEmail && u.password === password);

    if (!user) return "invalid";
    if (user.isFrozen) return "frozen";

    setCurrentUserId(user.id);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, user.id);
      localStorage.setItem(SESSION_KEY, Date.now().toString());
      markActivity();
    }
    return "ok";
  }, []); // stable — reads via refs

  const logout = useCallback(() => {
    setCurrentUserId(null);
    clearSession();
  }, []);

  return (
    <AuthContext.Provider value={{ currentUser, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
