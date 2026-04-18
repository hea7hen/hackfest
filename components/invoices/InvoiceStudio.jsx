'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  CheckCircle2,
  FileCheck2,
  Receipt,
  Send,
  ShieldCheck,
} from 'lucide-react';
import { createInvoice, getInvoices, updateInvoiceStatus } from '@/lib/api/client';

const initialForm = {
  client_name: '',
  client_email: '',
  issue_date: new Date().toISOString().slice(0, 10),
  due_date: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
  subtotal: 25000,
  gst_percent: 18,
  notes: '',
};

const currency = (value) => `Rs ${Number(value || 0).toLocaleString('en-IN')}`;

const invoiceFlow = [
  'Capture client and tax details',
  'Generate invoice PDF on the backend',
  'Hash the generated document',
  'Create proof record and audit event',
  'Index the invoice for later retrieval',
];

export default function InvoiceStudio() {
  const [form, setForm] = useState(initialForm);
  const [invoices, setInvoices] = useState([]);
  const [created, setCreated] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const load = async () => {
    try {
      const items = await getInvoices();
      setInvoices(items);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    getInvoices()
      .then((items) => {
        setInvoices(items);
        setError('');
      })
      .catch((err) => setError(err.message));
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);

    try {
      const response = await createInvoice({
        ...form,
        subtotal: Number(form.subtotal),
        gst_percent: Number(form.gst_percent),
      });
      setCreated(response);
      setForm(initialForm);
      setError('');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const changeStatus = async (invoiceId, status) => {
    try {
      await updateInvoiceStatus(invoiceId, status);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-8 pb-16">
      <section className="grid gap-6 xl:grid-cols-[0.95fr,1.05fr]">
        <div className="apple-card p-8 md:p-10">
          <p className="eyebrow">Proof-backed billing</p>
          <h1 className="mt-3 font-display text-[54px] leading-[0.92] tracking-[-0.05em] text-[var(--text-primary)] md:text-[64px]">
            Every invoice becomes a financial artifact, not just a PDF.
          </h1>
          <p className="mt-5 max-w-2xl text-[16px] leading-7 text-[var(--text-secondary)]">
            This is where finance operations and the trust layer meet. When the
            user generates an invoice, the backend calculates GST, creates the
            PDF, hashes it, stores proof metadata, logs the event, and makes it
            retrievable for Finance Copilot later.
          </p>

          <div className="mt-8 space-y-3">
            {invoiceFlow.map((step, index) => (
              <div key={step} className="flex items-center gap-3 rounded-[22px] border border-[var(--border-primary)] bg-[var(--surface-muted)] px-4 py-4">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--surface-strong)] text-[11px] font-bold text-[var(--text-inverse)]">
                  {index + 1}
                </span>
                <p className="text-[13px] text-[var(--text-primary)]">{step}</p>
              </div>
            ))}
          </div>
        </div>

        <form onSubmit={submit} className="apple-card p-8 md:p-10">
          <p className="eyebrow">Issue a new invoice</p>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {[
              ['client_name', 'Client name', 'text'],
              ['client_email', 'Client email', 'email'],
              ['issue_date', 'Issue date', 'date'],
              ['due_date', 'Due date', 'date'],
              ['subtotal', 'Subtotal (INR)', 'number'],
              ['gst_percent', 'GST (%)', 'number'],
            ].map(([key, label, type]) => (
              <label key={key} className="block">
                <span className="mb-2 block text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
                  {label}
                </span>
                <input
                  type={type}
                  value={form[key]}
                  onChange={(event) => setForm({ ...form, [key]: event.target.value })}
                  className="w-full rounded-[18px] border border-[var(--border-primary)] bg-[var(--surface-muted)] px-4 py-3 text-[14px] text-[var(--text-primary)] outline-none transition-all focus:border-[var(--accent-strong)]"
                  required
                />
              </label>
            ))}
          </div>

          <label className="mt-4 block">
            <span className="mb-2 block text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
              Notes
            </span>
            <textarea
              value={form.notes}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
              className="min-h-[110px] w-full rounded-[18px] border border-[var(--border-primary)] bg-[var(--surface-muted)] px-4 py-3 text-[14px] text-[var(--text-primary)] outline-none transition-all focus:border-[var(--accent-strong)]"
            />
          </label>

          <button type="submit" disabled={loading} className="apple-button mt-6 w-full">
            {loading ? 'Generating proof-backed invoice...' : 'Generate trust invoice'}
          </button>

          {error && (
            <div className="mt-4 rounded-[20px] border border-[color:rgba(167,53,45,0.16)] bg-[color:rgba(167,53,45,0.08)] px-5 py-4 text-[13px] text-[var(--accent-danger)]">
              {error}
            </div>
          )}

          {created && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-5 rounded-[22px] bg-[var(--surface-strong)] p-5 text-[var(--text-inverse)]"
            >
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-5 w-5" />
                <p className="text-[15px] font-semibold">Proof record secured</p>
              </div>
              <p className="mt-3 text-[13px] opacity-80">Invoice reference {created.invoice_number}</p>
              <code className="mt-3 block break-all text-[12px] leading-6 opacity-88">{created.hash}</code>
            </motion.div>
          )}
        </form>
      </section>

      <section className="apple-card p-8 md:p-10">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="eyebrow">Issued invoice ledger</p>
            <h2 className="mt-3 font-display text-[42px] leading-none tracking-[-0.05em]">
              Proof-linked billing records
            </h2>
          </div>
          <div className="rounded-full border border-[var(--border-primary)] bg-[var(--surface-muted)] px-4 py-2 text-[12px] font-medium text-[var(--text-secondary)]">
            Payment state changes also create audit history
          </div>
        </div>

        <div className="mt-8 grid gap-4 xl:grid-cols-2">
          {invoices.map((invoice, idx) => (
            <motion.div
              key={invoice.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.04 }}
              className="rounded-[26px] border border-[var(--border-primary)] bg-[var(--surface-muted)] p-6"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--surface-strong)] text-[var(--text-inverse)]">
                    <Receipt className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-[18px] font-semibold text-[var(--text-primary)]">
                      {invoice.invoice_number}
                    </h3>
                    <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
                      {invoice.client_name} • Due {invoice.due_date}
                    </p>
                  </div>
                </div>

                <span
                  className={[
                    'rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em]',
                    invoice.status === 'paid'
                      ? 'bg-[color:rgba(13,95,80,0.14)] text-[var(--accent-strong)]'
                      : 'bg-[var(--surface-elevated)] text-[var(--text-secondary)]',
                  ].join(' ')}
                >
                  {invoice.status}
                </span>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div className="rounded-[20px] bg-[var(--surface-elevated)] p-4">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--text-tertiary)]">
                    Total
                  </p>
                  <p className="mt-2 text-[18px] font-semibold text-[var(--text-primary)]">
                    {currency(invoice.total_amount)}
                  </p>
                </div>
                <div className="rounded-[20px] bg-[var(--surface-elevated)] p-4">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--text-tertiary)]">
                    GST amount
                  </p>
                  <p className="mt-2 text-[18px] font-semibold text-[var(--text-primary)]">
                    {currency(invoice.gst_amount)}
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-[20px] bg-[var(--surface-elevated)] p-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--text-tertiary)]">
                  Hash preview
                </p>
                <p className="mt-2 break-all text-[12px] leading-6 text-[var(--text-secondary)]">
                  {invoice.hash}
                </p>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {invoice.status !== 'sent' && (
                  <button
                    onClick={() => changeStatus(invoice.id, 'sent')}
                    className="flex items-center gap-2 rounded-full border border-[var(--border-primary)] bg-[var(--surface-elevated)] px-4 py-2 text-[12px] font-semibold text-[var(--text-secondary)] transition-all hover:border-[var(--accent-strong)] hover:text-[var(--accent-strong)]"
                  >
                    <Send className="h-4 w-4" />
                    Mark sent
                  </button>
                )}
                {invoice.status !== 'paid' && (
                  <button
                    onClick={() => changeStatus(invoice.id, 'paid')}
                    className="flex items-center gap-2 rounded-full border border-[var(--border-primary)] bg-[var(--surface-elevated)] px-4 py-2 text-[12px] font-semibold text-[var(--text-secondary)] transition-all hover:border-[var(--accent-strong)] hover:text-[var(--accent-strong)]"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Mark paid
                  </button>
                )}
                <div className="ml-auto flex items-center gap-2 rounded-full bg-[var(--surface-strong)] px-4 py-2 text-[12px] font-semibold text-[var(--text-inverse)]">
                  <FileCheck2 className="h-4 w-4" />
                  Indexed for Copilot
                </div>
              </div>
            </motion.div>
          ))}

          {!invoices.length && (
            <div className="rounded-[28px] border border-dashed border-[var(--border-primary)] bg-[var(--surface-muted)] px-8 py-16 text-center text-[14px] text-[var(--text-secondary)] xl:col-span-2">
              No invoices have been created yet. Generate one above to see how
              billing feeds the trust and retrieval layers.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
