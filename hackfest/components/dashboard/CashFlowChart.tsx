'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { motion } from 'framer-motion';

interface CashFlowData {
  monthYear: string;
  income: number;
  expenses: number;
}

interface Props {
  data: CashFlowData[];
}

function formatMonth(monthYear: string) {
  const [year, month] = monthYear.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[parseInt(month) - 1]} '${year.slice(2)}`;
}

function formatCurrency(value: number) {
  if (value >= 100000) return `${(value / 100000).toFixed(1)}L`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toString();
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; dataKey: string }>; label?: string }) {
  if (!active || !payload) return null;
  return (
    <div
      className="rounded-xl px-4 py-3"
      style={{
        background: '#1E2A3A',
        border: '1px solid rgba(255,255,255,0.1)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      }}
    >
      <p className="text-xs mb-2" style={{ color: '#8899AA' }}>{label}</p>
      {payload.map((item) => (
        <div key={item.dataKey} className="flex items-center gap-2 mb-1">
          <div
            className="w-2 h-2 rounded-full"
            style={{ background: item.dataKey === 'income' ? '#3B82F6' : '#F43F5E' }}
          />
          <span className="text-xs" style={{ color: '#8899AA' }}>
            {item.dataKey === 'income' ? 'Income' : 'Expenses'}:
          </span>
          <span className="font-financial text-xs" style={{ color: '#F0F4FF' }}>
            {'\u20B9'}{item.value.toLocaleString('en-IN')}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function CashFlowChart({ data }: Props) {
  const chartData = data.map(d => ({
    ...d,
    name: formatMonth(d.monthYear),
  }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="rounded-2xl p-6"
      style={{
        background: '#131929',
        border: '1px solid rgba(255,255,255,0.06)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
      }}
    >
      <h3 className="text-sm font-medium mb-4" style={{ color: '#8899AA' }}>
        Cash Flow
      </h3>

      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={chartData} barGap={4}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
          <XAxis
            dataKey="name"
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#8899AA', fontSize: 11 }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#8899AA', fontSize: 11 }}
            tickFormatter={formatCurrency}
          />
          <Tooltip content={<CustomTooltip />} cursor={false} />
          <Legend
            wrapperStyle={{ paddingTop: 16, fontSize: 12, color: '#8899AA' }}
          />
          <Bar dataKey="income" fill="#3B82F6" radius={[4, 4, 0, 0]} maxBarSize={32} />
          <Bar dataKey="expenses" fill="#F43F5E" radius={[4, 4, 0, 0]} maxBarSize={32} />
        </BarChart>
      </ResponsiveContainer>
    </motion.div>
  );
}
