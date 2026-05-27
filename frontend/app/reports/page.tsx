"use client";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { BarChart3, Users, ChevronDown, ChevronUp, MapPin, GitMerge, Loader2, Tag } from "lucide-react";
import { Voter, Status } from "@/types";

type ReportKey = "leaders" | "groups" | "divisions" | "families" | "geo" | null;

function classifyStatus(name: string): "supporter" | "opponent" | "undecided" | "other" {
  if (name.includes("תומך") || name.includes("בעד") || name.includes("חיובי")) return "supporter";
  if (name.includes("מתנגד") || name.includes("נגד") || name.includes("שלילי")) return "opponent";
  if (name.includes("מתלבט") || name.includes("ספק") || name.includes("לא יודע") || name.includes("לא החליט")) return "undecided";
  return "other";
}

interface StatusBreakdown {
  [statusName: string]: { count: number; color: string };
}

function StatusBar({ breakdown, total }: { breakdown: StatusBreakdown; total: number }) {
  if (total === 0) return <div style={{ color: "#94a3b8", fontSize: 13, marginTop: 6 }}>אין בוחרים</div>;
  const entries = Object.entries(breakdown).filter(([, v]) => v.count > 0);
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: "flex", height: 10, borderRadius: 6, overflow: "hidden", width: "100%", background: "#f1f5f9" }}>
        {entries.map(([name, { count, color }]) => (
          <div key={name} style={{ width: `${(count / total) * 100}%`, background: color, minWidth: 2 }} title={`${name}: ${count}`} />
        ))}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px", marginTop: 5, fontSize: 12 }}>
        {entries.map(([name, { count, color }]) => (
          <span key={name} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
            <span style={{ color: "#475569" }}>{name}:</span>
            <span style={{ fontWeight: 600, color: "#1e293b" }}>{count}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function SummaryCard({ label, value, color, icon }: { label: string; value: number; color: string; icon: React.ReactNode }) {
  return (
    <div className="card" style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 18px" }}>
      <div style={{ background: color + "22", borderRadius: 10, padding: 10, color, flexShrink: 0 }}>{icon}</div>
      <div>
        <div style={{ fontSize: 22, fontWeight: 700, color: "var(--dark-navy)" }}>{value.toLocaleString()}</div>
        <div style={{ fontSize: 13, color: "#64748b" }}>{label}</div>
      </div>
    </div>
  );
}

function ReportCard({ title, description, icon, reportKey, activeReport, onToggle, loading, children }: {
  title: string; description: string; icon: React.ReactNode; reportKey: ReportKey;
  activeReport: ReportKey; onToggle: (k: ReportKey) => void; loading: boolean; children: React.ReactNode;
}) {
  const isActive = activeReport === reportKey;
  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div
        style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 14, cursor: "pointer", borderBottom: isActive ? "1px solid #e2e8f0" : "none" }}
        onClick={() => onToggle(isActive ? null : reportKey)}
      >
        <div style={{ background: "#209dd722", borderRadius: 10, padding: 10, color: "#209dd7", flexShrink: 0 }}>{icon}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 15 }}>{title}</div>
          <div style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>{description}</div>
        </div>
        <button
          className="btn-primary"
          style={{ padding: "8px 16px", fontSize: 13, display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}
          onClick={(e) => { e.stopPropagation(); onToggle(isActive ? null : reportKey); }}
        >
          {loading && isActive ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : isActive ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {isActive ? "סגור" : "הפק דוח"}
        </button>
      </div>
      {isActive && (
        <div style={{ padding: "18px 20px" }}>
          {loading
            ? <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#64748b", padding: "16px 0" }}><Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} /><span>מעבד...</span></div>
            : children}
        </div>
      )}
    </div>
  );
}

