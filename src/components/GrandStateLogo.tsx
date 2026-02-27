import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  heroMode?: boolean;
}

export function GrandStateLogo({ className, heroMode = false }: LogoProps) {
  const bgFrom = heroMode ? '#1e1b4b' : '#0f172a';
  const bgTo = heroMode ? '#312e81' : '#1e293b';
  const gFrom = heroMode ? '#c4b5fd' : '#a78bfa';
  const gMid = heroMode ? '#a78bfa' : '#8b5cf6';
  const gTo = heroMode ? '#8b5cf6' : '#7c3aed';
  const dotFrom = heroMode ? '#fbbf24' : '#f59e0b';
  const dotTo = heroMode ? '#fb923c' : '#f97316';
  const ringColor = heroMode ? '#a78bfa' : '#8b5cf6';

  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('w-8 h-8', className)}
    >
      <defs>
        <linearGradient id="logoBg" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={bgFrom} />
          <stop offset="100%" stopColor={bgTo} />
        </linearGradient>
        <linearGradient id="logoG" x1="30" y1="25" x2="70" y2="75" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={gFrom} />
          <stop offset="50%" stopColor={gMid} />
          <stop offset="100%" stopColor={gTo} />
        </linearGradient>
        <linearGradient id="logoDot" x1="50" y1="60" x2="70" y2="55" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={dotFrom} />
          <stop offset="100%" stopColor={dotTo} />
        </linearGradient>
      </defs>
      {/* Background */}
      <rect width="100" height="100" rx="22" fill="url(#logoBg)" />
      {/* Subtle ring */}
      <rect x="4" y="4" width="92" height="92" rx="19" fill="none" stroke={ringColor} strokeWidth="1" opacity="0.15" />
      {/* G letter */}
      <text
        x="50"
        y="68"
        textAnchor="middle"
        fontSize="60"
        fontWeight="800"
        fontFamily="Inter, system-ui, sans-serif"
        fill="url(#logoG)"
      >
        G
      </text>
      {/* Accent dot */}
      <circle cx="68" cy="55" r="5" fill="url(#logoDot)" />
    </svg>
  );
}
