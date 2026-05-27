"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { ConversationLog, Voter } from "@/types";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  setDoc,
  doc,
} from "firebase/firestore";
import {
  Phone,
  ChevronRight,
  ChevronLeft,
  PhoneCall,
  MapPin,
  User,
  Users,
  Clock,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { usePagination } from "@/hooks/usePagination";
import ScrollSentinel from "@/components/ui/ScrollSentinel";
import PaginationFooter from "@/components/ui/PaginationFooter";

const generateId = () =>
  `cl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("he-IL", {
      day: "2-digit", month: "2-digit", year: "2-digit",
      hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function buildAddress(v: Voter) {
  return [
    v.address.street,
    v.address.streetNumber,
    v.address.building ? `בניין ${v.address.building}` : "",
    v.address.apartment ? `דירה ${v.address.apartment}` : "",
    v.address.city,
  ].filter(Boolean).join(", ");
}

export default function TelemarketingPage() {
  const { state, updateVoter } = useStore();
  const { currentUser } = useAuth();
  const { voters, groups, groupLeaders, statuses, callStatuses } = state;

  // Filter state
  const [filterText, setFilterText] = useState("");
  const [filterStatusId, setFilterStatusId] = useState("");
  const [filterGroupId, setFilterGroupId] = useState("");
  const [filterGroupLeaderId, setFilterGroupLeaderId] = useState("");
  const [filterStreet, setFilterStreet] = useState("");

  // Workspace
  const [selectedVoterId, setSelectedVoterId] = useState<string | null>(null);
  const [logs, setLogs] = useState<ConversationLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // Form
  const [formCallStatusId, setFormCallStatusId] = useState("");
  const [formStatusId, setFormStatusId] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [logsLoadError, setLogsLoadError] = useState(false);

  // Set defaults when callStatuses / statuses load
  useEffect(() => {
    if (callStatuses.length > 0 && !formCallStatusId) {
      setFormCallStatusId(callStatuses[0].id);
    }
  }, [callStatuses, formCallStatusId]);

  const defaultStatusId = useMemo(
    () => statuses.find((s) => s.isDefault)?.id ?? statuses[0]?.id ?? "",
    [statuses]
  );

  // ── Filtered voters ──────────────────────────────────────────────────────────

  const filteredVoters = useMemo(() => {
    const text = filterText.toLowerCase().trim();
    return voters.filter((v) => {
      if (filterStatusId && (v.statusId ?? defaultStatusId) !== filterStatusId) return false;
      if (filterGroupId && !v.groupIds.includes(filterGroupId)) return false;
      if (filterGroupLeaderId) {
        const gl = groupLeaders.find((g) => g.id === filterGroupLeaderId);
        if (!gl || !v.groupIds.some((gid) => gl.groupIds.includes(gid))) return false;
      }
      if (filterStreet && !v.address.street.includes(filterStreet)) return false;
      if (text) {
        const name = `${v.firstName} ${v.lastName}`.toLowerCase();
        if (!name.includes(text) && !v.uniqueId.includes(text) && !(v.phone ?? "").includes(text))
          return false;
      }
      return true;
    });
  }, [voters, filterText, filterStatusId, filterGroupId, filterGroupLeaderId, filterStreet, defaultStatusId, groupLeaders]);

  const selectedVoter = useMemo(
    () => filteredVoters.find((v) => v.id === selectedVoterId) ?? null,
    [filteredVoters, selectedVoterId]
  );

  const voterListRef = useRef<HTMLDivElement>(null);
  const { visible: visibleVoters, hasMore: listHasMore, loadMore: listLoadMore, showing: listShowing } = usePagination(filteredVoters);

  const selectedIndex = useMemo(
    () => filteredVoters.findIndex((v) => v.id === selectedVoterId),
    [filteredVoters, selectedVoterId]
  );

  // ── Load logs ────────────────────────────────────────────────────────────────

  const loadLogs = useCallback(async (voterId: string) => {
    setLogsLoading(true);
    try {
      // No orderBy — avoids composite-index requirement; sort client-side instead
      const q = query(
        collection(db, "conversationLogs"),
        where("voterId", "==", voterId)
      );
      const snap = await getDocs(q);
      const loaded = snap.docs
        .map((d) => d.data() as ConversationLog)
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      setLogs(loaded);
    } catch (e) {
      console.error("Error loading logs:", e);
      setLogsLoadError(true);
      setLogs([]);
    } finally {
      setLogsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedVoterId) { setLogs([]); return; }
    setLogsLoadError(false);
    loadLogs(selectedVoterId);
  }, [selectedVoterId, loadLogs]);

  // ── Select voter ─────────────────────────────────────────────────────────────

  const handleSelectVoter = (v: Voter) => {
    setSelectedVoterId(v.id);
    setFormCallStatusId(callStatuses[0]?.id ?? "");
    setFormStatusId(v.statusId ?? defaultStatusId);
    setFormNotes("");
  };

  const handleNavigate = (direction: "prev" | "next") => {
    if (filteredVoters.length === 0) return;
    const nextIndex =
      selectedIndex === -1
        ? direction === "next" ? 0 : filteredVoters.length - 1
        : direction === "next"
        ? (selectedIndex + 1) % filteredVoters.length
        : (selectedIndex - 1 + filteredVoters.length) % filteredVoters.length;
    handleSelectVoter(filteredVoters[nextIndex]);
  };

  // ── Save conversation ────────────────────────────────────────────────────────

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVoter || !formCallStatusId || !formStatusId) return;
    setSaving(true);

    const log: ConversationLog = {
      id: generateId(),
      voterId: selectedVoter.id,
      userId: currentUser?.id ?? "",
      timestamp: new Date().toISOString(),
      callStatus: formCallStatusId,
      statusId: formStatusId,
      notes: formNotes.trim(),
    };

    setSaveError("");
    try {
      await setDoc(doc(db, "conversationLogs", log.id), log);
      updateVoter({ ...selectedVoter, statusId: formStatusId });
      setLogs((prev) => [log, ...prev]);
      setFormNotes("");
    } catch (e) {
      console.error("Error saving conversation:", e);
      setSaveError("שגיאה בשמירה — בדוק חיבור ונסה שוב.");
    } finally {
      setSaving(false);
    }
  };

  // ── Helpers ──────────────────────────────────────────────────────────────────

  const getVoterStatus = (v: Voter) =>
    statuses.find((s) => s.id === (v.statusId ?? defaultStatusId)) ?? null;

  const getVoterGroups = (v: Voter) =>
    groups.filter((g) => v.groupIds.includes(g.id));

  const getVoterGroupLeader = (v: Voter) => {
    for (const g of getVoterGroups(v)) {
      if (g.groupLeaderId) {
        const gl = groupLeaders.find((l) => l.id === g.groupLeaderId);
        if (gl) return gl;
      }
    }
    return null;
  };

  const getCallStatus = (id: string) => callStatuses.find((c) => c.id === id) ?? null;
  const getSupportStatus = (id: string) => statuses.find((s) => s.id === id) ?? null;

  const canSave = !saving && !!formCallStatusId && !!formStatusId;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ margin: 0, color: "#032147", fontSize: 28, fontWeight: 800 }}>מרכז טלמרקטינג</h1>
        <p style={{ margin: "6px 0 0", color: "#888", fontSize: 14 }}>
          חיפוש בוחרים, תיעוד שיחות ועדכון סטטוס תמיכה
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "380px 1fr", gap: 24, alignItems: "start" }}>

        {/* ── Filter + List panel ──────────────────────────────────────────── */}
        <div style={{ background: "#fff", borderRadius: 14, border: "1.5px solid #f1f5f9", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", overflow: "hidden" }}>

          {/* Filters */}
          <div style={{ padding: "18px 20px 14px", borderBottom: "1px solid #f1f5f9", background: "#fafbfc" }}>
            <div style={{ color: "#032147", fontWeight: 700, fontSize: 15, marginBottom: 14 }}>סינון בוחרים</div>

            <input
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="חיפוש חופשי: שם, ת.ז, טלפון..."
              style={{ width: "100%", padding: "9px 12px", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 14, marginBottom: 10, outline: "none", boxSizing: "border-box" }}
            />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
              <select value={filterStatusId} onChange={(e) => setFilterStatusId(e.target.value)}
                style={{ padding: "8px 10px", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 13, color: "#374151", background: "#fff", outline: "none" }}>
                <option value="">כל הסטטוסים</option>
                {statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>

              <select value={filterGroupId} onChange={(e) => setFilterGroupId(e.target.value)}
                style={{ padding: "8px 10px", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 13, color: "#374151", background: "#fff", outline: "none" }}>
                <option value="">כל הקבוצות</option>
                {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <select value={filterGroupLeaderId} onChange={(e) => setFilterGroupLeaderId(e.target.value)}
                style={{ padding: "8px 10px", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 13, color: "#374151", background: "#fff", outline: "none" }}>
                <option value="">כל ראשי הקבוצה</option>
                {groupLeaders.map((gl) => <option key={gl.id} value={gl.id}>{gl.firstName} {gl.lastName}</option>)}
              </select>

              <input value={filterStreet} onChange={(e) => setFilterStreet(e.target.value)}
                placeholder="רחוב..."
                style={{ padding: "8px 10px", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 13, outline: "none" }} />
            </div>

            {(filterText || filterStatusId || filterGroupId || filterGroupLeaderId || filterStreet) && (
              <button
                onClick={() => { setFilterText(""); setFilterStatusId(""); setFilterGroupId(""); setFilterGroupLeaderId(""); setFilterStreet(""); }}
                style={{ marginTop: 10, width: "100%", padding: "7px", border: "1.5px solid #e2e8f0", borderRadius: 8, background: "#fff", color: "#888", fontSize: 13, cursor: "pointer" }}>
                נקה סינון
              </button>
            )}
          </div>

          {/* Results list header */}
          <div style={{ padding: "10px 20px", borderBottom: "1px solid #f1f5f9", background: "#fafbfc", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ color: "#032147", fontWeight: 600, fontSize: 13 }}>רשימת עבודה</span>
            <span style={{ background: "#ecad0a", color: "#7a5500", fontSize: 12, fontWeight: 700, padding: "2px 10px", borderRadius: 20 }}>
              {filteredVoters.length}
            </span>
          </div>

          {/* Results */}
          <div ref={voterListRef} style={{ maxHeight: "52vh", overflowY: "auto" }}>
            {filteredVoters.length === 0 ? (
              <div style={{ padding: "32px 20px", textAlign: "center", color: "#888", fontSize: 14 }}>לא נמצאו בוחרים</div>
            ) : (
              <>
              {visibleVoters.map((v, idx) => {
                const status = getVoterStatus(v);
                const isSelected = v.id === selectedVoterId;
                return (
                  <button key={v.id} onClick={() => handleSelectVoter(v)}
                    style={{ width: "100%", padding: "11px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", background: isSelected ? "#f0f7ff" : idx % 2 === 0 ? "#fff" : "#fafbfc", borderBottom: "1px solid #f1f5f9", borderRight: isSelected ? "3px solid #209dd7" : "3px solid transparent", cursor: "pointer", textAlign: "right", transition: "background 0.15s" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: isSelected ? "#032147" : "#1e293b", fontWeight: isSelected ? 700 : 500, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {v.firstName} {v.lastName}
                      </div>
                      <div style={{ color: "#888", fontSize: 12, marginTop: 2 }}>{v.phone ?? "—"}</div>
                    </div>
                    {status && (
                      <span style={{ flexShrink: 0, marginRight: 10, padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: status.color + "22", color: status.color, border: `1px solid ${status.color}44` }}>
                        {status.name}
                      </span>
                    )}
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
        <div>
          {!selectedVoter ? (
            <div style={{ background: "#fff", borderRadius: 14, border: "1.5px solid #f1f5f9", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", padding: "80px 40px", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
              <div style={{ width: 72, height: 72, borderRadius: "50%", background: "rgba(32,157,215,0.08)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <PhoneCall size={32} color="#209dd7" />
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ color: "#032147", fontWeight: 700, fontSize: 17 }}>בחר בוחר מהרשימה</div>
                <div style={{ color: "#888", fontSize: 14, marginTop: 6 }}>לאחר בחירה יוצגו כאן פרטי הבוחר, טופס תיעוד השיחה והיסטוריית השיחות</div>
              </div>
              {filteredVoters.length > 0 && (
                <button onClick={() => handleSelectVoter(filteredVoters[0])}
                  style={{ marginTop: 8, padding: "10px 24px", background: "#753991", color: "#fff", border: "none", borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                  התחל עם הבוחר הראשון
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

              {/* Nav + voter card */}
              <div style={{ background: "#fff", borderRadius: 14, border: "1.5px solid #f1f5f9", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", overflow: "hidden" }}>
                {/* Nav bar */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 18px", background: "#032147" }}>
                  <button onClick={() => handleNavigate("prev")} disabled={filteredVoters.length <= 1}
                    style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 14px", borderRadius: 7, border: "none", background: "rgba(255,255,255,0.1)", color: "#fff", fontWeight: 600, fontSize: 13, cursor: filteredVoters.length <= 1 ? "not-allowed" : "pointer", opacity: filteredVoters.length <= 1 ? 0.4 : 1 }}>
                    <ChevronRight size={14} />הקודם
                  </button>
                  <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 13 }}>{selectedIndex + 1} / {filteredVoters.length}</span>
                  <button onClick={() => handleNavigate("next")} disabled={filteredVoters.length <= 1}
                    style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 14px", borderRadius: 7, border: "none", background: "rgba(255,255,255,0.1)", color: "#fff", fontWeight: 600, fontSize: 13, cursor: filteredVoters.length <= 1 ? "not-allowed" : "pointer", opacity: filteredVoters.length <= 1 ? 0.4 : 1 }}>
                    הבא<ChevronLeft size={14} />
                  </button>
                </div>

                {/* Voter details */}
                <div style={{ padding: "20px 24px" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                    <div>
                      <h2 style={{ margin: "0 0 10px", color: "#032147", fontSize: 22, fontWeight: 800 }}>
                        {selectedVoter.firstName} {selectedVoter.lastName}
                      </h2>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 6, color: "#475569", fontSize: 14 }}>
                          <User size={13} color="#888" />
                          ת.ז: <strong style={{ color: "#032147" }}>{selectedVoter.uniqueId}</strong>
                        </span>
                        <span style={{ display: "flex", alignItems: "center", gap: 6, color: "#475569", fontSize: 14 }}>
                          <Phone size={13} color="#888" />
                          <strong style={{ color: "#032147", direction: "ltr", display: "inline-block" }}>
                            {selectedVoter.phone ?? "לא ידוע"}
                          </strong>
                        </span>
                        <span style={{ display: "flex", alignItems: "center", gap: 6, color: "#475569", fontSize: 14 }}>
                          <MapPin size={13} color="#888" />
                          {buildAddress(selectedVoter)}
                        </span>
                      </div>
                    </div>
                    {getVoterStatus(selectedVoter) && (
                      <span style={{ flexShrink: 0, padding: "5px 16px", borderRadius: 20, fontSize: 13, fontWeight: 700, background: getVoterStatus(selectedVoter)!.color + "22", color: getVoterStatus(selectedVoter)!.color, border: `1.5px solid ${getVoterStatus(selectedVoter)!.color}44` }}>
                        {getVoterStatus(selectedVoter)!.name}
                      </span>
                    )}
                  </div>

                  {/* Groups + leader chips */}
                  <div style={{ marginTop: 14, display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {getVoterGroups(selectedVoter).map((g) => (
                      <span key={g.id} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 12px", borderRadius: 20, fontSize: 12, background: "rgba(32,157,215,0.09)", color: "#0e6fa0", fontWeight: 500 }}>
                        <Users size={11} />{g.name}
                      </span>
                    ))}
                    {(() => {
                      const gl = getVoterGroupLeader(selectedVoter);
                      return gl ? (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 12px", borderRadius: 20, fontSize: 12, background: "rgba(117,57,145,0.09)", color: "#753991", fontWeight: 500 }}>
                          <User size={11} />ראש קבוצה: {gl.firstName} {gl.lastName}
                        </span>
                      ) : null;
                    })()}
                  </div>
                </div>
              </div>

              {/* Conversation form */}
              <div style={{ background: "#fff", borderRadius: 14, border: "1.5px solid #f1f5f9", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", padding: "22px 24px" }}>
                <h3 style={{ margin: "0 0 18px", color: "#032147", fontSize: 16, fontWeight: 700, borderBottom: "1px solid #f1f5f9", paddingBottom: 14 }}>
                  תיעוד שיחה חדשה
                </h3>
                <form onSubmit={handleSave}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                    {/* Call status */}
                    <div>
                      <label style={{ display: "block", marginBottom: 6, color: "#032147", fontWeight: 600, fontSize: 13 }}>
                        תוצאת השיחה <span style={{ color: "#dc2626" }}>*</span>
                      </label>
                      <select
                        value={formCallStatusId}
                        onChange={(e) => setFormCallStatusId(e.target.value)}
                        required
                        style={{ width: "100%", padding: "9px 12px", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 14, outline: "none", background: "#fff", color: "#374151" }}
                      >
                        <option value="">בחר תוצאה...</option>
                        {callStatuses.map((cs) => (
                          <option key={cs.id} value={cs.id}>{cs.name}</option>
                        ))}
                      </select>
                      {/* Color preview of selected call status */}
                      {formCallStatusId && getCallStatus(formCallStatusId) && (
                        <div style={{ marginTop: 6, display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600, background: getCallStatus(formCallStatusId)!.color + "22", color: getCallStatus(formCallStatusId)!.color }}>
                          <span style={{ width: 8, height: 8, borderRadius: "50%", background: getCallStatus(formCallStatusId)!.color, display: "inline-block" }} />
                          {getCallStatus(formCallStatusId)!.name}
                        </div>
                      )}
                    </div>

                    {/* Support status */}
                    <div>
                      <label style={{ display: "block", marginBottom: 6, color: "#032147", fontWeight: 600, fontSize: 13 }}>
                        סטטוס תמיכה <span style={{ color: "#dc2626" }}>*</span>
                      </label>
                      <select
                        value={formStatusId}
                        onChange={(e) => setFormStatusId(e.target.value)}
                        required
                        style={{ width: "100%", padding: "9px 12px", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 14, outline: "none", background: "#fff", color: "#374151" }}
                      >
                        <option value="">בחר סטטוס...</option>
                        {statuses.map((s) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                      {formStatusId && getSupportStatus(formStatusId) && (
                        <div style={{ marginTop: 6, display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600, background: getSupportStatus(formStatusId)!.color + "22", color: getSupportStatus(formStatusId)!.color }}>
                          <span style={{ width: 8, height: 8, borderRadius: "50%", background: getSupportStatus(formStatusId)!.color, display: "inline-block" }} />
                          {getSupportStatus(formStatusId)!.name}
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ marginBottom: 18 }}>
                    <label style={{ display: "block", marginBottom: 6, color: "#032147", fontWeight: 600, fontSize: 13 }}>הערות</label>
                    <textarea
                      value={formNotes}
                      onChange={(e) => setFormNotes(e.target.value)}
                      rows={4}
                      placeholder="סיכום קצר של השיחה..."
                      style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 14, outline: "none", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }}
                    />
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    {saveError && (
                      <div style={{ marginBottom: 10, padding: "8px 12px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, fontSize: 13, color: "#dc2626" }}>
                        {saveError}
                      </div>
                    )}
                    <button type="submit" disabled={!canSave}
                      style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 28px", background: "#753991", color: "#fff", border: "none", borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: !canSave ? "not-allowed" : "pointer", opacity: !canSave ? 0.6 : 1 }}>
                      {saving
                        ? <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} />
                        : <CheckCircle2 size={15} />}
                      {saving ? "שומר..." : "שמור שיחה"}
                    </button>
                  </div>
                </form>
              </div>

              {/* History */}
              <div style={{ background: "#fff", borderRadius: 14, border: "1.5px solid #f1f5f9", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", padding: "22px 24px" }}>
                <h3 style={{ margin: "0 0 18px", color: "#032147", fontSize: 16, fontWeight: 700, borderBottom: "1px solid #f1f5f9", paddingBottom: 14 }}>
                  היסטוריית שיחות
                </h3>

                {logsLoading ? (
                  <div style={{ textAlign: "center", padding: "32px", color: "#888" }}>
                    <Loader2 size={24} style={{ animation: "spin 1s linear infinite", margin: "0 auto 8px", display: "block" }} />
                    טוען היסטוריה...
                  </div>
                ) : logsLoadError ? (
                  <div style={{ textAlign: "center", padding: "24px", color: "#dc2626", background: "#fef2f2", borderRadius: 10, fontSize: 13 }}>
                    שגיאה בטעינת היסטוריה — בדוק חיבור לאינטרנט
                  </div>
                ) : logs.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "32px", color: "#888", background: "#fafbfc", borderRadius: 10 }}>
                    לא נמצאו שיחות קודמות עבור בוחר זה
                  </div>
                ) : (
                  <div style={{ position: "relative", paddingRight: 28, maxHeight: "45vh", overflowY: "auto" }}>
                    {/* Timeline line */}
                    <div style={{ position: "absolute", right: 9, top: 4, bottom: 4, width: 2, background: "#e0e7ff", borderRadius: 2 }} />
                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                      {logs.map((log) => {
                        const cs = getCallStatus(log.callStatus);
                        const ss = getSupportStatus(log.statusId);
                        return (
                          <div key={log.id} style={{ position: "relative", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 10, padding: "14px 16px" }}>
                            {/* Timeline dot */}
                            <div style={{ position: "absolute", right: -22, top: 16, width: 10, height: 10, borderRadius: "50%", background: "#6366f1", border: "2px solid #fff", boxShadow: "0 0 0 2px #6366f1" }} />

                            {/* Header */}
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, paddingBottom: 10, borderBottom: "1px solid #f0f0f0" }}>
                              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                {cs && (
                                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600, background: cs.color + "22", color: cs.color }}>
                                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: cs.color, display: "inline-block" }} />
                                    {cs.name}
                                  </span>
                                )}
                                {!cs && log.callStatus && (
                                  <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600, background: "#f3f4f6", color: "#6b7280" }}>
                                    {log.callStatus}
                                  </span>
                                )}
                                {ss && (
                                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600, background: ss.color + "22", color: ss.color }}>
                                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: ss.color, display: "inline-block" }} />
                                    {ss.name}
                                  </span>
                                )}
                              </div>
                              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3, flexShrink: 0, marginRight: 10 }}>
                                <span style={{ display: "flex", alignItems: "center", gap: 4, color: "#888", fontSize: 12 }}>
                                  <Clock size={11} />
                                  {formatDate(log.timestamp)}
                                </span>
                                {log.userId && (() => {
                                  const logUser = state.users.find((u) => u.id === log.userId);
                                  return logUser ? (
                                    <span style={{ fontSize: 11, color: "#94a3b8" }}>
                                      {logUser.firstName} {logUser.lastName}
                                    </span>
                                  ) : null;
                                })()}
                              </div>
                            </div>

                            {log.notes ? (
                              <p style={{ margin: 0, color: "#374151", fontSize: 14, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{log.notes}</p>
                            ) : (
                              <p style={{ margin: 0, color: "#aaa", fontSize: 13, fontStyle: "italic" }}>אין הערות</p>
                            )}
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

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
