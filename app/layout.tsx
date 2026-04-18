import type { Metadata } from "next";
import { DM_Mono, Instrument_Serif, Syne } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import AppShell from "@/components/layout/AppShell";
import GoogleAuthProvider from "@/components/GoogleAuthProvider";

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-syne",
  weight: ["400", "500", "600", "700", "800"],
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  variable: "--font-dm-mono",
  weight: ["300", "400", "500"],
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  variable: "--font-instrument-serif",
  weight: ["400"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "2ASK Ledger",
  description:
    "Unified finance workspace for invoices, tax passport, audit proofs, and grounded finance copilot workflows.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${syne.variable} ${dmMono.variable} ${instrumentSerif.variable} min-h-screen bg-background text-foreground antialiased`}
      >
        <GoogleAuthProvider>
          <AppShell>{children}</AppShell>
        </GoogleAuthProvider>
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: "#fffdf8",
              border: "1px solid rgba(26, 24, 20, 0.08)",
              color: "#1a1814",
              borderRadius: "1rem",
              boxShadow: "0 20px 40px -24px rgba(26, 24, 20, 0.25)",
            },
          }}
        />
      </body>
    </html>
  );
}
