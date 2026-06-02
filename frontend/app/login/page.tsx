"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";

export default function LoginPage() {
  const { login, completeMfa, currentUser } = useAuth();
  const { loading: storeLoading } = useStore();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mfaStep, setMfaStep] = useState(false);
  const [code, setCode] = useState("");

  useEffect(() => {
    if (currentUser) router.replace("/dashboard");
  }, [currentUser, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const result = await login(email, password);
      if (result === "ok") {
        router.replace("/dashboard");
      } else if (result === "mfa") {
        setMfaStep(true);
      } else if (result === "frozen") {
        setError("חשבון זה הוקפא. פנה למנהל המערכת.");
      } else {
        setError("אימייל או סיסמה שגויים.");
      }
    } catch {
      setError("שגיאה בהתחברות. נסה שנית.");
    } finally {
      setLoading(false);
    }
  };

  const handleMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const result = await completeMfa(code.trim());
      if (result === "ok") {
        router.replace("/dashboard");
      } else if (result === "frozen") {
        setError("חשבון זה הוקפא. פנה למנהל המערכת.");
      } else {
        setError("הקוד שגוי או שפג תוקפו. נסה שנית.");
      }
    } catch {
      setError("שגיאה באימות הקוד. נסה שנית.");
    } finally {
      setLoading(false);
    }
  };

  const [resent, setResent] = useState(false);
  const handleResend = async () => {
    setLoading(true); setError(""); setResent(false);
    try {
      const result = await login(email, password);
      if (result === "mfa") { setResent(true); setCode(""); }
      else if (result === "ok") { router.replace("/dashboard"); }
      else { setError("שליחת קוד חדש נכשלה. התחבר מחדש."); }
    } catch {
      setError("שגיאה בשליחת קוד חדש.");
    } finally {
      setLoading(false);
    }
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
          <img src="/logo.svg" alt="Voters4U" style={{ height: 90, width: "auto", marginBottom: 12 }} />
          <div style={{ color: "#64748b", fontSize: 14, marginTop: 4 }}>כניסה למערכת</div>
        </div>

        {!mfaStep && (
        <form onSubmit={handleSubmit}>
          {/* Email */}
          <div style={{ marginBottom: 18 }}>
            <label className="label">כתובת אימייל</label>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
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

          {/* Forgot Password */}
          <div style={{ textAlign: "left", marginBottom: 22 }}>
            <Link href="/forgot-password"
              style={{ fontSize: 13, color: "#209dd7", textDecoration: "none", fontWeight: 500 }}>
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
        )}

        {mfaStep && (
        <form onSubmit={handleMfa}>
          <div style={{ marginBottom: 18, textAlign: "center", color: "#475569", fontSize: 14, lineHeight: 1.6 }}>
            שלחנו קוד אימות ב-SMS לטלפון שלך.<br />הזן אותו כדי להשלים את הכניסה.
            {resent && <div style={{ color: "#16a34a", fontSize: 13, marginTop: 6 }}>קוד חדש נשלח ✓</div>}
          </div>
          <div style={{ marginBottom: 18 }}>
            <label className="label">קוד אימות</label>
            <input
              className="input"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="● ● ● ● ● ●"
              required
              dir="ltr"
              style={{ textAlign: "center", letterSpacing: 6, fontSize: 18 }}
            />
          </div>

          {error && (
            <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#dc2626", marginBottom: 18, textAlign: "center" }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{ width: "100%", padding: "13px", background: loading ? "#93c5fd" : "linear-gradient(135deg, #209dd7, #1a7fad)", color: "#fff", border: "none", borderRadius: 12, fontWeight: 700, fontSize: 15, cursor: loading ? "not-allowed" : "pointer", boxShadow: "0 4px 14px rgba(32,157,215,0.3)" }}
          >
            {loading ? "מאמת..." : "אישור והתחברות"}
          </button>
          <button type="button" onClick={handleResend} disabled={loading}
            style={{ width: "100%", marginTop: 12, background: "none", border: "none", color: "#209dd7", fontSize: 13, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer" }}>
            שלח קוד מחדש
          </button>
        </form>
        )}

        {/* Invisible reCAPTCHA container required by Firebase phone MFA */}
        <div id="recaptcha-container" />
      </div>
    </div>
  );
}
