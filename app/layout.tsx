import type { Metadata } from "next";
import "./globals.css";
import { StoreProvider } from "@/lib/store";
import { AuthProvider } from "@/lib/auth";
import AuthGuard from "@/components/layout/AuthGuard";

export const metadata: Metadata = {
  title: "מערכת ניהול בחירות",
  description: "Election Management System MVP",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <body>
        <StoreProvider>
          <AuthProvider>
            <AuthGuard>{children}</AuthGuard>
          </AuthProvider>
        </StoreProvider>
      </body>
    </html>
  );
}
