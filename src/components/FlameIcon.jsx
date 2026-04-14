import React from 'react';

/**
 * FlameIcon - Reusable FUEL flame logo SVG
 * Props:
 *   size: number (default 32) — width & height in px
 *   opacity: number (default 1) — wrapper opacity
 *   glow: boolean (default false) — warm drop-shadow
 *   simplified: boolean (default false) — omit side tongues for small sizes
 *   className: string — additional CSS class
 *   style: object — additional inline styles
 */
const FlameIcon = ({
  size = 32,
  opacity = 1,
  glow = false,
  simplified = false,
  className = '',
  style = {},
}) => {
  // Unique gradient IDs to avoid SVG conflicts when multiple instances render
  const id = React.useId();
  const fgId = `flame-fg-${id}`;
  const bgId = `flame-bg-${id}`;

  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        opacity,
        flexShrink: 0,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        filter: glow ? `drop-shadow(0 0 ${Math.round(size * 0.3)}px rgba(240, 136, 62, 0.35))` : undefined,
        ...style,
      }}
    >
      <svg viewBox="0 0 512 512" width={size} height={size}>
        <defs>
          <linearGradient id={fgId} x1="0.3" y1="1" x2="0.7" y2="0">
            <stop offset="0%" stopColor="#E07020" />
            <stop offset="50%" stopColor="#F0983E" />
            <stop offset="100%" stopColor="#F5B84A" />
          </linearGradient>
          <linearGradient id={bgId} x1="0.5" y1="0" x2="0.5" y2="1">
            <stop offset="0%" stopColor="#58A6FF" />
            <stop offset="100%" stopColor="#6C6CFF" />
          </linearGradient>
        </defs>

        {/* Main flame body */}
        <path
          d="M256 68C242 92 195 158 172 210C148 265 138 305 142 340C148 385 170 418 205 440C225 452 242 458 256 460C270 458 287 452 307 440C342 418 364 385 370 340C374 305 364 265 340 210C317 158 270 92 256 68Z"
          fill={`url(#${fgId})`}
        />

        {/* Side flame tongues — only on larger sizes */}
        {!simplified && (
          <>
            <path
              d="M300 78C316 110 365 175 378 218C388 250 387 275 378 300C372 315 364 322 356 330C362 305 360 275 350 248C335 200 308 142 300 78Z"
              fill={`url(#${fgId})`}
            />
            <path
              d="M212 78C196 110 147 175 134 218C124 250 125 275 134 300C140 315 148 322 156 330C150 305 152 275 162 248C177 200 204 142 212 78Z"
              fill={`url(#${fgId})`}
            />
          </>
        )}

        {/* Inner dark void */}
        <path
          d="M256 210C244 230 212 280 208 318C205 345 212 368 228 385C240 395 250 400 256 402C262 400 272 395 284 385C300 368 307 345 304 318C300 280 268 230 256 210Z"
          fill="#0D1117"
        />

        {/* Blue core crescent */}
        <path
          d="M210 370C210 342 230 325 256 325C282 325 302 342 302 370C302 395 282 408 256 408C230 408 210 395 210 370Z"
          fill={`url(#${bgId})`}
          opacity="0.8"
        />
      </svg>
    </div>
  );
};

export default FlameIcon;
