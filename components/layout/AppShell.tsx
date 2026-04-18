'use client';

import { motion } from 'framer-motion';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Sidebar />
      <div className="min-h-screen pl-[84px] lg:pl-[292px]">
        <TopBar />
        <motion.main
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="mx-auto min-h-[calc(100vh-96px)] w-full max-w-[1520px] px-5 pb-10 pt-6 md:px-8"
        >
          {children}
        </motion.main>
      </div>
    </div>
  );
}
