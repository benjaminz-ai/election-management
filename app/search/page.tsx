"use client";

import { useState, useMemo } from "react";
import { useStore } from "@/lib/store";
import { formatAddress } from "@/lib/utils";
import PageHeader from "@/components/ui/PageHeader";
import { Search, MapPin, Users, UserCheck } from "lucide-react";
import { usePagination } from "@/hooks/usePagination";
import ScrollSentinel from "@/components/ui/ScrollSentinel";
import PaginationFooter from "@/components/ui/PaginationFooter";

type SearchMode = "lastName" | "groupLeader" | "street" | "streetAndNumber";

const modeLabels: Record<SearchMode, string> = {
  lastName: "שם משפחה",
  groupLeader: "ראש קבוצה",
  street: "רחוב",
  streetAndNumber: "רחוב + מספר",
};

export default function SearchPage() {
  const { state } = useStore();
  const { voters, groups, groupLeaders } = state;

  const [mode, setMode] = useState<SearchMode>("lastName");
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    switch (mode) {
      case "lastName":
        return voters.filter((v) => v.lastName.toLowerCase().includes(q));

      case "street":
        return voters.filter((v) => v.address.street.toLowerCase().includes(q));

      case "streetAndNumber":
        return voters.filter((v) => {
          const addr = `${v.address.street} ${v.address.streetNumber}`.toLowerCase();
          return addr.includes(q);
        });

      case "groupLeader": {
        const matchedLeaders = groupLeaders.filter(
          (gl) =>
            `${gl.firstName} ${gl.lastName}`.toLowerCase().includes(q)
        );
        const leaderGroupIds = matchedLeaders.flatMap((gl) => gl.groupIds);
        return voters.filter((v) =>
          v.groupIds.some((gid) => leaderGroupIds.includes(gid))
        );
      }

      default:
        return [];
    }
  }, [query, mode, voters, groupLeaders]);

  const getVoterLeader = (voter: typeof voters[0]) => {
    for (const gl of groupLeaders) {
      const glGroupIds = gl.groupIds;
      if (voter.groupIds.some((gid) => glGroupIds.includes(gid))) {
        return gl;
      }
    }
    return null;
  };

  const getVoterGroups = (voter: typeof voters[0]) =>
    groups.filter((g) => voter.groupIds.includes(g.id));

  const { visible: visibleResults, hasMore, loadMore, showing } = usePagination(results);

  // For streetAndNumber: derive grouped view from visible slice
  const visibleGroupedResults = useMemo(() => {
    if (mode !== "streetAndNumber" || !query.trim()) return null;
    const byBuilding: Record<string, typeof voters> = {};
    for (const v of visibleResults) {
      const key = `${v.address.street} ${v.address.streetNumber}${v.address.building ? " בניין " + v.address.building : ""}`;
      if (!byBuilding[key]) byBuilding[key] = [];
      byBuilding[key].push(v);
    }
    return byBuilding;
  }, [visibleResults, mode, query, voters]);

  return (
    <div>
      <PageHeader
        title="חיפוש"
        subtitle="חפש בוחרים לפי פרמטרים שונים"
      />

      {/* Search bar */}
      <div className="card" style={{ padding: 20, marginBottom: 24 }}>
        {/* Mode selector */}
        <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
          {(Object.keys(modeLabels) as SearchMode[]).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setQuery(""); }}
              style={{
                padding: "6px 14px",
                borderRadius: 20,
                border: mode === m ? "1px solid var(--blue-primary)" : "1px solid var(--border)",
                background: mode === m ? "rgba(32,157,215,0.1)" : "#fff",
                color: mode === m ? "var(--blue-primary)" : "var(--gray-text)",
                fontWeight: mode === m ? 700 : 400,
                fontSize: 13,
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              {modeLabels[m]}
            </button>
          ))}
        </div>

        {/* Input */}
        <div style={{ position: "relative" }}>
          <Search
            size={15}
            color="var(--gray-text)"
            style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
          />
          <input
            className="input"
            style={{ paddingRight: 36 }}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              mode === "lastName" ? "הקלד שם משפחה..." :
              mode === "street" ? "הקלד שם רחוב..." :
              mode === "streetAndNumber" ? "הקלד רחוב ומספר, לדוגמה: אורלנסקי 13" :
              "הקלד שם ראש קבוצה..."
            }
          />
        </div>

        {query.trim() && (
          <div style={{ marginTop: 8, fontSize: 13, color: "var(--gray-text)" }}>
            נמצאו <strong style={{ color: "var(--dark-navy)" }}>{results.length}</strong> תוצאות
          </div>
        )}
      </div>

      {/* Results */}
      {query.trim() && results.length === 0 && (
        <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--gray-text)" }}>
          לא נמצאו תוצאות עבור "{query}"
        </div>
      )}

      {/* Street+Number: grouped by building */}
      {mode === "streetAndNumber" && visibleGroupedResults && Object.keys(visibleGroupedResults).length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {Object.entries(visibleGroupedResults!).map(([buildingKey, buildingVoters]) => (
            <div key={buildingKey} className="card" style={{ overflow: "hidden", borderTop: "3px solid var(--accent-yellow)" }}>
              <div style={{ padding: "14px 20px", background: "#fffbf0", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8 }}>
                <MapPin size={14} color="#b87d00" />
                <span style={{ fontWeight: 700, fontSize: 14, color: "#92610a" }}>{buildingKey}</span>
                <span className="badge badge-yellow">{buildingVoters.length} בוחרים</span>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <tbody>
                  {buildingVoters.map((v) => <VoterRow key={v.id} voter={v} leader={getVoterLeader(v)} voterGroups={getVoterGroups(v)} />)}
                </tbody>
              </table>
            </div>
          ))}
          <ScrollSentinel onIntersect={loadMore} />
          <PaginationFooter showing={showing} total={results.length} hasMore={hasMore} entityLabel="בוחרים" />
        </div>
      )}

      {/* Other modes: flat list */}
      {mode !== "streetAndNumber" && results.length > 0 && (
        <div className="card" style={{ overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr className="table-header">
                <th style={thStyle}>שם מלא</th>
                <th style={thStyle}>כתובת</th>
                <th style={thStyle}>ראש קבוצה</th>
                <th style={thStyle}>קבוצות</th>
              </tr>
            </thead>
            <tbody>
              {visibleResults.map((v) => (
                <VoterRow key={v.id} voter={v} leader={getVoterLeader(v)} voterGroups={getVoterGroups(v)} showHeader />
              ))}
            </tbody>
          </table>
          <ScrollSentinel onIntersect={loadMore} />
          <PaginationFooter showing={showing} total={results.length} hasMore={hasMore} entityLabel="בוחרים" />
        </div>
      )}
    </div>
  );
}

