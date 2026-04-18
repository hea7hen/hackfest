'use client';

import React, { useEffect, useState } from 'react';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  BadgeIndianRupee,
  CircleAlert,
  Layers3,
  Search,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { getFinanceSummary, getTransactions } from '@/lib/api/client';

const currency = (value) => `Rs ${Number(value || 0).toLocaleString('en-IN')}`;

export default function TransactionsView() {
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    Promise.all([getTransactions(), getFinanceSummary()])
      .then(([transactionRows, financeSummary]) => {
        setTransactions(transactionRows);
        setSummary(financeSummary);
        setError('');
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading || !summary || !transactions) {
    return (
      <div className="flex h-[78vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="rounded-full border border-[var(--border-primary)] bg-[var(--surface-elevated)] px-5 py-3 text-[14px] font-medium text-[var(--text-secondary)]">
            {error ? 'Failed to read the ledger.' : 'Reading the ledger...'}
          </div>
          {error && (
             <p className="text-[13px] text-[var(--accent-danger)] max-w-md text-center">
               {error}. Check if the backend is running at http://localhost:8000
             </p>
          )}
        </div>
      </div>
    );
  }

  const filteredTransactions = transactions.filter((txn) => {
    const haystack = `${txn.description} ${txn.category} ${txn.date}`.toLowerCase();
    return haystack.includes(query.toLowerCase());
  });

  const categoryMap = new Map();
  filteredTransactions.forEach((txn) => {
    const existing = categoryMap.get(txn.category) || 0;
    categoryMap.set(txn.category, existing + Number(txn.amount || 0));
  });
  const topCategories = Array.from(categoryMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  return (
    <div className="space-y-8 pb-16">
      <section className="grid gap-6 xl:grid-cols-[1.05fr,0.95fr]">
        <div className="apple-card p-8 md:p-10">
          <p className="eyebrow">Structured money trail</p>
          <h1 className="mt-3 font-display text-[54px] leading-[0.92] tracking-[-0.05em] text-[var(--text-primary)] md:text-[64px]">
            The ledger is where raw uploads become operating truth.
          </h1>
          <p className="mt-5 max-w-3xl text-[16px] leading-7 text-[var(--text-secondary)]">
            This page is the bridge between uploaded evidence and financial
            visibility. It shows how money was categorized, what looks unusual,
            and what Finance Copilot can later explain back to the user.
          </p>

          <div className="mt-8 relative max-w-xl">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search description, category, or date"
              className="w-full rounded-full border border-[var(--border-primary)] bg-[var(--surface-muted)] py-4 pl-12 pr-5 text-[14px] text-[var(--text-primary)] outline-none transition-all focus:border-[var(--accent-strong)]"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="apple-card p-6">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-[0.22em] text-[var(--text-tertiary)]">
                Net inflow
              </span>
              <ArrowDownCircle className="h-4 w-4 text-[var(--accent-strong)]" />
            </div>
            <p className="mt-5 text-[34px] font-semibold tracking-[-0.05em] text-[var(--text-primary)]">
              {currency(summary.totals.income)}
            </p>
          </div>

          <div className="apple-card p-6">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-[0.22em] text-[var(--text-tertiary)]">
                Net outflow
              </span>
              <ArrowUpCircle className="h-4 w-4 text-[var(--accent-warn)]" />
            </div>
            <p className="mt-5 text-[34px] font-semibold tracking-[-0.05em] text-[var(--text-primary)]">
              {currency(summary.totals.expense)}
            </p>
          </div>

          <div className="apple-card p-6">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-[0.22em] text-[var(--text-tertiary)]">
                GST reserve
              </span>
              <BadgeIndianRupee className="h-4 w-4 text-[var(--accent-strong)]" />
            </div>
            <p className="mt-5 text-[34px] font-semibold tracking-[-0.05em] text-[var(--text-primary)]">
              {currency(summary.gst.estimated_gst_liability)}
            </p>
          </div>

          <div className="apple-card p-6">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-[0.22em] text-[var(--text-tertiary)]">
                Unusual transactions
              </span>
              <CircleAlert className="h-4 w-4 text-[var(--accent-warn)]" />
            </div>
            <p className="mt-5 text-[34px] font-semibold tracking-[-0.05em] text-[var(--text-primary)]">
              {summary.unusual_transactions.length}
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.85fr,1.15fr]">
        <div className="apple-card p-8">
          <p className="eyebrow">Category pressure</p>
          <h2 className="mt-3 font-display text-[40px] leading-none tracking-[-0.05em]">
            Where the money clusters
          </h2>

          <div className="mt-8 space-y-4">
            {topCategories.map(([category, amount]) => {
              const share = Math.min(100, Math.round((amount / Math.max(summary.totals.expense || 1, 1)) * 100));
              return (
                <div key={category}>
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <Layers3 className="h-4 w-4 text-[var(--accent-strong)]" />
                      <p className="text-[14px] font-semibold capitalize text-[var(--text-primary)]">
                        {category.replace(/_/g, ' ')}
                      </p>
                    </div>
                    <p className="text-[13px] text-[var(--text-secondary)]">{currency(amount)}</p>
                  </div>
                  <div className="mt-3 h-3 overflow-hidden rounded-full bg-[var(--surface-muted)]">
                    <div
                      className="h-full rounded-full bg-[var(--surface-strong)]"
                      style={{ width: `${share}%` }}
                    />
                  </div>
                </div>
              );
            })}

            {topCategories.length === 0 && (
              <p className="text-[14px] text-[var(--text-secondary)]">
                No categories are available for the current filter.
              </p>
            )}
          </div>
        </div>

        <div className="apple-card overflow-hidden">
          <div className="flex items-end justify-between gap-4 border-b border-[var(--border-primary)] px-8 py-6">
            <div>
              <p className="eyebrow">Transaction feed</p>
              <h2 className="mt-3 font-display text-[38px] leading-none tracking-[-0.05em]">
                Classified ledger entries
              </h2>
            </div>
            <div className="rounded-full border border-[var(--border-primary)] bg-[var(--surface-muted)] px-4 py-2 text-[12px] font-medium text-[var(--text-secondary)]">
              Confidence is derived from backend classification
            </div>
          </div>

          {error && (
            <div className="mx-8 mt-6 rounded-[20px] border border-[color:rgba(167,53,45,0.16)] bg-[color:rgba(167,53,45,0.08)] px-5 py-4 text-[13px] text-[var(--accent-danger)]">
              {error}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="min-w-full text-left">
              <thead>
                <tr className="border-b border-[var(--border-primary)] text-[11px] uppercase tracking-[0.22em] text-[var(--text-tertiary)]">
                  <th className="px-8 py-5 font-semibold">Date</th>
                  <th className="px-8 py-5 font-semibold">Description</th>
                  <th className="px-8 py-5 font-semibold">Category</th>
                  <th className="px-8 py-5 font-semibold text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.map((txn, index) => (
                  <motion.tr
                    key={`${txn.date}-${txn.description}-${index}`}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.015 }}
                    className="border-b border-[var(--border-primary)] bg-[color:transparent] transition-colors hover:bg-[color:rgba(239,230,214,0.56)]"
                  >
                    <td className="px-8 py-6 text-[13px] text-[var(--text-secondary)]">{txn.date}</td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-3">
                        {txn.direction === 'credit' ? (
                          <ArrowDownCircle className="h-4 w-4 text-[var(--accent-strong)]" />
                        ) : (
                          <ArrowUpCircle className="h-4 w-4 text-[var(--accent-warn)]" />
                        )}
                        <div>
                          <p className="text-[14px] font-semibold text-[var(--text-primary)]">
                            {txn.description}
                          </p>
                          <p className="text-[12px] text-[var(--text-secondary)]">
                            Confidence {Math.round(Number(txn.confidence || 0) * 100)}%
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <span className="rounded-full bg-[var(--surface-muted)] px-3 py-1 text-[11px] font-semibold capitalize text-[var(--text-secondary)]">
                        {txn.category.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <p className="text-[15px] font-semibold text-[var(--text-primary)]">
                        {txn.direction === 'debit' ? '-' : '+'}
                        {currency(txn.amount)}
                      </p>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredTransactions.length === 0 && (
            <div className="px-8 py-14 text-center text-[14px] text-[var(--text-secondary)]">
              No transactions match the current search.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
