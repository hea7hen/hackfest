'use client';

import React, { useEffect, useState } from 'react';
import { BadgeCheck, BriefcaseBusiness, ShieldCheck, UserRoundCog } from 'lucide-react';
import { getProfile, updateProfile } from '@/lib/api/client';

const initialForm = {
  name: '',
  email: '',
  profession: '',
  gst_registered: true,
  preferred_currency: 'INR',
  wallet_address: '',
};

const personaNotes = [
  {
    title: 'Freelance developers',
    body: 'Need client-level visibility, invoice proof, and confidence when sharing records with finance teams.',
  },
  {
    title: 'Designers and consultants',
    body: 'Need simple GST-ready invoicing and a way to explain their financial position without digging through folders.',
  },
  {
    title: 'Small agencies',
    body: 'Need an operating cockpit that combines money movement, audit history, and document authenticity.',
  },
];

export default function Onboarding({ refreshToken = 0, onDataChange = () => {} } = {}) {
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    getProfile()
      .then((profile) => {
        if (!profile) {
          setForm(initialForm);
          setError('');
          return;
        }

        setForm({
          name: profile.name || '',
          email: profile.email || '',
          profession: profile.profession || '',
          gst_registered: Boolean(profile.gst_registered),
          preferred_currency: profile.preferred_currency || 'INR',
          wallet_address: profile.wallet_address || '',
        });
        setError('');
      })
      .catch((err) => {
        setError(err.message);
      });
  }, [refreshToken]);

  const submit = async (event) => {
    event.preventDefault();
    try {
      const saved = await updateProfile(form);
      setMessage(`Saved workspace profile for ${saved.name}.`);
      setError('');
      onDataChange();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-8 pb-16">
      <section className="grid gap-6 xl:grid-cols-[0.92fr,1.08fr]">
        <div className="apple-card p-8 md:p-10">
          <p className="eyebrow">Who this plan is intended for</p>
          <h1 className="mt-3 font-display text-[54px] leading-[0.92] tracking-[-0.05em] text-[var(--text-primary)] md:text-[64px]">
            Make the operator behind the workspace explicit.
          </h1>
          <p className="mt-5 max-w-2xl text-[16px] leading-7 text-[var(--text-secondary)]">
            You asked for the frontend to show who the idea was intended for,
            not just hide that context in a report. This screen makes that
            audience visible and ties it to the actual workspace profile.
          </p>

          <div className="mt-8 space-y-4">
            {personaNotes.map((note) => (
              <div key={note.title} className="rounded-[24px] border border-[var(--border-primary)] bg-[var(--surface-muted)] p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--surface-strong)] text-[var(--text-inverse)]">
                    <BriefcaseBusiness className="h-4 w-4" />
                  </div>
                  <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">{note.title}</h3>
                </div>
                <p className="mt-3 text-[13px] leading-6 text-[var(--text-secondary)]">{note.body}</p>
              </div>
            ))}
          </div>
        </div>

        <form onSubmit={submit} className="apple-card p-8 md:p-10">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--surface-strong)] text-[var(--text-inverse)]">
              <UserRoundCog className="h-5 w-5" />
            </div>
            <div>
              <p className="eyebrow">Workspace profile</p>
              <h2 className="mt-2 text-[20px] font-semibold text-[var(--text-primary)]">
                Identity and operating context
              </h2>
            </div>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {[
              ['name', 'Name'],
              ['email', 'Email'],
              ['profession', 'Profession or service line'],
              ['preferred_currency', 'Preferred currency'],
              ['wallet_address', 'Wallet address'],
            ].map(([key, label]) => (
              <label key={key} className={key === 'wallet_address' ? 'md:col-span-2' : ''}>
                <span className="mb-2 block text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
                  {label}
                </span>
                <input
                  value={form[key]}
                  onChange={(event) => setForm({ ...form, [key]: event.target.value })}
                  className="w-full rounded-[18px] border border-[var(--border-primary)] bg-[var(--surface-muted)] px-4 py-3 text-[14px] text-[var(--text-primary)] outline-none transition-all focus:border-[var(--accent-strong)]"
                />
              </label>
            ))}
          </div>

          <label className="mt-4 flex items-center gap-3 rounded-[18px] border border-[var(--border-primary)] bg-[var(--surface-muted)] px-4 py-4 text-[14px] text-[var(--text-primary)]">
            <input
              type="checkbox"
              checked={form.gst_registered}
              onChange={(event) => setForm({ ...form, gst_registered: event.target.checked })}
            />
            GST registered
          </label>

          <button className="apple-button mt-6 w-full">Save workspace intent</button>

          {error && (
            <div className="mt-4 rounded-[20px] border border-[color:rgba(167,53,45,0.16)] bg-[color:rgba(167,53,45,0.08)] px-5 py-4 text-[13px] text-[var(--accent-danger)]">
              {error}
            </div>
          )}

          {message && (
            <div className="mt-4 rounded-[20px] bg-[var(--surface-strong)] px-5 py-4 text-[13px] text-[var(--text-inverse)]">
              {message}
            </div>
          )}
        </form>
      </section>

      <section className="grid gap-6 md:grid-cols-3">
        <div className="apple-card p-6">
          <ShieldCheck className="h-5 w-5 text-[var(--accent-strong)]" />
          <h3 className="mt-4 text-[18px] font-semibold text-[var(--text-primary)]">
            Identity matters to trust
          </h3>
          <p className="mt-3 text-[14px] leading-7 text-[var(--text-secondary)]">
            A signer wallet or named operator gives proof-backed artifacts a
            visible owner in the audit trail.
          </p>
        </div>

        <div className="apple-card p-6">
          <BadgeCheck className="h-5 w-5 text-[var(--accent-strong)]" />
          <h3 className="mt-4 text-[18px] font-semibold text-[var(--text-primary)]">
            GST changes recommendations
          </h3>
          <p className="mt-3 text-[14px] leading-7 text-[var(--text-secondary)]">
            Invoice defaults, compliance warnings, and summaries become more
            accurate when the workspace tax posture is explicit.
          </p>
        </div>

        <div className="apple-card p-6">
          <BriefcaseBusiness className="h-5 w-5 text-[var(--accent-strong)]" />
          <h3 className="mt-4 text-[18px] font-semibold text-[var(--text-primary)]">
            Persona shapes the product
          </h3>
          <p className="mt-3 text-[14px] leading-7 text-[var(--text-secondary)]">
            This keeps the UI grounded in the intended audience instead of
            drifting into generic consumer-finance styling.
          </p>
        </div>
      </section>
    </div>
  );
}
