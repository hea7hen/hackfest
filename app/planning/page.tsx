'use client';

import { useState, useMemo } from 'react';
import { Calendar, ChevronLeft, ChevronRight, AlertTriangle, CheckCircle, Clock, Calendar as CalendarIcon } from 'lucide-react';

interface FinancialEvent {
  id: string;
  title: string;
  date: Date;
  type: 'deadline' | 'reminder' | 'due' | 'audit';
  description: string;
  priority: 'high' | 'medium' | 'low';
  category: 'gst' | 'income_tax' | 'audit' | 'bills' | 'invoices';
}

function generateFinancialEvents(): FinancialEvent[] {
  const events: FinancialEvent[] = [];
  const now = new Date();
  const currentYear = now.getFullYear();

  // GST Filing Deadlines (Quarterly)
  const gstQuarters = [
    { name: 'Q1 (Apr-Jun)', month: 6, day: 31, label: 'Q1' },
    { name: 'Q2 (Jul-Sep)', month: 9, day: 31, label: 'Q2' },
    { name: 'Q3 (Oct-Dec)', month: 12, day: 31, label: 'Q3' },
    { name: 'Q4 (Jan-Mar)', month: 3, day: 31, label: 'Q4' },
  ];

  gstQuarters.forEach(quarter => {
    const deadlineYear = quarter.month <= 3 ? currentYear + 1 : currentYear;
    const deadline = new Date(deadlineYear, quarter.month - 1, quarter.day);

    events.push({
      id: `gst-${quarter.label}-${deadlineYear}`,
      title: `GST Return Filing - ${quarter.name}`,
      date: deadline,
      type: 'deadline',
      description: `Last date to file GST returns for ${quarter.name} quarter`,
      priority: 'high',
      category: 'gst',
    });

    // Reminder 7 days before
    const reminderDate = new Date(deadline);
    reminderDate.setDate(reminderDate.getDate() - 7);
    events.push({
      id: `gst-reminder-${quarter.label}-${deadlineYear}`,
      title: `GST Filing Reminder - ${quarter.name}`,
      date: reminderDate,
      type: 'reminder',
      description: `GST returns due in 7 days for ${quarter.name}`,
      priority: 'medium',
      category: 'gst',
    });
  });

  // Advance Tax Deadlines
  const advanceTaxDates = [
    { name: 'Q1 Advance Tax', month: 6, day: 15 },
    { name: 'Q2 Advance Tax', month: 9, day: 15 },
    { name: 'Q3 Advance Tax', month: 12, day: 15 },
    { name: 'Q4 Advance Tax', month: 3, day: 15 },
  ];

  advanceTaxDates.forEach(tax => {
    const deadlineYear = tax.month <= 3 ? currentYear + 1 : currentYear;
    const deadline = new Date(deadlineYear, tax.month - 1, tax.day);

    events.push({
      id: `advance-tax-${tax.month}-${deadlineYear}`,
      title: tax.name,
      date: deadline,
      type: 'deadline',
      description: `Advance tax payment deadline for quarter ending ${new Date(deadlineYear, tax.month - 1, tax.day).toLocaleDateString('en-IN', { month: 'long' })}`,
      priority: 'high',
      category: 'income_tax',
    });
  });

  // Income Tax Filing Deadline
  const incomeTaxDeadline = new Date(currentYear + 1, 6, 31); // July 31 next year
  events.push({
    id: `income-tax-${currentYear + 1}`,
    title: 'Income Tax Return Filing',
    date: incomeTaxDeadline,
    type: 'deadline',
    description: `Last date to file income tax return for FY ${currentYear}-${currentYear + 1}`,
    priority: 'high',
    category: 'income_tax',
  });

  // Audit Deadlines
  const auditDeadline = new Date(currentYear + 1, 8, 30); // September 30 next year
  events.push({
    id: `audit-${currentYear + 1}`,
    title: 'Tax Audit Deadline',
    date: auditDeadline,
    type: 'audit',
    description: `Last date for tax audit completion for FY ${currentYear}-${currentYear + 1}`,
    priority: 'high',
    category: 'audit',
  });

  // Monthly Bill Due Dates (estimated)
  const billTypes = [
    { name: 'Electricity Bill', day: 10 },
    { name: 'Internet Bill', day: 15 },
    { name: 'Mobile Bill', day: 20 },
    { name: 'Credit Card Payment', day: 25 },
  ];

  for (let month = 0; month < 6; month++) {
    const billDate = new Date(now.getFullYear(), now.getMonth() + month, 1);
    billTypes.forEach(bill => {
      const dueDate = new Date(billDate.getFullYear(), billDate.getMonth(), bill.day);
      events.push({
        id: `bill-${bill.name.toLowerCase().replace(' ', '-')}-${month}`,
        title: `${bill.name} Due`,
        date: dueDate,
        type: 'due',
        description: `Monthly ${bill.name.toLowerCase()} payment due`,
        priority: 'medium',
        category: 'bills',
      });
    });
  }

  // Invoice Submission Reminders (estimated)
  for (let month = 0; month < 3; month++) {
    const invoiceDate = new Date(now.getFullYear(), now.getMonth() + month, 28);
    events.push({
      id: `invoice-submission-${month}`,
      title: 'Invoice Submission Reminder',
      date: invoiceDate,
      type: 'reminder',
      description: `Time to submit pending invoices for the month`,
      priority: 'medium',
      category: 'invoices',
    });
  }

  return events.filter(event => event.date >= now);
}

