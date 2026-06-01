"use client";
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { BarChart3, Users, ChevronDown, ChevronUp, MapPin, GitMerge, Loader2, Tag, Vote, ChevronRight, ChevronLeft, ArrowUpDown, ArrowUp, ArrowDown, PieChart, Target, Megaphone, TrendingUp, AlertTriangle } from "lucide-react";
import { Voter, Status } from "@/types";

type ReportKey = "leaders" | "groups" | "divisions" | "families" | "geo" | "voting" | null;
type SortDir = "asc" | "desc";
type VoterSortKey = "lastName" | "firstName" | "phone" | "city" | "status";

const PAGE_SIZE = 50;

interface StatusBreakdown { [k: string]: { count: number; color: string; category: string }; }
interface Stats { breakdown: StatusBreakdown; total: number; supporters: number; opponents: number; undecided: number; neutral: number; voted: number; }

// ── Sub-components ────────────────────────────────────────────────────────────
function SortBtn({ field, current, dir, onSort }: { field: VoterSortKey; current: VoterSortKey; dir: SortDir; onSort: (f: VoterSortKey) => void }) {
  const active = current === field;
  return (
    <button onClick={() => onSort(field)} style={{ display: "inline-flex", alignItems: "center", gap: 3, background: "none", border: "none", cursor: "pointer", color: active ? "var(--blue-primary)" : "inherit", fontWeight: active ? 700 : 600, fontSize: "inherit", padding: 0 }}>
      {field === "lastName" ? "שם משפחה" : field === "firstName" ? "שם פרטי" : field === "phone" ? "טלפון" : field === "city" ? "עיר" : "סטטוס"}
      {active ? (dir === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} />) : <ArrowUpDown size={11} style={{ opacity: 0.4 }} />}
    </button>
  );
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
            <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: color }} />
            <span style={{ color: "#475569" }}>{name}:</span>
            <span style={{ fontWeight: 600, color: "#1e293b" }}>{count}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function VotingBar({ voted, total }: { voted: number; total: number }) {
  const pct = total > 0 ? Math.round((voted / total) * 100) : 0;
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display: "flex", height: 8, borderRadius: 6, overflow: "hidden", background: "#f1f5f9" }}>
        <div style={{ width: `${pct}%`, background: "#22c55e", transition: "width 0.5s" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 11 }}>
        <span style={{ color: "#16a34a", fontWeight: 600 }}>{voted} הצביעו ({pct}%)</span>
        <span style={{ color: "#94a3b8" }}>{total - voted} לא הצביעו</span>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, color, icon, onClick }: { label: string; value: number; color: string; icon: React.ReactNode; onClick?: () => void }) {
  return (
    <div className="card" onClick={onClick}
      style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", cursor: onClick ? "pointer" : "default", transition: "box-shadow 0.15s, transform 0.15s" }}
      onMouseEnter={(e) => { if (onClick) { e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.10)"; e.currentTarget.style.transform = "translateY(-1px)"; } }}
      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = ""; e.currentTarget.style.transform = ""; }}>
      <div style={{ background: color + "22", borderRadius: 10, padding: 10, color, flexShrink: 0 }}>{icon}</div>
      <div>
        <div style={{ fontSize: 22, fontWeight: 700, color: "var(--dark-navy)" }}>{value.toLocaleString()}</div>
        <div style={{ fontSize: 13, color: "#64748b" }}>{label}</div>
      </div>
    </div>
  );
}

