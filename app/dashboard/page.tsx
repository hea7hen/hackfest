'use client';

import { motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db/schema';
import { getRecentTransactions, getCategoryTotals, getMonthlyTotals, computeHealthScore } from '@/lib/db/transactions';
import type { HealthScore, TaxSummary, Insight } from '@/lib/types';

import HealthScoreRing from '@/components/dashboard/HealthScoreRing';
import CashFlowChart from '@/components/dashboard/CashFlowChart';
import CategoryBreakdown from '@/components/dashboard/CategoryBreakdown';
import TaxSnapshot from '@/components/dashboard/TaxSnapshot';
import InsightCards from '@/components/dashboard/InsightCards';
import RecentTransactions from '@/components/dashboard/RecentTransactions';
import { Skeleton } from '@/components/ui/skeleton';

function generateDefaultInsights(
  categoryTotals: Record<string, number>,
  taxSummaries: TaxSummary[],
  txCount: number
): Insight[] {
  const insights: Insight[] = [];
  const now = new Date();

  const totalIncome = taxSummaries.reduce((s, t) => s + t.totalIncome, 0);
  const totalExpenses = taxSummaries.reduce((s, t) => s + t.totalExpenses, 0);
  const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0;

  if (categoryTotals['food'] > 3000) {
    insights.push({
      id: 'insight-food-spike',
      type: 'spending_spike',
      headline: 'Food spending is high',
      detail: `You've spent \u20B9${categoryTotals['food']?.toLocaleString('en-IN')} on food. Consider meal planning to reduce costs.`,
      severity: 'warning',
      actionLabel: 'View food expenses',
      createdAt: now.toISOString(),
    });
  }

  const advanceTaxDates = [
    { month: 6, day: 15, label: 'Q1' },
    { month: 9, day: 15, label: 'Q2' },
    { month: 12, day: 15, label: 'Q3' },
    { month: 3, day: 15, label: 'Q4' },
  ];
  for (const atd of advanceTaxDates) {
    const deadlineYear = atd.month <= 3 ? now.getFullYear() + 1 : now.getFullYear();
    const deadline = new Date(deadlineYear, atd.month - 1, atd.day);
    const daysUntil = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (daysUntil > 0 && daysUntil <= 14) {
      insights.push({
        id: `insight-tax-${atd.label}`,
        type: 'tax_deadline',
        headline: `${atd.label} advance tax due in ${daysUntil} days`,
        detail: `Advance tax installment due by ${deadline.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}. Estimated liability based on your income data.`,
        severity: daysUntil <= 7 ? 'critical' : 'warning',
        actionLabel: 'View tax passport',
        createdAt: now.toISOString(),
      });
    }
  }

  if (savingsRate < 10 && totalIncome > 0) {
    insights.push({
      id: 'insight-low-savings',
      type: 'low_savings',
      headline: savingsRate < 0 ? 'Spending exceeds income' : 'Low savings rate',
      detail: `Your savings rate is ${savingsRate.toFixed(0)}%. Financial advisors recommend at least 20%.`,
      severity: savingsRate < 0 ? 'critical' : 'warning',
      actionLabel: 'Review expenses',
      createdAt: now.toISOString(),
    });
  }

  if (txCount < 5) {
    insights.push({
      id: 'insight-data-gap',
      type: 'data_gap',
      headline: 'Scan more documents',
      detail: 'More data means better insights. Try scanning receipts, invoices, or syncing Gmail for automatic extraction.',
      severity: 'info',
      actionLabel: 'Scan now',
      createdAt: now.toISOString(),
    });
  }

  if (totalIncome > 0) {
    insights.push({
      id: 'insight-month-summary',
      type: 'month_summary',
      headline: 'Monthly overview ready',
      detail: `Income: \u20B9${totalIncome.toLocaleString('en-IN')} | Expenses: \u20B9${totalExpenses.toLocaleString('en-IN')} | Savings: ${savingsRate.toFixed(0)}%`,
      severity: 'info',
      actionLabel: null,
      createdAt: now.toISOString(),
    });
  }

  return insights.slice(0, 5);
}

export default function DashboardPage() {
  const [healthScore, setHealthScore] = useState<HealthScore | null>(null);
  const [categoryTotals, setCategoryTotals] = useState<Record<string, number>>({});
  const [monthlyTotals, setMonthlyTotals] = useState<{ monthYear: string; income: number; expenses: number }[]>([]);

  const recentTxs = useLiveQuery(() => getRecentTransactions(10), []);
  const taxSummaries = useLiveQuery(() => db.taxSummaries.toArray(), []);

  useEffect(() => {
    async function loadDashboard() {
      const [score, cats, monthly] = await Promise.all([
        computeHealthScore(),
        getCategoryTotals(),
        getMonthlyTotals(),
      ]);
      setHealthScore(score);
      setCategoryTotals(cats);
      setMonthlyTotals(monthly);
    }
    loadDashboard();
  }, [recentTxs]);

  const insights: Insight[] = useMemo(() => {
    if (!taxSummaries) return [];
    const count = recentTxs?.length || 0;
    return generateDefaultInsights(categoryTotals, taxSummaries, count);
  }, [taxSummaries, categoryTotals, recentTxs]);

  if (!healthScore || !recentTxs || !taxSummaries) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6">
        <Skeleton className="lg:col-span-12 h-[200px] rounded-3xl bg-slate-100/50" />
        <Skeleton className="lg:col-span-4 h-[400px] rounded-3xl bg-slate-100/50" />
        <Skeleton className="lg:col-span-8 h-[400px] rounded-3xl bg-slate-100/50" />
      </div>
    );
  }

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.3
      }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { duration: 0.8 } }
  };

  return (
    <motion.div 
        variants={container}
        initial="hidden"
        animate="show"
        className="space-y-8 pb-12"
      >
        {/* Intelligence Overlay (Full Width) */}
        <motion.div variants={item}>
          <InsightCards insights={insights} />
        </motion.div>

        {/* Bento Grid 2.0 Content */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6 auto-rows-[minmax(400px,auto)]">
          
          {/* Health Core - Compact Focus */}
          <motion.div variants={item} className="lg:col-span-4 xl:col-span-3">
            <HealthScoreRing healthScore={healthScore} />
          </motion.div>

          {/* Cash Flow - Main Visibility */}
          <motion.div variants={item} className="lg:col-span-8 xl:col-span-9">
            <CashFlowChart data={monthlyTotals} />
          </motion.div>

          {/* Ledger - Detail View */}
          <motion.div variants={item} className="lg:col-span-8">
            <RecentTransactions transactions={recentTxs} />
          </motion.div>

          {/* Sub-Bento for Analytics */}
          <div className="lg:col-span-4 grid grid-cols-1 gap-6">
            <motion.div variants={item}>
              <CategoryBreakdown data={categoryTotals} />
            </motion.div>
            <motion.div variants={item}>
              <TaxSnapshot summaries={taxSummaries} />
            </motion.div>
          </div>
        </div>

      </motion.div>
  );
}
