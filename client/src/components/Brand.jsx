import { Link } from 'react-router-dom';

/** Gradient "L" mark, inspired by the original site's brand mark. */
export function BrandMark({ size = 26, className = '' }) {
  const id = `brand-${size}`;
  return (
    <svg
      className={`brand__mark ${className}`}
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      role="img"
      aria-label="WebAI logo"
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="hsl(22 95% 55%)" />
          <stop offset="42%" stopColor="hsl(330 90% 62%)" />
          <stop offset="100%" stopColor="hsl(258 85% 58%)" />
        </linearGradient>
      </defs>
      <path
        d="M6 3.4h9.2c4.4 0 7.2 2.6 7.2 6.7 0 4.3-3 7.2-7.6 7.2H11v8.1c0 1.7-1 2.6-2.6 2.6H6c-1.6 0-2.6-.9-2.6-2.6V6c0-1.6 1-2.6 2.6-2.6Z"
        fill={`url(#${id})`}
      />
      <circle cx="22.5" cy="23.5" r="6.5" fill={`url(#${id})`} opacity="0.85" />
    </svg>
  );
}

export default function Brand({ size = 26, to = '/' }) {
  return (
    <Link className={`brand${size >= 34 ? ' brand--lg' : ''}`} to={to}>
      <BrandMark size={size} />
      <span>lovable clone</span>
    </Link>
  );
}
