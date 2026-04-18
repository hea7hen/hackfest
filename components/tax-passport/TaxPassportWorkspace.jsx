'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle, Files, Hash, Tag } from 'lucide-react';
import { getTaxPassport } from '@/lib/api/client';

const toneMap = {
  deductible: 'text-[color:var(--accent-strong)]',
  gst: 'text-[#2565b5]',
  tds: 'text-[color:var(--accent-gold)]',
  'review-needed': 'text-[color:var(--accent-warn)]',
};

export default function TaxPassportWorkspace() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    getTaxPassport()
      .then((payload) => {
        setData(payload);
        setError('');
      })
      .catch((err) => setError(err.message));
  }, []);

  const flagged = useMemo(
    () => data?.entries.filter((entry) => entry.tags.includes('review-needed')) || [],
    [data],
  );

  if (!data) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="apple-card px-8 py-10 text-center">
          <p className="eyebrow text-[color:var(--accent-gold)]">Tax passport</p>
          <h2 className="mt-4 font-display text-4xl tracking-tight">
            {error ? 'Could not read tax passport entries.' : 'Building fiscal passport...'}
          </h2>
          {error && <p className="mt-4 text-sm text-[color:var(--accent-warn)]">{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-10">
      <div className="flex items-start gap-4 px-1">
        <div className="flex h-14 w-14 items-center justify-center rounded-[1.5rem] border border-[color:var(--border)] bg-white shadow-[0_18px_38px_-24px_rgba(26,24,20,0.35)]">
          <Files size={26} className="text-[color:var(--accent-gold)]" />
        </div>
        <div>
          <h1 className="font-display text-[3rem] font-extrabold tracking-[-0.06em] text-[color:var(--text-primary)] md:text-[3.5rem]">
            Tax Passport
          </h1>
          <p className="mt-2 text-sm font-medium text-[color:var(--text-secondary)]">
            Structured tax posture from transactions, outgoing invoices, and incoming document evidence.
          </p>
        </div>
      </div>

      {flagged.length > 0 && (
        <div className="flex items-start gap-3 rounded-[1.6rem] border border-[color:rgba(204,51,51,0.18)] bg-[color:rgba(204,51,51,0.08)] p-4 shadow-sm">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-[color:var(--accent-warn)]" />
          <div>
            <p className="text-sm font-bold text-[color:var(--text-primary)]">Manual review required</p>
            <p className="mt-1 text-xs font-medium leading-6 text-[color:var(--text-secondary)]">
              {flagged.length} passport entries carry low confidence or incomplete fields and need a quick operator review.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-5">
        {[
          ['Total income', data.metrics.total_income, 'text-[color:var(--accent-strong)]'],
          ['Deductible amount', data.metrics.deductible_amount, 'text-[color:var(--accent-strong)]'],
          ['GST exposure', data.metrics.gst_exposure, 'text-[#2565b5]'],
          ['TDS credit', data.metrics.tds_credit, 'text-[color:var(--accent-gold)]'],
          ['Review needed', data.metrics.review_needed, 'text-[color:var(--accent-warn)]'],
        ].map(([label, value, tone]) => (
          <div key={label} className="apple-card p-6">
            <p className="font-financial text-[10px] uppercase tracking-[0.22em] text-[color:var(--text-tertiary)]">
              {label}
            </p>
            <p className={`mt-4 text-[2rem] font-semibold tracking-[-0.05em] ${tone}`}>
              {typeof value === 'number' && label !== 'Review needed'
                ? `₹${Number(value).toLocaleString('en-IN')}`
                : value}
            </p>
          </div>
        ))}
      </div>

      <div>
        <p className="eyebrow px-1">Passport ledger</p>
        <div className="mt-4 space-y-3">
          {data.entries.map((entry) => (
            <div key={`${entry.source_type}-${entry.source_id}`} className="apple-card overflow-hidden">
              <button
                type="button"
                onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}
                className="flex w-full items-center gap-3 px-6 py-5 text-left transition hover:bg-[color:rgba(255,255,255,0.45)]"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full border border-[color:var(--border)] bg-[color:var(--surface-muted)]">
                  {expanded === entry.id ? <CheckCircle size={14} className="text-[color:var(--accent-strong)]" /> : <Tag size={14} className="text-[color:var(--text-secondary)]" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-base font-semibold text-[color:var(--text-primary)]">{entry.title}</p>
                  <p className="mt-1 text-xs text-[color:var(--text-secondary)]">
                    {entry.entry_date} · {entry.tax_type.replace(/_/g, ' ')} · Confidence {Math.round(Number(entry.confidence || 0) * 100)}%
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-[color:var(--text-primary)]">
                    ₹{Number(entry.amount || 0).toLocaleString('en-IN')}
                  </p>
                  <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-[color:var(--text-tertiary)]">
                    {entry.status}
                  </p>
                </div>
              </button>

              <div className="flex flex-wrap gap-2 px-6 pb-5">
                {entry.tags.map((tag) => (
                  <span
                    key={`${entry.id}-${tag}`}
                    className={`rounded-full bg-[color:rgba(26,24,20,0.06)] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${toneMap[tag] || 'text-[color:var(--text-primary)]'}`}
                  >
                    {tag}
                  </span>
                ))}
              </div>

              {expanded === entry.id && (
                <div className="grid gap-4 border-t border-[color:var(--border)] px-6 pb-6 pt-4 md:grid-cols-[1fr,0.9fr]">
                  <div className="rounded-[1.3rem] bg-[color:var(--surface-muted)] p-4">
                    <p className="font-financial text-[10px] uppercase tracking-[0.22em] text-[color:var(--text-tertiary)]">
                      Evidence summary
                    </p>
                    <p className="mt-3 text-sm leading-7 text-[color:var(--text-secondary)]">{entry.summary}</p>
                  </div>
                  <div className="grid gap-3">
                    <div className="rounded-[1.3rem] bg-[color:var(--surface-muted)] p-4">
                      <p className="font-financial text-[10px] uppercase tracking-[0.22em] text-[color:var(--text-tertiary)]">
                        Source link
                      </p>
                      <p className="mt-3 text-sm font-semibold text-[color:var(--text-primary)]">
                        {entry.source_type} #{entry.source_id}
                      </p>
                    </div>
                    {entry.document_hash && (
                      <div className="rounded-[1.3rem] bg-[color:var(--surface-muted)] p-4">
                        <p className="flex items-center gap-2 font-financial text-[10px] uppercase tracking-[0.22em] text-[color:var(--text-tertiary)]">
                          <Hash size={12} className="text-[color:var(--accent-gold)]" />
                          Document hash
                        </p>
                        <p className="mt-3 break-all text-xs leading-6 text-[color:var(--text-secondary)]">
                          {entry.document_hash}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
