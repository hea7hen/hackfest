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
    <div
      className="rounded-2xl p-6 flex flex-col items-center justify-center"
      style={{
        background: '#131929',
        border: '1px solid rgba(255,255,255,0.06)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
      }}
    >
      <h3 className="text-sm font-medium mb-4" style={{ color: '#8899AA' }}>
        Financial Health
      </h3>

      <div className="relative w-[200px] h-[200px]">
        <svg width="200" height="200" viewBox="0 0 200 200" className="transform -rotate-90">
          {/* Background track */}
          <circle
            cx="100"
            cy="100"
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.05)"
            strokeWidth="12"
          />
          {/* Progress arc */}
          <motion.circle
            cx="100"
            cy="100"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: circumference - progress }}
            transition={{ duration: 1.5, ease: 'easeOut', delay: 0.3 }}
            style={{ filter: `drop-shadow(0 0 8px ${color}40)` }}
          />
        </svg>

        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-financial text-4xl" style={{ color }}>
            <AnimatedNumber value={score} />
          </span>
          <span className="text-xs font-medium mt-1" style={{ color: '#8899AA' }}>
            out of 100
          </span>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <div
          className="w-2 h-2 rounded-full"
          style={{ background: color }}
        />
        <span className="text-sm font-medium" style={{ color }}>
          {label}
        </span>
      </div>
    </div>
  );
}
