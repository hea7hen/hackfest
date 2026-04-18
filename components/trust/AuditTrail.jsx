'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Clock3,
  Fingerprint,
  ShieldCheck,
  Waypoints,
} from 'lucide-react';
import { BACKEND_BASE_URL, getAuditEvents, getProofs } from '@/lib/api/client';

const whyItMatters = [
  'Uploads create visible event records instead of silent background parsing.',
  'Invoices and proofs remain traceable to a specific action and timestamp.',
  'Verification becomes explainable because the trust layer is inspectable.',
];

export default function AuditTrail() {
  const [events, setEvents] = useState([]);
  const [proofs, setProofs] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    Promise.allSettled([getAuditEvents(), getProofs()])
      .then(([auditEventsResult, proofRecordsResult]) => {
        if (!active) return;

        setEvents(auditEventsResult.status === 'fulfilled' ? auditEventsResult.value : []);
        setProofs(proofRecordsResult.status === 'fulfilled' ? proofRecordsResult.value : []);

        const failures = [auditEventsResult, proofRecordsResult]
          .filter((result) => result.status === 'rejected')
          .map((result) => result.reason?.message || 'Failed to load audit data.');

        setError(failures[0] || '');
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex h-[78vh] items-center justify-center">
        <div className="rounded-full border border-[var(--border-primary)] bg-[var(--surface-elevated)] px-5 py-3 text-[14px] font-medium text-[var(--text-secondary)]">
          Loading audit history...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-16">
      {error && (
        <section className="rounded-[24px] border border-[color:rgba(167,53,45,0.16)] bg-[color:rgba(167,53,45,0.08)] px-5 py-4 text-[13px] leading-6 text-[var(--text-primary)]">
          <p className="font-semibold uppercase tracking-[0.18em] text-[var(--accent-warn)]">
            Audit backend warning
          </p>
          <p className="mt-2">
            {error}
          </p>
          <p className="mt-1 text-[var(--text-secondary)]">
            The audit page can still render any data that did load. Expected backend base URL: {BACKEND_BASE_URL}
          </p>
        </section>
      )}

      <section className="grid gap-6 xl:grid-cols-[0.92fr,1.08fr]">
        <div className="apple-card p-8 md:p-10">
          <p className="eyebrow">Visible governance</p>
          <h1 className="mt-3 font-display text-[54px] leading-[0.92] tracking-[-0.05em] text-[var(--text-primary)] md:text-[64px]">
            Nothing important happens silently.
          </h1>
          <p className="mt-5 max-w-2xl text-[16px] leading-7 text-[var(--text-secondary)]">
            The audit trail is where the product proves it is not just a pretty
            dashboard. Every important system action leaves a readable event,
            and every proof-backed artifact can be inspected here.
          </p>

          <div className="mt-8 space-y-3">
            {whyItMatters.map((point) => (
              <div key={point} className="rounded-[22px] border border-[var(--border-primary)] bg-[var(--surface-muted)] px-4 py-4 text-[13px] leading-6 text-[var(--text-primary)]">
                {point}
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="apple-card p-6">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-[0.22em] text-[var(--text-tertiary)]">
                Audit events
              </span>
              <Clock3 className="h-4 w-4 text-[var(--accent-strong)]" />
            </div>
            <p className="mt-5 text-[34px] font-semibold tracking-[-0.05em] text-[var(--text-primary)]">
              {events.length}
            </p>
          </div>

          <div className="apple-card p-6">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-[0.22em] text-[var(--text-tertiary)]">
                Proof records
              </span>
              <ShieldCheck className="h-4 w-4 text-[var(--accent-strong)]" />
            </div>
            <p className="mt-5 text-[34px] font-semibold tracking-[-0.05em] text-[var(--text-primary)]">
              {proofs.length}
            </p>
          </div>

          <div className="apple-card p-6">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-[0.22em] text-[var(--text-tertiary)]">
                Verified proofs
              </span>
              <Fingerprint className="h-4 w-4 text-[var(--accent-strong)]" />
            </div>
            <p className="mt-5 text-[34px] font-semibold tracking-[-0.05em] text-[var(--text-primary)]">
              {proofs.filter((proof) => proof.verification_status === 'verified').length}
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.08fr,0.92fr]">
        <div className="apple-card p-8 md:p-10">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="eyebrow">Timeline</p>
              <h2 className="mt-3 font-display text-[42px] leading-none tracking-[-0.05em]">
                Financial and trust activity
              </h2>
            </div>
            <div className="rounded-full border border-[var(--border-primary)] bg-[var(--surface-muted)] px-4 py-2 text-[12px] font-medium text-[var(--text-secondary)]">
              Readable system history for demos and reviews
            </div>
          </div>

          <div className="mt-8 space-y-4">
            {events.map((event, idx) => (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.03 }}
                className="grid gap-4 rounded-[24px] border border-[var(--border-primary)] bg-[var(--surface-muted)] p-5 lg:grid-cols-[150px,1fr,1.2fr]"
              >
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-tertiary)]">
                    Event
                  </p>
                  <p className="mt-2 text-[14px] font-semibold capitalize text-[var(--text-primary)]">
                    {event.action.replace(/_/g, ' ')}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-tertiary)]">
                    Entity
                  </p>
                  <p className="mt-2 text-[14px] text-[var(--text-primary)]">
                    {event.entity_type} #{event.entity_id}
                  </p>
                  <p className="mt-1 text-[12px] text-[var(--text-secondary)]">
                    {new Date(event.timestamp).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-tertiary)]">
                    Metadata
                  </p>
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    {Object.entries(event.metadata_json).slice(0, 4).map(([key, value]) => (
                      <div key={key} className="rounded-[18px] bg-[var(--surface-elevated)] px-3 py-3">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
                          {key}
                        </p>
                        <p className="mt-2 break-all text-[12px] leading-5 text-[var(--text-primary)]">
                          {JSON.stringify(value)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="apple-card p-8">
            <p className="eyebrow">Proof ledger</p>
            <h2 className="mt-3 font-display text-[42px] leading-none tracking-[-0.05em]">
              Anchored records
            </h2>

            <div className="mt-8 space-y-4">
              {proofs.map((proof, idx) => (
                <motion.div
                  key={proof.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.04 }}
                  className="rounded-[24px] border border-[var(--border-primary)] bg-[var(--surface-muted)] p-5"
                >
                  <div className="flex items-center justify-between gap-4">
                    <span className="rounded-full bg-[var(--surface-elevated)] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--text-secondary)]">
                      PR-{proof.id}
                    </span>
                    <span className="rounded-full bg-[color:rgba(13,95,80,0.14)] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
                      {proof.verification_status}
                    </span>
                  </div>

                  <div className="mt-4 rounded-[20px] bg-[var(--surface-elevated)] p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-tertiary)]">
                      SHA-256
                    </p>
                    <p className="mt-2 break-all text-[12px] leading-6 text-[var(--text-secondary)]">
                      {proof.document_hash}
                    </p>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="rounded-[18px] bg-[var(--surface-elevated)] p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-tertiary)]">
                        Anchor type
                      </p>
                      <p className="mt-2 text-[13px] text-[var(--text-primary)]">{proof.anchor_type}</p>
                    </div>
                    <div className="rounded-[18px] bg-[var(--surface-elevated)] p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-tertiary)]">
                        Reference
                      </p>
                      <p className="mt-2 break-all text-[13px] text-[var(--text-primary)]">{proof.tx_id}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          <div className="apple-card p-8">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--surface-strong)] text-[var(--text-inverse)]">
                <Waypoints className="h-5 w-5" />
              </div>
              <div>
                <p className="eyebrow">Why this matters</p>
                <h3 className="mt-2 text-[18px] font-semibold text-[var(--text-primary)]">
                  Trust is testable here
                </h3>
              </div>
            </div>
            <p className="mt-5 text-[14px] leading-7 text-[var(--text-secondary)]">
              The differentiator is not only that you have financial data. It is
              that the app can show when a document entered the system, which
              hash it received, what proof record was produced, and how later
              verification relates back to that chain.
            </p>
            <button className="mt-6 flex items-center gap-2 text-[13px] font-semibold text-[var(--accent-strong)]">
              Explore how proofs support verification
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
