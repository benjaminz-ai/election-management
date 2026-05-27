"use client";

import React, { createContext, useContext, useState, useRef, useCallback, useMemo, useEffect, ReactNode } from "react";
import { useStore } from "./store";
import { AppUser } from "@/types";
import { initialUsers } from "@/data/dummy";

type LoginResult = "ok" | "frozen" | "invalid";

type AuthCtx = {
  currentUser: AppUser | null;
  login: (email: string, password: string) => LoginResult;
  logout: () => void;
};

const AuthContext = createContext<AuthCtx>({
  currentUser: null,
  login: () => "invalid",
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
  const { state } = useStore();

  // Always-current ref so login() never has a stale closure
  const usersRef = useRef<AppUser[]>(state.users);
  usersRef.current = state.users;

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

  // Auto-logout: when user is frozen while logged in, clear session
  useEffect(() => {
    if (!currentUserId || state.users.length === 0) return;
    const user = state.users.find((u) => u.id === currentUserId);
    if (!user || user.isFrozen) {
      clearSession();
      setCurrentUserId(null);
    }
  }, [state.users, currentUserId]);

  // Session expiry: periodically check if session is still valid
  useEffect(() => {
    const interval = setInterval(() => {
      if (currentUserId && !isSessionValid()) {
        clearSession();
        setCurrentUserId(null);
      }
    }, 60 * 1000); // check every minute
    return () => clearInterval(interval);
  }, [currentUserId]);

  const login = useCallback((email: string, password: string): LoginResult => {
    // Use live store data; fall back to seeded initialUsers only if store hasn't loaded
    const users = usersRef.current.length > 0 ? usersRef.current : initialUsers;

    const normalizedEmail = email.trim().toLowerCase();

    // First check if user exists with matching email + password
    const user = users.find(
      (u) => u.email.toLowerCase() === normalizedEmail && u.password === password
    );

    if (!user) return "invalid";
    if (user.isFrozen) return "frozen";

    setCurrentUserId(user.id);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, user.id);
      localStorage.setItem(SESSION_KEY, Date.now().toString());
    }
    return "ok";
  }, []); // stable — reads via ref

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
