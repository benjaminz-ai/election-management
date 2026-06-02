"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { auth } from "@/lib/firebase";
import { homePath } from "@/lib/permissions";
import { toE164Israel } from "@/lib/phone";
import {
  multiFactor, PhoneAuthProvider, PhoneMultiFactorGenerator, RecaptchaVerifier,
} from "firebase/auth";
import { ShieldCheck, Loader2, CheckCircle2 } from "lucide-react";

export default function EnrollMfaPage() {
  const { currentUser } = useAuth();
  const router = useRouter();

  const [phone, setPhone] = useState("");
  const [step, setStep] = useState<"phone" | "code" | "done">("phone");
  const [code, setCode] = useState("");
  const [verificationId, setVerificationId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [alreadyEnrolled, setAlreadyEnrolled] = useState(false);

  // Pre-fill the phone from the user's profile (normalized to +972...).
  useEffect(() => {
    if (currentUser?.phone) setPhone(toE164Israel(currentUser.phone));
  }, [currentUser]);

  // If already enrolled, say so.
  useEffect(() => {
    const u = auth.currentUser;
    if (u && multiFactor(u).enrolledFactors.length > 0) setAlreadyEnrolled(true);
  }, []);

  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setBusy(true);
    try {
      const user = auth.currentUser;
      if (!user) { router.replace("/login"); return; }
      const e164 = toE164Israel(phone);
      const verifier = new RecaptchaVerifier(auth, "recaptcha-container", { size: "invisible" });
      const session = await multiFactor(user).getSession();
      const provider = new PhoneAuthProvider(auth);
      const id = await provider.verifyPhoneNumber({ phoneNumber: e164, session }, verifier);
      setVerificationId(id);
      setStep("code");
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || "";
      setError(code.includes("invalid-phone") ? "מספר הטלפון אינו תקין." : "שליחת הקוד נכשלה. בדוק את המספר ונסה שוב.");
    } finally {
      setBusy(false);
    }
  };

  const verifyAndEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setBusy(true);
    try {
      const user = auth.currentUser;
      if (!user) { router.replace("/login"); return; }
      const cred = PhoneAuthProvider.credential(verificationId, code.trim());
      const assertion = PhoneMultiFactorGenerator.assertion(cred);
      await multiFactor(user).enroll(assertion, "טלפון");
      setStep("done");
    } catch {
      setError("הקוד שגוי או שפג תוקפו. נסה שנית.");
    } finally {
      setBusy(false);
    }
  };

  const goHome = () => router.replace(homePath(currentUser?.role));

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: "#f3f5f9" }}>
      <div style={{ width: "100%", maxWidth: 420, background: "#fff", borderRadius: 18, padding: "32px 28px", boxShadow: "0 10px 40px rgba(3,33,71,0.12)" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 22, textAlign: "center" }}>
          <div style={{ width: 54, height: 54, borderRadius: 14, background: "linear-gradient(135deg,#209dd7,#753991)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
            <ShieldCheck size={26} color="#fff" />
          </div>
          <h1 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: "#032147" }}>אימות דו-שלבי</h1>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "#94a3b8", lineHeight: 1.6 }}>
            הוספת שכבת אבטחה: בכל כניסה תתבקש קוד שיישלח ב-SMS.
          </p>
        </div>

        {alreadyEnrolled ? (
          <div style={{ textAlign: "center" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: "#16a34a", fontWeight: 700, fontSize: 15, marginBottom: 16 }}>
              <CheckCircle2 size={18} /> האימות הדו-שלבי כבר מוגדר
            </div>
            <button onClick={goHome} style={btn}>המשך למערכת</button>
          </div>
        ) : step === "done" ? (
          <div style={{ textAlign: "center" }}>
            <CheckCircle2 size={40} color="#16a34a" style={{ margin: "0 auto 12px", display: "block" }} />
            <div style={{ color: "#032147", fontWeight: 700, fontSize: 16, marginBottom: 6 }}>האימות הדו-שלבי הופעל!</div>
            <div style={{ color: "#94a3b8", fontSize: 13, marginBottom: 18 }}>מהכניסה הבאה תתבקש קוד SMS.</div>
            <button onClick={goHome} style={btn}>המשך למערכת</button>
          </div>
        ) : step === "phone" ? (
          <form onSubmit={sendCode}>
            <label className="label">מספר טלפון לקבלת קודים</label>
            <input className="input" type="tel" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)}
              placeholder="+9725XXXXXXXX" required style={{ textAlign: "left", marginBottom: 6 }} />
            <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 18 }}>המספר נלקח מהפרופיל שלך — ניתן לתקן במידת הצורך.</div>
            {error && <div style={errBox}>{error}</div>}
            <button type="submit" disabled={busy} style={btn}>
              {busy ? <Loader2 size={15} className="spin" style={{ verticalAlign: "middle" }} /> : "שלח קוד"}
            </button>
          </form>
        ) : (
          <form onSubmit={verifyAndEnroll}>
            <div style={{ textAlign: "center", color: "#475569", fontSize: 13, marginBottom: 16 }}>הזן את הקוד שקיבלת ב-SMS</div>
            <input className="input" type="text" inputMode="numeric" autoComplete="one-time-code" value={code}
              onChange={(e) => setCode(e.target.value)} placeholder="● ● ● ● ● ●" required dir="ltr"
              style={{ textAlign: "center", letterSpacing: 6, fontSize: 18, marginBottom: 18 }} />
            {error && <div style={errBox}>{error}</div>}
            <button type="submit" disabled={busy} style={btn}>
              {busy ? <Loader2 size={15} className="spin" style={{ verticalAlign: "middle" }} /> : "אישור והפעלה"}
            </button>
            <button type="button" onClick={() => { setStep("phone"); setCode(""); setError(""); }}
              style={{ width: "100%", marginTop: 10, background: "none", border: "none", color: "#64748b", fontSize: 13, cursor: "pointer" }}>
              חזרה
            </button>
          </form>
        )}

        <div id="recaptcha-container" />
      </div>
    </div>
  );
}

const btn: React.CSSProperties = {
  width: "100%", padding: "13px", background: "linear-gradient(135deg,#209dd7,#1a7fad)", color: "#fff",
  border: "none", borderRadius: 12, fontWeight: 700, fontSize: 15, cursor: "pointer",
};
const errBox: React.CSSProperties = {
  background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "10px 14px",
  fontSize: 13, color: "#dc2626", marginBottom: 16, textAlign: "center",
};
