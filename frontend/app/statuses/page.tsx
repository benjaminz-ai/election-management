"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { Status, StatusCategory } from "@/types";
import { Plus, Pencil, Trash2, CheckCircle, Tag } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

const generateId = () => `st_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

const PRESET_COLORS = [
  "#209dd7", "#753991", "#032147", "#22c55e",
  "#f59e0b", "#ef4444", "#8b5cf6", "#0ea5e9",
  "#64748b", "#ec4899", "#14b8a6", "#f97316",
];

const CATEGORIES: { value: StatusCategory; label: string; color: string; desc: string }[] = [
  { value: "supporter", label: "תומך",        color: "#22c55e", desc: "בוחרים שתומכים" },
  { value: "opponent",  label: "מתנגד",        color: "#ef4444", desc: "בוחרים שמתנגדים" },
  { value: "undecided", label: "מתלבט",        color: "#f59e0b", desc: "בוחרים לא מחליטים" },
  { value: "neutral",   label: "ניטרלי / אחר", color: "#94a3b8", desc: "לא מסווג" },
];

const CATEGORY_LABELS: Record<StatusCategory, string> = {
  supporter: "תומך", opponent: "מתנגד", undecided: "מתלבט", neutral: "ניטרלי",
};
const CATEGORY_COLORS: Record<StatusCategory, string> = {
  supporter: "#22c55e", opponent: "#ef4444", undecided: "#f59e0b", neutral: "#94a3b8",
};

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
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-icon" style={{ background: color + "22" }}>
            <Tag size={18} color={color} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "var(--navy)" }}>
              {mode.type === "add" ? "הוספת סטטוס חדש" : "עריכת סטטוס"}
            </h2>
            <p style={{ margin: 0, fontSize: 13, color: "var(--gray-text)" }}>
              הגדר שם, צבע וקטגוריה לסטטוס
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Name */}
          <div style={{ marginBottom: 18 }}>
            <label className="label">שם הסטטוס <span style={{ color: "#ef4444" }}>*</span></label>
            <input className="input" autoFocus value={name}
              onChange={(e) => { setName(e.target.value); setError(""); }}
              placeholder="לדוגמה: תומך נלהב, מתנגד..."
              style={{ borderColor: error ? "#ef4444" : undefined }} />
            {error && <p style={{ margin: "4px 0 0", fontSize: 12, color: "#ef4444" }}>{error}</p>}
          </div>

          {/* Category */}
          <div style={{ marginBottom: 18 }}>
            <label className="label">
              קטגוריה <span style={{ color: "var(--gray-text)", fontWeight: 400, fontSize: 11 }}>(לצורך ריכוז בדוחות)</span>
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {CATEGORIES.map((cat) => (
                <button key={cat.value} type="button" onClick={() => setCategory(cat.value)}
                  style={{
                    padding: "10px 12px", borderRadius: 10, cursor: "pointer",
                    border: category === cat.value ? `2px solid ${cat.color}` : "1.5px solid var(--border)",
                    background: category === cat.value ? cat.color + "12" : "#fff",
                    textAlign: "right", transition: "all 0.15s"
                  }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: category === cat.value ? cat.color : "var(--navy)", marginBottom: 2 }}>
                    {cat.label}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--gray-text)" }}>{cat.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Color */}
          <div style={{ marginBottom: 22 }}>
            <label className="label">צבע</label>
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 10 }}>
              {PRESET_COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setColor(c)}
                  style={{
                    width: 28, height: 28, borderRadius: 7, background: c,
                    border: color === c ? `3px solid ${c}` : "3px solid transparent",
                    outline: color === c ? "2px solid #fff" : "none",
                    outlineOffset: -3,
                    cursor: "pointer", boxShadow: "0 1px 3px rgba(0,0,0,0.15)"
                  }} />
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <label style={{ fontSize: 13, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                <span>מותאם:</span>
                <div style={{ position: "relative", width: 34, height: 34 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 7, background: color, border: "2px solid var(--border)" }} />
                  <input type="color" value={color} onChange={(e) => setColor(e.target.value)}
                    style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", width: "100%", height: "100%" }} />
                </div>
              </label>
              {/* Preview */}
              <div style={{
                flex: 1, padding: "8px 12px", borderRadius: 8,
                background: color + "18", border: `1.5px solid ${color}44`,
                display: "flex", alignItems: "center", gap: 7
              }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
                <span style={{ fontSize: 13, color, fontWeight: 700 }}>{name || "תצוגה מקדימה"}</span>
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

  const toDelete = statuses.find((s) => s.id === deleteId);
  const toDefault = statuses.find((s) => s.id === setDefaultId);

  return (
    <div>
      <PageHeader
        title="מנהל סטטוסים"
        subtitle={`${statuses.length} סטטוסים מוגדרים`}
        action={
          <button className="btn-primary" onClick={() => setModal({ type: "add" })}
            style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Plus size={15} /> סטטוס חדש
          </button>
        }
      />

      {/* Info banner */}
      <div style={{
        marginBottom: 20, padding: "12px 16px", borderRadius: 10,
        background: "rgba(32,157,215,0.07)", borderRight: "4px solid var(--blue-primary)",
        fontSize: 13, color: "#0e6fa0", lineHeight: 1.6
      }}>
        <strong>הערה:</strong> הקטגוריה קובעת כיצד הסטטוס נספר בדוחות — "תומך נלהב" ו"תומך" שניהם בקטגוריית <strong>תומך</strong>.
      </div>

      {/* Cards grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: 14 }}>
        {statuses.map((status) => {
          const cat = status.category ?? "neutral";
          return (
            <div key={status.id} className="card" style={{ padding: 0, overflow: "hidden" }}>
              {/* Top color bar */}
              <div style={{ height: 4, background: status.color }} />
              <div style={{ padding: "16px 18px" }}>
                {/* Header */}
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                    background: status.color + "18",
                    display: "flex", alignItems: "center", justifyContent: "center"
                  }}>
                    <div style={{ width: 14, height: 14, borderRadius: "50%", background: status.color }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: "var(--navy)", marginBottom: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {status.name}
                    </div>
                    <span style={{ fontFamily: "monospace", fontSize: 11, color: "var(--gray-text)" }}>{status.color}</span>
                  </div>
                  {status.isDefault && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 20, flexShrink: 0,
                      background: "rgba(245,158,11,0.15)", color: "#92610a", border: "1px solid rgba(245,158,11,0.3)"
                    }}>
                      ברירת מחדל
                    </span>
                  )}
                </div>

                {/* Category badge */}
                <div style={{ marginBottom: 14 }}>
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    background: CATEGORY_COLORS[cat] + "18", color: CATEGORY_COLORS[cat],
                    borderRadius: 20, padding: "4px 12px", fontSize: 12, fontWeight: 700
                  }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: CATEGORY_COLORS[cat], display: "inline-block" }} />
                    {CATEGORY_LABELS[cat]}
                  </span>
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: 6, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
                  <button className="btn-secondary" onClick={() => setModal({ type: "edit", status })}
                    style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: "7px", fontSize: 12 }}>
                    <Pencil size={12} /> ערוך
                  </button>
                  {!status.isDefault && (
                    <button onClick={() => setSetDefaultId(status.id)}
                      style={{
                        flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                        padding: "7px", fontSize: 12, fontWeight: 600, borderRadius: 8, cursor: "pointer",
                        border: "1.5px solid rgba(22,163,74,0.3)", background: "rgba(22,163,74,0.06)",
                        color: "#16a34a"
                      }}>
                      <CheckCircle size={12} /> ברירת מחדל
                    </button>
                  )}
                  <button
                    onClick={() => !status.isDefault && setDeleteId(status.id)}
                    disabled={status.isDefault}
                    style={{
                      width: 34, display: "flex", alignItems: "center", justifyContent: "center",
                      padding: "7px", borderRadius: 8, cursor: status.isDefault ? "not-allowed" : "pointer",
                      border: "1.5px solid var(--border)", background: "#fff",
                      color: status.isDefault ? "#cbd5e1" : "#ef4444"
                    }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {statuses.length === 0 && (
          <div style={{ gridColumn: "1 / -1" }}>
            <div className="empty-state">
              <div className="empty-state-icon"><Tag size={28} color="var(--purple-secondary)" /></div>
              <h3 style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 700, color: "var(--navy)" }}>אין סטטוסים</h3>
              <p style={{ margin: "0 0 16px", color: "var(--gray-text)", fontSize: 14 }}>הגדר סטטוסים לסיווג בוחרים</p>
              <button className="btn-primary" onClick={() => setModal({ type: "add" })}
                style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Plus size={14} /> הוסף סטטוס ראשון
              </button>
            </div>
          </div>
        )}
      </div>

      {modal && <StatusModal mode={modal} onClose={() => setModal(null)} onSave={handleSave} />}

      {deleteId && toDelete && (
        <ConfirmDialog
          title="מחיקת סטטוס"
          message={`האם למחוק את "${toDelete.name}"? בוחרים שהוגדרו לו יועברו לסטטוס ברירת המחדל.`}
          confirmLabel="מחק סטטוס"
          onConfirm={handleDelete}
          onCancel={() => setDeleteId(null)}
        />
      )}
      {setDefaultId && toDefault && (
        <ConfirmDialog
          title="שינוי ברירת מחדל"
          message={`האם להגדיר את "${toDefault.name}" כסטטוס ברירת המחדל לכלל בוחרים חדשים?`}
          confirmLabel="קבע כברירת מחדל"
          danger={false}
          onConfirm={handleSetDefault}
          onCancel={() => setSetDefaultId(null)}
        />
      )}
    </div>
  );
}
