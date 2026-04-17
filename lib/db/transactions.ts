import { db } from './schema';
import type { Transaction, TransactionCategory, HealthScore } from '../types';

export async function getAllTransactions(): Promise<Transaction[]> {
  return db.transactions.orderBy('date').reverse().toArray();
}

export async function getTransactionsByMonth(monthYear: string): Promise<Transaction[]> {
  return db.transactions.where('monthYear').equals(monthYear).toArray();
}

export async function getTransactionsByCategory(category: TransactionCategory): Promise<Transaction[]> {
  return db.transactions.where('category').equals(category).toArray();
}

export async function getRecentTransactions(limit: number = 10): Promise<Transaction[]> {
  return db.transactions.orderBy('date').reverse().limit(limit).toArray();
}

export async function getCategoryTotals(monthYear?: string): Promise<Record<TransactionCategory, number>> {
  const txs = monthYear
    ? await db.transactions.where('monthYear').equals(monthYear).toArray()
    : await db.transactions.toArray();

  const totals = {} as Record<TransactionCategory, number>;
  for (const tx of txs) {
    if (tx.category === 'salary') continue;
    totals[tx.category] = (totals[tx.category] || 0) + tx.amount;
  }
  return totals;
}

export async function getMonthlyTotals(): Promise<{ monthYear: string; income: number; expenses: number }[]> {
  const txs = await db.transactions.toArray();
  const map = new Map<string, { income: number; expenses: number }>();

  for (const tx of txs) {
    const entry = map.get(tx.monthYear) || { income: 0, expenses: 0 };
    if (tx.category === 'salary') {
      entry.income += tx.amount;
    } else {
      entry.expenses += tx.amount;
    }
    map.set(tx.monthYear, entry);
  }

  return Array.from(map.entries())
    .map(([monthYear, totals]) => ({ monthYear, ...totals }))
    .sort((a, b) => a.monthYear.localeCompare(b.monthYear));
}

export async function computeHealthScore(): Promise<HealthScore> {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

  const currentTxs = await getTransactionsByMonth(currentMonth);
  const prevTxs = await getTransactionsByMonth(prevMonth);
  const allTxs = await db.transactions.count();

  const curIncome = currentTxs.filter(t => t.category === 'salary').reduce((s, t) => s + t.amount, 0);
  const curExpenses = currentTxs.filter(t => t.category !== 'salary').reduce((s, t) => s + t.amount, 0);
  const prevExpenses = prevTxs.filter(t => t.category !== 'salary').reduce((s, t) => s + t.amount, 0);

  const savingsRate = curIncome > 0 ? ((curIncome - curExpenses) / curIncome) * 100 : 0;
  const expenseGrowth = prevExpenses > 0 ? ((curExpenses - prevExpenses) / prevExpenses) * 100 : 0;

  const taxSummaries = await db.taxSummaries.toArray();
  const totalLiability = taxSummaries.reduce((s, t) => s + t.estimatedTaxLiability, 0);

  let score = 50;
  if (savingsRate > 20) score += 20;
  if (totalLiability <= 50000) score += 15;
  if (expenseGrowth < 5) score += 10;
  if (allTxs > 10) score += 5;
  if (totalLiability > 50000) score -= 20;
  if (savingsRate < 0) score -= 10;

  score = Math.max(0, Math.min(100, score));

  let label: HealthScore['label'];
  let color: string;
  if (score <= 40) { label = 'Poor'; color = '#F43F5E'; }
  else if (score <= 70) { label = 'Fair'; color = '#F59E0B'; }
  else if (score <= 85) { label = 'Good'; color = '#10B981'; }
  else { label = 'Excellent'; color = '#10B981'; }

  return { score, label, color };
}
