"use client";

import ImportVotersModal from "./ImportVotersModal";
import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useStore } from "@/lib/store";
import { Voter } from "@/types";
import { generateId, formatAddress } from "@/lib/utils";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { Plus, Pencil, Trash2, MapPin, Phone, Search, Users, GripVertical, Eye, ArrowUp, ArrowDown, ArrowUpDown, FileUp } from "lucide-react";
import { usePagination } from "@/hooks/usePagination";
import PaginationFooter from "@/components/ui/PaginationFooter";
import ScrollSentinel from "@/components/ui/ScrollSentinel";

// ── Column definitions ────────────────────────────────────────────────────────
type ColId = "name" | "phone" | "address" | "status" | "voted" | "groups";
type SortKey = "lastName" | "firstName" | "phone" | "city" | "status" | "voted";
type SortDir = "asc" | "desc";

const COL_LABELS: Record<ColId, string> = {
  name: "בוחר", phone: "טלפון", address: "כתובת",
  status: "סטטוס", voted: "הצביע", groups: "קבוצות",
};

// Which sort key each column maps to (null = not sortable)
const COL_SORT: Partial<Record<ColId, SortKey>> = {
  name: "lastName", phone: "phone", address: "city", status: "status", voted: "voted",
};

const DRAGGABLE_COLS: ColId[] = ["name", "phone", "address", "status", "voted", "groups"];

function loadColOrder(): ColId[] {
  try {
    const s = localStorage.getItem("voters_col_order");
    if (s) {
      const parsed: ColId[] = JSON.parse(s);
      const valid = DRAGGABLE_COLS.filter(c => parsed.includes(c));
      const missing = DRAGGABLE_COLS.filter(c => !parsed.includes(c));
      return [...valid, ...missing];
    }
  } catch {}
  return [...DRAGGABLE_COLS];
}

function loadColVisible(): Record<ColId, boolean> {
  try {
    const s = localStorage.getItem("voters_col_visible");
    if (s) return { ...Object.fromEntries(DRAGGABLE_COLS.map(c => [c, true])), ...JSON.parse(s) };
  } catch {}
  return Object.fromEntries(DRAGGABLE_COLS.map(c => [c, true])) as Record<ColId, boolean>;
}

const emptyVoter = (): Voter => ({
  id: "", firstName: "", lastName: "", uniqueId: "", phone: "",
  address: { street: "", streetNumber: "", building: "", apartment: "", city: "" },
  groupIds: [],
});

