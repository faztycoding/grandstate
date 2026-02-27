import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  heroMode?: boolean;
}

export function GrandStateLogo({ className, heroMode = false }: LogoProps) {
  const buildingColor = heroMode ? '#ffffff' : 'currentColor';
  const dollarColor = '#f7b500';

  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('w-8 h-8', className)}
    >
      {/* Base platform */}
      <path
        d="M10 82 L20 72 L80 72 L90 82 Z"
        fill={buildingColor}
        opacity="0.9"
      />

      {/* Left buildings */}
      <rect x="18" y="42" width="8" height="30" rx="1" fill={buildingColor} opacity="0.7" />
      <rect x="28" y="32" width="8" height="40" rx="1" fill={buildingColor} opacity="0.8" />

      {/* Center tower (main) */}
      <rect x="40" y="22" width="20" height="50" rx="1.5" fill={buildingColor} opacity="0.85" />
      {/* Tower top / spire */}
      <path d="M44 22 L50 12 L56 22 Z" fill={buildingColor} opacity="0.9" />

      {/* Right buildings */}
      <rect x="64" y="32" width="8" height="40" rx="1" fill={buildingColor} opacity="0.8" />
      <rect x="74" y="42" width="8" height="30" rx="1" fill={buildingColor} opacity="0.7" />

      {/* Upward arrows */}
      <path d="M15 48 L18 42 L21 48" stroke={buildingColor} strokeWidth="1.5" fill="none" opacity="0.5" strokeLinecap="round" />
      <path d="M79 48 L82 42 L85 48" stroke={buildingColor} strokeWidth="1.5" fill="none" opacity="0.5" strokeLinecap="round" />
      <path d="M36 28 L38 22 L40 28" stroke={buildingColor} strokeWidth="1.2" fill="none" opacity="0.4" strokeLinecap="round" />
      <path d="M60 28 L62 22 L64 28" stroke={buildingColor} strokeWidth="1.2" fill="none" opacity="0.4" strokeLinecap="round" />

      {/* Art deco lines on center tower */}
      <line x1="50" y1="24" x2="50" y2="70" stroke={buildingColor} strokeWidth="0.8" opacity="0.3" />
      <line x1="46" y1="28" x2="46" y2="70" stroke={buildingColor} strokeWidth="0.5" opacity="0.2" />
      <line x1="54" y1="28" x2="54" y2="70" stroke={buildingColor} strokeWidth="0.5" opacity="0.2" />

      {/* Dollar sign — GOLD */}
      <text
        x="50"
        y="58"
        textAnchor="middle"
        fontSize="32"
        fontWeight="bold"
        fontFamily="'Georgia', serif"
        fill={dollarColor}
        style={{ filter: 'drop-shadow(0 1px 3px rgba(247,181,0,0.5))' }}
      >
        $
      </text>

      {/* Decorative arc beneath buildings */}
      <path
        d="M15 75 Q50 68 85 75"
        stroke={buildingColor}
        strokeWidth="1"
        fill="none"
        opacity="0.3"
      />
    </svg>
  );
}
