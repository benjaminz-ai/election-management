"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useStore, getActiveTenant } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { auth } from "@/lib/firebase";
import { AppUser, UserRole } from "@/types";
import PageHeader from "@/components/ui/PageHeader";
import { Plus, Pencil, Snowflake, PlayCircle, Users, Phone, Mail, Eye, EyeOff, Search, X, ShieldCheck, Briefcase, Headphones, UserCheck, Shield } from "lucide-react";
import { usePagination } from "@/hooks/usePagination";
import ScrollSentinel from "@/components/ui/ScrollSentinel";
import PaginationFooter from "@/components/ui/PaginationFooter";

const ROLE_LABELS: Record<UserRole, string> = {
  admin: "מנהל מערכת",
  field: "שטח",
  telemarketing: "טלמרקטינג",
  group_leader: "ראש קבוצה",
  division_head: "ראש אגף",
};

const ROLE_BADGE: Record<UserRole, string> = {
  admin: "badge-navy",
  field: "badge-green",
  telemarketing: "badge-blue",
  group_leader: "badge-purple",
  division_head: "badge-yellow",
};

const ROLE_ICONS: Record<UserRole, React.ReactNode> = {
  admin: <ShieldCheck size={13} />,
  field: <Briefcase size={13} />,
  telemarketing: <Headphones size={13} />,
  group_leader: <UserCheck size={13} />,
  division_head: <Shield size={13} />,
};

const emptyUser = (): Omit<AppUser, "id" | "createdAt" | "isFrozen"> => ({
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  role: "telemarketing",
  password: "",
});

