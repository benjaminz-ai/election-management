"use client";

import { useStore } from "@/lib/store";
import { ReactNode } from "react";

export default function LoadingWrapper({ children }: { children: ReactNode }) {
  const { loading } = useStore();

  if (loading) {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--bg-main)",
          zIndex: 9999,
          gap: 16,
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: "50%",
            border: "4px solid rgba(32,157,215,0.2)",
            borderTopColor: "var(--blue-primary)",
            animation: "spin 0.8s linear infinite",
          }}
        />
        <div style={{ color: "var(--gray-text)", fontSize: 14, fontWeight: 600 }}>
          טוען נתונים...
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return <>{children}</>;
}
