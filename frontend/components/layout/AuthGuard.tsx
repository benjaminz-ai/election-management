"use client";

import { useEffect, useState, ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
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
  useEffect(() => { setSidebarOpen(false); }, [pathname]);

  useEffect(() => {
    if (!loading && !currentUser && !isPublicPage) router.replace("/login");
  }, [loading, currentUser, isPublicPage, router]);

  if (isPublicPage) return <>{children}</>;
  if (loading) return <LoadingWrapper>{children}</LoadingWrapper>;
  if (!currentUser) return null;

  return (
    <LoadingWrapper>
      <div style={{ display: "flex", minHeight: "100vh" }}>
        {/* Sidebar (desktop always visible; mobile toggled) */}
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        {/* Right side: mobile header + content */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
          {/* Mobile-only top bar */}
          <header className="mobile-header">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg,#209dd7,#753991)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Shield size={14} color="#fff" />
              </div>
              <span className="mobile-header-title">מערכת ניהול בחירות</span>
            </div>
            <button
              className="hamburger-btn"
              onClick={() => setSidebarOpen(true)}
              aria-label="פתח תפריט"
            >
              <Menu size={22} />
            </button>
          </header>

          {/* Main content */}
          <main className="app-main" style={{ flex: 1, padding: "32px", overflowY: "auto", minWidth: 0 }}>
            {children}
          </main>
        </div>
      </div>
    </LoadingWrapper>
  );
}
