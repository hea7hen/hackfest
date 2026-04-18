'use client';

import { motion } from 'framer-motion';
import { TrendingUp, AlertTriangle, FileCheck, PiggyBank, Calendar, Info } from 'lucide-react';
import type { Insight } from '@/lib/types';

const severityConfig = {
  info: { color: '#3B82F6', bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.2)' },
  warning: { color: '#F59E0B', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.2)' },
  critical: { color: '#F43F5E', bg: 'rgba(244,63,94,0.1)', border: 'rgba(244,63,94,0.2)' },
};

const typeIcons: Record<Insight['type'], React.ElementType> = {
  spending_spike: TrendingUp,
  tax_deadline: Calendar,
  deductible_gap: FileCheck,
  low_savings: PiggyBank,
  data_gap: Info,
  month_summary: AlertTriangle,
};

interface Props {
  insights: Insight[];
}

export default function InsightCards({ insights }: Props) {
  if (insights.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
    >
      <h3 className="text-sm font-medium mb-3" style={{ color: '#8899AA' }}>
        Insights
      </h3>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
        {insights.map((insight, i) => {
          const config = severityConfig[insight.severity];
          const Icon = typeIcons[insight.type] || Info;

          return (
            <motion.div
              key={insight.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.15 + i * 0.05 }}
              className="flex-shrink-0 w-[280px] rounded-xl p-4 cursor-pointer hover:scale-[1.02] transition-transform"
              style={{
                background: config.bg,
                borderLeft: `3px solid ${config.color}`,
                border: `1px solid ${config.border}`,
                borderLeftWidth: '3px',
              }}
            >
              <div className="flex items-start gap-3">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                  style={{ background: `${config.color}20` }}
                >
                  <Icon size={16} style={{ color: config.color }} />
                </div>
                <div>
                  <p className="text-sm font-medium mb-1" style={{ color: '#F0F4FF' }}>
                    {insight.headline}
                  </p>
                  <p className="text-xs leading-relaxed" style={{ color: '#8899AA' }}>
                    {insight.detail}
                  </p>
                  {insight.actionLabel && (
                    <button
                      className="text-xs font-medium mt-2"
                      style={{ color: config.color }}
                    >
                      {insight.actionLabel} &rarr;
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
