"use client";

import { useState, useMemo } from "react";
import { useStore } from "@/lib/store";
import { Voter } from "@/types";
import { generateId, formatAddress } from "@/lib/utils";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { Plus, Pencil, Trash2, MapPin, Phone, Search, Users, CheckSquare } from "lucide-react";
import { usePagination } from "@/hooks/usePagination";
import ScrollSentinel from "@/components/ui/ScrollSentinel";
import PaginationFooter from "@/components/ui/PaginationFooter";

const emptyVoter = (): Voter => ({
  id: "", firstName: "", lastName: "", uniqueId: "", phone: "",
  address: { street: "", streetNumber: "", building: "", apartment: "", city: "" },
  groupIds: [],
});

export default function VotersPage() {
  const { state, addVoter, updateVoter, deleteVoter } = useStore();
  const { voters, groups, statuses } = state;
  const statusMap = new Map(statuses.map(s => [s.id, s]));

  const [search, setSearch] = useState("");
  const [filterVoted, setFilterVoted] = useState<"" | "yes" | "no">("");
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

  const openAdd  = () => { setForm(emptyVoter()); setEditing(null); setShowForm(true); };
  const openEdit = (v: Voter) => { setForm({ ...v, address: { ...v.address } }); setEditing(v); setShowForm(true); };
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    editing ? updateVoter(form) : addVoter({ ...form, id: generateId() });
    setShowForm(false);
  };
  const confirmDelete = () => { if (deleteTarget) { deleteVoter(deleteTarget.id); setDeleteTarget(null); } };
  const toggleGroup = (gid: string) => setForm(f => ({ ...f, groupIds: f.groupIds.includes(gid) ? f.groupIds.filter(id => id !== gid) : [...f.groupIds, gid] }));

  return (
    <div>
      {/* Header */}
      <div className="page-header">
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
        <button className="btn-primary" onClick={openAdd}><Plus size={14} /> הוסף בוחר</button>
      </div>

      {/* Search + voted filter */}
      <div style={{ marginBottom: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <div className="search-wrap" style={{ flex: 1, minWidth: 200 }}>
          <Search size={15} className="search-icon" />
          <input className="input" placeholder="חיפוש לפי שם, עיר, רחוב, ת.ז., טלפון..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {(["", "yes", "no"] as const).map((opt) => (
            <button key={opt} onClick={() => setFilterVoted(opt)}
              style={{
                padding: "8px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
                border: `1.5px solid ${filterVoted === opt ? (opt === "yes" ? "#22c55e" : opt === "no" ? "#ef4444" : "#209dd7") : "var(--border)"}`,
                background: filterVoted === opt ? (opt === "yes" ? "#f0fdf4" : opt === "no" ? "#fef2f2" : "rgba(32,157,215,0.08)") : "#fff",
                color: filterVoted === opt ? (opt === "yes" ? "#16a34a" : opt === "no" ? "#dc2626" : "var(--blue-primary)") : "var(--text-secondary)",
              }}>
              {opt === "" ? "הכל" : opt === "yes" ? "✓ הצביע" : "✗ לא הצביע"}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>בוחר</th>
                <th className="hide-mobile">טלפון</th>
                <th className="hide-mobile">כתובת</th>
                <th>סטטוס</th>
                <th>הצביע</th>
                <th className="hide-mobile">קבוצות</th>
                <th style={{ width: 80 }}></th>
              </tr>
            </thead>
            <tbody>
              {visible.map(v => {
                const st = statusMap.get(v.statusId ?? "");
                const voterGroups = groups.filter(g => v.groupIds.includes(g.id));
                return (
                  <tr key={v.id} className="table-row">
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div className="avatar" style={{ background: "linear-gradient(135deg,#209dd7,#753991)", width: 32, height: 32, fontSize: 11 }}>
                          {v.firstName[0]}{v.lastName[0]}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13.5, color: "var(--text-primary)" }}>{v.firstName} {v.lastName}</div>
                          <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "monospace" }}>ת.ז. {v.uniqueId}</div>
                        </div>
                      </div>
                    </td>
                    <td className="hide-mobile">
                      {v.phone
                        ? <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, color: "var(--text-secondary)", direction: "ltr" }}><Phone size={11} color="var(--text-muted)" />{v.phone}</div>
                        : <span style={{ color: "var(--text-muted)" }}>—</span>}
                    </td>
                    <td className="hide-mobile">
                      <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, color: "var(--text-secondary)" }}>
                        <MapPin size={11} color="var(--text-muted)" />{formatAddress(v.address)}
                      </div>
                    </td>
                    <td>
                      {st
                        ? <span style={{ background: st.color + "22", color: st.color, borderRadius: 20, padding: "3px 10px", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>{st.name}</span>
                        : <span className="badge badge-gray">ללא סטטוס</span>}
                    </td>
                    <td>
                      {v.hasVoted
                        ? <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#dcfce7", color: "#16a34a", borderRadius: 20, padding: "3px 10px", fontSize: 12, fontWeight: 700 }}>✓ הצביע</span>
                        : <span style={{ color: "var(--text-muted)", fontSize: 12 }}>—</span>}
                    </td>
                    <td className="hide-mobile">
                      {voterGroups.length === 0
                        ? <span className="badge badge-gray">ללא קבוצה</span>
                        : <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                            {voterGroups.slice(0, 2).map(g => <span key={g.id} className="badge badge-blue">{g.name}</span>)}
                            {voterGroups.length > 2 && <span className="badge badge-gray">+{voterGroups.length - 2}</span>}
                          </div>}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                        <button className="btn-icon" onClick={() => openEdit(v)} title="עריכה"><Pencil size={13} /></button>
                        <button className="btn-icon danger" onClick={() => setDeleteTarget(v)} title="מחיקה"><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon"><Users size={28} color="var(--text-muted)" /></div>
            <h3>{search || filterVoted ? "לא נמצאו תוצאות" : "אין בוחרים"}</h3>
            <p>{search ? `אין בוחרים התואמים "${search}"` : filterVoted ? "אין בוחרים בסינון זה" : "לחץ 'הוסף בוחר' כדי להתחיל"}</p>
            {!search && !filterVoted && <button className="btn-primary" onClick={openAdd}><Plus size={14} />הוסף בוחר</button>}
          </div>
        )}
        {filtered.length > 0 && <ScrollSentinel onIntersect={loadMore} />}
        <PaginationFooter showing={showing} total={total} hasMore={hasMore} entityLabel="בוחרים" />
      </div>

      {/* Modal */}
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
                        style={{ padding: "5px 12px", borderRadius: 20, border: sel ? "1.5px solid var(--blue-primary)" : "1.5px solid var(--border)", background: sel ? "rgba(32,157,215,.1)" : "#fff", color: sel ? "var(--blue-primary)" : "var(--text-muted)", fontWeight: sel ? 700 : 400, fontSize: 12, cursor: "pointer", transition: "all .15s" }}>
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
    </div>
  );
}
