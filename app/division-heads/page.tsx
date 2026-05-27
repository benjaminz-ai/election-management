"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { DivisionHead } from "@/types";
import { generateId } from "@/lib/utils";
import PageHeader from "@/components/ui/PageHeader";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { Plus, Pencil, Trash2, Shield, Phone, Mail, ChevronDown, ChevronUp } from "lucide-react";
import { usePagination } from "@/hooks/usePagination";
import ScrollSentinel from "@/components/ui/ScrollSentinel";
import PaginationFooter from "@/components/ui/PaginationFooter";

const emptyDH = (): Omit<DivisionHead, "id"> => ({
  firstName: "",
  lastName: "",
  uniqueId: "",
  phone: "",
  email: "",
  groupLeaderIds: [],
});

export default function DivisionHeadsPage() {
  const { state, addDivisionHead, updateDivisionHead, deleteDivisionHead } = useStore();
  const { divisionHeads, groupLeaders, groups, voters } = state;
  const { visible: visibleDivisionHeads, hasMore, loadMore, showing, total } = usePagination(divisionHeads);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<DivisionHead | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DivisionHead | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<DivisionHead, "id">>(emptyDH());

  const openAdd = () => { setForm(emptyDH()); setEditing(null); setShowForm(true); };
  const openEdit = (dh: DivisionHead) => {
    setForm({ firstName: dh.firstName, lastName: dh.lastName, uniqueId: dh.uniqueId, phone: dh.phone, email: dh.email, groupLeaderIds: dh.groupLeaderIds });
    setEditing(dh);
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) { updateDivisionHead({ ...editing, ...form }); }
    else { addDivisionHead({ ...form, id: generateId() }); }
    setShowForm(false);
  };

  const confirmDelete = () => {
    if (deleteTarget) { deleteDivisionHead(deleteTarget.id); setDeleteTarget(null); }
  };

  return (
    <div>
      <PageHeader
        title="ראשי אגף"
        subtitle={`${divisionHeads.length} ראשי אגף`}
        action={
          <button className="btn-primary" onClick={openAdd} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Plus size={15} />
            הוסף ראש אגף
          </button>
        }
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {visibleDivisionHeads.map((dh) => {
          const dhLeaders = groupLeaders.filter((gl) => dh.groupLeaderIds.includes(gl.id));
          const totalGroups = dhLeaders.flatMap((gl) => gl.groupIds).length;
          const totalVoters = dhLeaders
            .flatMap((gl) => groups.filter((g) => gl.groupIds.includes(g.id)))
            .flatMap((g) => g.voterIds)
            .filter((v, i, arr) => arr.indexOf(v) === i).length;
          const isExpanded = expanded === dh.id;

          return (
            <div key={dh.id} className="card" style={{ overflow: "hidden", borderTop: "3px solid var(--dark-navy)" }}>
              {/* Header */}
              <div
                style={{ padding: "18px 20px", display: "flex", alignItems: "center", gap: 14, cursor: "pointer" }}
                onClick={() => setExpanded(isExpanded ? null : dh.id)}
              >
                <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(3,33,71,0.08)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Shield size={20} color="var(--dark-navy)" />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 16, color: "var(--dark-navy)" }}>
                    {dh.firstName} {dh.lastName}
                  </div>
                  <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                    <span className="badge badge-navy">{dhLeaders.length} ראשי קבוצה</span>
                    <span className="badge badge-blue">{totalGroups} קבוצות</span>
                    <span className="badge badge-gray">{totalVoters} בוחרים</span>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                  <button className="btn-icon" onClick={(e) => { e.stopPropagation(); openEdit(dh); }}><Pencil size={14} /></button>
                  <button className="btn-icon" onClick={(e) => { e.stopPropagation(); setDeleteTarget(dh); }} style={{ color: "#ef4444" }}><Trash2 size={14} /></button>
                  <div style={{ marginRight: 4, color: "var(--gray-text)" }}>
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </div>
              </div>

              {/* Contact info */}
              <div style={{ padding: "0 20px 14px", display: "flex", gap: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#475569" }}>
                  <Phone size={12} color="var(--gray-text)" />{dh.phone}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#475569" }}>
                  <Mail size={12} color="var(--gray-text)" />{dh.email}
                </div>
              </div>

              {/* Expanded group leaders */}
              {isExpanded && dhLeaders.length > 0 && (
                <div style={{ borderTop: "1px solid var(--border)", padding: "14px 20px", background: "#f8fafc" }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--gray-text)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    ראשי קבוצה
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {dhLeaders.map((gl) => {
                      const glGroups = groups.filter((g) => gl.groupIds.includes(g.id));
                      return (
                        <div key={gl.id} style={{ padding: "10px 14px", background: "#fff", borderRadius: 8, border: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, fontSize: 13, color: "var(--dark-navy)" }}>
                              {gl.firstName} {gl.lastName}
                            </div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 5 }}>
                              {glGroups.map((g) => (
                                <span key={g.id} className="badge badge-blue" style={{ fontSize: 11 }}>{g.name}</span>
                              ))}
                            </div>
                          </div>
                          <span className="badge badge-gray">{glGroups.reduce((s, g) => s + g.voterIds.length, 0)} בוחרים</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {divisionHeads.length > 0 && <ScrollSentinel onIntersect={loadMore} />}
      <PaginationFooter showing={showing} total={total} hasMore={hasMore} entityLabel="ראשי אגף" />

      {divisionHeads.length === 0 && (
        <div className="card" style={{ padding: 48, textAlign: "center", color: "var(--gray-text)" }}>
          אין ראשי אגף. לחץ "הוסף ראש אגף" כדי להתחיל.
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(3,33,71,0.08)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Shield size={17} color="var(--dark-navy)" />
              </div>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "var(--dark-navy)" }}>
                {editing ? "עריכת ראש אגף" : "הוספת ראש אגף"}
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
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
                <div>
                  <label className="label">טלפון</label>
                  <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
                <div>
                  <label className="label">אימייל</label>
                  <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>ביטול</button>
                <button type="submit" className="btn-primary">{editing ? "שמור שינויים" : "הוסף ראש אגף"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <ConfirmDialog
          title="מחיקת ראש אגף"
          message={`האם למחוק את ${deleteTarget.firstName} ${deleteTarget.lastName}? ראשי הקבוצה שלו לא יוסרו אך ישארו ללא ראש אגף. פעולה זו בלתי הפיכה.`}
          confirmLabel="מחק ראש אגף"
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
