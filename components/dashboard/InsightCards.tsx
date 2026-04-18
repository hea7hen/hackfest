'use client';

import { motion } from 'framer-motion';
import { 
  ChartLineUp, 
  WarningCircle, 
  FileText, 
  PiggyBank, 
  Calendar, 
  Info,
  ArrowRight
} from '@phosphor-icons/react';
import type { Insight } from '@/lib/types';

const severityConfig = {
  info: { color: '#3B82F6', icon: Info },
  warning: { color: '#F59E0B', icon: WarningCircle },
  critical: { color: '#F43F5E', icon: WarningCircle },
};

const typeIcons: Record<Insight['type'], any> = {
  spending_spike: ChartLineUp,
  tax_deadline: Calendar,
  deductible_gap: FileText,
  low_savings: PiggyBank,
  data_gap: Info,
  month_summary: ChartLineUp,
};

interface Props {
  insights: Insight[];
}

export default function InsightCards({ insights }: Props) {
  if (insights.length === 0) return null;

  return (
    <div className="space-y-4">
      <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 px-1">
        Strategic Intelligence
      </h3>
      <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 no-scrollbar">
        {insights.map((insight, i) => {
          const config = severityConfig[insight.severity];
          const Icon = typeIcons[insight.type] || Info;

          return (
            <motion.div
              key={insight.id}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
              className="flex-shrink-0 w-[320px] rounded-3xl p-6 bg-white border border-slate-100 shadow-[0_15px_30px_-10px_rgba(0,0,0,0.05)] relative group cursor-pointer overflow-hidden transition-all hover:shadow-[0_25px_40px_-15px_rgba(0,0,0,0.08)]"
            >
              {/* Subtle Highlight Glow */}
              <div 
                className="absolute top-0 right-0 w-32 h-32 blur-3xl opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none"
                style={{ background: config.color }}
              />

              <div className="flex flex-col h-full">
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border border-slate-100"
                    style={{ background: `${config.color}08`, color: config.color }}
                  >
                    <Icon weight="duotone" size={20} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold uppercase tracking-widest leading-none mb-1" style={{ color: config.color }}>
                      {insight.severity}
                    </span>
                    <span className="text-xs font-bold text-slate-400 capitalize">
                      {insight.type.replace('_', ' ')}
                    </span>
                  </div>
                </div>

                <div className="flex-1">
                  <p className="text-md font-black tracking-tight text-slate-900 mb-2 leading-tight">
                    {insight.headline}
                  </p>
                  <p className="text-xs font-medium leading-relaxed text-slate-500">
                    {insight.detail}
                  </p>
                </div>

                {insight.actionLabel && (
                  <div className="mt-6 pt-4 border-t border-slate-50 flex items-center justify-between group/action">
                    <span className="text-xs font-bold text-slate-900 group-hover/action:text-blue-600 transition-colors">
                      {insight.actionLabel}
                    </span>
                    <ArrowRight weight="bold" size={14} className="text-slate-400 group-hover/action:translate-x-1 transition-transform" />
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
