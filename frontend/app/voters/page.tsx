"use client";

import { useState, useMemo, useRef, useCallback } from "react";
import { useStore } from "@/lib/store";
import { Voter } from "@/types";
import { generateId, formatAddress } from "@/lib/utils";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { Plus, Pencil, Trash2, MapPin, Phone, Search, Users, GripVertical, Eye, EyeOff } from "lucide-react";
import { usePagination } from "@/hooks/usePagination";
import ScrollSentinel from "@/components/ui/ScrollSentinel";
import PaginationFooter from "@/components/ui/PaginationFooter";

// ── Column definitions ────────────────────────────────────────────────────────
type ColId = "name" | "phone" | "address" | "status" | "voted" | "groups";

const COL_LABELS: Record<ColId, string> = {
  name: "בוחר", phone: "טלפון", address: "כתובת",
  status: "סטטוס", voted: "הצביע", groups: "קבוצות",
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
  const { state, addVoter, updateVoter, deleteVoter } = useStore();
  const { voters, groups, statuses } = state;
  const statusMap = new Map(statuses.map(s => [s.id, s]));

  // Filters
  const [search, setSearch] = useState("");
  const [filterVoted, setFilterVoted] = useState<"" | "yes" | "no">("");

  // Column drag & drop
  const [colOrder, setColOrder] = useState<ColId[]>(loadColOrder);
  const [colVisible, setColVisible] = useState<Record<ColId, boolean>>(loadColVisible);
  const [showColMenu, setShowColMenu] = useState(false);
  const dragColRef = useRef<ColId | null>(null);
  const dragOverColRef = useRef<ColId | null>(null);

  // Form
  const [showForm, setShowForm] = useState(false);
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

  const { visible, hasMore, loadMore, showing, total } = usePagination(filtered);

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

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 64px)", gap: 0 }}>

      {/* ── Sticky top section ─────────────────────────────────────────────── */}
      <div style={{ flexShrink: 0, marginBottom: 14 }}>
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
            <button className="btn-primary" onClick={openAdd}><Plus size={14} /> הוסף בוחר</button>
          </div>
        </div>

        {/* Search + voted filter */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <div className="search-wrap" style={{ flex: 1, minWidth: 200 }}>
            <Search size={15} className="search-icon" />
            <input className="input" placeholder="חיפוש לפי שם, עיר, רחוב, ת.ז., טלפון..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div style={{ display: "flex", gap: 6 }}>
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
          <span>גרור כותרת עמודה לשינוי סדר</span>
        </div>
      </div>

      {/* ── Scrollable table ───────────────────────────────────────────────── */}
      <div className="card" style={{ padding: 0, overflow: "hidden", flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
        <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
            <thead>
              <tr style={{ background: "var(--bg)", borderBottom: "1.5px solid var(--border)", position: "sticky", top: 0, zIndex: 2 }}>
                {visibleCols.map(col => (
                  <th
                    key={col}
                    draggable
                    onDragStart={() => handleDragStart(col)}
                    onDragOver={(e) => handleDragOver(e, col)}
                    onDrop={handleDrop}
                    style={{
                      padding: "11px 16px", textAlign: "right", fontSize: 11, fontWeight: 700,
                      color: "var(--gray-text)", textTransform: "uppercase", letterSpacing: "0.05em",
                      cursor: "grab", userSelect: "none",
                      background: dragColRef.current === col ? "rgba(32,157,215,0.1)" : "var(--bg)",
                      borderBottom: dragOverColRef.current === col ? "2px solid var(--blue-primary)" : undefined,
                      transition: "background 0.15s",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <GripVertical size={11} style={{ opacity: 0.4 }} />
                      {COL_LABELS[col]}
                    </div>
                  </th>
                ))}
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

          {filtered.length === 0 && (
            <div className="empty-state">
              <div className="empty-state-icon"><Users size={28} color="var(--text-muted)" /></div>
              <h3>{search || filterVoted ? "לא נמצאו תוצאות" : "אין בוחרים"}</h3>
              <p>{search ? `אין בוחרים התואמים "${search}"` : filterVoted ? "אין בוחרים בסינון זה" : "לחץ 'הוסף בוחר' כדי להתחיל"}</p>
              {!search && !filterVoted && <button className="btn-primary" onClick={openAdd}><Plus size={14} />הוסף בוחר</button>}
            </div>
          )}
          {filtered.length > 0 && <ScrollSentinel onIntersect={loadMore} />}
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

      {/* Close col menu on outside click */}
      {showColMenu && <div style={{ position: "fixed", inset: 0, zIndex: 99 }} onClick={() => setShowColMenu(false)} />}
    </div>
  );
}