export default function ReportsPage() {
  const { state } = useStore();
  const { voters, groups, groupLeaders, divisionHeads, statuses } = state;

  const [activeReport, setActiveReport] = useState<ReportKey>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [expandedLeaders, setExpandedLeaders] = useState<Set<string>>(new Set());

  const handleToggle = (key: ReportKey) => {
    if (key && key !== activeReport) {
      setReportLoading(true);
      setActiveReport(key);
      setTimeout(() => setReportLoading(false), 300);
    } else {
      setActiveReport(key);
      setReportLoading(false);
    }
  };

  const statusMap = new Map<string, Status>(statuses.map(s => [s.id, s]));

  function buildBreakdown(voterList: Voter[]) {
    const breakdown: StatusBreakdown = {};
    let supporters = 0, opponents = 0, undecided = 0;
    for (const v of voterList) {
      const st = v.statusId ? statusMap.get(v.statusId) : null;
      const name = st?.name ?? "ללא סטטוס";
      const color = st?.color ?? "#94a3b8";
      if (!breakdown[name]) breakdown[name] = { count: 0, color };
      breakdown[name].count++;
      if (st) {
        const cat = classifyStatus(st.name);
        if (cat === "supporter") supporters++;
        else if (cat === "opponent") opponents++;
        else if (cat === "undecided") undecided++;
      }
    }
    return { breakdown, total: voterList.length, supporters, opponents, undecided };
  }

  // Summary stats
  const allStats = buildBreakdown(voters);

  // ── Report 1: per group leader ──
  const leaderReport = groupLeaders.map(leader => {
    const myGroups = groups.filter(g => g.groupLeaderId === leader.id);
    const voterIdSet = new Set(myGroups.flatMap(g => g.voterIds));
    const myVoters = voters.filter(v => voterIdSet.has(v.id));
    const stats = buildBreakdown(myVoters);
    const groupStats = myGroups.map(g => ({
      group: g,
      ...buildBreakdown(voters.filter(v => g.voterIds.includes(v.id))),
    }));
    return { leader, stats, groupStats };
  });

  // ── Report 2: per group ──
  const groupReport = groups.map(g => {
    const leader = groupLeaders.find(l => l.id === g.groupLeaderId);
    return { group: g, leader, ...buildBreakdown(voters.filter(v => g.voterIds.includes(v.id))) };
  }).sort((a, b) => b.supporters - a.supporters);

  // ── Report 3: per division head ──
  const divReport = divisionHeads.map(dh => {
    const myLeaders = groupLeaders.filter(l => l.divisionHeadId === dh.id);
    const voterIdSet = new Set(
      myLeaders.flatMap(l => groups.filter(g => g.groupLeaderId === l.id).flatMap(g => g.voterIds))
    );
    const stats = buildBreakdown(voters.filter(v => voterIdSet.has(v.id)));
    const leaderBreakdown = myLeaders.map(l => {
      const lVoterIds = new Set(groups.filter(g => g.groupLeaderId === l.id).flatMap(g => g.voterIds));
      return { leader: l, ...buildBreakdown(voters.filter(v => lVoterIds.has(v.id))) };
    });
    const groupCount = myLeaders.reduce((sum, l) => sum + groups.filter(g => g.groupLeaderId === l.id).length, 0);
    return { dh, stats, leaderBreakdown, groupCount };
  });

  // ── Report 4: families by address (city + street + streetNumber) ──
  const familyMap: Record<string, { label: string; voters: Voter[]; apartments: Record<string, Voter[]> }> = {};
  voters.forEach(v => {
    const addr = v.address;
    if (!addr?.city || !addr?.street || !addr?.streetNumber) return;
    const key = `${addr.city}__${addr.street}__${addr.streetNumber}`.toLowerCase();
    if (!familyMap[key]) {
      familyMap[key] = {
        label: `${addr.street} ${addr.streetNumber}, ${addr.city}`,
        voters: [],
        apartments: {},
      };
    }
    familyMap[key].voters.push(v);
    // Sub-group by apartment
    if (addr.apartment) {
      const apt = addr.apartment;
      if (!familyMap[key].apartments[apt]) familyMap[key].apartments[apt] = [];
      familyMap[key].apartments[apt].push(v);
    }
  });

  const familyReport = Object.values(familyMap)
    .filter(f => f.voters.length > 1)
    .map(f => {
      const stats = buildBreakdown(f.voters);
      const mixed = stats.supporters > 0 && stats.opponents > 0;
      const aptEntries = Object.entries(f.apartments)
        .filter(([, av]) => av.length > 1)
        .map(([apt, av]) => ({ apt, ...buildBreakdown(av) }));
      return { ...f, stats, mixed, aptEntries };
    })
    .sort((a, b) => b.stats.total - a.stats.total);

  // ── Report 5: geographic ──
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
        <p style={{ color: "#64748b", marginTop: 4, fontSize: 14 }}>לחץ "הפק דוח" לדוח דינמי בזמן אמת</p>
      </div>

      <div className="resp-grid-4" style={{ marginBottom: 24 }}>
        <SummaryCard label="סך מצביעים" value={allStats.total} color="#3b82f6" icon={<Users size={18} />} />
        <SummaryCard label="תומכים" value={allStats.supporters} color="#22c55e" icon={<Tag size={18} />} />
        <SummaryCard label="מתנגדים" value={allStats.opponents} color="#ef4444" icon={<Tag size={18} />} />
        <SummaryCard label="מתלבטים" value={allStats.undecided} color="#f59e0b" icon={<Tag size={18} />} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

        {/* 1 — leaders */}
        <ReportCard title="ניתוח ראשי קבוצה" description="פירוט לכל ראש קבוצה, עם פירוט לפי קבוצות" icon={<Users size={18} />} reportKey="leaders" activeReport={activeReport} onToggle={handleToggle} loading={reportLoading}>
          {leaderReport.length === 0 ? <p style={{ color: "#94a3b8" }}>אין ראשי קבוצה</p> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {leaderReport.map(({ leader, stats, groupStats }) => (
                <div key={leader.id} style={{ border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden" }}>
                  <div style={{ padding: "12px 16px", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}
                    onClick={() => setExpandedLeaders(prev => { const s = new Set(prev); s.has(leader.id) ? s.delete(leader.id) : s.add(leader.id); return s; })}>
                    <div>
                      <span style={{ fontWeight: 600 }}>{leader.firstName} {leader.lastName}</span>
                      <span style={{ fontSize: 12, color: "#64748b", marginRight: 10 }}>{groupStats.length} קבוצות · {stats.total} בוחרים</span>
                    </div>
                    {expandedLeaders.has(leader.id) ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                  </div>
                  <div style={{ padding: "8px 16px 12px" }}><StatusBar breakdown={stats.breakdown} total={stats.total} /></div>
                  {expandedLeaders.has(leader.id) && groupStats.map(({ group, breakdown, total }) => (
                    <div key={group.id} style={{ padding: "8px 16px 12px", borderTop: "1px solid #f1f5f9", paddingRight: 28 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>{group.name}</span>
                      <span style={{ fontSize: 12, color: "#94a3b8", marginRight: 8 }}>{total} בוחרים</span>
                      <StatusBar breakdown={breakdown} total={total} />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </ReportCard>

        {/* 2 — groups */}
        <ReportCard title="ניתוח קבוצות" description="פירוט לכל קבוצה, ממוין לפי כמות תומכים" icon={<BarChart3 size={18} />} reportKey="groups" activeReport={activeReport} onToggle={handleToggle} loading={reportLoading}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {groupReport.map(({ group, leader, breakdown, total }) => (
              <div key={group.id} style={{ padding: "12px 16px", border: "1px solid #e2e8f0", borderRadius: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <div>
                    <span style={{ fontWeight: 600 }}>{group.name}</span>
                    {leader && <span style={{ fontSize: 12, color: "#64748b", marginRight: 8 }}>ר"ק: {leader.firstName} {leader.lastName}</span>}
                  </div>
                  <span style={{ fontSize: 13, color: "#64748b" }}>{total} בוחרים</span>
                </div>
                <StatusBar breakdown={breakdown} total={total} />
              </div>
            ))}
          </div>
        </ReportCard>

        {/* 3 — division heads */}
        <ReportCard title="ניתוח ראשי אגף" description="צבירה לפי ראשי אגפים עם drill-down לראשי קבוצה" icon={<GitMerge size={18} />} reportKey="divisions" activeReport={activeReport} onToggle={handleToggle} loading={reportLoading}>
          {divReport.length === 0 ? <p style={{ color: "#94a3b8" }}>אין ראשי אגף</p> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {divReport.map(({ dh, stats, leaderBreakdown, groupCount }) => (
                <div key={dh.id} style={{ border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden" }}>
                  <div style={{ padding: "12px 16px", background: "#f8fafc" }}>
                    <span style={{ fontWeight: 600 }}>{dh.firstName} {dh.lastName}</span>
                    <span style={{ fontSize: 12, color: "#64748b", marginRight: 8 }}>{groupCount} קבוצות · {stats.total} בוחרים</span>
                  </div>
                  <div style={{ padding: "8px 16px 12px" }}><StatusBar breakdown={stats.breakdown} total={stats.total} /></div>
                  {leaderBreakdown.map(({ leader, breakdown, total }) => (
                    <div key={leader.id} style={{ padding: "8px 16px 12px", borderTop: "1px solid #f1f5f9", paddingRight: 28 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>{leader.firstName} {leader.lastName}</span>
                      <span style={{ fontSize: 12, color: "#94a3b8", marginRight: 8 }}>{total} בוחרים</span>
                      <StatusBar breakdown={breakdown} total={total} />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </ReportCard>

        {/* 4 — families by address */}
        <ReportCard title="הצלבת משפחות" description="קיבוץ לפי כתובת — אותו רחוב + מספר + עיר. משפחות מפוצלות מסומנות בצהוב" icon={<Users size={18} />} reportKey="families" activeReport={activeReport} onToggle={handleToggle} loading={reportLoading}>
          {familyReport.length === 0
            ? <p style={{ color: "#94a3b8" }}>לא נמצאו שתי נפשות באותה כתובת</p>
            : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {familyReport.map((f, i) => (
                  <div key={i} style={{ padding: "12px 16px", border: `1px solid ${f.mixed ? "#f59e0b" : "#e2e8f0"}`, borderRadius: 10, background: f.mixed ? "#fffbeb" : "transparent" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 4 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>
                        {f.label}
                        {f.mixed && <span style={{ fontSize: 12, color: "#d97706", marginRight: 8 }}>⚠ מפוצלת</span>}
                      </div>
                      <span style={{ fontSize: 13, color: "#64748b" }}>{f.stats.total} נפשות</span>
                    </div>
                    <StatusBar breakdown={f.stats.breakdown} total={f.stats.total} />
                    {/* Apartment sub-groups */}
                    {f.aptEntries.map(({ apt, breakdown, total }) => (
                      <div key={apt} style={{ marginTop: 8, paddingRight: 14, borderRight: "3px solid #e2e8f0" }}>
                        <span style={{ fontSize: 12, color: "#64748b" }}>דירה {apt} ({total} נפשות)</span>
                        <StatusBar breakdown={breakdown} total={total} />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
        </ReportCard>

        {/* 5 — geographic */}
        <ReportCard title="מפת תמיכה גיאוגרפית" description="פירוט לפי עיר / יישוב" icon={<MapPin size={18} />} reportKey="geo" activeReport={activeReport} onToggle={handleToggle} loading={reportLoading}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {geoReport.map(({ city, breakdown, total }) => (
              <div key={city} style={{ padding: "12px 16px", border: "1px solid #e2e8f0", borderRadius: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontWeight: 600 }}>{city}</span>
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
        .resp-grid-4 { display: grid; grid-template-columns: repeat(4,1fr); gap: 14px; }
        @media (max-width: 768px) { .resp-grid-4 { grid-template-columns: repeat(2,1fr); } }
        @media (max-width: 480px) { .resp-grid-4 { grid-template-columns: 1fr; } }
      `}</style>
    </div>
  );
}
