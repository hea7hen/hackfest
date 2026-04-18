import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import AppShell from "@/components/layout/AppShell";
import GoogleAuthProvider from "@/components/GoogleAuthProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "2ASK \u2014 AI Finance Agent",
  description: "AI-powered personal finance agent for India. On-device intelligence, multilingual voice, zero cloud storage.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans bg-background text-foreground min-h-screen relative overflow-x-hidden content-stable selection:bg-blue-100 selection:text-blue-900`}>
        {/* Soft Structuralism Ambient Accents */}
        <div className="fixed inset-0 z-[-1] overflow-hidden pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-500/5 blur-[120px]" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-emerald-500/5 blur-[120px]" />
        </div>
        
        <GoogleAuthProvider>
          <AppShell>
            {children}
          </AppShell>
        </GoogleAuthProvider>
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: '#FFFFFF',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(0,0,0,0.05)',
              color: '#0F172A',
              borderRadius: '1rem',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            },
          }}
        />
      </body>
    </html>
  );
}
