"use client";

import { useState } from "react";
import { Clock, X } from "lucide-react";

type Props = {
  value: string;                 // ISO string or ""
  onChange: (iso: string) => void;
};

const pad = (n: number) => String(n).padStart(2, "0");
const toDateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function presetDates(): { label: string; date: Date }[] {
  const now = new Date();
  const inHours = (h: number) => { const d = new Date(now); d.setHours(d.getHours() + h, d.getMinutes(), 0, 0); return d; };
  const at = (addDays: number, h: number) => { const d = new Date(now); d.setDate(d.getDate() + addDays); d.setHours(h, 0, 0, 0); return d; };
  return [
    { label: "בעוד שעה", date: inHours(1) },
    { label: "בעוד 3 שעות", date: inHours(3) },
    { label: "היום 18:00", date: at(0, 18) },
    { label: "מחר 09:00", date: at(1, 9) },
    { label: "מחר 18:00", date: at(1, 18) },
  ];
}

export default function DateTimePicker({ value, onChange }: Props) {
  const [showCustom, setShowCustom] = useState(false);
  const cur = value ? new Date(value) : null;
  const dateStr = cur ? toDateStr(cur) : "";
  const timeStr = cur ? `${pad(cur.getHours())}:${pad(cur.getMinutes())}` : "";

  const setCustom = (d: string, t: string) => {
    if (!d) { onChange(""); return; }
    onChange(new Date(`${d}T${t || "09:00"}`).toISOString());
  };

  const readout = cur
    ? cur.toLocaleString("he-IL", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
    : "";

  const chip: React.CSSProperties = {
    padding: "7px 14px", borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: "pointer",
    border: "1.5px solid #e2e8f0", background: "#fff", color: "#334155",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Quick presets */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
        {presetDates().map((p) => (
          <button key={p.label} type="button" onClick={() => onChange(p.date.toISOString())} style={chip}>
            {p.label}
          </button>
        ))}
        <button type="button" onClick={() => setShowCustom((s) => !s)}
          style={{ ...chip, borderColor: showCustom ? "#209dd7" : "#e2e8f0", color: showCustom ? "#209dd7" : "#334155", background: showCustom ? "rgba(32,157,215,0.08)" : "#fff" }}>
          מותאם אישית…
        </button>
      </div>

      {/* Custom native fields */}
      {showCustom && (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end", padding: "12px 14px", background: "#f8fafc", borderRadius: 10, border: "1px solid #e2e8f0" }}>
          <div>
            <label style={{ display: "block", fontSize: 12, color: "#64748b", fontWeight: 600, marginBottom: 4 }}>תאריך</label>
            <input type="date" value={dateStr} onChange={(e) => setCustom(e.target.value, timeStr)}
              style={{ padding: "8px 10px", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 13, outline: "none" }} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, color: "#64748b", fontWeight: 600, marginBottom: 4 }}>שעה</label>
            <input type="time" value={timeStr} onChange={(e) => setCustom(dateStr || toDateStr(new Date()), e.target.value)}
              style={{ padding: "8px 10px", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 13, outline: "none" }} />
          </div>
        </div>
      )}

      {/* Selected readout */}
      {cur && (
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, alignSelf: "flex-start", padding: "6px 12px", borderRadius: 8, background: "rgba(32,157,215,0.08)", color: "#0e6fa0", fontSize: 13, fontWeight: 600 }}>
          <Clock size={14} /> {readout}
          <button type="button" onClick={() => onChange("")} aria-label="נקה מועד"
            style={{ background: "none", border: "none", cursor: "pointer", color: "#0e6fa0", display: "flex", padding: 0 }}>
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
