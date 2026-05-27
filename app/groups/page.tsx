"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { Group } from "@/types";
import { generateId } from "@/lib/utils";
import PageHeader from "@/components/ui/PageHeader";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { Plus, Pencil, Trash2, UsersRound, AlertCircle } from "lucide-react";
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
  const { visible: visibleGroups, hasMore, loadMore, showing, total } = usePagination(groups);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Group | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Group | null>(null);
  const [renameConfirm, setRenameConfirm] = useState<{ group: Group; newName: string } | null>(null);
  const [form, setForm] = useState<Omit<Group, "id">>(emptyGroup());
  const [originalName, setOriginalName] = useState("");

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
    if (!form.groupLeaderId && !editing) {
      return; // creation requires a group leader
    }
    if (editing) {
      // Check if name changed
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
    if (deleteTarget) {
      deleteGroup(deleteTarget.id);
      setDeleteTarget(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="קבוצות"
        subtitle={`${groups.length} קבוצות`}
        action={
          <button className="btn-primary" onClick={openAdd} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Plus size={15} />
            הוסף קבוצה
          </button>
        }
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
        {visibleGroups.map((g) => {
          const gl = groupLeaders.find((l) => l.id === g.groupLeaderId);
          const groupVoters = voters.filter((v) => g.voterIds.includes(v.id));
          const isOrphan = !g.groupLeaderId;

          return (
            <div
              key={g.id}
              className="card"
              style={{ padding: 20, borderTop: `3px solid ${isOrphan ? "#ef4444" : "var(--blue-primary)"}` }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: "var(--dark-navy)", marginBottom: 4 }}>
                    {g.name}
                  </div>
                  {isOrphan ? (
                    <span className="badge badge-red" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <AlertCircle size={11} />
                      ללא ראש קבוצה
                    </span>
                  ) : (
                    <span className="badge badge-purple">
                      {gl?.firstName} {gl?.lastName}
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  <button className="btn-icon" onClick={() => openEdit(g)}><Pencil size={13} /></button>
                  <button className="btn-icon" onClick={() => setDeleteTarget(g)} style={{ color: "#ef4444" }}><Trash2 size={13} /></button>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}>
                <UsersRound size={13} color="var(--gray-text)" />
                <span style={{ fontSize: 13, color: "var(--gray-text)" }}>{groupVoters.length} בוחרים</span>
              </div>

              {groupVoters.length > 0 && (
                <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {groupVoters.slice(0, 4).map((v) => (
                    <span key={v.id} className="badge badge-gray">
                      {v.firstName} {v.lastName}
                    </span>
                  ))}
                  {groupVoters.length > 4 && (
                    <span className="badge badge-gray">+{groupVoters.length - 4}</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {groups.length > 0 && <ScrollSentinel onIntersect={loadMore} />}
      <PaginationFooter showing={showing} total={total} hasMore={hasMore} entityLabel="קבוצות" />

      {groups.length === 0 && (
        <div className="card" style={{ padding: 48, textAlign: "center", color: "var(--gray-text)" }}>
          אין קבוצות. לחץ "הוסף קבוצה" כדי להתחיל.
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(32,157,215,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <UsersRound size={17} color="var(--blue-primary)" />
              </div>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "var(--dark-navy)" }}>
                {editing ? "עריכת קבוצה" : "הוספת קבוצה"}
              </h2>
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 14 }}>
                <label className="label">שם הקבוצה</label>
                <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="לדוגמה: הורים - בית ספר יסודי" />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label className="label">ראש קבוצה {!editing && <span style={{ color: "#ef4444" }}>*</span>}</label>
                <select
                  className="input"
                  value={form.groupLeaderId ?? ""}
                  onChange={(e) => setForm({ ...form, groupLeaderId: e.target.value || null })}
                  required={!editing}
                >
                  <option value="">בחר ראש קבוצה...</option>
                  {groupLeaders.map((gl) => (
                    <option key={gl.id} value={gl.id}>
                      {gl.firstName} {gl.lastName}
                    </option>
                  ))}
                </select>
                {!editing && (
                  <p style={{ fontSize: 12, color: "var(--gray-text)", marginTop: 4 }}>
                    חובה לשייך ראש קבוצה בעת יצירת קבוצה חדשה
                  </p>
                )}
              </div>

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>ביטול</button>
                <button type="submit" className="btn-primary">{editing ? "שמור שינויים" : "צור קבוצה"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rename confirm */}
      {renameConfirm && (
        <ConfirmDialog
          title="שינוי שם קבוצה"
          message={`שינוי שם הקבוצה מ-"${renameConfirm.group.name}" ל-"${renameConfirm.newName}" יתעדכן בכל הרשומות במערכת. פעולה זו בלתי הפיכה.`}
          confirmLabel="אשר שינוי שם"
          onConfirm={confirmRename}
          onCancel={() => setRenameConfirm(null)}
          danger={false}
        />
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <ConfirmDialog
          title="מחיקת קבוצה"
          message={`האם למחוק את הקבוצה "${deleteTarget.name}"? הקבוצה תוסר מכל הבוחרים המשויכים אליה. פעולה זו בלתי הפיכה.`}
          confirmLabel="מחק קבוצה"
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
