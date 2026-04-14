import React from 'react'

const WeeklyAveragesTable = ({ weeks }) => {
  return (
    <div
      className="p-4 rounded-lg border"
      style={{
        backgroundColor: 'var(--bg-card)',
        borderColor: 'var(--border)',
      }}
    >
      <div className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--text-secondary)' }}>
        Weekly Averages (Last 8 Weeks)
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <th
                className="text-left py-2 px-2"
                style={{ color: 'var(--text-secondary)' }}
              >
                Week
              </th>
              <th
                className="text-right py-2 px-2"
                style={{ color: 'var(--text-secondary)' }}
              >
                Calories
              </th>
              <th
                className="text-right py-2 px-2"
                style={{ color: 'var(--text-secondary)' }}
              >
                Protein
              </th>
              <th
                className="text-right py-2 px-2"
                style={{ color: 'var(--text-secondary)' }}
              >
                Weight
              </th>
              <th
                className="text-right py-2 px-2"
                style={{ color: 'var(--text-secondary)' }}
              >
                Change
              </th>
              <th
                className="text-right py-2 px-2"
                style={{ color: 'var(--text-secondary)' }}
              >
                Logged
              </th>
            </tr>
          </thead>
          <tbody>
            {weeks.map((week, idx) => (
              <tr
                key={idx}
                style={{
                  borderBottom: '1px solid var(--border)',
                  backgroundColor: idx % 2 === 0 ? 'transparent' : 'var(--bg-elevated)',
                }}
              >
                <td
                  className="py-3 px-2"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {week.weekStart}
                </td>
                <td
                  className="py-3 px-2 text-right font-mono"
                  style={{ color: 'var(--text-primary)', fontFamily: "'JetBrains Mono', monospace" }}
                >
                  {week.avgCalories}
                </td>
                <td
                  className="py-3 px-2 text-right"
                  style={{ color: 'var(--macro-protein)', fontFamily: "'JetBrains Mono', monospace" }}
                >
                  {week.avgProtein}g
                </td>
                <td
                  className="py-3 px-2 text-right font-mono"
                  style={{ color: 'var(--text-primary)', fontFamily: "'JetBrains Mono', monospace" }}
                >
                  {week.avgWeight !== null ? week.avgWeight : '-'}
                </td>
                <td
                  className="py-3 px-2 text-right"
                  style={{
                    color:
                      week.weekChange === null
                        ? 'var(--text-secondary)'
                        : week.weekChange > 0
                          ? 'var(--accent-success)'
                          : 'var(--text-secondary)',
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                >
                  {week.weekChange !== null
                    ? `${week.weekChange > 0 ? '+' : ''}${week.weekChange} lbs`
                    : '-'}
                </td>
                <td
                  className="py-3 px-2 text-right"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {week.daysLogged}/{7}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
        Values shown are weekly averages. Change is compared to the previous week.
      </div>
    </div>
  )
}

export default WeeklyAveragesTable
