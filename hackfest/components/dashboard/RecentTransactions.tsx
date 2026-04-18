'use client';

import { motion } from 'framer-motion';
import type { Transaction, TransactionCategory } from '@/lib/types';
import { Badge } from '@/components/ui/badge';

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
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.4 }}
      className="rounded-2xl p-6"
      style={{
        background: '#131929',
        border: '1px solid rgba(255,255,255,0.06)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
      }}
    >
      <h3 className="text-sm font-medium mb-4" style={{ color: '#8899AA' }}>
        Recent Transactions
      </h3>

      <div className="space-y-1">
        {transactions.map((tx, i) => {
          const isIncome = tx.category === 'salary';
          const initial = tx.vendor ? tx.vendor[0].toUpperCase() : '?';
          const catColor = categoryColors[tx.category] || '#6B7280';

          return (
            <motion.div
              key={tx.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: 0.45 + i * 0.04 }}
              className="flex items-center gap-3 py-3 px-2 rounded-lg hover:bg-white/[0.02] transition-colors"
            >
              {/* Vendor avatar */}
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold shrink-0"
                style={{
                  background: `${catColor}15`,
                  color: catColor,
                }}
              >
                {initial}
              </div>

              {/* Details */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: '#F0F4FF' }}>
                  {tx.vendor || 'Unknown'}
                </p>
                <p className="text-xs truncate" style={{ color: '#8899AA' }}>
                  {tx.description}
                </p>
              </div>

              {/* Amount */}
              <div className="text-right shrink-0">
                <p
                  className="font-financial text-sm"
                  style={{ color: isIncome ? '#10B981' : '#F43F5E' }}
                >
                  {isIncome ? '+' : '-'}{'\u20B9'}{tx.amount.toLocaleString('en-IN')}
                </p>
                <p className="text-[10px]" style={{ color: '#8899AA' }}>
                  {new Date(tx.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </p>
              </div>

              {/* Category badge */}
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0.5 shrink-0"
                style={{
                  color: catColor,
                  borderColor: `${catColor}40`,
                  background: `${catColor}10`,
                }}
              >
                {tx.category}
              </Badge>

              {/* Confidence dot */}
              <div
                className="w-2 h-2 rounded-full shrink-0"
                title={`Confidence: ${Math.round(tx.confidence * 100)}%`}
                style={{
                  background: tx.confidence >= 0.9 ? '#10B981'
                    : tx.confidence >= 0.7 ? '#F59E0B'
                    : '#F43F5E',
                }}
              />
            </motion.div>
          );
        })}
      </div>

      {transactions.length === 0 && (
        <p className="text-sm text-center py-8" style={{ color: '#8899AA' }}>
          No transactions yet. Scan a document to get started.
        </p>
      )}
    </motion.div>
  );
}
