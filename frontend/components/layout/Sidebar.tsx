"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import {
  LayoutDashboard, Users, UsersRound, UserCheck, Shield, Search, Tag,
  PhoneCall, MessageSquareMore, UserCog, LogOut, Snowflake, BarChart3,
  X, ChevronRight, ChevronLeft,
} from "lucide-react";

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
  { href: "/search",        label: "חיפוש",           icon: Search },
  { href: "/statuses",      label: "סטטוסי תמיכה",   icon: Tag },
  { href: "/call-statuses", label: "סטטוסי שיחה",    icon: MessageSquareMore },
];
const adminLinks = [{ href: "/users", label: "משתמשים", icon: UserCog }];

export default function Sidebar({ isOpen = true, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router   = useRouter();
  const { currentUser, logout } = useAuth();

  // Desktop collapse state — persisted in localStorage
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("sidebar_collapsed") === "true";
  });

  useEffect(() => {
    localStorage.setItem("sidebar_collapsed", String(collapsed));
  }, [collapsed]);

  const links = currentUser?.role === "admin"
    ? [...commonLinks, ...adminLinks]
    : commonLinks;

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

        {/* Nav */}
        <nav style={{ flex: 1, paddingTop: 6, overflowY: "auto", overflowX: "hidden" }}>
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
