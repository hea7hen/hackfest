'use client';

import { useEffect, useState } from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';
import type { HealthScore } from '@/lib/types';

interface Props {
  healthScore: HealthScore;
}

function AnimatedNumber({ value }: { value: number }) {
  const spring = useSpring(0, { stiffness: 50, damping: 20 });
  const display = useTransform(spring, (v) => Math.round(v));
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    spring.set(value);
    const unsub = display.on('change', (v) => setCurrent(v));
    return unsub;
  }, [value, spring, display]);

  return <>{current}</>;
}

export default function HealthScoreRing({ healthScore }: Props) {
  const { score, label, color } = healthScore;
  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;

  return (
    <div className="bento-card h-full flex flex-col items-center justify-center group overflow-hidden relative">
      {/* Soft Ambient Glow */}
      <div className="absolute top-0 right-0 p-8 opacity-40 group-hover:opacity-60 transition-opacity">
        <div className="w-32 h-32 rounded-full border-[10px] border-blue-100 blur-2xl" />
      </div>

      <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] mb-8 text-blue-600 px-4 py-1.5 bg-blue-50 rounded-full border border-blue-100/50">
        Wallet Health
      </h3>

      <div className="relative w-[220px] h-[220px]">
        {/* Decorative Background Ring */}
        <div className="absolute inset-0 rounded-full border border-slate-100 scale-[1.1]" />
        
        <svg width="220" height="220" viewBox="0 0 220 220" className="transform -rotate-90">
          <defs>
            <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#2563EB" />
              <stop offset="100%" stopColor="#3B82F6" />
            </linearGradient>
          </defs>
          {/* Background track */}
          <circle
            cx="110"
            cy="110"
            r={radius}
            fill="none"
            stroke="#F8FAFC"
            strokeWidth="14"
          />
          {/* Progress arc */}
          <motion.circle
            cx="110"
            cy="110"
            r={radius}
            fill="none"
            stroke="url(#scoreGradient)"
            strokeWidth="14"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: circumference - progress }}
            transition={{ duration: 2, ease: [0.16, 1, 0.3, 1], delay: 0.5 }}
            className="drop-shadow-[0_0_8px_rgba(37,99,235,0.2)]"
          />
        </svg>

        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-financial text-6xl font-black tracking-tighter text-slate-900">
            <AnimatedNumber value={score} />
          </span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">
            Index
          </span>
        </div>
      </div>

      <div className="mt-8 px-6 py-2 rounded-2xl bg-slate-50 border border-slate-100 flex items-center gap-2">
        <div
          className="w-2 h-2 rounded-full shadow-[0_0_4px_rgba(0,0,0,0.1)]"
          style={{ background: color }}
        />
        <span className="text-sm font-bold tracking-tight text-slate-900">
          {label}
        </span>
      </div>
    </div>
  );
}
