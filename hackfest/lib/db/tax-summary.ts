import { db } from './schema';
import type { TaxSummary } from '../types';

export async function recomputeTaxSummary(monthYear: string): Promise<TaxSummary> {
  const txs = await db.transactions.where('monthYear').equals(monthYear).toArray();

  const totalIncome = txs.filter(t => t.category === 'salary').reduce((s, t) => s + t.amount, 0);
  const totalExpenses = txs.filter(t => t.category !== 'salary').reduce((s, t) => s + t.amount, 0);
  const tdsDeducted = txs.filter(t => t.taxType === 'TDS').reduce((s, t) => s + (t.taxAmount || 0), 0);
  const gstPaid = txs.filter(t => t.taxType === 'GST').reduce((s, t) => s + (t.taxAmount || 0), 0);
  const deductibleAmount = txs.filter(t => t.isTaxDeductible).reduce((s, t) => s + t.amount, 0);
  const estimatedTaxLiability = Math.max(0, (totalIncome * 0.3) - tdsDeducted);

  const summary: TaxSummary = {
    monthYear,
    totalIncome,
    totalExpenses,
    tdsDeducted,
    gstPaid,
    deductibleAmount,
    estimatedTaxLiability,
    updatedAt: new Date().toISOString(),
  };

  await db.taxSummaries.put(summary);
  return summary;
}

export async function recomputeAllTaxSummaries(): Promise<TaxSummary[]> {
  const txs = await db.transactions.toArray();
  const months = new Set(txs.map(t => t.monthYear));
  const summaries: TaxSummary[] = [];
  for (const m of months) {
    summaries.push(await recomputeTaxSummary(m));
  }
  return summaries;
}

export async function getAllTaxSummaries(): Promise<TaxSummary[]> {
  return db.taxSummaries.toArray();
}
