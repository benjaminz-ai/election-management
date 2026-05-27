"use client";

import { useState, useMemo } from "react";
import { useStore } from "@/lib/store";
import { GroupLeader } from "@/types";
import { generateId } from "@/lib/utils";
import PageHeader from "@/components/ui/PageHeader";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { Plus, Pencil, Trash2, UserCheck, Phone, Mail, AlertCircle, Search, X, ChevronDown, ChevronRight } from "lucide-react";
import { usePagination } from "@/hooks/usePagination";
import ScrollSentinel from "@/components/ui/ScrollSentinel";
import PaginationFooter from "@/components/ui/PaginationFooter";

const emptyGL = (): Omit<GroupLeader, "id"> => ({
  firstName: "",
  lastName: "",
  uniqueId: "",
  phone: "",
  email: "",
  divisionHeadId: "",
  groupIds: [],
});

export default function GroupLeadersPage() {
  const { state, addGroupLeader, updateGroupLeader, deleteGroupLeader } = useStore();
  const { groupLeaders, divisionHeads, groups } = state;

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<GroupLeader | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<GroupLeader | null>(null);
  const [form, setForm] = useState<Omit<GroupLeader, "id">>(emptyGL());
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return groupLeaders;
    const q = search.toLowerCase();
    return groupLeaders.filter((gl) => {
      const dh = divisionHeads.find((d) => d.id === gl.divisionHeadId);
      return (
        `${gl.firstName} ${gl.lastName}`.toLowerCase().includes(q) ||
        gl.phone.toLowerCase().includes(q) ||
        gl.email.toLowerCase().includes(q) ||
        (dh && `${dh.firstName} ${dh.lastName}`.toLowerCase().includes(q))
      );
    });
  }, [groupLeaders, divisionHeads, search]);

  const { visible: visibleGroupLeaders, hasMore, loadMore, showing, total } = usePagination(filtered);

  const openAdd = () => { setForm(emptyGL()); setEditing(null); setShowForm(true); };
  const openEdit = (gl: GroupLeader) => {
    setForm({ firstName: gl.firstName, lastName: gl.lastName, uniqueId: gl.uniqueId, phone: gl.phone, email: gl.email, divisionHeadId: gl.divisionHeadId, groupIds: gl.groupIds });
    setEditing(gl);
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) { updateGroupLeader({ ...editing, ...form }); }
    else { addGroupLeader({ ...form, id: generateId() }); }
    setShowForm(false);
  };

  const confirmDelete = () => {
    if (deleteTarget) { deleteGroupLeader(deleteTarget.id); setDeleteTarget(null); }
  };

  const initials = (gl: GroupLeader) => `${gl.firstName[0] ?? ""}${gl.lastName[0] ?? ""}`.toUpperCase();

  return (
    <div>
      <PageHeader
        title="ראשי קבוצה"
        subtitle={`${groupLeaders.length} ראשי קבוצה`}
        action={
          <button className="btn-primary" onClick={openAdd} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Plus size={15} /> הוסף ראש קבוצה
          </button>
        }
      />

      {/* Search */}
      <div className="search-wrap" style={{ marginBottom: 20 }}>
        <Search size={15} color="var(--gray-text)" />
        <input className="input" placeholder="חפש לפי שם, טלפון, אימייל או ראש אגף..."
          value={search} onChange={(e) => setSearch(e.target.value)}
          style={{ border: "none", boxShadow: "none", padding: 0, background: "transparent", flex: 1 }} />
        {search && (
          <button onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--gray-text)", display: "flex", padding: 0 }}>
            <X size={14} />
          </button>
        )}
      </div>

      {/* Cards list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {visibleGroupLeaders.map((gl) => {
          const dh = divisionHeads.find((d) => d.id === gl.divisionHeadId);
          const glGroups = groups.filter((g) => gl.groupIds.includes(g.id));
          const voterCount = glGroups.reduce((s, g) => s + g.voterIds.length, 0);
          const isExpanded = expanded === gl.id;
          const isOrphan = !gl.divisionHeadId;

          return (
            <div key={gl.id} className="card" style={{ padding: 0, overflow: "hidden" }}>
              {/* Main row */}
              <div style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: 14 }}>
                {/* Avatar */}
                <div style={{
                  width: 42, height: 42, borderRadius: "50%", flexShrink: 0,
                  background: "linear-gradient(135deg, var(--blue-primary), var(--purple-secondary))",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#fff", fontWeight: 700, fontSize: 14
                }}>
                  {initials(gl)}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 700, fontSize: 15, color: "var(--navy)" }}>
                      {gl.firstName} {gl.lastName}
                    </span>
                    {isOrphan ? (
                      <span className="badge badge-red" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <AlertCircle size={10} /> לא משויך לראש אגף
                      </span>
                    ) : (
                      <span className="badge badge-navy">{dh?.firstName} {dh?.lastName}</span>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 14, marginTop: 5, flexWrap: "wrap" }}>
                    {gl.phone && (
                      <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--text-secondary)" }}>
                        <Phone size={11} color="var(--gray-text)" /> {gl.phone}
                      </span>
                    )}
                    {gl.email && (
                      <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--text-secondary)" }}>
                        <Mail size={11} color="var(--gray-text)" /> {gl.email}
                      </span>
                    )}
                  </div>
                </div>

                {/* Stats */}
                <div className="hide-mobile" style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span className="badge badge-blue">{glGroups.length} קבוצות</span>
                  <span className="badge badge-gray">{voterCount} בוחרים</span>
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: 2, alignItems: "center", flexShrink: 0 }}>
                  <button className="btn-icon" onClick={() => openEdit(gl)} title="עריכה"><Pencil size={13} /></button>
                  <button className="btn-icon danger" onClick={() => setDeleteTarget(gl)} title="מחיקה"><Trash2 size={13} /></button>
                  {glGroups.length > 0 && (
                    <button className="btn-icon" onClick={() => setExpanded(isExpanded ? null : gl.id)}
                      style={{ color: "var(--gray-text)" }} title="הצג קבוצות">
                      {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                  )}
                </div>
              </div>

              {/* Expanded groups */}
              {isExpanded && (
                <div style={{ borderTop: "1px solid var(--border)", padding: "12px 18px", background: "var(--bg)" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--gray-text)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
                    קבוצות
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {glGroups.map((g) => (
                      <div key={g.id} style={{
                        padding: "6px 12px", borderRadius: 8,
                        background: "#fff", border: "1px solid var(--border)",
                        fontSize: 13, color: "var(--navy)", fontWeight: 600,
                        display: "flex", alignItems: "center", gap: 6
                      }}>
                        {g.name}
                        <span style={{ fontSize: 11, color: "var(--gray-text)", fontWeight: 400 }}>
                          {g.voterIds.length} בוחרים
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filtered.length > 0 && <ScrollSentinel onIntersect={loadMore} />}
      <PaginationFooter showing={showing} total={total} hasMore={hasMore} entityLabel="ראשי קבוצה" />

      {groupLeaders.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon"><UserCheck size={28} color="var(--purple-secondary)" /></div>
          <h3 style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 700, color: "var(--navy)" }}>אין ראשי קבוצה</h3>
          <p style={{ margin: "0 0 16px", color: "var(--gray-text)", fontSize: 14 }}>הוסף ראשי קבוצה כדי לנהל את ההיררכיה</p>
          <button className="btn-primary" onClick={openAdd} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Plus size={14} /> הוסף ראש קבוצה
          </button>
        </div>
      )}

      {groupLeaders.length > 0 && filtered.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon"><Search size={22} color="var(--gray-text)" /></div>
          <p style={{ margin: 0, color: "var(--gray-text)", fontSize: 14 }}>לא נמצאו ראשי קבוצה התואמים לחיפוש</p>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-icon" style={{ background: "rgba(117,57,145,0.1)" }}>
                <UserCheck size={18} color="var(--purple-secondary)" />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "var(--navy)" }}>
                  {editing ? "עריכת ראש קבוצה" : "הוספת ראש קבוצה"}
                </h2>
                <p style={{ margin: 0, fontSize: 13, color: "var(--gray-text)" }}>
                  {editing ? "עדכן פרטי ראש הקבוצה" : "מלא את הפרטים להוספת ראש קבוצה חדש"}
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
                <div>
                  <label className="label">שם פרטי <span style={{ color: "#ef4444" }}>*</span></label>
                  <input className="input" required value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
                </div>
                <div>
                  <label className="label">שם משפחה <span style={{ color: "#ef4444" }}>*</span></label>
                  <input className="input" required value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
                </div>
              </div>
              <div style={{ marginBottom: 14 }}>
                <label className="label">מספר זהות <span style={{ color: "#ef4444" }}>*</span></label>
                <input className="input" required value={form.uniqueId} onChange={(e) => setForm({ ...form, uniqueId: e.target.value })} placeholder="9 ספרות" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
                <div>
                  <label className="label">טלפון</label>
                  <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="050-0000000" />
                </div>
                <div>
                  <label className="label">אימייל</label>
                  <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
              </div>
              <div style={{ marginBottom: 22 }}>
                <label className="label">ראש אגף <span style={{ color: "#ef4444" }}>*</span></label>
                <select className="input" required value={form.divisionHeadId} onChange={(e) => setForm({ ...form, divisionHeadId: e.target.value })}>
                  <option value="">בחר ראש אגף...</option>
                  {divisionHeads.map((dh) => (
                    <option key={dh.id} value={dh.id}>{dh.firstName} {dh.lastName}</option>
                  ))}
                </select>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>ביטול</button>
                <button type="submit" className="btn-primary">{editing ? "שמור שינויים" : "הוסף ראש קבוצה"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="מחיקת ראש קבוצה"
          message={`האם למחוק את ${deleteTarget.firstName} ${deleteTarget.lastName}? הקבוצות שלו ישארו במערכת ללא ראש קבוצה.`}
          confirmLabel="מחק ראש קבוצה"
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