function DonutChart({ segments }: { segments: { label: string; value: number; color: string }[] }) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const r = 66, sw = 24, C = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 22, flexWrap: "wrap" }}>
      <svg width={172} height={172} viewBox="0 0 172 172" role="img" aria-label="פילוח לפי קטגוריה">
        <g transform="rotate(-90 86 86)">
          {total === 0
            ? <circle cx={86} cy={86} r={r} fill="none" stroke="#f1f5f9" strokeWidth={sw} />
            : segments.filter(s => s.value > 0).map((s) => {
                const len = (s.value / total) * C;
                const el = <circle key={s.label} cx={86} cy={86} r={r} fill="none" stroke={s.color} strokeWidth={sw}
                  strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-acc} />;
                acc += len;
                return el;
              })}
        </g>
        <text x={86} y={82} textAnchor="middle" fontSize={28} fontWeight={800} fill="#032147">{total.toLocaleString()}</text>
        <text x={86} y={102} textAnchor="middle" fontSize={12} fill="#64748b">סך הכל</text>
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {segments.map(s => {
          const pct = total > 0 ? Math.round((s.value / total) * 100) : 0;
          return (
            <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
              <span style={{ width: 12, height: 12, borderRadius: 3, background: s.color, flexShrink: 0 }} />
              <span style={{ color: "#475569", minWidth: 78 }}>{s.label}</span>
              <span style={{ fontWeight: 700, color: "#1e293b" }}>{s.value}</span>
              <span style={{ color: "#94a3b8" }}>({pct}%)</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function InsightTile({ icon, color, value, label, hint, onClick }: {
  icon: React.ReactNode; color: string; value: React.ReactNode; label: string; hint: string; onClick?: () => void;
}) {
  return (
    <div onClick={onClick}
      style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: "14px 16px", cursor: onClick ? "pointer" : "default", transition: "box-shadow 0.15s, transform 0.15s" }}
      onMouseEnter={(e) => { if (onClick) { e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.10)"; e.currentTarget.style.transform = "translateY(-1px)"; } }}
      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = ""; e.currentTarget.style.transform = ""; }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 8 }}>
        <span style={{ background: color + "22", color, borderRadius: 8, padding: 7, display: "flex", flexShrink: 0 }}>{icon}</span>
        <span style={{ fontSize: 22, fontWeight: 800, color: "var(--dark-navy)" }}>{value}</span>
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>{label}</div>
      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{hint}</div>
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
      <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", borderBottom: isActive ? "1px solid #e2e8f0" : "none", flexWrap: "wrap" }}
        onClick={() => onToggle(isActive ? null : reportKey)}>
        <div style={{ background: "#209dd722", borderRadius: 10, padding: 10, color: "#209dd7", flexShrink: 0 }}>{icon}</div>
        <div style={{ flex: 1, minWidth: 120 }}>
          <div style={{ fontWeight: 600, fontSize: 15 }}>{title}</div>
          <div style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>{description}</div>
        </div>
        <button className="btn-primary" style={{ padding: "8px 16px", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}
          onClick={(e) => { e.stopPropagation(); onToggle(isActive ? null : reportKey); }}>
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

// ── Voter list table with sort + pagination ───────────────────────────────────
function VoterListTable({ voters, statuses, emptyText }: { voters: Voter[]; statuses: Status[]; emptyText: string }) {
  const statusMap = useMemo(() => new Map(statuses.map(s => [s.id, s])), [statuses]);
  const [sortKey, setSortKey] = useState<VoterSortKey>("lastName");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [page, setPage] = useState(0);

  const handleSort = (key: VoterSortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
    setPage(0);
  };

  const sorted = useMemo(() => {
    return [...voters].sort((a, b) => {
      let va = "", vb = "";
      if (sortKey === "lastName") { va = a.lastName; vb = b.lastName; }
      else if (sortKey === "firstName") { va = a.firstName; vb = b.firstName; }
      else if (sortKey === "phone") { va = a.phone ?? ""; vb = b.phone ?? ""; }
      else if (sortKey === "city") { va = a.address.city; vb = b.address.city; }
      else if (sortKey === "status") { va = statusMap.get(a.statusId ?? "")?.name ?? ""; vb = statusMap.get(b.statusId ?? "")?.name ?? ""; }
      const cmp = va.localeCompare(vb, "he");
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [voters, sortKey, sortDir, statusMap]);

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const pageVoters = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  if (voters.length === 0) return <div style={{ padding: "28px", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>{emptyText}</div>;

  return (
    <div>
      {/* Sort bar */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12, padding: "10px 14px", background: "#f8fafc", borderRadius: 8, fontSize: 13, alignItems: "center" }}>
        <span style={{ color: "#64748b", fontWeight: 600, fontSize: 12 }}>מיון לפי:</span>
        {(["lastName", "firstName", "phone", "city", "status"] as VoterSortKey[]).map(f => (
          <SortBtn key={f} field={f} current={sortKey} dir={sortDir} onSort={handleSort} />
        ))}
        <span style={{ marginRight: "auto", fontSize: 12, color: "#94a3b8" }}>{sorted.length} רשומות</span>
      </div>

      {/* Table */}
      <div style={{ overflowX: "auto", borderRadius: 8, border: "1px solid #e2e8f0" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#f8fafc", borderBottom: "1.5px solid #e2e8f0" }}>
              <th style={thS}>שם</th>
              <th style={thS}>ת.ז.</th>
              <th style={thS}>טלפון</th>
              <th style={thS}>עיר</th>
              <th style={thS}>סטטוס</th>
            </tr>
          </thead>
          <tbody>
            {pageVoters.map(v => {
              const st = statusMap.get(v.statusId ?? "");
              return (
                <tr key={v.id} style={{ borderBottom: "1px solid #f1f5f9" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#f9fafb")}
                  onMouseLeave={e => (e.currentTarget.style.background = "")}>
                  <td style={tdS}>
                    <div style={{ fontWeight: 600 }}>{v.lastName} {v.firstName}</div>
                  </td>
                  <td style={{ ...tdS, fontFamily: "monospace", fontSize: 12, color: "#64748b" }}>{v.uniqueId}</td>
                  <td style={{ ...tdS, direction: "ltr", textAlign: "right" }}>{v.phone ?? "—"}</td>
                  <td style={tdS}>{v.address.city}</td>
                  <td style={tdS}>
                    {st
                      ? <span style={{ background: st.color + "22", color: st.color, borderRadius: 20, padding: "2px 8px", fontSize: 11, fontWeight: 600 }}>{st.name}</span>
                      : <span style={{ color: "#94a3b8", fontSize: 12 }}>—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
          <button onClick={() => setPage(0)} disabled={page === 0}
            style={{ padding: "5px 10px", borderRadius: 7, border: "1.5px solid var(--border)", background: page === 0 ? "#f1f5f9" : "#fff", cursor: page === 0 ? "not-allowed" : "pointer", color: page === 0 ? "#94a3b8" : "var(--text-primary)", fontSize: 12 }}>
            ראשון
          </button>
          <button onClick={() => setPage(p => p - 1)} disabled={page === 0}
            style={{ padding: "5px 10px", borderRadius: 7, border: "1.5px solid var(--border)", background: page === 0 ? "#f1f5f9" : "#fff", cursor: page === 0 ? "not-allowed" : "pointer", display: "flex", alignItems: "center" }}>
            <ChevronRight size={14} />
          </button>

          {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
            let p = i;
            if (totalPages > 7) {
              const start = Math.max(0, Math.min(page - 3, totalPages - 7));
              p = start + i;
            }
            return (
              <button key={p} onClick={() => setPage(p)}
                style={{ width: 32, height: 32, borderRadius: 7, border: "1.5px solid", borderColor: page === p ? "var(--blue-primary)" : "var(--border)", background: page === p ? "var(--blue-primary)" : "#fff", color: page === p ? "#fff" : "var(--text-primary)", fontWeight: page === p ? 700 : 400, fontSize: 13, cursor: "pointer" }}>
                {p + 1}
              </button>
            );
          })}

          <button onClick={() => setPage(p => p + 1)} disabled={page === totalPages - 1}
            style={{ padding: "5px 10px", borderRadius: 7, border: "1.5px solid var(--border)", background: page === totalPages - 1 ? "#f1f5f9" : "#fff", cursor: page === totalPages - 1 ? "not-allowed" : "pointer", display: "flex", alignItems: "center" }}>
            <ChevronLeft size={14} />
          </button>
          <button onClick={() => setPage(totalPages - 1)} disabled={page === totalPages - 1}
            style={{ padding: "5px 10px", borderRadius: 7, border: "1.5px solid var(--border)", background: page === totalPages - 1 ? "#f1f5f9" : "#fff", cursor: page === totalPages - 1 ? "not-allowed" : "pointer", color: page === totalPages - 1 ? "#94a3b8" : "var(--text-primary)", fontSize: 12 }}>
            אחרון
          </button>
          <span style={{ fontSize: 12, color: "#64748b" }}>
            עמוד {page + 1} מתוך {totalPages} · {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, sorted.length)} מתוך {sorted.length}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ReportsPage() {
  const router = useRouter();
  const { state } = useStore();
  const { voters, groups, groupLeaders, divisionHeads, statuses } = state;

  const goToSearch = (params: Record<string, string>) => {
    const qs = new URLSearchParams(params).toString();
    router.push(`/search?${qs}`);
  };

  const [activeReport, setActiveReport] = useState<ReportKey>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [expandedLeaders, setExpandedLeaders] = useState<Set<string>>(new Set());
  const [votingTab, setVotingTab] = useState<"voted" | "not_voted">("voted");

  // Auto-open from query param
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const open = params.get("open") as ReportKey;
      if (open) { setActiveReport(open); }
    } catch {}
  }, []);

  const handleToggle = (key: ReportKey) => {
    if (key && key !== activeReport) { setReportLoading(true); setActiveReport(key); setTimeout(() => setReportLoading(false), 300); }
    else { setActiveReport(key); setReportLoading(false); }
  };

  const statusMap = new Map<string, Status>(statuses.map(s => [s.id, s]));

  function buildStats(voterList: Voter[]): Stats {
    const breakdown: StatusBreakdown = {};
    let supporters = 0, opponents = 0, undecided = 0, neutral = 0, voted = 0;
    for (const v of voterList) {
      const st = v.statusId ? statusMap.get(v.statusId) : null;
      const name = st?.name ?? "ללא סטטוס";
      const color = st?.color ?? "#94a3b8";
      const cat = st?.category ?? "neutral";
      if (!breakdown[name]) breakdown[name] = { count: 0, color, category: cat };
      breakdown[name].count++;
      if (cat === "supporter") supporters++;
      else if (cat === "opponent") opponents++;
      else if (cat === "undecided") undecided++;
      else neutral++;
      if (v.hasVoted) voted++;
    }
    return { breakdown, total: voterList.length, supporters, opponents, undecided, neutral, voted };
  }

  const allStats = buildStats(voters);
  const totalVoted = voters.filter(v => v.hasVoted).length;
  const votingPct = voters.length > 0 ? Math.round((totalVoted / voters.length) * 100) : 0;

  // ── Election-success insights ────────────────────────────────
  const catOf = (v: Voter) => statusMap.get(v.statusId ?? "")?.category ?? "neutral";
  const supportersNotVoted = voters.filter(v => catOf(v) === "supporter" && !v.hasVoted).length;
  const supportersVoted = allStats.supporters - supportersNotVoted;
  const supporterTurnoutPct = allStats.supporters > 0 ? Math.round((supportersVoted / allStats.supporters) * 100) : 0;

  const votedVoters = useMemo(() => voters.filter(v => v.hasVoted), [voters]);
  const notVotedVoters = useMemo(() => voters.filter(v => !v.hasVoted), [voters]);

  // Report data
  const leaderReport = groupLeaders.map(leader => {
    const myGroups = groups.filter(g => g.groupLeaderId === leader.id);
    const voterSet = new Set(myGroups.flatMap(g => g.voterIds));
    const stats = buildStats(voters.filter(v => voterSet.has(v.id)));
    const groupStats = myGroups.map(g => ({ group: g, ...buildStats(voters.filter(v => g.voterIds.includes(v.id))) }));
    return { leader, stats, groupStats };
  });

  const groupReport = groups.map(g => {
    const leader = groupLeaders.find(l => l.id === g.groupLeaderId);
    return { group: g, leader, ...buildStats(voters.filter(v => g.voterIds.includes(v.id))) };
  }).sort((a, b) => b.supporters - a.supporters);

  const divReport = divisionHeads.map(dh => {
    const myLeaders = groupLeaders.filter(l => l.divisionHeadId === dh.id);
    const voterSet = new Set(myLeaders.flatMap(l => groups.filter(g => g.groupLeaderId === l.id).flatMap(g => g.voterIds)));
    const stats = buildStats(voters.filter(v => voterSet.has(v.id)));
    const leaderBreakdown = myLeaders.map(l => {
      const lSet = new Set(groups.filter(g => g.groupLeaderId === l.id).flatMap(g => g.voterIds));
      return { leader: l, ...buildStats(voters.filter(v => lSet.has(v.id))) };
    });
    const groupCount = myLeaders.reduce((s, l) => s + groups.filter(g => g.groupLeaderId === l.id).length, 0);
    return { dh, stats, leaderBreakdown, groupCount };
  });

  const familyMap: Record<string, { label: string; voters: Voter[]; apartments: Record<string, Voter[]> }> = {};
  voters.forEach(v => {
    const addr = v.address;
    if (!addr?.city || !addr?.street || !addr?.streetNumber) return;
    const key = `${addr.city}__${addr.street}__${addr.streetNumber}`.toLowerCase();
    if (!familyMap[key]) familyMap[key] = { label: `${addr.street} ${addr.streetNumber}, ${addr.city}`, voters: [], apartments: {} };
    familyMap[key].voters.push(v);
    if (addr.apartment) { if (!familyMap[key].apartments[addr.apartment]) familyMap[key].apartments[addr.apartment] = []; familyMap[key].apartments[addr.apartment].push(v); }
  });
  const familyReport = Object.values(familyMap).filter(f => f.voters.length > 1).map(f => {
    const stats = buildStats(f.voters);
    const mixed = stats.supporters > 0 && stats.opponents > 0;
    const aptEntries = Object.entries(f.apartments).filter(([, av]) => av.length > 1).map(([apt, av]) => ({ apt, ...buildStats(av) }));
    return { ...f, stats, mixed, aptEntries };
  }).sort((a, b) => b.stats.total - a.stats.total);

  const cityMap: Record<string, Voter[]> = {};
  voters.forEach(v => { const city = v.address?.city || "לא ידוע"; if (!cityMap[city]) cityMap[city] = []; cityMap[city].push(v); });
  const geoReport = Object.entries(cityMap).map(([city, cv]) => ({ city, ...buildStats(cv) })).sort((a, b) => b.total - a.total);

  const votingByGroup = groups.map(g => {
    const gVoters = voters.filter(v => g.voterIds.includes(v.id));
    const voted = gVoters.filter(v => v.hasVoted).length;
    const leader = groupLeaders.find(l => l.id === g.groupLeaderId);
    return { group: g, leader, total: gVoters.length, voted };
  }).filter(r => r.total > 0).sort((a, b) => (b.voted / b.total) - (a.voted / a.total));

  const votingByCity = Object.entries(cityMap).map(([city, cv]) => ({
    city, total: cv.length, voted: cv.filter(v => v.hasVoted).length
  })).filter(r => r.total > 0).sort((a, b) => (b.voted / b.total) - (a.voted / a.total));

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--dark-navy)", margin: 0 }}>דוחות חכמים</h1>
        <p style={{ color: "#64748b", marginTop: 4, fontSize: 14 }}>לחץ "הפק דוח" לדוח דינמי בזמן אמת</p>
      </div>

      {/* Summary — click a category to view those voters in search */}
      <div className="resp-grid-6" style={{ marginBottom: 24 }}>
        <SummaryCard label="סך מצביעים" value={allStats.total} color="#3b82f6" icon={<Users size={18} />} />
        <SummaryCard label="תומכים" value={allStats.supporters} color="#22c55e" icon={<Tag size={18} />}
          onClick={() => goToSearch({ category: "supporter" })} />
        <SummaryCard label="מתנגדים" value={allStats.opponents} color="#ef4444" icon={<Tag size={18} />}
          onClick={() => goToSearch({ category: "opponent" })} />
        <SummaryCard label="מתלבטים" value={allStats.undecided} color="#f59e0b" icon={<Tag size={18} />}
          onClick={() => goToSearch({ category: "undecided" })} />
        <SummaryCard label="לא רלוונטי" value={allStats.neutral} color="#94a3b8" icon={<Tag size={18} />}
          onClick={() => goToSearch({ category: "neutral" })} />
        <div className="card" onClick={() => goToSearch({ voted: "yes" })}
          style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", cursor: "pointer", transition: "box-shadow 0.15s, transform 0.15s" }}
          onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.10)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.boxShadow = ""; e.currentTarget.style.transform = ""; }}>
          <div style={{ background: "#22c55e22", borderRadius: 10, padding: 10, color: "#22c55e", flexShrink: 0 }}><Vote size={18} /></div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: "var(--dark-navy)" }}>{totalVoted} <span style={{ fontSize: 13, color: "#64748b", fontWeight: 400 }}>/ {allStats.total}</span></div>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>הצביעו ({votingPct}%)</div>
            <div style={{ height: 6, borderRadius: 3, background: "#f1f5f9", overflow: "hidden" }}>
              <div style={{ width: `${votingPct}%`, height: "100%", background: "#22c55e" }} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Pie chart + success insights ─────────────────────────────────── */}
      <div className="card" style={{ padding: 20, marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
          <PieChart size={18} color="#209dd7" />
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--dark-navy)", margin: 0 }}>תמונת מצב ונושאים להצלחה בבחירות</h2>
        </div>
        <div className="insights-grid" style={{ display: "grid", gridTemplateColumns: "minmax(260px, 340px) 1fr", gap: 28, alignItems: "start" }}>
          {/* Donut */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#475569", marginBottom: 14 }}>פילוח לפי קטגוריה</div>
            <DonutChart segments={[
              { label: "תומכים", value: allStats.supporters, color: "#22c55e" },
              { label: "מתנגדים", value: allStats.opponents, color: "#ef4444" },
              { label: "מתלבטים", value: allStats.undecided, color: "#f59e0b" },
              { label: "לא רלוונטי", value: allStats.neutral, color: "#94a3b8" },
            ]} />
          </div>
          {/* Actionable insights */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#475569", marginBottom: 14 }}>נושאים לפעולה — לחץ למעבר לרשימה</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(185px, 1fr))", gap: 12 }}>
              <InsightTile icon={<Megaphone size={16} />} color="#16a34a" value={supportersNotVoted}
                label="תומכים שטרם הצביעו" hint="המוקד לגיוס ביום הבחירות"
                onClick={() => goToSearch({ category: "supporter", voted: "no" })} />
              <InsightTile icon={<Target size={16} />} color="#f59e0b" value={allStats.undecided}
                label="מתלבטים" hint="פוטנציאל המרה — לשכנע"
                onClick={() => goToSearch({ category: "undecided" })} />
              <InsightTile icon={<TrendingUp size={16} />} color="#3b82f6" value={`${supporterTurnoutPct}%`}
                label="שיעור גיוס תומכים" hint={`${supportersVoted} מתוך ${allStats.supporters} הצביעו`} />
              <InsightTile icon={<AlertTriangle size={16} />} color="#d97706" value={familyReport.filter(f => f.mixed).length}
                label="בתים מפוצלים" hint="מחלוקת בתוך המשפחה"
                onClick={() => handleToggle("families")} />
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

        {/* ── Voting rates ───────────────────────────────────────────────── */}
        <ReportCard title="שיעורי הצבעה" description={`${totalVoted} הצביעו מתוך ${allStats.total} · רשימה מלאה עם מיון ועימוד`} icon={<Vote size={18} />} reportKey="voting" activeReport={activeReport} onToggle={handleToggle} loading={reportLoading}>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* Overall bar */}
            <div style={{ padding: "16px 18px", background: "#f0fdf4", borderRadius: 12, border: "1.5px solid #86efac" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={{ fontWeight: 700, fontSize: 15, color: "#166534" }}>סה"כ</span>
                <span style={{ fontSize: 24, fontWeight: 800, color: "#16a34a" }}>{votingPct}%</span>
              </div>
              <VotingBar voted={totalVoted} total={allStats.total} />
            </div>

            {/* By group */}
            {votingByGroup.length > 0 && (
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: "#475569", marginBottom: 10 }}>לפי קבוצה</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {votingByGroup.map(({ group, leader, total, voted }) => {
                    const pct = total > 0 ? Math.round((voted / total) * 100) : 0;
                    return (
                      <div key={group.id} style={{ padding: "10px 14px", border: "1px solid #e2e8f0", borderRadius: 10 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                          <div>
                            <span style={{ fontWeight: 600, fontSize: 13 }}>{group.name}</span>
                            {leader && <span style={{ fontSize: 11, color: "#94a3b8", marginRight: 8 }}>ר"ק: {leader.firstName} {leader.lastName}</span>}
                          </div>
                          <span style={{ fontWeight: 700, fontSize: 14, color: pct >= 50 ? "#16a34a" : pct >= 25 ? "#d97706" : "#dc2626" }}>{pct}%</span>
                        </div>
                        <VotingBar voted={voted} total={total} />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* By city */}
            {votingByCity.length > 0 && (
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: "#475569", marginBottom: 10 }}>לפי עיר</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {votingByCity.map(({ city, total, voted }) => {
                    const pct = total > 0 ? Math.round((voted / total) * 100) : 0;
                    return (
                      <div key={city} style={{ padding: "10px 14px", border: "1px solid #e2e8f0", borderRadius: 10 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                          <span style={{ fontWeight: 600, fontSize: 13 }}>{city}</span>
                          <span style={{ fontWeight: 700, fontSize: 14, color: pct >= 50 ? "#16a34a" : pct >= 25 ? "#d97706" : "#dc2626" }}>{pct}%</span>
                        </div>
                        <VotingBar voted={voted} total={total} />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Voter list tabs */}
            <div>
              <div style={{ display: "flex", gap: 0, marginBottom: 14, borderBottom: "1.5px solid #e2e8f0" }}>
                {([["voted", `✓ הצביעו (${votedVoters.length})`, "#16a34a"], ["not_voted", `✗ לא הצביעו (${notVotedVoters.length})`, "#dc2626"]] as const).map(([tab, label, color]) => (
                  <button key={tab} onClick={() => setVotingTab(tab)}
                    style={{ padding: "9px 20px", fontSize: 13, fontWeight: 600, background: "none", border: "none", borderBottom: votingTab === tab ? `2.5px solid ${color}` : "2.5px solid transparent", color: votingTab === tab ? color : "#64748b", cursor: "pointer", marginBottom: -1.5 }}>
                    {label}
                  </button>
                ))}
              </div>
              <VoterListTable
                voters={votingTab === "voted" ? votedVoters : notVotedVoters}
                statuses={statuses}
                emptyText={votingTab === "voted" ? "טרם תועדו הצבעות" : "כל הבוחרים הצביעו!"}
              />
            </div>
          </div>
        </ReportCard>

        {/* ── Leaders ────────────────────────────────────────────────────── */}
        <ReportCard title="ניתוח ראשי קבוצה" description="פירוט לכל ראש קבוצה עם drill-down לקבוצות" icon={<Users size={18} />} reportKey="leaders" activeReport={activeReport} onToggle={handleToggle} loading={reportLoading}>
          {leaderReport.length === 0 ? <p style={{ color: "#94a3b8" }}>אין ראשי קבוצה</p> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {leaderReport.map(({ leader, stats, groupStats }) => (
                <div key={leader.id} style={{ border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden" }}>
                  <div style={{ padding: "12px 16px", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", flexWrap: "wrap", gap: 8 }}
                    onClick={() => setExpandedLeaders(prev => { const s = new Set(prev); s.has(leader.id) ? s.delete(leader.id) : s.add(leader.id); return s; })}>
                    <div>
                      <span style={{ fontWeight: 600 }}>{leader.firstName} {leader.lastName}</span>
                      <span style={{ fontSize: 12, color: "#64748b", marginRight: 8 }}>{groupStats.length} קבוצות · {stats.total} בוחרים · </span>
                      <span style={{ fontSize: 12, color: "#22c55e" }}>{stats.supporters} תומכים</span>
                      <span style={{ fontSize: 12, color: "#94a3b8" }}> · </span>
                      <span style={{ fontSize: 12, color: "#ef4444" }}>{stats.opponents} מתנגדים</span>
                      {stats.voted > 0 && <span style={{ fontSize: 12, color: "#16a34a", marginRight: 8 }}> · ✓ {stats.voted} הצביעו</span>}
                    </div>
                    {expandedLeaders.has(leader.id) ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                  </div>
                  <div style={{ padding: "8px 16px 12px" }}><StatusBar breakdown={stats.breakdown} total={stats.total} /></div>
                  {expandedLeaders.has(leader.id) && groupStats.map(({ group, breakdown, total, supporters, opponents, voted }) => (
                    <div key={group.id} style={{ padding: "8px 16px 12px", borderTop: "1px solid #f1f5f9", paddingRight: 28 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>{group.name}</span>
                      <span style={{ fontSize: 12, color: "#94a3b8", marginRight: 8 }}>
                        {total} · <span style={{ color: "#22c55e" }}>{supporters}✓</span> <span style={{ color: "#ef4444" }}>{opponents}✗</span>
                        {voted > 0 && <span style={{ color: "#16a34a" }}> · {voted} הצביעו</span>}
                      </span>
                      <StatusBar breakdown={breakdown} total={total} />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </ReportCard>

        {/* ── Groups ─────────────────────────────────────────────────────── */}
        <ReportCard title="ניתוח קבוצות" description="פירוט לכל קבוצה, ממוין לפי תומכים" icon={<BarChart3 size={18} />} reportKey="groups" activeReport={activeReport} onToggle={handleToggle} loading={reportLoading}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {groupReport.map(({ group, leader, breakdown, total, supporters, opponents, voted }) => (
              <div key={group.id} style={{ padding: "12px 16px", border: "1px solid #e2e8f0", borderRadius: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 4 }}>
                  <div>
                    <span style={{ fontWeight: 600 }}>{group.name}</span>
                    {leader && <span style={{ fontSize: 12, color: "#64748b", marginRight: 8 }}>ר"ק: {leader.firstName} {leader.lastName}</span>}
                  </div>
                  <span style={{ fontSize: 13, color: "#64748b" }}>
                    {total} · <span style={{ color: "#22c55e" }}>{supporters}✓</span> <span style={{ color: "#ef4444" }}>{opponents}✗</span>
                    {voted > 0 && <span style={{ color: "#16a34a" }}> · {voted} הצביעו</span>}
                  </span>
                </div>
                <StatusBar breakdown={breakdown} total={total} />
              </div>
            ))}
          </div>
        </ReportCard>

        {/* ── Divisions ──────────────────────────────────────────────────── */}
        <ReportCard title="ניתוח ראשי אגף" description="צבירה לפי ראשי אגפים עם פירוט ראשי קבוצה" icon={<GitMerge size={18} />} reportKey="divisions" activeReport={activeReport} onToggle={handleToggle} loading={reportLoading}>
          {divReport.length === 0 ? <p style={{ color: "#94a3b8" }}>אין ראשי אגף</p> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {divReport.map(({ dh, stats, leaderBreakdown, groupCount }) => (
                <div key={dh.id} style={{ border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden" }}>
                  <div style={{ padding: "12px 16px", background: "#f8fafc" }}>
                    <span style={{ fontWeight: 600 }}>{dh.firstName} {dh.lastName}</span>
                    <span style={{ fontSize: 12, color: "#64748b", marginRight: 8 }}>{groupCount} קבוצות · {stats.total} בוחרים · <span style={{ color: "#22c55e" }}>{stats.supporters} תומכים</span></span>
                    {stats.voted > 0 && <span style={{ fontSize: 12, color: "#16a34a" }}> · {stats.voted} הצביעו</span>}
                  </div>
                  <div style={{ padding: "8px 16px 12px" }}><StatusBar breakdown={stats.breakdown} total={stats.total} /></div>
                  {leaderBreakdown.map(({ leader, breakdown, total, supporters, voted }) => (
                    <div key={leader.id} style={{ padding: "8px 16px 12px", borderTop: "1px solid #f1f5f9", paddingRight: 28 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>{leader.firstName} {leader.lastName}</span>
                      <span style={{ fontSize: 12, color: "#94a3b8", marginRight: 8 }}>
                        {total} · <span style={{ color: "#22c55e" }}>{supporters}✓</span>
                        {voted > 0 && <span style={{ color: "#16a34a" }}> · {voted} הצביעו</span>}
                      </span>
                      <StatusBar breakdown={breakdown} total={total} />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </ReportCard>

        {/* ── Families ───────────────────────────────────────────────────── */}
        <ReportCard title="הצלבת משפחות" description="קיבוץ לפי כתובת: עיר + רחוב + מספר" icon={<Users size={18} />} reportKey="families" activeReport={activeReport} onToggle={handleToggle} loading={reportLoading}>
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
                      <span style={{ fontSize: 13, color: "#64748b" }}>
                        {f.stats.total} נפשות · <span style={{ color: "#22c55e" }}>{f.stats.supporters}✓</span> <span style={{ color: "#ef4444" }}>{f.stats.opponents}✗</span>
                        {f.stats.voted > 0 && <span style={{ color: "#16a34a" }}> · {f.stats.voted} הצביעו</span>}
                      </span>
                    </div>
                    <StatusBar breakdown={f.stats.breakdown} total={f.stats.total} />
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

        {/* ── Geographic ─────────────────────────────────────────────────── */}
        <ReportCard title="מפת תמיכה גיאוגרפית" description="פירוט לפי עיר / יישוב" icon={<MapPin size={18} />} reportKey="geo" activeReport={activeReport} onToggle={handleToggle} loading={reportLoading}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {geoReport.map(({ city, breakdown, total, supporters, opponents, voted }) => (
              <div key={city} style={{ padding: "12px 16px", border: "1px solid #e2e8f0", borderRadius: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 4 }}>
                  <span style={{ fontWeight: 600 }}>{city}</span>
                  <span style={{ fontSize: 13, color: "#64748b" }}>
                    {total} · <span style={{ color: "#22c55e" }}>{supporters}✓</span> <span style={{ color: "#ef4444" }}>{opponents}✗</span>
                    {voted > 0 && <span style={{ color: "#16a34a" }}> · {voted} הצביעו</span>}
                  </span>
                </div>
                <StatusBar breakdown={breakdown} total={total} />
              </div>
            ))}
          </div>
        </ReportCard>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .resp-grid-6 { display: grid; grid-template-columns: repeat(6,1fr); gap: 14px; }
        @media (max-width: 1280px) { .resp-grid-6 { grid-template-columns: repeat(3,1fr); } }
        @media (max-width: 768px) { .resp-grid-6 { grid-template-columns: repeat(2,1fr); } }
        @media (max-width: 480px) { .resp-grid-6 { grid-template-columns: 1fr; } }
        @media (max-width: 860px) { .insights-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </div>
  );
}

const thS: React.CSSProperties = { padding: "10px 14px", textAlign: "right", fontSize: 11, fontWeight: 700, color: "var(--gray-text)", textTransform: "uppercase", letterSpacing: "0.04em" };
const tdS: React.CSSProperties = { padding: "10px 14px", verticalAlign: "middle" };
