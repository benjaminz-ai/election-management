"use client";

import { useState, useMemo, useEffect } from "react";
import { useStore } from "@/lib/store";
import { formatAddress } from "@/lib/utils";
import PageHeader from "@/components/ui/PageHeader";
import { Search, MapPin, UserCheck, X, Vote, Filter, CheckSquare, Square, RotateCcw, Tag, Users2 } from "lucide-react";
import { usePagination } from "@/hooks/usePagination";
import ScrollSentinel from "@/components/ui/ScrollSentinel";
import PaginationFooter from "@/components/ui/PaginationFooter";

type TextMode = "lastName" | "street" | "streetAndNumber";
type VotedFilter = "" | "yes" | "no";

const TEXT_MODES: { key: TextMode; label: string; placeholder: string }[] = [
  { key: "lastName",        label: "שם משפחה",   placeholder: "הכנס שם משפחה..." },
  { key: "street",          label: "רחוב",        placeholder: "הכנס שם רחוב..." },
  { key: "streetAndNumber", label: "רחוב + מספר", placeholder: "לדוגמה: הרצל 12" },
];

export default function SearchPage() {
  const { state, bulkUpdateVoters } = useStore(); // advanced search + bulk actions
  const { voters, groups, subGroups, groupLeaders, divisionHeads, statuses } = state;

  // ── Filters ────────────────────────────────────────────────
  const [textMode, setTextMode] = useState<TextMode>("lastName");
  const [query, setQuery] = useState("");
  const [statusId, setStatusId] = useState("");
  const [groupId, setGroupId] = useState("");
  const [leaderId, setLeaderId] = useState("");
  const [divisionId, setDivisionId] = useState("");
  const [subGroupId, setSubGroupId] = useState("");
  const [city, setCity] = useState("");
  const [filterVoted, setFilterVoted] = useState<VotedFilter>("");

  // ── Selection (bulk) ───────────────────────────────────────
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const cities = useMemo(
    () => Array.from(new Set(voters.map((v) => v.address.city).filter(Boolean))).sort(),
    [voters]
  );

  // Map: groupId -> leaderId (a group's leader)
  const leaderByGroupId = useMemo(() => {
    const m: Record<string, string> = {};
    groups.forEach((g) => { if (g.groupLeaderId) m[g.id] = g.groupLeaderId; });
    return m;
  }, [groups]);

  // Map: leaderId -> divisionHeadId
  const divisionByLeaderId = useMemo(() => {
    const m: Record<string, string> = {};
    groupLeaders.forEach((gl) => { m[gl.id] = gl.divisionHeadId; });
    return m;
  }, [groupLeaders]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const hasAnyFilter = q || statusId || groupId || leaderId || divisionId || subGroupId || city || filterVoted;
    if (!hasAnyFilter) return [];

    return voters.filter((v) => {
      // Text
      if (q) {
        let textMatch = false;
        if (textMode === "lastName") textMatch = v.lastName.toLowerCase().includes(q);
        else if (textMode === "street") textMatch = v.address.street.toLowerCase().includes(q);
        else textMatch = `${v.address.street} ${v.address.streetNumber}`.toLowerCase().includes(q);
        if (!textMatch) return false;
      }
      // Status
      if (statusId && v.statusId !== statusId) return false;
      // Group
      if (groupId && !v.groupIds.includes(groupId)) return false;
      // Subgroup
      if (subGroupId && !(v.subGroupIds ?? []).includes(subGroupId)) return false;
      // Leader (any of voter's groups belongs to this leader)
      if (leaderId && !v.groupIds.some((gid) => leaderByGroupId[gid] === leaderId)) return false;
      // Division head (any of voter's groups -> leader -> division)
      if (divisionId && !v.groupIds.some((gid) => {
        const lid = leaderByGroupId[gid];
        return lid && divisionByLeaderId[lid] === divisionId;
      })) return false;
      // City
      if (city && v.address.city !== city) return false;
      // Voted
      if (filterVoted === "yes" && !v.hasVoted) return false;
      if (filterVoted === "no" && v.hasVoted) return false;
      return true;
    });
  }, [voters, query, textMode, statusId, groupId, leaderId, divisionId, subGroupId, city, filterVoted, leaderByGroupId, divisionByLeaderId]);

  // Clear selections that are no longer in results
  useEffect(() => {
    setSelected((prev) => {
      if (prev.size === 0) return prev;
      const ids = new Set(results.map((r) => r.id));
      const next = new Set<string>();
      prev.forEach((id) => { if (ids.has(id)) next.add(id); });
      return next.size === prev.size ? prev : next;
    });
  }, [results]);

  const getVoterLeader = (voter: typeof voters[0]) => {
    for (const gl of groupLeaders) {
      if (voter.groupIds.some((gid) => gl.groupIds.includes(gid))) return gl;
    }
    return null;
  };
  const getVoterGroups = (voter: typeof voters[0]) => groups.filter((g) => voter.groupIds.includes(g.id));

  const { visible: visibleResults, hasMore, loadMore, showing } = usePagination(results);

  const activeFilterCount =
    (statusId ? 1 : 0) + (groupId ? 1 : 0) + (leaderId ? 1 : 0) +
    (divisionId ? 1 : 0) + (subGroupId ? 1 : 0) + (city ? 1 : 0) + (filterVoted ? 1 : 0);

  const resetFilters = () => {
    setQuery(""); setStatusId(""); setGroupId(""); setLeaderId("");
    setDivisionId(""); setSubGroupId(""); setCity(""); setFilterVoted("");
    setSelected(new Set());
  };

  // Selection helpers
  const toggleOne = (id: string) =>
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allVisibleSelected = visibleResults.length > 0 && visibleResults.every((v) => selected.has(v.id));
  const toggleAllVisible = () =>
    setSelected((prev) => {
      const n = new Set(prev);
      if (allVisibleSelected) visibleResults.forEach((v) => n.delete(v.id));
      else visibleResults.forEach((v) => n.add(v.id));
      return n;
    });
  const selectAllResults = () => setSelected(new Set(results.map((r) => r.id)));

  const hasFilters = Boolean(query.trim() || activeFilterCount > 0);

  return (
    <div>
      <PageHeader title="חיפוש מתקדם" subtitle="חיתוכים משולבים ועדכון קבוצתי של בוחרים" />

      {/* ── Filter panel ─────────────────────────────────── */}
      <div className="card" style={{ padding: 20, marginBottom: 20 }}>
        {/* Text search row */}
        <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
          {TEXT_MODES.map((m) => (
            <button key={m.key} onClick={() => setTextMode(m.key)}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", border: "1.5px solid", borderColor: textMode === m.key ? "var(--blue-primary)" : "var(--border)", background: textMode === m.key ? "rgba(32,157,215,0.08)" : "#fff", color: textMode === m.key ? "var(--blue-primary)" : "var(--text-secondary)" }}>
              {m.label}
            </button>
          ))}
        </div>
        <div className="search-wrap" style={{ fontSize: 15, marginBottom: 16 }}>
          <Search size={16} color="var(--gray-text)" />
          <input className="input" autoFocus value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder={TEXT_MODES.find((m) => m.key === textMode)!.placeholder}
            style={{ border: "none", boxShadow: "none", padding: 0, background: "transparent", flex: 1, fontSize: 15 }} />
          {query && (
            <button onClick={() => setQuery("")} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--gray-text)", display: "flex", padding: 0 }}>
              <X size={15} />
            </button>
          )}
        </div>

        {/* Dropdown filters */}
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
          <Filter size={13} color="var(--gray-text)" />
          <span style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 700 }}>סינון מתקדם</span>
          {activeFilterCount > 0 && (
            <span style={{ fontSize: 11, padding: "1px 8px", borderRadius: 20, background: "rgba(32,157,215,0.12)", color: "var(--blue-primary)", fontWeight: 700 }}>{activeFilterCount} פעילים</span>
          )}
          {hasFilters && (
            <button onClick={resetFilters} style={{ marginRight: "auto", display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", color: "var(--gray-text)", fontSize: 12, fontWeight: 600 }}>
              <RotateCcw size={12} /> נקה הכל
            </button>
          )}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10 }}>
          <FilterSelect label="סטטוס" value={statusId} onChange={setStatusId}
            options={statuses.map((s) => ({ value: s.id, label: s.name }))} />
          <FilterSelect label="קבוצה" value={groupId} onChange={setGroupId}
            options={groups.map((g) => ({ value: g.id, label: g.name }))} />
          <FilterSelect label="תת-קבוצה" value={subGroupId} onChange={setSubGroupId}
            options={subGroups.map((sg) => ({ value: sg.id, label: sg.name }))} />
          <FilterSelect label="ראש קבוצה" value={leaderId} onChange={setLeaderId}
            options={groupLeaders.map((gl) => ({ value: gl.id, label: `${gl.firstName} ${gl.lastName}` }))} />
          <FilterSelect label="ראש אזור" value={divisionId} onChange={setDivisionId}
            options={divisionHeads.map((dh) => ({ value: dh.id, label: `${dh.firstName} ${dh.lastName}` }))} />
          <FilterSelect label="עיר" value={city} onChange={setCity}
            options={cities.map((c) => ({ value: c, label: c }))} />
        </div>

        {/* Voted pills */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 14, marginTop: 14, borderTop: "1px solid var(--border)" }}>
          <Vote size={13} color="var(--gray-text)" />
          <span style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 600 }}>הצבעה:</span>
          {(["", "yes", "no"] as VotedFilter[]).map((opt) => (
            <button key={opt} onClick={() => setFilterVoted(opt)}
              style={{ padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer", border: `1.5px solid ${filterVoted === opt ? (opt === "yes" ? "#22c55e" : opt === "no" ? "#ef4444" : "var(--blue-primary)") : "var(--border)"}`, background: filterVoted === opt ? (opt === "yes" ? "#f0fdf4" : opt === "no" ? "#fef2f2" : "rgba(32,157,215,0.08)") : "#fff", color: filterVoted === opt ? (opt === "yes" ? "#16a34a" : opt === "no" ? "#dc2626" : "var(--blue-primary)") : "var(--text-muted)" }}>
              {opt === "" ? "הכל" : opt === "yes" ? "✓ הצביע" : "✗ לא הצביע"}
            </button>
          ))}
        </div>
      </div>

      {/* ── Results header ───────────────────────────────── */}
      {hasFilters && (
        <div style={{ marginBottom: 14, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            נמצאו <strong style={{ color: "var(--navy)" }}>{results.length}</strong> בוחרים
          </span>
          {results.length > 0 && (
            <>
              <button onClick={toggleAllVisible} style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "4px 10px", cursor: "pointer", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>
                {allVisibleSelected ? <CheckSquare size={13} /> : <Square size={13} />} בחר את המוצגים
              </button>
              {results.length > visibleResults.length && (
                <button onClick={selectAllResults} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, color: "var(--blue-primary)" }}>
                  בחר את כל {results.length} התוצאות
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* Empty / no-results states */}
      {!hasFilters && (
        <div className="empty-state" style={{ marginTop: 40 }}>
          <div className="empty-state-icon"><Search size={28} color="var(--blue-primary)" /></div>
          <h3 style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 700, color: "var(--navy)" }}>חפש בוחרים</h3>
          <p style={{ margin: 0, color: "var(--gray-text)", fontSize: 14 }}>הכנס טקסט או בחר פילטרים. ניתן לשלב כמה פילטרים יחד.</p>
        </div>
      )}
      {hasFilters && results.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon"><Search size={24} color="var(--gray-text)" /></div>
          <p style={{ margin: 0, color: "var(--gray-text)", fontSize: 14 }}>לא נמצאו בוחרים התואמים לסינון</p>
        </div>
      )}

      {/* ── Results table ────────────────────────────────── */}
      {results.length > 0 && (
        <div className="card" style={{ overflow: "hidden", padding: 0, marginBottom: selected.size > 0 ? 90 : 0 }}>
          <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--bg)", borderBottom: "1.5px solid var(--border)" }}>
                  <th style={{ ...thStyle, width: 40, cursor: "pointer" }} onClick={toggleAllVisible}>
                    {allVisibleSelected ? <CheckSquare size={15} color="var(--blue-primary)" /> : <Square size={15} color="var(--gray-text)" />}
                  </th>
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
                  const isSel = selected.has(v.id);
                  return (
                    <tr key={v.id} onClick={() => toggleOne(v.id)}
                      style={{ borderBottom: "1px solid var(--border)", cursor: "pointer", background: isSel ? "rgba(32,157,215,0.06)" : "" }}>
                      <td style={tdStyle} onClick={(e) => { e.stopPropagation(); toggleOne(v.id); }}>
                        {isSel ? <CheckSquare size={16} color="var(--blue-primary)" /> : <Square size={16} color="var(--gray-text)" />}
                      </td>
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
          </div>
          <ScrollSentinel onIntersect={loadMore} />
          <PaginationFooter showing={showing} total={results.length} hasMore={hasMore} entityLabel="בוחרים" />
        </div>
      )}

      {/* ── Bulk action bar ──────────────────────────────── */}
      {selected.size > 0 && (
        <BulkActionBar
          count={selected.size}
          statuses={statuses}
          groupLeaders={groupLeaders}
          groups={groups}
          onClear={() => setSelected(new Set())}
          onApply={(changes) => { bulkUpdateVoters(Array.from(selected), changes); setSelected(new Set()); }}
        />
      )}
    </div>
  );
}

// ── Filter dropdown ─────────────────────────────────────────
function FilterSelect({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={{ fontSize: 11, fontWeight: 700, color: "var(--gray-text)" }}>{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        style={{ padding: "8px 10px", borderRadius: 8, border: `1.5px solid ${value ? "var(--blue-primary)" : "var(--border)"}`, fontSize: 13, fontWeight: 600, color: value ? "var(--navy)" : "var(--text-muted)", background: value ? "rgba(32,157,215,0.06)" : "#fff", cursor: "pointer" }}>
        <option value="">הכל</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

// ── Bulk action bar ─────────────────────────────────────────
type Status = { id: string; name: string; color: string };
type GL = { id: string; firstName: string; lastName: string };
type Grp = { id: string; name: string; groupLeaderId: string | null };

function BulkActionBar({ count, statuses, groupLeaders, groups, onClear, onApply }: {
  count: number;
  statuses: Status[];
  groupLeaders: GL[];
  groups: Grp[];
  onClear: () => void;
  onApply: (changes: { statusId?: string; hasVoted?: boolean; addToGroupId?: string }) => void;
}) {
  type Action = "" | "status" | "voted" | "move";
  const [action, setAction] = useState<Action>("");
  const [statusId, setStatusId] = useState("");
  const [voted, setVoted] = useState<"yes" | "no">("yes");
  const [moveLeaderId, setMoveLeaderId] = useState("");
  const [moveGroupId, setMoveGroupId] = useState("");

  const leaderGroups = useMemo(
    () => groups.filter((g) => g.groupLeaderId === moveLeaderId),
    [groups, moveLeaderId]
  );

  const canApply =
    (action === "status" && statusId) ||
    (action === "voted") ||
    (action === "move" && moveGroupId);

  const apply = () => {
    if (action === "status") onApply({ statusId });
    else if (action === "voted") onApply({ hasVoted: voted === "yes" });
    else if (action === "move") onApply({ addToGroupId: moveGroupId });
  };

  const tab = (key: Action, icon: React.ReactNode, label: string) => (
    <button onClick={() => setAction(key)}
      style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 12px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", border: "1.5px solid", borderColor: action === key ? "var(--blue-primary)" : "var(--border)", background: action === key ? "rgba(32,157,215,0.1)" : "#fff", color: action === key ? "var(--blue-primary)" : "var(--text-secondary)" }}>
      {icon}{label}
    </button>
  );

  return (
    <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50, background: "#fff", borderTop: "2px solid var(--blue-primary)", boxShadow: "0 -4px 20px rgba(0,0,0,0.1)", padding: "14px 20px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, fontWeight: 700, color: "var(--navy)" }}>
          <CheckSquare size={16} color="var(--blue-primary)" />{count} נבחרו
        </span>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {tab("status", <Tag size={13} />, "שנה סטטוס")}
          {tab("voted", <Vote size={13} />, "סמן הצבעה")}
          {tab("move", <Users2 size={13} />, "העבר לראש קבוצה")}
        </div>

        {/* Action-specific controls */}
        {action === "status" && (
          <select value={statusId} onChange={(e) => setStatusId(e.target.value)} style={selStyle}>
            <option value="">בחר סטטוס...</option>
            {statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
        {action === "voted" && (
          <div style={{ display: "flex", gap: 6 }}>
            {(["yes", "no"] as const).map((opt) => (
              <button key={opt} onClick={() => setVoted(opt)}
                style={{ padding: "7px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", border: `1.5px solid ${voted === opt ? (opt === "yes" ? "#22c55e" : "#ef4444") : "var(--border)"}`, background: voted === opt ? (opt === "yes" ? "#f0fdf4" : "#fef2f2") : "#fff", color: voted === opt ? (opt === "yes" ? "#16a34a" : "#dc2626") : "var(--text-muted)" }}>
                {opt === "yes" ? "✓ הצביע" : "✗ לא הצביע"}
              </button>
            ))}
          </div>
        )}
        {action === "move" && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <select value={moveLeaderId} onChange={(e) => { setMoveLeaderId(e.target.value); setMoveGroupId(""); }} style={selStyle}>
              <option value="">בחר ראש קבוצה...</option>
              {groupLeaders.map((gl) => <option key={gl.id} value={gl.id}>{gl.firstName} {gl.lastName}</option>)}
            </select>
            {moveLeaderId && (
              <select value={moveGroupId} onChange={(e) => setMoveGroupId(e.target.value)} style={selStyle}>
                <option value="">בחר קבוצה...</option>
                {leaderGroups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                {leaderGroups.length === 0 && <option value="" disabled>אין קבוצות לראש קבוצה זה</option>}
              </select>
            )}
          </div>
        )}

        <div style={{ marginRight: "auto", display: "flex", gap: 8 }}>
          <button onClick={onClear} style={{ padding: "8px 14px", borderRadius: 8, border: "1.5px solid var(--border)", background: "#fff", color: "var(--text-secondary)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            ביטול
          </button>
          <button onClick={apply} disabled={!canApply}
            style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: canApply ? "var(--blue-primary)" : "var(--border)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: canApply ? "pointer" : "not-allowed" }}>
            החל על {count} בוחרים
          </button>
        </div>
      </div>
    </div>
  );
}

const selStyle: React.CSSProperties = { padding: "8px 10px", borderRadius: 8, border: "1.5px solid var(--blue-primary)", fontSize: 13, fontWeight: 600, color: "var(--navy)", background: "#fff", cursor: "pointer" };
const thStyle: React.CSSProperties = { padding: "11px 16px", textAlign: "right", fontSize: 11, fontWeight: 700, color: "var(--gray-text)", textTransform: "uppercase", letterSpacing: "0.05em" };
const tdStyle: React.CSSProperties = { padding: "12px 16px", verticalAlign: "middle" };
