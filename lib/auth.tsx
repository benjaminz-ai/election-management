"use client";

import React, { createContext, useContext, useState, useRef, useCallback, useMemo, ReactNode } from "react";
import { useStore } from "./store";
import { AppUser } from "@/types";
import { initialUsers } from "@/data/dummy";

type AuthCtx = {
  currentUser: AppUser | null;
  login: (email: string, password: string) => boolean;
  logout: () => void;
};

const AuthContext = createContext<AuthCtx>({
  currentUser: null,
  login: () => false,
  logout: () => {},
});

const STORAGE_KEY = "mvp_uid";

export function AuthProvider({ children }: { children: ReactNode }) {
  const { state } = useStore();

  // Always-current ref so login() never has a stale closure
  const usersRef = useRef<AppUser[]>(state.users);
  usersRef.current = state.users;

  const [currentUserId, setCurrentUserId] = useState<string | null>(() => {
    if (typeof window !== "undefined") return localStorage.getItem(STORAGE_KEY);
    return null;
  });

  const currentUser = useMemo(
    () => state.users.find((u) => u.id === currentUserId) ?? null,
    [state.users, currentUserId]
  );

  const login = useCallback((email: string, password: string): boolean => {
    // usersRef.current always reflects the latest state;
    // fall back to seeded initialUsers if the store hasn't populated yet
    const users = usersRef.current.length > 0 ? usersRef.current : initialUsers;

    const user = users.find(
      (u) =>
        u.email.toLowerCase() === email.trim().toLowerCase() &&
        u.password === password &&
        !u.isFrozen
    );

    if (user) {
      setCurrentUserId(user.id);
      if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, user.id);
      return true;
    }
    return false;
  }, []); // stable — reads via ref

  const logout = useCallback(() => {
    setCurrentUserId(null);
    if (typeof window !== "undefined") localStorage.removeItem(STORAGE_KEY);
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
