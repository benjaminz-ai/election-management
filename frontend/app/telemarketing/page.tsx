"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useStore, getActiveTenant } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { ConversationLog, Voter } from "@/types";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, setDoc, doc } from "firebase/firestore";
import {
  Phone, ChevronRight, ChevronLeft, PhoneCall, MapPin, User, Users,
  Clock, CheckCircle2, Loader2, Search, X, Bell,
} from "lucide-react";
import { usePagination } from "@/hooks/usePagination";
import ScrollSentinel from "@/components/ui/ScrollSentinel";
import PaginationFooter from "@/components/ui/PaginationFooter";
import DateTimePicker from "@/components/ui/DateTimePicker";

const generateId = () => `cl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("he-IL", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch { return iso; }
}

function buildAddress(v: Voter) {
  return [v.address.street, v.address.streetNumber, v.address.city].filter(Boolean).join(", ");
}

function getInitials(firstName: string, lastName: string) {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`;
}

function stringToColor(str: string) {
  const colors = ["#6366f1","#8b5cf6","#ec4899","#f43f5e","#f97316","#eab308","#22c55e","#14b8a6","#06b6d4","#3b82f6"];
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

export default function TelemarketingPage() {
  const { state, updateVoter, addReminder } = useStore();
  const { currentUser } = useAuth();
  const { voters, groups, subGroups, groupLeaders, statuses, callStatuses } = state;

  // Filters
  const [filterText, setFilterText] = useState("");
  const [filterStatusId, setFilterStatusId] = useState("");
  const [filterCallStatusId, setFilterCallStatusId] = useState("");
  const [filterGroupId, setFilterGroupId] = useState("");
  const [filterSubGroupId, setFilterSubGroupId] = useState("");
  const [filterGroupLeaderId, setFilterGroupLeaderId] = useState("");
  const [filterStreet, setFilterStreet] = useState("");
  const [filterVoted, setFilterVoted] = useState<"" | "yes" | "no">("");

  // Workspace
  const [selectedVoterId, setSelectedVoterId] = useState<string | null>(null);
  const [logs, setLogs] = useState<ConversationLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsLoadError, setLogsLoadError] = useState(false);

  // Form
  const [formCallStatusId, setFormCallStatusId] = useState("");
  const [formStatusId, setFormStatusId] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formHasVoted, setFormHasVoted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Personal reminder
  const [showReminder, setShowReminder] = useState(false);
  const [reminderText, setReminderText] = useState("");
  const [reminderDue, setReminderDue] = useState("");
  const [reminderSaved, setReminderSaved] = useState(false);

  const saveReminder = () => {
    if (!selectedVoter || !reminderText.trim()) return;
    addReminder({
      id: `rm_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      voterId: selectedVoter.id,
      userId: currentUser?.id ?? "",
      text: reminderText.trim(),
      dueAt: reminderDue ? new Date(reminderDue).toISOString() : undefined,
      done: false,
      createdAt: new Date().toISOString(),
    });
    setReminderText(""); setReminderDue(""); setShowReminder(false);
    setReminderSaved(true);
    setTimeout(() => setReminderSaved(false), 2500);
  };

  const defaultStatusId = useMemo(
    () => statuses.find((s) => s.isDefault)?.id ?? statuses[0]?.id ?? "",
    [statuses]
  );

  useEffect(() => {
    if (callStatuses.length > 0 && !formCallStatusId) setFormCallStatusId(callStatuses[0].id);
  }, [callStatuses, formCallStatusId]);

  // Filtered voters
  const filteredVoters = useMemo(() => {
    const text = filterText.toLowerCase().trim();
    return voters.filter((v) => {
      if (filterStatusId && (v.statusId ?? defaultStatusId) !== filterStatusId) return false;
      if (filterCallStatusId && v.lastCallStatusId !== filterCallStatusId) return false;
      if (filterVoted === "yes" && !v.hasVoted) return false;
      if (filterVoted === "no" && v.hasVoted) return false;
      if (filterSubGroupId) {
        if (!(v.subGroupIds ?? []).includes(filterSubGroupId)) return false;
      } else if (filterGroupId) {
        const inGroup = v.groupIds.includes(filterGroupId);
        const inGroupViaSub = (v.subGroupIds ?? []).some(sgid => { const sg = subGroups.find(x => x.id === sgid); return sg?.parentGroupId === filterGroupId; });
        if (!inGroup && !inGroupViaSub) return false;
      }
      if (filterGroupLeaderId) {
        const gl = groupLeaders.find((g) => g.id === filterGroupLeaderId);
        if (!gl) return false;
        const inLeaderGroup = v.groupIds.some(gid => gl.groupIds.includes(gid));
        const inLeaderSub = (v.subGroupIds ?? []).some(sgid => { const sg = subGroups.find(x => x.id === sgid); return sg && gl.groupIds.includes(sg.parentGroupId); });
        if (!inLeaderGroup && !inLeaderSub) return false;
      }
      if (filterStreet && !v.address.street.includes(filterStreet)) return false;
      if (text) {
        const name = `${v.firstName} ${v.lastName}`.toLowerCase();
        if (!name.includes(text) && !v.uniqueId.includes(text) && !(v.phone ?? "").includes(text)) return false;
      }
      return true;
    });
  }, [voters, filterText, filterStatusId, filterCallStatusId, filterVoted, filterGroupId, filterSubGroupId, filterGroupLeaderId, filterStreet, defaultStatusId, groupLeaders, subGroups]);

  const hasActiveFilter = !!(filterText || filterStatusId || filterCallStatusId || filterVoted || filterGroupId || filterSubGroupId || filterGroupLeaderId || filterStreet);
  const clearFilters = () => { setFilterText(""); setFilterStatusId(""); setFilterCallStatusId(""); setFilterVoted(""); setFilterGroupId(""); setFilterSubGroupId(""); setFilterGroupLeaderId(""); setFilterStreet(""); };

  const selectedVoter = useMemo(() => filteredVoters.find((v) => v.id === selectedVoterId) ?? null, [filteredVoters, selectedVoterId]);
  const voterListRef = useRef<HTMLDivElement>(null);
  const { visible: visibleVoters, hasMore: listHasMore, loadMore: listLoadMore, showing: listShowing } = usePagination(filteredVoters);
  const selectedIndex = useMemo(() => filteredVoters.findIndex((v) => v.id === selectedVoterId), [filteredVoters, selectedVoterId]);

  // Load logs
  const loadLogs = useCallback(async (voterId: string) => {
    setLogsLoading(true); setLogsLoadError(false);
    try {
      const q = query(collection(db, "conversationLogs"), where("voterId", "==", voterId), where("tenantId", "==", getActiveTenant()));
      const snap = await getDocs(q);
      setLogs(snap.docs.map((d) => d.data() as ConversationLog).sort((a, b) => b.timestamp.localeCompare(a.timestamp)));
    } catch { setLogsLoadError(true); setLogs([]); }
    finally { setLogsLoading(false); }
  }, []);

  useEffect(() => {
    if (!selectedVoterId) { setLogs([]); return; }
    loadLogs(selectedVoterId);
  }, [selectedVoterId, loadLogs]);

  // Select voter
  const handleSelectVoter = useCallback((v: Voter) => {
    setSelectedVoterId(v.id);
    setFormCallStatusId(v.lastCallStatusId ?? callStatuses[0]?.id ?? "");
    setFormStatusId(v.statusId ?? defaultStatusId);
    setFormHasVoted(v.hasVoted ?? false);
    setFormNotes("");
    setSaveError("");
  }, [callStatuses, defaultStatusId]);

  // Deep link: /telemarketing?voter=<id> — auto-filter to that voter and select
  // them (e.g. when opened from the telemarketing productivity report). The
  // selected voter must be inside the filtered list, so we set the search text
  // to their name. Runs once, after voters have loaded.
  const deepLinkApplied = useRef(false);
  useEffect(() => {
    if (deepLinkApplied.current || voters.length === 0) return;
    const vid = new URLSearchParams(window.location.search).get("voter");
    if (!vid) { deepLinkApplied.current = true; return; }
    const v = voters.find((x) => x.id === vid);
    if (!v) return;
    deepLinkApplied.current = true;
    setFilterText(`${v.firstName} ${v.lastName}`);
    handleSelectVoter(v);
  }, [voters, handleSelectVoter]);

  const handleNavigate = (direction: "prev" | "next") => {
    if (!filteredVoters.length) return;
    const nextIndex = selectedIndex === -1
      ? direction === "next" ? 0 : filteredVoters.length - 1
      : direction === "next"
        ? (selectedIndex + 1) % filteredVoters.length
        : (selectedIndex - 1 + filteredVoters.length) % filteredVoters.length;
    handleSelectVoter(filteredVoters[nextIndex]);
  };

  // Save
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVoter || !formCallStatusId || !formStatusId) return;
    setSaving(true); setSaveError("");
    const log: ConversationLog = {
      id: generateId(), voterId: selectedVoter.id, userId: currentUser?.id ?? "",
      timestamp: new Date().toISOString(), callStatus: formCallStatusId, statusId: formStatusId, notes: formNotes.trim(),
      tenantId: getActiveTenant() ?? undefined,
    };
    try {
      await setDoc(doc(db, "conversationLogs", log.id), log);
      updateVoter({ ...selectedVoter, statusId: formStatusId, lastCallStatusId: formCallStatusId, hasVoted: formHasVoted });
      setLogs((prev) => [log, ...prev]);
      setFormNotes("");
    } catch { setSaveError("שגיאה בשמירה — בדוק חיבור ונסה שוב."); }
    finally { setSaving(false); }
  };

  // Helpers
  const getVoterStatus = (v: Voter) => statuses.find((s) => s.id === (v.statusId ?? defaultStatusId)) ?? null;
  const getVoterGroups = (v: Voter) => groups.filter((g) => v.groupIds.includes(g.id));
  const getVoterGroupLeader = (v: Voter) => {
    for (const g of getVoterGroups(v)) {
      if (g.groupLeaderId) { const gl = groupLeaders.find((l) => l.id === g.groupLeaderId); if (gl) return gl; }
    }
    return null;
  };
  const getCallStatus = (id: string) => callStatuses.find((c) => c.id === id) ?? null;
  const getSupportStatus = (id: string) => statuses.find((s) => s.id === id) ?? null;
  const canSave = !saving && !!formCallStatusId && !!formStatusId;

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, color: "#032147", fontSize: 26, fontWeight: 800 }}>מרכז טלמרקטינג</h1>
        <p style={{ margin: "4px 0 0", color: "#888", fontSize: 14 }}>חיפוש בוחרים, תיעוד שיחות ועדכון סטטוס תמיכה</p>
      </div>

      <div className="tele-panels">

        {/* ── Filter + List ─────────────────────────────────────────────────── */}
        <div className="tele-list-panel">
          <div style={{ padding: "16px 18px 12px", borderBottom: "1px solid #f1f5f9", background: "#fafbfc" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <Search size={15} color="#753991" />
              <span style={{ color: "#032147", fontWeight: 700, fontSize: 14 }}>סינון בוחרים</span>
              {hasActiveFilter && (
                <button onClick={clearFilters} style={{ marginRight: "auto", display: "flex", alignItems: "center", gap: 4, padding: "3px 10px", background: "#fee2e2", border: "none", borderRadius: 20, color: "#dc2626", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                  <X size={11} /> נקה הכל
                </button>
              )}
            </div>

            {/* Free text */}
            <div style={{ position: "relative", marginBottom: 8 }}>
              <Search size={13} color="#aaa" style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
              <input value={filterText} onChange={(e) => setFilterText(e.target.value)} placeholder="שם, ת.ז, טלפון..."
                style={{ width: "100%", padding: "8px 32px 8px 10px", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box", background: "#fff" }} />
            </div>

            {/* Row 1: status + call status */}
            <div className="filter-row-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7, marginBottom: 7 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, color: "#888", marginBottom: 3, fontWeight: 600 }}>סטטוס תמיכה</label>
                <select value={filterStatusId} onChange={(e) => setFilterStatusId(e.target.value)}
                  style={{ width: "100%", padding: "7px 8px", border: "1.5px solid #e2e8f0", borderRadius: 7, fontSize: 12, color: "#374151", background: "#fff", outline: "none" }}>
                  <option value="">הכל</option>
                  {statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, color: "#888", marginBottom: 3, fontWeight: 600 }}>תוצאת שיחה אחרונה</label>
                <select value={filterCallStatusId} onChange={(e) => setFilterCallStatusId(e.target.value)}
                  style={{ width: "100%", padding: "7px 8px", border: "1.5px solid #e2e8f0", borderRadius: 7, fontSize: 12, color: "#374151", background: "#fff", outline: "none" }}>
                  <option value="">הכל</option>
                  {callStatuses.map((cs) => <option key={cs.id} value={cs.id}>{cs.name}</option>)}
                </select>
              </div>
            </div>

            {/* Row 2: group + group leader */}
            <div className="filter-row-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7, marginBottom: 7 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, color: "#888", marginBottom: 3, fontWeight: 600 }}>קבוצה</label>
                <select value={filterGroupId} onChange={(e) => { setFilterGroupId(e.target.value); setFilterSubGroupId(""); }}
                  style={{ width: "100%", padding: "7px 8px", border: "1.5px solid #e2e8f0", borderRadius: 7, fontSize: 12, color: "#374151", background: "#fff", outline: "none" }}>
                  <option value="">הכל</option>
                  {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, color: "#888", marginBottom: 3, fontWeight: 600 }}>תת-קבוצה</label>
                <select value={filterSubGroupId} onChange={(e) => setFilterSubGroupId(e.target.value)}
                  style={{ width: "100%", padding: "7px 8px", border: "1.5px solid #e2e8f0", borderRadius: 7, fontSize: 12, color: "#374151", background: "#fff", outline: "none" }}>
                  <option value="">הכל</option>
                  {(filterGroupId ? subGroups.filter(sg => sg.parentGroupId === filterGroupId) : subGroups).map(sg => {
                    const parentName = groups.find(g => g.id === sg.parentGroupId)?.name;
                    return <option key={sg.id} value={sg.id}>{sg.name}{!filterGroupId ? ` (${parentName})` : ""}</option>;
                  })}
                </select>
              </div>
            </div>

            {/* Row 2b: group leader */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7, marginBottom: 7 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, color: "#888", marginBottom: 3, fontWeight: 600 }}>ראש קבוצה</label>
                <select value={filterGroupLeaderId} onChange={(e) => setFilterGroupLeaderId(e.target.value)}
                  style={{ width: "100%", padding: "7px 8px", border: "1.5px solid #e2e8f0", borderRadius: 7, fontSize: 12, color: "#374151", background: "#fff", outline: "none" }}>
                  <option value="">הכל</option>
                  {groupLeaders.map((gl) => <option key={gl.id} value={gl.id}>{gl.firstName} {gl.lastName}</option>)}
                </select>
              </div>
            </div>

            {/* Row 3: street + voted filter */}
            <div className="filter-row-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7, marginBottom: 7 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, color: "#888", marginBottom: 3, fontWeight: 600 }}>רחוב</label>
                <input value={filterStreet} onChange={(e) => setFilterStreet(e.target.value)} placeholder="שם רחוב..."
                  style={{ width: "100%", padding: "7px 8px", border: "1.5px solid #e2e8f0", borderRadius: 7, fontSize: 12, outline: "none", boxSizing: "border-box", background: "#fff" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, color: "#888", marginBottom: 3, fontWeight: 600 }}>הצבעה</label>
                <select value={filterVoted} onChange={(e) => setFilterVoted(e.target.value as "" | "yes" | "no")}
                  style={{ width: "100%", padding: "7px 8px", border: "1.5px solid #e2e8f0", borderRadius: 7, fontSize: 12, color: "#374151", background: "#fff", outline: "none" }}>
                  <option value="">הכל</option>
                  <option value="yes">✓ הצביע</option>
                  <option value="no">✗ לא הצביע</option>
                </select>
              </div>
            </div>

            {/* Active filter badges */}
            {hasActiveFilter && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 8 }}>
                {filterStatusId && statuses.find(s => s.id === filterStatusId) && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: statuses.find(s => s.id === filterStatusId)!.color + "22", color: statuses.find(s => s.id === filterStatusId)!.color }}>
                    {statuses.find(s => s.id === filterStatusId)!.name}<X size={9} style={{ cursor: "pointer" }} onClick={() => setFilterStatusId("")} />
                  </span>
                )}
                {filterCallStatusId && callStatuses.find(cs => cs.id === filterCallStatusId) && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: callStatuses.find(cs => cs.id === filterCallStatusId)!.color + "22", color: callStatuses.find(cs => cs.id === filterCallStatusId)!.color }}>
                    <Phone size={9} />{callStatuses.find(cs => cs.id === filterCallStatusId)!.name}<X size={9} style={{ cursor: "pointer" }} onClick={() => setFilterCallStatusId("")} />
                  </span>
                )}
                {filterVoted && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: filterVoted === "yes" ? "#dcfce7" : "#fee2e2", color: filterVoted === "yes" ? "#16a34a" : "#dc2626" }}>
                    {filterVoted === "yes" ? "✓ הצביע" : "✗ לא הצביע"}<X size={9} style={{ cursor: "pointer" }} onClick={() => setFilterVoted("")} />
                  </span>
                )}
                {filterText && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: "#f1f5f9", color: "#475569" }}>
                    "{filterText}"<X size={9} style={{ cursor: "pointer" }} onClick={() => setFilterText("")} />
                  </span>
                )}
              </div>
            )}
          </div>

          {/* List header */}
          <div style={{ padding: "9px 18px", borderBottom: "1px solid #f1f5f9", background: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ color: "#032147", fontWeight: 700, fontSize: 13 }}>רשימת עבודה</span>
            <span style={{ background: filteredVoters.length > 0 ? "#ecad0a" : "#e5e7eb", color: filteredVoters.length > 0 ? "#7a5500" : "#9ca3af", fontSize: 12, fontWeight: 700, padding: "2px 10px", borderRadius: 20 }}>
              {filteredVoters.length}
            </span>
          </div>

          {/* Voter cards */}
          <div ref={voterListRef} style={{ overflowY: "auto", maxHeight: "52vh" }}>
            {filteredVoters.length === 0 ? (
              <div style={{ padding: "40px 20px", textAlign: "center" }}>
                <Search size={28} color="#d1d5db" style={{ margin: "0 auto 10px", display: "block" }} />
                <div style={{ color: "#9ca3af", fontSize: 13 }}>לא נמצאו בוחרים</div>
              </div>
            ) : (
              <>
                {visibleVoters.map((v) => {
                  const status = getVoterStatus(v);
                  const lastCallSt = v.lastCallStatusId ? getCallStatus(v.lastCallStatusId) : null;
                  const isSelected = v.id === selectedVoterId;
                  const avatarColor = stringToColor(v.id);
                  return (
                    <button key={v.id} onClick={() => handleSelectVoter(v)}
                      style={{ width: "100%", padding: "10px 14px", display: "flex", alignItems: "center", gap: 11, background: isSelected ? "#f0f7ff" : "#fff", border: "none", borderBottom: "1px solid var(--border, #f1f5f9)", borderRight: isSelected ? "3px solid #209dd7" : "3px solid transparent", cursor: "pointer", textAlign: "right", transition: "background 0.12s" }}>
                      <div style={{ flexShrink: 0, width: 38, height: 38, borderRadius: "50%", background: isSelected ? "#209dd7" : avatarColor, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 13, transition: "background 0.12s", position: "relative" }}>
                        {getInitials(v.firstName, v.lastName)}
                        {v.hasVoted && (
                          <span style={{ position: "absolute", bottom: -2, left: -2, width: 14, height: 14, borderRadius: "50%", background: "#22c55e", border: "2px solid #fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, color: "#fff", fontWeight: 700 }}>✓</span>
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, marginBottom: 3 }}>
                          <span style={{ color: isSelected ? "#032147" : "#1e293b", fontWeight: isSelected ? 700 : 600, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {v.firstName} {v.lastName}
                          </span>
                          {status && (
                            <span style={{ flexShrink: 0, padding: "1px 7px", borderRadius: 20, fontSize: 10, fontWeight: 700, background: status.color + "22", color: status.color, border: `1px solid ${status.color}33` }}>
                              {status.name}
                            </span>
                          )}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          {v.phone && (
                            <span style={{ display: "flex", alignItems: "center", gap: 4, color: "#64748b", fontSize: 11, direction: "ltr" }}>
                              <Phone size={10} color="#94a3b8" />{v.phone}
                            </span>
                          )}
                          {lastCallSt && (
                            <span style={{ display: "flex", alignItems: "center", gap: 4, padding: "1px 6px", borderRadius: 20, fontSize: 10, fontWeight: 600, background: lastCallSt.color + "18", color: lastCallSt.color }}>
                              <PhoneCall size={9} />{lastCallSt.name}
                            </span>
                          )}
                          {v.hasVoted && (
                            <span style={{ display: "flex", alignItems: "center", gap: 3, padding: "1px 6px", borderRadius: 20, fontSize: 10, fontWeight: 700, background: "#dcfce7", color: "#16a34a" }}>
                              ✓ הצביע
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
                <ScrollSentinel onIntersect={listLoadMore} root={voterListRef.current} />
              </>
            )}
          </div>
          <PaginationFooter showing={listShowing} total={filteredVoters.length} hasMore={listHasMore} entityLabel="בוחרים" />
        </div>

        {/* ── Workspace ────────────────────────────────────────────────────── */}
        <div className="tele-workspace">
          {!selectedVoter ? (
            <div style={{ background: "#fff", borderRadius: 14, border: "1.5px solid #f1f5f9", boxShadow: "0 2px 16px rgba(0,0,0,0.06)", padding: "64px 40px", display: "flex", flexDirection: "column", alignItems: "center", gap: 14, minHeight: 300 }}>
              <div style={{ width: 70, height: 70, borderRadius: "50%", background: "linear-gradient(135deg,rgba(117,57,145,0.08),rgba(32,157,215,0.12))", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <PhoneCall size={30} color="#753991" />
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ color: "#032147", fontWeight: 700, fontSize: 17 }}>בחר בוחר מהרשימה</div>
                <div style={{ color: "#9ca3af", fontSize: 13, marginTop: 6, lineHeight: 1.5 }}>סנן את הרשימה ולחץ על בוחר<br />כדי לפתוח את מסך תיעוד השיחה</div>
              </div>
              {filteredVoters.length > 0 && (
                <button onClick={() => handleSelectVoter(filteredVoters[0])}
                  style={{ marginTop: 6, padding: "10px 28px", background: "#753991", color: "#fff", border: "none", borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                  התחל עם הבוחר הראשון
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

              {/* Nav bar */}
              <div style={{ background: "#032147", borderRadius: 12, padding: "10px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 8, zIndex: 20, boxShadow: "0 4px 14px rgba(3,33,71,0.25)" }}>
                <button onClick={() => handleNavigate("prev")} disabled={filteredVoters.length <= 1}
                  style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 14px", borderRadius: 7, border: "none", background: "rgba(255,255,255,0.1)", color: "#fff", fontWeight: 600, fontSize: 13, cursor: filteredVoters.length <= 1 ? "not-allowed" : "pointer", opacity: filteredVoters.length <= 1 ? 0.4 : 1 }}>
                  <ChevronRight size={14} /> הקודם
                </button>
                <div style={{ textAlign: "center" }}>
                  <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 11 }}>בוחר</div>
                  <div style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>{selectedIndex + 1} / {filteredVoters.length}</div>
                </div>
                <button onClick={() => handleNavigate("next")} disabled={filteredVoters.length <= 1}
                  style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 14px", borderRadius: 7, border: "none", background: "rgba(255,255,255,0.1)", color: "#fff", fontWeight: 600, fontSize: 13, cursor: filteredVoters.length <= 1 ? "not-allowed" : "pointer", opacity: filteredVoters.length <= 1 ? 0.4 : 1 }}>
                  הבא <ChevronLeft size={14} />
                </button>
              </div>

              {/* Voter card */}
              <div style={{ background: "#fff", borderRadius: 14, border: "1.5px solid #f1f5f9", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", overflow: "hidden" }}>
                <div style={{ background: "linear-gradient(135deg,#032147,#0d3d73)", padding: "18px 22px", display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ width: 52, height: 52, borderRadius: "50%", background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 18, flexShrink: 0 }}>
                    {getInitials(selectedVoter.firstName, selectedVoter.lastName)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h2 style={{ margin: "0 0 4px", color: "#fff", fontSize: 20, fontWeight: 800 }}>{selectedVoter.firstName} {selectedVoter.lastName}</h2>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
                      <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 13 }}>ת.ז: {selectedVoter.uniqueId}</span>
                      {selectedVoter.phone && (
                        <span style={{ display: "flex", alignItems: "center", gap: 5, color: "rgba(255,255,255,0.9)", fontSize: 13, direction: "ltr" }}>
                          <Phone size={12} />{selectedVoter.phone}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
                    {getVoterStatus(selectedVoter) && (
                      <span style={{ padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700, background: getVoterStatus(selectedVoter)!.color + "33", color: "#fff", border: `1.5px solid ${getVoterStatus(selectedVoter)!.color}66` }}>
                        {getVoterStatus(selectedVoter)!.name}
                      </span>
                    )}
                    {selectedVoter.hasVoted && (
                      <span style={{ display: "flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: "rgba(34,197,94,0.25)", color: "#86efac" }}>
                        ✓ הצביע
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ padding: "14px 22px" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 5, color: "#475569", fontSize: 13 }}>
                    <MapPin size={13} color="#94a3b8" />{buildAddress(selectedVoter)}
                    {selectedVoter.address.apartment && <span style={{ color: "#94a3b8", fontSize: 12 }}> · דירה {selectedVoter.address.apartment}</span>}
                  </span>
                  <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 7 }}>
                    {getVoterGroups(selectedVoter).map((g) => (
                      <span key={g.id} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 20, fontSize: 11, background: "rgba(32,157,215,0.09)", color: "#0e6fa0", fontWeight: 500 }}>
                        <Users size={10} />{g.name}
                      </span>
                    ))}
                    {(() => { const gl = getVoterGroupLeader(selectedVoter); return gl ? (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 20, fontSize: 11, background: "rgba(117,57,145,0.09)", color: "#753991", fontWeight: 500 }}>
                        <User size={10} />ראש קבוצה: {gl.firstName} {gl.lastName}
                      </span>
                    ) : null; })()}
                  </div>
                </div>
              </div>

              {/* Call form */}
              <div style={{ background: "#fff", borderRadius: 14, border: "1.5px solid #f1f5f9", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", padding: "20px 22px" }}>
                <h3 style={{ margin: "0 0 16px", color: "#032147", fontSize: 15, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(117,57,145,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Phone size={13} color="#753991" />
                  </div>
                  תיעוד שיחה חדשה
                </h3>
                <form onSubmit={handleSave}>
                  <div className="form-2col" style={{ marginBottom: 14 }}>
                    <div>
                      <label style={{ display: "block", marginBottom: 5, color: "#374151", fontWeight: 600, fontSize: 12 }}>תוצאת השיחה <span style={{ color: "#dc2626" }}>*</span></label>
                      <select value={formCallStatusId} onChange={(e) => setFormCallStatusId(e.target.value)} required
                        style={{ width: "100%", padding: "8px 10px", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 13, outline: "none", background: "#fff", color: "#374151" }}>
                        <option value="">בחר תוצאה...</option>
                        {callStatuses.map((cs) => <option key={cs.id} value={cs.id}>{cs.name}</option>)}
                      </select>
                      {formCallStatusId && getCallStatus(formCallStatusId) && (
                        <div style={{ marginTop: 5, display: "inline-flex", alignItems: "center", gap: 5, padding: "2px 9px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: getCallStatus(formCallStatusId)!.color + "22", color: getCallStatus(formCallStatusId)!.color }}>
                          <span style={{ width: 7, height: 7, borderRadius: "50%", background: getCallStatus(formCallStatusId)!.color }} />{getCallStatus(formCallStatusId)!.name}
                        </div>
                      )}
                    </div>
                    <div>
                      <label style={{ display: "block", marginBottom: 5, color: "#374151", fontWeight: 600, fontSize: 12 }}>סטטוס תמיכה <span style={{ color: "#dc2626" }}>*</span></label>
                      <select value={formStatusId} onChange={(e) => setFormStatusId(e.target.value)} required
                        style={{ width: "100%", padding: "8px 10px", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 13, outline: "none", background: "#fff", color: "#374151" }}>
                        <option value="">בחר סטטוס...</option>
                        {statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                      {formStatusId && getSupportStatus(formStatusId) && (
                        <div style={{ marginTop: 5, display: "inline-flex", alignItems: "center", gap: 5, padding: "2px 9px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: getSupportStatus(formStatusId)!.color + "22", color: getSupportStatus(formStatusId)!.color }}>
                          <span style={{ width: 7, height: 7, borderRadius: "50%", background: getSupportStatus(formStatusId)!.color }} />{getSupportStatus(formStatusId)!.name}
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ marginBottom: 14 }}>
                    <label style={{ display: "block", marginBottom: 5, color: "#374151", fontWeight: 600, fontSize: 12 }}>הערות שיחה</label>
                    <textarea value={formNotes} onChange={(e) => setFormNotes(e.target.value)} rows={3} placeholder="סיכום קצר של השיחה..."
                      style={{ width: "100%", padding: "9px 10px", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 13, outline: "none", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }} />
                  </div>

                  {/* Voted checkbox */}
                  <div style={{ marginBottom: 18, padding: "12px 16px", borderRadius: 10, background: formHasVoted ? "#f0fdf4" : "#fafbfc", border: `1.5px solid ${formHasVoted ? "#86efac" : "#e2e8f0"}`, transition: "all 0.2s" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
                      <div
                        onClick={() => setFormHasVoted(!formHasVoted)}
                        style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${formHasVoted ? "#22c55e" : "#d1d5db"}`, background: formHasVoted ? "#22c55e" : "#fff", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s", cursor: "pointer", flexShrink: 0 }}>
                        {formHasVoted && <span style={{ color: "#fff", fontSize: 13, fontWeight: 700 }}>✓</span>}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: formHasVoted ? "#16a34a" : "#374151" }}>
                          הצביע בבחירות
                        </div>
                        <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 1 }}>
                          {formHasVoted ? "מסומן כמצביע — יופיע בדוח שיעורי ההצבעה" : "סמן אם הבוחר דיווח שהצביע"}
                        </div>
                      </div>
                    </label>
                  </div>

                  {saveError && (
                    <div style={{ marginBottom: 10, padding: "8px 12px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, fontSize: 12, color: "#dc2626" }}>{saveError}</div>
                  )}

                  <div style={{ display: "flex", gap: 10 }}>
                    <button type="submit" disabled={!canSave}
                      style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "10px", background: canSave ? "#753991" : "#e5e7eb", color: canSave ? "#fff" : "#9ca3af", border: "none", borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: !canSave ? "not-allowed" : "pointer", transition: "background 0.15s" }}>
                      {saving ? <Loader2 size={15} className="spin" /> : <CheckCircle2 size={15} />}
                      {saving ? "שומר..." : "שמור שיחה"}
                    </button>
                    {filteredVoters.length > 1 && (
                      <button type="button" disabled={!canSave}
                        onClick={() => { handleSave({ preventDefault: () => {} } as React.FormEvent); setTimeout(() => handleNavigate("next"), 300); }}
                        style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 16px", background: canSave ? "#032147" : "#e5e7eb", color: canSave ? "#fff" : "#9ca3af", border: "none", borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: !canSave ? "not-allowed" : "pointer", whiteSpace: "nowrap" }}>
                        שמור ועבור לבא <ChevronLeft size={14} />
                      </button>
                    )}
                  </div>
                </form>
              </div>

              {/* Personal reminder */}
              <div style={{ background: "#fff", borderRadius: 14, border: "1.5px solid #f1f5f9", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", padding: "16px 22px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <h3 style={{ margin: 0, color: "#032147", fontSize: 15, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(32,157,215,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Bell size={13} color="#209dd7" />
                    </div>
                    תזכורת אישית
                  </h3>
                  {reminderSaved
                    ? <span style={{ display: "flex", alignItems: "center", gap: 5, color: "#16a34a", fontSize: 13, fontWeight: 600 }}><CheckCircle2 size={14} /> התזכורת נשמרה</span>
                    : !showReminder && (
                      <button type="button" onClick={() => setShowReminder(true)}
                        style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, border: "1.5px solid var(--blue-primary, #209dd7)", background: "#fff", color: "#209dd7", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                        <Bell size={13} /> הוסף תזכורת
                      </button>
                    )}
                </div>
                {showReminder && (
                  <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                    <textarea value={reminderText} onChange={(e) => setReminderText(e.target.value)} rows={2}
                      placeholder="למשל: ביקש שנחזור אליו בנושא הארנונה"
                      style={{ width: "100%", padding: "9px 10px", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 13, outline: "none", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }} />
                    <div>
                      <label style={{ display: "block", fontSize: 12, color: "#64748b", fontWeight: 600, marginBottom: 8 }}>מועד התזכורת (אופציונלי):</label>
                      <DateTimePicker value={reminderDue} onChange={setReminderDue} />
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button type="button" onClick={saveReminder} disabled={!reminderText.trim()}
                        style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 18px", borderRadius: 8, border: "none", background: reminderText.trim() ? "#209dd7" : "#e5e7eb", color: reminderText.trim() ? "#fff" : "#9ca3af", fontWeight: 700, fontSize: 13, cursor: reminderText.trim() ? "pointer" : "not-allowed" }}>
                        <Bell size={13} /> שמור תזכורת
                      </button>
                      <button type="button" onClick={() => { setShowReminder(false); setReminderText(""); setReminderDue(""); }}
                        style={{ padding: "8px 16px", borderRadius: 8, border: "1.5px solid var(--border, #e2e8f0)", background: "#fff", color: "#64748b", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
                        ביטול
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* History */}
              <div style={{ background: "#fff", borderRadius: 14, border: "1.5px solid #f1f5f9", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", padding: "20px 22px" }}>
                <h3 style={{ margin: "0 0 14px", color: "#032147", fontSize: 15, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(32,157,215,0.08)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Clock size={13} color="#209dd7" />
                  </div>
                  היסטוריית שיחות
                  {logs.length > 0 && <span style={{ marginRight: "auto", background: "#f1f5f9", color: "#64748b", borderRadius: 20, padding: "1px 10px", fontSize: 12, fontWeight: 700 }}>{logs.length}</span>}
                </h3>
                {logsLoading ? (
                  <div style={{ textAlign: "center", padding: "28px", color: "#888" }}>
                    <Loader2 size={22} className="spin" style={{ margin: "0 auto 8px", display: "block" }} />
                    <div style={{ fontSize: 13 }}>טוען היסטוריה...</div>
                  </div>
                ) : logsLoadError ? (
                  <div style={{ padding: "16px", background: "#fef2f2", borderRadius: 10, fontSize: 13, color: "#dc2626", textAlign: "center" }}>שגיאה בטעינת היסטוריה</div>
                ) : logs.length === 0 ? (
                  <div style={{ padding: "28px", textAlign: "center", background: "#fafbfc", borderRadius: 10 }}>
                    <Clock size={22} color="#d1d5db" style={{ margin: "0 auto 8px", display: "block" }} />
                    <div style={{ color: "#9ca3af", fontSize: 13 }}>אין שיחות קודמות</div>
                  </div>
                ) : (
                  <div style={{ position: "relative", paddingRight: 22, maxHeight: "40vh", overflowY: "auto" }}>
                    <div style={{ position: "absolute", right: 7, top: 4, bottom: 4, width: 2, background: "linear-gradient(to bottom,#6366f1,#e0e7ff)", borderRadius: 2 }} />
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      {logs.map((log) => {
                        const cs = getCallStatus(log.callStatus);
                        const ss = getSupportStatus(log.statusId);
                        const logUser = state.users.find((u) => u.id === log.userId);
                        return (
                          <div key={log.id} style={{ position: "relative", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 10, padding: "12px 14px" }}>
                            <div style={{ position: "absolute", right: -18, top: 14, width: 9, height: 9, borderRadius: "50%", background: "#6366f1", border: "2px solid #fff", boxShadow: "0 0 0 2px #6366f1" }} />
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                {cs && <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: cs.color + "22", color: cs.color }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: cs.color }} />{cs.name}</span>}
                                {ss && <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: ss.color + "22", color: ss.color }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: ss.color }} />{ss.name}</span>}
                              </div>
                              <div style={{ flexShrink: 0, marginRight: 8 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 4, color: "#94a3b8", fontSize: 11 }}><Clock size={10} />{formatDate(log.timestamp)}</div>
                                {logUser && <div style={{ fontSize: 10, color: "#b0b8c4", marginTop: 2 }}>{logUser.firstName} {logUser.lastName}</div>}
                              </div>
                            </div>
                            {log.notes
                              ? <p style={{ margin: 0, color: "#374151", fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{log.notes}</p>
                              : <p style={{ margin: 0, color: "#bbb", fontSize: 12, fontStyle: "italic" }}>אין הערות</p>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }
        .tele-panels { display: grid; grid-template-columns: 340px 1fr; gap: 20px; align-items: start; }
        .tele-list-panel { background: #fff; border-radius: 14px; border: 1.5px solid #f1f5f9; box-shadow: 0 2px 12px rgba(0,0,0,.06); overflow: hidden; }
        .tele-workspace { min-width: 0; }
        @media (max-width: 900px) {
          .tele-panels { grid-template-columns: 1fr; }
          .tele-list-panel { max-height: 50vh; overflow-y: auto; }
        }
      `}</style>
    </div>
  );
}
