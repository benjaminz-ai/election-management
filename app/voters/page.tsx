"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { Voter } from "@/types";
import { generateId, formatAddress } from "@/lib/utils";
import PageHeader from "@/components/ui/PageHeader";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { Plus, Pencil, Trash2, MapPin, Users, Phone } from "lucide-react";
import { usePagination } from "@/hooks/usePagination";
import ScrollSentinel from "@/components/ui/ScrollSentinel";
import PaginationFooter from "@/components/ui/PaginationFooter";

const emptyVoter = (): Voter => ({
  id: "",
  firstName: "",
  lastName: "",
  uniqueId: "",
  phone: "",
  address: { street: "", streetNumber: "", building: "", apartment: "", city: "" },
  groupIds: [],
});

export default function VotersPage() {
  const { state, addVoter, updateVoter, deleteVoter } = useStore();
  const { voters, groups } = state;
  const { visible: visibleVoters, hasMore, loadMore, showing, total } = usePagination(voters);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Voter | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Voter | null>(null);
  const [form, setForm] = useState<Voter>(emptyVoter());

  const openAdd = () => {
    setForm(emptyVoter());
    setEditing(null);
    setShowForm(true);
  };

  const openEdit = (v: Voter) => {
    setForm({ ...v, address: { ...v.address } });
    setEditing(v);
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) {
      updateVoter(form);
    } else {
      addVoter({ ...form, id: generateId() });
    }
    setShowForm(false);
  };

  const confirmDelete = () => {
    if (deleteTarget) {
      deleteVoter(deleteTarget.id);
      setDeleteTarget(null);
    }
  };

  const toggleGroup = (gid: string) => {
    setForm((f) => ({
      ...f,
      groupIds: f.groupIds.includes(gid)
        ? f.groupIds.filter((id) => id !== gid)
        : [...f.groupIds, gid],
    }));
  };

  return (
    <div>
      <PageHeader
        title="בוחרים"
        subtitle={`${voters.length} בוחרים רשומים`}
        action={
          <button className="btn-primary" onClick={openAdd} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Plus size={15} />
            הוסף בוחר
          </button>
        }
      />

      <div className="card" style={{ overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr className="table-header">
              <th style={thStyle}>שם מלא</th>
              <th style={thStyle}>ת.ז.</th>
              <th style={thStyle}>טלפון</th>
              <th style={thStyle}>כתובת</th>
              <th style={thStyle}>קבוצות</th>
              <th style={{ ...thStyle, width: 80 }}></th>
            </tr>
          </thead>
          <tbody>
            {visibleVoters.map((v) => {
              const voterGroups = groups.filter((g) => v.groupIds.includes(g.id));
              return (
                <tr key={v.id} className="table-row">
                  <td style={tdStyle}>
                    <div style={{ fontWeight: 600, color: "var(--dark-navy)", fontSize: 14 }}>
                      {v.firstName} {v.lastName}
                    </div>
                  </td>
                  <td style={tdStyle}>
                    <span style={{ color: "var(--gray-text)", fontSize: 13, fontFamily: "monospace" }}>
                      {v.uniqueId}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    {v.phone ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <Phone size={12} color="var(--gray-text)" />
                        <span style={{ fontSize: 13, color: "#475569", direction: "ltr", display: "inline-block" }}>
                          {v.phone}
                        </span>
                      </div>
                    ) : (
                      <span style={{ color: "#cbd5e1", fontSize: 13 }}>—</span>
                    )}
                  </td>
                  <td style={tdStyle}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <MapPin size={12} color="var(--gray-text)" />
                      <span style={{ fontSize: 13, color: "#475569" }}>
                        {formatAddress(v.address)}
                      </span>
                    </div>
                  </td>
                  <td style={tdStyle}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {voterGroups.length === 0 ? (
                        <span className="badge badge-gray">ללא קבוצה</span>
                      ) : (
                        voterGroups.map((g) => (
                          <span key={g.id} className="badge badge-blue">{g.name}</span>
                        ))
                      )}
                    </div>
                  </td>
                  <td style={{ ...tdStyle, textAlign: "center" }}>
                    <button className="btn-icon" onClick={() => openEdit(v)} title="עריכה">
                      <Pencil size={14} />
                    </button>
                    <button className="btn-icon" onClick={() => setDeleteTarget(v)} title="מחיקה" style={{ color: "#ef4444" }}>
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {voters.length === 0 && (
          <div style={{ padding: 48, textAlign: "center", color: "var(--gray-text)" }}>
            אין בוחרים. לחץ "הוסף בוחר" כדי להתחיל.
          </div>
        )}
        {voters.length > 0 && <ScrollSentinel onIntersect={loadMore} />}
      <PaginationFooter showing={showing} total={total} hasMore={hasMore} entityLabel="בוחרים" />
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(32,157,215,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Users size={17} color="var(--blue-primary)" />
              </div>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "var(--dark-navy)" }}>
                {editing ? "עריכת בוחר" : "הוספת בוחר"}
              </h2>
            </div>

            <form onSubmit={handleSubmit}>
              {/* Name row */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
                <div>
                  <label className="label">שם פרטי</label>
                  <input className="input" required value={form.firstName}
                    onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
                </div>
                <div>
                  <label className="label">שם משפחה</label>
                  <input className="input" required value={form.lastName}
                    onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
                </div>
              </div>

              {/* ID + Phone row */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
                <div>
                  <label className="label">מספר זהות</label>
                  <input className="input" required value={form.uniqueId}
                    onChange={(e) => setForm({ ...form, uniqueId: e.target.value })} />
                </div>
                <div>
                  <label className="label">טלפון נייד</label>
                  <input
                    className="input"
                    type="tel"
                    placeholder="050-0000000"
                    value={form.phone ?? ""}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    style={{ direction: "ltr", textAlign: "right" }}
                  />
                </div>
              </div>

              {/* Address */}
              <div style={{ padding: "14px", background: "#f8fafc", borderRadius: 10, marginBottom: 14 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: "var(--dark-navy)", marginBottom: 10 }}>כתובת</div>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10, marginBottom: 10 }}>
                  <div>
                    <label className="label">רחוב</label>
                    <input className="input" value={form.address.street}
                      onChange={(e) => setForm({ ...form, address: { ...form.address, street: e.target.value } })} />
                  </div>
                  <div>
                    <label className="label">מספר</label>
                    <input className="input" value={form.address.streetNumber}
                      onChange={(e) => setForm({ ...form, address: { ...form.address, streetNumber: e.target.value } })} />
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr", gap: 10 }}>
                  <div>
                    <label className="label">בניין</label>
                    <input className="input" value={form.address.building}
                      onChange={(e) => setForm({ ...form, address: { ...form.address, building: e.target.value } })} />
                  </div>
                  <div>
                    <label className="label">דירה</label>
                    <input className="input" value={form.address.apartment}
                      onChange={(e) => setForm({ ...form, address: { ...form.address, apartment: e.target.value } })} />
                  </div>
                  <div>
                    <label className="label">עיר</label>
                    <input className="input" value={form.address.city}
                      onChange={(e) => setForm({ ...form, address: { ...form.address, city: e.target.value } })} />
                  </div>
                </div>
              </div>

              {/* Group assignment */}
              <div style={{ marginBottom: 20 }}>
                <label className="label">שיוך לקבוצות</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
                  {groups.map((g) => {
                    const selected = form.groupIds.includes(g.id);
                    return (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => toggleGroup(g.id)}
                        style={{
                          padding: "5px 12px",
                          borderRadius: 20,
                          border: selected ? "1px solid var(--blue-primary)" : "1px solid var(--border)",
                          background: selected ? "rgba(32,157,215,0.1)" : "#fff",
                          color: selected ? "var(--blue-primary)" : "var(--gray-text)",
                          fontWeight: selected ? 600 : 400,
                          fontSize: 12,
                          cursor: "pointer",
                          transition: "all 0.15s",
                        }}
                      >
                        {g.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>ביטול</button>
                <button type="submit" className="btn-primary">{editing ? "שמור שינויים" : "הוסף בוחר"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteTarget && (
        <ConfirmDialog
          title="מחיקת בוחר"
          message={`האם למחוק את ${deleteTarget.firstName} ${deleteTarget.lastName}? פעולה זו בלתי הפיכה.`}
          confirmLabel="מחק בוחר"
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: "12px 16px",
  textAlign: "right",
  fontSize: 12,
  fontWeight: 600,
  color: "var(--gray-text)",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const tdStyle: React.CSSProperties = {
  padding: "14px 16px",
  verticalAlign: "middle",
};
