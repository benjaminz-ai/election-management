"use client";

import { useEffect, ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import Sidebar from "@/components/layout/Sidebar";
import LoadingWrapper from "@/components/layout/LoadingWrapper";

const PUBLIC_PATHS = ["/login", "/forgot-password", "/reset-password"];

export default function AuthGuard({ children }: { children: ReactNode }) {
  const { currentUser } = useAuth();
  const { loading } = useStore();
  const pathname = usePathname();
  const router = useRouter();

  const isPublicPage = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "?"));

  useEffect(() => {
    if (!loading && !currentUser && !isPublicPage) {
      router.replace("/login");
    }
  }, [loading, currentUser, isPublicPage, router]);

  // Public pages: render full-screen without sidebar
  if (isPublicPage) {
    return <>{children}</>;
  }

  // Loading: show spinner (no sidebar yet)
  if (loading) {
    return <LoadingWrapper>{children}</LoadingWrapper>;
  }

  // Not authenticated: render nothing while redirect fires
  if (!currentUser) {
    return null;
  }

  // Authenticated: full app shell with sidebar
  return (
    <LoadingWrapper>
      <div style={{ display: "flex", minHeight: "100vh" }}>
        <Sidebar />
        <main style={{ flex: 1, padding: "32px", overflowY: "auto", minWidth: 0 }}>
          {children}
        </main>
      </div>
    </LoadingWrapper>
  );
}
