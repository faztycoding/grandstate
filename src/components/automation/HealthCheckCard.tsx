import { useLanguage } from '@/i18n/LanguageContext';
import type { HealthCheckResult, RiskFactor } from '@/hooks/useHealthCheck';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  Activity,
  Clock,
  MessageSquare,
  Zap,
  TrendingUp,
  Timer,
  Flame,
  ChevronDown,
  ChevronUp,
  Info,
  AlertTriangle,
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface HealthCheckCardProps {
  result: HealthCheckResult;
  className?: string;
}

const LEVEL_CONFIG = {
  safe: {
    color: 'text-emerald-600',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    progress: 'bg-emerald-500',
    badgeBg: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    icon: ShieldCheck,
    glow: 'shadow-emerald-500/20',
  },
  moderate: {
    color: 'text-amber-600',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    progress: 'bg-amber-500',
    badgeBg: 'bg-amber-100 text-amber-700 border-amber-200',
    icon: Shield,
    glow: 'shadow-amber-500/20',
  },
  high: {
    color: 'text-orange-600',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/20',
    progress: 'bg-orange-500',
    badgeBg: 'bg-orange-100 text-orange-700 border-orange-200',
    icon: ShieldAlert,
    glow: 'shadow-orange-500/20',
  },
  critical: {
    color: 'text-red-600',
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
    progress: 'bg-red-500',
    badgeBg: 'bg-red-100 text-red-700 border-red-200',
    icon: ShieldX,
    glow: 'shadow-red-500/20',
  },
};

const FACTOR_ICONS: Record<string, any> = {
  velocity: Zap,
  dailyVolume: Activity,
  intervalEntropy: Timer,
  captionDiversity: MessageSquare,
  minDelay: Clock,
  acceleration: TrendingUp,
  sessionDuration: Flame,
  warmup: TrendingUp,
};

