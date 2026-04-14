import React, { useMemo } from 'react';
import {
  ComposedChart,
  Line,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

/**
 * WeightChart - Recharts-based weight trend visualization
 * Props: entries (array of {date, weight_lbs, smoothed_weight}), days=30
 */
const WeightChart = ({ entries = [], days = 30 }) => {
  // Sort entries by date and limit to last N days
  const data = useMemo(() => {
    if (!entries || entries.length === 0) return [];

    const sorted = [...entries]
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(-days);

    return sorted.map((entry) => ({
      date: entry.date,
      raw: entry.weight_lbs,
      trend: entry.smoothed_weight || entry.weight_lbs,
      dateLabel: formatDateShort(entry.date),
    }));
  }, [entries, days]);

  if (data.length === 0) {
    return (
      <div
        className="w-full h-64 flex items-center justify-center rounded-lg border"
        style={{
          backgroundColor: 'var(--bg-card)',
          borderColor: 'var(--border)',
        }}
      >
        <div style={{ color: 'var(--text-secondary)' }} className="text-sm">
          No weight data yet. Start logging to see trends.
        </div>
      </div>
    );
  }

  // Find min/max for Y-axis scaling
  const weights = data.flatMap((d) => [d.raw, d.trend]).filter(Boolean);
  const minWeight = Math.min(...weights);
  const maxWeight = Math.max(...weights);
  const padding = (maxWeight - minWeight) * 0.15;

  return (
    <div
      className="w-full rounded-lg border p-4"
      style={{
        backgroundColor: 'var(--bg-card)',
        borderColor: 'var(--border)',
      }}
    >
      <ResponsiveContainer width="100%" height={240}>
        <ComposedChart data={data} margin={{ top: 20, right: 20, left: 0, bottom: 40 }}>
          {/* Grid */}
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--bg-elevated)"
            vertical={false}
          />

          {/* Axes */}
          <XAxis
            dataKey="dateLabel"
            stroke="var(--text-tertiary)"
            style={{ fontSize: '12px' }}
            angle={-45}
            textAnchor="end"
            height={60}
          />

          <YAxis
            stroke="var(--text-tertiary)"
            style={{ fontSize: '12px' }}
            domain={['dataMin - padding', 'dataMax + padding']}
            label={{ value: 'lbs', angle: -90, position: 'insideLeft' }}
          />

          {/* Tooltip */}
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--bg-elevated)',
              border: `1px solid var(--border)`,
              borderRadius: '8px',
              color: 'var(--text-primary)',
            }}
            formatter={(value) => (
              <span style={{ fontFamily: 'var(--font-mono)' }}>
                {value.toFixed(1)} lbs
              </span>
            )}
            labelFormatter={(label) => <span>{label}</span>}
          />

          {/* Raw weight scatter */}
          <Scatter
            name="Raw Weight"
            dataKey="raw"
            fill="var(--accent-primary)"
            fillOpacity={0.3}
            r={3}
          />

          {/* Trend line (EWMA smoothed) */}
          <Line
            name="Trend"
            type="monotone"
            dataKey="trend"
            stroke="var(--accent-primary)"
            strokeWidth={2.5}
            dot={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

/**
 * Format date as abbreviated string (e.g., "Apr 1", "Apr 15")
 */
function formatDateShort(dateString) {
  const date = new Date(dateString);
  const month = date.toLocaleString('en-US', { month: 'short' });
  const day = date.getDate();
  return `${month} ${day}`;
}

export default WeightChart;
