import React from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'

const EnergyBalanceChart = ({ data }) => {
  // Get TDEE value from first entry (assuming constant)
  const tdee = data[0]?.tdee || 2200

  return (
    <div
      className="p-4 rounded-lg border"
      style={{
        backgroundColor: 'var(--bg-card)',
        borderColor: 'var(--border)',
      }}
    >
      <div className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--text-secondary)' }}>
        Energy Balance (30 Days)
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 5, right: 30, left: -20, bottom: 5 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--border)"
            vertical={false}
          />
          <XAxis
            dataKey="date"
            tick={{
              fill: 'var(--text-secondary)',
              fontSize: 12,
            }}
            stroke="var(--border)"
          />
          <YAxis
            tick={{
              fill: 'var(--text-secondary)',
              fontSize: 12,
            }}
            stroke="var(--border)"
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              color: 'var(--text-primary)',
            }}
            formatter={(value) => `${Math.round(value)} cal`}
            labelStyle={{ color: 'var(--text-secondary)' }}
          />
          <Legend
            wrapperStyle={{
              color: 'var(--text-secondary)',
              fontSize: 12,
            }}
          />

          {/* TDEE Reference Line */}
          <ReferenceLine
            y={tdee}
            stroke="var(--accent-primary)"
            strokeWidth={2}
            strokeDasharray="5 5"
            name="TDEE Estimate"
            label={{
              value: `TDEE: ${tdee}`,
              position: 'right',
              fill: 'var(--text-secondary)',
              fontSize: 11,
            }}
          />

          {/* Calories consumed bars */}
          <Bar
            dataKey="calories"
            fill="var(--accent-warm)"
            name="Calories Consumed"
            radius={[4, 4, 0, 0]}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>

      <div className="mt-4 p-3 rounded" style={{ backgroundColor: 'var(--bg-elevated)' }}>
        <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          The blue dashed line shows your estimated TDEE. Bars below the line indicate a calorie deficit.
        </div>
      </div>
    </div>
  )
}

export default EnergyBalanceChart