function getEventIcon(type: string) {
  switch (type) {
    case 'deadline': return AlertTriangle;
    case 'reminder': return Clock;
    case 'due': return CalendarIcon;
    case 'audit': return CheckCircle;
    default: return CalendarIcon;
  }
}

function getEventColor(category: string) {
  switch (category) {
    case 'gst': return 'bg-blue-500';
    case 'income_tax': return 'bg-red-500';
    case 'audit': return 'bg-purple-500';
    case 'bills': return 'bg-orange-500';
    case 'invoices': return 'bg-green-500';
    default: return 'bg-gray-500';
  }
}

function getPriorityColor(priority: string) {
  switch (priority) {
    case 'high': return 'border-red-200 bg-red-50';
    case 'medium': return 'border-yellow-200 bg-yellow-50';
    case 'low': return 'border-green-200 bg-green-50';
    default: return 'border-gray-200 bg-gray-50';
  }
}

export default function PlanningPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [view, setView] = useState<'calendar' | 'list'>('calendar');

  const events = useMemo(() => generateFinancialEvents(), []);

  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();

  const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
  const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);
  const startDate = new Date(firstDayOfMonth);
  startDate.setDate(startDate.getDate() - firstDayOfMonth.getDay());

  const endDate = new Date(lastDayOfMonth);
  endDate.setDate(endDate.getDate() + (6 - lastDayOfMonth.getDay()));

  const calendarDays = [];
  let day = new Date(startDate);

  while (day <= endDate) {
    calendarDays.push(new Date(day));
    day.setDate(day.getDate() + 1);
  }

  const getEventsForDate = (date: Date) => {
    return events.filter(event =>
      event.date.toDateString() === date.toDateString()
    );
  };

  const upcomingEvents = events
    .filter(event => event.date >= new Date())
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, 10);

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(newDate.getMonth() - 1);
      } else {
        newDate.setMonth(newDate.getMonth() + 1);
      }
      return newDate;
    });
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">Financial Planning</h1>
          <p className="text-sm text-slate-500 mt-2 font-medium">
            Stay on top of all your financial deadlines and important dates
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setView('calendar')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              view === 'calendar'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Calendar View
          </button>
          <button
            onClick={() => setView('list')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              view === 'list'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            List View
          </button>
        </div>
      </div>

      {view === 'calendar' ? (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Calendar */}
          <div className="lg:col-span-3">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              {/* Calendar Header */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-slate-900">
                  {new Date(currentYear, currentMonth).toLocaleDateString('en-IN', {
                    month: 'long',
                    year: 'numeric'
                  })}
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => navigateMonth('prev')}
                    className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <button
                    onClick={() => navigateMonth('next')}
                    className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
                  >
                    <ChevronRight size={20} />
                  </button>
                </div>
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-1 mb-4">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="p-3 text-center text-sm font-bold text-slate-500">
                    {day}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((date, index) => {
                  const dayEvents = getEventsForDate(date);
                  const isCurrentMonth = date.getMonth() === currentMonth;
                  const isToday = date.toDateString() === new Date().toDateString();
                  const isSelected = selectedDate?.toDateString() === date.toDateString();

                  return (
                    <div
                      key={index}
                      onClick={() => setSelectedDate(date)}
                      className={`min-h-[100px] p-2 border cursor-pointer transition-all hover:bg-slate-50 ${
                        isCurrentMonth ? 'bg-white' : 'bg-slate-50 text-slate-400'
                      } ${isToday ? 'ring-2 ring-blue-500 ring-inset' : ''} ${
                        isSelected ? 'bg-blue-50 border-blue-300' : 'border-slate-200'
                      }`}
                    >
                      <div className="text-sm font-medium mb-1">
                        {date.getDate()}
                      </div>
                      <div className="space-y-1">
                        {dayEvents.slice(0, 2).map(event => {
                          const Icon = getEventIcon(event.type);
                          return (
                            <div
                              key={event.id}
                              className={`text-xs p-1 rounded flex items-center gap-1 ${getEventColor(event.category)} text-white`}
                              title={event.title}
                            >
                              <Icon size={10} />
                              <span className="truncate">{event.title.split(' ')[0]}</span>
                            </div>
                          );
                        })}
                        {dayEvents.length > 2 && (
                          <div className="text-xs text-slate-500">
                            +{dayEvents.length - 2} more
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Upcoming Events */}
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Upcoming Events</h3>
              <div className="space-y-3">
                {upcomingEvents.slice(0, 5).map(event => {
                  const Icon = getEventIcon(event.type);
                  return (
                    <div key={event.id} className="flex items-start gap-3 p-3 rounded-lg border border-slate-100">
                      <div className={`p-2 rounded-lg ${getEventColor(event.category)}`}>
                        <Icon size={16} className="text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">
                          {event.title}
                        </p>
                        <p className="text-xs text-slate-500">
                          {event.date.toLocaleDateString('en-IN')}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Legend */}
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Legend</h3>
              <div className="space-y-2">
                {[
                  { label: 'GST Deadlines', color: 'bg-blue-500', category: 'gst' },
                  { label: 'Income Tax', color: 'bg-red-500', category: 'income_tax' },
                  { label: 'Audit Dates', color: 'bg-purple-500', category: 'audit' },
                  { label: 'Bill Due Dates', color: 'bg-orange-500', category: 'bills' },
                  { label: 'Invoice Reminders', color: 'bg-green-500', category: 'invoices' },
                ].map(item => (
                  <div key={item.category} className="flex items-center gap-3">
                    <div className={`w-4 h-4 rounded ${item.color}`}></div>
                    <span className="text-sm text-slate-600">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* List View */
        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-bold text-slate-900 mb-6">All Financial Events</h2>
            <div className="space-y-4">
              {events.map(event => {
                const Icon = getEventIcon(event.type);
                return (
                  <div
                    key={event.id}
                    className={`p-4 rounded-xl border ${getPriorityColor(event.priority)}`}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`p-3 rounded-lg ${getEventColor(event.category)}`}>
                        <Icon size={20} className="text-white" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="text-lg font-bold text-slate-900">{event.title}</h3>
                            <p className="text-sm text-slate-600 mt-1">{event.description}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-slate-900">
                              {event.date.toLocaleDateString('en-IN', {
                                weekday: 'short',
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric'
                              })}
                            </p>
                            <p className="text-xs text-slate-500 mt-1">
                              {Math.ceil((event.date.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} days left
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 mt-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            event.priority === 'high' ? 'bg-red-100 text-red-700' :
                            event.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-green-100 text-green-700'
                          }`}>
                            {event.priority.toUpperCase()} PRIORITY
                          </span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            event.category === 'gst' ? 'bg-blue-100 text-blue-700' :
                            event.category === 'income_tax' ? 'bg-red-100 text-red-700' :
                            event.category === 'audit' ? 'bg-purple-100 text-purple-700' :
                            event.category === 'bills' ? 'bg-orange-100 text-orange-700' :
                            'bg-green-100 text-green-700'
                          }`}>
                            {event.category.replace('_', ' ').toUpperCase()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}