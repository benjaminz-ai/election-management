"use client";
import { useState, useEffect } from "react";
import { useStore } from "@/lib/store";
import { BarChart3, Users, ChevronDown, ChevronUp, MapPin, GitMerge, Loader2, Tag } from "lucide-react";
import { Voter, Group, GroupLeader, DivisionHead, Status } from "@/types";

type ReportKey = "leaders" | "groups" | "divisions" | "families" | "geo" | null;

// Classify status name into broad category
function classifyStatus(name: string): "supporter" | "opponent" | "undecided" | "other" {
  const n = name;
  if (n.includes("תומך") || n.includes("בעד") || n.includes("חיובי")) return "supporter";
  if (n.includes("מתנגד") || n.includes("נגד") || n.includes("שלילי")) return "opponent";
  if (n.includes("מתלבט") || n.includes("ספק") || n.includes("לא יודע") || n.includes("לא החליט")) return "undecided";
  return "other";
}

interface StatusBreakdown {
  [statusName: string]: { count: number; color: string; category: string };
}

interface GroupStats {
  group: Group;
  breakdown: StatusBreakdown;
  total: number;
  supporters: number;
  opponents: number;
  undecided: number;
}

function StatusBar({ breakdown, total }: { breakdown: StatusBreakdown; total: number }) {
  if (total === 0) return <div style={{ color: "#94a3b8", fontSize: 13 }}>אין בוחרים</div>;
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: "flex", height: 10, borderRadius: 6, overflow: "hidden", width: "100%", gap: 1 }}>
        {Object.entries(breakdown).map(([name, { count, color }]) =>
          count > 0 ? (
            <div
              key={name}
              style={{ width: `${(count / total) * 100}%`, background: color, minWidth: 2 }}
              title={`${name}: ${count}`}
            />
          ) : null
        )}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", marginTop: 6, fontSize: 12 }}>
        {Object.entries(breakdown).map(([name, { count, color }]) =>
          count > 0 ? (
            <span key={name} style={{ color, display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: color }} />
              {name}: {count}
            </span>
          ) : null
        )}
      </div>
    </div>
  );
}

function SummaryCard({ label, value, color, icon }: { label: string; value: number; color: string; icon: React.ReactNode }) {
  return (
    <div className="card" style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 18px" }}>
      <div style={{ background: color + "22", borderRadius: 10, padding: 10, color }}>{icon}</div>
      <div>
        <div style={{ fontSize: 22, fontWeight: 700, color: "var(--dark-navy)" }}>{value.toLocaleString()}</div>
        <div style={{ fontSize: 13, color: "#64748b" }}>{label}</div>
      </div>
    </div>
  );
}

function ReportCard({
  title, description, icon, reportKey, activeReport, onToggle, loading, children,
}: {
  title: string; description: string; icon: React.ReactNode; reportKey: ReportKey;
  activeReport: ReportKey; onToggle: (k: ReportKey) => void; loading: boolean; children: React.ReactNode;
}) {
  const isActive = activeReport === reportKey;
  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div
        style={{ padding: "18px 22px", display: "flex", alignItems: "center", gap: 14, cursor: "pointer", borderBottom: isActive ? "1px solid #e2e8f0" : "none" }}
        onClick={() => onToggle(isActive ? null : reportKey)}
      >
        <div style={{ background: "var(--primary-blue)22", borderRadius: 10, padding: 10, color: "var(--primary-blue)", flexShrink: 0 }}>{icon}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 15 }}>{title}</div>
          <div style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>{description}</div>
        </div>
        <button
          className="btn-primary"
          style={{ padding: "8px 18px", fontSize: 13, display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}
          onClick={(e) => { e.stopPropagation(); onToggle(isActive ? null : reportKey); }}
        >
          {loading && isActive ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : isActive ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {isActive ? "סגור דוח" : "הפק דוח"}
        </button>
      </div>
      {isActive && (
        <div style={{ padding: "20px 22px" }}>
          {loading ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#64748b", padding: "20px 0" }}>
              <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} />
              <span>מעבד נתונים...</span>
            </div>
          ) : children}
        </div>
      )}
    </div>
  );
}