export function HealthCheckCard({ result, className }: HealthCheckCardProps) {
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState(false);

  const config = LEVEL_CONFIG[result.overallLevel];
  const ShieldIcon = config.icon;

  const hc = t.healthCheck;

  const factorLabels: Record<string, string> = {
    velocity: hc.velocity,
    dailyVolume: hc.dailyVolume,
    intervalEntropy: hc.intervalEntropy,
    captionDiversity: hc.captionDiversity,
    minDelay: hc.minDelay,
    acceleration: hc.acceleration,
    sessionDuration: hc.sessionDuration,
    warmup: hc.warmup,
  };

  const levelLabels: Record<string, string> = {
    safe: hc.safe,
    moderate: hc.moderate,
    high: hc.high,
    critical: hc.critical,
  };

  const recommendationLabels: Record<string, string> = {
    slowDown: hc.recSlowDown,
    reduceDailyVolume: hc.recReduceDaily,
    randomizeIntervals: hc.recRandomize,
    diversifyCaptions: hc.recDiversify,
    increaseDelay: hc.recIncreaseDelay,
    gradualIncrease: hc.recGradual,
    shorterSessions: hc.recShorterSessions,
    warmupAccount: hc.recWarmup,
    allGood: hc.recAllGood,
  };

  return (
    <Card className={cn('card-elevated overflow-hidden', className)}>
      {/* Header with overall score */}
      <CardHeader className={cn('pb-3', config.bg)}>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldIcon className={cn('w-5 h-5', config.color)} />
            {hc.title}
          </CardTitle>
          <Badge variant="outline" className={cn('font-bold text-sm px-3 py-1', config.badgeBg)}>
            {result.overallScore}/100
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-4">
        {/* Overall Risk Gauge */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{hc.riskLevel}</span>
            <span className={cn('font-semibold', config.color)}>
              {levelLabels[result.overallLevel]}
            </span>
          </div>

          {/* Custom gradient progress bar */}
          <div className="relative h-3 rounded-full bg-muted overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-700 ease-out',
                result.overallScore <= 25 ? 'bg-gradient-to-r from-emerald-400 to-emerald-500' :
                result.overallScore <= 50 ? 'bg-gradient-to-r from-amber-400 to-amber-500' :
                result.overallScore <= 75 ? 'bg-gradient-to-r from-orange-400 to-orange-500' :
                'bg-gradient-to-r from-red-500 to-red-600'
              )}
              style={{ width: `${Math.max(2, result.overallScore)}%` }}
            />
            {/* Scale markers */}
            <div className="absolute inset-0 flex">
              <div className="w-1/4 border-r border-white/30" />
              <div className="w-1/4 border-r border-white/30" />
              <div className="w-1/4 border-r border-white/30" />
              <div className="w-1/4" />
            </div>
          </div>

          {/* Scale labels */}
          <div className="flex justify-between text-[10px] text-muted-foreground px-0.5">
            <span>{hc.safe}</span>
            <span>{hc.moderate}</span>
            <span>{hc.high}</span>
            <span>{hc.critical}</span>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-2">
          <div className="text-center p-2 rounded-lg bg-muted/50">
            <p className="text-lg font-bold">{result.stats.postsToday}</p>
            <p className="text-[10px] text-muted-foreground">{hc.statPostsToday}</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted/50">
            <p className="text-lg font-bold">{result.stats.postsThisHour}</p>
            <p className="text-[10px] text-muted-foreground">{hc.statPostsHour}</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted/50">
            <p className="text-lg font-bold">
              {result.stats.avgDelayMinutes < 999 ? `${result.stats.avgDelayMinutes}m` : '-'}
            </p>
            <p className="text-[10px] text-muted-foreground">{hc.statAvgDelay}</p>
          </div>
        </div>

        {/* Recommendations */}
        {result.recommendations.length > 0 && result.recommendations[0] !== 'allGood' && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              {hc.recommendations}
            </p>
            {result.recommendations.slice(0, 3).map((rec, i) => (
              <div key={i} className="flex items-start gap-2 text-xs p-2 rounded-md bg-amber-50 border border-amber-100 text-amber-800">
                <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                <span>{recommendationLabels[rec] || rec}</span>
              </div>
            ))}
          </div>
        )}

        {result.recommendations[0] === 'allGood' && (
          <div className="flex items-center gap-2 text-xs p-2.5 rounded-md bg-emerald-50 border border-emerald-100 text-emerald-700">
            <ShieldCheck className="w-4 h-4 flex-shrink-0" />
            <span className="font-medium">{hc.recAllGood}</span>
          </div>
        )}

        {/* Expandable Factor Details */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
        >
          {expanded ? hc.hideDetails : hc.showDetails}
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        {expanded && (
          <div className="space-y-2 animate-in slide-in-from-top-2 duration-200">
            {result.factors.map((factor) => (
              <FactorRow
                key={factor.id}
                factor={factor}
                label={factorLabels[factor.id] || factor.id}
                levelLabel={levelLabels[factor.level]}
              />
            ))}

            {/* Additional Stats */}
            <div className="pt-2 mt-2 border-t text-xs text-muted-foreground space-y-1">
              <div className="flex justify-between">
                <span>{hc.statPostsWeek}</span>
                <span className="font-medium text-foreground">{result.stats.postsThisWeek}</span>
              </div>
              <div className="flex justify-between">
                <span>{hc.statCaptionUnique}</span>
                <span className="font-medium text-foreground">
                  {result.stats.totalCaptions > 0
                    ? `${result.stats.uniqueCaptions}/${result.stats.totalCaptions} (${Math.round((result.stats.uniqueCaptions / result.stats.totalCaptions) * 100)}%)`
                    : '-'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>{hc.statAccountAge}</span>
                <span className="font-medium text-foreground">{result.stats.accountAgeDays} {hc.days}</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Individual Factor Row ──
function FactorRow({ factor, label, levelLabel }: { factor: RiskFactor; label: string; levelLabel: string }) {
  const config = LEVEL_CONFIG[factor.level];
  const Icon = FACTOR_ICONS[factor.id] || Activity;

  return (
    <div className="flex items-center gap-2">
      <Icon className={cn('w-3.5 h-3.5 flex-shrink-0', config.color)} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-xs truncate">{label}</span>
          <span className={cn('text-[10px] font-medium', config.color)}>{factor.score}</span>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-500', config.progress)}
            style={{ width: `${Math.max(2, factor.score)}%` }}
          />
        </div>
      </div>
    </div>
  );
}
