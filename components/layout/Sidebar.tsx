'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  SquaresFour, 
  Camera, 
  ChatCircleText, 
  Files, 
  CaretLeft, 
  CaretRight, 
  Cpu
} from '@phosphor-icons/react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: SquaresFour },
  { href: '/scan', label: 'Scan Document', icon: Camera },
  { href: '/chat', label: 'Ask 2ASK', icon: ChatCircleText },
  { href: '/tax-passport', label: 'Tax Passport', icon: Files },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className="fixed left-0 top-0 h-full z-40 flex flex-col transition-all duration-500 bg-white border-r border-slate-100 shadow-[20px_0_40px_-20px_rgba(0,0,0,0.03)]"
      style={{
        width: collapsed ? 80 : 280,
      }}
    >
      {/* Logo Section */}
      <div className="flex items-center h-20 px-6 gap-3 pt-4">
        <div
          className="w-10 h-10 rounded-2xl flex items-center justify-center text-white font-bold text-lg shrink-0 shadow-lg shadow-blue-200"
          style={{ background: 'linear-gradient(135deg, #3B82F6, #2563EB)' }}
        >
          2A
        </div>
        <AnimatePresence mode="wait">
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="flex flex-col"
            >
              <span className="font-bold text-xl tracking-tighter text-slate-900">2ASK</span>
              <span className="text-[10px] uppercase tracking-[0.2em] text-blue-600 font-semibold leading-none">Intelligence</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-10 px-4 space-y-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="relative flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-300 group overflow-hidden"
              style={{
                color: isActive ? '#1D4ED8' : '#64748B',
              }}
            >
              {isActive && (
                <motion.div
                  layoutId="active-pill"
                  className="absolute inset-0 bg-blue-50 border border-blue-100/50 rounded-2xl z-0"
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
              
              <Icon 
                weight={isActive ? "fill" : "light"} 
                size={22} 
                className={`relative z-10 transition-transform duration-300 ${isActive ? 'scale-110 text-blue-600' : 'group-hover:scale-110 group-hover:text-slate-900'}`} 
              />
              
              <AnimatePresence mode="wait">
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, transition: { duration: 0.1 } }}
                    className="relative z-10 text-sm font-semibold tracking-tight whitespace-nowrap"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
            </Link>
          );
        })}
      </nav>

      {/* AI Status Card */}
      <div className="p-6">
        <div className={`bg-slate-50 border border-slate-100 rounded-3xl p-4 transition-all duration-500 ${collapsed ? 'px-2 items-center' : ''}`}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-white shadow-sm border border-slate-200 flex items-center justify-center text-blue-600 shrink-0">
              <Cpu weight="duotone" size={20} />
            </div>
            {!collapsed && (
              <div className="flex flex-col">
                <span className="text-xs font-bold text-slate-900 tracking-tight">Gemma 2B</span>
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]" />
                  <span className="text-[10px] font-semibold text-emerald-600">Active</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Collapse Trigger */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-xl bg-white shadow-lg border border-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-900 hover:scale-110 transition-all z-50"
      >
        {collapsed ? <CaretRight weight="bold" size={14} /> : <CaretLeft weight="bold" size={14} />}
      </button>
    </aside>
  );
}
