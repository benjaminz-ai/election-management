"use client";
import { useState, useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { BarChart3, Users, ThumbsUp, ThumbsDown, HelpCircle, ChevronDown, ChevronUp, MapPin, GitMerge, Loader2 } from "lucide-react";

type SupportStatus = "תומך" | "מתנגד" | "מתלבט" | "לא ידוע";
type ReportKey = "leaders" | "groups" | "divisions" | "families" | "geo" | null;

interface Voter {
  id: string;
  firstName: string;
  lastName: string;
  city?: string;
  street?: string;
  supportStatus?: SupportStatus;
  groupId?: string;
  familyName?: string;
}

interface Group {
  id: string;
  name: string;
  leaderId?: string;
  divisionHeadId?: string;
}

interface StatusCount {
  supporters: number;
  opponents: number;
  undecided: number;
  unknown: number;
  total: number;
}

function emptyCount(): StatusCount {
  return { supporters: 0, opponents: 0, undecided: 0, unknown: 0, total: 0 };
}

function addVoterToCount(count: StatusCount, status?: SupportStatus) {
  count.total++;
  if (status === "תומך") count.supporters++;
  else if (status === "מתנגד") count.opponents++;
  else if (status === "מתלבט") count.undecided++;
  else count.unknown++;
}

function StackedBar({ count }: { count: StatusCount }) {
  if (count.total === 0) return <div className="stacked-bar-empty">אין נתונים</div>;
  const pct = (n: number) => Math.round((n / count.total) * 100);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}>
      <div style={{ display: "flex", height: 12, borderRadius: 6, overflow: "hidden", width: "100%" }}>
        {count.supporters > 0 && (
          <div style={{ width: `${pct(count.supporters)}%`, background: "#22c55e" }} title={`תומכים: ${count.supporters}`} />
        )}
        {count.opponents > 0 && (
          <div style={{ width: `${pct(count.opponents)}%`, background: "#ef4444" }} title={`מתנגדים: ${count.opponents}`} />
        )}
        {count.undecided > 0 && (
          <div style={{ width: `${pct(count.undecided)}%`, background: "#f59e0b" }} title={`מתלבטים: ${count.undecided}`} />
        )}
        {count.unknown > 0 && (
          <div style={{ width: `${pct(count.unknown)}%`, background: "#94a3b8" }} title={`לא ידוע: ${count.unknown}`} />
        )}
      </div>
      <div style={{ display: "flex", gap: 12, fontSize: 12, color: "#64748b", flexWrap: "wrap" }}>
        <span style={{ color: "#22c55e" }}>✓ {count.supporters} תומכים</span>
        <span style={{ color: "#ef4444" }}>✗ {count.opponents} מתנגדים</span>
        <span style={{ color: "#f59e0b" }}>? {count.undecided} מתלבטים</span>
        {count.unknown > 0 && <span style={{ color: "#94a3b8" }}>— {count.unknown} לא ידוע</span>}
      </div>
    </div>
  );
}

function MetricCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div className="card" style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 20px" }}>
      <div style={{ background: color + "20", borderRadius: 10, padding: 10, color }}>{icon}</div>
      <div>
        <div style={{ fontSize: 24, fontWeight: 700, color: "var(--dark-navy)" }}>{value.toLocaleString()}</div>
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
        style={{ padding: "20px 24px", display: "flex", alignItems: "center", gap: 16, cursor: "pointer", borderBottom: isActive ? "1px solid #e2e8f0" : "none" }}
        onClick={() => onToggle(isActive ? null : reportKey)}
      >
        <div style={{ background: "var(--primary-blue)20", borderRadius: 10, padding: 10, color: "var(--primary-blue)" }}>{icon}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 16 }}>{title}</div>
          <div style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>{description}</div>
        </div>
        <button
          className="btn-primary"
          style={{ padding: "8px 20px", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}
          onClick={(e) => { e.stopPropagation(); onToggle(isActive ? null : reportKey); }}
        >
          {loading && isActive ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : isActive ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {isActive ? "סגור דוח" : "הפק דוח"}
        </button>
      </div>
      {isActive && (
        <div style={{ padding: "20px 24px" }}>
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
  const [voters, setVoters] = useState<Voter[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [users, setUsers] = useState<{ id: string; name: string; role: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportLoading, setReportLoading] = useState(false);
  const [activeReport, setActiveReport] = useState<ReportKey>(null);
  const [expandedLeaders, setExpandedLeaders] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function load() {
      try {
        const [vSnap, gSnap, uSnap] = await Promise.all([
          getDocs(collection(db, "voters")),
          getDocs(collection(db, "groups")),
          getDocs(collection(db, "users")),
        ]);
        setVoters(vSnap.docs.map(d => ({ id: d.id, ...d.data() } as Voter)));
        setGroups(gSnap.docs.map(d => ({ id: d.id, ...d.data() } as Group)));
        setUsers(uSnap.docs.map(d => ({ id: d.id, ...d.data() } as { id: string; name: string; role: string })));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleToggle = (key: ReportKey) => {
    if (key && activeReport !== key) {
      setReportLoading(true);
      setActiveReport(key);
      setTimeout(() => setReportLoading(false), 400);
    } else {
      setActiveReport(key);
      setReportLoading(false);
    }
  };

  // Summary metrics
  const totalVoters = voters.length;
  const totalSupporters = voters.filter(v => v.supportStatus === "תומך").length;
  const totalOpponents = voters.filter(v => v.supportStatus === "מתנגד").length;
  const totalUndecided = voters.filter(v => v.supportStatus === "מתלבט").length;

  // ── Report 1: Per leader ──
  const leaderReport = (() => {
    const leaderGroups: Record<string, { leaderName: string; groups: { group: Group; count: StatusCount }[]; total: StatusCount }> = {};
    const groupLeaders = users.filter(u => u.role === "group_leader" || u.role === "groupLeader");
    groupLeaders.forEach(leader => {
      const myGroups = groups.filter(g => g.leaderId === leader.id);
      const total = emptyCount();
      const groupCounts = myGroups.map(g => {
        const cnt = emptyCount();
        voters.filter(v => v.groupId === g.id).forEach(v => { addVoterToCount(cnt, v.supportStatus); addVoterToCount(total, v.supportStatus); });
        return { group: g, count: cnt };
      });
      leaderGroups[leader.id] = { leaderName: leader.name, groups: groupCounts, total };
    });
    // Also handle voters with groups but no leader
    const ungrouped = emptyCount();
    voters.filter(v => !v.groupId).forEach(v => addVoterToCount(ungrouped, v.supportStatus));
    return { leaderGroups, ungrouped };
  })();

  // ── Report 2: Per group ──
  const groupReport = groups.map(g => {
    const cnt = emptyCount();
    voters.filter(v => v.groupId === g.id).forEach(v => addVoterToCount(cnt, v.supportStatus));
    return { group: g, count: cnt };
  }).sort((a, b) => b.count.supporters - a.count.supporters);

  // ── Report 3: Per division head ──
  const divisionReport = (() => {
    const divHeads = users.filter(u => u.role === "division_head" || u.role === "divisionHead");
    return divHeads.map(dh => {
      const myGroups = groups.filter(g => g.divisionHeadId === dh.id);
      const total = emptyCount();
      const leaderBreakdown: Record<string, { leaderName: string; count: StatusCount }> = {};
      myGroups.forEach(g => {
        voters.filter(v => v.groupId === g.id).forEach(v => {
          addVoterToCount(total, v.supportStatus);
          const leaderId = g.leaderId || "unknown";
          if (!leaderBreakdown[leaderId]) {
            const ln = users.find(u => u.id === leaderId)?.name || "לא משויך";
            leaderBreakdown[leaderId] = { leaderName: ln, count: emptyCount() };
          }
          addVoterToCount(leaderBreakdown[leaderId].count, v.supportStatus);
        });
      });
      return { divHead: dh, total, leaderBreakdown, groupCount: myGroups.length };
    });
  })();

  // ── Report 4: Family cross-reference ──
  const familyReport = (() => {
    const families: Record<string, { name: string; count: StatusCount; mixed: boolean }> = {};
    voters.forEach(v => {
      const fn = v.familyName || v.lastName || "לא ידוע";
      if (!families[fn]) families[fn] = { name: fn, count: emptyCount(), mixed: false };
      addVoterToCount(families[fn].count, v.supportStatus);
    });
    Object.values(families).forEach(f => {
      f.mixed = f.count.supporters > 0 && f.count.opponents > 0;
    });
    return Object.values(families).sort((a, b) => b.count.total - a.count.total);
  })();

  // ── Report 5: Geographic ──
  const geoReport = (() => {
    const cities: Record<string, StatusCount> = {};
    voters.forEach(v => {
      const city = v.city || "לא ידוע";
      if (!cities[city]) cities[city] = emptyCount();
      addVoterToCount(cities[city], v.supportStatus);
    });
    return Object.entries(cities).map(([city, count]) => ({ city, count })).sort((a, b) => b.count.total - a.count.total);
  })();

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300, gap: 12, color: "#64748b" }}>
        <Loader2 size={24} style={{ animation: "spin 1s linear infinite" }} />
        <span>טוען נתונים...</span>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: "var(--dark-navy)", margin: 0 }}>דוחות חכמים</h1>
        <p style={{ color: "#64748b", marginTop: 4, fontSize: 14 }}>לחץ על "הפק דוח" לייצור דוח דינמי בזמן אמת</p>
      </div>

      {/* Summary metrics */}
      <div className="resp-grid-4" style={{ marginBottom: 28 }}>
        <MetricCard icon={<Users size={20} />} label="סך מצביעים" value={totalVoters} color="#3b82f6" />
        <MetricCard icon={<ThumbsUp size={20} />} label="תומכים" value={totalSupporters} color="#22c55e" />
        <MetricCard icon={<ThumbsDown size={20} />} label="מתנגדים" value={totalOpponents} color="#ef4444" />
        <MetricCard icon={<HelpCircle size={20} />} label="מתלבטים" value={totalUndecided} color="#f59e0b" />
      </div>

      {/* Report cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

        {/* Report 1 — Leaders */}
        <ReportCard title="ניתוח ראשי קבוצה" description="תומכים, מתנגדים ומתלבטים לכל ראש קבוצה עם פירוט לפי קבוצות" icon={<Users size={20} />} reportKey="leaders" activeReport={activeReport} onToggle={handleToggle} loading={reportLoading}>
          {Object.entries(leaderReport.leaderGroups).length === 0 ? (
            <p style={{ color: "#94a3b8" }}>אין ראשי קבוצה מוגדרים במערכת</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {Object.entries(leaderReport.leaderGroups).map(([leaderId, data]) => (
                <div key={leaderId} style={{ borderRadius: 10, border: "1px solid #e2e8f0", overflow: "hidden" }}>
                  <div
                    style={{ padding: "14px 18px", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}
                    onClick={() => setExpandedLeaders(prev => { const s = new Set(prev); s.has(leaderId) ? s.delete(leaderId) : s.add(leaderId); return s; })}
                  >
                    <div>
                      <div style={{ fontWeight: 600 }}>{data.leaderName}</div>
                      <div style={{ fontSize: 13, color: "#64748b" }}>{data.groups.length} קבוצות · {data.total.total} מצביעים</div>
                    </div>
                    {expandedLeaders.has(leaderId) ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                  <div style={{ padding: "12px 18px" }}>
                    <StackedBar count={data.total} />
                  </div>
                  {expandedLeaders.has(leaderId) && (
                    <div style={{ padding: "0 18px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
                      {data.groups.map(({ group, count }) => (
                        <div key={group.id} style={{ paddingRight: 12, borderRight: "3px solid #e2e8f0" }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>{group.name}</div>
                          <StackedBar count={count} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </ReportCard>

        {/* Report 2 — Groups */}
        <ReportCard title="ניתוח קבוצות" description="פירוט סטטוסים לכל קבוצה, ממוין לפי כמות תומכים" icon={<BarChart3 size={20} />} reportKey="groups" activeReport={activeReport} onToggle={handleToggle} loading={reportLoading}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {groupReport.map(({ group, count }) => (
              <div key={group.id} style={{ padding: "14px 18px", border: "1px solid #e2e8f0", borderRadius: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontWeight: 600 }}>{group.name}</div>
                  <span style={{ fontSize: 13, color: "#64748b" }}>{count.total} מצביעים</span>
                </div>
                <StackedBar count={count} />
              </div>
            ))}
          </div>
        </ReportCard>

        {/* Report 3 — Division heads */}
        <ReportCard title="ניתוח ראשי אגף" description="צבירה לפי ראשי אגפים עם פירוט ראשי קבוצה" icon={<GitMerge size={20} />} reportKey="divisions" activeReport={activeReport} onToggle={handleToggle} loading={reportLoading}>
          {divisionReport.length === 0 ? (
            <p style={{ color: "#94a3b8" }}>אין ראשי אגף מוגדרים במערכת</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {divisionReport.map(({ divHead, total, leaderBreakdown, groupCount }) => (
                <div key={divHead.id} style={{ border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden" }}>
                  <div style={{ padding: "14px 18px", background: "#f8fafc" }}>
                    <div style={{ fontWeight: 600 }}>{divHead.name}</div>
                    <div style={{ fontSize: 13, color: "#64748b" }}>{groupCount} קבוצות · {total.total} מצביעים</div>
                  </div>
                  <div style={{ padding: "12px 18px" }}>
                    <StackedBar count={total} />
                    {Object.entries(leaderBreakdown).length > 0 && (
                      <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                        {Object.entries(leaderBreakdown).map(([lid, lb]) => (
                          <div key={lid} style={{ paddingRight: 12, borderRight: "3px solid #e2e8f0" }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>{lb.leaderName}</div>
                            <StackedBar count={lb.count} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ReportCard>

        {/* Report 4 — Families */}
        <ReportCard title="הצלבת משפחות" description="משפחות מעורבות (תומכים ומתנגדים באותה משפחה) מסומנות בצהוב" icon={<Users size={20} />} reportKey="families" activeReport={activeReport} onToggle={handleToggle} loading={reportLoading}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {familyReport.slice(0, 50).map(fam => (
              <div key={fam.name} style={{ padding: "12px 16px", border: `1px solid ${fam.mixed ? "#f59e0b" : "#e2e8f0"}`, borderRadius: 10, background: fam.mixed ? "#fffbeb" : "transparent" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontWeight: 600 }}>{fam.name} {fam.mixed && <span style={{ fontSize: 12, color: "#d97706", marginRight: 6 }}>⚠ משפחה מפוצלת</span>}</div>
                  <span style={{ fontSize: 13, color: "#64748b" }}>{fam.count.total} נפשות</span>
                </div>
                <StackedBar count={fam.count} />
              </div>
            ))}
          </div>
        </ReportCard>

        {/* Report 5 — Geographic */}
        <ReportCard title="מפת תמיכה גיאוגרפית" description="פירוט תמיכה לפי עיר/יישוב" icon={<MapPin size={20} />} reportKey="geo" activeReport={activeReport} onToggle={handleToggle} loading={reportLoading}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {geoReport.map(({ city, count }) => (
              <div key={city} style={{ padding: "12px 16px", border: "1px solid #e2e8f0", borderRadius: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontWeight: 600 }}>{city}</div>
                  <span style={{ fontSize: 13, color: "#64748b" }}>{count.total} מצביעים</span>
                </div>
                <StackedBar count={count} />
              </div>
            ))}
          </div>
        </ReportCard>

      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .resp-grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
        @media (max-width: 768px) { .resp-grid-4 { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 480px) { .resp-grid-4 { grid-template-columns: 1fr; } }
      `}</style>
    </div>
  );
}
