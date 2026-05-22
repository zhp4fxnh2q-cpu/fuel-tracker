import React from 'react';

/**
 * SVG calorie ring — adherence-neutral. Continues past 100% without changing color.
 * Draws an under-track + a foreground arc filled with the FUEL gradient.
 */
export default function CalorieRing({ current, target, size = 200, stroke = 14, label = 'Calories' }) {
  const safeTarget = target > 0 ? target : 1;
  const pct = Math.max(0, current / safeTarget);
  const displayPct = Math.min(pct, 1.5); // ring extends to 150% then clamps visually
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - displayPct);
  const remaining = Math.max(0, target - current);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
          <defs>
            <linearGradient id="fuel-ring" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#34d399" />
              <stop offset="100%" stopColor="#6ee7b7" />
            </linearGradient>
          </defs>
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            stroke="rgba(255,255,255,0.14)" strokeWidth={stroke} fill="none"
          />
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            stroke="url(#fuel-ring)" strokeWidth={stroke} fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            style={{ transition: 'stroke-dashoffset 400ms ease' }}
          />
        </svg>
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ fontSize: 11, letterSpacing: '0.12em', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>{label}</div>
          <div style={{ fontSize: 38, fontWeight: 600, marginTop: 2 }}>{Math.round(current).toLocaleString()}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>of {Math.round(target).toLocaleString()}</div>
        </div>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', letterSpacing: '0.08em' }}>
        {pct >= 1
          ? `OVER BY ${Math.round(current - target).toLocaleString()}`
          : `${Math.round(remaining).toLocaleString()} REMAINING`}
      </div>
    </div>
  );
}
