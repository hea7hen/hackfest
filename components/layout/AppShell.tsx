'use client';

import { useEffect, useState } from 'react';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import { db } from '@/lib/db/schema';
import { seedDatabase } from '@/lib/seed/transactions';
import { recomputeAllTaxSummaries } from '@/lib/db/tax-summary';
import { motion, AnimatePresence } from 'framer-motion';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    async function init() {
      const seeded = await seedDatabase(db);
      if (seeded) {
        await recomputeAllTaxSummaries();
      }
      // Artificial delay for cinematic effect
      setTimeout(() => setReady(true), 1500);
    }
    init();
  }, []);

  return (
    <div className="flex min-h-screen bg-background font-sans selection:bg-blue-100 selection:text-blue-900">
      <AnimatePresence mode="wait">
        {!ready ? (
          <motion.div 
            key="loader"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.95, filter: 'blur(40px)' }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-white"
          >
            <div className="flex flex-col items-center gap-12">
              <div className="relative">
                <motion.div
                  initial={{ rotate: 0 }}
                  animate={{ rotate: 360 }}
                  transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                  className="w-32 h-32 rounded-[2.5rem] border border-slate-100 bg-slate-50 shadow-sm"
                />
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute inset-0 flex items-center justify-center"
                >
                  <div className="text-3xl font-black tracking-tighter text-blue-600">2A</div>
                </motion.div>
              </div>
              
              <div className="flex flex-col items-center gap-4">
                <div className="h-[2px] w-48 bg-slate-100 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ x: "-100%" }}
                    animate={{ x: "0%" }}
                    transition={{ duration: 1.5, ease: "easeInOut" }}
                    className="h-full w-full bg-blue-600"
                  />
                </div>
                <motion.p 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="text-[10px] uppercase tracking-[0.4em] text-slate-400 font-bold"
                >
                  Initializing Core
                </motion.p>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="content"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-1"
          >
            <Sidebar />
            <div className="flex-1 transition-all duration-500 ml-[80px] lg:ml-[280px] bg-slate-50/30">
              <TopBar />
              <main className="p-10 max-w-[1600px] mx-auto min-h-[calc(100vh-80px)]">
                {children}
              </main>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
