'use client';

import { motion } from 'framer-motion';
import type { Transaction, TransactionCategory } from '@/lib/types';
import { 
  ArrowUpRight, 
  ArrowDownLeft, 
  Clock, 
  Tag, 
  Fingerprint 
} from '@phosphor-icons/react';

const categoryColors: Record<TransactionCategory, string> = {
  food: '#F59E0B',
  transport: '#8B5CF6',
  utilities: '#06B6D4',
  rent: '#F43F5E',
  salary: '#10B981',
  business: '#3B82F6',
  medical: '#EC4899',
  entertainment: '#A855F7',
  tax: '#EF4444',
  shopping: '#14B8A6',
  other: '#6B7280',
};

interface Props {
  transactions: Transaction[];
}

export default function RecentTransactions({ transactions }: Props) {
  return (
    <div className="bento-card h-full flex flex-col">
      <div className="flex items-center justify-between mb-8 px-2">
        <div>
          <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-600 mb-1">
            Ledger History
          </h3>
          <p className="text-2xl font-black tracking-tight text-slate-900">Activity</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-100">
          <Clock weight="bold" size={14} className="text-slate-400" />
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sync Active</span>
        </div>
      </div>

      <div className="flex-1 space-y-1 overflow-y-auto no-scrollbar pr-1">
        {transactions.map((tx, i) => {
          const isIncome = tx.category === 'salary';
          const catColor = categoryColors[tx.category] || '#6B7280';

          return (
            <motion.div
              key={tx.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: i * 0.03, ease: [0.16, 1, 0.3, 1] }}
              className="flex items-center gap-4 py-4 px-4 rounded-2xl hover:bg-slate-50 transition-colors group cursor-pointer"
            >
              {/* Transaction Icon */}
              <div
                className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border border-slate-100 transition-all group-hover:shadow-md group-hover:scale-105"
                style={{
                  background: `${catColor}08`,
                  color: catColor,
                }}
              >
                {isIncome ? (
                  <ArrowDownLeft weight="bold" size={20} />
                ) : (
                  <ArrowUpRight weight="bold" size={20} />
                )}
              </div>

              {/* Details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-sm font-bold truncate text-slate-900">
                    {tx.vendor || 'Liquid Assets'}
                  </p>
                  <div
                    className="w-1 h-1 rounded-full opacity-30"
                    style={{ background: catColor }}
                  />
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    {tx.category}
                  </span>
                </div>
                <p className="text-xs truncate text-slate-500 font-medium">
                  {tx.description || 'No digital trail found'}
                </p>
              </div>

              {/* Amount & Date */}
              <div className="text-right shrink-0">
                <p
                  className={`font-financial text-sm font-black mb-0.5 ${isIncome ? 'text-emerald-600' : 'text-slate-900'}`}
                >
                  {isIncome ? '+' : '-'}{'\u20B9'}{tx.amount.toLocaleString('en-IN')}
                </p>
                <div className="flex items-center justify-end gap-1.5">
                  <span className="text-[10px] font-bold text-slate-400">
                    {new Date(tx.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </span>
                  {tx.confidence < 0.8 && (
                    <Fingerprint weight="bold" size={10} className="text-amber-500" />
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {transactions.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 opacity-30">
          <Tag weight="light" size={48} className="text-slate-200 mb-4" />
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Silent Ledger
          </p>
        </div>
      )}
    </div>
  );
}
