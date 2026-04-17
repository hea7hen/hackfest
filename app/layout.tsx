import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import AppShell from "@/components/layout/AppShell";
import GoogleAuthProvider from "@/components/GoogleAuthProvider";

export const metadata: Metadata = {
  title: "2ASK — AI Finance Agent",
  description: "AI-powered personal finance agent for India. On-device intelligence, multilingual voice, zero cloud storage.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full antialiased" style={{ background: '#0A0F1E', color: '#F0F4FF' }}>
        <GoogleAuthProvider>
          <AppShell>
            {children}
          </AppShell>
        </GoogleAuthProvider>
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: '#1E2A3A',
              border: '1px solid rgba(255,255,255,0.06)',
              color: '#F0F4FF',
            },
          }}
        />
      </body>
    </html>
  );
}
