'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowUpRight,
  CalendarDays,
  Files,
  Fingerprint,
  Receipt,
  ShieldCheck,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { getDashboard, getPlanningEvents, getTaxPassport } from '@/lib/api/client';

const currency = (value) =>
  `Rs ${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

export default function WorkspaceDashboard() {
  const [dashboard, setDashboard] = useState(null);
  const [planningEvents, setPlanningEvents] = useState([]);
  const [passport, setPassport] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([getDashboard(), getPlanningEvents(), getTaxPassport()])
      .then(([dashboardPayload, planningPayload, passportPayload]) => {
        setDashboard(dashboardPayload);
        setPlanningEvents(planningPayload);
        setPassport(passportPayload);
        setError('');
      })
      .catch((err) => setError(err.message));
  }, []);

  const nextEvents = useMemo(
    () =>
      [...planningEvents]
        .sort((a, b) => new Date(a.event_date) - new Date(b.event_date))
        .slice(0, 4),
    [planningEvents],
  );

  if (!dashboard || !passport) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="apple-card max-w-lg px-8 py-10 text-center">
          <p className="eyebrow text-[color:var(--accent-gold)]">Workspace boot</p>
          <h2 className="mt-4 font-display text-4xl tracking-tight text-[color:var(--text-primary)]">
            {error ? 'Could not load the finance workspace.' : 'Loading command surface...'}
          </h2>
          {error && (
            <p className="mt-4 text-sm leading-7 text-[color:var(--accent-warn)]">{error}</p>
          )}
        </div>
      </div>
    );
  }

  const {
    totals,
    health_score: healthScore,
    forecast,
    insights,
    recent_audit_events: auditEvents,
    outstanding_invoices: outstandingInvoices,
  } = dashboard;

  const netPosition = Number(totals.income || 0) - Number(totals.expense || 0);

  return (
    <div className="space-y-6 pb-10">
      <section className="grid gap-6 xl:grid-cols-[1.35fr,0.95fr]">
        <div className="apple-card paper-panel p-8 md:p-10">
          <p className="eyebrow text-[color:var(--accent-gold)]">Unified Ledger</p>
          <h2 className="mt-4 max-w-4xl font-display text-[3.3rem] leading-[0.92] tracking-[-0.06em] text-[color:var(--text-primary)] md:text-[4.6rem]">
            One workspace for invoices, trust, tax posture, and grounded answers.
          </h2>
          <p className="mt-5 max-w-2xl text-[15px] leading-7 text-[color:var(--text-secondary)]">
            This dashboard blends the strongest parts of the old finance product with
            the Hackfest shell: cash visibility, proof activity, tax status, and
            upcoming operational deadlines.
          </p>

          <div className="mt-10 grid gap-4 md:grid-cols-4">
            {[
              { label: 'Net position', value: currency(netPosition), tone: 'text-[color:var(--text-primary)]' },
              { label: 'Health score', value: `${healthScore.score}%`, tone: 'text-[color:var(--accent-strong)]' },
              { label: 'GST exposure', value: currency(passport.metrics.gst_exposure), tone: 'text-[color:var(--accent-gold)]' },
              { label: 'Review flags', value: String(passport.metrics.review_needed), tone: 'text-[color:var(--accent-warn)]' },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-[1.7rem] border border-[color:var(--border)] bg-white/75 p-5"
              >
                <p className="font-financial text-[10px] uppercase tracking-[0.22em] text-[color:var(--text-tertiary)]">
                  {stat.label}
                </p>
                <p className={`mt-3 text-[2rem] font-semibold tracking-[-0.05em] ${stat.tone}`}>
                  {stat.value}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-6">
          <div className="apple-card p-7">
            <div className="flex items-center justify-between">
              <div>
                <p className="eyebrow">Forecast</p>
                <h3 className="mt-3 font-display text-3xl tracking-tight">30-day velocity</h3>
              </div>
              <Activity size={28} className="text-[color:var(--accent-gold)]" />
            </div>
            <div className="mt-8 h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={forecast.series}>
                  <defs>
                    <linearGradient id="dashboardArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#a07010" stopOpacity={0.24} />
                      <stop offset="100%" stopColor="#a07010" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(26,24,20,0.08)" vertical={false} />
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#746f6a', fontSize: 11 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#746f6a', fontSize: 11 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                  <Tooltip
                    formatter={(value) => currency(value)}
                    contentStyle={{
                      borderRadius: '1rem',
                      border: '1px solid rgba(26,24,20,0.08)',
                      background: '#fffdf8',
                    }}
                  />
                  <Area dataKey="projected_balance" stroke="#a07010" strokeWidth={3} fill="url(#dashboardArea)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="apple-card bg-[color:var(--surface-strong)] p-7 text-[color:var(--text-inverse)]">
            <div className="flex items-center gap-3">
              <ShieldCheck size={28} className="text-[color:var(--accent-strong)]" />
              <div>
                <p className="eyebrow text-white/40">Trust layer</p>
                <h3 className="mt-2 font-display text-3xl tracking-tight">Recent proof activity</h3>
              </div>
            </div>
            <div className="mt-6 space-y-3">
              {auditEvents.slice(0, 3).map((event) => (
                <div key={event.id} className="rounded-[1.4rem] border border-white/10 bg-white/5 p-4">
                  <p className="text-sm font-semibold capitalize text-white/90">
                    {event.action.replace(/_/g, ' ')}
                  </p>
                  <p className="mt-1 text-xs text-white/55">
                    {event.entity_type} #{event.entity_id} · {new Date(event.timestamp).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.08fr,0.92fr]">
        <div className="apple-card p-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="eyebrow">Copilot-ready context</p>
              <h3 className="mt-3 font-display text-[2.2rem] tracking-[-0.05em]">
                What the workspace is surfacing now
              </h3>
            </div>
            <Files size={26} className="text-[color:var(--accent-gold)]" />
          </div>

          <div className="mt-7 grid gap-4">
            {insights.map((insight, index) => (
              <div
                key={`${insight.title}-${index}`}
                className="rounded-[1.6rem] border border-[color:var(--border)] bg-[color:var(--surface-muted)] p-5"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-lg font-semibold tracking-tight text-[color:var(--text-primary)]">
                    {insight.title}
                  </p>
                  <span className="font-financial text-[10px] uppercase tracking-[0.2em] text-[color:var(--accent-gold)]">
                    {insight.priority}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-7 text-[color:var(--text-secondary)]">
                  {insight.explanation}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-6">
          <div className="apple-card p-7">
            <div className="flex items-center gap-3">
              <CalendarDays size={26} className="text-[color:var(--accent-gold)]" />
              <div>
                <p className="eyebrow">Ops calendar</p>
                <h3 className="mt-2 font-display text-3xl tracking-tight">Upcoming deadlines</h3>
              </div>
            </div>
            <div className="mt-6 space-y-3">
              {nextEvents.map((event) => (
                <div
                  key={event.id}
                  className="rounded-[1.45rem] border border-[color:var(--border)] bg-[color:var(--surface-muted)] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[color:var(--text-primary)]">{event.title}</p>
                      <p className="mt-1 text-xs text-[color:var(--text-secondary)]">
                        {new Date(event.event_date).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })} · {event.origin.replace(/_/g, ' ')}
                      </p>
                    </div>
                    <span className="font-financial text-[10px] uppercase tracking-[0.2em] text-[color:var(--accent-gold)]">
                      {event.category}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="apple-card p-7">
            <div className="flex items-center gap-3">
              <Receipt size={26} className="text-[color:var(--accent-gold)]" />
              <div>
                <p className="eyebrow">Receivables</p>
                <h3 className="mt-2 font-display text-3xl tracking-tight">Outstanding invoices</h3>
              </div>
            </div>
            <div className="mt-6 space-y-3">
              {outstandingInvoices.slice(0, 4).map((invoice) => (
                <div
                  key={invoice.id}
                  className="rounded-[1.45rem] border border-[color:var(--border)] bg-[color:var(--surface-muted)] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[color:var(--text-primary)]">
                        {invoice.invoice_number}
                      </p>
                      <p className="mt-1 text-xs text-[color:var(--text-secondary)]">
                        {invoice.client_name} · due {invoice.due_date}
                      </p>
                    </div>
                    <p className="font-financial text-sm font-semibold text-[color:var(--accent-strong)]">
                      {currency(invoice.total_amount)}
                    </p>
                  </div>
                </div>
              ))}
              {!outstandingInvoices.length && (
                <div className="rounded-[1.45rem] border border-[color:var(--border)] bg-[color:var(--surface-muted)] p-4 text-sm text-[color:var(--text-secondary)]">
                  No open invoices yet. Create one in the invoice workspace.
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-3">
        {[
          {
            title: 'Tax passport entries',
            icon: Files,
            value: passport.entries.length,
            detail: 'Derived from transactions, invoices, extracted bills, and proof-backed artifacts.',
          },
          {
            title: 'Proof-backed events',
            icon: Fingerprint,
            value: auditEvents.length,
            detail: 'Audit and verification history remain visible to the operator.',
          },
          {
            title: 'Runway signal',
            icon: ArrowUpRight,
            value: currency(forecast.projected_30_day_balance),
            detail: forecast.warning || 'Projected from current ledger movement and outstanding receivables.',
          },
        ].map((item) => (
          <div key={item.title} className="apple-card p-7">
            <item.icon size={28} className="text-[color:var(--accent-gold)]" />
            <p className="mt-5 font-display text-[1.8rem] font-bold tracking-tight text-[color:var(--text-primary)]">
              {item.value}
            </p>
            <p className="mt-2 text-base font-semibold text-[color:var(--text-primary)]">{item.title}</p>
            <p className="mt-3 text-sm leading-7 text-[color:var(--text-secondary)]">{item.detail}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
