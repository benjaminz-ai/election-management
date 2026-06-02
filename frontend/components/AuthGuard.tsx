"use client";

import { useEffect, useState, ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { canAccess, homePath } from "@/lib/permissions";
import Sidebar from "@/components/layout/Sidebar";
import LoadingWrapper from "@/components/layout/LoadingWrapper";
import { Menu, Shield } from "lucide-react";

const PUBLIC_PATHS = ["/login", "/forgot-password", "/reset-password"];

export default function AuthGuard({ children }: { children: ReactNode }) {
  const { currentUser } = useAuth();
  const { loading } = useStore();
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isPublicPage = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "?"));

  // Close sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!loading && !currentUser && !isPublicPage) {
      router.replace("/login");
    }
  }, [loading, currentUser, isPublicPage, router]);

  // Role-based route guard: if a user reaches a screen their role may not
  // access (e.g. via a direct URL), send them to their home screen.
  useEffect(() => {
    if (!loading && currentUser && !isPublicPage && !canAccess(currentUser.role, pathname)) {
      router.replace(homePath(currentUser.role));
    }
  }, [loading, currentUser, isPublicPage, pathname, router]);

  if (isPublicPage) return <>{children}</>;
  if (loading) return <LoadingWrapper>{children}</LoadingWrapper>;
  if (!currentUser) return null;

  // Hard block: never render a screen the role may not access, even for a
  // single frame or via a direct URL. The effect above handles the redirect.
  if (!canAccess(currentUser.role, pathname)) return null;

  return (
    <LoadingWrapper>
      <div style={{ display: "flex", height: "100vh" }}>
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, height: "100vh", overflow: "hidden" }}>
          {/* Mobile top bar — hidden on desktop via CSS */}
          <header className="mobile-header">
            <button
              className="hamburger-btn"
              onClick={() => setSidebarOpen(true)}
              aria-label="פתח תפריט"
            >
              <Menu size={22} color="#032147" />
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg,#209dd7,#753991)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Shield size={14} color="#fff" />
              </div>
              <span style={{ fontWeight: 700, fontSize: 15, color: "#032147" }}>מערכת ניהול</span>
            </div>
            {/* user avatar */}
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg,#209dd7,#753991)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 12, flexShrink: 0 }}>
              {currentUser.firstName[0]}{currentUser.lastName[0]}
            </div>
          </header>

          <main
            id="main-scroll"
            className="app-main"
            style={{ flex: 1, padding: "32px", overflowY: "auto", minWidth: 0 }}
          >
            {children}
          </main>
        </div>
      </div>
    </LoadingWrapper>
  );
}
