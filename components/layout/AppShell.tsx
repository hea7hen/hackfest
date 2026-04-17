'use client';

import { useEffect, useState } from 'react';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import { db } from '@/lib/db/schema';
import { seedDatabase } from '@/lib/seed/transactions';
import { recomputeAllTaxSummaries } from '@/lib/db/tax-summary';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    async function init() {
      const seeded = await seedDatabase(db);
      if (seeded) {
        await recomputeAllTaxSummaries();
      }
      setReady(true);
    }
    init();
  }, []);

  if (!ready) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: '#0A0F1E' }}>
        <div className="flex flex-col items-center gap-4">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold"
            style={{ background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)' }}
          >
            2A
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
          <p className="text-sm" style={{ color: '#8899AA' }}>Loading 2ASK...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen" style={{ background: '#0A0F1E' }}>
      <Sidebar />
      <div className="flex-1 ml-[240px] transition-all duration-300">
        <TopBar />
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
