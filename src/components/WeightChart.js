/**
 * WeightChart — 90-day chart of raw weight (dots) + EWMA trend (line).
 * Adherence-neutral: continuous line in FUEL green, no red zones.
 */
import React, { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, ReferenceLine, CartesianGrid } from 'recharts';

export default function WeightChart({ entries, goalWeight }) {
  const data = useMemo(() => {
    return (entries || []).map((e) => ({
      date: e.date,
      raw: e.weight_lbs,
      trended: e.trended_lbs,
      label: new Date(e.date + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    }));
  }, [entries]);

  if (data.length === 0) {
    return <div className="empty">Log a weight to start the trend line.</div>;
  }

  const minRaw = Math.min(...data.map((d) => d.raw));
  const maxRaw = Math.max(...data.map((d) => d.raw));
  const pad = Math.max(2, (maxRaw - minRaw) * 0.15);
  const yDomain = [Math.floor(minRaw - pad), Math.ceil(maxRaw + pad)];

  return (
    <div className="fuel-card" style={{ padding: '12px 8px 4px 0' }}>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis
            dataKey="label"
            tick={{ fill: 'var(--text-tertiary)', fontSize: 10 }}
            axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
            tickLine={false}
            interval="preserveStartEnd"
            minTickGap={28}
          />
          <YAxis
            domain={yDomain}
            tick={{ fill: 'var(--text-tertiary)', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={30}
          />
          <Tooltip
            contentStyle={{
              background: 'var(--bg-elev-2)',
              border: '1px solid var(--card-border)',
              borderRadius: 10,
              fontSize: 12,
              color: 'var(--text-primary)',
            }}
            labelStyle={{ color: 'var(--text-secondary)' }}
            formatter={(v, name) => [`${Number(v).toFixed(1)} lbs`, name === 'trended' ? 'Trend' : 'Raw']}
          />
          {goalWeight && (
            <ReferenceLine
              y={goalWeight}
              stroke="rgba(245, 158, 11, 0.6)"
              strokeDasharray="4 4"
              label={{ value: `Goal ${goalWeight}`, fill: 'var(--warn)', fontSize: 10, position: 'right' }}
            />
          )}
          <Line
            type="monotone"
            dataKey="raw"
            stroke="rgba(255,255,255,0.18)"
            strokeWidth={1}
            dot={{ r: 3, fill: 'rgba(255,255,255,0.45)', stroke: 'none' }}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="trended"
            stroke="#34d399"
            strokeWidth={2.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
