'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Calendar,
  CaretLeft,
  CaretRight,
  ChatCircleText,
  Fingerprint,
  Files,
  IdentificationCard,
  Money,
  Receipt,
  ShieldCheck,
  SquaresFour,
  TrayArrowUp,
} from '@phosphor-icons/react';
import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: SquaresFour },
  { href: '/documents', label: 'Documents', icon: TrayArrowUp },
  { href: '/transactions', label: 'Transactions', icon: Money },
  { href: '/invoices', label: 'Invoices', icon: Receipt },
  { href: '/planning', label: 'Ops Calendar', icon: Calendar },
  { href: '/tax-passport', label: 'Tax Passport', icon: Files },
  { href: '/chat', label: 'Finance Copilot', icon: ChatCircleText },
  { href: '/audit', label: 'Audit Trail', icon: ShieldCheck },
  { href: '/verification', label: 'Verification', icon: Fingerprint },
  { href: '/profile', label: 'Workspace', icon: IdentificationCard },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className="fixed left-0 top-0 z-40 h-full border-r border-[color:var(--border)] bg-[color:var(--sidebar)] backdrop-blur-xl"
      style={{ width: collapsed ? 84 : 292 }}
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-3 px-5 py-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-[1.35rem] border border-[color:var(--border)] bg-[color:var(--surface-strong)] text-[color:var(--text-inverse)] shadow-[0_18px_40px_-24px_rgba(26,24,20,0.45)]">
            <span className="font-display text-lg font-extrabold">2A</span>
          </div>
          <AnimatePresence mode="wait">
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                className="min-w-0"
              >
                <p className="font-display text-[1.05rem] font-extrabold tracking-tight text-[color:var(--text-primary)]">
                  2ASK Ledger
                </p>
                <p className="font-financial text-[0.62rem] uppercase tracking-[0.28em] text-[color:var(--accent-gold)]">
                  Finance Workspace
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <nav className="flex-1 space-y-1 px-4 py-4">
          {navItems.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="group relative flex items-center gap-3 overflow-hidden rounded-[1.4rem] px-4 py-3 text-sm font-semibold tracking-tight text-[color:var(--text-secondary)] transition-colors"
              >
                {active && (
                  <motion.span
                    layoutId="workspace-sidebar-active"
                    className="absolute inset-0 rounded-[1.4rem] border border-[color:rgba(160,112,16,0.16)] bg-[color:rgba(160,112,16,0.09)]"
                    transition={{ type: 'spring', stiffness: 360, damping: 32 }}
                  />
                )}
                <Icon
                  size={20}
                  weight={active ? 'fill' : 'regular'}
                  className={`relative z-10 shrink-0 ${active ? 'text-[color:var(--accent-gold)]' : 'text-[color:var(--text-secondary)] group-hover:text-[color:var(--text-primary)]'}`}
                />
                <AnimatePresence mode="wait">
                  {!collapsed && (
                    <motion.span
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -8 }}
                      className={`relative z-10 whitespace-nowrap ${active ? 'text-[color:var(--text-primary)]' : ''}`}
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </Link>
            );
          })}
        </nav>

        <div className="px-4 pb-6">
          <div className="rounded-[1.6rem] border border-[color:var(--border)] bg-[color:rgba(255,255,255,0.6)] p-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-elevated)]" />
              {!collapsed && (
                <div>
                  <p className="eyebrow text-[color:var(--accent-gold)]">Trust Layer</p>
                  <p className="mt-1 text-xs font-semibold text-[color:var(--text-primary)]">
                    Proofs, retrieval, and audit flows live here.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        <button
          onClick={() => setCollapsed((value) => !value)}
          className="absolute -right-4 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-xl border border-[color:var(--border)] bg-white text-[color:var(--text-secondary)] shadow-[0_18px_30px_-22px_rgba(26,24,20,0.45)] transition hover:text-[color:var(--text-primary)]"
        >
          {collapsed ? <CaretRight size={14} weight="bold" /> : <CaretLeft size={14} weight="bold" />}
        </button>
      </div>
    </aside>
  );
}
