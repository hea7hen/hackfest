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
    <html lang="en" className="dark">
      <body className="bg-[#0A0F1E] text-[#F0F4FF] min-h-screen">
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
