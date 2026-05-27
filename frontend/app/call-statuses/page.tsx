"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { CallStatus } from "@/types";
import { Plus, Pencil, Trash2, PhoneCall } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

const generateId = () => `cs_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

const PRESET_COLORS = [
  "#209dd7", "#753991", "#032147", "#22c55e",
  "#f59e0b", "#ef4444", "#8b5cf6", "#0ea5e9",
  "#64748b", "#ec4899", "#14b8a6", "#f97316",
];

type ModalMode = { type: "add" } | { type: "edit"; cs: CallStatus };

function CallStatusModal({ mode, onClose, onSave }: {
  mode: ModalMode;
  onClose: () => void;
  onSave: (name: string, color: string) => void;
}) {
  const initial = mode.type === "edit" ? mode.cs : null;
  const [name, setName] = useState(initial?.name ?? "");
  const [color, setColor] = useState(initial?.color ?? "#209dd7");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError("שם הסטטוס הוא שדה חובה"); return; }
    onSave(name.trim(), color);
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-icon" style={{ background: color + "22" }}>
            <PhoneCall size={18} color={color} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "var(--navy)" }}>
              {mode.type === "add" ? "הוספת סטטוס שיחה" : "עריכת סטטוס שיחה"}
            </h2>
            <p style={{ margin: 0, fontSize: 13, color: "var(--gray-text)" }}>
              {mode.type === "add" ? "הגדר שם וצבע לסטטוס החדש" : "עדכן את פרטי הסטטוס"}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Name */}
          <div style={{ marginBottom: 20 }}>
            <label className="label">שם הסטטוס <span style={{ color: "#ef4444" }}>*</span></label>
            <input
              className="input"
              value={name}
              autoFocus
              onChange={(e) => { setName(e.target.value); setError(""); }}
              placeholder="לדוגמה: ענה, לא ענה, לא זמין..."
              style={{ borderColor: error ? "#ef4444" : undefined }}
            />
            {error && <p style={{ margin: "4px 0 0", fontSize: 12, color: "#ef4444" }}>{error}</p>}
          </div>

          {/* Color */}
          <div style={{ marginBottom: 24 }}>
            <label className="label">צבע</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  style={{
                    width: 30, height: 30, borderRadius: 8,
                    background: c, border: color === c ? `3px solid ${c}` : "3px solid transparent",
                    outline: color === c ? "2px solid #fff" : "none",
                    outlineOffset: -3,
                    cursor: "pointer", flexShrink: 0, boxShadow: "0 1px 3px rgba(0,0,0,0.15)"
                  }}
                />
              ))}
            </div>
            {/* Preview + custom color picker */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <label style={{
                fontSize: 13, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 6, cursor: "pointer"
              }}>
                <span>צבע מותאם:</span>
                <div style={{ position: "relative", width: 36, height: 36 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 8, background: color,
                    border: "2px solid var(--border)", cursor: "pointer"
                  }} />
                  <input type="color" value={color} onChange={(e) => setColor(e.target.value)}
                    style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", width: "100%", height: "100%" }} />
                </div>
              </label>
              <div style={{
                flex: 1, padding: "8px 14px", borderRadius: 8,
                background: color + "22", border: `1.5px solid ${color}55`,
                display: "flex", alignItems: "center", gap: 8
              }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: color, flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: color, fontWeight: 600 }}>{name || "תצוגה מקדימה"}</span>
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>ביטול</button>
            <button type="submit" className="btn-primary">{mode.type === "add" ? "הוסף סטטוס" : "שמור שינויים"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function CallStatusesPage() {
  const { state, addCallStatus, updateCallStatus, deleteCallStatus } = useStore();
  const { callStatuses } = state;

  const [modalMode, setModalMode] = useState<ModalMode | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CallStatus | null>(null);

  const handleSave = (name: string, color: string) => {
    if (!modalMode) return;
    if (modalMode.type === "add") {
      addCallStatus({ id: generateId(), name, color });
    } else {
      updateCallStatus({ ...modalMode.cs, name, color });
    }
    setModalMode(null);
  };

  const confirmDelete = () => {
    if (deleteTarget) { deleteCallStatus(deleteTarget.id); setDeleteTarget(null); }
  };

  return (
    <div>
      <PageHeader
        title="סטטוסי שיחה"
        subtitle={`${callStatuses.length} סטטוסים מוגדרים`}
        action={
          <button className="btn-primary" onClick={() => setModalMode({ type: "add" })}
            style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Plus size={15} /> הוסף סטטוס שיחה
          </button>
        }
      />

      {callStatuses.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><PhoneCall size={28} color="var(--blue-primary)" /></div>
          <h3 style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 700, color: "var(--navy)" }}>אין סטטוסי שיחה</h3>
          <p style={{ margin: "0 0 16px", color: "var(--gray-text)", fontSize: 14 }}>
            הוסף סטטוסים לסיווג שיחות הטלמרקטינג
          </p>
          <button className="btn-primary" onClick={() => setModalMode({ type: "add" })}
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Plus size={14} /> הוסף סטטוס שיחה
          </button>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
          {callStatuses.map((cs) => (
            <div key={cs.id} className="card" style={{ padding: 0, overflow: "hidden" }}>
              {/* Color bar */}
              <div style={{ height: 4, background: cs.color }} />
              <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
                {/* Icon */}
                <div style={{
                  width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                  background: cs.color + "18",
                  display: "flex", alignItems: "center", justifyContent: "center"
                }}>
                  <PhoneCall size={16} color={cs.color} />
                </div>
                {/* Name */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "var(--navy)", marginBottom: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {cs.name}
                  </div>
                  <div style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    fontSize: 11, padding: "2px 8px", borderRadius: 20,
                    background: cs.color + "22", color: cs.color, fontWeight: 600
                  }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: cs.color }} />
                    {cs.name}
                  </div>
                </div>
                {/* Actions */}
                <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
                  <button className="btn-icon" onClick={() => setModalMode({ type: "edit", cs })} title="עריכה">
                    <Pencil size={13} />
                  </button>
                  <button className="btn-icon danger" onClick={() => setDeleteTarget(cs)} title="מחיקה">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalMode && (
        <CallStatusModal mode={modalMode} onClose={() => setModalMode(null)} onSave={handleSave} />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="מחיקת סטטוס שיחה"
          message={`האם למחוק את סטטוס "${deleteTarget.name}"? שיחות שסווגו בסטטוס זה לא יושפעו.`}
          confirmLabel="מחק סטטוס"
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
