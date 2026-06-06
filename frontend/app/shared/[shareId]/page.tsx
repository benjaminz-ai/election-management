"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { CallShare, ConversationLog } from "@/types";
import { Phone, MapPin, Clock, User as UserIcon, ShieldAlert, Loader2, Share2, MessageSquareMore } from "lucide-react";

function fmt(iso: string) {
  try { return new Date(iso).toLocaleString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }); }
  catch { return iso; }
}

export default function SharedCallPage() {
  const params = useParams();
  const router = useRouter();
  const shareId = String(params?.shareId ?? "");
  const { currentUser } = useAuth();
  const { state, isSuperAdmin } = useStore();

  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<"ok" | "notfound" | "denied">("ok");
  const [share, setShare] = useState<CallShare | null>(null);
  const [log, setLog] = useState<ConversationLog | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!currentUser) return; // AuthGuard ensures login; wait for it
      setLoading(true);
      try {
        const sSnap = await getDoc(doc(db, "callShares", shareId));
        if (!alive) return;
        if (!sSnap.exists()) { setResult("notfound"); setLoading(false); return; }
        const sh = sSnap.data() as CallShare;
        const allowed = isSuperAdmin || currentUser.role === "admin"
          || currentUser.id === sh.sharedWithUserId || currentUser.id === sh.sharedById;
        if (!allowed) { setResult("denied"); setLoading(false); return; }
        setShare(sh);
        const lSnap = await getDoc(doc(db, "conversationLogs", sh.logId));
        if (!alive) return;
        if (lSnap.exists()) setLog(lSnap.data() as ConversationLog);
        setResult("ok"); setLoading(false);
      } catch (e) {
        console.error("shared load failed", e);
        if (alive) { setResult("notfound"); setLoading(false); }
      }
    })();
    return () => { alive = false; };
  }, [shareId, currentUser, isSuperAdmin]);

  const voter = share ? state.voters.find((v) => v.id === share.voterId) : null;
  const caller = log ? state.users.find((u) => u.id === log.userId) : null;
  const sharer = share ? state.users.find((u) => u.id === share.sharedById) : null;
  const cs = log ? state.callStatuses.find((c) => c.id === log.callStatus) : null;
  const ss = log ? state.statuses.find((s) => s.id === log.statusId) : null;

  const Wrap = ({ children }: { children: React.ReactNode }) => (
    <div style={{ maxWidth: 560, margin: "0 auto" }}>{children}</div>
  );

  if (loading) {
    return <Wrap><div style={{ padding: 60, textAlign: "center", color: "#94a3b8" }}><Loader2 size={26} className="spin" /></div></Wrap>;
  }

  if (result === "notfound") {
    return <Wrap><Notice title="הקישור אינו תקין" text="ייתכן שהקישור שגוי או שהשיתוף בוטל על ידי מי ששיתף." /></Wrap>;
  }
  if (result === "denied") {
    return <Wrap><Notice title="אין הרשאת צפייה" text="קישור זה שותף עם משתמש אחר. אם לדעתך זו טעות, פנה למי ששיתף." /></Wrap>;
  }

  return (
    <Wrap>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, color: "#209dd7", fontWeight: 800, fontSize: 18 }}>
        <Share2 size={18} /> תקציר שיחה משותף
      </div>

      <div className="card" style={{ padding: "22px 22px" }}>
        {/* Voter header */}
        <div style={{ borderBottom: "1px solid #eef2f7", paddingBottom: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#032147" }}>{voter ? `${voter.firstName} ${voter.lastName}` : "בוחר"}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 8, color: "#64748b", fontSize: 13 }}>
            {voter?.phone && <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }} dir="ltr"><Phone size={13} /> {voter.phone}</span>}
            {voter && (voter.address.street || voter.address.city) && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                <MapPin size={13} /> {[voter.address.street, voter.address.streetNumber, voter.address.city].filter(Boolean).join(", ")}
              </span>
            )}
          </div>
        </div>

        {!log ? (
          <div style={{ color: "#94a3b8", fontSize: 14 }}>פרטי השיחה אינם זמינים (ייתכן שנמחקה).</div>
        ) : (
          <>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
              {cs && <Tag color={cs.color} label={cs.name} />}
              {ss && <Tag color={ss.color} label={ss.name} />}
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 16, color: "#64748b", fontSize: 12, marginBottom: 16 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Clock size={13} /> {fmt(log.timestamp)}</span>
              {caller && <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><UserIcon size={13} /> תועד ע״י {caller.firstName} {caller.lastName}</span>}
            </div>

            <div style={{ background: "#f8fafc", border: "1px solid #eef2f7", borderRadius: 10, padding: "14px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 6 }}>
                <MessageSquareMore size={14} /> הערות השיחה
              </div>
              <p style={{ margin: 0, color: "#374151", fontSize: 14, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                {log.notes || "אין הערות לשיחה זו."}
              </p>
            </div>
          </>
        )}

        {/* Share footer */}
        <div style={{ borderTop: "1px solid #eef2f7", marginTop: 16, paddingTop: 14, fontSize: 12, color: "#94a3b8" }}>
          {sharer && <span>שותף על ידי {sharer.firstName} {sharer.lastName}</span>}
          {share?.note && <div style={{ marginTop: 6, color: "#475569", fontSize: 13, background: "#eff6ff", border: "1px solid #dbeafe", borderRadius: 8, padding: "8px 12px" }}>“{share.note}”</div>}
        </div>
      </div>

      <button onClick={() => router.replace("/dashboard")}
        style={{ marginTop: 16, background: "none", border: "none", color: "#209dd7", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
        חזרה למערכת
      </button>
    </Wrap>
  );
}

function Tag({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 11px", borderRadius: 20, fontSize: 12, fontWeight: 700, background: `${color}1a`, color, border: `1px solid ${color}40` }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: color }} />{label}
    </span>
  );
}

function Notice({ title, text }: { title: string; text: string }) {
  return (
    <div className="card" style={{ padding: "36px 26px", textAlign: "center" }}>
      <ShieldAlert size={38} color="#f59e0b" style={{ margin: "0 auto 12px", display: "block" }} />
      <div style={{ fontSize: 18, fontWeight: 800, color: "#032147" }}>{title}</div>
      <p style={{ margin: "10px 0 0", fontSize: 14, color: "#64748b", lineHeight: 1.7 }}>{text}</p>
    </div>
  );
}
