"use client";

import { useState, useMemo } from "react";
import { useStore } from "@/lib/store";
import { Group } from "@/types";
import { generateId } from "@/lib/utils";
import PageHeader from "@/components/ui/PageHeader";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { Plus, Pencil, Trash2, UsersRound, AlertCircle, Search, X } from "lucide-react";
import { usePagination } from "@/hooks/usePagination";
import ScrollSentinel from "@/components/ui/ScrollSentinel";
import PaginationFooter from "@/components/ui/PaginationFooter";

const emptyGroup = (): Omit<Group, "id"> => ({
  name: "",
  groupLeaderId: null,
  voterIds: [],
});

export default function GroupsPage() {
  const { state, addGroup, updateGroup, deleteGroup } = useStore();
  const { groups, groupLeaders, voters } = state;

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Group | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Group | null>(null);
  const [renameConfirm, setRenameConfirm] = useState<{ group: Group; newName: string } | null>(null);
  const [form, setForm] = useState<Omit<Group, "id">>(emptyGroup());
  const [originalName, setOriginalName] = useState("");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return groups;
    const q = search.toLowerCase();
    return groups.filter((g) => {
      const gl = groupLeaders.find((l) => l.id === g.groupLeaderId);
      return (
        g.name.toLowerCase().includes(q) ||
        (gl && `${gl.firstName} ${gl.lastName}`.toLowerCase().includes(q))
      );
    });
  }, [groups, groupLeaders, search]);

  const { visible: visibleGroups, hasMore, loadMore, showing, total } = usePagination(filtered);

  const orphanCount = groups.filter((g) => !g.groupLeaderId).length;

  const openAdd = () => {
    setForm(emptyGroup());
    setEditing(null);
    setShowForm(true);
    setOriginalName("");
  };

  const openEdit = (g: Group) => {
    setForm({ name: g.name, groupLeaderId: g.groupLeaderId, voterIds: g.voterIds });
    setEditing(g);
    setOriginalName(g.name);
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.groupLeaderId && !editing) return;
    if (editing) {
      if (form.name !== originalName) {
        setRenameConfirm({ group: editing, newName: form.name });
        setShowForm(false);
        return;
      }
      updateGroup({ ...editing, ...form });
      setShowForm(false);
    } else {
      addGroup({ ...form, id: generateId() });
      setShowForm(false);
    }
  };

  const confirmRename = () => {
    if (renameConfirm) {
      updateGroup({ ...renameConfirm.group, name: renameConfirm.newName, groupLeaderId: form.groupLeaderId, voterIds: form.voterIds });
      setRenameConfirm(null);
    }
  };

  const confirmDelete = () => {
    if (deleteTarget) { deleteGroup(deleteTarget.id); setDeleteTarget(null); }
  };

  return (
    <div>
      <PageHeader
        title="קבוצות"
        subtitle={`${groups.length} קבוצות`}
        action={
          <button className="btn-primary" onClick={openAdd} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Plus size={15} /> הוסף קבוצה
          </button>
        }
      />

      {/* Orphan warning */}
      {orphanCount > 0 && (
        <div style={{
          marginBottom: 20, padding: "12px 16px",
          background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.25)",
          borderRadius: 10, display: "flex", alignItems: "center", gap: 10,
          fontSize: 13, color: "#b91c1c"
        }}>
          <AlertCircle size={15} color="#ef4444" />
          <span><strong>{orphanCount}</strong> קבוצות ללא ראש קבוצה — מומלץ לשייך ראש קבוצה לכל קבוצה.</span>
        </div>
      )}

      {/* Search */}
      <div className="search-wrap" style={{ marginBottom: 20 }}>
        <Search size={15} color="var(--gray-text)" />
        <input
          className="input"
          placeholder="חפש לפי שם קבוצה או ראש קבוצה..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ border: "none", boxShadow: "none", padding: "0", background: "transparent", flex: 1 }}
        />
        {search && (
          <button onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--gray-text)", display: "flex", padding: 0 }}>
            <X size={14} />
          </button>
        )}
      </div>

      {/* Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
        {visibleGroups.map((g) => {
          const gl = groupLeaders.find((l) => l.id === g.groupLeaderId);
          const groupVoters = voters.filter((v) => g.voterIds.includes(v.id));
          const isOrphan = !g.groupLeaderId;

          return (
            <div key={g.id} className="card" style={{
              padding: 0, overflow: "hidden",
              borderTop: `3px solid ${isOrphan ? "#ef4444" : "var(--blue-primary)"}`,
              transition: "box-shadow 0.2s, transform 0.2s"
            }}>
              {/* Card Header */}
              <div style={{ padding: "16px 18px 12px", display: "flex", alignItems: "flex-start", gap: 12 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: isOrphan ? "rgba(239,68,68,0.08)" : "rgba(32,157,215,0.1)",
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
                }}>
                  <UsersRound size={18} color={isOrphan ? "#ef4444" : "var(--blue-primary)"} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: "var(--navy)", marginBottom: 5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {g.name}
                  </div>
                  {isOrphan ? (
                    <span className="badge badge-red" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <AlertCircle size={10} /> ללא ראש קבוצה
                    </span>
                  ) : (
                    <span className="badge badge-purple">
                      {gl?.firstName} {gl?.lastName}
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
                  <button className="btn-icon" onClick={() => openEdit(g)} title="עריכה"><Pencil size={13} /></button>
                  <button className="btn-icon danger" onClick={() => setDeleteTarget(g)} title="מחיקה"><Trash2 size={13} /></button>
                </div>
              </div>

              {/* Footer */}
              <div style={{ padding: "10px 18px 14px", borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <UsersRound size={12} color="var(--gray-text)" />
                  <span style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 600 }}>{groupVoters.length}</span>
                  <span style={{ fontSize: 12, color: "var(--gray-text)" }}>בוחרים</span>
                </div>
                {groupVoters.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, justifyContent: "flex-end" }}>
                    {groupVoters.slice(0, 3).map((v) => (
                      <span key={v.id} style={{
                        fontSize: 11, padding: "2px 7px", borderRadius: 20,
                        background: "var(--bg)", border: "1px solid var(--border)",
                        color: "var(--text-secondary)", fontWeight: 500
                      }}>
                        {v.firstName} {v.lastName}
                      </span>
                    ))}
                    {groupVoters.length > 3 && (
                      <span style={{ fontSize: 11, padding: "2px 7px", borderRadius: 20, background: "var(--bg)", border: "1px solid var(--border)", color: "var(--gray-text)" }}>
                        +{groupVoters.length - 3}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length > 0 && <ScrollSentinel onIntersect={loadMore} />}
      <PaginationFooter showing={showing} total={total} hasMore={hasMore} entityLabel="קבוצות" />

      {groups.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon"><UsersRound size={28} color="var(--blue-primary)" /></div>
          <h3 style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 700, color: "var(--navy)" }}>אין קבוצות עדיין</h3>
          <p style={{ margin: "0 0 16px", color: "var(--gray-text)", fontSize: 14 }}>צור קבוצה ושייך אליה בוחרים וראש קבוצה</p>
          <button className="btn-primary" onClick={openAdd} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Plus size={14} /> הוסף קבוצה
          </button>
        </div>
      )}

      {groups.length > 0 && filtered.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon"><Search size={24} color="var(--gray-text)" /></div>
          <p style={{ margin: 0, color: "var(--gray-text)", fontSize: 14 }}>לא נמצאו קבוצות התואמות את החיפוש</p>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-icon" style={{ background: "rgba(32,157,215,0.1)" }}>
                <UsersRound size={18} color="var(--blue-primary)" />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "var(--navy)" }}>
                  {editing ? "עריכת קבוצה" : "הוספת קבוצה חדשה"}
                </h2>
                <p style={{ margin: 0, fontSize: 13, color: "var(--gray-text)" }}>
                  {editing ? "עדכן את פרטי הקבוצה" : "מלא את הפרטים ליצירת קבוצה חדשה"}
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 14 }}>
                <label className="label">שם הקבוצה <span style={{ color: "#ef4444" }}>*</span></label>
                <input className="input" required value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="לדוגמה: הורים — בית ספר יסודי" />
              </div>

              <div style={{ marginBottom: 22 }}>
                <label className="label">
                  ראש קבוצה {!editing && <span style={{ color: "#ef4444" }}>*</span>}
                </label>
                <select className="input" value={form.groupLeaderId ?? ""} required={!editing}
                  onChange={(e) => setForm({ ...form, groupLeaderId: e.target.value || null })}>
                  <option value="">בחר ראש קבוצה...</option>
                  {groupLeaders.map((gl) => (
                    <option key={gl.id} value={gl.id}>{gl.firstName} {gl.lastName}</option>
                  ))}
                </select>
                {!editing && (
                  <p style={{ fontSize: 12, color: "var(--gray-text)", margin: "4px 0 0" }}>
                    חובה לשייך ראש קבוצה בעת יצירה
                  </p>
                )}
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>ביטול</button>
                <button type="submit" className="btn-primary">{editing ? "שמור שינויים" : "צור קבוצה"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {renameConfirm && (
        <ConfirmDialog
          title="שינוי שם קבוצה"
          message={`שינוי שם מ-"${renameConfirm.group.name}" ל-"${renameConfirm.newName}" יתעדכן בכל הרשומות. פעולה זו בלתי הפיכה.`}
          confirmLabel="אשר שינוי שם"
          onConfirm={confirmRename}
          onCancel={() => setRenameConfirm(null)}
          danger={false}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="מחיקת קבוצה"
          message={`האם למחוק את הקבוצה "${deleteTarget.name}"? הקבוצה תוסר מכל הבוחרים המשויכים אליה.`}
          confirmLabel="מחק קבוצה"
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
