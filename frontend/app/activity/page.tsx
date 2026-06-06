"use client";

import { useState, useEffect, useMemo, useCallback, Fragment } from "react";
import { useRouter } from "next/navigation";
import { useStore, getActiveTenant } from "@/lib/store";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { ConversationLog } from "@/types";
import PageHeader from "@/components/ui/PageHeader";
import {
  Activity, Loader2, ChevronDown, ChevronUp, Phone, RefreshCw, Users, Download,
} from "lucide-react";

const ROLE_LABELS: Record<string, string> = {
  admin: "מנהל מערכת", field: "שטח", telemarketing: "טלמרקטינג",
  group_leader: "ראש קבוצה", division_head: "ראש אגף",
};

// Local "YYYY-MM-DD" for today.
function todayStr(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

type Agg = {
  userId: string;
  total: number;
  byCall: Record<string, number>;   // callStatusId -> count
  statusUpdates: number;            // logs that set a support status
  logs: ConversationLog[];
};

export default function ActivityPage() {
  const router = useRouter();
  const { state } = useStore();
  const { users, callStatuses, statuses, voters } = state;

  const [from, setFrom] = useState(todayStr());
  const [to, setTo] = useState(todayStr());
  const [logs, setLogs] = useState<ConversationLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Lookup maps
  const userById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const callById = useMemo(() => new Map(callStatuses.map((c) => [c.id, c])), [callStatuses]);
  const statusById = useMemo(() => new Map(statuses.map((s) => [s.id, s])), [statuses]);
  const voterById = useMemo(() => new Map(voters.map((v) => [v.id, v])), [voters]);

  const fetchLogs = useCallback(async () => {
    const tid = getActiveTenant();
    if (!tid) return;
    setLoading(true); setError(false);
    try {
      const fromISO = new Date(`${from}T00:00:00`).toISOString();
      const toISO = new Date(`${to}T23:59:59.999`).toISOString();
      const q = query(
        collection(db, "conversationLogs"),
        where("tenantId", "==", tid),
        where("timestamp", ">=", fromISO),
        where("timestamp", "<=", toISO),
      );
      const snap = await getDocs(q);
      setLogs(snap.docs.map((d) => d.data() as ConversationLog));
      setLoaded(true);
    } catch (e) {
      console.error("activity fetch failed:", e);
      setError(true); setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  // Load today's data on first mount.
  useEffect(() => { fetchLogs(); /* eslint-disable-next-line */ }, []);

  // Aggregate per user. This report measures TELEMARKETING output, so we seed
  // every telemarketing rep — even those with zero calls in the range, so the
  // manager can see who didn't produce. Any other user who logged calls still
  // appears too (so totals always reconcile).
  const aggs = useMemo<Agg[]>(() => {
    const map = new Map<string, Agg>();
    const ensure = (uid: string) => {
      let a = map.get(uid);
      if (!a) { a = { userId: uid, total: 0, byCall: {}, statusUpdates: 0, logs: [] }; map.set(uid, a); }
      return a;
    };
    for (const u of users) if (u.role === "telemarketing") ensure(u.id);
    for (const log of logs) {
      const a = ensure(log.userId || "—");
      a.total++;
      if (log.callStatus) a.byCall[log.callStatus] = (a.byCall[log.callStatus] || 0) + 1;
      if (log.statusId) a.statusUpdates++;
      a.logs.push(log);
    }
    for (const a of map.values()) a.logs.sort((x, y) => y.timestamp.localeCompare(x.timestamp));
    return [...map.values()].sort((x, y) => y.total - x.total);
  }, [logs, users]);

  // Company-wide totals + per-call-status breakdown.
  const totals = useMemo(() => {
    const byCall: Record<string, number> = {};
    let statusUpdates = 0;
    for (const log of logs) {
      if (log.callStatus) byCall[log.callStatus] = (byCall[log.callStatus] || 0) + 1;
      if (log.statusId) statusUpdates++;
    }
    const active = aggs.filter((a) => a.total > 0).length;
    return { calls: logs.length, users: active, statusUpdates, byCall };
  }, [logs, aggs]);

  const fmtTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString("he-IL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  };
  const userName = (id: string) => {
    const u = userById.get(id);
    return u ? `${u.firstName} ${u.lastName}` : "משתמש לא ידוע";
  };
  const voterName = (id: string) => {
    const v = voterById.get(id);
    return v ? `${v.firstName} ${v.lastName}` : "—";
  };

  // CSV export of the per-user summary.
  const exportCsv = () => {
    const head = ["משתמש", "תפקיד", "סהכ שיחות", "עדכוני סטטוס", ...callStatuses.map((c) => c.name)];
    const rows = aggs.map((a) => {
      const u = userById.get(a.userId);
      return [
        userName(a.userId),
        u ? (ROLE_LABELS[u.role] ?? u.role) : "",
        a.total,
        a.statusUpdates,
        ...callStatuses.map((c) => a.byCall[c.id] || 0),
      ].join(",");
    });
    const csv = "﻿" + [head.join(","), ...rows].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url; a.download = `productivity_${from}_${to}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <PageHeader
        title="תפוקות טלמרקטינג"
        subtitle="כמות שיחות ועדכוני סטטוס לפי נציג, בטווח תאריכים נבחר"
        action={
          aggs.length > 0 ? (
            <button onClick={exportCsv}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 16px", background: "#fff", color: "#209dd7", border: "1px solid #209dd7", borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
              <Download size={15} /> ייצוא CSV
            </button>
          ) : undefined
        }
      />

      {/* Date range controls */}
      <div className="card" style={{ padding: 16, marginBottom: 20, display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 14 }}>
        <div>
          <label className="label">מתאריך</label>
          <input className="input" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} dir="ltr" style={{ minWidth: 160 }} />
        </div>
        <div>
          <label className="label">עד תאריך</label>
          <input className="input" type="date" value={to} min={from} max={todayStr()} onChange={(e) => setTo(e.target.value)} dir="ltr" style={{ minWidth: 160 }} />
        </div>
        <button onClick={fetchLogs} disabled={loading}
          style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 20px", background: loading ? "#93c5fd" : "linear-gradient(135deg,#209dd7,#1a7fad)", color: "#fff", border: "none", borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: loading ? "not-allowed" : "pointer" }}>
          {loading ? <Loader2 size={15} className="spin" /> : <RefreshCw size={15} />}
          {loading ? "טוען..." : "הצג"}
        </button>
      </div>

      {error && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "12px 16px", color: "#dc2626", fontSize: 14, marginBottom: 20 }}>
          שגיאה בטעינת הנתונים. ייתכן שנדרש אינדקס Firestore — נסה שוב בעוד רגע, או פנה למפתח.
        </div>
      )}

      {/* Summary cards */}
      {loaded && !error && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 14, marginBottom: 22 }}>
          <SummaryCard icon={<Phone size={18} />} label="סה״כ שיחות" value={totals.calls} color="#209dd7" />
          <SummaryCard icon={<Users size={18} />} label="משתמשים פעילים" value={totals.users} color="#753991" />
          <SummaryCard icon={<Activity size={18} />} label="עדכוני סטטוס" value={totals.statusUpdates} color="#16a34a" />
        </div>
      )}

      {/* Company-wide call-status breakdown */}
      {loaded && !error && totals.calls > 0 && (
        <div className="card" style={{ padding: "14px 18px", marginBottom: 22 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--dark-navy)", marginBottom: 10 }}>פילוח לפי תוצאת שיחה (כלל החברה)</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {callStatuses.map((c) => {
              const n = totals.byCall[c.id] || 0;
              if (!n) return null;
              return <Chip key={c.id} color={c.color} label={c.name} count={n} />;
            })}
          </div>
        </div>
      )}

      {/* Per-user table */}
      {loaded && !error && (
        <div className="card" style={{ overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--bg-subtle, #f8fafc)", textAlign: "right" }}>
                <th style={th}>משתמש</th>
                <th style={th}>תפקיד</th>
                <th style={{ ...th, textAlign: "center" }}>סה״כ שיחות</th>
                <th style={th}>פילוח תוצאות</th>
                <th style={{ ...th, textAlign: "center" }}>עדכוני סטטוס</th>
                <th style={{ ...th, width: 40 }} />
              </tr>
            </thead>
            <tbody>
              {aggs.map((a) => {
                const u = userById.get(a.userId);
                const isOpen = expanded === a.userId;
                const zero = a.total === 0;
                return (
                  <Fragment key={a.userId}>
                    <tr onClick={() => { if (!zero) setExpanded(isOpen ? null : a.userId); }}
                      style={{ borderTop: "1px solid var(--border,#e2e8f0)", cursor: zero ? "default" : "pointer", opacity: zero ? 0.5 : 1, background: isOpen ? "rgba(32,157,215,0.04)" : undefined }}>
                      <td style={{ ...td, fontWeight: 700, color: "var(--dark-navy)" }}>{userName(a.userId)}</td>
                      <td style={td}>{u ? (ROLE_LABELS[u.role] ?? u.role) : "—"}</td>
                      <td style={{ ...td, textAlign: "center", fontWeight: 800, color: "#209dd7", fontSize: 16 }}>{a.total}</td>
                      <td style={td}>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {callStatuses.map((c) => {
                            const n = a.byCall[c.id] || 0;
                            if (!n) return null;
                            return <Chip key={c.id} color={c.color} label={c.name} count={n} small />;
                          })}
                        </div>
                      </td>
                      <td style={{ ...td, textAlign: "center", fontWeight: 700 }}>{a.statusUpdates}</td>
                      <td style={{ ...td, textAlign: "center", color: "#94a3b8" }}>
                        {zero ? null : isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </td>
                    </tr>
                    {isOpen && (
                      <tr>
                        <td colSpan={6} style={{ padding: 0, background: "rgba(32,157,215,0.03)" }}>
                          <div style={{ padding: "8px 18px 16px" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                              <thead>
                                <tr style={{ textAlign: "right", color: "#64748b" }}>
                                  <th style={thIn}>זמן</th>
                                  <th style={thIn}>בוחר</th>
                                  <th style={thIn}>תוצאת שיחה</th>
                                  <th style={thIn}>סטטוס תמיכה</th>
                                  <th style={thIn}>הערות</th>
                                </tr>
                              </thead>
                              <tbody>
                                {a.logs.map((l) => {
                                  const cs = callById.get(l.callStatus);
                                  const ss = statusById.get(l.statusId);
                                  return (
                                    <tr key={l.id} onClick={() => router.push(`/telemarketing?voter=${l.voterId}`)}
                                      title="פתח את הבוחר במסך הטלמרקטינג"
                                      style={{ borderTop: "1px solid #eef2f7", cursor: "pointer" }}>
                                      <td style={tdIn}>{fmtTime(l.timestamp)}</td>
                                      <td style={{ ...tdIn, color: "#209dd7", fontWeight: 600 }}>{voterName(l.voterId)}</td>
                                      <td style={tdIn}>{cs ? <Chip color={cs.color} label={cs.name} small /> : "—"}</td>
                                      <td style={tdIn}>{ss ? <Chip color={ss.color} label={ss.name} small /> : "—"}</td>
                                      <td style={{ ...tdIn, color: "#475569" }}>{l.notes || "—"}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>

          {aggs.length === 0 && (
            <div style={{ padding: 48, textAlign: "center", color: "var(--gray-text)" }}>
              לא נמצאו שיחות מתועדות בטווח התאריכים שנבחר.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SummaryCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div className="card" style={{ padding: "16px 18px", display: "flex", alignItems: "center", gap: 14 }}>
      <div style={{ width: 42, height: 42, borderRadius: 12, background: `${color}1a`, color, display: "flex", alignItems: "center", justifyContent: "center" }}>{icon}</div>
      <div>
        <div style={{ fontSize: 24, fontWeight: 800, color: "var(--dark-navy)", lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 12, color: "var(--gray-text)", marginTop: 4 }}>{label}</div>
      </div>
    </div>
  );
}

function Chip({ color, label, count, small }: { color: string; label: string; count?: number; small?: boolean }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      background: `${color}1a`, color, border: `1px solid ${color}40`,
      borderRadius: 20, padding: small ? "1px 8px" : "3px 11px", fontSize: small ? 11 : 12, fontWeight: 700,
    }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: color, display: "inline-block" }} />
      {label}{count != null && <strong style={{ fontWeight: 800 }}>· {count}</strong>}
    </span>
  );
}

const th: React.CSSProperties = { padding: "12px 16px", fontSize: 12, fontWeight: 700, color: "var(--gray-text)", textAlign: "right" };
const td: React.CSSProperties = { padding: "12px 16px", fontSize: 14, color: "var(--text-primary,#1e293b)" };
const thIn: React.CSSProperties = { padding: "6px 10px", fontSize: 12, fontWeight: 700, textAlign: "right" };
const tdIn: React.CSSProperties = { padding: "6px 10px", verticalAlign: "top" };
