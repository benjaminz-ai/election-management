"use client";

import { useEffect, useState, useCallback } from "react";
import { db } from "@/lib/firebase";
import { getActiveTenant } from "@/lib/store";
import { collection, query, where, getDocs, setDoc, deleteDoc, doc } from "firebase/firestore";
import { AppUser, CallShare, ConversationLog } from "@/types";
import { X, Link2, Copy, Check, Trash2, Loader2, Share2 } from "lucide-react";

const ROLE_LABELS: Record<string, string> = {
  admin: "מנהל מערכת", field: "שטח", telemarketing: "טלמרקטינג",
  group_leader: "ראש קבוצה", division_head: "ראש אגף",
};

const genId = () => `cs_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const shareUrl = (id: string) =>
  (typeof window !== "undefined" ? window.location.origin : "") + "/shared/" + id;

export default function ShareCallDialog({ log, voterName, users, currentUser, onClose }: {
  log: ConversationLog;
  voterName: string;
  users: AppUser[];
  currentUser: AppUser;
  onClose: () => void;
}) {
  const [recipientId, setRecipientId] = useState("");
  const [note, setNote] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [shares, setShares] = useState<CallShare[]>([]);
  const [loadingShares, setLoadingShares] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Possible recipients: everyone in the company except yourself.
  const recipients = users.filter((u) => u.id !== currentUser.id);
  const nameOf = (id: string) => { const u = users.find((x) => x.id === id); return u ? `${u.firstName} ${u.lastName}` : "משתמש"; };

  const loadShares = useCallback(async () => {
    setLoadingShares(true);
    try {
      const q = query(collection(db, "callShares"), where("logId", "==", log.id), where("tenantId", "==", getActiveTenant()));
      const snap = await getDocs(q);
      setShares(snap.docs.map((d) => d.data() as CallShare).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    } catch (e) { console.error("load shares failed", e); }
    finally { setLoadingShares(false); }
  }, [log.id]);

  useEffect(() => { loadShares(); }, [loadShares]);

  const createShare = async () => {
    if (!recipientId) { setError("בחר משתמש לשיתוף."); return; }
    setCreating(true); setError("");
    try {
      const id = genId();
      const share: CallShare = {
        id, tenantId: getActiveTenant() ?? "", logId: log.id, voterId: log.voterId,
        sharedWithUserId: recipientId, sharedById: currentUser.id, note: note.trim(),
        createdAt: new Date().toISOString(),
      };
      await setDoc(doc(db, "callShares", id), share);
      setNote(""); setRecipientId("");
      await loadShares();
      // auto-copy the fresh link
      try { await navigator.clipboard.writeText(shareUrl(id)); setCopiedId(id); setTimeout(() => setCopiedId(null), 2000); } catch { /* ignore */ }
    } catch (e) {
      console.error("create share failed", e);
      setError("יצירת הקישור נכשלה. נסה שוב.");
    } finally { setCreating(false); }
  };

  const copyLink = async (id: string) => {
    try { await navigator.clipboard.writeText(shareUrl(id)); setCopiedId(id); setTimeout(() => setCopiedId(null), 2000); } catch { /* ignore */ }
  };

  const revoke = async (id: string) => {
    try { await deleteDoc(doc(db, "callShares", id)); setShares((s) => s.filter((x) => x.id !== id)); }
    catch (e) { console.error("revoke failed", e); }
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(3,33,71,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 1000 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 460, background: "#fff", borderRadius: 16, padding: "22px 22px 18px", boxShadow: "0 20px 60px rgba(0,0,0,0.3)", maxHeight: "88vh", overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 17, fontWeight: 800, color: "#032147" }}>
            <Share2 size={18} color="#209dd7" /> שיתוף תקציר שיחה
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: 4 }}><X size={20} /></button>
        </div>
        <div style={{ fontSize: 13, color: "#64748b", marginBottom: 18 }}>שיחה עם <strong>{voterName}</strong> · רק המשתמש שתבחר יוכל לפתוח את הקישור (לאחר התחברות).</div>

        {/* Recipient */}
        <label className="label">שתף עם</label>
        <select className="input" value={recipientId} onChange={(e) => setRecipientId(e.target.value)} style={{ marginBottom: 14 }}>
          <option value="">— בחר משתמש —</option>
          {recipients.map((u) => (
            <option key={u.id} value={u.id}>{u.firstName} {u.lastName} ({ROLE_LABELS[u.role] ?? u.role})</option>
          ))}
        </select>

        <label className="label">הערה (אופציונלי)</label>
        <textarea className="input" value={note} onChange={(e) => setNote(e.target.value)} rows={2}
          placeholder="לדוגמה: שים לב למה שסיכמנו בשיחה" style={{ marginBottom: 14, resize: "vertical" }} />

        {error && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", borderRadius: 10, padding: "8px 12px", fontSize: 13, marginBottom: 14 }}>{error}</div>}

        <button onClick={createShare} disabled={creating}
          style={{ width: "100%", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "11px", background: creating ? "#93c5fd" : "linear-gradient(135deg,#209dd7,#1a7fad)", color: "#fff", border: "none", borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: creating ? "not-allowed" : "pointer" }}>
          {creating ? <Loader2 size={15} className="spin" /> : <Link2 size={15} />}
          {creating ? "יוצר קישור..." : "צור קישור שיתוף"}
        </button>

        {/* Existing shares */}
        <div style={{ marginTop: 20, borderTop: "1px solid #eef2f7", paddingTop: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#032147", marginBottom: 10 }}>קישורים פעילים</div>
          {loadingShares ? (
            <div style={{ color: "#94a3b8", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}><Loader2 size={14} className="spin" /> טוען...</div>
          ) : shares.length === 0 ? (
            <div style={{ color: "#94a3b8", fontSize: 13 }}>אין עדיין קישורי שיתוף לשיחה זו.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {shares.map((s) => (
                <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, background: "#f8fafc", border: "1px solid #eef2f7", borderRadius: 10, padding: "8px 10px" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#032147", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{nameOf(s.sharedWithUserId)}</div>
                    {s.note && <div style={{ fontSize: 11, color: "#94a3b8", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.note}</div>}
                  </div>
                  <button onClick={() => copyLink(s.id)} title="העתק קישור"
                    style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#fff", border: "1px solid #cbd5e1", borderRadius: 8, padding: "5px 9px", fontSize: 12, fontWeight: 600, color: copiedId === s.id ? "#16a34a" : "#334155", cursor: "pointer" }}>
                    {copiedId === s.id ? <><Check size={13} /> הועתק</> : <><Copy size={13} /> העתק</>}
                  </button>
                  <button onClick={() => revoke(s.id)} title="בטל קישור"
                    style={{ display: "inline-flex", alignItems: "center", background: "#fff", border: "1px solid #fecaca", borderRadius: 8, padding: "5px 8px", color: "#dc2626", cursor: "pointer" }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
