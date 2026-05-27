"use client";

import React, { createContext, useContext, useState, useRef, useCallback, useMemo, useEffect, ReactNode } from "react";
import { useStore } from "./store";
import { AppUser } from "@/types";
import { initialUsers } from "@/data/dummy";

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
const SESSION_DURATION = 8 * 60 * 60 * 1000; // 8 hours

function isSessionValid(): boolean {
  if (typeof window === "undefined") return false;
  const loginAt = localStorage.getItem(SESSION_KEY);
  if (!loginAt) return false;
  return Date.now() - parseInt(loginAt, 10) < SESSION_DURATION;
}

function clearSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(SESSION_KEY);
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

  // Session expiry: check every minute
  useEffect(() => {
    const interval = setInterval(() => {
      if (currentUserId && !isSessionValid()) {
        clearSession();
        setCurrentUserId(null);
      }
    }, 60 * 1000);
    return () => clearInterval(interval);
  }, [currentUserId]);

  const login = useCallback(async (email: string, password: string): Promise<LoginResult> => {
    // Always fetch fresh users from Firestore before checking credentials.
    // This ensures a password reset is immediately reflected — the old password
    // cannot work after a reset even if the in-memory store is stale.
    await refreshUsersRef.current();

    // After refresh, usersRef.current holds the latest data.
    // Fall back to initialUsers only if Firestore returned nothing (should not happen in prod).
    const users = usersRef.current.length > 0 ? usersRef.current : initialUsers;

    const normalizedEmail = email.trim().toLowerCase();
    const user = users.find((u) => u.email.toLowerCase() === normalizedEmail && u.password === password);

    if (!user) return "invalid";
    if (user.isFrozen) return "frozen";

    setCurrentUserId(user.id);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, user.id);
      localStorage.setItem(SESSION_KEY, Date.now().toString());
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
