'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db/schema';
import { FileText, TrendingUp, DollarSign, Calendar } from 'lucide-react';
import type { Transaction } from '@/lib/types';

export default function InvoiceAnalysisReport() {
  const recentInvoices = useLiveQuery(async () => {
    const txs = await db.transactions
      .where('documentType')
      .equals('receipt')
      .toArray();
    return txs.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    ).slice(0, 5);
  }, []);

  if (!recentInvoices || recentInvoices.length === 0) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center border border-blue-100">
            <FileText size={20} className="text-blue-600" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Invoice Analysis Report</h2>
        </div>
        <p className="text-sm text-slate-500">No invoices yet. Extract PDFs from Gmail on the dashboard to see analysis.</p>
      </div>
    );
  }

  const totalAmount = recentInvoices.reduce((sum, tx) => sum + tx.amount, 0);
  const gstTotal = recentInvoices.reduce((sum, tx) => sum + (tx.taxAmount || 0), 0);
  const deductibleCount = recentInvoices.filter(tx => tx.isTaxDeductible).length;

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center border border-blue-100">
            <FileText size={20} className="text-blue-600" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Invoice Analysis Report</h2>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100/50">
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide mb-1">Total Amount</p>
          <p className="text-xl font-black text-slate-900">₹{totalAmount.toLocaleString('en-IN')}</p>
        </div>
        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100/50">
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide mb-1">GST Amount</p>
          <p className="text-xl font-black text-slate-900">₹{gstTotal.toLocaleString('en-IN')}</p>
        </div>
        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100/50">
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide mb-1">Tax Deductible</p>
          <p className="text-xl font-black text-slate-900">{deductibleCount}/{recentInvoices.length}</p>
        </div>
      </div>

      {/* Recent Invoices */}
      <div className="space-y-3">
        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest px-1">Recent Invoices</p>
        {recentInvoices.map((invoice) => (
          <div key={invoice.id} className="border border-slate-100 rounded-2xl p-4 hover:bg-slate-50/50 transition-colors">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-bold text-slate-900 text-sm">{invoice.vendor || 'Unknown Vendor'}</h3>
                  {invoice.isTaxDeductible && (
                    <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">
                      Tax Deductible
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-600 mb-2">{invoice.description}</p>
                <div className="flex gap-4 text-xs">
                  <div className="flex items-center gap-1 text-slate-500">
                    <Calendar size={14} className="text-slate-400" />
                    <span>{new Date(invoice.date).toLocaleDateString('en-IN')}</span>
                  </div>
                  <div className="flex items-center gap-1 text-slate-500">
                    <span className="bg-slate-100 px-2 py-1 rounded-md font-semibold">{invoice.category}</span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-black text-slate-900">₹{invoice.amount.toLocaleString('en-IN')}</p>
                {invoice.taxAmount && (
                  <p className="text-xs text-slate-500 mt-1">+₹{invoice.taxAmount.toLocaleString('en-IN')} GST</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* AI Reasoning */}
      <div className="mt-6 pt-6 border-t border-slate-100">
        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-3">AI Analysis</p>
        <div className="bg-blue-50/50 rounded-2xl border border-blue-100 p-4">
          <p className="text-sm text-slate-700 leading-relaxed">
            {deductibleCount === recentInvoices.length
              ? `All ${recentInvoices.length} invoices are eligible for tax deduction. Ensure proper documentation is maintained for GST ITC claims.`
              : `${deductibleCount} out of ${recentInvoices.length} invoices are marked as tax deductible. Review non-deductible items for compliance.`}
          </p>
        </div>
      </div>
    </div>
  );
}
