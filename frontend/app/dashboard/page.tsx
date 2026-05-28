"use client";

import { useState, useMemo } from "react";
import { useStore } from "@/lib/store";
import { useRouter } from "next/navigation";
import { Users, UsersRound, UserCheck, Shield, TrendingUp, AlertCircle, CheckCircle2, BarChart3, Vote } from "lucide-react";

export default function DashboardPage() {
  const { state } = useStore();
  const { voters, groups, groupLeaders, divisionHeads, statuses } = state;
  const router = useRouter();

  const statusMap = useMemo(() => new Map(statuses.map(s => [s.id, s])), [statuses]);
  const supporters = voters.filter(v => statusMap.get(v.statusId ?? "")?.category === "supporter").length;
  const opponents  = voters.filter(v => statusMap.get(v.statusId ?? "")?.category === "opponent").length;
  const undecided  = voters.filter(v => statusMap.get(v.statusId ?? "")?.category === "undecided").length;
  const noStatus   = voters.filter(v => {
    if (!v.statusId) return true;
    const cat = statusMap.get(v.statusId)?.category;
    return !cat || cat === "neutral";
  }).length;
  const total      = voters.length;
  const totalVoted = voters.filter(v => v.hasVoted).length;
  const votingPct  = total > 0 ? Math.round((totalVoted / total) * 100) : 0;
  const pct = (n: number) => total ? Math.round((n / total) * 100) : 0;

  const orphanGroups = groups.filter(g => !g.groupLeaderId);

  const stats = [
    { label: "בוחרים",     value: total,               icon: Users,      color: "#209dd7", bg: "rgba(32,157,215,.1)",   href: "/voters" },
    { label: "קבוצות",     value: groups.length,        icon: UsersRound, color: "#f59e0b", bg: "rgba(245,158,11,.12)",  href: "/groups" },
    { label: "ראשי קבוצה", value: groupLeaders.length,  icon: UserCheck,  color: "#753991", bg: "rgba(117,57,145,.1)",   href: "/group-leaders" },
    { label: "ראשי אגף",   value: divisionHeads.length, icon: Shield,     color: "#0f172a", bg: "rgba(15,23,42,.08)",    href: "/division-heads" },
  ];

  return (
    <div>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: 28 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="page-accent" />
            <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--text-primary)", margin: 0 }}>לוח בקרה</h1>
          </div>
          <p style={{ color: "var(--gray-text)", fontSize: 13, marginTop: 4, marginRight: 14 }}>סקירה כללית של מערכת ניהול הבחירות</p>
        </div>
        <button className="btn-primary" onClick={() => router.push("/reports")} style={{ gap: 7 }}>
          <BarChart3 size={15} /> דוחות חכמים
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid-4" style={{ marginBottom: 24 }}>
        {stats.map(({ label, value, icon: Icon, color, bg, href }) => (
          <button key={label} className="stat-card" onClick={() => router.push(href)} style={{ width: "100%", background: "none", border: "none", textAlign: "right", padding: 0 }}>
            <div className="stat-icon" style={{ background: bg }}><Icon size={22} color={color} /></div>
            <div>
              <div className="stat-value">{value}</div>
              <div className="stat-label">{label}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Voting rate banner — shown whenever there are voters */}
      {total > 0 && (
        <div style={{ marginBottom: 24, padding: "18px 22px", borderRadius: 14, background: totalVoted > 0 ? "linear-gradient(135deg,#f0fdf4,#dcfce7)" : "linear-gradient(135deg,#f8fafc,#f1f5f9)", border: `1.5px solid ${totalVoted > 0 ? "#86efac" : "#e2e8f0"}`, display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", background: totalVoted > 0 ? "#22c55e" : "#94a3b8", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Vote size={22} color="#fff" />
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
              <span style={{ fontWeight: 700, fontSize: 15, color: totalVoted > 0 ? "#166534" : "#475569" }}>שיעור הצבעה</span>
              <span style={{ fontWeight: 800, fontSize: 22, color: totalVoted > 0 ? "#16a34a" : "#94a3b8" }}>{votingPct}%</span>
            </div>
            <div style={{ height: 10, borderRadius: 5, background: "rgba(0,0,0,0.06)", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${votingPct}%`, background: totalVoted > 0 ? "#22c55e" : "#cbd5e1", borderRadius: 5, transition: "width 0.6s ease" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5, fontSize: 12, color: "#64748b" }}>
              <span style={{ color: totalVoted > 0 ? "#16a34a" : "#94a3b8", fontWeight: 600 }}>{totalVoted} הצביעו</span>
              <span>{total - totalVoted} טרם הצביעו</span>
            </div>
          </div>
          <button className="btn-secondary" style={{ flexShrink: 0 }} onClick={() => router.push("/reports?open=voting")}>
            דוח הצבעה מלא
          </button>
        </div>
      )}

      {/* Support overview + orphans */}
      <div className="grid-2" style={{ marginBottom: 24 }}>

        {/* Support breakdown */}
        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
            <TrendingUp size={16} color="var(--blue-primary)" />
            <span style={{ fontWeight: 700, fontSize: 15, color: "var(--text-primary)" }}>מצב תמיכה</span>
          </div>
          {total === 0 ? (
            <p style={{ color: "var(--text-muted)", fontSize: 13 }}>אין בוחרים עדיין</p>
          ) : (
            <>
              <div style={{ display: "flex", height: 12, borderRadius: 6, overflow: "hidden", marginBottom: 16, gap: 2 }}>
                {supporters > 0 && <div style={{ flex: supporters, background: "#22c55e", borderRadius: 6 }} />}
                {opponents > 0  && <div style={{ flex: opponents,  background: "#ef4444", borderRadius: 6 }} />}
                {undecided > 0  && <div style={{ flex: undecided,  background: "#f59e0b", borderRadius: 6 }} />}
                {noStatus > 0   && <div style={{ flex: noStatus,   background: "#e2e8f0", borderRadius: 6 }} />}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  { label: "תומכים",    count: supporters, color: "#22c55e", bg: "rgba(34,197,94,.08)" },
                  { label: "מתנגדים",   count: opponents,  color: "#ef4444", bg: "rgba(239,68,68,.08)" },
                  { label: "מתלבטים",  count: undecided,  color: "#f59e0b", bg: "rgba(245,158,11,.1)" },
                  { label: "ללא סטטוס", count: noStatus,   color: "#94a3b8", bg: "rgba(148,163,184,.08)" },
                ].map(({ label, count, color, bg }) => (
                  <div key={label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: color, flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 13, color: "var(--text-secondary)" }}>{label}</span>
                    <span style={{ fontWeight: 700, fontSize: 13, color: "var(--text-primary)" }}>{count}</span>
                    <span style={{ background: bg, color, borderRadius: 20, padding: "1px 8px", fontSize: 11, fontWeight: 700, minWidth: 40, textAlign: "center" }}>{pct(count)}%</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Right column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Orphan groups */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              {orphanGroups.length > 0 ? <AlertCircle size={15} color="#f59e0b" /> : <CheckCircle2 size={15} color="#22c55e" />}
              <span style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)" }}>קבוצות ללא ראש קבוצה</span>
              {orphanGroups.length > 0 && <span className="badge badge-yellow" style={{ marginRight: "auto" }}>{orphanGroups.length}</span>}
            </div>
            {orphanGroups.length === 0
              ? <p style={{ fontSize: 13, color: "#16a34a", fontWeight: 600 }}>✓ כל הקבוצות מנוהלות</p>
              : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {orphanGroups.slice(0, 4).map(g => (
                    <div key={g.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 10px", background: "rgba(245,158,11,.06)", borderRadius: 8, border: "1px solid rgba(245,158,11,.15)" }}>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{g.name}</span>
                      <span className="badge badge-yellow">{g.voterIds.length} בוחרים</span>
                    </div>
                  ))}
                </div>
              )}
          </div>

          {/* Recent voters */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <Users size={15} color="var(--blue-primary)" />
              <span style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)" }}>בוחרים אחרונים</span>
              <button className="btn-secondary" style={{ marginRight: "auto", padding: "4px 12px", fontSize: 12 }} onClick={() => router.push("/voters")}>הכל</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {voters.slice(0, 5).map(v => {
                const st = statusMap.get(v.statusId ?? "");
                return (
                  <div key={v.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 6px", borderBottom: "1px solid var(--border-light)" }}>
                    <div className="avatar" style={{ background: "linear-gradient(135deg,#209dd7,#753991)", width: 30, height: 30, fontSize: 11 }}>
                      {v.firstName[0]}{v.lastName[0]}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {v.firstName} {v.lastName}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{v.address.city}</div>
                    </div>
                    {v.hasVoted && <span style={{ fontSize: 10, background: "#dcfce7", color: "#16a34a", borderRadius: 20, padding: "1px 6px", fontWeight: 700 }}>✓</span>}
                    {st && (
                      <span style={{ background: st.color + "22", color: st.color, borderRadius: 20, padding: "2px 8px", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>
                        {st.name}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Hierarchy tree */}
      <div className="card" style={{ padding: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
          <Shield size={16} color="var(--blue-primary)" />
          <span style={{ fontWeight: 700, fontSize: 15, color: "var(--text-primary)" }}>היררכיית ניהול</span>
        </div>
        {divisionHeads.length === 0
          ? <p style={{ color: "var(--text-muted)", fontSize: 13 }}>אין ראשי אגף מוגדרים</p>
          : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {divisionHeads.map(dh => {
                const dhLeaders = groupLeaders.filter(l => dh.groupLeaderIds.includes(l.id));
                return (
                  <div key={dh.id}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "rgba(15,23,42,.04)", borderRadius: 10, borderRight: "4px solid var(--navy)" }}>
                      <Shield size={14} color="var(--navy)" />
                      <span style={{ fontWeight: 700, fontSize: 14, color: "var(--navy)" }}>ראש אגף: {dh.firstName} {dh.lastName}</span>
                      <span className="badge badge-navy" style={{ marginRight: "auto" }}>{dhLeaders.length} ראשי קבוצה</span>
                    </div>
                    <div style={{ marginRight: 20, marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
                      {dhLeaders.map(gl => {
                        const glGroups = groups.filter(g => gl.groupIds.includes(g.id));
                        const voterCount = glGroups.reduce((s, g) => s + g.voterIds.length, 0);
                        return (
                          <div key={gl.id}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "rgba(117,57,145,.04)", borderRadius: 8, borderRight: "3px solid var(--purple-secondary)" }}>
                              <UserCheck size={13} color="var(--purple-secondary)" />
                              <span style={{ fontWeight: 600, fontSize: 13, color: "#4a2060" }}>ראש קבוצה: {gl.firstName} {gl.lastName}</span>
                              <span className="badge badge-purple" style={{ marginRight: "auto" }}>{glGroups.length} קבוצות · {voterCount} בוחרים</span>
                            </div>
                            <div style={{ marginRight: 20, marginTop: 6, display: "flex", flexWrap: "wrap", gap: 6 }}>
                              {glGroups.map(g => (
                                <div key={g.id} style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", background: "rgba(32,157,215,.06)", borderRadius: 20, border: "1px solid rgba(32,157,215,.2)", fontSize: 12 }}>
                                  <UsersRound size={10} color="var(--blue-primary)" />
                                  <span style={{ color: "var(--blue-primary)", fontWeight: 600 }}>{g.name}</span>
                                  <span style={{ color: "var(--text-muted)" }}>({g.voterIds.length})</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
      </div>
    </div>
  );
}
      