"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useStore, getActiveTenant } from "@/lib/store";
import { auth, db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import { Tenant } from "@/types";
import { Building2, Plus, LogIn, Snowflake, PlayCircle, Home, Loader2, X, CheckCircle2 } from "lucide-react";

export default function CompaniesPage() {
  const { isSuperAdmin, loading } = useStore();
  const router = useRouter();

  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ companyName: "", adminFirstName: "", adminLastName: "", adminEmail: "", adminPhone: "", adminPassword: "" });

  const active = getActiveTenant();

  useEffect(() => {
    if (!loading && !isSuperAdmin) router.replace("/dashboard");
  }, [loading, isSuperAdmin, router]);

  const loadTenants = useCallback(async () => {
    try {
      const snap = await getDocs(collection(db, "tenants"));
      setTenants(snap.docs.map((d) => d.data() as Tenant).sort((a, b) => a.name.localeCompare(b.name)));
    } catch { setErr("טעינת החברות נכשלה."); }
  }, []);

  useEffect(() => { if (isSuperAdmin) loadTenants(); }, [isSuperAdmin, loadTenants]);

  if (!isSuperAdmin) return null;

  const enterCompany = (tid: string) => {
    localStorage.setItem("active_tenant", tid);
    window.location.href = "/dashboard";
  };
  const goHome = () => {
    localStorage.removeItem("active_tenant");
    window.location.href = "/dashboard";
  };

  const toggleFreeze = async (t: Tenant) => {
    setBusy(true); setErr("");
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/admin/freeze-tenant", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken, tenantId: t.id, freeze: !t.isFrozen }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); setErr(`פעולה נכשלה: ${d.error || res.status}`); }
      else await loadTenants();
    } catch { setErr("שגיאת רשת."); }
    finally { setBusy(false); }
  };

  const createCompany = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr("");
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/admin/create-tenant", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken, ...form }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        const raw = d.error || "";
        setErr(raw.includes("email-already-exists") ? "אימייל האדמין כבר קיים במערכת." : `יצירת החברה נכשלה: ${raw || res.status}`);
      } else {
        setShowForm(false);
        setForm({ companyName: "", adminFirstName: "", adminLastName: "", adminEmail: "", adminPhone: "", adminPassword: "" });
        await loadTenants();
      }
    } catch { setErr("שגיאת רשת ביצירת החברה."); }
    finally { setBusy(false); }
  };

  return (
    <div style={{ maxWidth: 760, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 40, height: 40, borderRadius: 11, background: "linear-gradient(135deg,#209dd7,#753991)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Building2 size={20} color="#fff" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#032147" }}>ניהול חברות</h1>
            <div style={{ fontSize: 13, color: "#94a3b8" }}>פתיחה, כניסה והקפאה של חברות (super admin)</div>
          </div>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Plus size={15} /> פתח חברה חדשה
        </button>
      </div>

      <button onClick={goHome} style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 14, padding: "7px 14px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", color: "#475569", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
        <Home size={14} /> חזרה לחברת הבית שלי
      </button>

      {err && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#dc2626", marginBottom: 14 }}>{err}</div>}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {tenants.map((t) => {
          const isActive = active === t.id;
          return (
            <div key={t.id} style={{ background: "#fff", border: `1px solid ${isActive ? "#753991" : "#eef1f5"}`, borderRadius: 12, padding: "13px 15px", display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: "#032147", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  {t.name}
                  {isActive && <span style={{ fontSize: 11, color: "#753991", background: "rgba(117,57,145,0.12)", borderRadius: 20, padding: "1px 8px" }}>פעילה כעת</span>}
                  {t.isFrozen && <span style={{ fontSize: 11, color: "#dc2626", background: "rgba(220,38,38,0.1)", borderRadius: 20, padding: "1px 8px" }}>מוקפאת</span>}
                </div>
              </div>
              <button onClick={() => enterCompany(t.id)} style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 12px", borderRadius: 8, border: "none", background: "#032147", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                <LogIn size={13} /> כניסה
              </button>
              <button onClick={() => toggleFreeze(t)} disabled={busy} title={t.isFrozen ? "שחרר הקפאה" : "הקפא חברה"}
                style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 12px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", color: t.isFrozen ? "#16a34a" : "#dc2626", fontSize: 13, fontWeight: 600, cursor: busy ? "not-allowed" : "pointer" }}>
                {t.isFrozen ? <><PlayCircle size={13} /> שחרר</> : <><Snowflake size={13} /> הקפא</>}
              </button>
            </div>
          );
        })}
        {tenants.length === 0 && <div style={{ padding: 32, textAlign: "center", color: "#9ca3af", fontSize: 13 }}>אין חברות עדיין.</div>}
      </div>

      {showForm && (
        <div onClick={() => setShowForm(false)} style={{ position: "fixed", inset: 0, background: "rgba(3,33,71,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, padding: "24px 22px", width: "100%", maxWidth: 460, maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#032147" }}>פתיחת חברה חדשה</h2>
              <button onClick={() => setShowForm(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8" }}><X size={20} /></button>
            </div>
            <form onSubmit={createCompany}>
              <label className="label">שם החברה <span style={{ color: "#ef4444" }}>*</span></label>
              <input className="input" required value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} style={{ marginBottom: 14 }} />
              <div style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600, marginBottom: 8 }}>פרטי האדמין הראשון של החברה:</div>
              <div className="form-2col" style={{ marginBottom: 12 }}>
                <div><label className="label">שם פרטי <span style={{ color: "#ef4444" }}>*</span></label>
                  <input className="input" required value={form.adminFirstName} onChange={(e) => setForm({ ...form, adminFirstName: e.target.value })} /></div>
                <div><label className="label">שם משפחה <span style={{ color: "#ef4444" }}>*</span></label>
                  <input className="input" required value={form.adminLastName} onChange={(e) => setForm({ ...form, adminLastName: e.target.value })} /></div>
              </div>
              <label className="label">אימייל אדמין <span style={{ color: "#ef4444" }}>*</span></label>
              <input className="input" type="email" required dir="ltr" style={{ textAlign: "left", marginBottom: 12 }} value={form.adminEmail} onChange={(e) => setForm({ ...form, adminEmail: e.target.value })} />
              <label className="label">טלפון אדמין</label>
              <input className="input" type="tel" placeholder="050-0000000" style={{ marginBottom: 12 }} value={form.adminPhone} onChange={(e) => setForm({ ...form, adminPhone: e.target.value })} />
              <label className="label">סיסמת אדמין <span style={{ color: "#ef4444" }}>*</span></label>
              <input className="input" type="text" required placeholder="לפחות 6 תווים" style={{ marginBottom: 18 }} value={form.adminPassword} onChange={(e) => setForm({ ...form, adminPassword: e.target.value })} />
              {err && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#dc2626", marginBottom: 14 }}>{err}</div>}
              <button type="submit" disabled={busy} className="btn-primary" style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
                {busy ? <Loader2 size={15} className="spin" /> : <CheckCircle2 size={15} />} צור חברה
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