export default function UsersPage() {
  const { state, freezeUser, refreshUsers } = useStore();
  const { currentUser } = useAuth();
  const { users } = state;
  const isAdmin = currentUser?.role === "admin";
  const router = useRouter();

  useEffect(() => {
    if (currentUser && !isAdmin) router.replace("/dashboard");
  }, [currentUser, isAdmin, router]);

  if (!isAdmin) return null;

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<AppUser | null>(null);
  const [form, setForm] = useState<Omit<AppUser, "id" | "createdAt" | "isFrozen">>(emptyUser());
  const [showPassword, setShowPassword] = useState(false);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<UserRole | "all">("all");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let list = users;
    if (roleFilter !== "all") list = list.filter((u) => u.role === roleFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((u) =>
        `${u.firstName} ${u.lastName}`.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.phone.toLowerCase().includes(q)
      );
    }
    return list;
  }, [users, roleFilter, search]);

  const { visible: visibleUsers, hasMore, loadMore, showing, total } = usePagination(filtered);

  const openAdd = () => { setForm(emptyUser()); setEditing(null); setShowPassword(false); setFormError(null); setSubmitting(false); setShowForm(true); };
  const openEdit = (u: AppUser) => {
    setForm({ firstName: u.firstName, lastName: u.lastName, email: u.email, phone: u.phone, role: u.role, password: u.password });
    setEditing(u);
    setShowPassword(false);
    setFormError(null);
    setSubmitting(false);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    setSubmitting(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) {
        setFormError("פג תוקף ההתחברות — התנתק והתחבר מחדש ונסה שוב.");
        setSubmitting(false);
        return;
      }

      // Editing an existing user: update the REAL Firebase Auth account
      // (password + role) plus the Firestore profile, via the server route.
      // Leaving the password field empty keeps the current password.
      if (editing) {
        const res = await fetch("/api/admin/update-user", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            idToken,
            uid: editing.id,
            firstName: form.firstName,
            lastName: form.lastName,
            phone: form.phone,
            role: form.role,
            password: form.password, // empty string => unchanged
          }),
        });
        const data = await res.json().catch(() => ({} as { error?: string }));
        if (!res.ok) {
          const raw = (data as { error?: string }).error || "";
          let msg = raw === "forbidden" ? "אין לך הרשאת מנהל לעדכון משתמשים."
                  : `עדכון המשתמש נכשל: ${raw || res.status}`;
          if (raw.includes("user-not-found")) msg = "למשתמש זה אין חשבון התחברות פעיל לעדכון.";
          if (raw.includes("invalid-password") || raw.includes("PASSWORD")) msg = "הסיסמה חייבת להכיל לפחות 6 תווים.";
          setFormError(msg);
          setSubmitting(false);
          return;
        }
        await refreshUsers();
        setSubmitting(false);
        setShowForm(false);
        return;
      }

      // New user: create a real Firebase Auth account + role claim + profile.
      const res = await fetch("/api/admin/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idToken,
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          phone: form.phone,
          role: form.role,
          password: form.password,
          tenantId: getActiveTenant(),
        }),
      });

      const data = await res.json().catch(() => ({} as { error?: string }));
      if (!res.ok) {
        const map: Record<string, string> = {
          forbidden: "אין לך הרשאת מנהל ליצירת משתמשים.",
          "missing fields": "חסרים שדות חובה.",
          "missing token": "פג תוקף ההתחברות — התחבר מחדש.",
        };
        const raw = (data as { error?: string }).error || "";
        let msg = map[raw] || `יצירת המשתמש נכשלה: ${raw || res.status}`;
        if (raw.includes("email-already-exists")) msg = "כתובת האימייל כבר קיימת במערכת.";
        if (raw.includes("invalid-password") || raw.includes("PASSWORD")) msg = "הסיסמה חייבת להכיל לפחות 6 תווים.";
        if (raw.includes("invalid-email")) msg = "כתובת האימייל אינה תקינה.";
        setFormError(msg);
        setSubmitting(false);
        return;
      }

      // Reload the roster so the new uid-keyed profile shows up.
      await refreshUsers();
      setSubmitting(false);
      setShowForm(false);
    } catch {
      setFormError("שגיאת רשת. נסה שוב.");
      setSubmitting(false);
    }
  };

  // Never allow freezing yourself or a super admin.
  const cannotFreeze = (u: AppUser) => u.id === currentUser?.id || u.isSuperAdmin === true;

  const handleFreeze = (u: AppUser) => {
    if (cannotFreeze(u)) return;
    freezeUser(u.id, !u.isFrozen);
  };

  const frozenCount = users.filter((u) => u.isFrozen).length;
  const activeCount = users.length - frozenCount;

  return (
    <div>
      <PageHeader
        title="ניהול משתמשים"
        subtitle={`${activeCount} פעילים · ${frozenCount} מוקפאים`}
        action={
          <button className="btn-primary" onClick={openAdd} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Plus size={15} /> הוסף משתמש
          </button>
        }
      />

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 10, marginBottom: 24 }}>
        {(Object.entries(ROLE_LABELS) as [UserRole, string][]).map(([role, label]) => {
          const count = users.filter((u) => u.role === role).length;
          const isActive = roleFilter === role;
          return (
            <button
              key={role}
              onClick={() => setRoleFilter(isActive ? "all" : role)}
              style={{
                background: isActive ? "var(--navy)" : "#fff",
                border: `1.5px solid ${isActive ? "var(--navy)" : "var(--border)"}`,
                borderRadius: 12, padding: "12px 14px", cursor: "pointer",
                textAlign: "right", transition: "all 0.15s",
                boxShadow: isActive ? "0 4px 12px rgba(3,33,71,0.2)" : "var(--shadow-sm)"
              }}
            >
              <div style={{ fontSize: 22, fontWeight: 800, color: isActive ? "#fff" : "var(--navy)", lineHeight: 1 }}>{count}</div>
              <div style={{ fontSize: 11, color: isActive ? "rgba(255,255,255,0.75)" : "var(--gray-text)", marginTop: 4, fontWeight: 600 }}>{label}</div>
            </button>
          );
        })}
      </div>

      {/* Search + filter bar */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <div className="search-wrap" style={{ flex: 1, minWidth: 200 }}>
          <Search size={15} color="var(--gray-text)" />
          <input className="input" placeholder="חפש לפי שם, אימייל או טלפון..."
            value={search} onChange={(e) => setSearch(e.target.value)}
            style={{ border: "none", boxShadow: "none", padding: 0, background: "transparent", flex: 1 }} />
          {search && (
            <button onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--gray-text)", display: "flex", padding: 0 }}>
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Table card — desktop */}
      <div className="card desktop-voter-table" style={{ overflow: "hidden", padding: 0 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--bg)", borderBottom: "1.5px solid var(--border)" }}>
              <th style={thStyle}>משתמש</th>
              <th style={{ ...thStyle }} className="hide-mobile">פרטי קשר</th>
              <th style={thStyle}>תפקיד</th>
              <th style={thStyle}>סטטוס</th>
              <th style={{ ...thStyle, width: 90 }}>פעולות</th>
            </tr>
          </thead>
          <tbody>
            {visibleUsers.map((u) => (
              <tr key={u.id} style={{
                borderBottom: "1px solid var(--border)", opacity: u.isFrozen ? 0.6 : 1,
                transition: "background 0.1s"
              }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "")}
              >
                {/* User cell */}
                <td style={tdStyle}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{
                      width: 38, height: 38, borderRadius: "50%", flexShrink: 0,
                      background: u.isFrozen ? "#e2e8f0" : "linear-gradient(135deg, var(--blue-primary), var(--purple-secondary))",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: u.isFrozen ? "#94a3b8" : "#fff", fontWeight: 700, fontSize: 13
                    }}>
                      {u.firstName[0]}{u.lastName[0]}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: "var(--navy)" }}>
                        {u.firstName} {u.lastName}
                        {u.id === currentUser?.id && (
                          <span style={{ marginRight: 6, fontSize: 11, color: "var(--blue-primary)", fontWeight: 400 }}>(אתה)</span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--gray-text)" }}>
                        {new Date(u.createdAt).toLocaleDateString("he-IL")}
                      </div>
                    </div>
                  </div>
                </td>

                {/* Contact */}
                <td style={tdStyle} className="hide-mobile">
                  <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--text-secondary)" }}>
                      <Mail size={11} color="var(--gray-text)" />
                      <span dir="ltr">{u.email}</span>
                    </span>
                    {u.phone && (
                      <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--text-secondary)" }}>
                        <Phone size={11} color="var(--gray-text)" />
                        <span dir="ltr">{u.phone}</span>
                      </span>
                    )}
                  </div>
                </td>

                {/* Role */}
                <td style={tdStyle}>
                  <span className={`badge ${ROLE_BADGE[u.role]}`} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                    {ROLE_ICONS[u.role]}
                    {ROLE_LABELS[u.role]}
                  </span>
                </td>

                {/* Status */}
                <td style={tdStyle}>
                  {u.isFrozen ? (
                    <span className="badge badge-gray" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <Snowflake size={11} /> מוקפא
                    </span>
                  ) : (
                    <span className="badge badge-green" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#16a34a", display: "inline-block" }} />
                      פעיל
                    </span>
                  )}
                </td>

                {/* Actions */}
                <td style={{ ...tdStyle, textAlign: "center" }}>
                  <div style={{ display: "flex", gap: 2, justifyContent: "center" }}>
                    <button className="btn-icon" onClick={() => openEdit(u)} title="עריכה">
                      <Pencil size={13} />
                    </button>
                    <button
                      className="btn-icon"
                      onClick={() => handleFreeze(u)}
                      disabled={cannotFreeze(u)}
                      title={u.isSuperAdmin ? "לא ניתן להקפיא אדמין על" : u.id === currentUser?.id ? "לא ניתן להקפיא את עצמך" : (u.isFrozen ? "בטל הקפאה" : "הקפא משתמש")}
                      style={{
                        color: u.isFrozen ? "#16a34a" : "#3b82f6",
                        opacity: cannotFreeze(u) ? 0.3 : 1,
                        cursor: cannotFreeze(u) ? "not-allowed" : "pointer",
                      }}
                    >
                      {u.isFrozen ? <PlayCircle size={13} /> : <Snowflake size={13} />}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {users.length === 0 && (
          <div style={{ padding: 48, textAlign: "center", color: "var(--gray-text)" }}>אין משתמשים במערכת.</div>
        )}
        {users.length > 0 && filtered.length === 0 && (
          <div style={{ padding: 32, textAlign: "center", color: "var(--gray-text)", fontSize: 13 }}>
            לא נמצאו משתמשים התואמים את הסינון
          </div>
        )}
        {filtered.length > 0 && <ScrollSentinel onIntersect={loadMore} />}
        <PaginationFooter showing={showing} total={total} hasMore={hasMore} entityLabel="משתמשים" />
      </div>

      {/* Mobile card list */}
      <div className="mobile-voter-cards" style={{ display: "none", flexDirection: "column", gap: 10 }}>
        {visibleUsers.map((u) => (
          <div key={u.id} className="card" style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, opacity: u.isFrozen ? 0.7 : 1 }}>
            <div style={{ width: 44, height: 44, borderRadius: "50%", flexShrink: 0, background: u.isFrozen ? "#e2e8f0" : "linear-gradient(135deg,#209dd7,#753991)", display: "flex", alignItems: "center", justifyContent: "center", color: u.isFrozen ? "#94a3b8" : "#fff", fontWeight: 700, fontSize: 15 }}>
              {u.firstName[0]}{u.lastName[0]}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: "var(--navy)", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                {u.firstName} {u.lastName}
                {u.id === currentUser?.id && <span style={{ fontSize: 11, color: "var(--blue-primary)", fontWeight: 400 }}>(אתה)</span>}
                {u.isFrozen && <span style={{ fontSize: 11, color: "#94a3b8" }}>🔒 מוקפא</span>}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.email}</div>
              <div style={{ marginTop: 6 }}>
                <span className={`badge ${ROLE_BADGE[u.role]}`} style={{ fontSize: 11 }}>{ROLE_LABELS[u.role]}</span>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
              <button className="btn-icon" onClick={() => openEdit(u)} style={{ minWidth: 36, minHeight: 36 }}><Pencil size={13} /></button>
              <button className="btn-icon" onClick={() => handleFreeze(u)} disabled={cannotFreeze(u)} style={{ minWidth: 36, minHeight: 36, color: u.isFrozen ? "#22c55e" : "#f59e0b", opacity: cannotFreeze(u) ? 0.3 : 1, cursor: cannotFreeze(u) ? "not-allowed" : "pointer" }} title={u.isSuperAdmin ? "לא ניתן להקפיא אדמין על" : u.id === currentUser?.id ? "לא ניתן להקפיא את עצמך" : (u.isFrozen ? "הסר הקפאה" : "הקפא")}><Snowflake size={13} /></button>
            </div>
          </div>
        ))}
        {filtered.length > 0 && <ScrollSentinel onIntersect={loadMore} />}
        <PaginationFooter showing={showing} total={total} hasMore={hasMore} entityLabel="משתמשים" />
      </div>

      {/* Info notice */}
      <div style={{
        marginTop: 14, padding: "10px 14px",
        background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.25)",
        borderRadius: 10, fontSize: 12, color: "#92610a",
        display: "flex", alignItems: "center", gap: 8
      }}>
        <Snowflake size={13} color="#d97706" />
        מחיקת משתמשים אינה אפשרית — ניתן להקפיא משתמש כדי למנוע גישה למערכת.
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-icon" style={{ background: "rgba(32,157,215,0.1)" }}>
                <Users size={18} color="var(--blue-primary)" />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "var(--navy)" }}>
                  {editing ? "עריכת משתמש" : "הוספת משתמש חדש"}
                </h2>
                <p style={{ margin: 0, fontSize: 13, color: "var(--gray-text)" }}>
                  {editing ? "עדכן פרטי המשתמש" : "מלא פרטים ליצירת חשבון חדש"}
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
              <div className="form-2col" style={{ marginBottom: 14 }}>
                <div>
                  <label className="label">אימייל <span style={{ color: "#ef4444" }}>*</span></label>
                  <input className="input" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} dir="ltr" style={{ textAlign: "left" }} />
                </div>
                <div>
                  <label className="label">טלפון</label>
                  <input className="input" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="050-0000000" />
                </div>
              </div>
              <div style={{ marginBottom: 14 }}>
                <label className="label">תפקיד <span style={{ color: "#ef4444" }}>*</span></label>
                <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}>
                  {(Object.entries(ROLE_LABELS) as [UserRole, string][]).map(([r, l]) => (
                    <option key={r} value={r}>{l}</option>
                  ))}
                </select>
              </div>
              <div style={{ marginBottom: 22 }}>
                <label className="label">
                  {editing ? "סיסמה (השאר ריק לאי שינוי)" : "סיסמה"} {!editing && <span style={{ color: "#ef4444" }}>*</span>}
                </label>
                <div style={{ position: "relative" }}>
                  <input className="input" type={showPassword ? "text" : "password"}
                    required={!editing} value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder={editing ? "••••••••" : "לפחות 6 תווים"}
                    style={{ paddingLeft: 40 }} />
                  <button type="button" onClick={() => setShowPassword((v) => !v)}
                    style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--gray-text)", padding: 4, display: "flex" }}>
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
              {formError && (
                <div style={{
                  marginBottom: 14, padding: "10px 14px",
                  background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.3)",
                  borderRadius: 10, fontSize: 13, color: "#b91c1c"
                }}>
                  {formError}
                </div>
              )}
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowForm(false)} disabled={submitting}>ביטול</button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? "יוצר…" : editing ? "שמור שינויים" : "הוסף משתמש"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const thStyle: React.CSSProperties = { padding: "11px 16px", textAlign: "right", fontSize: 11, fontWeight: 700, color: "var(--gray-text)", textTransform: "uppercase", letterSpacing: "0.05em" };
const tdStyle: React.CSSProperties = { padding: "13px 16px", verticalAlign: "middle" };
