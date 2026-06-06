"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useStore, getActiveTenant } from "@/lib/store";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, deleteDoc, doc } from "firebase/firestore";
import { CallShare } from "@/types";
import PageHeader from "@/components/ui/PageHeader";
import { Inbox, Send, Trash2, ArrowDownUp, Loader2, ExternalLink, Clock } from "lucide-react";

function fmt(iso: string) {
  try { return new Date(iso).toLocaleString("he-IL", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }); }
  catch { return iso; }
}

export default function SharesPage() {
  const router = useRouter();
  const { currentUser } = useAuth();
  const { state } = useStore();
  const [tab, setTab] = useState<"in" | "out">("in");
  const [shares, setShares] = useState<CallShare[]>([]);
  const [loading, setLoading] = useState(true);
  const [desc, setDesc] = useState(true);

  const load = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const field = tab === "in" ? "sharedWithUserId" : "sharedById";
      const q = query(collection(db, "callShares"), where(field, "==", currentUser.id), where("tenantId", "==", getActiveTenant()));
      const snap = await getDocs(q);
      setShares(snap.docs.map((d) => d.data() as CallShare));
    } catch (e) { console.error("load shares failed", e); setShares([]); }
    finally { setLoading(false); }
  }, [tab, currentUser]);

  useEffect(() => { load(); }, [load]);

  const sorted = useMemo(
    () => [...shares].sort((a, b) => (desc ? b.createdAt.localeCompare(a.createdAt) : a.createdAt.localeCompare(b.createdAt))),
    [shares, desc]
  );

  const voterName = (id: string) => { const v = state.voters.find((x) => x.id === id); return v ? `${v.firstName} ${v.lastName}` : "בוחר"; };
  const userName = (id: string) => { const u = state.users.find((x) => x.id === id); return u ? `${u.firstName} ${u.lastName}` : "משתמש"; };

  const revoke = async (id: string) => {
    try { await deleteDoc(doc(db, "callShares", id)); setShares((s) => s.filter((x) => x.id !== id)); }
    catch (e) { console.error("revoke failed", e); }
  };

  return (
    <div>
      <PageHeader title="שיתופים" subtitle="תקצירי שיחה ששותפו איתך ושיתפת" />

      {/* Tabs + sort */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 18 }}>
        <div style={{ display: "inline-flex", background: "#eef2f7", borderRadius: 10, padding: 3 }}>
          <TabBtn active={tab === "in"} onClick={() => setTab("in")} icon={<Inbox size={15} />} label="ששותף איתי" />
          <TabBtn active={tab === "out"} onClick={() => setTab("out")} icon={<Send size={15} />} label="ששיתפתי" />
        </div>
        <button onClick={() => setDesc((d) => !d)}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#fff", border: "1px solid #cbd5e1", borderRadius: 9, padding: "7px 12px", fontSize: 13, fontWeight: 600, color: "#334155", cursor: "pointer" }}>
          <ArrowDownUp size={14} /> {desc ? "מהחדש לישן" : "מהישן לחדש"}
        </button>
      </div>

      {loading ? (
        <div style={{ padding: 48, textAlign: "center", color: "#94a3b8" }}><Loader2 size={24} className="spin" /></div>
      ) : sorted.length === 0 ? (
        <div className="card" style={{ padding: 48, textAlign: "center", color: "var(--gray-text)" }}>
          {tab === "in" ? "לא שותפו איתך תקצירי שיחה." : "עדיין לא שיתפת תקצירי שיחה."}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {sorted.map((s) => (
            <div key={s.id} className="card" style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: "var(--navy)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {voterName(s.voterId)}
                </div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 3, display: "flex", flexWrap: "wrap", gap: 12 }}>
                  <span>{tab === "in" ? `שותף ע״י ${userName(s.sharedById)}` : `שותף עם ${userName(s.sharedWithUserId)}`}</span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Clock size={12} /> {fmt(s.createdAt)}</span>
                </div>
                {s.note && <div style={{ fontSize: 12, color: "#475569", marginTop: 4, fontStyle: "italic" }}>“{s.note}”</div>}
              </div>

              <button onClick={() => router.push(`/shared/${s.id}`)} title="פתח תקציר"
                style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "linear-gradient(135deg,#209dd7,#1a7fad)", color: "#fff", border: "none", borderRadius: 9, padding: "8px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
                <ExternalLink size={14} /> פתח
              </button>

              {tab === "out" && (
                <button onClick={() => revoke(s.id)} title="הפסק שיתוף"
                  style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "#fff", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 9, padding: "8px 12px", fontSize: 13, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
                  <Trash2 size={14} /> הפסק
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TabBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick}
      style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700, background: active ? "#fff" : "transparent", color: active ? "#209dd7" : "#64748b", boxShadow: active ? "0 1px 4px rgba(0,0,0,0.08)" : "none" }}>
      {icon} {label}
    </button>
  );
}
