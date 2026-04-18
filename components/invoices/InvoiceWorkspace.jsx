'use client';

import { useEffect, useState } from 'react';
import { FileArrowUp, FilePdf, ShieldCheck, Tag } from '@phosphor-icons/react';
import { getIncomingInvoices, intakeInvoice } from '@/lib/api/client';
import InvoiceStudio from './InvoiceStudio';

const toneMap = {
  gst: 'bg-[color:rgba(37,101,181,0.12)] text-[#2565b5]',
  deductible: 'bg-[color:rgba(26,143,82,0.12)] text-[color:var(--accent-strong)]',
  'review-needed': 'bg-[color:rgba(204,51,51,0.12)] text-[color:var(--accent-warn)]',
  verified: 'bg-[color:rgba(160,112,16,0.12)] text-[color:var(--accent-gold)]',
};

function IncomingInvoicePanel() {
  const [rows, setRows] = useState([]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const load = () => {
    getIncomingInvoices()
      .then(setRows)
      .catch((err) => setError(err.message));
  };

  useEffect(() => {
    load();
  }, []);

  const handleUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const response = await intakeInvoice(file);
      setResult(response);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[0.92fr,1.08fr]">
        <div className="apple-card p-8 md:p-10">
          <p className="eyebrow">Incoming bills and invoices</p>
          <h2 className="mt-3 font-display text-[3rem] leading-[0.95] tracking-[-0.05em] text-[color:var(--text-primary)]">
            Extract structured fields from supplier documents, then turn them into tax-ready records.
          </h2>
          <p className="mt-5 text-[15px] leading-7 text-[color:var(--text-secondary)]">
            This is the `invoice2data`-style side of the workspace. Upload a PDF or image
            bill, capture vendor and invoice fields, assign passport tags, and keep the
            result grounded for Finance Copilot later.
          </p>
        </div>

        <div className="apple-card p-4">
          <label className="flex min-h-[330px] cursor-pointer flex-col items-center justify-center rounded-[1.8rem] border border-dashed border-[color:var(--border)] bg-[color:var(--surface-muted)] px-8 text-center transition hover:border-[color:rgba(160,112,16,0.32)] hover:bg-white">
            <div className="flex h-20 w-20 items-center justify-center rounded-[1.8rem] bg-[color:var(--surface-strong)] text-[color:var(--text-inverse)] shadow-[0_24px_40px_-26px_rgba(26,24,20,0.55)]">
              <FileArrowUp size={34} className={loading ? 'animate-pulse' : ''} />
            </div>
            <h3 className="mt-6 font-display text-[2.3rem] tracking-[-0.05em] text-[color:var(--text-primary)]">
              {loading ? 'Extracting invoice intelligence...' : 'Upload incoming invoice'}
            </h3>
            <p className="mt-4 max-w-md text-[14px] leading-6 text-[color:var(--text-secondary)]">
              Supports bill PDFs, invoice PDFs, and tax-heavy expense documents. Low-confidence
              results remain reviewable instead of failing silently.
            </p>
            <div className="apple-button mt-8">Select artifact</div>
            <input
              type="file"
              className="hidden"
              onChange={handleUpload}
              accept=".pdf,.png,.jpg,.jpeg,.webp"
            />
          </label>
        </div>
      </div>

      {error && (
        <div className="rounded-[1.6rem] border border-[color:rgba(204,51,51,0.22)] bg-[color:rgba(204,51,51,0.08)] px-5 py-4 text-sm text-[color:var(--accent-warn)]">
          {error}
        </div>
      )}

      {result?.extracted_invoice && (
        <div className="apple-card p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="eyebrow text-[color:var(--accent-gold)]">Latest extraction</p>
              <h3 className="mt-3 font-display text-[2.1rem] tracking-[-0.05em]">
                {result.extracted_invoice.vendor_name || result.extracted_invoice.file_name}
              </h3>
              <p className="mt-3 text-sm leading-7 text-[color:var(--text-secondary)]">
                Confidence {Math.round(Number(result.extracted_invoice.confidence || 0) * 100)}% ·
                {` ${result.document.document_type.replace(/_/g, ' ')}`}
              </p>
            </div>
            <ShieldCheck size={32} className="text-[color:var(--accent-strong)]" />
          </div>

          <div className="mt-7 grid gap-4 md:grid-cols-4">
            {[
              ['Invoice #', result.extracted_invoice.invoice_number || 'Not found'],
              ['Issue date', result.extracted_invoice.issue_date || 'Unknown'],
              ['Due date', result.extracted_invoice.due_date || 'Unknown'],
              ['Total', result.extracted_invoice.total_amount != null ? `Rs ${Number(result.extracted_invoice.total_amount).toLocaleString('en-IN')}` : 'Unknown'],
            ].map(([label, value]) => (
              <div key={label} className="rounded-[1.35rem] border border-[color:var(--border)] bg-[color:var(--surface-muted)] p-4">
                <p className="font-financial text-[10px] uppercase tracking-[0.22em] text-[color:var(--text-tertiary)]">
                  {label}
                </p>
                <p className="mt-3 text-sm font-semibold text-[color:var(--text-primary)]">{value}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {result.extracted_invoice.suggested_tags.map((tag) => (
              <span
                key={tag}
                className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-[11px] font-bold uppercase tracking-[0.16em] ${toneMap[tag] || 'bg-[color:rgba(26,24,20,0.08)] text-[color:var(--text-primary)]'}`}
              >
                <Tag size={12} />
                {tag}
              </span>
            ))}
          </div>

          {result.extracted_invoice.warnings.length > 0 && (
            <div className="mt-6 rounded-[1.35rem] border border-[color:rgba(204,51,51,0.22)] bg-[color:rgba(204,51,51,0.08)] p-4 text-sm leading-7 text-[color:var(--accent-warn)]">
              {result.extracted_invoice.warnings.join(' ')}
            </div>
          )}
        </div>
      )}

      <div className="apple-card overflow-hidden">
        <div className="border-b border-[color:var(--border)] px-8 py-6">
          <p className="eyebrow">Stored incoming artifacts</p>
          <h3 className="mt-3 font-display text-[2.1rem] tracking-[-0.05em]">Reviewable invoice extractions</h3>
        </div>
        <div className="grid gap-4 px-8 py-8">
          {rows.map((row) => (
            <div
              key={row.id}
              className="rounded-[1.5rem] border border-[color:var(--border)] bg-[color:var(--surface-muted)] p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3">
                    <FilePdf size={20} className="text-[color:var(--accent-gold)]" />
                    <p className="text-base font-semibold text-[color:var(--text-primary)]">
                      {row.vendor_name || row.file_name}
                    </p>
                  </div>
                  <p className="mt-2 text-sm text-[color:var(--text-secondary)]">
                    {row.invoice_number || 'No invoice number'} · {row.issue_date || 'Unknown date'} ·
                    {` ${row.currency || 'INR'}`}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-financial text-sm font-semibold text-[color:var(--accent-strong)]">
                    {row.total_amount != null ? `Rs ${Number(row.total_amount).toLocaleString('en-IN')}` : 'Pending total'}
                  </p>
                  <p className="mt-1 text-xs text-[color:var(--text-tertiary)]">
                    Confidence {Math.round(Number(row.confidence || 0) * 100)}%
                  </p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {row.suggested_tags.map((tag) => (
                  <span
                    key={`${row.id}-${tag}`}
                    className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${toneMap[tag] || 'bg-[color:rgba(26,24,20,0.08)] text-[color:var(--text-primary)]'}`}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ))}
          {!rows.length && (
            <div className="rounded-[1.5rem] border border-[color:var(--border)] bg-[color:var(--surface-muted)] p-5 text-sm text-[color:var(--text-secondary)]">
              No incoming invoice extractions yet. Upload one above to create the first record.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function InvoiceWorkspace() {
  const [tab, setTab] = useState('outgoing');

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-wrap gap-2">
        {[
          ['outgoing', 'Outgoing invoices'],
          ['incoming', 'Incoming bills / invoices'],
        ].map(([value, label]) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            className={`rounded-full px-5 py-3 text-xs font-bold uppercase tracking-[0.18em] transition ${
              tab === value
                ? 'bg-[color:var(--surface-strong)] text-[color:var(--text-inverse)]'
                : 'border border-[color:var(--border)] bg-white text-[color:var(--text-secondary)]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'outgoing' ? <InvoiceStudio /> : <IncomingInvoicePanel />}
    </div>
  );
}
