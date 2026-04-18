'use client';

import { motion } from 'framer-motion';
import { Receipt, Coins, ShieldCheck, PiggyBank, ArrowRight } from '@phosphor-icons/react';
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
    { label: 'TDS Deducted', value: totals.tdsDeducted, icon: Receipt, color: '#2563EB' },
    { label: 'GST Accrued', value: totals.gstPaid, icon: Coins, color: '#F59E0B' },
    { label: 'Deductibles', value: totals.deductibleAmount, icon: ShieldCheck, color: '#10B981' },
    { label: 'Est. Savings', value: totals.estimatedSavings, icon: PiggyBank, color: '#7C3AED' },
  ];

  return (
    <div className="bento-card h-full flex flex-col">
      <div className="flex items-center justify-between mb-8 px-2">
        <div>
          <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-600 mb-1">
            Fiscal Overview
          </h3>
          <p className="text-2xl font-black tracking-tight text-slate-900">Tax Passport</p>
        </div>
        <button className="w-10 h-10 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center hover:bg-white hover:shadow-md transition-all">
          <ArrowRight weight="bold" size={16} className="text-slate-400" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 flex-1">
        {cards.map((card, i) => {
          const Icon = card.icon;
          return (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.6 + i * 0.1, ease: [0.16, 1, 0.3, 1] }}
              className="bg-white border border-slate-100 rounded-[1.5rem] p-5 flex flex-col justify-between group cursor-pointer hover:shadow-lg hover:shadow-slate-200/50 transition-all"
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center border border-slate-100 mb-3 group-hover:scale-110 transition-all"
                style={{ background: `${card.color}08`, color: card.color }}
              >
                <Icon weight="duotone" size={18} />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-1">
                  {card.label}
                </span>
                <span className="font-financial text-xl font-black tracking-tight text-slate-900">
                  <AnimatedCurrency value={card.value} />
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
