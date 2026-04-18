'use client';

import { ArrowClockwise, UploadSimple } from '@phosphor-icons/react';
import { usePathname, useRouter } from 'next/navigation';

const pageMeta: Record<string, { title: string; subtitle: string }> = {
  dashboard: {
    title: 'Financial command surface',
    subtitle: 'A unified view of cash, invoices, deadlines, proof activity, and grounded AI.',
  },
  documents: {
    title: 'Document intake',
    subtitle: 'Upload source artifacts, parse them, and anchor them into the ledger.',
  },
  transactions: {
    title: 'Ledger visibility',
    subtitle: 'Inspect classified money movement and category pressure.',
  },
  invoices: {
    title: 'Invoice workspace',
    subtitle: 'Issue outgoing invoices and ingest incoming bills from one studio.',
  },
  planning: {
    title: 'Operations calendar',
    subtitle: 'Track tax rules, bill reminders, and invoice due dates in one place.',
  },
  'tax-passport': {
    title: 'Tax passport',
    subtitle: 'A tax-ready surface for deductions, GST/TDS posture, and review flags.',
  },
  chat: {
    title: 'Finance Copilot',
    subtitle: 'Grounded answers from your own invoices, documents, proofs, and transactions.',
  },
  audit: {
    title: 'Trust timeline',
    subtitle: 'Every material action stays visible and reviewable.',
  },
  verification: {
    title: 'Verification portal',
    subtitle: 'Recompute hashes, inspect anchors, and catch tampering fast.',
  },
  profile: {
    title: 'Workspace identity',
    subtitle: 'Define the operator, tax posture, and wallet behind the ledger.',
  },
};

export default function TopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const section = pathname.split('/')[1] || 'dashboard';
  const meta = pageMeta[section] ?? pageMeta.dashboard;

  return (
    <header className="sticky top-0 z-30 border-b border-[color:var(--border)] bg-[color:rgba(249,248,245,0.84)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1520px] items-center justify-between gap-4 px-5 py-5 md:px-8">
        <div className="min-w-0">
          <p className="eyebrow text-[color:var(--accent-gold)]">Unified Hackfest Workspace</p>
          <h1 className="mt-2 font-display text-[1.45rem] font-extrabold tracking-tight text-[color:var(--text-primary)]">
            {meta.title}
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-[color:var(--text-secondary)]">
            {meta.subtitle}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/documents')}
            className="hidden items-center gap-2 rounded-full border border-[color:var(--border)] bg-white px-4 py-3 text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--text-primary)] transition hover:border-[color:rgba(160,112,16,0.32)] md:inline-flex"
          >
            <UploadSimple size={14} />
            Import
          </button>
          <button
            onClick={() => router.refresh()}
            className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--surface-elevated)] px-4 py-3 text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--text-secondary)] transition hover:text-[color:var(--text-primary)]"
          >
            <ArrowClockwise size={14} />
            Refresh
          </button>
        </div>
      </div>
    </header>
  );
}
