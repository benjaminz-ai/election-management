"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import {
  LayoutDashboard, Users, UsersRound, UserCheck, Shield, Search, Tag,
  PhoneCall, MessageSquareMore, UserCog, LogOut, Snowflake, BarChart3,
  X, ChevronRight, ChevronLeft, Bell, Contact, Building2, Activity,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { isFieldRole, canAccess } from "@/lib/permissions";

interface SidebarProps {
  isOpen?: boolean;    // mobile: controls slide-in
  onClose?: () => void;
}

const ROLE_LABELS: Record<string, string> = {
  admin: "מנהל מערכת", field: "שטח", telemarketing: "טלמרקטינג",
  group_leader: "ראש קבוצה", division_head: "ראש אגף",
};

const commonLinks = [
  { href: "/dashboard",     label: "לוח בקרה",       icon: LayoutDashboard },
  { href: "/telemarketing", label: "טלמרקטינג",      icon: PhoneCall },
  { href: "/voters",        label: "בוחרים",          icon: Users },
  { href: "/groups",        label: "קבוצות",          icon: UsersRound },
  { href: "/group-leaders", label: "ראשי קבוצה",     icon: UserCheck },
  { href: "/division-heads",label: "ראשי אגף",       icon: Shield },
  { href: "/reports",       label: "דוחות",           icon: BarChart3 },
  { href: "/reminders",     label: "התזכורות שלי",    icon: Bell },
  { href: "/search",        label: "חיפוש",           icon: Search },
  { href: "/statuses",      label: "סטטוסי תמיכה",   icon: Tag },
  { href: "/call-statuses", label: "סטטוסי שיחה",    icon: MessageSquareMore },
];
const adminLinks = [
  { href: "/activity", label: "תפוקות", icon: Activity },
  { href: "/users", label: "משתמשים", icon: UserCog },
];
const fieldLink = { href: "/field", label: "האנשים שלי", icon: Contact };

