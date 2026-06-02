"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { ConversationLog, Voter } from "@/types";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import {
  Search, X, Phone, MapPin, Users, Clock, Loader2, CheckCircle2, Contact, Filter,
} from "lucide-react";

function buildAddress(v: Voter) {
  return [v.address.street, v.address.streetNumber, v.address.city].filter(Boolean).join(", ");
}
function getInitials(f: string, l: string) {
  return `${(f || "").charAt(0)}${(l || "").charAt(0)}`;
}
function stringToColor(str: string) {
  const colors = ["#6366f1","#8b5cf6","#ec4899","#f43f5e","#f97316","#eab308","#22c55e","#14b8a6","#06b6d4","#3b82f6"];
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}
function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("he-IL", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch { return iso; }
}

export default function FieldPage() {
  const { state } = useStore();
  const { currentUser } = useAuth();
  const { voters, groups, groupLeaders, divisionHeads, statuses, callStatuses, users } = state;

  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState<string>("");
  const [selected, setSelected] = useState<Voter | null>(null);
  const [logs, setLogs] = useState<ConversationLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState(false);

  const email = (currentUser?.email || "").trim().toLowerCase();

  // Resolve which groups belong to this user (by email → group leader / division head).
  const myGroups = useMemo(() => {
    if (!email) return [];
    const groupIds = new Set<string>();

    const addLeaderGroups = (leaderId: string, leaderGroupIds?: string[]) => {
      (leaderGroupIds ?? []).forEach((gid) => groupIds.add(gid));
      groups.forEach((g) => { if (g.groupLeaderId === leaderId) groupIds.add(g.id); });
    };

    // Group leader matched by email
    groupLeaders
      .filter((gl) => (gl.email || "").trim().toLowerCase() === email)
      .forEach((gl) => addLeaderGroups(gl.id, gl.groupIds));

    // Division head matched by email → all their group leaders' groups
    divisionHeads
      .filter((dh) => (dh.email || "").trim().toLowerCase() === email)
      .forEach((dh) => {
        (dh.groupLeaderIds ?? []).forEach((leaderId) => {
          const gl = groupLeaders.find((l) => l.id === leaderId);
          addLeaderGroups(leaderId, gl?.groupIds);
        });
      });

    return groups.filter((g) => groupIds.has(g.id));
  }, [email, groups, groupLeaders, divisionHeads]);

  const myGroupIdSet = useMemo(() => new Set(myGroups.map((g) => g.id)), [myGroups]);

  // Voters assigned to this user (in any of their groups).
  const myVoters = useMemo(
    () => voters.filter((v) => v.groupIds.some((gid) => myGroupIdSet.has(gid))),
    [voters, myGroupIdSet]
  );

  const defaultStatusId = useMemo(() => statuses.find((s) => s.isDefault)?.id, [statuses]);
  const getStatus = useCallback(
    (v: Voter) => statuses.find((s) => s.id === (v.statusId ?? defaultStatusId)) ?? null,
    [statuses, defaultStatusId]
  );

  // Stats
  const stats = useMemo(() => {
    let supporters = 0, voted = 0;
    for (const v of myVoters) {
      const st = getStatus(v);
      if (st?.category === "supporter") supporters++;
      if (v.hasVoted) voted++;
    }
    return { total: myVoters.length, supporters, voted };
  }, [myVoters, getStatus]);

  // Filtered list
  const filtered = useMemo(() => {
    let list = myVoters;
    if (groupFilter) list = list.filter((v) => v.groupIds.includes(groupFilter));
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((v) =>
        `${v.firstName} ${v.lastName}`.toLowerCase().includes(q) ||
        (v.uniqueId || "").toLowerCase().includes(q) ||
        (v.phone || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [myVoters, groupFilter, search]);

  // Load conversation history (read-only) when a voter is opened.
  useEffect(() => {
    if (!selected) { setLogs([]); return; }
    let cancelled = false;
    setLogsLoading(true); setLogsError(false);
    (async () => {
      try {
        const snap = await getDocs(query(collection(db, "conversationLogs"), where("voterId", "==", selected.id)));
        if (cancelled) return;
        const rows = snap.docs.map((d) => d.data() as ConversationLog).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
        setLogs(rows);
      } catch {
        if (!cancelled) setLogsError(true);
      } finally {
        if (!cancelled) setLogsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selected]);

  const groupName = (id: string) => groups.find((g) => g.id === id)?.name ?? "";
  const callStatusName = (id: string) => callStatuses.find((c) => c.id === id)?.name ?? id;
  const statusName = (id: string) => statuses.find((s) => s.id === id)?.name ?? id;
  const userName = (id: string) => {
    const u = users.find((x) => x.id === id);
    return u ? `${u.firstName} ${u.lastName}`.trim() : "";
  };

  return (
    <div style={{ maxWidth: 760, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
        <div style={{ width: 40, height: 40, borderRadius: 11, background: "linear-gradient(135deg,#209dd7,#753991)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Contact size={20} color="#fff" />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#032147" }}>האנשים שלי</h1>
          <div style={{ fontSize: 13, color: "#94a3b8" }}>הבוחרים המשויכים אליך</div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 16 }}>
        <div style={{ background: "#fff", border: "1px solid #eef1f5", borderRadius: 12, padding: "12px", textAlign: "center" }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#032147" }}>{stats.total}</div>
          <div style={{ fontSize: 11, color: "#94a3b8" }}>בוחרים</div>
        </div>
        <div style={{ background: "#fff", border: "1px solid #eef1f5", borderRadius: 12, padding: "12px", textAlign: "center" }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#16a34a" }}>{stats.supporters}</div>
          <div style={{ fontSize: 11, color: "#94a3b8" }}>תומכים</div>
        </div>
        <div style={{ background: "#fff", border: "1px solid #eef1f5", borderRadius: 12, padding: "12px", textAlign: "center" }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#209dd7" }}>{stats.voted}</div>
          <div style={{ fontSize: 11, color: "#94a3b8" }}>הצביעו</div>
        </div>
      </div>

      {/* Search */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, border: "1.5px solid #e2e8f0", borderRadius: 12, padding: "9px 12px", background: "#fff", marginBottom: 12 }}>
        <Search size={16} color="#94a3b8" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="חפש בוחר בקבוצות שלי..."
          style={{ flex: 1, border: "none", outline: "none", fontSize: 14, background: "transparent", color: "#374151" }} />
        {search && <button onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", display: "flex", padding: 0 }}><X size={15} /></button>}
      </div>

      {/* Group filter chips */}
      {myGroups.length > 1 && (
        <div style={{ display: "flex", gap: 7, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
          <Filter size={13} color="#94a3b8" />
          <button onClick={() => setGroupFilter("")}
            style={{ padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer", background: groupFilter === "" ? "#032147" : "#eef1f5", color: groupFilter === "" ? "#fff" : "#475569" }}>
            הכל
          </button>
          {myGroups.map((g) => (
            <button key={g.id} onClick={() => setGroupFilter(g.id)}
              style={{ padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer", background: groupFilter === g.id ? "#032147" : "#eef1f5", color: groupFilter === g.id ? "#fff" : "#475569" }}>
              {g.name}
            </button>
          ))}
        </div>
      )}

      {/* List */}
      {myVoters.length === 0 ? (
        <div style={{ padding: "48px 20px", textAlign: "center", background: "#fff", borderRadius: 14, border: "1px solid #eef1f5" }}>
          <Users size={28} color="#d1d5db" style={{ margin: "0 auto 10px", display: "block" }} />
          <div style={{ color: "#475569", fontWeight: 700, fontSize: 15 }}>לא משויכים אליך בוחרים עדיין</div>
          <div style={{ color: "#9ca3af", fontSize: 13, marginTop: 6, lineHeight: 1.6 }}>
            הבוחרים מופיעים כאן לפי הקבוצות שאתה מוביל.<br />אם זה לא נכון, פנה למנהל המערכת לבדיקת השיוך.
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: "32px", textAlign: "center", color: "#9ca3af", fontSize: 13 }}>לא נמצאו בוחרים התואמים את החיפוש</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map((v) => {
            const st = getStatus(v);
            return (
              <div key={v.id} onClick={() => setSelected(v)}
                style={{ background: "#fff", border: "1px solid #eef1f5", borderRadius: 12, padding: "11px 13px", display: "flex", alignItems: "center", gap: 11, cursor: "pointer" }}>
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: stringToColor(v.id), color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, flexShrink: 0 }}>
                  {getInitials(v.firstName, v.lastName)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "#032147" }}>
                    {v.firstName} {v.lastName}
                    {v.hasVoted && <span style={{ color: "#16a34a", fontSize: 11, fontWeight: 700, marginRight: 6 }}>✓ הצביע</span>}
                  </div>
                  <div style={{ fontSize: 11, color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {v.groupIds.map(groupName).filter(Boolean).join(" · ") || buildAddress(v)}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5, flexShrink: 0 }}>
                  {st && (
                    <span style={{ padding: "2px 9px", borderRadius: 20, fontSize: 10, fontWeight: 700, background: st.color + "22", color: st.color }}>{st.name}</span>
                  )}
                  {v.phone && (
                    <a href={`tel:${v.phone}`} onClick={(e) => e.stopPropagation()}
                      style={{ display: "flex", alignItems: "center", gap: 3, color: "#209dd7", fontSize: 11, fontWeight: 600, textDecoration: "none" }}>
                      <Phone size={11} /> חיוג
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Read-only detail modal */}
      {selected && (
        <div onClick={() => setSelected(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(3,33,71,0.45)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 50, padding: 0 }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ background: "#fff", borderRadius: "18px 18px 0 0", width: "100%", maxWidth: 520, maxHeight: "88vh", overflowY: "auto" }}>
            {/* Header */}
            <div style={{ background: "linear-gradient(135deg,#032147,#0d3d73)", padding: "18px 20px", display: "flex", alignItems: "center", gap: 12, position: "sticky", top: 0 }}>
              <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(255,255,255,0.15)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 17, flexShrink: 0 }}>
                {getInitials(selected.firstName, selected.lastName)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: "#fff", fontSize: 18, fontWeight: 800 }}>{selected.firstName} {selected.lastName}</div>
                <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 12 }}>ת.ז: {selected.uniqueId}</div>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 8, color: "#fff", width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: "16px 20px" }}>
              {/* Status + voted */}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
                {getStatus(selected) && (
                  <span style={{ padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700, background: getStatus(selected)!.color + "22", color: getStatus(selected)!.color }}>
                    {getStatus(selected)!.name}
                  </span>
                )}
                {selected.hasVoted && (
                  <span style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700, background: "rgba(34,197,94,0.12)", color: "#16a34a" }}>
                    <CheckCircle2 size={13} /> הצביע
                  </span>
                )}
              </div>

              {/* Contact info */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, color: "#475569" }}>
                  <MapPin size={14} color="#94a3b8" /> {buildAddress(selected)}
                  {selected.address.apartment && <span style={{ color: "#94a3b8" }}> · דירה {selected.address.apartment}</span>}
                </div>
                {selected.phone && (
                  <a href={`tel:${selected.phone}`} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, color: "#209dd7", textDecoration: "none", direction: "ltr", justifyContent: "flex-end" }}>
                    <Phone size={14} /> {selected.phone}
                  </a>
                )}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {selected.groupIds.map((gid) => groupName(gid)).filter(Boolean).map((name, i) => (
                    <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 20, fontSize: 11, background: "rgba(32,157,215,0.09)", color: "#0e6fa0", fontWeight: 500 }}>
                      <Users size={10} /> {name}
                    </span>
                  ))}
                </div>
              </div>

              {/* Conversation history (read-only) */}
              <div style={{ display: "flex", alignItems: "center", gap: 7, color: "#032147", fontSize: 14, fontWeight: 700, marginBottom: 10 }}>
                <Clock size={15} color="#209dd7" /> היסטוריית שיחות
                {logs.length > 0 && <span style={{ marginRight: "auto", background: "#f1f5f9", color: "#64748b", borderRadius: 20, padding: "1px 9px", fontSize: 12, fontWeight: 700 }}>{logs.length}</span>}
              </div>
              {logsLoading ? (
                <div style={{ textAlign: "center", padding: 24, color: "#94a3b8" }}>
                  <Loader2 size={20} className="spin" style={{ margin: "0 auto 6px", display: "block" }} /> טוען...
                </div>
              ) : logsError ? (
                <div style={{ padding: 14, background: "#fef2f2", borderRadius: 10, fontSize: 13, color: "#dc2626", textAlign: "center" }}>שגיאה בטעינת היסטוריה</div>
              ) : logs.length === 0 ? (
                <div style={{ padding: 24, textAlign: "center", background: "#fafbfc", borderRadius: 10, color: "#9ca3af", fontSize: 13 }}>אין שיחות קודמות</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {logs.map((log) => (
                    <div key={log.id} style={{ border: "1px solid #eef1f5", borderRadius: 10, padding: "10px 12px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 12, color: "#64748b" }}>{formatDate(log.timestamp)}</span>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                          {log.callStatus && <span style={{ fontSize: 11, color: "#0e6fa0", background: "rgba(32,157,215,0.1)", borderRadius: 20, padding: "1px 8px" }}>{callStatusName(log.callStatus)}</span>}
                          {log.statusId && <span style={{ fontSize: 11, color: "#753991", background: "rgba(117,57,145,0.1)", borderRadius: 20, padding: "1px 8px" }}>{statusName(log.statusId)}</span>}
                        </div>
                      </div>
                      {log.notes && <div style={{ fontSize: 13, color: "#374151", marginTop: 6 }}>{log.notes}</div>}
                      {userName(log.userId) && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 6 }}>{userName(log.userId)}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
