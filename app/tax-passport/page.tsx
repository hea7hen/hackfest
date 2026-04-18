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
    <div className="max-w-4xl mx-auto p-6 space-y-8">

      <div className="flex items-center gap-4 px-2">
        <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center border border-blue-100/50 shadow-sm">
          <Shield size={24} className="text-blue-600" />
        </div>
        <div>
          const today = new Date();
          const fyStartYear = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
          const fiscalYear = `FY ${fyStartYear}-${String(fyStartYear + 1).slice(-2)}`;

          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Tax Passport</h1>
          <p className="text-sm text-slate-500 font-medium">
            Based on {transactions.length} transactions · {fiscalYear} · Fiscal Intelligence
          </p>
        </div>
      </div>

      {flagged.length > 0 && (
        <div className="flex items-start gap-3 rounded-2xl bg-amber-50/50 border border-amber-200 p-4 shadow-sm">
          <AlertTriangle size={18} className="text-amber-500 mt-0.5 shrink-0" />
          <div className="space-y-1">
            <p className="text-sm text-slate-900 font-bold">
              Verification Required
            </p>
            <p className="text-xs text-slate-600 font-medium">
              {flagged.length} transaction{flagged.length > 1 ? 's' : ''} flagged for manual review
              (confidence below 70%). Tap items below to investigate.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {metrics.map(m => (
          <div key={m.label} className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{m.label}</p>
            <p className={`text-2xl font-black tracking-tight ${m.color}`}>{m.value}</p>
          </div>
        ))}
      </div>

      <div>
        <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 px-2">
          Deductible Ledger ({deductibles.length})
        </h2>

        {deductibles.length === 0 ? (
          <div className="rounded-3xl border-2 border-dashed border-slate-100 bg-white p-12 text-center shadow-inner">
            <p className="text-sm text-slate-900 font-bold">No deductible expenses found yet.</p>
            <p className="text-xs text-slate-400 mt-1 font-medium">Upload invoices from Scan Document or extract PDFs from Gmail on the Dashboard.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {deductibles.map(t => (
              <div
                key={t.id}
                className="rounded-3xl border border-slate-100 bg-white overflow-hidden shadow-sm hover:shadow-md transition-shadow"
              >
                <button
                  type="button"
                  onClick={() => setExpanded(expanded === t.id ? null : t.id)}
                  className="w-full flex items-center gap-3 p-5 hover:bg-slate-50 transition-colors text-left"
                >
                  <div className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center border border-slate-200/50">
                    {expanded === t.id
                      ? <ChevronDown size={14} className="text-slate-600 shrink-0" />
                      : <ChevronRight size={14} className="text-slate-600 shrink-0" />
                    }
                  </div>
                  <span className="flex-1 text-sm font-bold text-slate-900">{t.vendor || 'Unknown Vendor'}</span>
                  <span className="text-[11px] text-slate-400 font-medium">{t.date}</span>
                  <span className="text-sm font-black ml-3 text-slate-900">
                    ₹{t.amount.toLocaleString('en-IN')}
                  </span>
                  {t.confidence < 0.7 && (
                    <span className="ml-2 text-[10px] font-black uppercase tracking-widest bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                      Review
                    </span>
                  )}
                </button>

                {expanded === t.id && (
                  <div className="px-6 pb-6 pt-0 space-y-4 border-t border-slate-50">
                    <div className="grid grid-cols-3 gap-3 text-[11px] pt-4">
                      <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100/50">
                        <span className="text-slate-400 font-bold uppercase tracking-wide text-[9px] block mb-1">Category</span>
                        <p className="font-black capitalize text-slate-900">{t.category}</p>
                      </div>
                      <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100/50">
                        <span className="text-slate-400 font-bold uppercase tracking-wide text-[9px] block mb-1">Tax type</span>
                        <p className="font-black text-slate-900">{t.taxType}</p>
                      </div>
                      <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100/50">
                        <span className="text-slate-400 font-bold uppercase tracking-wide text-[9px] block mb-1">Confidence</span>
                        <p className={`font-black ${t.confidence >= 0.7 ? 'text-emerald-600' : 'text-amber-600'}`}>
                          {Math.round(t.confidence * 100)}%
                        </p>
                      </div>
                    </div>
                    <div className="bg-blue-50/50 rounded-2xl p-4 border border-blue-100 shadow-inner">
                      <p className="text-[9px] font-black uppercase tracking-widest text-blue-600 mb-2">AI Extraction Reasoning</p>
                      <p className="text-xs text-slate-600 font-medium leading-relaxed">{t.aiReasoning || 'Direct matching mechanism; no complex reasoning recorded.'}</p>
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
