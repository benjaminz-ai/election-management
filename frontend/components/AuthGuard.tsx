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

  if (isPublicPage) return <>{children}</>;
  if (loading) return <LoadingWrapper>{children}</LoadingWrapper>;
  if (!currentUser) return null;

  return (
    <LoadingWrapper>
      <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
        <Sidebar />
        <main
          id="main-scroll"
          style={{
            flex: 1,
            padding: "32px",
            overflowY: "auto",
            minWidth: 0,
            height: "100vh",
          }}
        >
          {children}
        </main>
      </div>
    </LoadingWrapper>
  );
}
