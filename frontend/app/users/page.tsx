"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { AppUser, UserRole } from "@/types";
import PageHeader from "@/components/ui/PageHeader";
import { Plus, Pencil, Snowflake, PlayCircle, Users, Phone, Mail, Eye, EyeOff } from "lucide-react";
import { usePagination } from "@/hooks/usePagination";
import ScrollSentinel from "@/components/ui/ScrollSentinel";
import PaginationFooter from "@/components/ui/PaginationFooter";

const generateId = () => `usr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

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

const emptyUser = (): Omit<AppUser, "id" | "createdAt" | "isFrozen"> => ({
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  role: "telemarketing",
  password: "",
});

export default function UsersPage() {
  const { state, addUser, updateUser, freezeUser } = useStore();
  const { currentUser } = useAuth();
  const { users } = state;
  const isAdmin = currentUser?.role === "admin";
  const router = useRouter();

  // Non-admin redirect
  useEffect(() => {
    if (currentUser && !isAdmin) {
      router.replace("/dashboard");
    }
  }, [currentUser, isAdmin, router]);

  if (!isAdmin) return null;

  const { visible: visibleUsers, hasMore, loadMore, showing, total } = usePagination(users);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<AppUser | null>(null);
  const [form, setForm] = useState<Omit<AppUser, "id" | "createdAt" | "isFrozen">>(emptyUser());
  const [showPassword, setShowPassword] = useState(false);

  const openAdd = () => {
    setForm(emptyUser());
    setEditing(null);
    setShowPassword(false);
    setShowForm(true);
  };

  const openEdit = (u: AppUser) => {
    setForm({ firstName: u.firstName, lastName: u.lastName, email: u.email, phone: u.phone, role: u.role, password: u.password });
    setEditing(u);
    setShowPassword(false);
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) {
      updateUser({ ...editing, ...form });
    } else {
      addUser({ ...form, id: generateId(), createdAt: new Date().toISOString(), isFrozen: false });
    }
    setShowForm(false);
  };

  const handleFreeze = (u: AppUser) => {
    if (u.id === currentUser?.id) return; // can't freeze yourself
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
          isAdmin ? (
            <button
              className="btn-primary"
              onClick={openAdd}
              style={{ display: "flex", alignItems: "center", gap: 6 }}
            >
              <Plus size={15} />
              הוסף משתמש
            </button>
          ) : undefined
        }
      />

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 24 }}>
        {(Object.entries(ROLE_LABELS) as [UserRole, string][]).map(([role, label]) => {
          const count = users.filter((u) => u.role === role).length;
          return (
            <div key={role} className="card" style={{ padding: "16px 18px", display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: "var(--gray-text)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: "var(--dark-navy)", marginTop: 2 }}>{count}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Table */}
      <div className="card" style={{ overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr className="table-header">
              <th style={thStyle}>משתמש</th>
              <th style={thStyle}>פרטי קשר</th>
              <th style={thStyle}>תפקיד</th>
              <th style={thStyle}>סטטוס</th>
              {isAdmin && <th style={{ ...thStyle, width: 100 }}>פעולות</th>}
            </tr>
          </thead>
          <tbody>
            {visibleUsers.map((u) => (
              <tr key={u.id} className="table-row" style={{ opacity: u.isFrozen ? 0.55 : 1 }}>
                <td style={tdStyle}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: "50%",
                        background: u.isFrozen ? "#e2e8f0" : "linear-gradient(135deg, #209dd7, #753991)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        color: "#fff",
                        fontWeight: 700,
                        fontSize: 13,
                      }}
                    >
                      {u.firstName[0]}{u.lastName[0]}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14, color: "var(--dark-navy)" }}>
                        {u.firstName} {u.lastName}
                        {u.id === currentUser?.id && (
                          <span style={{ marginRight: 6, fontSize: 11, color: "var(--blue-primary)", fontWeight: 400 }}>(אתה)</span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--gray-text)", direction: "ltr", textAlign: "right" }}>
                        {new Date(u.createdAt).toLocaleDateString("he-IL")}
                      </div>
                    </div>
                  </div>
                </td>
                <td style={tdStyle}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, color: "#475569" }}>
                      <Mail size={11} color="var(--gray-text)" />
                      <span dir="ltr">{u.email}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, color: "#475569" }}>
                      <Phone size={11} color="var(--gray-text)" />
                      <span dir="ltr">{u.phone}</span>
                    </div>
                  </div>
                </td>
                <td style={tdStyle}>
                  <span className={`badge ${ROLE_BADGE[u.role]}`}>{ROLE_LABELS[u.role]}</span>
                </td>
                <td style={tdStyle}>
                  {u.isFrozen ? (
                    <span className="badge badge-gray" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <Snowflake size={11} />
                      מוקפא
                    </span>
                  ) : (
                    <span className="badge badge-green" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#16a34a" }} />
                      פעיל
                    </span>
                  )}
                </td>
                {isAdmin && (
                  <td style={{ ...tdStyle, textAlign: "center" }}>
                    <button
                      className="btn-icon"
                      onClick={() => openEdit(u)}
                      title="עריכה"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      className="btn-icon"
                      onClick={() => handleFreeze(u)}
                      title={u.isFrozen ? "בטל הקפאה" : "הקפא משתמש"}
                      disabled={u.id === currentUser?.id}
                      style={{
                        color: u.isFrozen ? "#16a34a" : "#3b82f6",
                        opacity: u.id === currentUser?.id ? 0.3 : 1,
                        cursor: u.id === currentUser?.id ? "not-allowed" : "pointer",
                      }}
                    >
                      {u.isFrozen ? <PlayCircle size={14} /> : <Snowflake size={14} />}
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 && (
          <div style={{ padding: 48, textAlign: "center", color: "var(--gray-text)" }}>
            אין משתמשים במערכת.
          </div>
        )}
        {users.length > 0 && <ScrollSentinel onIntersect={loadMore} />}
        <PaginationFooter showing={showing} total={total} hasMore={hasMore} entityLabel="משתמשים" />
      </div>

      {/* No-delete notice */}
      {isAdmin && (
        <div style={{ marginTop: 16, padding: "10px 16px", background: "#fffbf0", border: "1px solid #fde68a", borderRadius: 10, fontSize: 12, color: "#92610a", display: "flex", alignItems: "center", gap: 8 }}>
          <Snowflake size={13} color="#d97706" />
          מחיקת משתמשים אינה אפשרית — ניתן להקפיא משתמש כדי למנוע גישה למערכת.
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(32,157,215,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Users size={17} color="var(--blue-primary)" />
              </div>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "var(--dark-navy)" }}>
                {editing ? "עריכת משתמש" : "הוספת משתמש"}
              </h2>
            </div>

            <form onSubmit={handleSubmit}>
              {/* Name */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
                <div>
                  <label className="label">שם פרטי</label>
                  <input className="input" required value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
                </div>
                <div>
                  <label className="label">שם משפחה</label>
                  <input className="input" required value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
                </div>
              </div>

              {/* Email + Phone */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
                <div>
                  <label className="label">אימייל</label>
                  <input className="input" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} dir="ltr" style={{ textAlign: "left" }} />
                </div>
                <div>
                  <label className="label">טלפון</label>
                  <input className="input" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} dir="ltr" style={{ textAlign: "right" }} />
                </div>
              </div>

              {/* Role */}
              <div style={{ marginBottom: 14 }}>
                <label className="label">תפקיד</label>
                <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}>
                  {(Object.entries(ROLE_LABELS) as [UserRole, string][]).map(([r, l]) => (
                    <option key={r} value={r}>{l}</option>
                  ))}
                </select>
              </div>

              {/* Password */}
              <div style={{ marginBottom: 24 }}>
                <label className="label">{editing ? "סיסמה (השאר ריק לאי שינוי)" : "סיסמה"}</label>
                <div style={{ position: "relative" }}>
                  <input
                    className="input"
                    type={showPassword ? "text" : "password"}
                    required={!editing}
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder={editing ? "••••••••" : "לפחות 6 תווים"}
                    style={{ paddingLeft: 38 }}
                  />
                  <button type="button" onClick={() => setShowPassword((v) => !v)}
                    style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: 4, display: "flex" }}>
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>ביטול</button>
                <button type="submit" className="btn-primary">{editing ? "שמור שינויים" : "הוסף משתמש"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const thStyle: React.CSSProperties = { padding: "12px 16px", textAlign: "right", fontSize: 12, fontWeight: 600, color: "var(--gray-text)", textTransform: "uppercase", letterSpacing: "0.05em" };
const tdStyle: React.CSSProperties = { padding: "14px 16px", verticalAlign: "middle" };
