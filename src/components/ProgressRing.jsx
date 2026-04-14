import React, { useMemo } from 'react';
import FlameIcon from './FlameIcon';

/**
 * ProgressRing - SVG-based circular progress indicator
 * Shows value/max in center with animated fill
 */
const ProgressRing = ({
  value = 0,
  max = 2000,
  size = 120,
  strokeWidth = 8,
  color = 'var(--accent-primary)',
  label = 'kcal',
  sublabel = ''
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(value, max) / max) * circumference;

  const viewBoxSize = size;
  const centerX = viewBoxSize / 2;
  const centerY = viewBoxSize / 2;
  const gradientId = `gradient-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div className="flex flex-col items-center justify-center gap-3">
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
          style={{
            filter: 'drop-shadow(0 4px 12px rgba(240, 136, 62, 0.15))',
          }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#F5B84A" />
              <stop offset="100%" stopColor="#E07020" />
            </linearGradient>
          </defs>

          {/* Background circle */}
          <circle
            cx={centerX}
            cy={centerY}
            r={radius}
            fill="none"
            stroke="rgba(240, 136, 62, 0.08)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />

          {/* Progress circle with gradient */}
          <circle
            cx={centerX}
            cy={centerY}
            r={radius}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{
              transform: `rotate(-90deg)`,
              transformOrigin: `${centerX}px ${centerY}px`,
              transition: 'stroke-dashoffset 600ms cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          />
        </svg>

        {/* Center text with flame */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <FlameIcon size={20} opacity={0.4} simplified style={{ marginBottom: 2 }} />
          <div
            className="text-center"
            style={{
              fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
            }}
          >
            <div className="text-4xl font-bold" style={{ color: 'var(--text-primary)' }}>
              {Math.round(value)}
            </div>
            <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              / {Math.round(max)}
            </div>
          </div>
        </div>
      </div>

      {/* Labels below */}
      <div className="text-center">
        <div className="text-sm font-600" style={{ color: 'var(--text-primary)' }}>
          {label}
        </div>
        {sublabel && (
          <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            {sublabel}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProgressRing;
