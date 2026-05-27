"use client";

import { useState, useMemo } from "react";
import { useStore } from "@/lib/store";
import { formatAddress } from "@/lib/utils";
import PageHeader from "@/components/ui/PageHeader";
import { Search, MapPin, UserCheck, UsersRound, X, Hash, User, Building2, Vote } from "lucide-react";
import { usePagination } from "@/hooks/usePagination";
import ScrollSentinel from "@/components/ui/ScrollSentinel";
import PaginationFooter from "@/components/ui/PaginationFooter";

type SearchMode = "lastName" | "groupLeader" | "street" | "streetAndNumber";
type VotedFilter = "" | "yes" | "no";

const MODES: { key: SearchMode; label: string; icon: React.ReactNode; placeholder: string }[] = [
  { key: "lastName",        label: "שם משפחה",    icon: <User size={14} />,      placeholder: "הכנס שם משפחה..." },
  { key: "groupLeader",     label: "ראש קבוצה",    icon: <UserCheck size={14} />, placeholder: "הכנס שם ראש קבוצה..." },
  { key: "street",          label: "רחוב",         icon: <MapPin size={14} />,    placeholder: "הכנס שם רחוב..." },
  { key: "streetAndNumber", label: "רחוב + מספר",  icon: <Hash size={14} />,      placeholder: "לדוגמה: הרצל 12" },
];

