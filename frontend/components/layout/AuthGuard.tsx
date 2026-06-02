"use client";

import { useEffect, useState, ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { canAccess, homePath, MFA_ENFORCED, mfaRequiredForRole } from "@/lib/permissions";
import { auth } from "@/lib/firebase";
import { multiFactor } from "firebase/auth";
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

  // Role-based route guard: if a user reaches a screen their role may not
  // access (e.g. via a direct URL), send them to their home screen.
  useEffect(() => {
    if (!loading && currentUser && !isPublicPage && !canAccess(currentUser.role, pathname)) {
      router.replace(homePath(currentUser.role));
    }
  }, [loading, currentUser, isPublicPage, pathname, router]);

  // Two-factor enforcement: once turned on, users whose role requires MFA and
  // who have not enrolled a second factor are sent to the enrollment screen.
  useEffect(() => {
    if (!MFA_ENFORCED || loading || !currentUser || isPublicPage) return;
    if (pathname === "/enroll-mfa") return;
    if (!mfaRequiredForRole(currentUser.role)) return;
    const fbUser = auth.currentUser;
    if (fbUser && multiFactor(fbUser).enrolledFactors.length === 0) {
      router.replace("/enroll-mfa");
    }
  }, [loading, currentUser, isPublicPage, pathname, router]);

  if (isPublicPage) {
    return <>{children}</>;
  }

  if (loading) {
    return <LoadingWrapper>{children}</LoadingWrapper>;
  }

  if (!currentUser) {
    return null;
  }

  // The MFA enrollment screen is shown standalone (no sidebar/app chrome) —
  // the user hasn't fully entered the system yet.
  if (pathname === "/enroll-mfa") {
    return <>{children}</>;
  }

  // A user who must use two-factor but hasn't enrolled yet may NOT see the app
  // at all — render nothing while the effect above redirects them to /enroll-mfa.
  if (MFA_ENFORCED && mfaRequiredForRole(currentUser.role)) {
    const fbUser = auth.currentUser;
    if (fbUser && multiFactor(fbUser).enrolledFactors.length === 0) {
      return null;
    }
  }

  // Hard block: never render a screen the role may not access, even for a
  // single frame or via a direct URL. The effect above handles the redirect.
  if (!canAccess(currentUser.role, pathname)) {
    return null;
  }

  return (
    <LoadingWrapper>
      <div style={{ display: "flex", height: "100vh" }}>
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, height: "100%" }}>
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

          <main id="main-scroll" className="app-main" style={{ flex: 1, padding: "32px", overflowY: "auto", minHeight: 0 }}>
            {children}
          </main>
        </div>
      </div>
    </LoadingWrapper>
  );
}
