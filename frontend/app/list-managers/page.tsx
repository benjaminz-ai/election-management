"use client";

import { useState, useMemo } from "react";
import { useStore } from "@/lib/store";
import { ListManager } from "@/types";
import { generateId } from "@/lib/utils";
import PageHeader from "@/components/ui/PageHeader";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { Plus, Pencil, Trash2, ClipboardList, Phone, Mail, Search, X, ChevronDown, ChevronRight } from "lucide-react";
import { usePagination } from "@/hooks/usePagination";
import ScrollSentinel from "@/components/ui/ScrollSentinel";
import PaginationFooter from "@/components/ui/PaginationFooter";

const emptyLM = (): Omit<ListManager, "id"> => ({
  firstName: "", lastName: "", uniqueId: "", phone: "", email: "",
});

export default function ListManagersPage() {
  const { state, addListManager, updateListManager, deleteListManager, addList, deleteList } = useStore();
  const { listManagers, lists, voters } = state;

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ListManager | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ListManager | null>(null);
  const [form, setForm] = useState<Omit<ListManager, "id">>(emptyLM());
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [newListName, setNewListName] = useState("");

  // voter count per list id
  const votersByList = useMemo(() => {
    const m = new Map<string, number>();
    voters.forEach((v) => { if (v.listId) m.set(v.listId, (m.get(v.listId) ?? 0) + 1); });
    return m;
  }, [voters]);

  const filtered = useMemo(() => {
    if (!search.trim()) return listManagers;
    const q = search.toLowerCase();
    return listManagers.filter((lm) =>
      `${lm.firstName} ${lm.lastName}`.toLowerCase().includes(q) ||
      lm.phone.toLowerCase().includes(q) ||
      lm.email.toLowerCase().includes(q)
    );
  }, [listManagers, search]);

  const { visible: visibleManagers, hasMore, loadMore, showing, total } = usePagination(filtered);

  const openAdd = () => { setForm(emptyLM()); setEditing(null); setShowForm(true); };
  const openEdit = (lm: ListManager) => {
    setForm({ firstName: lm.firstName, lastName: lm.lastName, uniqueId: lm.uniqueId, phone: lm.phone, email: lm.email });
    setEditing(lm);
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) updateListManager({ ...editing, ...form });
    else addListManager({ ...form, id: generateId() });
    setShowForm(false);
  };

  const confirmDelete = () => {
    if (deleteTarget) { deleteListManager(deleteTarget.id); setDeleteTarget(null); }
  };

  const addListFor = (managerId: string) => {
    const name = newListName.trim();
    if (!name) return;
    addList({ id: generateId(), name, listManagerId: managerId });
    setNewListName("");
  };

  const initials = (lm: ListManager) => `${lm.firstName[0] ?? ""}${lm.lastName[0] ?? ""}`.toUpperCase();

  return (
    <div>
      <PageHeader
        title="מנהלי רשימות"
        subtitle={`${listManagers.length} מנהלי רשימות`}
        action={
          <button className="btn-primary" onClick={openAdd} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Plus size={15} /> הוסף מנהל רשימות
          </button>
        }
      />

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

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {visibleManagers.map((lm) => {
          const myLists = lists.filter((l) => l.listManagerId === lm.id);
          const voterCount = myLists.reduce((s, l) => s + (votersByList.get(l.id) ?? 0), 0);
          const isExpanded = expanded === lm.id;

          return (
            <div key={lm.id} className="card" style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 42, height: 42, borderRadius: "50%", flexShrink: 0, background: "linear-gradient(135deg, #f59e0b, #ef4444)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 14 }}>
                  {initials(lm)}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 700, fontSize: 15, color: "var(--navy)" }}>{lm.firstName} {lm.lastName}</span>
                  </div>
                  <div style={{ display: "flex", gap: 14, marginTop: 5, flexWrap: "wrap" }}>
                    {lm.phone && (
                      <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--text-secondary)" }}>
                        <Phone size={11} color="var(--gray-text)" /> {lm.phone}
                      </span>
                    )}
                    {lm.email && (
                      <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--text-secondary)" }}>
                        <Mail size={11} color="var(--gray-text)" /> {lm.email}
                      </span>
                    )}
                  </div>
                </div>

                <div className="hide-mobile" style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span className="badge badge-orange">{myLists.length} רשימות</span>
                  <span className="badge badge-gray">{voterCount} בוחרים</span>
                </div>

                <div style={{ display: "flex", gap: 2, alignItems: "center", flexShrink: 0 }}>
                  <button className="btn-icon" onClick={() => openEdit(lm)} title="עריכה"><Pencil size={13} /></button>
                  <button className="btn-icon danger" onClick={() => setDeleteTarget(lm)} title="מחיקה"><Trash2 size={13} /></button>
                  <button className="btn-icon" onClick={() => { setExpanded(isExpanded ? null : lm.id); setNewListName(""); }}
                    style={{ color: "var(--gray-text)" }} title="ניהול רשימות">
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div style={{ borderTop: "1px solid var(--border)", padding: "12px 18px", background: "var(--bg)" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--gray-text)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
                    רשימות
                  </div>
                  {myLists.length === 0 && (
                    <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 10 }}>אין רשימות עדיין — הוסף רשימה או ייבא קובץ עם מנהל זה.</div>
                  )}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                    {myLists.map((l) => (
                      <div key={l.id} style={{ padding: "6px 10px 6px 12px", borderRadius: 8, background: "#fff", border: "1px solid var(--border)", fontSize: 13, color: "var(--navy)", fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
                        {l.name}
                        <span style={{ fontSize: 11, color: "var(--gray-text)", fontWeight: 400 }}>{votersByList.get(l.id) ?? 0} בוחרים</span>
                        <button className="btn-icon danger" onClick={() => deleteList(l.id)} title="מחק רשימה" style={{ padding: 2 }}><Trash2 size={12} /></button>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", maxWidth: 380 }}>
                    <input className="input" placeholder="שם רשימה חדשה..." value={newListName}
                      onChange={(e) => setNewListName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addListFor(lm.id); } }}
                      style={{ flex: 1 }} />
                    <button className="btn-primary" onClick={() => addListFor(lm.id)} style={{ display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}>
                      <Plus size={14} /> הוסף רשימה
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filtered.length > 0 && <ScrollSentinel onIntersect={loadMore} />}
      <PaginationFooter showing={showing} total={total} hasMore={hasMore} entityLabel="מנהלי רשימות" />

      {listManagers.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon"><ClipboardList size={28} color="#f59e0b" /></div>
          <h3 style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 700, color: "var(--navy)" }}>אין מנהלי רשימות</h3>
          <p style={{ margin: "0 0 16px", color: "var(--gray-text)", fontSize: 14 }}>הוסף מנהל רשימות כדי לשייך אליו רשימות בוחרים</p>
          <button className="btn-primary" onClick={openAdd} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Plus size={14} /> הוסף מנהל רשימות
          </button>
        </div>
      )}

      {listManagers.length > 0 && filtered.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon"><Search size={22} color="var(--gray-text)" /></div>
          <p style={{ margin: 0, color: "var(--gray-text)", fontSize: 14 }}>לא נמצאו מנהלי רשימות התואמים לחיפוש</p>
        </div>
      )}

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-icon" style={{ background: "rgba(245,158,11,0.12)" }}>
                <ClipboardList size={18} color="#f59e0b" />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "var(--navy)" }}>
                  {editing ? "עריכת מנהל רשימות" : "הוספת מנהל רשימות"}
                </h2>
                <p style={{ margin: 0, fontSize: 13, color: "var(--gray-text)" }}>
                  {editing ? "עדכן את פרטי מנהל הרשימות" : "מלא את הפרטים. כדי שיוכל להתחבר ולראות את הרשימה — פתח לו גם משתמש עם אותו אימייל ותפקיד 'מנהל רשימות'."}
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
                <label className="label">מזהה</label>
                <input className="input" value={form.uniqueId} onChange={(e) => setForm({ ...form, uniqueId: e.target.value })} placeholder="מזהה ייחודי" />
              </div>
              <div className="form-2col" style={{ marginBottom: 22 }}>
                <div>
                  <label className="label">טלפון</label>
                  <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="050-0000000" />
                </div>
                <div>
                  <label className="label">אימייל <span style={{ color: "#ef4444" }}>*</span></label>
                  <input className="input" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} dir="ltr" style={{ textAlign: "left" }} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>ביטול</button>
                <button type="submit" className="btn-primary">{editing ? "שמור שינויים" : "הוסף מנהל רשימות"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="מחיקת מנהל רשימות"
          message={`האם למחוק את ${deleteTarget.firstName} ${deleteTarget.lastName}? הרשימות שלו יישארו במערכת ללא מנהל. הבוחרים לא יימחקו.`}
          confirmLabel="מחק מנהל רשימות"
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