export default function ReportsPage() {
  const { voters, groups, groupLeaders, divisionHeads, statuses } = useStore();
  const [activeReport, setActiveReport] = useState<ReportKey>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [expandedLeaders, setExpandedLeaders] = useState<Set<string>>(new Set());

  const handleToggle = (key: ReportKey) => {
    if (key && key !== activeReport) {
      setReportLoading(true);
      setActiveReport(key);
      setTimeout(() => setReportLoading(false), 350);
    } else {
      setActiveReport(key);
      setReportLoading(false);
    }
  };

  // Build status lookup map
  const statusMap = new Map<string, Status>(statuses.map(s => [s.id, s]));

  // Helper: build breakdown for a list of voters
  function buildBreakdown(voterList: Voter[]): { breakdown: StatusBreakdown; total: number; supporters: number; opponents: number; undecided: number } {
    const breakdown: StatusBreakdown = {};
    let supporters = 0, opponents = 0, undecided = 0;
    for (const v of voterList) {
      const status = v.statusId ? statusMap.get(v.statusId) : null;
      const name = status?.name ?? "ללא סטטוס";
      const color = status?.color ?? "#94a3b8";
      if (!breakdown[name]) breakdown[name] = { count: 0, color, category: status ? classifyStatus(status.name) : "other" };
      breakdown[name].count++;
      if (status) {
        const cat = classifyStatus(status.name);
        if (cat === "supporter") supporters++;
        else if (cat === "opponent") opponents++;
        else if (cat === "undecided") undecided++;
      }
    }
    return { breakdown, total: voterList.length, supporters, opponents, undecided };
  }

  // Summary
  const allStats = buildBreakdown(voters);

  // Report 1 — per group leader
  const leaderReport = groupLeaders.map(leader => {
    const leaderGroups = groups.filter(g => g.groupLeaderId === leader.id);
    const leaderVoterIds = new Set(leaderGroups.flatMap(g => g.voterIds));
    const leaderVoters = voters.filter(v => leaderVoterIds.has(v.id));
    const stats = buildBreakdown(leaderVoters);
    const groupStats: GroupStats[] = leaderGroups.map(g => {
      const gVoters = voters.filter(v => g.voterIds.includes(v.id));
      return { group: g, ...buildBreakdown(gVoters) };
    });
    return { leader, stats, groupStats };
  });

  // Report 2 — per group
  const groupReport = groups.map(g => {
    const gVoters = voters.filter(v => g.voterIds.includes(v.id));
    const leader = groupLeaders.find(l => l.id === g.groupLeaderId);
    return { group: g, leader, ...buildBreakdown(gVoters) };
  }).sort((a, b) => b.supporters - a.supporters);

  // Report 3 — per division head
  const divReport = divisionHeads.map(dh => {
    const dhLeaders = groupLeaders.filter(l => l.divisionHeadId === dh.id);
    const dhVoterIds = new Set(
      dhLeaders.flatMap(l => groups.filter(g => g.groupLeaderId === l.id).flatMap(g => g.voterIds))
    );
    const dhVoters = voters.filter(v => dhVoterIds.has(v.id));
    const stats = buildBreakdown(dhVoters);
    const leaderBreakdown = dhLeaders.map(l => {
      const lGroups = groups.filter(g => g.groupLeaderId === l.id);
      const lVoterIds = new Set(lGroups.flatMap(g => g.voterIds));
      const lVoters = voters.filter(v => lVoterIds.has(v.id));
      return { leader: l, ...buildBreakdown(lVoters) };
    });
    return { dh, stats, leaderBreakdown, groupCount: dhLeaders.flatMap(l => groups.filter(g => g.groupLeaderId === l.id)).length };
  });

  // Report 4 — families (by last name)
  const familyMap: Record<string, { voters: Voter[] }> = {};
  voters.forEach(v => {
    const fn = v.lastName || "לא ידוע";
    if (!familyMap[fn]) familyMap[fn] = { voters: [] };
    familyMap[fn].voters.push(v);
  });
  const familyReport = Object.entries(familyMap)
    .map(([name, { voters: fv }]) => {
      const stats = buildBreakdown(fv);
      const mixed = stats.supporters > 0 && stats.opponents > 0;
      return { name, stats, mixed };
    })
    .sort((a, b) => b.stats.total - a.stats.total);

  // Report 5 — geographic (by city)
  const cityMap: Record<string, Voter[]> = {};
  voters.forEach(v => {
    const city = v.address?.city || "לא ידוע";
    if (!cityMap[city]) cityMap[city] = [];
    cityMap[city].push(v);
  });
  const geoReport = Object.entries(cityMap)
    .map(([city, cv]) => ({ city, ...buildBreakdown(cv) }))
    .sort((a, b) => b.total - a.total);

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--dark-navy)", margin: 0 }}>דוחות חכמים</h1>
        <p style={{ color: "#64748b", marginTop: 4, fontSize: 14 }}>לחץ "הפק דוח" לייצור דוח דינמי בזמן אמת</p>
      </div>

      {/* Summary */}
      <div className="resp-grid-4" style={{ marginBottom: 24 }}>
        <SummaryCard label="סך מצביעים" value={allStats.total} color="#3b82f6" icon={<Users size={18} />} />
        <SummaryCard label="תומכים (מזוהים)" value={allStats.supporters} color="#22c55e" icon={<Tag size={18} />} />
        <SummaryCard label="מתנגדים (מזוהים)" value={allStats.opponents} color="#ef4444" icon={<Tag size={18} />} />
        <SummaryCard label="מתלבטים (מזוהים)" value={allStats.undecided} color="#f59e0b" icon={<Tag size={18} />} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

        {/* Report 1 — leaders */}
        <ReportCard title="ניתוח ראשי קבוצה" description="פירוט סטטוסים לכל ראש קבוצה עם drill-down לקבוצות" icon={<Users size={18} />} reportKey="leaders" activeReport={activeReport} onToggle={handleToggle} loading={reportLoading}>
          {leaderReport.length === 0 ? <p style={{ color: "#94a3b8" }}>אין ראשי קבוצה מוגדרים</p> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {leaderReport.map(({ leader, stats, groupStats }) => (
                <div key={leader.id} style={{ border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden" }}>
                  <div
                    style={{ padding: "12px 16px", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}
                    onClick={() => setExpandedLeaders(prev => { const s = new Set(prev); s.has(leader.id) ? s.delete(leader.id) : s.add(leader.id); return s; })}
                  >
                    <div>
                      <div style={{ fontWeight: 600 }}>{leader.firstName} {leader.lastName}</div>
                      <div style={{ fontSize: 12, color: "#64748b" }}>{groupStats.length} קבוצות · {stats.total} בוחרים · <span style={{ color: "#22c55e" }}>{stats.supporters} תומכים</span> · <span style={{ color: "#ef4444" }}>{stats.opponents} מתנגדים</span></div>
                    </div>
                    {expandedLeaders.has(leader.id) ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                  <div style={{ padding: "10px 16px" }}>
                    <StatusBar breakdown={stats.breakdown} total={stats.total} />
                  </div>
                  {expandedLeaders.has(leader.id) && groupStats.map(({ group, breakdown, total, supporters, opponents }) => (
                    <div key={group.id} style={{ padding: "10px 16px", borderTop: "1px solid #f1f5f9", paddingRight: 28 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>{group.name} <span style={{ fontWeight: 400, color: "#94a3b8" }}>({total} בוחרים)</span></div>
                      <StatusBar breakdown={breakdown} total={total} />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </ReportCard>

        {/* Report 2 — groups */}
        <ReportCard title="ניתוח קבוצות" description="פירוט סטטוסים לכל קבוצה, ממוין לפי כמות תומכים" icon={<BarChart3 size={18} />} reportKey="groups" activeReport={activeReport} onToggle={handleToggle} loading={reportLoading}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {groupReport.map(({ group, leader, breakdown, total, supporters, opponents }) => (
              <div key={group.id} style={{ padding: "12px 16px", border: "1px solid #e2e8f0", borderRadius: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{group.name}</div>
                    {leader && <div style={{ fontSize: 12, color: "#64748b" }}>ראש קבוצה: {leader.firstName} {leader.lastName}</div>}
                  </div>
                  <div style={{ fontSize: 13, color: "#64748b", textAlign: "left" }}>
                    {total} בוחרים<br />
                    <span style={{ color: "#22c55e" }}>{supporters} תומכים</span>
                  </div>
                </div>
                <StatusBar breakdown={breakdown} total={total} />
              </div>
            ))}
          </div>
        </ReportCard>

        {/* Report 3 — division heads */}
        <ReportCard title="ניתוח ראשי אגף" description="צבירה לפי ראשי אגפים עם פירוט ראשי קבוצה" icon={<GitMerge size={18} />} reportKey="divisions" activeReport={activeReport} onToggle={handleToggle} loading={reportLoading}>
          {divReport.length === 0 ? <p style={{ color: "#94a3b8" }}>אין ראשי אגף מוגדרים</p> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {divReport.map(({ dh, stats, leaderBreakdown, groupCount }) => (
                <div key={dh.id} style={{ border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden" }}>
                  <div style={{ padding: "12px 16px", background: "#f8fafc" }}>
                    <div style={{ fontWeight: 600 }}>{dh.firstName} {dh.lastName}</div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>{groupCount} קבוצות · {stats.total} בוחרים</div>
                  </div>
                  <div style={{ padding: "10px 16px" }}>
                    <StatusBar breakdown={stats.breakdown} total={stats.total} />
                  </div>
                  {leaderBreakdown.map(({ leader, breakdown, total }) => (
                    <div key={leader.id} style={{ padding: "10px 16px", borderTop: "1px solid #f1f5f9", paddingRight: 28 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>{leader.firstName} {leader.lastName} <span style={{ fontWeight: 400, color: "#94a3b8" }}>({total} בוחרים)</span></div>
                      <StatusBar breakdown={breakdown} total={total} />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </ReportCard>

        {/* Report 4 — families */}
        <ReportCard title="הצלבת משפחות" description="משפחות עם תומכים ומתנגדים גם יחד מסומנות בצהוב" icon={<Users size={18} />} reportKey="families" activeReport={activeReport} onToggle={handleToggle} loading={reportLoading}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {familyReport.slice(0, 60).map(({ name, stats, mixed }) => (
              <div key={name} style={{ padding: "12px 16px", border: `1px solid ${mixed ? "#f59e0b" : "#e2e8f0"}`, borderRadius: 10, background: mixed ? "#fffbeb" : "transparent" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontWeight: 600 }}>
                    {name}
                    {mixed && <span style={{ fontSize: 12, color: "#d97706", marginRight: 8 }}>⚠ משפחה מפוצלת</span>}
                  </div>
                  <span style={{ fontSize: 13, color: "#64748b" }}>{stats.total} נפשות</span>
                </div>
                <StatusBar breakdown={stats.breakdown} total={stats.total} />
              </div>
            ))}
          </div>
        </ReportCard>

        {/* Report 5 — geographic */}
        <ReportCard title="מפת תמיכה גיאוגרפית" description="פירוט תמיכה לפי עיר / יישוב" icon={<MapPin size={18} />} reportKey="geo" activeReport={activeReport} onToggle={handleToggle} loading={reportLoading}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {geoReport.map(({ city, breakdown, total }) => (
              <div key={city} style={{ padding: "12px 16px", border: "1px solid #e2e8f0", borderRadius: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <div style={{ fontWeight: 600 }}>{city}</div>
                  <span style={{ fontSize: 13, color: "#64748b" }}>{total} מצביעים</span>
                </div>
                <StatusBar breakdown={breakdown} total={total} />
              </div>
            ))}
          </div>
        </ReportCard>

      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .resp-grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
        @media (max-width: 768px) { .resp-grid-4 { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 480px) { .resp-grid-4 { grid-template-columns: 1fr; } }
      `}</style>
    </div>
  );
}
