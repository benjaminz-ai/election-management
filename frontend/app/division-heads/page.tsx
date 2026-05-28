"use client";

import { useState, useMemo } from "react";
import { useStore } from "@/lib/store";
import { DivisionHead } from "@/types";
import { generateId } from "@/lib/utils";
import PageHeader from "@/components/ui/PageHeader";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { Plus, Pencil, Trash2, Shield, Phone, Mail, ChevronDown, ChevronUp, Search, X, UsersRound, UserCheck } from "lucide-react";
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

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<DivisionHead | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DivisionHead | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<DivisionHead, "id">>(emptyDH());
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return divisionHeads;
    const q = search.toLowerCase();
    return divisionHeads.filter((dh) =>
      `${dh.firstName} ${dh.lastName}`.toLowerCase().includes(q) ||
      dh.phone.toLowerCase().includes(q) ||
      dh.email.toLowerCase().includes(q)
    );
  }, [divisionHeads, search]);

  const { visible: visibleDivisionHeads, hasMore, loadMore, showing, total } = usePagination(filtered);

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

  const initials = (dh: DivisionHead) => `${dh.firstName[0] ?? ""}${dh.lastName[0] ?? ""}`.toUpperCase();

  return (
    <div>
      <PageHeader
        title="ראשי אגף"
        subtitle={`${divisionHeads.length} ראשי אגף`}
        action={
          <button className="btn-primary" onClick={openAdd} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Plus size={15} /> הוסף ראש אגף
          </button>
        }
      />

      {/* Search */}
      <div className="search-wrap" style={{ marginBottom: 20 }}>
        <Search size={15} color="var(--gray-text)" />
        <input className="input" placeholder="חפש לפי שם, טלפון או אימייל..."
          value={search} onChange={(e) => setSearch(e.target.value)}
          style={{ border: "none", boxShadow: "none", padding: 0, background: "transparent", flex: 1 }} />
        {search && (
          <button onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--gray-text)", display: "flex", padding: 0 }}>
            <X size={14} />
          </button>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {visibleDivisionHeads.map((dh) => {
          const dhLeaders = groupLeaders.filter((gl) => gl.divisionHeadId === dh.id);
          const totalGroups = dhLeaders.flatMap((gl) => gl.groupIds).length;
          const totalVoters = dhLeaders
            .flatMap((gl) => groups.filter((g) => gl.groupIds.includes(g.id)))
            .flatMap((g) => g.voterIds)
            .filter((v, i, arr) => arr.indexOf(v) === i).length;
          const isExpanded = expanded === dh.id;

          return (
            <div key={dh.id} className="card" style={{ overflow: "hidden", padding: 0 }}>
              {/* Accent bar */}
              <div style={{ height: 3, background: "linear-gradient(90deg, var(--navy), var(--blue-primary))" }} />

              {/* Header row */}
              <div style={{ padding: "16px 18px", display: "flex", alignItems: "center", gap: 14, cursor: "pointer" }}
                onClick={() => setExpanded(isExpanded ? null : dh.id)}>
                {/* Avatar */}
                <div style={{
                  width: 46, height: 46, borderRadius: 12, flexShrink: 0,
                  background: "linear-gradient(135deg, var(--navy) 0%, #1a4b8c 100%)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#fff", fontWeight: 800, fontSize: 15
                }}>
                  {initials(dh)}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 16, color: "var(--navy)", marginBottom: 4 }}>
                    {dh.firstName} {dh.lastName}
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <span className="badge badge-navy" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <UserCheck size={10} /> {dhLeaders.length} ראשי קבוצה
                    </span>
                    <span className="badge badge-blue" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <UsersRound size={10} /> {totalGroups} קבוצות
                    </span>
                    <span className="badge badge-gray">{totalVoters} בוחרים</span>
                  </div>
                </div>

                {/* Contact */}
                <div className="hide-mobile" style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
                  {dh.phone && (
                    <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--text-secondary)" }}>
                      <Phone size={11} color="var(--gray-text)" /> {dh.phone}
                    </span>
                  )}
                  {dh.email && (
                    <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--text-secondary)" }}>
                      <Mail size={11} color="var(--gray-text)" /> {dh.email}
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: 2, alignItems: "center", flexShrink: 0 }}>
                  <button className="btn-icon" onClick={(e) => { e.stopPropagation(); openEdit(dh); }} title="עריכה">
                    <Pencil size={13} />
                  </button>
                  <button className="btn-icon danger" onClick={(e) => { e.stopPropagation(); setDeleteTarget(dh); }} title="מחיקה">
                    <Trash2 size={13} />
                  </button>
                  <div style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--gray-text)" }}>
                    {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                  </div>
                </div>
              </div>

              {/* Expanded section */}
              {isExpanded && dhLeaders.length > 0 && (
                <div style={{ borderTop: "1px solid var(--border)", padding: "14px 18px", background: "var(--bg)" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--gray-text)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>
                    ראשי קבוצה
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {dhLeaders.map((gl) => {
                      const glGroups = groups.filter((g) => gl.groupIds.includes(g.id));
                      const glVoters = glGroups.reduce((s, g) => s + g.voterIds.length, 0);
                      return (
                        <div key={gl.id} style={{
                          padding: "10px 14px", background: "#fff",
                          borderRadius: 10, border: "1px solid var(--border)",
                          display: "flex", alignItems: "center", gap: 10
                        }}>
                          <div style={{
                            width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                            background: "linear-gradient(135deg, var(--blue-primary), var(--purple-secondary))",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            color: "#fff", fontWeight: 700, fontSize: 11
                          }}>
                            {gl.firstName[0]}{gl.lastName[0]}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, fontSize: 13, color: "var(--navy)", marginBottom: 4 }}>
                              {gl.firstName} {gl.lastName}
                            </div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                              {glGroups.map((g) => (
                                <span key={g.id} className="badge badge-blue" style={{ fontSize: 11 }}>{g.name}</span>
                              ))}
                              {glGroups.length === 0 && (
                                <span className="badge badge-gray" style={{ fontSize: 11 }}>אין קבוצות</span>
                              )}
                            </div>
                          </div>
                          <span className="badge badge-gray">{glVoters} בוחרים</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {isExpanded && dhLeaders.length === 0 && (
                <div style={{ borderTop: "1px solid var(--border)", padding: "14px 18px", background: "var(--bg)", textAlign: "center", color: "var(--gray-text)", fontSize: 13 }}>
                  אין ראשי קבוצה משויכים לראש אגף זה
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filtered.length > 0 && <ScrollSentinel onIntersect={loadMore} />}
      <PaginationFooter showing={showing} total={total} hasMore={hasMore} entityLabel="ראשי אגף" />

      {divisionHeads.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon"><Shield size={28} color="var(--navy)" /></div>
          <h3 style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 700, color: "var(--navy)" }}>אין ראשי אגף</h3>
          <p style={{ margin: "0 0 16px", color: "var(--gray-text)", fontSize: 14 }}>הוסף ראשי אגף לניהול ההיררכיה</p>
          <button className="btn-primary" onClick={openAdd} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Plus size={14} /> הוסף ראש אגף
          </button>
        </div>
      )}

      {divisionHeads.length > 0 && filtered.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon"><Search size={22} color="var(--gray-text)" /></div>
          <p style={{ margin: 0, color: "var(--gray-text)", fontSize: 14 }}>לא נמצאו ראשי אגף התואמים לחיפוש</p>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-icon" style={{ background: "rgba(3,33,71,0.08)" }}>
                <Shield size={18} color="var(--navy)" />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "var(--navy)" }}>
                  {editing ? "עריכת ראש אגף" : "הוספת ראש אגף"}
                </h2>
                <p style={{ margin: 0, fontSize: 13, color: "var(--gray-text)" }}>
                  {editing ? "עדכן פרטי ראש האגף" : "מלא פרטים להוספת ראש אגף חדש"}
                </p>
              </div>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-2col" style={{ marginBottom: 14 }}>
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
              <div className="form-2col" style={{ marginBottom: 22 }}>
                <div>
                  <label className="label">טלפון</label>
                  <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="050-0000000" />
                </div>
                <div>
                  <label className="label">אימייל</label>
                  <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>ביטול</button>
                <button type="submit" className="btn-primary">{editing ? "שמור שינויים" : "הוסף ראש אגף"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="מחיקת ראש אגף"
          message={`האם למחוק את ${deleteTarget.firstName} ${deleteTarget.lastName}? ראשי הקבוצה שלו לא יוסרו אך ישארו ללא ראש אגף.`}
          confirmLabel="מחק ראש אגף"
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
