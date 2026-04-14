import React from 'react'

const WeightStatsCard = ({ label, value, subtext }) => {
  return (
    <div
      className="p-4 rounded-lg border"
      style={{
        backgroundColor: 'var(--bg-card)',
        borderColor: 'var(--border)',
      }}
    >
      <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
        {label}
      </div>

      <div className="mt-2 flex items-baseline gap-2">
        <span
          className="text-2xl font-bold"
          style={{
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          {value}
        </span>
      </div>

      {subtext && (
        <div className="text-xs mt-2" style={{ color: 'var(--text-secondary)' }}>
          {subtext}
        </div>
      )}
    </div>
  )
}

export default WeightStatsCard
