"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { Shield, Eye, EyeOff } from "lucide-react";
import Link from "next/link";

export default function LoginPage() {
  const { login, currentUser } = useAuth();
  const { loading: storeLoading } = useStore();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (currentUser) router.replace("/dashboard");
  }, [currentUser, router]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setTimeout(() => {
      const ok = login(email, password);
      if (ok) {
        router.replace("/dashboard");
      } else {
        setError("אימייל או סיסמה שגויים, או שהמשתמש מוקפא.");
        setLoading(false);
      }
    }, 350);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #032147 0%, #0d3560 50%, #1a4a7a 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          background: "#fff",
          borderRadius: 20,
          padding: "40px 36px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
        }}
      >
        {/* Logo */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 36 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 18,
              background: "linear-gradient(135deg, #209dd7, #753991)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 16,
              boxShadow: "0 8px 24px rgba(32,157,215,0.35)",
            }}
          >
            <Shield size={30} color="#fff" />
          </div>
          <div style={{ fontWeight: 800, fontSize: 22, color: "#032147", letterSpacing: "-0.3px" }}>
            מערכת ניהול בחירות
          </div>
          <div style={{ color: "#64748b", fontSize: 14, marginTop: 6 }}>כניסה למערכת</div>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Email */}
          <div style={{ marginBottom: 18 }}>
            <label className="label">כתובת אימייל</label>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@election.co.il"
              required
              autoComplete="email"
              dir="ltr"
              style={{ textAlign: "left" }}
            />
          </div>

          {/* Password */}
          <div style={{ marginBottom: 8 }}>
            <label className="label">סיסמה</label>
            <div style={{ position: "relative" }}>
              <input
                className="input"
                type={showPass ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                style={{ paddingLeft: 40 }}
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                style={{
                  position: "absolute",
                  left: 10,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#94a3b8",
                  padding: 4,
                  display: "flex",
                }}
              >
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Forgot Password link */}
          <div style={{ textAlign: "left", marginBottom: 22 }}>
            <Link
              href="/forgot-password"
              style={{
                fontSize: 13,
                color: "#209dd7",
                textDecoration: "none",
                fontWeight: 500,
              }}
            >
              שכחת סיסמה?
            </Link>
          </div>

          {error && (
            <div
              style={{
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: 10,
                padding: "10px 14px",
                fontSize: 13,
                color: "#dc2626",
                marginBottom: 18,
                textAlign: "center",
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || storeLoading}
            style={{
              width: "100%",
              padding: "13px",
              background: loading ? "#93c5fd" : "linear-gradient(135deg, #209dd7, #1a7fad)",
              color: "#fff",
              border: "none",
              borderRadius: 12,
              fontWeight: 700,
              fontSize: 15,
              cursor: loading ? "not-allowed" : "pointer",
              transition: "all 0.2s",
              boxShadow: "0 4px 14px rgba(32,157,215,0.3)",
            }}
          >
            {loading ? "מתחבר..." : "כניסה למערכת"}
          </button>
        </form>

        {/* Demo credentials hint */}
        <div
          style={{
            marginTop: 28,
            padding: "16px",
            background: "#f8fafc",
            borderRadius: 12,
            border: "1px solid #e2e8f0",
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 10 }}>
            משתמשי דמה לבדיקה:
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {[
              { label: "מנהל מערכת", email: "admin@election.co.il", pass: "admin123" },
              { label: "טלמרקטינג", email: "dana@election.co.il", pass: "dana123" },
            ].map((u) => (
              <button
                key={u.email}
                type="button"
                onClick={() => { setEmail(u.email); setPassword(u.pass); }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "7px 10px",
                  background: "#fff",
                  border: "1px solid #e2e8f0",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontSize: 12,
                  transition: "border-color 0.15s",
                }}
              >
                <span style={{ fontWeight: 600, color: "#032147" }}>{u.label}</span>
                <span style={{ color: "#64748b", direction: "ltr" }}>{u.email}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
