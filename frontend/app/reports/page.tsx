"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import {
  BarChart3, UserCheck, UsersRound, Shield,
  Home, MapPin, ChevronDown, ChevronUp,
  AlertTriangle, TrendingUp, Play, X,
  Award, Target,
} from "lucide-react";
import type { Voter, Status } from "@/types";

/* ─── tiny helpers ──────────────────────────────────────── */
function pct(n: number, total: number) {
  return total === 0 ? 0 : Math.round((n / total) * 100);
}
function statusCounts(voterList: Voter[]) {
  const counts: Record<string, number> = {};
  voterList.forEach((v) => {
    if (v.statusId) counts[v.statusId] = (counts[v.statusId] ?? 0) + 1;
  });
  return counts;
}

/* ─── horizontal stacked bar ────────────────────────────── */
function StackedBar({ counts, statuses, total }: { counts: Record<string, number>; statuses: Status[]; total: number }) {
  if (total === 0) return <span style={{ fontSize: 12, color: "#94a3b8" }}>אין נתונים</span>;
  return (
    <div style={{ width: "100%", minWidth: 160 }}>
      <div style={{ height: 10, borderRadius: 6, overflow: "hidden", display: "flex", background: "#f1f5f9" }}>
        {statuses.map((st) => {
          const n = counts[st.id] ?? 0;
          const p = pct(n, total);
          if (p === 0) return null;
          return <div key={st.id} style={{ width: `${p}%`, background: st.color, transition: "width .4s" }} />;
        })}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
        {statuses.map((st) => {
          const n = counts[st.id] ?? 0;
          if (n === 0) return null;
          return (
            <span key={st.id} style={{ fontSize: 11, color: st.color, fontWeight: 600 }}>
              {st.name} {n} ({pct(n, total)}%)
            </span>
          );
        })}
      </div>
    </div>
  );
}