export default function SearchPage() {
  const { state } = useStore();
  const { voters, groups, groupLeaders, statuses } = state;

  const [mode, setMode] = useState<SearchMode>("lastName");
  const [query, setQuery] = useState("");
  const [filterVoted, setFilterVoted] = useState<VotedFilter>("");

  const baseResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    switch (mode) {
      case "lastName":
        return voters.filter((v) => v.lastName.toLowerCase().includes(q));
      case "street":
        return voters.filter((v) => v.address.street.toLowerCase().includes(q));
      case "streetAndNumber":
        return voters.filter((v) => `${v.address.street} ${v.address.streetNumber}`.toLowerCase().includes(q));
      case "groupLeader": {
        const matched = groupLeaders.filter((gl) => `${gl.firstName} ${gl.lastName}`.toLowerCase().includes(q));
        const leaderGroupIds = matched.flatMap((gl) => gl.groupIds);
        return voters.filter((v) => v.groupIds.some((gid) => leaderGroupIds.includes(gid)));
      }
      default: return [];
    }
  }, [query, mode, voters, groupLeaders]);

  const results = useMemo(() => {
    if (!filterVoted) return baseResults;
    return baseResults.filter(v => filterVoted === "yes" ? v.hasVoted : !v.hasVoted);
  }, [baseResults, filterVoted]);

  const getVoterLeader = (voter: typeof voters[0]) => {
    for (const gl of groupLeaders) {
      if (voter.groupIds.some((gid) => gl.groupIds.includes(gid))) return gl;
    }
    return null;
  };
  const getVoterGroups = (voter: typeof voters[0]) => groups.filter((g) => voter.groupIds.includes(g.id));
  const { visible: visibleResults, hasMore, loadMore, showing } = usePagination(results);

  const visibleGroupedResults = useMemo(() => {
    if (mode !== "streetAndNumber" || !query.trim()) return null;
    const byBuilding: Record<string, typeof voters> = {};
    for (const v of visibleResults) {
      const key = `${v.address.street} ${v.address.streetNumber}${v.address.building ? " בניין " + v.address.building : ""}`;
      if (!byBuilding[key]) byBuilding[key] = [];
      byBuilding[key].push(v);
    }
    return byBuilding;
  }, [visibleResults, mode, query]);

  const currentMode = MODES.find((m) => m.key === mode)!;
  const votedInResults = baseResults.filter(v => v.hasVoted).length;

  return (
    <div>
      <PageHeader title="חיפוש" subtitle="חפש בוחרים לפי פרמטרים שונים" />

      {/* Search panel */}
      <div className="card" style={{ padding: 20, marginBottom: 20 }}>
        {/* Mode tabs */}
        <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
          {MODES.map((m) => (
            <button key={m.key} onClick={() => { setMode(m.key); setQuery(""); setFilterVoted(""); }}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", border: "1.5px solid", borderColor: mode === m.key ? "var(--blue-primary)" : "var(--border)", background: mode === m.key ? "rgba(32,157,215,0.08)" : "#fff", color: mode === m.key ? "var(--blue-primary)" : "var(--text-secondary)", transition: "all 0.15s" }}>
              {m.icon}{m.label}
            </button>
          ))}
        </div>

        {/* Search input */}
        <div className="search-wrap" style={{ fontSize: 15, marginBottom: baseResults.length > 0 ? 12 : 0 }}>
          <Search size={16} color="var(--gray-text)" />
          <input className="input" autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder={currentMode.placeholder}
            style={{ border: "none", boxShadow: "none", padding: 0, background: "transparent", flex: 1, fontSize: 15 }} />
          {query && (
            <button onClick={() => { setQuery(""); setFilterVoted(""); }}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--gray-text)", display: "flex", padding: 0 }}>
              <X size={15} />
            </button>
          )}
        </div>

        {/* Voted filter — show only when there are results */}
        {baseResults.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
            <Vote size={13} color="var(--gray-text)" />
            <span style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 600 }}>סנן לפי הצבעה:</span>
            {(["", "yes", "no"] as VotedFilter[]).map((opt) => (
              <button key={opt} onClick={() => setFilterVoted(opt)}
                style={{ padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer", border: `1.5px solid ${filterVoted === opt ? (opt === "yes" ? "#22c55e" : opt === "no" ? "#ef4444" : "var(--blue-primary)") : "var(--border)"}`, background: filterVoted === opt ? (opt === "yes" ? "#f0fdf4" : opt === "no" ? "#fef2f2" : "rgba(32,157,215,0.08)") : "#fff", color: filterVoted === opt ? (opt === "yes" ? "#16a34a" : opt === "no" ? "#dc2626" : "var(--blue-primary)") : "var(--text-muted)", transition: "all 0.15s" }}>
                {opt === "" ? "הכל" : opt === "yes" ? `✓ הצביע (${votedInResults})` : `✗ לא הצביע (${baseResults.length - votedInResults})`}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Results count */}
      {query.trim() && (
        <div style={{ marginBottom: 14, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            נמצאו <strong style={{ color: "var(--navy)" }}>{results.length}</strong> בוחרים
            {filterVoted && baseResults.length !== results.length && (
              <span style={{ color: "var(--gray-text)" }}> (מסוננים מתוך {baseResults.length})</span>
            )}
          </span>
          {results.length > 0 && (
            <span style={{ fontSize: 12, padding: "3px 10px", borderRadius: 20, background: "rgba(32,157,215,0.1)", color: "var(--blue-primary)", fontWeight: 600 }}>
              {currentMode.label}
            </span>
          )}
          {filterVoted && (
            <span style={{ fontSize: 12, padding: "3px 10px", borderRadius: 20, background: filterVoted === "yes" ? "#f0fdf4" : "#fef2f2", color: filterVoted === "yes" ? "#16a34a" : "#dc2626", fontWeight: 600 }}>
              {filterVoted === "yes" ? "✓ הצביע" : "✗ לא הצביע"}
            </span>
          )}
        </div>
      )}

      {/* Empty search state */}
      {!query.trim() && (
        <div className="empty-state" style={{ marginTop: 40 }}>
          <div className="empty-state-icon"><Search size={28} color="var(--blue-primary)" /></div>
          <h3 style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 700, color: "var(--navy)" }}>חפש בוחרים</h3>
          <p style={{ margin: 0, color: "var(--gray-text)", fontSize: 14 }}>בחר קטגורית חיפוש והכנס ערך לחיפוש</p>
        </div>
      )}

      {/* No results */}
      {query.trim() && results.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon"><Search size={24} color="var(--gray-text)" /></div>
          <p style={{ margin: 0, color: "var(--gray-text)", fontSize: 14 }}>לא נמצאו בוחרים עבור "{query}"</p>
        </div>
      )}

      {/* Grouped (streetAndNumber mode) */}
      {visibleGroupedResults && Object.keys(visibleGroupedResults).length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {Object.entries(visibleGroupedResults).map(([buildingKey, buildingVoters]) => (
            <div key={buildingKey} className="card" style={{ overflow: "hidden", padding: 0 }}>
              <div style={{ padding: "12px 18px", background: "var(--navy)", display: "flex", alignItems: "center", gap: 8 }}>
                <Building2 size={14} color="rgba(255,255,255,0.7)" />
                <span style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>{buildingKey}</span>
                <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, marginRight: "auto" }}>{buildingVoters.length} בוחרים</span>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <tbody>
                  {buildingVoters.map((v) => {
                    const leader = getVoterLeader(v);
                    const voterGroups = getVoterGroups(v);
                    const st = statuses.find((s) => s.id === v.statusId);
                    return (
                      <tr key={v.id} style={{ borderBottom: "1px solid var(--border)" }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "")}>
                        <td style={tdStyle}>
                          <div style={{ fontWeight: 600, fontSize: 13, color: "var(--navy)" }}>{v.firstName} {v.lastName}</div>
                          {v.address.apartment && <div style={{ fontSize: 11, color: "var(--gray-text)" }}>דירה {v.address.apartment}</div>}
                        </td>
                        <td style={tdStyle}>
                          {st && <span style={{ display: "inline-block", fontSize: 11, padding: "3px 8px", borderRadius: 20, fontWeight: 600, background: st.color + "22", color: st.color, border: `1px solid ${st.color}55` }}>{st.name}</span>}
                        </td>
                        <td style={tdStyle}>
                          {v.hasVoted
                            ? <span style={{ display: "inline-flex", alignItems: "center", gap: 3, background: "#dcfce7", color: "#16a34a", borderRadius: 20, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>✓ הצביע</span>
                            : <span style={{ color: "var(--text-muted)", fontSize: 12 }}>—</span>}
                        </td>
                        <td style={tdStyle}>
                          {leader
                            ? <span style={{ fontSize: 12, color: "var(--purple-secondary)", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}><UserCheck size={11} />{leader.firstName} {leader.lastName}</span>
                            : <span className="badge badge-gray">לא משויך</span>}
                        </td>
                        <td style={{ ...tdStyle }} className="hide-mobile">
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                            {voterGroups.map((g) => <span key={g.id} className="badge badge-blue" style={{ fontSize: 11 }}>{g.name}</span>)}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {/* Flat list */}
      {!visibleGroupedResults && results.length > 0 && (
        <div className="card" style={{ overflow: "hidden", padding: 0 }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--bg)", borderBottom: "1.5px solid var(--border)" }}>
                <th style={thStyle}>שם</th>
                <th style={thStyle} className="hide-mobile">כתובת</th>
                <th style={thStyle}>סטטוס</th>
                <th style={thStyle}>הצביע</th>
                <th style={thStyle} className="hide-mobile">ראש קבוצה</th>
                <th style={thStyle} className="hide-mobile">קבוצות</th>
              </tr>
            </thead>
            <tbody>
              {visibleResults.map((v) => {
                const leader = getVoterLeader(v);
                const voterGroups = getVoterGroups(v);
                const st = statuses.find((s) => s.id === v.statusId);
                return (
                  <tr key={v.id} style={{ borderBottom: "1px solid var(--border)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "")}>
                    <td style={tdStyle}>
                      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                        <div style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0, background: "linear-gradient(135deg, var(--blue-primary), var(--purple-secondary))", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 11 }}>
                          {v.firstName[0]}{v.lastName[0]}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14, color: "var(--navy)" }}>{v.firstName} {v.lastName}</div>
                          <div style={{ fontSize: 11, color: "var(--gray-text)", fontFamily: "monospace" }}>{v.uniqueId}</div>
                        </div>
                      </div>
                    </td>
                    <td style={tdStyle} className="hide-mobile">
                      <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, color: "var(--text-secondary)" }}>
                        <MapPin size={11} color="var(--gray-text)" />{formatAddress(v.address)}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      {st
                        ? <span style={{ display: "inline-block", fontSize: 12, padding: "3px 9px", borderRadius: 20, fontWeight: 600, background: st.color + "22", color: st.color, border: `1px solid ${st.color}55` }}>{st.name}</span>
                        : <span className="badge badge-gray">ללא סטטוס</span>}
                    </td>
                    <td style={tdStyle}>
                      {v.hasVoted
                        ? <span style={{ display: "inline-flex", alignItems: "center", gap: 3, background: "#dcfce7", color: "#16a34a", borderRadius: 20, padding: "3px 9px", fontSize: 12, fontWeight: 700 }}>✓ הצביע</span>
                        : <span style={{ color: "var(--text-muted)", fontSize: 12 }}>—</span>}
                    </td>
                    <td style={tdStyle} className="hide-mobile">
                      {leader
                        ? <span style={{ fontSize: 13, color: "var(--purple-secondary)", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}><UserCheck size={12} />{leader.firstName} {leader.lastName}</span>
                        : <span className="badge badge-gray">לא משויך</span>}
                    </td>
                    <td style={tdStyle} className="hide-mobile">
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {voterGroups.map((g) => <span key={g.id} className="badge badge-blue" style={{ fontSize: 11 }}>{g.name}</span>)}
                        {voterGroups.length === 0 && <span className="badge badge-gray">ללא קבוצה</span>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <ScrollSentinel onIntersect={loadMore} />
          <PaginationFooter showing={showing} total={results.length} hasMore={hasMore} entityLabel="בוחרים" />
        </div>
      )}
      {visibleGroupedResults && <ScrollSentinel onIntersect={loadMore} />}
    </div>
  );
}

const thStyle: React.CSSProperties = { padding: "11px 16px", textAlign: "right", fontSize: 11, fontWeight: 700, color: "var(--gray-text)", textTransform: "uppercase", letterSpacing: "0.05em" };
const tdStyle: React.CSSProperties = { padding: "12px 16px", verticalAlign: "middle" };
