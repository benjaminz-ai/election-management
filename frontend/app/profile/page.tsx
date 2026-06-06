"use client";

import { useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import PageHeader from "@/components/ui/PageHeader";
import { Camera, Loader2, CheckCircle2, Trash2, Mail, Phone, ShieldCheck } from "lucide-react";

const ROLE_LABELS: Record<string, string> = {
  admin: "מנהל מערכת", field: "שטח", telemarketing: "טלמרקטינג",
  group_leader: "ראש קבוצה", division_head: "ראש אגף",
};

// Read a chosen image file, crop-to-square and resize to `size`px, return a
// small JPEG data URL (~20-40KB) so it fits comfortably inside the user doc.
function fileToAvatar(file: File, size = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("no canvas")); return; }
        const scale = Math.max(size / img.width, size / img.height);
        const w = img.width * scale, h = img.height * scale;
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.onerror = () => reject(new Error("bad image"));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error("read failed"));
    reader.readAsDataURL(file);
  });
}

export default function ProfilePage() {
  const { currentUser } = useAuth();
  const { updateMyPhoto } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  if (!currentUser) return null;

  const initials = `${currentUser.firstName?.[0] ?? ""}${currentUser.lastName?.[0] ?? ""}`;

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("יש לבחור קובץ תמונה (JPG/PNG)."); return; }
    setBusy(true); setError(""); setSaved(false);
    try {
      const dataUrl = await fileToAvatar(file);
      await updateMyPhoto(currentUser.id, dataUrl);
      setSaved(true); setTimeout(() => setSaved(false), 2500);
    } catch {
      setError("העלאת התמונה נכשלה. נסה תמונה אחרת.");
    } finally { setBusy(false); }
  };

  const removePhoto = async () => {
    setBusy(true); setError(""); setSaved(false);
    try { await updateMyPhoto(currentUser.id, ""); }
    catch { setError("מחיקת התמונה נכשלה."); }
    finally { setBusy(false); }
  };

  return (
    <div>
      <PageHeader title="הפרופיל שלי" subtitle="עדכון תמונת הפרופיל שלך" />

      <div className="card" style={{ maxWidth: 560, padding: "28px 26px" }}>
        {/* Avatar + upload */}
        <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 26 }}>
          <div style={{ position: "relative", flexShrink: 0 }}>
            <div style={{
              width: 96, height: 96, borderRadius: "50%", overflow: "hidden",
              background: currentUser.photoURL ? "#eef2f7" : "linear-gradient(135deg,#209dd7,#753991)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontWeight: 800, fontSize: 32,
            }}>
              {currentUser.photoURL
                ? <img src={currentUser.photoURL} alt="תמונת פרופיל" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : initials}
            </div>
            <button onClick={() => fileRef.current?.click()} disabled={busy}
              title="העלאת תמונה"
              style={{
                position: "absolute", bottom: 0, left: 0, width: 32, height: 32, borderRadius: "50%",
                background: "#209dd7", color: "#fff", border: "2px solid #fff", cursor: busy ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
              {busy ? <Loader2 size={15} className="spin" /> : <Camera size={15} />}
            </button>
          </div>

          <div>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "var(--dark-navy)" }}>
              {currentUser.firstName} {currentUser.lastName}
            </h2>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 6, fontSize: 13, color: "#64748b" }}>
              <ShieldCheck size={14} /> {ROLE_LABELS[currentUser.role] ?? currentUser.role}
            </span>
            <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
              <button onClick={() => fileRef.current?.click()} disabled={busy}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", background: "linear-gradient(135deg,#209dd7,#1a7fad)", color: "#fff", border: "none", borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: busy ? "not-allowed" : "pointer" }}>
                <Camera size={14} /> {currentUser.photoURL ? "החלף תמונה" : "העלה תמונה"}
              </button>
              {currentUser.photoURL && (
                <button onClick={removePhoto} disabled={busy}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", background: "#fff", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: busy ? "not-allowed" : "pointer" }}>
                  <Trash2 size={14} /> הסר
                </button>
              )}
            </div>
          </div>

          <input ref={fileRef} type="file" accept="image/*" onChange={onPick} style={{ display: "none" }} />
        </div>

        {saved && (
          <div style={{ display: "flex", alignItems: "center", gap: 7, background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#16a34a", borderRadius: 10, padding: "9px 14px", fontSize: 13, fontWeight: 600, marginBottom: 16 }}>
            <CheckCircle2 size={16} /> התמונה עודכנה
          </div>
        )}
        {error && (
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", borderRadius: 10, padding: "9px 14px", fontSize: 13, marginBottom: 16 }}>
            {error}
          </div>
        )}

        {/* Read-only details (set by the admin) */}
        <div style={{ borderTop: "1px solid var(--border,#e2e8f0)", paddingTop: 18, display: "flex", flexDirection: "column", gap: 14 }}>
          <Field icon={<Mail size={15} />} label="אימייל" value={currentUser.email} />
          <Field icon={<Phone size={15} />} label="טלפון" value={currentUser.phone || "—"} />
          <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
            השם, האימייל והטלפון נקבעים על ידי מנהל המערכת. לעדכון פרטים אלו פנה למנהל.
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ color: "#94a3b8" }}>{icon}</span>
      <span style={{ fontSize: 12, color: "#94a3b8", minWidth: 56 }}>{label}</span>
      <span style={{ fontSize: 14, color: "var(--text-primary,#1e293b)", fontWeight: 600, direction: "ltr", unicodeBidi: "plaintext" }}>{value}</span>
    </div>
  );
}
