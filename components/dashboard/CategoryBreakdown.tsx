'use client';

import { motion } from 'framer-motion';
import type { TransactionCategory } from '@/lib/types';
import {
  ForkKnife,
  Car,
  Lightning,
  House,
  Briefcase,
  Heart,
  FilmStrip,
  ShoppingBag,
  Bank,
  DotsThreeCircle,
} from '@phosphor-icons/react';

const categoryConfig: Record<TransactionCategory, { label: string; color: string; icon: any }> = {
  food: { label: 'Dining', color: '#F59E0B', icon: ForkKnife },
  transport: { label: 'Transit', color: '#8B5CF6', icon: Car },
  utilities: { label: 'Utilities', color: '#06B6D4', icon: Lightning },
  rent: { label: 'Housing', color: '#F43F5E', icon: House },
  salary: { label: 'Revenue', color: '#10B981', icon: Bank },
  business: { label: 'Capital', color: '#3B82F6', icon: Briefcase },
  medical: { label: 'Wellness', color: '#EC4899', icon: Heart },
  entertainment: { label: 'Culture', color: '#A855F7', icon: FilmStrip },
  tax: { label: 'Fiscal', color: '#EF4444', icon: Bank },
  shopping: { label: 'Retail', color: '#14B8A6', icon: ShoppingBag },
  other: { label: 'Misc', color: '#6B7280', icon: DotsThreeCircle },
};

interface Props {
  data: Record<string, number>;
}

export default function CategoryBreakdown({ data }: Props) {
  const sorted = Object.entries(data)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  const maxAmount = sorted.length > 0 ? sorted[0][1] : 1;

  return (
    <div className="bento-card flex flex-col h-full">
      <div className="mb-8 px-2">
        <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-600 mb-1">
          Sector Analysis
        </h3>
        <p className="text-2xl font-black tracking-tight text-slate-900">Allocations</p>
      </div>

      <div className="flex-1 space-y-6">
        {sorted.map(([category, amount], index) => {
          const config = categoryConfig[category as TransactionCategory] || categoryConfig.other;
          const Icon = config.icon;
          const percentage = (amount / maxAmount) * 100;

          return (
            <div key={category} className="group cursor-pointer">
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center border border-slate-100 transition-all group-hover:scale-110 group-hover:shadow-sm"
                    style={{ background: `${config.color}08`, color: config.color }}
                  >
                    <Icon weight="duotone" size={18} />
                  </div>
                  <span className="text-sm font-bold tracking-tight text-slate-900 group-hover:text-blue-600 transition-colors">
                    {config.label}
                  </span>
                </div>
                <span className="font-financial text-sm font-black text-slate-900">
                  {'\u20B9'}{amount.toLocaleString('en-IN')}
                </span>
              </div>

              <div className="h-1.5 rounded-full overflow-hidden bg-slate-100 relative mx-1">
                <motion.div
                  className="h-full rounded-full"
                  style={{ 
                    background: config.color,
                    boxShadow: `0 0 8px ${config.color}20`
                  }}
                  initial={{ width: 0 }}
                  animate={{ width: `${percentage}%` }}
                  transition={{ duration: 1.5, delay: 0.5 + index * 0.1, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>
            </div>
          );
        })}

        {sorted.length === 0 && (
          <div className="flex flex-col items-center justify-center h-48 opacity-20">
            <DotsThreeCircle weight="light" size={48} className="text-slate-200" />
            <p className="text-[10px] font-bold uppercase tracking-widest mt-4 text-slate-400">Zero Data Points</p>
          </div>
        )}
      </div>
    </div>
  );
}
