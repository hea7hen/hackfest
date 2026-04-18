'use client';

import { motion } from 'framer-motion';
import type { TransactionCategory } from '@/lib/types';
import {
  UtensilsCrossed, Car, Zap, Home, Briefcase,
  Heart, Film, ShoppingBag, IndianRupee, MoreHorizontal,
} from 'lucide-react';

const categoryConfig: Record<TransactionCategory, { label: string; color: string; icon: React.ElementType }> = {
  food: { label: 'Food & Dining', color: '#F59E0B', icon: UtensilsCrossed },
  transport: { label: 'Transport', color: '#8B5CF6', icon: Car },
  utilities: { label: 'Utilities', color: '#06B6D4', icon: Zap },
  rent: { label: 'Rent', color: '#F43F5E', icon: Home },
  salary: { label: 'Salary', color: '#10B981', icon: IndianRupee },
  business: { label: 'Business', color: '#3B82F6', icon: Briefcase },
  medical: { label: 'Medical', color: '#EC4899', icon: Heart },
  entertainment: { label: 'Entertainment', color: '#A855F7', icon: Film },
  tax: { label: 'Tax', color: '#EF4444', icon: IndianRupee },
  shopping: { label: 'Shopping', color: '#14B8A6', icon: ShoppingBag },
  other: { label: 'Other', color: '#6B7280', icon: MoreHorizontal },
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
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="rounded-2xl p-6"
      style={{
        background: '#131929',
        border: '1px solid rgba(255,255,255,0.06)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
      }}
    >
      <h3 className="text-sm font-medium mb-4" style={{ color: '#8899AA' }}>
        Top Categories
      </h3>

      <div className="space-y-4">
        {sorted.map(([category, amount], index) => {
          const config = categoryConfig[category as TransactionCategory] || categoryConfig.other;
          const Icon = config.icon;
          const percentage = (amount / maxAmount) * 100;

          return (
            <div key={category} className="group cursor-pointer">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center"
                    style={{ background: `${config.color}20` }}
                  >
                    <Icon size={14} style={{ color: config.color }} />
                  </div>
                  <span className="text-sm" style={{ color: '#F0F4FF' }}>
                    {config.label}
                  </span>
                </div>
                <span className="font-financial text-sm" style={{ color: '#F0F4FF' }}>
                  {'\u20B9'}{amount.toLocaleString('en-IN')}
                </span>
              </div>

              <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: config.color }}
                  initial={{ width: 0 }}
                  animate={{ width: `${percentage}%` }}
                  transition={{ duration: 0.8, delay: 0.4 + index * 0.1, ease: 'easeOut' }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {sorted.length === 0 && (
        <p className="text-sm text-center py-8" style={{ color: '#8899AA' }}>
          No expenses yet
        </p>
      )}
    </motion.div>
  );
}
