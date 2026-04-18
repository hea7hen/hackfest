'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Calendar, CheckCircle, ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { getPlanningEvents } from '@/lib/api/client';

function getEventColor(category) {
  switch (category) {
    case 'gst':
      return 'bg-[#2565b5]';
    case 'income_tax':
      return 'bg-[color:var(--accent-warn)]';
    case 'audit':
      return 'bg-[color:var(--accent-gold)]';
    case 'bills':
      return 'bg-[color:var(--accent-strong)]';
    case 'invoices':
      return 'bg-[color:var(--surface-strong)]';
    default:
      return 'bg-slate-400';
  }
}

function getEventIcon(category) {
  switch (category) {
    case 'audit':
      return CheckCircle;
    case 'gst':
    case 'income_tax':
      return AlertTriangle;
    default:
      return Clock;
  }
}

export default function OpsCalendar() {
  const [events, setEvents] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [view, setView] = useState('calendar');
  const [error, setError] = useState('');

  useEffect(() => {
    getPlanningEvents()
      .then((payload) => {
        setEvents(payload);
        setError('');
      })
      .catch((err) => setError(err.message));
  }, []);

  const parsedEvents = useMemo(
    () =>
      events.map((event) => ({
        ...event,
        date: new Date(event.event_date),
      })),
    [events],
  );

  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
  const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);
  const startDate = new Date(firstDayOfMonth);
  startDate.setDate(startDate.getDate() - firstDayOfMonth.getDay());
  const endDate = new Date(lastDayOfMonth);
  endDate.setDate(endDate.getDate() + (6 - lastDayOfMonth.getDay()));

  const calendarDays = [];
  const cursor = new Date(startDate);
  while (cursor <= endDate) {
    calendarDays.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  const upcomingEvents = [...parsedEvents]
    .filter((event) => event.date >= new Date())
    .sort((a, b) => a.date - b.date)
    .slice(0, 10);

  const getEventsForDate = (date) =>
    parsedEvents.filter((event) => event.date.toDateString() === date.toDateString());

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="eyebrow text-[color:var(--accent-gold)]">Unified deadlines</p>
          <h1 className="mt-3 font-display text-[3rem] tracking-[-0.06em] text-[color:var(--text-primary)] md:text-[3.6rem]">
            Operations Calendar
          </h1>
          <p className="mt-3 text-sm leading-7 text-[color:var(--text-secondary)]">
            Tax rules, vendor bill reminders, invoice due dates, filing tasks, and audit milestones now live in one calendar.
          </p>
          {error && <p className="mt-2 text-sm text-[color:var(--accent-warn)]">{error}</p>}
        </div>
        <div className="flex gap-2">
          {['calendar', 'list'].map((mode) => (
            <button
              key={mode}
              onClick={() => setView(mode)}
              className={`rounded-full px-4 py-3 text-xs font-bold uppercase tracking-[0.16em] ${
                view === mode
                  ? 'bg-[color:var(--surface-strong)] text-[color:var(--text-inverse)]'
                  : 'border border-[color:var(--border)] bg-white text-[color:var(--text-secondary)]'
              }`}
            >
              {mode} view
            </button>
          ))}
        </div>
      </div>

      {view === 'calendar' ? (
        <div className="grid gap-8 xl:grid-cols-[1.15fr,0.85fr]">
          <div className="apple-card p-6">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="font-display text-[2rem] tracking-[-0.05em] text-[color:var(--text-primary)]">
                {new Date(currentYear, currentMonth).toLocaleDateString('en-IN', {
                  month: 'long',
                  year: 'numeric',
                })}
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentDate(new Date(currentYear, currentMonth - 1, 1))}
                  className="rounded-full border border-[color:var(--border)] bg-white p-2"
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  onClick={() => setCurrentDate(new Date(currentYear, currentMonth + 1, 1))}
                  className="rounded-full border border-[color:var(--border)] bg-white p-2"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div key={day} className="pb-3 text-center font-financial text-[11px] uppercase tracking-[0.22em] text-[color:var(--text-tertiary)]">
                  {day}
                </div>
              ))}

              {calendarDays.map((date) => {
                const dayEvents = getEventsForDate(date);
                const isCurrentMonth = date.getMonth() === currentMonth;
                const isSelected = selectedDate?.toDateString() === date.toDateString();
                return (
                  <button
                    key={date.toISOString()}
                    type="button"
                    onClick={() => setSelectedDate(date)}
                    className={`min-h-[112px] rounded-[1.35rem] border p-3 text-left align-top transition ${
                      isSelected
                        ? 'border-[color:rgba(160,112,16,0.28)] bg-[color:rgba(160,112,16,0.08)]'
                        : 'border-[color:var(--border)] bg-white hover:bg-[color:var(--surface-muted)]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className={`text-sm font-semibold ${isCurrentMonth ? 'text-[color:var(--text-primary)]' : 'text-[color:var(--text-tertiary)]'}`}>
                        {date.getDate()}
                      </span>
                      {dayEvents.length > 0 && (
                        <span className="rounded-full bg-[color:var(--surface-strong)] px-2 py-1 font-financial text-[10px] uppercase tracking-[0.2em] text-[color:var(--text-inverse)]">
                          {dayEvents.length}
                        </span>
                      )}
                    </div>
                    <div className="mt-4 space-y-2">
                      {dayEvents.slice(0, 2).map((event) => (
                        <div key={event.id} className="flex items-center gap-2">
                          <span className={`h-2 w-2 rounded-full ${getEventColor(event.category)}`} />
                          <span className="line-clamp-1 text-xs font-medium text-[color:var(--text-secondary)]">
                            {event.title}
                          </span>
                        </div>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-6">
            <div className="apple-card p-6">
              <div className="flex items-center gap-3">
                <Calendar size={22} className="text-[color:var(--accent-gold)]" />
                <div>
                  <p className="eyebrow">Selected day</p>
                  <h3 className="mt-2 font-display text-[1.7rem] tracking-[-0.05em]">
                    {selectedDate ? selectedDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Pick a day'}
                  </h3>
                </div>
              </div>
              <div className="mt-5 space-y-3">
                {(selectedDate ? getEventsForDate(selectedDate) : upcomingEvents.slice(0, 4)).map((event) => {
                  const Icon = getEventIcon(event.category);
                  return (
                    <div key={event.id} className="rounded-[1.3rem] border border-[color:var(--border)] bg-[color:var(--surface-muted)] p-4">
                      <div className="flex items-start gap-3">
                        <Icon size={18} className="mt-0.5 text-[color:var(--accent-gold)]" />
                        <div>
                          <p className="text-sm font-semibold text-[color:var(--text-primary)]">{event.title}</p>
                          <p className="mt-1 text-xs leading-6 text-[color:var(--text-secondary)]">{event.description}</p>
                          <p className="mt-2 font-financial text-[10px] uppercase tracking-[0.2em] text-[color:var(--text-tertiary)]">
                            {event.origin.replace(/_/g, ' ')} · {event.source_type}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="apple-card p-6">
              <p className="eyebrow">Event origins</p>
              <div className="mt-5 grid gap-3">
                {[
                  ['Tax rules', 'Deterministic filing and audit dates'],
                  ['Invoices', 'Outgoing due dates and collection reminders'],
                  ['Bills', 'Incoming payment obligations'],
                  ['Manual state', 'Stored workspace reminders and follow-ups'],
                ].map(([title, body]) => (
                  <div key={title} className="rounded-[1.25rem] border border-[color:var(--border)] bg-[color:var(--surface-muted)] p-4">
                    <p className="text-sm font-semibold text-[color:var(--text-primary)]">{title}</p>
                    <p className="mt-2 text-xs leading-6 text-[color:var(--text-secondary)]">{body}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="apple-card overflow-hidden">
          <div className="border-b border-[color:var(--border)] px-8 py-6">
            <p className="eyebrow">List mode</p>
            <h2 className="mt-3 font-display text-[2.1rem] tracking-[-0.05em]">All upcoming events</h2>
          </div>
          <div className="grid gap-4 px-8 py-8">
            {upcomingEvents.map((event) => (
              <div key={event.id} className="rounded-[1.4rem] border border-[color:var(--border)] bg-[color:var(--surface-muted)] p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-base font-semibold text-[color:var(--text-primary)]">{event.title}</p>
                    <p className="mt-2 text-sm leading-7 text-[color:var(--text-secondary)]">{event.description}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-financial text-[10px] uppercase tracking-[0.22em] text-[color:var(--text-tertiary)]">
                      {new Date(event.event_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                    <p className="mt-2 text-xs text-[color:var(--accent-gold)]">
                      {event.origin.replace(/_/g, ' ')} · {event.category}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
