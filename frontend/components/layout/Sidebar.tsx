"use client";

import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import {
  LayoutDashboard,
  Users,
  UsersRound,
  UserCheck,
  Shield,
  Search,
  Tag,
  PhoneCall,
  MessageSquareMore,
  UserCog,
  LogOut,
  Snowflake,
} from "lucide-react";

const ROLE_LABELS: Record<string, string> = {
  admin: "מנהל מערכת",
  field: "שטח",
  telemarketing: "טלמרקטינג",
  group_leader: "ראש קבוצה",
  division_head: "ראש אגף",
};

const commonLinks = [
  { href: "/dashboard", label: "לוח בקרה", icon: LayoutDashboard },
  { href: "/telemarketing", label: "טלמרקטינג", icon: PhoneCall },
  { href: "/voters", label: "בוחרים", icon: Users },
  { href: "/groups", label: "קבוצות", icon: UsersRound },
  { href: "/group-leaders", label: "ראשי קבוצה", icon: UserCheck },
  { href: "/division-heads", label: "ראשי אגף", icon: Shield },
  { href: "/search", label: "חיפוש", icon: Search },
  { href: "/statuses", label: "סטטוסי תמיכה", icon: Tag },
  { href: "/call-statuses", label: "סטטוסי שיחה", icon: MessageSquareMore },
];

const adminLinks = [
  { href: "/users", label: "משתמשים", icon: UserCog },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { currentUser, logout } = useAuth();
  const links = currentUser?.role === "admin"
    ? [...commonLinks, ...adminLinks]
    : commonLinks;

  const handleLogout = () => {
    logout();
    router.replace("/login");
  };

  return (
    <aside className="sidebar" style={{ display: "flex", flexDirection: "column" }}>
      {/* Logo area */}
      <div style={{ padding: "24px 20px 20px", borderBottom: "1px solid rgba(255,255,255,0.08)", marginBottom: "8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg,#209dd7,#753991)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Shield size={18} color="#fff" />
          </div>
          <div>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: 15, lineHeight: 1.2 }}>מערכת ניהול</div>
            <div style={{ color: "#64748b", fontSize: 11 }}>בחירות MVP</div>
          </div>
        </div>
      </div>

      {/* Nav links */}
      <nav style={{ flex: 1, paddingTop: 4, overflowY: "auto" }}>
        {links.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <button
              key={href}
              className={`sidebar-link${active ? " active" : ""}`}
              onClick={() => router.push(href)}
            >
              <Icon size={17} />
              <span>{label}</span>
            </button>
          );
        })}
      </nav>

      {/* Current user + logout */}
      {currentUser && (
        <div
          style={{
            borderTop: "1px solid rgba(255,255,255,0.08)",
            padding: "14px 16px",
          }}
        >
          {/* User info */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: "50%",
                background: currentUser.isFrozen
                  ? "#334155"
                  : "linear-gradient(135deg, #209dd7, #753991)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                color: "#fff",
                fontWeight: 700,
                fontSize: 12,
              }}
            >
              {currentUser.firstName[0]}{currentUser.lastName[0]}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  color: "#e2e8f0",
                  fontWeight: 600,
                  fontSize: 13,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {currentUser.firstName} {currentUser.lastName}
              </div>
              <div
                style={{
                  color: "#64748b",
                  fontSize: 11,
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                {currentUser.isFrozen && <Snowflake size={10} color="#64748b" />}
                {ROLE_LABELS[currentUser.role] ?? currentUser.role}
              </div>
            </div>
          </div>

          {/* Logout */}
          <button
            onClick={handleLogout}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 10px",
              background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.18)",
              borderRadius: 8,
              color: "#f87171",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              transition: "background 0.15s",
            }}
          >
            <LogOut size={14} />
            יציאה מהמערכת
          </button>
        </div>
      )}
    </aside>
  );
}
