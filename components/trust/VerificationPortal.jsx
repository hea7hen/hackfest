'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Database,
  ExternalLink,
  Fingerprint,
  Hash,
  Key,
  Lock,
  ShieldAlert,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import { verifyDocument } from '@/lib/api/client';

const checklist = [
  'Recompute the incoming file hash',
  'Search anchored proof records',
  'Return hash verdict and semantic signal',
  'Surface signer, anchor time, and tamper notes',
];

export default function VerificationPortal() {
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(false);

  const handleVerify = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setVerifying(true);
    setResult(null);
    setError('');

    try {
      const response = await verifyDocument(file);
      setResult(response);
    } catch (err) {
      setError(err.message);
    } finally {
      setVerifying(false);
    }
  };

  const isVerified = Boolean(result?.verified);

  return (
    <div className="space-y-8 pb-16">
      <section className="grid gap-6 xl:grid-cols-[0.95fr,1.05fr]">
        <div className="apple-card p-8 md:p-10">
          <p className="eyebrow">Client-facing trust moment</p>
          <h1 className="mt-3 font-display text-[54px] leading-[0.92] tracking-[-0.05em] text-[var(--text-primary)] md:text-[64px]">
            Prove a record is original or catch tampering fast.
          </h1>
          <p className="mt-5 max-w-2xl text-[16px] leading-7 text-[var(--text-secondary)]">
            The strongest demo moment in this product is simple: re-upload the
            original file and it verifies; change the file and the trust layer
            rejects it. This screen makes that mechanic visible.
          </p>

          <div className="mt-8 space-y-3">
            {checklist.map((item, index) => (
              <div key={item} className="flex items-center gap-3 rounded-[22px] border border-[var(--border-primary)] bg-[var(--surface-muted)] px-4 py-4">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--surface-strong)] text-[11px] font-bold text-[var(--text-inverse)]">
                  {index + 1}
                </span>
                <p className="text-[13px] text-[var(--text-primary)]">{item}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="apple-card p-8 md:p-10">
          <p className="eyebrow">Run verification</p>
          <label className="mt-5 flex min-h-[320px] cursor-pointer flex-col items-center justify-center rounded-[30px] border border-dashed border-[var(--border-primary)] bg-[var(--surface-muted)] px-8 text-center transition-all hover:border-[var(--accent-strong)] hover:bg-[color:rgba(255,251,245,0.9)]">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[var(--surface-strong)] text-[var(--text-inverse)] shadow-[0_22px_48px_rgba(16,40,33,0.24)]">
              {verifying ? <Fingerprint className="h-8 w-8 animate-pulse" /> : <Upload className="h-8 w-8" />}
            </div>
            <h2 className="mt-6 font-display text-[40px] leading-none tracking-[-0.05em] text-[var(--text-primary)]">
              {verifying ? 'Verifying proof...' : 'Select a local file'}
            </h2>
            <p className="mt-4 max-w-md text-[14px] leading-6 text-[var(--text-secondary)]">
              Upload a PDF or CSV that should match an existing proof-backed
              record in the system.
            </p>
            <div className="apple-button mt-8">Start verification</div>
            <input type="file" className="hidden" onChange={handleVerify} accept=".pdf,.csv,.txt" />
          </label>

          {error && (
            <div className="mt-5 rounded-[22px] border border-[color:rgba(167,53,45,0.16)] bg-[color:rgba(167,53,45,0.08)] px-5 py-4 text-[13px] text-[var(--accent-danger)]">
              {error}
            </div>
          )}
        </div>
      </section>

      <AnimatePresence mode="wait">
        {verifying ? (
          <motion.section
            key="verifying"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="apple-card p-8 md:p-10"
          >
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--surface-strong)] text-[var(--text-inverse)]">
                <Fingerprint className="h-7 w-7 animate-pulse" />
              </div>
              <p className="mt-5 text-[12px] font-semibold uppercase tracking-[0.24em] text-[var(--accent-strong)]">
                Hash recomputation in progress
              </p>
              <h2 className="mt-3 font-display text-[40px] tracking-[-0.05em] text-[var(--text-primary)]">
                Checking the trust layer now
              </h2>
            </div>
          </motion.section>
        ) : result ? (
          <motion.section
            key="result"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="apple-card p-8 md:p-10"
          >
            <div className="grid gap-6 xl:grid-cols-[0.9fr,1.1fr]">
              <div
                className={[
                  'rounded-[28px] p-8',
                  isVerified
                    ? 'bg-[var(--surface-strong)] text-[var(--text-inverse)]'
                    : 'bg-[color:rgba(167,53,45,0.10)] text-[var(--text-primary)]',
                ].join(' ')}
              >
                <div className="flex items-center gap-4">
                  <div
                    className={[
                      'flex h-14 w-14 items-center justify-center rounded-2xl',
                      isVerified ? 'bg-[color:rgba(248,242,231,0.14)]' : 'bg-[color:rgba(167,53,45,0.14)]',
                    ].join(' ')}
                  >
                    {isVerified ? <ShieldCheck className="h-7 w-7" /> : <ShieldAlert className="h-7 w-7 text-[var(--accent-danger)]" />}
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] opacity-70">
                      Verification verdict
                    </p>
                    <h2 className="mt-2 font-display text-[44px] leading-none tracking-[-0.05em]">
                      {isVerified ? 'State Verified' : 'Integrity Failure'}
                    </h2>
                  </div>
                </div>
                <p className="mt-5 text-[15px] leading-7 opacity-88">{result.message}</p>

                <div className="mt-6 rounded-[20px] bg-[color:rgba(255,251,245,0.14)] p-4">
                  <p className="text-[11px] uppercase tracking-[0.22em] opacity-70">
                    Semantic review
                  </p>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <p className="text-[15px] font-semibold">{result.semantic_tamper_status || 'not_available'}</p>
                    {result.semantic_confidence != null && (
                      <p className="text-[12px] opacity-70">
                        Confidence {Math.round(result.semantic_confidence * 100)}%
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-[26px] border border-[var(--border-primary)] bg-[var(--surface-muted)] p-5">
                  <div className="flex items-center gap-2">
                    <Hash className="h-4 w-4 text-[var(--accent-strong)]" />
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-tertiary)]">
                      Document fingerprint
                    </p>
                  </div>
                  <code className="mt-3 block break-all text-[12px] leading-6 text-[var(--text-primary)]">
                    {result.document_hash}
                  </code>
                </div>

                {result.tamper_signals?.length > 0 && (
                  <div className="rounded-[26px] border border-[var(--border-primary)] bg-[var(--surface-muted)] p-5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-tertiary)]">
                      Tamper signals
                    </p>
                    <div className="mt-4 space-y-3">
                      {result.tamper_signals.map((signal, index) => (
                        <div key={`${signal.kind}-${index}`} className="rounded-[20px] bg-[var(--surface-elevated)] p-4">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-tertiary)]">
                            {signal.kind}
                          </p>
                          <p className="mt-2 text-[13px] leading-6 text-[var(--text-primary)]">
                            {signal.explanation}
                          </p>
                          {signal.excerpt && (
                            <p className="mt-2 break-all text-[12px] text-[var(--text-secondary)]">
                              {signal.excerpt}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {result.proof_record && (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-[22px] border border-[var(--border-primary)] bg-[var(--surface-muted)] p-5">
                      <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-tertiary)]">
                        <Database className="h-4 w-4 text-[var(--accent-strong)]" />
                        Anchor time
                      </p>
                      <p className="mt-3 text-[14px] leading-6 text-[var(--text-primary)]">
                        {new Date(result.proof_record.anchored_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="rounded-[22px] border border-[var(--border-primary)] bg-[var(--surface-muted)] p-5">
                      <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-tertiary)]">
                        <Key className="h-4 w-4 text-[var(--accent-strong)]" />
                        Signer
                      </p>
                      <p className="mt-3 break-all text-[14px] leading-6 text-[var(--text-primary)]">
                        {result.proof_record.signer || 'SYSTEM_GENESIS'}
                      </p>
                    </div>
                    <div className="rounded-[22px] border border-[var(--border-primary)] bg-[var(--surface-muted)] p-5 md:col-span-2">
                      <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-tertiary)]">
                        <ExternalLink className="h-4 w-4 text-[var(--accent-strong)]" />
                        Anchor reference
                      </p>
                      <p className="mt-3 break-all text-[14px] leading-6 text-[var(--text-primary)]">
                        {result.proof_record.tx_id}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.section>
        ) : (
          <motion.section
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="apple-card p-8 md:p-10"
          >
            <div className="flex flex-col items-center justify-center rounded-[28px] border border-dashed border-[var(--border-primary)] bg-[var(--surface-muted)] px-8 py-20 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--surface-strong)] text-[var(--text-inverse)]">
                <Lock className="h-6 w-6" />
              </div>
              <h2 className="mt-5 font-display text-[38px] tracking-[-0.05em] text-[var(--text-primary)]">
                Awaiting proof input
              </h2>
              <p className="mt-3 max-w-xl text-[14px] leading-6 text-[var(--text-secondary)]">
                Upload a file above to see the actual verification response from
                the backend, including hash status, semantic review, and proof metadata.
              </p>
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}
