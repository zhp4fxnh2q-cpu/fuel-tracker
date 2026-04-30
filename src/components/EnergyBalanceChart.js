/**
 * EnergyBalanceChart — last 30 days of daily kcal intake (bars) plus a
 * horizontal TDEE reference line. Adherence-neutral: bars are FUEL green,
 * stay green when over.
 */
import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, ReferenceLine, CartesianGrid } from 'recharts';

export default function EnergyBalanceChart({ days, tdee }) {
  const data = useMemo(() => (days || []).map((d) => ({
    label: new Date(d.date + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    kcal: d.kcal,
  })), [days]);

  if (!data.length) return <div className="empty">Log food for a few days to see your energy balance trend.</div>;

  const maxK = Math.max(...data.map((d) => d.kcal), tdee || 0);
  return (
    <div className="fuel-card" style={{ padding: '12px 8px 4px 0' }}>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey="label" tick={{ fill: 'var(--text-tertiary)', fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={28} />
          <YAxis domain={[0, Math.ceil(maxK / 500) * 500]} tick={{ fill: 'var(--text-tertiary)', fontSize: 10 }} axisLine={false} tickLine={false} width={36} />
          <Tooltip
            contentStyle={{ background: 'var(--bg-elev-2)', border: '1px solid var(--card-border)', borderRadius: 10, fontSize: 12, color: 'var(--text-primary)' }}
            formatter={(v) => [`${Number(v).toLocaleString()} kcal`, 'Intake']}
          />
          {tdee > 0 && (
            <ReferenceLine y={tdee} stroke="rgba(110, 231, 183, 0.7)" strokeDasharray="4 4" label={{ value: `TDEE ${tdee}`, fill: 'var(--accent-bright)', fontSize: 10, position: 'right' }} />
          )}
          <Bar dataKey="kcal" fill="rgba(52, 211, 153, 0.55)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
