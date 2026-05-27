"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { GroupLeader } from "@/types";
import { generateId } from "@/lib/utils";
import PageHeader from "@/components/ui/PageHeader";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { Plus, Pencil, Trash2, UserCheck, Phone, Mail, AlertCircle } from "lucide-react";
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
  const { visible: visibleGroupLeaders, hasMore, loadMore, showing, total } = usePagination(groupLeaders);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<GroupLeader | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<GroupLeader | null>(null);
  const [form, setForm] = useState<Omit<GroupLeader, "id">>(emptyGL());

  const openAdd = () => { setForm(emptyGL()); setEditing(null); setShowForm(true); };
  const openEdit = (gl: GroupLeader) => {
    setForm({ firstName: gl.firstName, lastName: gl.lastName, uniqueId: gl.uniqueId, phone: gl.phone, email: gl.email, divisionHeadId: gl.divisionHeadId, groupIds: gl.groupIds });
    setEditing(gl);
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) {
      updateGroupLeader({ ...editing, ...form });
    } else {
      addGroupLeader({ ...form, id: generateId() });
    }
    setShowForm(false);
  };

  const confirmDelete = () => {
    if (deleteTarget) { deleteGroupLeader(deleteTarget.id); setDeleteTarget(null); }
  };

  return (
    <div>
      <PageHeader
        title="ראשי קבוצה"
        subtitle={`${groupLeaders.length} ראשי קבוצה`}
        action={
          <button className="btn-primary" onClick={openAdd} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Plus size={15} />
            הוסף ראש קבוצה
          </button>
        }
      />

      <div className="card" style={{ overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr className="table-header">
              <th style={thStyle}>שם</th>
              <th style={thStyle}>פרטי קשר</th>
              <th style={thStyle}>ראש אגף</th>
              <th style={thStyle}>קבוצות</th>
              <th style={{ ...thStyle, width: 80 }}></th>
            </tr>
          </thead>
          <tbody>
            {visibleGroupLeaders.map((gl) => {
              const dh = divisionHeads.find((d) => d.id === gl.divisionHeadId);
              const glGroups = groups.filter((g) => gl.groupIds.includes(g.id));
              const orphanGroups = glGroups.filter((g) => !g.groupLeaderId);

              return (
                <tr key={gl.id} className="table-row">
                  <td style={tdStyle}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: "var(--dark-navy)" }}>
                      {gl.firstName} {gl.lastName}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--gray-text)", fontFamily: "monospace" }}>{gl.uniqueId}</div>
                  </td>
                  <td style={tdStyle}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, color: "#475569" }}>
                        <Phone size={11} color="var(--gray-text)" />
                        {gl.phone}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, color: "#475569" }}>
                        <Mail size={11} color="var(--gray-text)" />
                        {gl.email}
                      </div>
                    </div>
                  </td>
                  <td style={tdStyle}>
                    {dh ? (
                      <span className="badge badge-navy">{dh.firstName} {dh.lastName}</span>
                    ) : (
                      <span className="badge badge-red">
                        <AlertCircle size={11} style={{ marginLeft: 3 }} />
                        לא משויך
                      </span>
                    )}
                  </td>
                  <td style={tdStyle}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {glGroups.length === 0 ? (
                        <span className="badge badge-gray">אין קבוצות</span>
                      ) : (
                        glGroups.map((g) => (
                          <span key={g.id} className={`badge ${orphanGroups.includes(g) ? "badge-red" : "badge-blue"}`}>
                            {g.name}
                          </span>
                        ))
                      )}
                    </div>
                  </td>
                  <td style={{ ...tdStyle, textAlign: "center" }}>
                    <button className="btn-icon" onClick={() => openEdit(gl)}><Pencil size={14} /></button>
                    <button className="btn-icon" onClick={() => setDeleteTarget(gl)} style={{ color: "#ef4444" }}><Trash2 size={14} /></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {groupLeaders.length > 0 && <ScrollSentinel onIntersect={loadMore} />}
        <PaginationFooter showing={showing} total={total} hasMore={hasMore} entityLabel="ראשי קבוצה" />
        {groupLeaders.length === 0 && (
          <div style={{ padding: 48, textAlign: "center", color: "var(--gray-text)" }}>
            אין ראשי קבוצה. לחץ "הוסף ראש קבוצה" כדי להתחיל.
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(117,57,145,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <UserCheck size={17} color="var(--purple-secondary)" />
              </div>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "var(--dark-navy)" }}>
                {editing ? "עריכת ראש קבוצה" : "הוספת ראש קבוצה"}
              </h2>
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
                <div>
                  <label className="label">שם פרטי</label>
                  <input className="input" required value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
                </div>
                <div>
                  <label className="label">שם משפחה</label>
                  <input className="input" required value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
                </div>
              </div>
              <div style={{ marginBottom: 14 }}>
                <label className="label">מספר זהות</label>
                <input className="input" required value={form.uniqueId} onChange={(e) => setForm({ ...form, uniqueId: e.target.value })} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
                <div>
                  <label className="label">טלפון</label>
                  <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
                <div>
                  <label className="label">אימייל</label>
                  <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
              </div>
              <div style={{ marginBottom: 20 }}>
                <label className="label">ראש אגף</label>
                <select className="input" required value={form.divisionHeadId} onChange={(e) => setForm({ ...form, divisionHeadId: e.target.value })}>
                  <option value="">בחר ראש אגף...</option>
                  {divisionHeads.map((dh) => (
                    <option key={dh.id} value={dh.id}>{dh.firstName} {dh.lastName}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>ביטול</button>
                <button type="submit" className="btn-primary">{editing ? "שמור שינויים" : "הוסף ראש קבוצה"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <ConfirmDialog
          title="מחיקת ראש קבוצה"
          message={`האם למחוק את ${deleteTarget.firstName} ${deleteTarget.lastName}? הקבוצות שלו ישארו במערכת ללא ראש קבוצה. פעולה זו בלתי הפיכה.`}
          confirmLabel="מחק ראש קבוצה"
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

const thStyle: React.CSSProperties = { padding: "12px 16px", textAlign: "right", fontSize: 12, fontWeight: 600, color: "var(--gray-text)", textTransform: "uppercase", letterSpacing: "0.05em" };
const tdStyle: React.CSSProperties = { padding: "14px 16px", verticalAlign: "middle" };