/* ─── big metric card ───────────────────────────────────── */
function MetricCard({ label, value, color, sub }: { label: string; value: number | string; color: string; sub?: string }) {
  return (
    <div className="card" style={{ padding: "18px 20px", borderTop: `3px solid ${color}` }}>
      <div style={{ fontSize: 30, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontWeight: 700, fontSize: 13, color: "var(--dark-navy)", marginTop: 4 }}>{label}</div>
      {sub && <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

/* ─── report card (before generation) ──────────────────── */
function ReportCard({ icon: Icon, title, description, color, onGenerate, active }: {
  icon: React.ElementType; title: string; description: string; color: string;
  onGenerate: () => void; active: boolean;
}) {
  return (
    <div className="card" style={{ padding: "20px", cursor: "pointer", borderTop: active ? `3px solid ${color}` : "3px solid transparent", transition: "all .2s", background: active ? `${color}08` : "#fff" }} onClick={onGenerate}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div style={{ width: 42, height: 42, borderRadius: 10, background: `${color}15`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icon size={20} color={color} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: "var(--dark-navy)", marginBottom: 4 }}>{title}</div>
          <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>{description}</div>
        </div>
      </div>
      <button
        style={{ marginTop: 14, width: "100%", padding: "8px", background: active ? color : "transparent", color: active ? "#fff" : color, border: `1.5px solid ${color}`, borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, transition: "all .2s" }}
        onClick={(e) => { e.stopPropagation(); onGenerate(); }}
      >
        {active ? <><X size={13} /> סגור דוח</> : <><Play size={13} /> הפק דוח</>}
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════ */
type ReportKey = "leaders" | "groups" | "divisions" | "families" | "geo" | null;

export default function ReportsPage() {
  const { state } = useStore();
  const { voters, groups, groupLeaders, divisionHeads, statuses } = state;
  const [activeReport, setActiveReport] = useState<ReportKey>(null);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const toggle = (key: ReportKey) => {
    setActiveReport((prev) => (prev === key ? null : key));
    setExpandedRow(null);
  };

  /* ── overall counts ──────────────────────────────────── */
  const overall = useMemo(() => {
    const counts: Record<string, number> = {};
    let noStatus = 0;
    voters.forEach((v) => {
      if (v.statusId) counts[v.statusId] = (counts[v.statusId] ?? 0) + 1;
      else noStatus++;
    });
    return { counts, noStatus };
  }, [voters]);

  /* ── group leader data ───────────────────────────────── */
  const leaderRows = useMemo(() => {
    return groupLeaders.map((gl) => {
      const glGroups = groups.filter((g) => gl.groupIds.includes(g.id));
      const voterSet = new Set(glGroups.flatMap((g) => g.voterIds));
      const glVoters = voters.filter((v) => voterSet.has(v.id));
      const dh = divisionHeads.find((d) => d.id === gl.divisionHeadId);
      const counts = statusCounts(glVoters);
      return { gl, dh, glGroups, glVoters, counts, total: glVoters.length };
    }).sort((a, b) => b.total - a.total);
  }, [groupLeaders, groups, voters, divisionHeads]);

  /* ── group data ──────────────────────────────────────── */
  const groupRows = useMemo(() => {
    return groups.map((g) => {
      const gv = voters.filter((v) => g.voterIds.includes(v.id));
      const leader = g.groupLeaderId ? groupLeaders.find((gl) => gl.id === g.groupLeaderId) : null;
      const counts = statusCounts(gv);
      return { g, gv, leader, counts, total: gv.length };
    }).sort((a, b) => b.total - a.total);
  }, [groups, voters, groupLeaders]);

  /* ── division head data ──────────────────────────────── */
  const divisionRows = useMemo(() => {
    return divisionHeads.map((dh) => {
      const dhLeaders = groupLeaders.filter((gl) => gl.divisionHeadId === dh.id);
      const dhGroups = groups.filter((g) => dhLeaders.some((gl) => gl.groupIds.includes(g.id)));
      const voterSet = new Set(dhGroups.flatMap((g) => g.voterIds));
      const dhVoters = voters.filter((v) => voterSet.has(v.id));
      const counts = statusCounts(dhVoters);
      return { dh, dhLeaders, dhGroups, dhVoters, counts, total: dhVoters.length };
    }).sort((a, b) => b.total - a.total);
  }, [divisionHeads, groupLeaders, groups, voters]);

  /* ── family data ─────────────────────────────────────── */
  const familyRows = useMemo(() => {
    const map = new Map<string, Voter[]>();
    voters.forEach((v) => {
      const key = `${v.lastName.trim()}|${v.address.city.trim()}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(v);
    });
    const rows: { key: string; lastName: string; city: string; members: Voter[]; counts: Record<string, number>; isMixed: boolean }[] = [];
    map.forEach((members, key) => {
      if (members.length < 2) return;
      const [lastName, city] = key.split("|");
      const counts = statusCounts(members);
      const isMixed = Object.keys(counts).length > 1;
      rows.push({ key, lastName, city, members, counts, isMixed });
    });
    return rows.sort((a, b) => (b.isMixed ? 1 : 0) - (a.isMixed ? 1 : 0) || b.members.length - a.members.length);
  }, [voters]);

  /* ── geographic data ─────────────────────────────────── */
  const geoRows = useMemo(() => {
    const map = new Map<string, Voter[]>();
    voters.forEach((v) => {
      const city = v.address.city.trim() || "לא ידוע";
      if (!map.has(city)) map.set(city, []);
      map.get(city)!.push(v);
    });
    const rows: { city: string; cityVoters: Voter[]; counts: Record<string, number> }[] = [];
    map.forEach((cityVoters, city) => {
      rows.push({ city, cityVoters, counts: statusCounts(cityVoters) });
    });
    return rows.sort((a, b) => b.cityVoters.length - a.cityVoters.length);
  }, [voters]);

  const statusLabel = (id?: string) => {
    const st = statuses.find((s) => s.id === id);
    return st ?? { name: "ללא סטטוס", color: "#94a3b8", id: "__none" };
  };

  const REPORTS = [
    { key: "leaders" as ReportKey, icon: UserCheck,  color: "#753991", title: "ניתוח ראשי קבוצה",    description: "תומכים, מתנגדים ומתלבטים לכל ראש קבוצה — עם פירוט לפי קבוצות" },
    { key: "groups"  as ReportKey, icon: UsersRound, color: "#209dd7", title: "ניתוח קבוצות",         description: "התפלגות סטטוסי תמיכה לכל קבוצה, ממוין לפי גודל" },
    { key: "divisions" as ReportKey, icon: Shield,   color: "#032147", title: "ניתוח ראשי אגף",       description: "מבט רוחבי: כמה תומכים / מתנגדים תחת כל ראש אגף" },
    { key: "families" as ReportKey, icon: Home,      color: "#f59e0b", title: "הצלבת משפחות",         description: "משפחות עם עמדות מעורבות — מועמדות לשכנוע" },
    { key: "geo"   as ReportKey,   icon: MapPin,     color: "#16a34a", title: "מפת תמיכה גיאוגרפית",  description: "התפלגות תמיכה לפי עיר / ישוב" },
  ];

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
          <span className="page-accent" />
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--dark-navy)", margin: 0 }}>דוחות חכמים</h1>
        </div>
        <p style={{ color: "var(--gray-text)", fontSize: 14, marginRight: 22 }}>בחר דוח כדי להפיק ניתוח מעמיק בזמן אמת</p>
      </div>

      {/* Summary strip */}
      <div className="resp-grid-4" style={{ marginBottom: 28 }}>
        <MetricCard label="סה&quot;כ בוחרים" value={voters.length} color="#209dd7" />
        {statuses.map((st) => {
          const n = overall.counts[st.id] ?? 0;
          return <MetricCard key={st.id} label={st.name} value={n} color={st.color} sub={`${pct(n, voters.length)}% מהכלל`} />;
        })}
        {overall.noStatus > 0 && <MetricCard label="ללא סטטוס" value={overall.noStatus} color="#94a3b8" sub={`${pct(overall.noStatus, voters.length)}%`} />}
      </div>

      {/* Report selector grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14, marginBottom: 28 }}>
        {REPORTS.map(({ key, icon, color, title, description }) => (
          <ReportCard key={key!} icon={icon} title={title} description={description} color={color} onGenerate={() => toggle(key)} active={activeReport === key} />
        ))}
      </div>

      {/* ── ACTIVE REPORT ──────────────────────────────── */}

      {/* ① Group Leaders */}
      {activeReport === "leaders" && (
        <div className="card" style={{ overflow: "hidden" }}>
          <div style={{ padding: "18px 22px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", gap: 8 }}>
            <UserCheck size={16} color="#753991" />
            <span style={{ fontWeight: 700, fontSize: 15, color: "var(--dark-navy)" }}>ניתוח ראשי קבוצה</span>
            <span style={{ marginRight: "auto", fontSize: 12, color: "#64748b" }}>{leaderRows.length} ראשי קבוצה · {voters.length} בוחרים</span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 540 }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  {["ראש קבוצה", "ראש אגף", "קבוצות", "בוחרים", "התפלגות תמיכה", ""].map((h) => (
                    <th key={h} style={{ padding: "11px 16px", textAlign: "right", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {leaderRows.map(({ gl, dh, glGroups, glVoters, counts, total }, i) => {
                  const isExpanded = expandedRow === gl.id;
                  return (
                    <>
                      <tr key={gl.id} style={{ background: i % 2 === 0 ? "#fff" : "#fafbfc", borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "13px 16px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg,#209dd7,#753991)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 11, flexShrink: 0 }}>
                              {gl.firstName[0]}{gl.lastName[0]}
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: 13, color: "var(--dark-navy)" }}>{gl.firstName} {gl.lastName}</div>
                              {gl.phone && <div style={{ fontSize: 11, color: "#64748b", direction: "ltr" }}>{gl.phone}</div>}
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: "13px 16px", fontSize: 12, color: "#475569" }}>{dh ? `${dh.firstName} ${dh.lastName}` : "—"}</td>
                        <td style={{ padding: "13px 16px" }}>
                          <span className="badge badge-purple">{glGroups.length}</span>
                        </td>
                        <td style={{ padding: "13px 16px" }}>
                          <span className="badge badge-blue">{total}</span>
                        </td>
                        <td style={{ padding: "13px 16px", minWidth: 200 }}>
                          <StackedBar counts={counts} statuses={statuses} total={total} />
                        </td>
                        <td style={{ padding: "13px 16px" }}>
                          <button onClick={() => setExpandedRow(isExpanded ? null : gl.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", display: "flex", alignItems: "center", padding: 4, borderRadius: 6 }}>
                            {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                          </button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr key={`${gl.id}-exp`}>
                          <td colSpan={6} style={{ background: "#f8fafc", padding: "14px 20px 14px 32px" }}>
                            <div style={{ fontWeight: 600, fontSize: 12, color: "#475569", marginBottom: 10 }}>פירוט לפי קבוצה:</div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                              {glGroups.map((g) => {
                                const gv = voters.filter((v) => g.voterIds.includes(v.id));
                                const gc = statusCounts(gv);
                                return (
                                  <div key={g.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 14px", background: "#fff", borderRadius: 8, border: "1px solid #e2e8f0", flexWrap: "wrap" }}>
                                    <div style={{ fontWeight: 600, fontSize: 13, color: "var(--dark-navy)", minWidth: 160 }}>
                                      {g.name} <span style={{ fontWeight: 400, color: "#64748b", fontSize: 12 }}>({gv.length})</span>
                                    </div>
                                    <div style={{ flex: 1, minWidth: 160 }}>
                                      <StackedBar counts={gc} statuses={statuses} total={gv.length} />
                                    </div>
                                    {statuses.map((st) => {
                                      const n = gc[st.id] ?? 0;
                                      if (n === 0) return null;
                                      return (
                                        <span key={st.id} style={{ background: `${st.color}18`, color: st.color, border: `1px solid ${st.color}40`, borderRadius: 12, padding: "2px 9px", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>
                                          {st.name}: {n}
                                        </span>
                                      );
                                    })}
                                  </div>
                                );
                              })}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ② Groups */}
      {activeReport === "groups" && (
        <div className="card" style={{ overflow: "hidden" }}>
          <div style={{ padding: "18px 22px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", gap: 8 }}>
            <UsersRound size={16} color="#209dd7" />
            <span style={{ fontWeight: 700, fontSize: 15, color: "var(--dark-navy)" }}>ניתוח קבוצות</span>
            <span style={{ marginRight: "auto", fontSize: 12, color: "#64748b" }}>{groups.length} קבוצות</span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 480 }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  {["קבוצה", "ראש קבוצה", "בוחרים", "התפלגות תמיכה"].map((h) => (
                    <th key={h} style={{ padding: "11px 16px", textAlign: "right", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {groupRows.map(({ g, gv, leader, counts, total }, i) => (
                  <tr key={g.id} style={{ background: i % 2 === 0 ? "#fff" : "#fafbfc", borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "13px 16px", fontWeight: 600, fontSize: 13, color: "var(--dark-navy)" }}>{g.name}</td>
                    <td style={{ padding: "13px 16px", fontSize: 12, color: "#475569" }}>
                      {leader ? `${leader.firstName} ${leader.lastName}` : <span style={{ color: "#dc2626", fontSize: 12 }}>ללא ראש קבוצה</span>}
                    </td>
                    <td style={{ padding: "13px 16px" }}><span className="badge badge-blue">{total}</span></td>
                    <td style={{ padding: "13px 16px", minWidth: 200 }}>
                      <StackedBar counts={counts} statuses={statuses} total={total} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ③ Division Heads */}
      {activeReport === "divisions" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {divisionRows.map(({ dh, dhLeaders, dhGroups, dhVoters, counts, total }) => {
            const isExp = expandedRow === dh.id;
            return (
              <div key={dh.id} className="card" style={{ overflow: "hidden" }}>
                <button onClick={() => setExpandedRow(isExp ? null : dh.id)} style={{ width: "100%", background: "none", border: "none", cursor: "pointer", padding: "18px 22px", display: "flex", alignItems: "center", gap: 14, textAlign: "right", flexWrap: "wrap" }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(3,33,71,0.08)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Shield size={20} color="var(--dark-navy)" />
                  </div>
                  <div style={{ flex: 1, minWidth: 120 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: "var(--dark-navy)" }}>{dh.firstName} {dh.lastName}</div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>{dhLeaders.length} ראשי קבוצה · {dhGroups.length} קבוצות · {total} בוחרים</div>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    {statuses.map((st) => {
                      const n = counts[st.id] ?? 0;
                      if (n === 0) return null;
                      return (
                        <span key={st.id} style={{ background: `${st.color}18`, color: st.color, border: `1px solid ${st.color}40`, borderRadius: 14, padding: "4px 11px", fontSize: 12, fontWeight: 700 }}>
                          {st.name}: {n} ({pct(n, total)}%)
                        </span>
                      );
                    })}
                  </div>
                  {isExp ? <ChevronUp size={15} color="#94a3b8" /> : <ChevronDown size={15} color="#94a3b8" />}
                </button>
                {/* progress bar */}
                <div style={{ height: 5, display: "flex", overflow: "hidden" }}>
                  {statuses.map((st) => {
                    const p = pct(counts[st.id] ?? 0, total);
                    if (p === 0) return null;
                    return <div key={st.id} style={{ width: `${p}%`, background: st.color }} />;
                  })}
                </div>
                {isExp && (
                  <div style={{ padding: "16px 22px", borderTop: "1px solid #f1f5f9", background: "#fafbfc" }}>
                    <div style={{ fontWeight: 600, fontSize: 12, color: "#475569", marginBottom: 10 }}>ראשי קבוצה:</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {dhLeaders.map((gl) => {
                        const glGrps = groups.filter((g) => gl.groupIds.includes(g.id));
                        const glV = voters.filter((v) => glGrps.some((g) => g.voterIds.includes(v.id)));
                        const glC = statusCounts(glV);
                        return (
                          <div key={gl.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "#fff", borderRadius: 8, border: "1px solid #e2e8f0", flexWrap: "wrap" }}>
                            <div style={{ fontWeight: 600, fontSize: 13, color: "var(--dark-navy)", minWidth: 130 }}>{gl.firstName} {gl.lastName}</div>
                            <span className="badge badge-purple" style={{ marginLeft: 4 }}>{glGrps.length} קבוצות</span>
                            <span className="badge badge-blue">{glV.length} בוחרים</span>
                            <div style={{ flex: 1, minWidth: 160 }}>
                              <StackedBar counts={glC} statuses={statuses} total={glV.length} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ④ Families */}
      {activeReport === "families" && (
        <div>
          {familyRows.filter((f) => f.isMixed).length > 0 && (
            <div style={{ background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 12, padding: "14px 18px", marginBottom: 18, display: "flex", alignItems: "flex-start", gap: 12 }}>
              <AlertTriangle size={18} color="#d97706" style={{ flexShrink: 0, marginTop: 1 }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: "#92400e" }}>
                  {familyRows.filter((f) => f.isMixed).length} משפחות עם עמדות מעורבות
                </div>
                <div style={{ fontSize: 13, color: "#a16207", marginTop: 2 }}>
                  בני המשפחות הללו הם מועמדים מצוינים לשיחת שכנוע
                </div>
              </div>
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {familyRows.map((family) => {
              const isExp = expandedRow === family.key;
              return (
                <div key={family.key} className="card" style={{ overflow: "hidden", borderRight: family.isMixed ? "4px solid #f59e0b" : "4px solid #e2e8f0" }}>
                  <button onClick={() => setExpandedRow(isExp ? null : family.key)} style={{ width: "100%", background: "none", border: "none", cursor: "pointer", padding: "14px 18px", display: "flex", alignItems: "center", gap: 12, textAlign: "right", flexWrap: "wrap" }}>
                    <div style={{ width: 36, height: 36, borderRadius: 9, background: family.isMixed ? "rgba(245,158,11,0.12)" : "rgba(32,157,215,0.08)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Home size={16} color={family.isMixed ? "#d97706" : "var(--blue-primary)"} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: "var(--dark-navy)", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        משפחת {family.lastName}
                        {family.isMixed && <span style={{ background: "#fef3c7", color: "#d97706", fontSize: 11, fontWeight: 700, padding: "1px 7px", borderRadius: 7 }}>מעורב</span>}
                      </div>
                      <div style={{ fontSize: 12, color: "#64748b" }}>{family.city} · {family.members.length} בני משפחה</div>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {statuses.map((st) => {
                        const n = family.counts[st.id] ?? 0;
                        if (n === 0) return null;
                        return <span key={st.id} style={{ background: `${st.color}18`, color: st.color, border: `1px solid ${st.color}40`, borderRadius: 12, padding: "2px 9px", fontSize: 11, fontWeight: 700 }}>{st.name}: {n}</span>;
                      })}
                    </div>
                    {isExp ? <ChevronUp size={14} color="#94a3b8" /> : <ChevronDown size={14} color="#94a3b8" />}
                  </button>
                  {isExp && (
                    <div style={{ borderTop: "1px solid #f1f5f9", padding: "12px 18px", background: "#fafbfc" }}>
                      {family.members.map((m) => {
                        const st = statusLabel(m.statusId);
                        return (
                          <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", background: "#fff", borderRadius: 8, border: "1px solid #e2e8f0", marginBottom: 6, flexWrap: "wrap" }}>
                            <div style={{ width: 30, height: 30, borderRadius: "50%", background: `${st.color}20`, display: "flex", alignItems: "center", justifyContent: "center", color: st.color, fontWeight: 700, fontSize: 11, flexShrink: 0 }}>{m.firstName[0]}</div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 600, fontSize: 13, color: "var(--dark-navy)" }}>{m.firstName} {m.lastName}</div>
                              <div style={{ fontSize: 11, color: "#64748b" }}>{m.address.street} {m.address.streetNumber}{m.address.apartment ? ` דירה ${m.address.apartment}` : ""}</div>
                            </div>
                            {m.phone && <a href={`tel:${m.phone}`} style={{ fontSize: 12, color: "var(--blue-primary)", textDecoration: "none", direction: "ltr" }}>{m.phone}</a>}
                            <span style={{ background: `${st.color}18`, color: st.color, border: `1px solid ${st.color}40`, borderRadius: 12, padding: "2px 9px", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>{st.name}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ⑤ Geographic */}
      {activeReport === "geo" && (
        <div className="card" style={{ overflow: "hidden" }}>
          <div style={{ padding: "18px 22px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", gap: 8 }}>
            <MapPin size={16} color="#16a34a" />
            <span style={{ fontWeight: 700, fontSize: 15, color: "var(--dark-navy)" }}>מפת תמיכה גיאוגרפית</span>
            <span style={{ marginRight: "auto", fontSize: 12, color: "#64748b" }}>{geoRows.length} יישובים</span>
          </div>
          <div>
            {geoRows.map(({ city, cityVoters, counts }, i) => (
              <div key={city} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 22px", background: i % 2 === 0 ? "#fff" : "#fafbfc", borderBottom: "1px solid #f1f5f9", flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 140 }}>
                  <MapPin size={14} color="#16a34a" />
                  <span style={{ fontWeight: 700, fontSize: 14, color: "var(--dark-navy)" }}>{city}</span>
                </div>
                <span className="badge badge-blue">{cityVoters.length} בוחרים</span>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <StackedBar counts={counts} statuses={statuses} total={cityVoters.length} />
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {statuses.map((st) => {
                    const n = counts[st.id] ?? 0;
                    if (n === 0) return null;
                    return (
                      <span key={st.id} style={{ background: `${st.color}18`, color: st.color, border: `1px solid ${st.color}40`, borderRadius: 12, padding: "3px 10px", fontSize: 12, fontWeight: 700 }}>
                        {st.name}: {n}
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
