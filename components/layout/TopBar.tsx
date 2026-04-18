'use client';

import { GoogleLogo } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';

interface TopBarProps {
  modelLoading?: boolean;
  modelProgress?: number;
}

export default function TopBar({ modelLoading, modelProgress }: TopBarProps) {
  const router = useRouter();

  return (
    <header className="sticky top-0 z-30 h-20 flex items-center justify-between px-10 bg-white/80 backdrop-blur-md border-b border-slate-100">
      <div className="flex flex-col">
        <h1 className="text-xl font-bold tracking-tight text-slate-900 leading-none">
          Strategic Insights
        </h1>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest bg-blue-50 px-2 py-0.5 rounded-full">Personal Finance</span>
          <span className="w-1 h-1 rounded-full bg-slate-300" />
          <span className="text-[10px] font-mono text-slate-400 font-medium">L-OS v1.2.4</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          className="gap-2 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-100 transition-all font-bold text-slate-600 px-4"
          onClick={() => router.push('/dashboard#gmail-json-extractor')}
        >
          <GoogleLogo weight="bold" size={16} className="text-blue-600" />
          Import
        </Button>
        
        <div className="w-10 h-10 rounded-full border border-slate-200 bg-white shadow-sm flex items-center justify-center overflow-hidden p-0.5">
          <div className="w-full h-full rounded-full overflow-hidden bg-slate-100">
            <img 
              src={`https://api.dicebear.com/7.x/avataaars/svg?seed=Finance`} 
              alt="Avatar" 
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </div>

      {modelLoading && (
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-slate-100 overflow-hidden">
          <motion.div
            className="h-full bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.4)]"
            initial={{ width: 0 }}
            animate={{ width: `${modelProgress || 0}%` }}
            transition={{ type: "spring", stiffness: 50, damping: 20 }}
          />
        </div>
      )}
    </header>
  );
}
