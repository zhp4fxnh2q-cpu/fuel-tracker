import React from 'react';

/**
 * CalorieRing — Apple Activity style with 4 concentric rings.
 *
 * Outer to inner:
 *   1. Calories  — FUEL gradient (green)
 *   2. Protein   — coral/red
 *   3. Carbs     — amber/yellow
 *   4. Fat       — violet
 *
 * Center shows the current calorie number. Legend below maps colors to
 * macros + current/target.
 */
export default function CalorieRing({ current, target, macros, size = 240 }) {
  // Normalize macros (passed from TodayScreen). If absent, hide inner rings.
  const p = macros?.protein || { current: 0, target: 0 };
  const c = macros?.carbs   || { current: 0, target: 0 };
  const f = macros?.fat     || { current: 0, target: 0 };

  const stroke = 14;
  const gap = 4;
  // Calorie ring (outermost)
  const r1 = (size - stroke) / 2;
  const r2 = r1 - stroke - gap;
  const r3 = r2 - stroke - gap;
  const r4 = r3 - stroke - gap;

  const arc = (radius, ratio, color, strokeWidth = stroke) => {
    const circ = 2 * Math.PI * radius;
    const display = Math.max(0, Math.min(ratio, 1));
    const offset = circ * (1 - display);
    return (
      <>
        <circle cx={size/2} cy={size/2} r={radius}
          stroke="rgba(255,255,255,0.08)" strokeWidth={strokeWidth} fill="none" />
        <circle cx={size/2} cy={size/2} r={radius}
          stroke={color} strokeWidth={strokeWidth} fill="none"
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 400ms ease' }} />
      </>
    );
  };

  const safeT = (x) => (x > 0 ? x : 1);
  const remaining = Math.max(0, target - current);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
          <defs>
            <linearGradient id="cal-grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#34d399" />
              <stop offset="100%" stopColor="#6ee7b7" />
            </linearGradient>
            <linearGradient id="protein-grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#fb7185" />
              <stop offset="100%" stopColor="#fda4af" />
            </linearGradient>
            <linearGradient id="carbs-grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#fbbf24" />
              <stop offset="100%" stopColor="#fde68a" />
            </linearGradient>
            <linearGradient id="fat-grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#a78bfa" />
              <stop offset="100%" stopColor="#c4b5fd" />
            </linearGradient>
          </defs>
          {arc(r1, current / safeT(target), 'url(#cal-grad)')}
          {r2 > 0 && arc(r2, p.current / safeT(p.target), 'url(#protein-grad)', stroke - 1)}
          {r3 > 0 && arc(r3, c.current / safeT(c.target), 'url(#carbs-grad)',   stroke - 1)}
          {r4 > 0 && arc(r4, f.current / safeT(f.target), 'url(#fat-grad)',     stroke - 1)}
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: 10, letterSpacing: '0.16em', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Calories</div>
          <div style={{ fontSize: 32, fontWeight: 600, marginTop: 2, lineHeight: 1 }}>{Math.round(current).toLocaleString()}</div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
            of {Math.round(target).toLocaleString()}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2, letterSpacing: '0.06em' }}>
            {current >= target ? `OVER ${Math.round(current - target)}` : `${Math.round(remaining)} LEFT`}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, width: '100%', maxWidth: size + 24 }}>
        <LegendItem color="#fb7185" label="Protein" cur={p.current} tgt={p.target} />
        <LegendItem color="#fbbf24" label="Carbs"   cur={c.current} tgt={c.target} />
        <LegendItem color="#a78bfa" label="Fat"     cur={f.current} tgt={f.target} />
      </div>
    </div>
  );
}

function LegendItem({ color, label, cur, tgt }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 8, height: 8, borderRadius: 999, background: color }} />
        <span style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>{label}</span>
      </div>
      <div style={{ fontSize: 14, fontWeight: 600 }}>
        {Math.round(cur)}<span style={{ color: 'var(--text-tertiary)', fontSize: 11, fontWeight: 400 }}>{` / ${Math.round(tgt)}g`}</span>
      </div>
    </div>
  );
}
