'use client';

import { useEffect, useState } from 'react';
import { Shield, ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react';
import { db } from '@/lib/db/schema';
import type { Transaction } from '@/lib/types';

export default function TaxPassportPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    db.transactions.toArray().then(setTransactions);
  }, []);

  const income      = transactions.filter(t => t.category === 'salary');
  const deductibles = transactions.filter(t => t.isTaxDeductible);
  const tds         = transactions.filter(t => t.taxType === 'TDS');
  const gst         = transactions.filter(t => t.taxType === 'GST');
  const flagged     = deductibles.filter(t => t.confidence < 0.7);

  const sum = (arr: Transaction[]) => arr.reduce((s, t) => s + t.amount, 0);
  const sumTax = (arr: Transaction[]) =>
    arr.reduce((s, t) => s + (t.taxAmount ?? 0), 0);

  const totalIncome   = sum(income);
  const totalTds      = sumTax(tds);
  const totalGst      = sumTax(gst);
  const totalDeduct   = sum(deductibles);
  const estSavings    = Math.round(totalDeduct * 0.3);

  const metrics = [
    { label: 'Total Income',          value: `₹${totalIncome.toLocaleString('en-IN')}`,  color: 'text-green-600' },
    { label: 'TDS Deducted',          value: `₹${totalTds.toLocaleString('en-IN')}`,     color: 'text-orange-500' },
    { label: 'GST Paid',              value: `₹${totalGst.toLocaleString('en-IN')}`,     color: 'text-blue-600' },
    { label: 'Deductible Expenses',   value: `₹${totalDeduct.toLocaleString('en-IN')}`,  color: 'text-purple-600' },
    { label: 'Estimated Tax Savings', value: `₹${estSavings.toLocaleString('en-IN')}`,   color: 'text-green-600' },
    { label: 'Est. Tax Liability',    value: `₹${Math.max(0, Math.round(totalIncome * 0.3) - totalTds).toLocaleString('en-IN')}`, color: 'text-red-500' },
  ];

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">

      <div className="flex items-center gap-3">
        <Shield size={28} className="text-blue-600" />
        <div>
          <h1 className="text-2xl font-semibold text-[#F0F4FF]">Tax Passport</h1>
          <p className="text-sm text-[#8899AA]">
            Based on {transactions.length} transactions · FY 2026-27 · Every AI decision is shown below
          </p>
        </div>
      </div>

      {flagged.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 p-4">
          <AlertTriangle size={16} className="text-amber-500 mt-0.5 shrink-0" />
          <p className="text-sm text-amber-700 dark:text-amber-300">
            {flagged.length} transaction{flagged.length > 1 ? 's' : ''} flagged for manual review
            (confidence below 70%). Tap each item below to see why.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {metrics.map(m => (
          <div key={m.label} className="rounded-xl border border-white/[0.08] bg-[#131929]/40 p-4">
            <p className="text-xs text-[#8899AA]">{m.label}</p>
            <p className={`text-xl font-semibold mt-1 ${m.color}`}>{m.value}</p>
          </div>
        ))}
      </div>

      <div>
        <h2 className="text-sm font-medium text-[#8899AA] uppercase tracking-wide mb-3">
          Deductible Expenses ({deductibles.length})
        </h2>

        {deductibles.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/[0.12] p-8 text-center">
            <p className="text-sm text-[#8899AA]">No deductible expenses found yet.</p>
            <p className="text-xs text-[#8899AA] mt-1">Upload invoices from Scan Document or extract PDFs from Gmail on the Dashboard.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {deductibles.map(t => (
              <div
                key={t.id}
                className="rounded-xl border border-white/[0.08] bg-[#131929]/40 overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setExpanded(expanded === t.id ? null : t.id)}
                  className="w-full flex items-center gap-3 p-4 hover:bg-white/[0.04] transition-colors text-left"
                >
                  {expanded === t.id
                    ? <ChevronDown size={14} className="text-[#8899AA] shrink-0" />
                    : <ChevronRight size={14} className="text-[#8899AA] shrink-0" />
                  }
                  <span className="flex-1 text-sm font-medium text-[#F0F4FF]">{t.vendor || 'Unknown'}</span>
                  <span className="text-xs text-[#8899AA]">{t.date}</span>
                  <span className="text-sm font-semibold ml-3 text-[#F0F4FF]">
                    ₹{t.amount.toLocaleString('en-IN')}
                  </span>
                  {t.confidence < 0.7 && (
                    <span className="ml-2 text-xs bg-amber-100 text-amber-700 rounded-full px-2 py-0.5">
                      Review
                    </span>
                  )}
                </button>

                {expanded === t.id && (
                  <div className="px-4 pb-4 pt-0 space-y-2 border-t border-white/[0.08]">
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="bg-[#0A0F1E] rounded p-2 border border-white/[0.06]">
                        <span className="text-[#8899AA]">Category</span>
                        <p className="font-medium mt-0.5 capitalize text-[#F0F4FF]">{t.category}</p>
                      </div>
                      <div className="bg-[#0A0F1E] rounded p-2 border border-white/[0.06]">
                        <span className="text-[#8899AA]">Tax type</span>
                        <p className="font-medium mt-0.5 text-[#F0F4FF]">{t.taxType}</p>
                      </div>
                      <div className="bg-[#0A0F1E] rounded p-2 border border-white/[0.06]">
                        <span className="text-[#8899AA]">Confidence</span>
                        <p className={`font-medium mt-0.5 ${t.confidence >= 0.7 ? 'text-green-600' : 'text-amber-500'}`}>
                          {Math.round(t.confidence * 100)}%
                        </p>
                      </div>
                    </div>
                    <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-3">
                      <p className="text-xs text-blue-600 dark:text-blue-400 font-medium mb-1">AI reasoning</p>
                      <p className="text-xs text-blue-700 dark:text-blue-300">{t.aiReasoning || 'No reasoning recorded.'}</p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
