"use client";

import { useState, useRef } from "react";
import {
  Upload, Download, X, CheckCircle, AlertCircle, FileText, Users,
  ChevronDown, ChevronUp,
} from "lucide-react";
import { Voter, Group } from "@/types";
import { generateId } from "@/lib/utils";

// ── Field definitions ──────────────────────────────────────────────────────────
const HEADERS = [
  "שם פרטי", "שם משפחה", "מספר זהות", "טלפון",
  "רחוב", "מספר בית", "בניין", "דירה", "עיר",
];

const REQUIRED = new Set(["שם פרטי", "שם משפחה", "מספר זהות"]);

type ParsedRow = {
  rowNum: number;
  firstName: string;
  lastName: string;
  uniqueId: string;
  phone: string;
  street: string;
  streetNumber: string;
  building: string;
  apartment: string;
  city: string;
  groupNames: string[];
};

type ImportResult = {
  toImport: ParsedRow[];
  duplicateInStore: ParsedRow[];
  duplicateInFile: ParsedRow[];
  invalidRows: { rowNum: number; reason: string }[];
};

// ── CSV parsing ────────────────────────────────────────────────────────────────
function parseCSV(text: string): string[][] {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim().split("\n");
  return lines.map((line) => {
    const cells: string[] = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') { inQ = !inQ; }
      else if (c === "," && !inQ) { cells.push(cur.trim()); cur = ""; }
      else cur += c;
    }
    cells.push(cur.trim());
    return cells;
  });
}