export default function Sidebar({ isOpen = true, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router   = useRouter();
  const { currentUser, logout } = useAuth();
  const { state, tenantName, isSuperAdmin } = useStore();
  const reminderCount = state.reminders.filter((r) => r.userId === currentUser?.id && !r.done).length;

  // Desktop collapse state — persisted in localStorage
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("sidebar_collapsed") === "true";
  });

  useEffect(() => {
    localStorage.setItem("sidebar_collapsed", String(collapsed));
  }, [collapsed]);

  const role = currentUser?.role;
  const baseLinks = isFieldRole(role)
    // Field users: their "my people" home first, then only the screens they may reach.
    ? [fieldLink, ...commonLinks.filter((l) => canAccess(role, l.href))]
    : role === "admin"
      ? [...commonLinks, ...adminLinks]
      : commonLinks;
  // Super admin gets the company-management screen.
  const links = isSuperAdmin
    ? [...baseLinks, { href: "/companies", label: "ניהול חברות", icon: Building2 }]
    : baseLinks;

  const [isMobileView, setIsMobileView] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    setIsMobileView(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobileView(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const handleLogout = () => { logout(); router.replace("/login"); };
  const handleNav = (href: string) => { router.push(href); if (onClose) onClose(); };
  const isMobile = isMobileView;

  // On mobile never collapse
  const isCollapsed = !isMobile && collapsed;

  return (
    <>
      {/* Mobile overlay */}
      <button
        className={`sidebar-overlay${isOpen ? " sidebar-open" : ""}`}
        onClick={onClose}
        aria-label="סגור תפריט"
        style={{ border: "none", padding: 0, background: "none" }}
      />

      <aside
        className={[
          "sidebar",
          isOpen ? "sidebar-open" : "",
          isCollapsed ? "sidebar-collapsed" : "",
        ].filter(Boolean).join(" ")}
        style={{ display: "flex", flexDirection: "column" }}
      >
        {/* Header */}
        <div className="sidebar-header">
          {!isCollapsed && (
            <div style={{ display: "flex", alignItems: "center" }}>
              <img src="/logo-white.svg" alt="Voters4U" style={{ height: 36, width: "auto" }} />
            </div>
          )}

          {/* Mobile: X close button | Desktop: collapse toggle */}
          {isMobile ? (
            <button onClick={onClose} aria-label="סגור"
              style={{ background: "rgba(255,255,255,0.12)", border: "none", cursor: "pointer", color: "#fff", padding: 8, display: "flex", alignItems: "center", borderRadius: 8, minWidth: 38, minHeight: 38, justifyContent: "center", marginRight: isCollapsed ? "auto" : undefined }}>
              <X size={20} />
            </button>
          ) : (
            <button onClick={() => setCollapsed(c => !c)} aria-label={collapsed ? "פרוס תפריט" : "צמצם תפריט"}
              style={{ background: "rgba(255,255,255,0.08)", border: "none", cursor: "pointer", color: "#94a3b8", padding: 7, display: "flex", alignItems: "center", borderRadius: 8, minWidth: 34, minHeight: 34, justifyContent: "center", marginRight: isCollapsed ? "auto" : undefined, flexShrink: 0 }}>
              {collapsed ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
            </button>
          )}
        </div>

        {/* Active company banner */}
        {!isCollapsed && tenantName && (
          <div style={{ margin: "4px 12px 8px", padding: "8px 12px", borderRadius: 10, background: isSuperAdmin ? "rgba(117,57,145,0.18)" : "rgba(32,157,215,0.12)", border: `1px solid ${isSuperAdmin ? "rgba(117,57,145,0.4)" : "rgba(32,157,215,0.3)"}` }}>
            <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600 }}>{isSuperAdmin ? "חברה פעילה" : "חברה"}</div>
            <div style={{ fontSize: 13, color: "#fff", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{tenantName}</div>
          </div>
        )}

        {/* Nav */}
        <nav className="sidebar-nav" style={{ flex: 1, paddingTop: 6, overflowY: "auto", overflowX: "hidden" }}>
          {links.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <button key={href}
                className={`sidebar-link${active ? " active" : ""}${isCollapsed ? " sidebar-link-icon" : ""}`}
                onClick={() => handleNav(href)}
                title={isCollapsed ? label : undefined}
              >
                <Icon size={18} />
                {!isCollapsed && <span>{label}</span>}
                {href === "/reminders" && reminderCount > 0 && (
                  <span style={{ marginRight: isCollapsed ? 0 : "auto", position: isCollapsed ? "absolute" : "static", top: isCollapsed ? 6 : undefined, left: isCollapsed ? 6 : undefined, minWidth: 18, height: 18, padding: "0 5px", borderRadius: 9, background: "#ef4444", color: "#fff", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {reminderCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* User footer */}
        {currentUser && (
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", padding: isCollapsed ? "12px 8px" : "12px 14px" }}>
            {!isCollapsed && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: currentUser.isFrozen ? "#334155" : "linear-gradient(135deg,#209dd7,#753991)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "#fff", fontWeight: 700, fontSize: 11 }}>
                  {currentUser.firstName[0]}{currentUser.lastName[0]}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: "#e2e8f0", fontWeight: 600, fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {currentUser.firstName} {currentUser.lastName}
                  </div>
                  <div style={{ color: "#64748b", fontSize: 10, display: "flex", alignItems: "center", gap: 3 }}>
                    {currentUser.isFrozen && <Snowflake size={9} color="#64748b" />}
                    {ROLE_LABELS[currentUser.role] ?? currentUser.role}
                  </div>
                </div>
              </div>
            )}
            <button onClick={handleLogout} title={isCollapsed ? "יציאה" : undefined}
              style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: isCollapsed ? "center" : "flex-start", gap: 8, padding: isCollapsed ? "8px" : "7px 10px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.18)", borderRadius: 8, color: "#f87171", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              <LogOut size={15} />
              {!isCollapsed && <span>יציאה מהמערכת</span>}
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
