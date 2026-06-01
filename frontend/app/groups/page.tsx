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
                  <div style={{ 