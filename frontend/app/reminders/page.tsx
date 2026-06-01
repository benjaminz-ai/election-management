"use client";

import { useState, useMemo } from "react";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { Reminder } from "@/types";
import PageHeader from "@/components/ui/PageHeader";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { Bell, Check, RotateCcw, Trash2, Clock, Phone, MapPin, AlertTriangle, CalendarClock } from "lucide-react";

function fmt(iso?: string) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("he-IL", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch { return iso; }
}

export default function RemindersPage() {
  const { state, updateReminder, deleteReminder } = useStore();
  const { currentUser } = useAuth();
  const { reminders, voters } = state;

  const [tab, setTab] = useState<"open" | "done">("open");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const voterMap = useMemo(() => new Map(voters.map(v => [v.id, v])), [voters]);

  // Personal: only this user's reminders
  const mine = useMemo(
    () => reminders.filter(r => r.userId === currentUser?.id),
    [reminders, currentUser]
  );

  const now = Date.now();
  const openList = useMemo(
    () => mine.filter(r => !r.done).sort((a, b) => {
      if (!a.dueAt && !b.dueAt) return b.createdAt.localeCompare(a.createdAt);
      if (!a.dueAt) return 1;
      if (!b.dueAt) return -1;
      return a.dueAt.localeCompare(b.dueAt);
    }),
    [mine]
  );
  const doneList = useMemo(
    () => mine.filter(r => r.done).sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? "")),
    [mine]
  );
  const overdueCount = openList.filter(r => r.dueAt && new Date(r.dueAt).getTime() < now).length;

  const list = tab === "open" ? openList : doneList;

  const markDone = (r: Reminder) => updateReminder({ ...r, done: true, completedAt: new Date().toISOString() });
  const reopen = (r: Reminder) => updateReminder({ ...r, done: false, completedAt: undefined });
  const confirmDelete = () => { if (deleteId) { deleteReminder(deleteId); setDeleteId(null); } };

  return (
    <div>
      <PageHeader title="התזכורות שלי" subtitle="תזכורות אישיות שיצרת — רק אתה רואה אותן" />

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, marginBottom: 18, borderBottom: "1.5px solid var(--border)" }}>
        {([["open", `פתוחות (${openList.length})`, "var(--blue-primary)"], ["done", `בוצעו (${doneList.length})`, "#16a34a"]] as const).map(([key, label, color]) => (
          <button key={key} onClick={() => setTab(key)}
            style={{ padding: "9px 20px", fontSize: 14, fontWeight: 600, background: "none", border: "none", borderBottom: tab === key ? `2.5px solid ${color}` : "2.5px solid transparent", color: tab === key ? color : "var(--text-secondary)", cursor: "pointer", marginBottom: -1.5 }}>
            {label}
          </button>
        ))}
        {overdueCount > 0 && tab === "open" && (
          <span style={{ marginRight: "auto", alignSelf: "center", display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 700, color: "#dc2626" }}>
            <AlertTriangle size={13} /> {overdueCount} עבר זמנן
          </span>
        )}
      </div>

      {list.length === 0 ? (
        <div className="empty-state" style={{ marginTop: 30 }}>
          <div className="empty-state-icon"><Bell size={28} color="var(--blue-primary)" /></div>
          <h3 style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 700, color: "var(--navy)" }}>
            {tab === "open" ? "אין תזכורות פתוחות" : "אין תזכורות שבוצעו"}
          </h3>
          <p style={{ margin: 0, color: "var(--gray-text)", fontSize: 14 }}>
            צור תזכורת ממסך הטלמרקטינג כשבוחר מבקש שתחזור אליו
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {list.map((r) => {
            const v = voterMap.get(r.voterId);
            const overdue = !r.done && r.dueAt && new Date(r.dueAt).getTime() < now;
            return (
              <div key={r.id} className="card"
                style={{ padding: "14px 18px", borderRight: `4px solid ${overdue ? "#ef4444" : r.done ? "#22c55e" : "var(--blue-primary)"}`, borderRadius: 10, opacity: r.done ? 0.7 : 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: "var(--navy)" }}>
                      {v ? `${v.firstName} ${v.lastName}` : "בוחר לא נמצא"}
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 14px", marginTop: 3, fontSize: 12, color: "var(--gray-text)" }}>
                      {v?.phone && <span style={{ display: "flex", alignItems: "center", gap: 4, direction: "ltr" }}><Phone size={11} />{v.phone}</span>}
                      {v && <span style={{ display: "flex", alignItems: "center", gap: 4 }}><MapPin size={11} />{[v.address.street, v.address.streetNumber, v.address.city].filter(Boolean).join(", ")}</span>}
                    </div>
                    <p style={{ margin: "8px 0 0", fontSize: 14, color: "var(--text-primary)", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{r.text}</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 8, fontSize: 12 }}>
                      {r.dueAt && (
                        <span style={{ display: "flex", alignItems: "center", gap: 5, fontWeight: 600, color: overdue ? "#dc2626" : "var(--blue-primary)" }}>
                          <CalendarClock size={13} /> {fmt(r.dueAt)} {overdue && "· עבר זמנו"}
                        </span>
                      )}
                      <span style={{ display: "flex", alignItems: "center", gap: 5, color: "#94a3b8" }}>
                        <Clock size={12} /> נוצר {fmt(r.createdAt)}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                    {r.done ? (
                      <button onClick={() => reopen(r)} title="החזר לפתוחות"
                        style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 12px", borderRadius: 8, border: "1.5px solid var(--border)", background: "#fff", color: "var(--text-secondary)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                        <RotateCcw size={13} /> החזר
                      </button>
                    ) : (
                      <button onClick={() => markDone(r)} title="סמן כבוצע"
                        style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 12px", borderRadius: 8, border: "none", background: "#16a34a", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                        <Check size={13} /> בוצע
                      </button>
                    )}
                    <button onClick={() => setDeleteId(r.id)} title="מחק"
                      style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 34, borderRadius: 8, border: "1.5px solid var(--border)", background: "#fff", color: "#ef4444", cursor: "pointer" }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {deleteId && (
        <ConfirmDialog
          title="מחיקת תזכורת"
          message="האם למחוק את התזכורת? לא ניתן לשחזר."
          confirmLabel="מחק"
          onConfirm={confirmDelete}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  );
}
