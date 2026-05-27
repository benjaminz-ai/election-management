"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { Status, StatusCategory } from "@/types";
import { Plus, Pencil, Trash2, CheckCircle } from "lucide-react";

const generateId = () => `st_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r}, ${g}, ${b}`;
}

const CATEGORIES: { value: StatusCategory; label: string; color: string }[] = [
  { value: "supporter", label: "תומך", color: "#22c55e" },
  { value: "opponent", label: "מתנגד", color: "#ef4444" },
  { value: "undecided", label: "מתלבט", color: "#f59e0b" },
  { value: "neutral", label: "ניטרלי / אחר", color: "#94a3b8" },
];

type ModalMode = { type: "add" } | { type: "edit"; status: Status };

function StatusModal({ mode, onClose, onSave }: {
  mode: ModalMode;
  onClose: () => void;
  onSave: (name: string, color: string, category: StatusCategory) => void;
}) {
  const initial = mode.type === "edit" ? mode.status : null;
  const [name, setName] = useState(initial?.name ?? "");
  const [color, setColor] = useState(initial?.color ?? "#209dd7");
  const [category, setCategory] = useState<StatusCategory>(initial?.category ?? "neutral");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError("שם הסטטוס הוא שדה חובה"); return; }
    onSave(name.trim(), color, category);
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{ background: "#fff", borderRadius: 16, padding: "28px 28px 24px", width: "100%", maxWidth: 420, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <h2 style={{ margin: "0 0 22px", color: "#032147", fontSize: 20, fontWeight: 700 }}>
          {mode.type === "add" ? "סטטוס חדש" : "עריכת סטטוס"}
        </h2>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {/* Name */}
          <div>
            <label style={{ display: "block", marginBottom: 6, color: "#032147", fontWeight: 600, fontSize: 14 }}>שם הסטטוס</label>
            <input
              value={name}
              onChange={(e) => { setName(e.target.value); setError(""); }}
              placeholder="לדוגמה: תומך נלהב"
              style={{ width: "100%", padding: "10px 14px", border: error ? "1.5px solid #dc2626" : "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 15, outline: "none", boxSizing: "border-box" }}
              autoFocus
            />
            {error && <p style={{ margin: "4px 0 0", color: "#dc2626", fontSize: 12 }}>{error}</p>}
          </div>

          {/* Category */}
          <div>
            <label style={{ display: "block", marginBottom: 10, color: "#032147", fontWeight: 600, fontSize: 14 }}>
              קטגוריה <span style={{ color: "#94a3b8", fontWeight: 400, fontSize: 12 }}>(לצורך ריכוז בדוחות)</span>
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {CATEGORIES.map(cat => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => setCategory(cat.value)}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: category === cat.value ? `2px solid ${cat.color}` : "1.5px solid #e2e8f0",
                    background: category === cat.value ? cat.color + "18" : "#fff",
                    color: category === cat.value ? cat.color : "#475569",
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    transition: "all 0.15s",
                  }}
                >
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: cat.color, display: "inline-block", flexShrink: 0 }} />
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Color */}
          <div>
            <label style={{ display: "block", marginBottom: 6, color: "#032147", fontWeight: 600, fontSize: 14 }}>צבע תצוגה</label>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                style={{ width: 52, height: 42, border: "1.5px solid #e2e8f0", borderRadius: 8, cursor: "pointer", padding: 2 }}
              />
              <div style={{ flex: 1, height: 42, borderRadius: 8, background: color, opacity: 0.85, border: "1.5px solid #e2e8f0" }} />
              <span style={{ color: "#888", fontSize: 12, fontFamily: "monospace" }}>{color}</span>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
            <button type="button" onClick={onClose} style={{ padding: "10px 22px", borderRadius: 8, border: "1.5px solid #e2e8f0", background: "#fff", color: "#475569", fontWeight: 600, cursor: "pointer", fontSize: 14 }}>ביטול</button>
            <button type="submit" style={{ padding: "10px 22px", borderRadius: 8, border: "none", background: "#753991", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
              {mode.type === "add" ? "הוסף" : "שמור"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ConfirmDialog({ title, message, confirmLabel, danger, onConfirm, onCancel }: {
  title: string; message: string; confirmLabel: string; danger?: boolean; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100, padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: "28px", maxWidth: 420, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <h3 style={{ margin: "0 0 12px", color: "#032147", fontSize: 18, fontWeight: 700 }}>{title}</h3>
        <p style={{ margin: "0 0 24px", color: "#475569", fontSize: 14, lineHeight: 1.6 }}>{message}</p>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onCancel} style={{ padding: "10px 22px", borderRadius: 8, border: "1.5px solid #e2e8f0", background: "#fff", color: "#475569", fontWeight: 600, cursor: "pointer", fontSize: 14 }}>ביטול</button>
          <button onClick={onConfirm} style={{ padding: "10px 22px", borderRadius: 8, border: "none", background: danger ? "#dc2626" : "#753991", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

const CATEGORY_LABELS: Record<StatusCategory, string> = {
  supporter: "תומך",
  opponent: "מתנגד",
  undecided: "מתלבט",
  neutral: "ניטרלי",
};
const CATEGORY_COLORS: Record<StatusCategory, string> = {
  supporter: "#22c55e",
  opponent: "#ef4444",
  undecided: "#f59e0b",
  neutral: "#94a3b8",
};

export default function StatusesPage() {
  const { state, addStatus, updateStatus, deleteStatus, setDefaultStatus } = useStore();
  const { statuses } = state;

  const [modal, setModal] = useState<ModalMode | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [setDefaultId, setSetDefaultId] = useState<string | null>(null);

  const handleSave = (name: string, color: string, category: StatusCategory) => {
    if (!modal) return;
    if (modal.type === "add") {
      addStatus({ id: generateId(), name, color, isDefault: false, category });
    } else {
      updateStatus({ ...modal.status, name, color, category });
    }
    setModal(null);
  };

  const handleDelete = () => { if (deleteId) { deleteStatus(deleteId); setDeleteId(null); } };
  const handleSetDefault = () => { if (setDefaultId) { setDefaultStatus(setDefaultId); setSetDefaultId(null); } };

  const toDelete = statuses.find(s => s.id === deleteId);
  const toDefault = statuses.find(s => s.id === setDefaultId);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, color: "#032147", fontSize: 26, fontWeight: 800 }}>מנהל סטטוסים</h1>
          <p style={{ margin: "4px 0 0", color: "#888", fontSize: 14 }}>הגדרת סטטוסים לסיווג בוחרים</p>
        </div>
        <button onClick={() => setModal({ type: "add" })} style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 20px", background: "#753991", color: "#fff", border: "none", borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
          <Plus size={16} /> סטטוס חדש
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 18 }}>
        {statuses.map(status => {
          const cat = status.category ?? "neutral";
          return (
            <div key={status.id} style={{ background: "#fff", borderRadius: 14, border: "1.5px solid #f1f5f9", overflow: "hidden", boxShadow: "0 2px 10px rgba(0,0,0,0.05)" }}>
              <div style={{ height: 5, background: status.color }} />
              <div style={{ padding: "18px 20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: `rgba(${hexToRgb(status.color)}, 0.15)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <div style={{ width: 14, height: 14, borderRadius: "50%", background: status.color }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: "#032147", fontWeight: 700, fontSize: 16 }}>{status.name}</div>
                    <div style={{ color: "#888", fontSize: 11, fontFamily: "monospace" }}>{status.color}</div>
                  </div>
                  {status.isDefault && (
                    <span style={{ background: "#ecad0a", color: "#7a5500", fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, whiteSpace: "nowrap" }}>ברירת מחדל</span>
                  )}
                </div>

                {/* Category badge */}
                <div style={{ marginBottom: 14 }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: CATEGORY_COLORS[cat] + "18", color: CATEGORY_COLORS[cat], borderRadius: 20, padding: "3px 12px", fontSize: 12, fontWeight: 600 }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: CATEGORY_COLORS[cat], display: "inline-block" }} />
                    {CATEGORY_LABELS[cat]}
                  </span>
                </div>

                <div style={{ display: "flex", gap: 8, borderTop: "1px solid #f1f5f9", paddingTop: 14 }}>
                  <button onClick={() => setModal({ type: "edit", status })} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "8px 0", border: "1.5px solid #e2e8f0", borderRadius: 8, background: "#fff", color: "#209dd7", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
                    <Pencil size={13} /> ערוך
                  </button>
                  {!status.isDefault && (
                    <button onClick={() => setSetDefaultId(status.id)} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "8px 0", border: "1.5px solid #e2e8f0", borderRadius: 8, background: "#fff", color: "#16a34a", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
                      <CheckCircle size={13} /> ברירת מחדל
                    </button>
                  )}
                  <button onClick={() => !status.isDefault && setDeleteId(status.id)} disabled={status.isDefault} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 36, padding: "8px 0", border: "1.5px solid #e2e8f0", borderRadius: 8, background: "#fff", color: status.isDefault ? "#cbd5e1" : "#dc2626", cursor: status.isDefault ? "not-allowed" : "pointer" }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {statuses.length === 0 && (
          <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "60px 20px", color: "#888" }}>
            <p style={{ fontSize: 16, marginBottom: 12 }}>אין סטטוסים מוגדרים</p>
            <button onClick={() => setModal({ type: "add" })} style={{ padding: "10px 24px", background: "#753991", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer" }}>הוסף סטטוס ראשון</button>
          </div>
        )}
      </div>

      <div style={{ marginTop: 28, padding: "12px 18px", background: "rgba(32,157,215,0.07)", borderRadius: 10, borderRight: "4px solid #209dd7", color: "#0e6fa0", fontSize: 13, lineHeight: 1.6 }}>
        <strong>הערה:</strong> הקטגוריה קובעת כיצד הסטטוס נספר בדוחות — "תומך נלהב" ו"תומך" שניהם בקטגוריית <strong>תומך</strong>.
      </div>

      {modal && <StatusModal mode={modal} onClose={() => setModal(null)} onSave={handleSave} />}
      {deleteId && toDelete && <ConfirmDialog title="מחיקת סטטוס" message={`האם למחוק את "${toDelete.name}"? בוחרים שהוגדרו לו יועברו לברירת המחדל.`} confirmLabel="מחק" danger onConfirm={handleDelete} onCancel={() => setDeleteId(null)} />}
      {setDefaultId && toDefault && <ConfirmDialog title="שינוי ברירת מחדל" message={`האם להגדיר את "${toDefault.name}" כסטטוס ברירת המחדל?`} confirmLabel="קבע" onConfirm={handleSetDefault} onCancel={() => setSetDefaultId(null)} />}
    </div>
  );
}