export default function VotersPage() {
  const { state, addVoter, updateVoter, deleteVoter, importVoters } = useStore();
  const { voters, groups, statuses } = state;
  const statusMap = useMemo(() => new Map(statuses.map(s => [s.id, s])), [statuses]);

  // Filters
  const [search, setSearch] = useState("");
  const [filterVoted, setFilterVoted] = useState<"" | "yes" | "no">("");

  // Sorting
  const [sortKey, setSortKey] = useState<SortKey>("lastName");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  // Column drag & drop
  const [colOrder, setColOrder] = useState<ColId[]>(loadColOrder);
  const [colVisible, setColVisible] = useState<Record<ColId, boolean>>(loadColVisible);
  const [showColMenu, setShowColMenu] = useState(false);
  const dragColRef = useRef<ColId | null>(null);
  const dragOverColRef = useRef<ColId | null>(null);

  // Form
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editing, setEditing] = useState<Voter | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Voter | null>(null);
  const [form, setForm] = useState<Voter>(emptyVoter());

  const votedCount = useMemo(() => voters.filter(v => v.hasVoted).length, [voters]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return voters.filter(v => {
      if (filterVoted === "yes" && !v.hasVoted) return false;
      if (filterVoted === "no" && v.hasVoted) return false;
      if (!q) return true;
      return (
        `${v.firstName} ${v.lastName}`.toLowerCase().includes(q) ||
        v.address.city?.toLowerCase().includes(q) ||
        v.address.street?.toLowerCase().includes(q) ||
        v.uniqueId?.includes(q) || v.phone?.includes(q)
      );
    });
  }, [voters, search, filterVoted]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let va = "", vb = "";
      if (sortKey === "lastName") { va = a.lastName; vb = b.lastName; }
      else if (sortKey === "firstName") { va = a.firstName; vb = b.firstName; }
      else if (sortKey === "phone") { va = a.phone ?? ""; vb = b.phone ?? ""; }
      else if (sortKey === "city") { va = a.address.city; vb = b.address.city; }
      else if (sortKey === "status") { va = statusMap.get(a.statusId ?? "")?.name ?? ""; vb = statusMap.get(b.statusId ?? "")?.name ?? ""; }
      else if (sortKey === "voted") { va = a.hasVoted ? "1" : "0"; vb = b.hasVoted ? "1" : "0"; }
      const cmp = va.localeCompare(vb, "he");
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir, statusMap]);

  const { visible, hasMore, loadMore, showing, total } = usePagination(sorted, 20);

  // Stable ref so the scroll listener always calls the latest loadMore
  const loadMoreRef = useRef(loadMore);
  useEffect(() => { loadMoreRef.current = loadMore; });
  useEffect(() => {
    const mainEl = document.getElementById("main-scroll");
    if (!mainEl) return;
    const onScroll = () => {
      if (mainEl.scrollHeight - mainEl.scrollTop <= mainEl.clientHeight + 300) {
        loadMoreRef.current();
      }
    };
    mainEl.addEventListener("scroll", onScroll, { passive: true });
    return () => mainEl.removeEventListener("scroll", onScroll);
  }, []);

  // Form handlers
  const openAdd  = () => { setForm(emptyVoter()); setEditing(null); setShowForm(true); };
  const openEdit = (v: Voter) => { setForm({ ...v, address: { ...v.address } }); setEditing(v); setShowForm(true); };
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    editing ? updateVoter(form) : addVoter({ ...form, id: generateId() });
    setShowForm(false);
  };
  const confirmDelete = () => { if (deleteTarget) { deleteVoter(deleteTarget.id); setDeleteTarget(null); } };
  const toggleGroup = (gid: string) => setForm(f => ({
    ...f, groupIds: f.groupIds.includes(gid) ? f.groupIds.filter(id => id !== gid) : [...f.groupIds, gid]
  }));

  // Column drag handlers
  const handleDragStart = (col: ColId) => { dragColRef.current = col; };
  const handleDragOver = useCallback((e: React.DragEvent, col: ColId) => {
    e.preventDefault();
    if (!dragColRef.current || dragColRef.current === col) return;
    if (dragOverColRef.current === col) return;
    dragOverColRef.current = col;
    const newOrder = [...colOrder];
    const from = newOrder.indexOf(dragColRef.current);
    const to = newOrder.indexOf(col);
    if (from === -1 || to === -1) return;
    newOrder.splice(from, 1);
    newOrder.splice(to, 0, dragColRef.current);
    setColOrder(newOrder);
  }, [colOrder]);
  const handleDrop = () => {
    localStorage.setItem("voters_col_order", JSON.stringify(colOrder));
    dragColRef.current = null;
    dragOverColRef.current = null;
  };

  const toggleColVisible = (col: ColId) => {
    const next = { ...colVisible, [col]: !colVisible[col] };
    setColVisible(next);
    localStorage.setItem("voters_col_visible", JSON.stringify(next));
  };

  const visibleCols = colOrder.filter(c => colVisible[c]);

  // Render a cell for a given column
  const renderCell = (v: Voter, col: ColId) => {
    const st = statusMap.get(v.statusId ?? "");
    const voterGroups = groups.filter(g => v.groupIds.includes(g.id));
    switch (col) {
      case "name": return (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div className="avatar" style={{ background: "linear-gradient(135deg,#209dd7,#753991)", width: 32, height: 32, fontSize: 11, flexShrink: 0 }}>
            {v.firstName[0]}{v.lastName[0]}
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13.5, color: "var(--text-primary)" }}>{v.firstName} {v.lastName}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "monospace" }}>ת.ז. {v.uniqueId}</div>
          </div>
        </div>
      );
      case "phone": return v.phone
        ? <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, color: "var(--text-secondary)", direction: "ltr" }}><Phone size={11} color="var(--text-muted)" />{v.phone}</div>
        : <span style={{ color: "var(--text-muted)" }}>—</span>;
      case "address": return (
        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, color: "var(--text-secondary)" }}>
          <MapPin size={11} color="var(--text-muted)" />{formatAddress(v.address)}
        </div>
      );
      case "status": return st
        ? <span style={{ background: st.color + "22", color: st.color, borderRadius: 20, padding: "3px 10px", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>{st.name}</span>
        : <span className="badge badge-gray">ללא סטטוס</span>;
      case "voted": return v.hasVoted
        ? <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#dcfce7", color: "#16a34a", borderRadius: 20, padding: "3px 10px", fontSize: 12, fontWeight: 700 }}>✓ הצביע</span>
        : <span style={{ color: "var(--text-muted)", fontSize: 12 }}>—</span>;
      case "groups": return voterGroups.length === 0
        ? <span className="badge badge-gray">ללא קבוצה</span>
        : <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {voterGroups.slice(0, 2).map(g => <span key={g.id} className="badge badge-blue">{g.name}</span>)}
            {voterGroups.length > 2 && <span className="badge badge-gray">+{voterGroups.length - 2}</span>}
          </div>;
    }
  };

  // Sort icon for a column header
  const SortIcon = ({ col }: { col: ColId }) => {
    const sk = COL_SORT[col];
    if (!sk) return null;
    const active = sortKey === sk;
    return active
      ? (sortDir === "asc" ? <ArrowUp size={11} color="var(--blue-primary)" /> : <ArrowDown size={11} color="var(--blue-primary)" />)
      : <ArrowUpDown size={11} style={{ opacity: 0.35 }} />;
  };

  return (
    <div className="voters-page">

      {/* ── Sticky top section ─────────────────────────────────────────────── */}
      <div className="voters-filters" style={{ flexShrink: 0, marginBottom: 14 }}>
        <div className="page-header" style={{ marginBottom: 14 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span className="page-accent" />
              <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", margin: 0 }}>בוחרים</h1>
            </div>
            <p style={{ color: "var(--gray-text)", fontSize: 13, marginTop: 3, marginRight: 14 }}>
              {voters.length} בוחרים רשומים
              {votedCount > 0 && (
                <span style={{ marginRight: 10, color: "#16a34a", fontWeight: 600 }}>
                  · {votedCount} הצביעו ({Math.round((votedCount / voters.length) * 100)}%)
                </span>
              )}
            </p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {/* Column menu toggle */}
            <div style={{ position: "relative" }}>
              <button
                className="btn-secondary"
                onClick={() => setShowColMenu(v => !v)}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px" }}
              >
                <Eye size={14} /> עמודות
              </button>
              {showColMenu && (
                <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, background: "#fff", border: "1.5px solid var(--border)", borderRadius: 10, padding: 12, zIndex: 100, boxShadow: "0 4px 20px rgba(0,0,0,0.12)", minWidth: 160 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--gray-text)", marginBottom: 8, textTransform: "uppercase" }}>הצג/הסתר עמודות</div>
                  {DRAGGABLE_COLS.map(col => (
                    <label key={col} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", cursor: "pointer", fontSize: 13 }}>
                      <input type="checkbox" checked={colVisible[col]} onChange={() => toggleColVisible(col)}
                        style={{ width: 14, height: 14, cursor: "pointer" }} />
                      {COL_LABELS[col]}
                    </label>
                  ))}
                </div>
              )}
            </div>
            <button className="btn-secondary" onClick={() => setShowImport(true)} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <FileUp size={14} /> ייבוא
            </button>
            <button className="btn-primary" onClick={openAdd}><Plus size={14} /> הוסף בוחר</button>
          </div>
        </div>

        {/* Search + voted filter */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <div className="search-wrap" style={{ flex: 1, minWidth: 200 }}>
            <Search size={15} className="search-icon" />
            <input className="input" placeholder="חיפוש לפי שם, עיר, רחוב, ת.ז., טלפון..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {(["", "yes", "no"] as const).map((opt) => (
              <button key={opt} onClick={() => setFilterVoted(opt)}
                style={{ padding: "8px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", border: `1.5px solid ${filterVoted === opt ? (opt === "yes" ? "#22c55e" : opt === "no" ? "#ef4444" : "#209dd7") : "var(--border)"}`, background: filterVoted === opt ? (opt === "yes" ? "#f0fdf4" : opt === "no" ? "#fef2f2" : "rgba(32,157,215,0.08)") : "#fff", color: filterVoted === opt ? (opt === "yes" ? "#16a34a" : opt === "no" ? "#dc2626" : "var(--blue-primary)") : "var(--text-secondary)" }}>
                {opt === "" ? "הכל" : opt === "yes" ? "✓ הצביע" : "✗ לא הצביע"}
              </button>
            ))}
          </div>
        </div>

        {/* Drag hint */}
        <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-muted)" }}>
          <GripVertical size={12} />
          <span>גרור כותרת עמודה לשינוי סדר · לחץ על כותרת למיון</span>
        </div>
      </div>

      {/* ── Scrollable table (desktop) ─────────────────────────────────────── */}
      <div className="card desktop-voter-table" style={{ padding: 0, overflow: "hidden" }}>
        <div>
          <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
            <thead>
              <tr style={{ background: "var(--bg)", borderBottom: "1.5px solid var(--border)", position: "sticky", top: 0, zIndex: 2 }}>
                {visibleCols.map(col => {
                  const sk = COL_SORT[col];
                  const active = sk && sortKey === sk;
                  return (
                    <th
                      key={col}
                      draggable
                      onDragStart={() => handleDragStart(col)}
                      onDragOver={(e) => handleDragOver(e, col)}
                      onDrop={handleDrop}
                      onClick={() => sk && handleSort(sk)}
                      style={{
                        padding: "11px 16px", textAlign: "right", fontSize: 11, fontWeight: 700,
                        color: active ? "var(--blue-primary)" : "var(--gray-text)",
                        textTransform: "uppercase", letterSpacing: "0.05em",
                        cursor: sk ? "pointer" : "grab", userSelect: "none",
                        background: active ? "rgba(32,157,215,0.06)" : "var(--bg)",
                        transition: "background 0.15s",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <GripVertical size={11} style={{ opacity: 0.4 }} />
                        {COL_LABELS[col]}
                        <SortIcon col={col} />
                      </div>
                    </th>
                  );
                })}
                <th style={{ padding: "11px 16px", width: 80 }}></th>
              </tr>
            </thead>
            <tbody>
              {visible.map(v => (
                <tr key={v.id} className="table-row">
                  {visibleCols.map(col => (
                    <td key={col} style={{ padding: "12px 16px", verticalAlign: "middle" }}>
                      {renderCell(v, col)}
                    </td>
                  ))}
                  <td style={{ padding: "12px 16px", verticalAlign: "middle" }}>
                    <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                      <button className="btn-icon" onClick={() => openEdit(v)} title="עריכה"><Pencil size={13} /></button>
                      <button className="btn-icon danger" onClick={() => setDeleteTarget(v)} title="מחיקה"><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {hasMore && <ScrollSentinel onIntersect={loadMore} />}
          {filtered.length === 0 && (
            <div className="empty-state">
              <div className="empty-state-icon"><Users size={28} color="var(--text-muted)" /></div>
              <h3>{search || filterVoted ? "לא נמצאו תוצאות" : "אין בוחרים"}</h3>
              <p>{search ? `אין בוחרים התואמים "${search}"` : filterVoted ? "אין בוחרים בסינון זה" : "לחץ 'הוסף בוחר' כדי להתחיל"}</p>
              {!search && !filterVoted && <button className="btn-primary" onClick={openAdd}><Plus size={14} />הוסף בוחר</button>}
            </div>
          )}
        </div>
        <PaginationFooter showing={showing} total={total} hasMore={hasMore} entityLabel="בוחרים" />
      </div>

      {/* ── Mobile card list (mobile only) ────────────────────────────────── */}
      <div className="mobile-voter-cards card" style={{ display: "none", padding: 0, overflow: "hidden" }}>
        <div
          className="mobile-voter-scroll"
        >
          {filtered.length === 0 ? (
            <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--text-muted)" }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>🔍</div>
              <div style={{ fontWeight: 600 }}>{search || filterVoted ? "לא נמצאו תוצאות" : "אין בוחרים"}</div>
            </div>
          ) : (
            visible.map(v => {
              const st = statusMap.get(v.statusId ?? "");
              const voterGroups = groups.filter(g => v.groupIds.includes(g.id));
              return (
                <div key={v.id} className="voter-mobile-card" onClick={() => openEdit(v)}>
                  {/* Avatar */}
                  <div style={{ width: 44, height: 44, borderRadius: "50%", background: "linear-gradient(135deg,#209dd7,#753991)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 15, flexShrink: 0, position: "relative" }}>
                    {v.firstName[0]}{v.lastName[0]}
                    {v.hasVoted && (
                      <span style={{ position: "absolute", bottom: -2, left: -2, width: 16, height: 16, borderRadius: "50%", background: "#22c55e", border: "2px solid #fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: "#fff", fontWeight: 700 }}>✓</span>
                    )}
                  </div>
                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, marginBottom: 3 }}>
                      <span style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {v.firstName} {v.lastName}
                      </span>
                      {st && (
                        <span style={{ flexShrink: 0, padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: st.color + "22", color: st.color }}>
                          {st.name}
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "3px 10px", fontSize: 12, color: "var(--text-muted)" }}>
                      {v.phone && <span style={{ direction: "ltr" }}>📞 {v.phone}</span>}
                      {v.address.city && <span>📍 {v.address.city}</span>}
                      {voterGroups.length > 0 && (
                        <span style={{ color: "var(--blue-primary)" }}>
                          {voterGroups.slice(0, 1).map(g => g.name).join(", ")}
                          {voterGroups.length > 1 && ` +${voterGroups.length - 1}`}
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Delete button */}
                  <button
                    className="btn-icon danger"
                    onClick={(e) => { e.stopPropagation(); setDeleteTarget(v); }}
                    style={{ flexShrink: 0, minWidth: 36, minHeight: 36 }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })
          )}
          {hasMore && <ScrollSentinel onIntersect={loadMore} />}
        </div>
        <PaginationFooter showing={showing} total={total} hasMore={hasMore} entityLabel="בוחרים" />
      </div>

      {/* ── Modal ──────────────────────────────────────────────────────────── */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-icon" style={{ background: "rgba(32,157,215,.1)" }}><Users size={18} color="var(--blue-primary)" /></div>
              <div>
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{editing ? "עריכת בוחר" : "הוספת בוחר"}</h2>
                <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>מלא את פרטי הבוחר</p>
              </div>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="grid-2" style={{ marginBottom: 14 }}>
                <div><label className="label">שם פרטי *</label><input className="input" required value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} /></div>
                <div><label className="label">שם משפחה *</label><input className="input" required value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} /></div>
              </div>
              <div className="grid-2" style={{ marginBottom: 14 }}>
                <div><label className="label">מספר זהות *</label><input className="input" required value={form.uniqueId} onChange={e => setForm({ ...form, uniqueId: e.target.value })} /></div>
                <div><label className="label">טלפון נייד</label><input className="input" type="tel" placeholder="050-0000000" value={form.phone ?? ""} onChange={e => setForm({ ...form, phone: e.target.value })} style={{ direction: "ltr", textAlign: "right" }} /></div>
              </div>
              <div style={{ background: "var(--bg)", borderRadius: 10, padding: 14, marginBottom: 14 }}>
                <p className="section-label" style={{ marginBottom: 10 }}>כתובת</p>
                <div className="grid-2" style={{ marginBottom: 10 }}>
                  <div><label className="label">רחוב</label><input className="input" value={form.address.street} onChange={e => setForm({ ...form, address: { ...form.address, street: e.target.value } })} /></div>
                  <div><label className="label">מספר</label><input className="input" value={form.address.streetNumber} onChange={e => setForm({ ...form, address: { ...form.address, streetNumber: e.target.value } })} /></div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr", gap: 10 }}>
                  <div><label className="label">בניין</label><input className="input" value={form.address.building} onChange={e => setForm({ ...form, address: { ...form.address, building: e.target.value } })} /></div>
                  <div><label className="label">דירה</label><input className="input" value={form.address.apartment} onChange={e => setForm({ ...form, address: { ...form.address, apartment: e.target.value } })} /></div>
                  <div><label className="label">עיר</label><input className="input" value={form.address.city} onChange={e => setForm({ ...form, address: { ...form.address, city: e.target.value } })} /></div>
                </div>
              </div>
              <div style={{ marginBottom: 14 }}>
                <label className="label" style={{ marginBottom: 8 }}>שיוך לקבוצות</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {groups.map(g => {
                    const sel = form.groupIds.includes(g.id);
                    return (
                      <button key={g.id} type="button" onClick={() => toggleGroup(g.id)}
                        style={{ padding: "5px 12px", borderRadius: 20, border: sel ? "1.5px solid var(--blue-primary)" : "1.5px solid var(--border)", background: sel ? "rgba(32,157,215,.1)" : "#fff", color: sel ? "var(--blue-primary)" : "var(--text-muted)", fontWeight: sel ? 700 : 400, fontSize: 12, cursor: "pointer" }}>
                        {g.name}
                      </button>
                    );
                  })}
                  {groups.length === 0 && <span style={{ color: "var(--text-muted)", fontSize: 13 }}>אין קבוצות</span>}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>ביטול</button>
                <button type="submit" className="btn-primary">{editing ? "שמור שינויים" : "הוסף בוחר"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <ConfirmDialog title="מחיקת בוחר" message={`האם למחוק את ${deleteTarget.firstName} ${deleteTarget.lastName}?`} confirmLabel="מחק" onConfirm={confirmDelete} onCancel={() => setDeleteTarget(null)} />
      )}

      {/* Import modal */}
      {showImport && (
        <ImportVotersModal
          existingVoters={voters}
          groups={groups}
          statuses={statuses}
          onImport={(newVoters) => importVoters(newVoters)}
          onClose={() => setShowImport(false)}
        />
      )}

      {/* Close col menu on outside click */}
      {showColMenu && <div style={{ position: "fixed", inset: 0, zIndex: 99 }} onClick={() => setShowColMenu(false)} />}
    </div>
  );
}
