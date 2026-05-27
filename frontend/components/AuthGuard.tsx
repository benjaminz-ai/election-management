"use client";

import { useEffect, useState, ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import Sidebar from "@/components/layout/Sidebar";
import LoadingWrapper from "@/components/layout/LoadingWrapper";
import { Menu } from "lucide-react";

const PUBLIC_PATHS = ["/login", "/forgot-password", "/reset-password"];

export default function AuthGuard({ children }: { children: ReactNode }) {
  const { currentUser } = useAuth();
  const { loading } = useStore();
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isPublicPage = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "?"));

  useEffect(() => {
    if (!loading && !currentUser && !isPublicPage) {
      router.replace("/login");
    }
  }, [loading, currentUser, isPublicPage, router]);

  // Close sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  if (isPublicPage) {
    return <>{children}</>;
  }

  if (loading) {
    return <LoadingWrapper>{children}</LoadingWrapper>;
  }

  if (!currentUser) {
    return null;
  }

  return (
    <LoadingWrapper>
      <div style={{ display: "flex", minHeight: "100vh" }}>
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          {/* Mobile header */}
          <header className="mobile-header" style={{ alignItems: "center", padding: "0 16px", gap: 12 }}>
            <button
              className="hamburger-btn"
              onClick={() => setSidebarOpen(true)}
              aria-label="פתח תפריט"
            >
              <Menu size={24} />
            </button>
            <span style={{ color: "#fff", fontWeight: 700, fontSize: 16 }}>מערכת ניהול</span>
          </header>

          <main className="app-main" style={{ flex: 1, padding: "32px", overflowY: "auto" }}>
            {children}
          </main>
        </div>
      </div>
    </LoadingWrapper>
  );
}
