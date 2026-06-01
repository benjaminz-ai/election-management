"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { Group, SubGroup } from "@/types";
import { generateId } from "@/lib/utils";
import PageHeader from "@/components/ui/PageHeader";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { Plus, Pencil, Trash2, UsersRound, AlertCircle, ChevronDown, ChevronRight, FolderTree } from "lucide-react";
import { usePagination } from "@/hooks/usePagination";
import ScrollSentinel from "@/components/ui/ScrollSentinel";
import PaginationFooter from "@/components/ui/PaginationFooter";

const emptyGroup = (): Omit<Group, "id"> => ({
  name: "",
  groupLeaderId: null,
  voterIds: [],
  subGroupIds: [],
});

export default function GroupsPage() {
  const { state, addGroup, updateGroup, deleteGroup, addSubGroup, updateSubGroup, deleteSubGroup } = useStore();
  const { groups, subGroups, groupLeaders, voters } = state;
  const { visible: visibleGroups, hasMore, loadMore, showing, total } = usePagination(groups);

  // Group form state
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Group | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Group | null>(null);
  const [renameConfirm, setRenameConfirm] = useState<{ group: Group; newName: string } | null>(null);
  const [form, setForm] = useState<Omit<Group, "id">>(emptyGroup());
  const [originalName, setOriginalName] = useState("");

  // SubGroup form state
  const [showSubForm, setShowSubForm] = useState(false);
  const [editingSubGroup, setEditingSubGroup] = useState<SubGroup | null>(null);
  const [subFormParentGroupId, setSubFormParentGroupId] = useState<string>("");
  const [subFormName, setSubFormName] = useState("");
  const [deleteSubTarget, setDeleteSubTarget] = useState<SubGroup | null>(null);
  const [subRenameConfirm, setSubRenameConfirm] = useState<{ sg: SubGroup; newName: string } | null>(null);

  // Expanded groups (show subgroups)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const toggleExpand = (gid: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      next.has(gid) ? next.delete(gid) : next.add(gid);
      return next;
    });
  };

  // ── Group form handlers ────────────────────────────────────────────────────

  const openAdd = () => {
    setForm(emptyGroup());
    setEditing(null);
    setShowForm(true);
    setOriginalName("");
  };

  const openEdit = (g: Group) => {
    setForm({ name: g.name, groupLeaderId: g.groupLeaderId, voterIds: g.voterIds, subGroupIds: g.subGroupIds ?? [] });
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
    if (deleteTarget) {
      deleteGroup(deleteTarget.id);
      setDeleteTarget(null);
    }
  };

  // ── SubGroup form handlers ─────────────────────────────────────────────────

  const openAddSubGroup = (parentGroupId: string) => {
    setEditingSubGroup(null);
    setSubFormParentGroupId(parentGroupId);
    setSubFormName("");
    setShowSubForm(true);
    setExpandedGroups((prev) => new Set([...prev, parentGroupId]));
  };

  const openEditSubGroup = (sg: SubGroup) => {
    setEditingSubGroup(sg);
    setSubFormParentGroupId(sg.parentGroupId);
    setSubFormName(sg.name);
    setShowSubForm(true);
  };

  const handleSubSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subFormName.trim()) return;
    if (editingSubGroup) {
      if (subFormName !== editingSubGroup.name) {
        setSubRenameConfirm({ sg: editingSubGroup, newName: subFormName });
        setShowSubForm(false);
        return;
      }
      updateSubGroup({ ...editingSubGroup, name: subFormName });
      setShowSubForm(false);
    } else {
      addSubGroup({ id: generateId(), name: subFormName, parentGroupId: subFormParentGroupId, voterIds: [] });
      setShowSubForm(false);
    }
  };

  const confirmSubRename = () => {
    if (subRenameConfirm) {
      updateSubGroup({ ...subRenameConfirm.sg, name: subRenameConfirm.newName });
      setSubRenameConfirm(null);
    }
  };

  const confirmDeleteSubGroup = () => {
    if (deleteSubTarget) {
      deleteSubGroup(deleteSubTarget.id);
      setDeleteSubTarget(null);
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

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
        {visibleGroups.map((g) => {
          const gl = groupLeaders.find((l) => l.id === g.groupLeaderId);
          const groupVoters = voters.filter((v) => g.voterIds.includes(v.id));
          const groupSubGroups = subGroups.filter((sg) => sg.parentGroupId === g.id);
          const isOrphan = !g.groupLeaderId;
          const isExpanded = expandedGroups.has(g.id);

          return (
            <div
              key={g.id}
              className="card"
              style={{ padding: 20, borderTop: `3px solid ${isOrphan ? "#ef4444" : "var(--blue-primary)"}` }}
            >
              {/* Header row */}
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

              {/* Voter count */}
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

              {/* Sub-groups section */}
              <div style={{ marginTop: 14, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <button
                    type="button"
                    onClick={() => toggleExpand(g.id)}
                    style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer", padding: 0, color: "var(--gray-text)", fontSize: 12, fontWeight: 600 }}
                  >
                    {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                    <FolderTree size={13} />
                    תת-קבוצות ({groupSubGroups.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => openAddSubGroup(g.id)}
                    style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "1px solid var(--border)", borderRadius: 6, cursor: "pointer", padding: "3px 8px", color: "var(--blue-primary)", fontSize: 11, fontWeight: 600 }}
                  >
                    <Plus size={11} />
                    הוסף תת-קבוצה
                  </button>
                </div>

                {isExpanded && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
                    {groupSubGroups.length === 0 ? (
                      <div style={{ fontSize: 12, color: "var(--gray-text)", padding: "4px 0" }}>אין תת-קבוצות</div>
                    ) : (
                      groupSubGroups.map((sg) => {
                        const sgVoterCount = sg.voterIds.length;
                        return (
                          <div key={sg.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(32,157,215,0.05)", borderRadius: 8, padding: "7px 10px" }}>
                            <div>
                              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--dark-navy)" }}>{sg.name}</span>
                              <span style={{ fontSize: 11, color: "var(--gray-text)", marginRight: 8 }}>{sgVoterCount} בוחרים</span>
                            </div>
                            <div style={{ display: "flex", gap: 3 }}>
                              <button className="btn-icon" style={{ padding: 4 }} onClick={() => openEditSubGroup(sg)}><Pencil size={11} /></button>
                              <button className="btn-icon" style={{ padding: 4, color: "#ef4444" }} onClick={() => setDeleteSubTarget(sg)}><Trash2 size={11} /></button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
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

      {/* Group Form Modal */}
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

      {/* SubGroup Form Modal */}
      {showSubForm && (
        <div className="modal-overlay" onClick={() => setShowSubForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(32,157,215,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <FolderTree size={17} color="var(--blue-primary)" />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "var(--dark-navy)" }}>
                  {editingSubGroup ? "עריכת תת-קבוצה" : "הוספת תת-קבוצה"}
                </h2>
                <div style={{ fontSize: 12, color: "var(--gray-text)", marginTop: 2 }}>
                  תחת: {groups.find((g) => g.id === subFormParentGroupId)?.name}
                </div>
              </div>
            </div>

            <form onSubmit={handleSubSubmit}>
              <div style={{ marginBottom: 20 }}>
                <label className="label">שם תת-הקבוצה</label>
                <input
                  className="input"
                  required
                  autoFocus
                  value={subFormName}
                  onChange={(e) => setSubFormName(e.target.value)}
                  placeholder="לדוגמה: צעירים"
                />
              </div>

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button type="button" className="btn-secondary" onClick={() => setShowSubForm(false)}>ביטול</button>
                <button type="submit" className="btn-primary">{editingSubGroup ? "שמור שינויים" : "צור תת-קבוצה"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Group Rename confirm */}
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

      {/* Group Delete confirm */}
      {deleteTarget && (
        <ConfirmDialog
          title="מחיקת קבוצה"
          message={`האם למחוק את הקבוצה "${deleteTarget.name}"? כל תת-הקבוצות שלה יימחקו גם כן. הקבוצה תוסר מכל הבוחרים המשויכים. פעולה זו בלתי הפיכה.`}
          confirmLabel="מחק קבוצה"
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* SubGroup Rename confirm */}
      {subRenameConfirm && (
        <ConfirmDialog
          title="שינוי שם תת-קבוצה"
          message={`שינוי שם תת-הקבוצה מ-"${subRenameConfirm.sg.name}" ל-"${subRenameConfirm.newName}". פעולה זו בלתי הפיכה.`}
          confirmLabel="אשר שינוי שם"
          onConfirm={confirmSubRename}
          onCancel={() => setSubRenameConfirm(null)}
          danger={false}
        />
      )}

      {/* SubGroup Delete confirm */}
      {deleteSubTarget && (
        <ConfirmDialog
          title="מחיקת תת-קבוצה"
          message={`האם למחוק את תת-הקבוצה "${deleteSubTarget.name}"? הבוחרים לא יימחקו, אך השיוך לתת-קבוצה יוסר. פעולה זו בלתי הפיכה.`}
          confirmLabel="מחק תת-קבוצה"
          onConfirm={confirmDeleteSubGroup}
          onCancel={() => setDeleteSubTarget(null)}
        />
      )}
    </div>
  );
}
