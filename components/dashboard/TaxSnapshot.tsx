'use client';

import { motion } from 'framer-motion';
import { Receipt, IndianRupee, FileCheck, PiggyBank } from 'lucide-react';
import type { TaxSummary } from '@/lib/types';
import { useEffect, useState } from 'react';
import { useSpring, useTransform } from 'framer-motion';

function AnimatedCurrency({ value }: { value: number }) {
  const spring = useSpring(0, { stiffness: 40, damping: 20 });
  const display = useTransform(spring, (v) => Math.round(v).toLocaleString('en-IN'));
  const [current, setCurrent] = useState('0');

  useEffect(() => {
    spring.set(value);
    const unsub = display.on('change', (v) => setCurrent(v));
    return unsub;
  }, [value, spring, display]);

  return <>{'\u20B9'}{current}</>;
}

interface Props {
  summaries: TaxSummary[];
}

export default function TaxSnapshot({ summaries }: Props) {
  const totals = summaries.reduce(
    (acc, s) => ({
      tdsDeducted: acc.tdsDeducted + s.tdsDeducted,
      gstPaid: acc.gstPaid + s.gstPaid,
      deductibleAmount: acc.deductibleAmount + s.deductibleAmount,
      estimatedSavings: acc.estimatedSavings + (s.deductibleAmount * 0.3),
    }),
    { tdsDeducted: 0, gstPaid: 0, deductibleAmount: 0, estimatedSavings: 0 }
  );

  const cards = [
    { label: 'TDS Deducted', value: totals.tdsDeducted, icon: Receipt, color: '#3B82F6' },
    { label: 'GST Paid', value: totals.gstPaid, icon: IndianRupee, color: '#F59E0B' },
    { label: 'Deductibles', value: totals.deductibleAmount, icon: FileCheck, color: '#10B981' },
    { label: 'Est. Savings', value: totals.estimatedSavings, icon: PiggyBank, color: '#8B5CF6' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.35 }}
      className="rounded-2xl p-6"
      style={{
        background: '#131929',
        border: '1px solid rgba(255,255,255,0.06)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
      }}
    >
      <h3 className="text-sm font-medium mb-4" style={{ color: '#8899AA' }}>
        Tax Snapshot
      </h3>

      <div className="grid grid-cols-2 gap-3">
        {cards.map((card, i) => {
          const Icon = card.icon;
          return (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: 0.4 + i * 0.05 }}
              className="rounded-xl p-4"
              style={{
                background: '#0A0F1E',
                border: '1px solid rgba(255,255,255,0.04)',
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="w-6 h-6 rounded-md flex items-center justify-center"
                  style={{ background: `${card.color}15` }}
                >
                  <Icon size={12} style={{ color: card.color }} />
                </div>
                <span className="text-[11px]" style={{ color: '#8899AA' }}>
                  {card.label}
                </span>
              </div>
              <span className="font-financial text-lg" style={{ color: '#F0F4FF' }}>
                <AnimatedCurrency value={card.value} />
              </span>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