function VoterRow({
  voter,
  leader,
  voterGroups,
  showHeader,
}: {
  voter: ReturnType<typeof useStore>["state"]["voters"][0];
  leader: ReturnType<typeof useStore>["state"]["groupLeaders"][0] | null;
  voterGroups: ReturnType<typeof useStore>["state"]["groups"];
  showHeader?: boolean;
}) {
  if (showHeader) {
    return (
      <tr className="table-row">
        <td style={tdStyle}>
          <div style={{ fontWeight: 600, color: "var(--dark-navy)", fontSize: 14 }}>
            {voter.firstName} {voter.lastName}
          </div>
          <div style={{ fontSize: 12, color: "var(--gray-text)", fontFamily: "monospace" }}>{voter.uniqueId}</div>
        </td>
        <td style={tdStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <MapPin size={11} color="var(--gray-text)" />
            <span style={{ fontSize: 13, color: "#475569" }}>{formatAddress(voter.address)}</span>
          </div>
        </td>
        <td style={tdStyle}>
          {leader ? (
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <UserCheck size={12} color="var(--purple-secondary)" />
              <span style={{ fontSize: 13, color: "var(--purple-secondary)", fontWeight: 600 }}>
                {leader.firstName} {leader.lastName}
              </span>
            </div>
          ) : (
            <span className="badge badge-gray">לא משויך</span>
          )}
        </td>
        <td style={tdStyle}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {voterGroups.map((g) => (
              <span key={g.id} className="badge badge-blue" style={{ fontSize: 11 }}>{g.name}</span>
            ))}
            {voterGroups.length === 0 && <span className="badge badge-gray">ללא קבוצה</span>}
          </div>
        </td>
      </tr>
    );
  }

  // Compact row for building groups
  return (
    <tr className="table-row">
      <td style={{ ...tdStyle, width: 200 }}>
        <div style={{ fontWeight: 600, color: "var(--dark-navy)", fontSize: 13 }}>
          {voter.firstName} {voter.lastName}
        </div>
        <div style={{ fontSize: 11, color: "var(--gray-text)" }}>דירה {voter.address.apartment}</div>
      </td>
      <td style={tdStyle}>
        {leader ? (
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <UserCheck size={11} color="var(--purple-secondary)" />
            <span style={{ fontSize: 12, color: "var(--purple-secondary)", fontWeight: 600 }}>
              {leader.firstName} {leader.lastName}
            </span>
          </div>
        ) : (
          <span className="badge badge-gray">לא משויך</span>
        )}
      </td>
      <td style={tdStyle}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {voterGroups.map((g) => (
            <span key={g.id} className="badge badge-blue" style={{ fontSize: 11 }}>{g.name}</span>
          ))}
        </div>
      </td>
    </tr>
  );
}

const thStyle: React.CSSProperties = { padding: "12px 16px", textAlign: "right", fontSize: 12, fontWeight: 600, color: "var(--gray-text)", textTransform: "uppercase", letterSpacing: "0.05em" };
const tdStyle: React.CSSProperties = { padding: "12px 16px", verticalAlign: "middle" };