// ── Template download ─────────────────────────────────────────────────────────
function downloadTemplate(groups: Group[]) {
  const bom = "\uFEFF"; // UTF-8 BOM so Excel opens Hebrew correctly
  const groupHeaders = groups.map((g) => g.name);
  const allHeaders = [...HEADERS, ...groupHeaders];
  const groupExamples = groups.map(() => "0");
  const exampleRow = ["ישראל","ישראלי","123456789","050-0000000","הרצל","5","א","12","תל אביב",...groupExamples].join(",");
  const csv = bom + allHeaders.join(",") + "\n" + exampleRow;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "תבנית_ייבוא_בוחרים.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// ── Sub-components ────────────────────────────────────────────────────────────
function SummaryTile({
  icon: Icon, label, value, color, bg,
}: {
  icon: React.ElementType; label: string; value: number; color: string; bg: string;
}) {
  return (
    <div style={{
      background: bg, border: `1.5px solid ${color}33`, borderRadius: 10,
      padding: "14px 16px", display: "flex", alignItems: "center", gap: 10,
    }}>
      <Icon size={20} color={color} style={{ flexShrink: 0 }} />
      <div>
        <div style={{ fontSize: 22, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>{label}</div>
      </div>
    </div>
  );
}

function CollapsibleList({
  title, items, color,
}: {
  title: string; items: ParsedRow[]; color: string;
}) {
  const [open, setOpen] = useState(false);
  if (items.length === 0) return null;
  const shown = open ? items : items.slice(0, 3);
  return (
    <div style={{ marginBottom: 14 }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex", alignItems: "center", gap: 6, background: "none",
          border: "none", cursor: "pointer", padding: 0, marginBottom: 6,
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 700, color }}>{title} ({items.length})</span>
        {items.length > 3
          ? (open ? <ChevronUp size={12} color={color} /> : <ChevronDown size={12} color={color} />)
          : null}
      </button>
      <div style={{
        background: "var(--bg)", borderRadius: 8, padding: "8px 12px",
        border: `1px solid ${color}22`,
      }}>
        {shown.map((r) => (
          <div key={`${r.uniqueId}-${r.rowNum}`} style={{
            display: "flex", gap: 10, padding: "4px 0",
            borderBottom: "1px solid var(--border)", fontSize: 12.5,
            color: "var(--text-secondary)",
          }}>
            <span style={{ color: "var(--text-muted)", minWidth: 36 }}>ש.{r.rowNum}</span>
            <span style={{ fontWeight: 600, color: "var(--navy)" }}>{r.firstName} {r.lastName}</span>
            <span>ת.ז. {r.uniqueId}</span>
            {r.city && <span style={{ color: "var(--text-muted)" }}>{r.city}</span>}
          </div>
        ))}
        {!open && items.length > 3 && (
          <button onClick={() => setOpen(true)} style={{
            fontSize: 11, color: "var(--blue-primary)", background: "none",
            border: "none", cursor: "pointer", padding: "4px 0", marginTop: 2,
          }}>
            + {items.length - 3} נוספים
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function ImportVotersModal({
  existingVoters,
  groups,
  onImport,
  onClose,
}: {
  existingVoters: Voter[];
  groups: Group[];
  onImport: (voters: Voter[]) => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState<"upload" | "review" | "done">("upload");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [importedCount, setImportedCount] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState("");
  const [parseError, setParseError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // ── File processing ──────────────────────────────────────────────────────────
  const processFile = (file: File) => {
    setParseError("");
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const rows = parseCSV(text);

        if (rows.length < 2) {
          setParseError("הקובץ ריק — נדרשת לפחות שורת כותרת ושורת נתונים אחת.");
          return;
        }

        // Normalise headers: strip BOM + trim
        const headers = rows[0].map((h) => h.replace(/^\uFEFF/, "").trim());

        // Check required headers exist
        const missingHeaders = Array.from(REQUIRED).filter((h) => !headers.includes(h));
        if (missingHeaders.length > 0) {
          setParseError(`חסרות עמודות חובה: ${missingHeaders.join(", ")}`);
          return;
        }

        const existingIds = new Set(existingVoters.map((v) => v.uniqueId));
        const seenInFile = new Map<string, number>(); // uniqueId → first row

        const toImport: ParsedRow[] = [];
        const duplicateInStore: ParsedRow[] = [];
        const duplicateInFile: ParsedRow[] = [];
        const invalidRows: { rowNum: number; reason: string }[] = [];

        const get = (row: string[], header: string) =>
          row[headers.indexOf(header)]?.trim() ?? "";

        // Detect group columns — any column whose name matches a group in the system
        const groupColNames = groups
          .map((g) => g.name)
          .filter((name) => headers.includes(name));

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          // Skip completely blank lines
          if (row.every((c) => !c)) continue;

          const rowNum = i + 1;
          const firstName  = get(row, "שם פרטי");
          const lastName   = get(row, "שם משפחה");
          const uniqueId   = get(row, "מספר זהות");

          if (!firstName)  { invalidRows.push({ rowNum, reason: "חסר שם פרטי" });   continue; }
          if (!lastName)   { invalidRows.push({ rowNum, reason: "חסר שם משפחה" });  continue; }
          if (!uniqueId)   { invalidRows.push({ rowNum, reason: "חסר מספר זהות" }); continue; }
          if (!/^\d{5,13}$/.test(uniqueId.replace(/-/g, ""))) {
            invalidRows.push({ rowNum, reason: `מספר זהות לא תקין: ${uniqueId}` });
            continue;
          }

          const parsed: ParsedRow = {
            rowNum, firstName, lastName, uniqueId: uniqueId.replace(/-/g, ""),
            phone:        get(row, "טלפון"),
            street:       get(row, "רחוב"),
            streetNumber: get(row, "מספר בית"),
            building:     get(row, "בניין"),
            apartment:    get(row, "דירה"),
            city:         get(row, "עיר"),
            groupNames:   groupColNames.filter((name) => get(row, name) === "1"),
          };

          if (existingIds.has(parsed.uniqueId)) {
            duplicateInStore.push(parsed);
          } else if (seenInFile.has(parsed.uniqueId)) {
            duplicateInFile.push(parsed);
          } else {
            seenInFile.set(parsed.uniqueId, rowNum);
            toImport.push(parsed);
          }
        }

        setResult({ toImport, duplicateInStore, duplicateInFile, invalidRows });
        setStep("review");
      } catch {
        setParseError("שגיאה בעיבוד הקובץ. ודא שזהו קובץ CSV תקין.");
      }
    };
    reader.readAsText(file, "UTF-8");
  };

  const handleConfirm = () => {
    if (!result) return;
    const groupIdsByName = new Map(groups.map((g) => [g.name, g.id]));
    const newVoters: Voter[] = result.toImport.map((r) => ({
      id: generateId(),
      firstName: r.firstName,
      lastName: r.lastName,
      uniqueId: r.uniqueId,
      phone: r.phone,
      address: {
        street: r.street,
        streetNumber: r.streetNumber,
        building: r.building,
        apartment: r.apartment,
        city: r.city,
      },
      groupIds: r.groupNames
        .map((name) => groupIdsByName.get(name))
        .filter((id): id is string => !!id),
      hasVoted: false,
    }));
    onImport(newVoters);
    setImportedCount(newVoters.length);
    setStep("done");
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="modal-header">
          <div className="modal-icon" style={{ background: "rgba(32,157,215,.1)" }}>
            <Upload size={18} color="var(--blue-primary)" />
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "var(--navy)" }}>
              ייבוא בוחרים
            </h2>
            <p style={{ margin: 0, fontSize: 13, color: "var(--gray-text)" }}>
              {step === "upload" && "העלה קובץ CSV עם רשימת הבוחרים"}
              {step === "review" && "בדוק את התוצאות לפני אישור הייבוא"}
              {step === "done"   && "הייבוא הושלם בהצלחה"}
            </p>
          </div>
          {/* Progress dots */}
          <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
            {(["upload", "review", "done"] as const).map((s, i) => (
              <div key={s} style={{
                width: step === s ? 20 : 8, height: 8, borderRadius: 4,
                background: step === s || (step === "done" && i < 2) || (step === "review" && i === 0)
                  ? "var(--blue-primary)" : "var(--border)",
                transition: "all .2s",
              }} />
            ))}
          </div>
        </div>

        {/* ── STEP 1: Upload ──────────────────────────────────────────── */}
        {step === "upload" && (
          <>
            {/* Template banner */}
            <div style={{
              background: "rgba(32,157,215,.06)", border: "1.5px solid rgba(32,157,215,.2)",
              borderRadius: 10, padding: "12px 16px", marginBottom: 18,
              display: "flex", alignItems: "center", gap: 12,
            }}>
              <FileText size={18} color="var(--blue-primary)" style={{ flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--navy)" }}>הורד תבנית לייבוא</div>
                <div style={{ fontSize: 12, color: "var(--gray-text)", marginTop: 1 }}>
                  קובץ CSV עם כל השדות ושורת דוגמה — פתח ב-Excel ומלא
                </div>
              </div>
              <button
                className="btn-secondary"
                onClick={() => downloadTemplate(groups)}
                style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0, fontSize: 12 }}
              >
                <Download size={13} /> תבנית CSV
              </button>
            </div>

            {/* Drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) processFile(f); }}
              onClick={() => fileRef.current?.click()}
              style={{
                border: `2px dashed ${dragging ? "var(--blue-primary)" : parseError ? "#ef4444" : "var(--border)"}`,
                borderRadius: 12, padding: "32px 20px", textAlign: "center",
                cursor: "pointer", transition: "all .15s",
                background: dragging ? "rgba(32,157,215,.04)" : parseError ? "#fef2f2" : "var(--bg)",
                marginBottom: parseError ? 10 : 18,
              }}
            >
              <Upload size={28} color={dragging ? "var(--blue-primary)" : "var(--text-muted)"} style={{ marginBottom: 10 }} />
              {fileName
                ? <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{fileName}</div>
                : <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>
                    גרור קובץ לכאן או לחץ לבחירה
                  </div>
              }
              <div style={{ fontSize: 12, color: "var(--gray-text)", marginTop: 4 }}>CSV בלבד (.csv)</div>
              <input
                ref={fileRef} type="file" accept=".csv" hidden
                onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f); e.target.value = ""; }}
              />
            </div>

            {parseError && (
              <div style={{
                marginBottom: 18, padding: "10px 14px", borderRadius: 8,
                background: "#fef2f2", border: "1.5px solid #fecaca",
                color: "#dc2626", fontSize: 13, display: "flex", gap: 8, alignItems: "flex-start",
              }}>
                <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                {parseError}
              </div>
            )}

            {/* Supported fields */}
            <div style={{ background: "var(--bg)", borderRadius: 10, padding: "12px 14px", marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--gray-text)", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 8 }}>
                שדות נתמכים
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {HEADERS.map((h) => (
                  <span key={h} style={{
                    padding: "3px 10px", borderRadius: 20,
                    background: REQUIRED.has(h) ? "rgba(32,157,215,.1)" : "#fff",
                    border: `1px solid ${REQUIRED.has(h) ? "rgba(32,157,215,.3)" : "var(--border)"}`,
                    fontSize: 12, color: REQUIRED.has(h) ? "var(--blue-primary)" : "var(--text-secondary)",
                    fontWeight: REQUIRED.has(h) ? 600 : 400,
                  }}>
                    {h}{REQUIRED.has(h) && <span style={{ color: "#ef4444", marginRight: 1 }}>*</span>}
                  </span>
                ))}
              </div>
              {groups.length > 0 && (
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--border)" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--gray-text)", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 6 }}>
                    קבוצות במערכת (1 = שייך לקבוצה)
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {groups.map((g) => (
                      <span key={g.id} style={{
                        padding: "3px 10px", borderRadius: 20,
                        background: "rgba(117,57,145,.08)",
                        border: "1px solid rgba(117,57,145,.25)",
                        fontSize: 12, color: "var(--purple-secondary)", fontWeight: 500,
                      }}>
                        {g.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>
                שדות עם * חובה · שאר השדות אופציונליים
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={onClose}>ביטול</button>
            </div>
          </>
        )}

        {/* ── STEP 2: Review ──────────────────────────────────────────── */}
        {step === "review" && result && (
          <>
            {/* Summary tiles */}
            <div className="form-2col" style={{ marginBottom: 18 }}>
              <SummaryTile icon={CheckCircle} label="מוכנים לייבוא"    value={result.toImport.length}       color="#22c55e" bg="#f0fdf4" />
              <SummaryTile icon={AlertCircle} label="קיימים במערכת"   value={result.duplicateInStore.length} color="#f59e0b" bg="#fffbeb" />
              <SummaryTile icon={AlertCircle} label="כפולים בקובץ"    value={result.duplicateInFile.length}  color="#8b5cf6" bg="#f5f3ff" />
              <SummaryTile icon={X}           label="שורות לא תקינות" value={result.invalidRows.length}      color="#ef4444" bg="#fef2f2" />
            </div>

            {/* Details */}
            <div style={{ maxHeight: 260, overflowY: "auto", paddingLeft: 2 }}>
              <CollapsibleList
                title="קיימים במערכת — לא יובאו"
                items={result.duplicateInStore}
                color="#f59e0b"
              />
              <CollapsibleList
                title="כפולים בקובץ — רק הופעה ראשונה תובא"
                items={result.duplicateInFile}
                color="#8b5cf6"
              />
              {result.invalidRows.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#ef4444", marginBottom: 6 }}>
                    שורות לא תקינות ({result.invalidRows.length})
                  </div>
                  <div style={{ background: "var(--bg)", borderRadius: 8, padding: "8px 12px", border: "1px solid #fecaca" }}>
                    {result.invalidRows.slice(0, 5).map((r) => (
                      <div key={r.rowNum} style={{ fontSize: 12, color: "var(--text-secondary)", padding: "3px 0" }}>
                        <span style={{ color: "var(--text-muted)", marginLeft: 6 }}>ש.{r.rowNum}:</span>
                        {r.reason}
                      </div>
                    ))}
                    {result.invalidRows.length > 5 && (
                      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                        ועוד {result.invalidRows.length - 5} שורות…
                      </div>
                    )}
                  </div>
                </div>
              )}

              {result.toImport.length === 0 && (
                <div style={{
                  padding: 16, background: "#fffbeb", borderRadius: 10,
                  border: "1.5px solid #fde68a", textAlign: "center", color: "#92400e", fontSize: 13,
                }}>
                  אין בוחרים חדשים לייבוא בקובץ זה.
                </div>
              )}
            </div>

            <div className="modal-footer" style={{ marginTop: 18 }}>
              <button className="btn-secondary" onClick={() => { setStep("upload"); setResult(null); }}>
                ← חזור
              </button>
              {result.toImport.length > 0 && (
                <button
                  className="btn-primary"
                  onClick={handleConfirm}
                  style={{ display: "flex", alignItems: "center", gap: 6 }}
                >
                  <Users size={14} />
                  ייבא {result.toImport.length} בוחרים
                </button>
              )}
              {result.toImport.length === 0 && (
                <button className="btn-secondary" onClick={onClose}>סגור</button>
              )}
            </div>
          </>
        )}

        {/* ── STEP 3: Done ────────────────────────────────────────────── */}
        {step === "done" && (
          <div style={{ textAlign: "center", padding: "16px 0 8px" }}>
            <div style={{
              width: 68, height: 68, borderRadius: "50%",
              background: "linear-gradient(135deg,#f0fdf4,#dcfce7)",
              border: "2px solid #86efac",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 18px",
            }}>
              <CheckCircle size={34} color="#22c55e" />
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "var(--navy)", marginBottom: 8 }}>
              הייבוא הושלם!
            </div>
            <div style={{ fontSize: 15, color: "var(--text-secondary)", marginBottom: 4 }}>
              <span style={{ fontWeight: 700, color: "#22c55e", fontSize: 20 }}>{importedCount}</span>{" "}
              בוחרים חדשים נוספו למערכת
            </div>
            {result && (result.duplicateInStore.length + result.duplicateInFile.length + result.invalidRows.length) > 0 && (
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>
                {result.duplicateInStore.length > 0 && `${result.duplicateInStore.length} קיימים · `}
                {result.duplicateInFile.length  > 0 && `${result.duplicateInFile.length} כפולים · `}
                {result.invalidRows.length      > 0 && `${result.invalidRows.length} שגויים`}
              </div>
            )}
            <div className="modal-footer" style={{ marginTop: 28, justifyContent: "center" }}>
              <button className="btn-primary" onClick={onClose}>
                <CheckCircle size={14} /> סיום
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
