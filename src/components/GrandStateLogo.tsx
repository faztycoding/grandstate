import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  heroMode?: boolean;
}

export function GrandStateLogo({ className, heroMode = false }: LogoProps) {
  const uid = heroMode ? 'h' : 'd';
  const bldgLight = heroMode ? '#f0f0f8' : '#d8dce4';
  const bldgMid = heroMode ? '#dcdce8' : '#b8bcc8';
  const bldgDark = heroMode ? '#c4c4d4' : '#98a0ac';
  const dollarColor = heroMode ? '#fbbf24' : '#f59e0b';
  const dollarGlow = heroMode ? '#fef3c7' : '#fde68a';
  const baseFill = heroMode ? '#e0e0e8' : '#c0c4cc';
  const shadowColor = heroMode ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.25)';

  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('w-8 h-8', className)}
    >
      <defs>
        <linearGradient id={`bldg-l-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={bldgLight} />
          <stop offset="100%" stopColor={bldgMid} />
        </linearGradient>
        <linearGradient id={`bldg-c-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={bldgLight} />
          <stop offset="60%" stopColor={bldgMid} />
          <stop offset="100%" stopColor={bldgDark} />
        </linearGradient>
        <linearGradient id={`bldg-r-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={bldgMid} />
          <stop offset="100%" stopColor={bldgDark} />
        </linearGradient>
        <linearGradient id={`dollar-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={dollarGlow} />
          <stop offset="100%" stopColor={dollarColor} />
        </linearGradient>
        <filter id={`shadow-${uid}`}>
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor={shadowColor} />
        </filter>
        <filter id={`glow-${uid}`}>
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Base platform with 3D feel */}
      <path d="M12 78 L22 70 L78 70 L88 78 Z" fill={baseFill} opacity="0.9" />
      <path d="M12 78 L22 70 L78 70 L88 78 L78 80 L22 80 Z" fill={bldgDark} opacity="0.3" />

      {/* Left buildings — gradient shading */}
      <rect x="20" y="44" width="9" height="26" rx="1" fill={`url(#bldg-r-${uid})`} opacity="0.7" filter={`url(#shadow-${uid})`} />
      <rect x="31" y="34" width="9" height="36" rx="1" fill={`url(#bldg-l-${uid})`} opacity="0.85" filter={`url(#shadow-${uid})`} />

      {/* Center tower — tallest, 3D gradient */}
      <rect x="42" y="22" width="16" height="48" rx="1.5" fill={`url(#bldg-c-${uid})`} opacity="0.9" filter={`url(#shadow-${uid})`} />
      {/* Tower spire */}
      <path d="M46 22 L50 13 L54 22 Z" fill={bldgLight} opacity="0.9" />
      {/* Tower window lines */}
      <line x1="50" y1="25" x2="50" y2="68" stroke={bldgDark} strokeWidth="0.6" opacity="0.15" />
      <line x1="47" y1="28" x2="47" y2="68" stroke={bldgDark} strokeWidth="0.4" opacity="0.1" />
      <line x1="53" y1="28" x2="53" y2="68" stroke={bldgDark} strokeWidth="0.4" opacity="0.1" />

      {/* Right buildings */}
      <rect x="60" y="34" width="9" height="36" rx="1" fill={`url(#bldg-r-${uid})`} opacity="0.8" filter={`url(#shadow-${uid})`} />
      <rect x="71" y="44" width="9" height="26" rx="1" fill={`url(#bldg-l-${uid})`} opacity="0.65" filter={`url(#shadow-${uid})`} />

      {/* Upward arrows — growth feel */}
      <path d="M17 48 L20 42 L23 48" stroke={bldgLight} strokeWidth="1.5" fill="none" opacity="0.4" strokeLinecap="round" />
      <path d="M77 48 L80 42 L83 48" stroke={bldgLight} strokeWidth="1.5" fill="none" opacity="0.4" strokeLinecap="round" />

      {/* $ sign — golden glow */}
      <text
        x="50"
        y="58"
        textAnchor="middle"
        fontSize="26"
        fontWeight="bold"
        fontFamily="Inter, system-ui, sans-serif"
        fill={`url(#dollar-${uid})`}
        filter={`url(#glow-${uid})`}
      >
        $
      </text>

      {/* Decorative arc */}
      <path d="M16 73 Q50 66 84 73" stroke={bldgMid} strokeWidth="0.8" fill="none" opacity="0.25" />
    </svg>
  );
}
