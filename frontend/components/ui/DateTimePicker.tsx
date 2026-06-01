"use client";

import { useRef, useState } from "react";

type Props = {
  value: string;                 // ISO string or ""
  onChange: (iso: string) => void;
};

const pad = (n: number) => String(n).padStart(2, "0");

function toLocalDateStr(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function DateTimePicker({ value, onChange }: Props) {
  const init = value ? new Date(value) : null;
  const [date, setDate] = useState<string>(init ? toLocalDateStr(init) : "");
  const [hour, setHour] = useState<number>(init ? init.getHours() : 9);   // 0-23
  const [minute, setMinute] = useState<number>(init ? init.getMinutes() : 0);
  const [mode, setMode] = useState<"hour" | "minute">("hour");
  const svgRef = useRef<SVGSVGElement>(null);

  const period: "AM" | "PM" = hour < 12 ? "AM" : "PM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;

  const emit = (d: string, h: number, m: number) => {
    if (!d) { onChange(""); return; }
    onChange(new Date(`${d}T${pad(h)}:${pad(m)}`).toISOString());
  };

  const setH = (h24: number) => { setHour(h24); emit(date, h24, minute); };
  const setM = (m: number) => { setMinute(m); emit(date, hour, m); };
  const setD = (d: string) => { setDate(d); emit(d, hour, minute); };
  const setPeriod = (p: "AM" | "PM") => {
    const base = hour % 12;
    const h24 = p === "PM" ? base + 12 : base;
    setH(h24);
  };

  // Click on the clock face → angle → hour or minute
  const handleClick = (e: React.MouseEvent) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (200 / rect.width) - 100;
    const y = (e.clientY - rect.top) * (200 / rect.height) - 100;
    let theta = Math.atan2(x, -y) * (180 / Math.PI); // degrees clockwise from 12
    if (theta < 0) theta += 360;
    if (mode === "hour") {
      let idx = Math.round(theta / 30) % 12;
      const h12 = idx === 0 ? 12 : idx;
      const h24 = period === "PM" ? (h12 === 12 ? 12 : h12 + 12) : (h12 === 12 ? 0 : h12);
      setH(h24);
      setMode("minute");
    } else {
      const m = Math.round(theta / 6) % 60;
      setM(m);
    }
  };

  // Hand angles (deg from 12, clockwise)
  const minuteAngle = minute * 6;
  const hourAngle = (hour % 12) * 30 + minute * 0.5;
  const pointFor = (angleDeg: number, len: number) => ({
    x: 100 + len * Math.sin(angleDeg * Math.PI / 180),
    y: 100 - len * Math.cos(angleDeg * Math.PI / 180),
  });

  const blue = "#209dd7";
  const minPt = pointFor(minuteAngle, 72);
  const hourPt = pointFor(hourAngle, 50);

  return (
    <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "flex-start" }}>
      {/* Date + readout */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 150 }}>
        <div>
          <label style={{ display: "block", fontSize: 12, color: "#64748b", fontWeight: 600, marginBottom: 4 }}>תאריך</label>
          <input type="date" value={date} onChange={(e) => setD(e.target.value)}
            style={{ padding: "8px 10px", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 13, outline: "none" }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button type="button" onClick={() => setMode("hour")}
            style={{ fontSize: 22, fontWeight: 800, color: mode === "hour" ? blue : "#94a3b8", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
            {pad(hour12)}
          </button>
          <span style={{ fontSize: 22, fontWeight: 800, color: "#cbd5e1" }}>:</span>
          <button type="button" onClick={() => setMode("minute")}
            style={{ fontSize: 22, fontWeight: 800, color: mode === "minute" ? blue : "#94a3b8", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
            {pad(minute)}
          </button>
          <div style={{ display: "flex", flexDirection: "column", gap: 3, marginRight: 4 }}>
            {(["AM", "PM"] as const).map((p) => (
              <button key={p} type="button" onClick={() => setPeriod(p)}
                style={{ padding: "2px 8px", fontSize: 11, fontWeight: 700, borderRadius: 6, cursor: "pointer", border: `1.5px solid ${period === p ? blue : "#e2e8f0"}`, background: period === p ? "rgba(32,157,215,0.1)" : "#fff", color: period === p ? blue : "#94a3b8" }}>
                {p === "AM" ? "לפנה״צ" : "אחה״צ"}
              </button>
            ))}
          </div>
        </div>
        <div style={{ fontSize: 11, color: "#94a3b8" }}>
          {mode === "hour" ? "בחר שעה על השעון" : "בחר דקות על השעון"}
        </div>
      </div>

      {/* Analog clock */}
      <svg ref={svgRef} width={200} height={200} viewBox="0 0 200 200" onClick={handleClick}
        style={{ cursor: "pointer", flexShrink: 0, touchAction: "none" }}>
        <circle cx={100} cy={100} r={96} fill="#f8fafc" stroke="#e2e8f0" strokeWidth={1.5} />
        {/* Hour or minute labels */}
        {mode === "hour"
          ? Array.from({ length: 12 }, (_, i) => {
              const h = i === 0 ? 12 : i;
              const p = pointFor(i * 30, 78);
              const active = hour12 === h;
              return (
                <g key={i}>
                  {active && <circle cx={p.x} cy={p.y} r={15} fill={blue} />}
                  <text x={p.x} y={p.y + 5} textAnchor="middle" fontSize={15} fontWeight={700} fill={active ? "#fff" : "#334155"}>{h}</text>
                </g>
              );
            })
          : Array.from({ length: 12 }, (_, i) => {
              const m = i * 5;
              const p = pointFor(i * 30, 78);
              const active = minute === m;
              return (
                <g key={i}>
                  {active && <circle cx={p.x} cy={p.y} r={15} fill={blue} />}
                  <text x={p.x} y={p.y + 5} textAnchor="middle" fontSize={13} fontWeight={700} fill={active ? "#fff" : "#334155"}>{pad(m)}</text>
                </g>
              );
            })}
        {/* Hands */}
        <line x1={100} y1={100} x2={hourPt.x} y2={hourPt.y} stroke={blue} strokeWidth={4} strokeLinecap="round" opacity={mode === "hour" ? 1 : 0.45} />
        <line x1={100} y1={100} x2={minPt.x} y2={minPt.y} stroke={blue} strokeWidth={3} strokeLinecap="round" opacity={mode === "minute" ? 1 : 0.45} />
        <circle cx={100} cy={100} r={5} fill={blue} />
      </svg>
    </div>
  );
}
