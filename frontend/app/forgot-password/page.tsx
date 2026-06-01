"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Mail } from "lucide-react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "אירעה שגיאה. נסה שנית.");
      } else {
        setSent(true);
      }
    } catch {
      setError("אירעה שגיאה בחיבור. נסה שנית.");
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
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 32 }}>
          <img src="/logo.svg" alt="Voters4U" style={{ height: 72, width: "auto", marginBottom: 12 }} />
          <div style={{ color: "#64748b", fontSize: 14, marginTop: 4 }}>שכחת סיסמה</div>
        </div>

        {sent ? (
          /* Success state */
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: "50%",
                background: "#f0fdf4",
                border: "2px solid #bbf7d0",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 20px",
              }}
            >
              <Mail size={28} color="#16a34a" />
            </div>
            <div style={{ fontWeight: 700, fontSize: 18, color: "#032147", marginBottom: 10 }}>
              המייל נשלח!
            </div>
            <div style={{ color: "#64748b", fontSize: 14, lineHeight: 1.7, marginBottom: 28 }}>
              אם כתובת האימייל <strong style={{ direction: "ltr", display: "inline-block" }}>{email}</strong> קיימת במערכת,
              ישלח אליה קישור לאיפוס הסיסמה.
              <br />
              הקישור יפוג תוך שעה אחת.
            </div>
            <button
              onClick={() => router.push("/login")}
              style={{
                width: "100%",
                padding: "12px",
                background: "linear-gradient(135deg, #209dd7, #1a7fad)",
                color: "#fff",
                border: "none",
                borderRadius: 12,
                fontWeight: 700,
                fontSize: 15,
                cursor: "pointer",
              }}
            >
              חזרה לכניסה
            </button>
          </div>
        ) : (
          /* Form */
          <>
            <p style={{ color: "#64748b", fontSize: 14, marginBottom: 24, lineHeight: 1.7, textAlign: "center" }}>
              הזן את כתובת האימייל שלך ונשלח לך קישור לאיפוס הסיסמה.
            </p>

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 24 }}>
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
                disabled={loading}
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
                  marginBottom: 16,
                }}
              >
                {loading ? "שולח..." : "שלח קישור איפוס"}
              </button>

              <Link
                href="/login"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  color: "#64748b",
                  fontSize: 13,
                  textDecoration: "none",
                  padding: "8px",
                  borderRadius: 8,
                  transition: "color 0.15s",
                }}
              >
                <ArrowRight size={14} />
                <span>חזרה לכניסה</span>
              </Link>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
