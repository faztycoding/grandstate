import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/i18n/LanguageContext';
import {
  Shield, ShieldCheck, ShieldAlert, ShieldX,
  Sparkles, ChevronDown, ChevronUp, CheckCircle2, AlertCircle,
  Fingerprint, Eye, Zap, Timer, Users, Clock,
  Activity, Lock, Cpu, Radio, Info, AlertTriangle,
  Flame, TrendingUp, MessageSquare,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import type { HealthCheckResult, RiskFactor } from '@/hooks/useHealthCheck';

// ════════════════════════════════════════════════════════════════
// SecurityCenter — Merged HealthCheck + AntiDetection Panel
// ════════════════════════════════════════════════════════════════

interface SecurityCenterProps {
  result: HealthCheckResult;
  delayBetweenPosts: number;
  selectedGroupsCount: number;
  className?: string;
}

// ── Level Configs ──
const LEVEL_CONFIG = {
  safe: {
    color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20',
    progress: 'bg-emerald-500', badgeBg: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    icon: ShieldCheck, gradient: 'from-emerald-500 to-green-400',
  },
  moderate: {
    color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/20',
    progress: 'bg-amber-500', badgeBg: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    icon: Shield, gradient: 'from-amber-500 to-yellow-400',
  },
  high: {
    color: 'text-orange-500', bg: 'bg-orange-500/10', border: 'border-orange-500/20',
    progress: 'bg-orange-500', badgeBg: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
    icon: ShieldAlert, gradient: 'from-orange-500 to-amber-400',
  },
  critical: {
    color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/20',
    progress: 'bg-red-500', badgeBg: 'bg-red-500/15 text-red-400 border-red-500/30',
    icon: ShieldX, gradient: 'from-red-500 to-orange-400',
  },
};

// ── Anti-Detection Modules ──
const MODULES = [
  { icon: Activity, title: 'Gaussian Jitter Timing', desc: 'สุ่มจังหวะแบบระฆังคว่ำ ทำลาย Pattern', tag: 'TIMING', color: 'text-cyan-400', bgColor: 'bg-cyan-500/10', borderColor: 'border-cyan-500/20' },
  { icon: Fingerprint, title: 'Fingerprint Masking', desc: 'ปลอม Canvas/WebGL/Audio/Font/Battery ทุก session', tag: 'IDENTITY', color: 'text-purple-400', bgColor: 'bg-purple-500/10', borderColor: 'border-purple-500/20' },
  { icon: Eye, title: 'WebRTC Leak Protection', desc: 'ปิดกั้น IP จริง + ป้องกันรั่วไหลผ่าน WebRTC', tag: 'NETWORK', color: 'text-blue-400', bgColor: 'bg-blue-500/10', borderColor: 'border-blue-500/20' },
  { icon: Sparkles, title: 'Image Hash Breaking', desc: 'Pixel noise + EXIF scrub ทุกรูปเปลี่ยน hash 100%', tag: 'MEDIA', color: 'text-pink-400', bgColor: 'bg-pink-500/10', borderColor: 'border-pink-500/20' },
  { icon: Zap, title: 'Micro-Interactions', desc: 'Scroll, hover, mouse move ก่อนโพสต์เหมือนคนจริง', tag: 'BEHAVIOR', color: 'text-amber-400', bgColor: 'bg-amber-500/10', borderColor: 'border-amber-500/20' },
  { icon: Cpu, title: 'Typing + Typo Simulation', desc: 'พิมพ์ทีละตัว + พิมพ์ผิดแล้วลบแก้เหมือนมนุษย์', tag: 'INPUT', color: 'text-emerald-400', bgColor: 'bg-emerald-500/10', borderColor: 'border-emerald-500/20' },
];

// ── Safety Tips ──
const TIPS = [
  { icon: Timer, title: 'ตั้ง Delay 15-30 วินาที', desc: 'ยิ่งนาน ยิ่งปลอดภัย แนะนำ 15 วิ ขึ้นไป', key: 'delay' as const },
  { icon: Users, title: 'ไม่เกิน 30-50 กลุ่ม/วัน', desc: 'บัญชีใหม่ควรเริ่มจาก 10-20 กลุ่ม', key: 'groups' as const },
  { icon: Clock, title: 'โพสต์ช่วง 8:00-22:00', desc: 'หลีกเลี่ยงช่วงดึก ดูไม่เป็นธรรมชาติ', key: 'time' as const },
  { icon: Shield, title: 'บัญชี FB อายุ 3+ เดือน', desc: 'บัญชีใหม่มากจะโดนตรวจจับง่าย', key: 'age' as const },
];

// ── Factor Icons ──
const FACTOR_ICONS: Record<string, any> = {
  velocity: Zap, dailyVolume: Activity, intervalEntropy: Timer,
  captionDiversity: MessageSquare, minDelay: Clock, acceleration: TrendingUp,
  sessionDuration: Flame, warmup: TrendingUp,
};

export function SecurityCenter({ result, delayBetweenPosts, selectedGroupsCount, className }: SecurityCenterProps) {
  const { t } = useLanguage();
  const [showModules, setShowModules] = useState(false);
  const [showFactors, setShowFactors] = useState(false);

  const config = LEVEL_CONFIG[result.overallLevel];
  const ShieldIcon = config.icon;
  const hc = t.healthCheck;
  const hasRealData = result.stats.postsToday > 0;

  const factorLabels: Record<string, string> = {
    velocity: hc.velocity, dailyVolume: hc.dailyVolume, intervalEntropy: hc.intervalEntropy,
    captionDiversity: hc.captionDiversity, minDelay: hc.minDelay, acceleration: hc.acceleration,
    sessionDuration: hc.sessionDuration, warmup: hc.warmup,
  };
  const levelLabels: Record<string, string> = { safe: hc.safe, moderate: hc.moderate, high: hc.high, critical: hc.critical };
  const recommendationLabels: Record<string, string> = {
    slowDown: hc.recSlowDown, reduceDailyVolume: hc.recReduceDaily, randomizeIntervals: hc.recRandomize,
    diversifyCaptions: hc.recDiversify, increaseDelay: hc.recIncreaseDelay, gradualIncrease: hc.recGradual,
    shorterSessions: hc.recShorterSessions, warmupAccount: hc.recWarmup, allGood: hc.recAllGood,
  };

  const isTipSafe = (key: string) => {
    if (key === 'delay') return delayBetweenPosts >= 15;
    if (key === 'groups') return selectedGroupsCount <= 50;
    return undefined;
  };

  return (
    <Card className={cn('overflow-hidden border-0 rounded-2xl', className)} style={{ background: 'linear-gradient(180deg, hsl(222 47% 8%) 0%, hsl(222 47% 5%) 100%)' }}>
      {/* Blueprint grid */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: 'linear-gradient(rgba(148,163,184,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,.5) 1px, transparent 1px)',
        backgroundSize: '28px 28px',
      }} />

      <CardContent className="relative p-0">

        {/* ═══ HEADER ═══ */}
        <div className={cn('px-5 py-4 flex items-center justify-between', config.bg)}>
          <div className="flex items-center gap-3">
            <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shadow-lg', config.bg, config.border, 'border')}>
              <ShieldIcon className={cn('w-5 h-5', config.color)} />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 text-accent" />
                Security Center
                <Badge className="text-[7px] px-1.5 py-0 h-4 bg-accent/15 text-accent border-accent/30 font-black tracking-widest">
                  ACTIVE
                </Badge>
              </p>
              <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                Health Check + 6 Anti-Detection Modules
              </p>
            </div>
          </div>
          <Badge variant="outline" className={cn('text-sm font-black px-3 py-1.5 rounded-xl', config.badgeBg)}>
            {result.overallScore}/100
          </Badge>
        </div>

        {/* ═══ RISK GAUGE ═══ */}
        <div className="px-5 pt-4 pb-3 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground text-xs font-mono uppercase tracking-wider flex items-center gap-1.5">
              <Radio className="w-3 h-3" />
              {hc.riskLevel}
            </span>
            <span className={cn('font-bold text-sm', config.color)}>
              {levelLabels[result.overallLevel]}
            </span>
          </div>

          {/* Gradient progress bar */}
          <div className="relative h-3 rounded-full bg-slate-800 overflow-hidden">
            <motion.div
              className={cn('h-full rounded-full bg-gradient-to-r', config.gradient)}
              initial={{ width: 0 }}
              animate={{ width: `${Math.max(2, result.overallScore)}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
            {/* Scale markers */}
            <div className="absolute inset-0 flex">
              <div className="w-1/4 border-r border-white/10" />
              <div className="w-1/4 border-r border-white/10" />
              <div className="w-1/4 border-r border-white/10" />
              <div className="w-1/4" />
            </div>
          </div>
          <div className="flex justify-between text-[9px] text-muted-foreground px-0.5 font-mono">
            <span>{hc.safe}</span>
            <span>{hc.moderate}</span>
            <span>{hc.high}</span>
            <span>{hc.critical}</span>
          </div>
        </div>

        {/* ═══ QUICK STATS ═══ */}
        <div className="px-5 pb-3">
          <div className="grid grid-cols-3 gap-2">
            {[
              { value: result.stats.postsToday, label: hc.statPostsToday, color: 'text-cyan-400' },
              { value: result.stats.postsThisHour, label: hc.statPostsHour, color: 'text-purple-400' },
              { value: result.stats.avgDelayMinutes < 999 ? `${result.stats.avgDelayMinutes}m` : '-', label: hc.statAvgDelay, color: 'text-amber-400' },
            ].map((stat, i) => (
              <div key={i} className="text-center p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/40">
                <p className={cn('text-lg font-black', stat.color)}>{stat.value}</p>
                <p className="text-[9px] text-muted-foreground font-mono">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ═══ RECOMMENDATION / ALL GOOD ═══ */}
        <div className="px-5 pb-3">
          {result.recommendations[0] === 'allGood' ? (
            <div className="flex items-center gap-2.5 text-xs p-3 rounded-xl bg-emerald-500/8 border border-emerald-500/20 text-emerald-400">
              <ShieldCheck className="w-4.5 h-4.5 flex-shrink-0" />
              <span className="font-semibold">{hc.recAllGood}</span>
            </div>
          ) : (
            <div className="space-y-1.5">
              <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-amber-500" />
                {hc.recommendations}
              </p>
              {result.recommendations.slice(0, 3).map((rec, i) => (
                <div key={i} className="flex items-start gap-2 text-xs p-2.5 rounded-lg bg-amber-500/8 border border-amber-500/20 text-amber-300">
                  <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                  <span>{recommendationLabels[rec] || rec}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ═══ DIVIDER ═══ */}
        <div className="mx-5 h-px bg-gradient-to-r from-transparent via-slate-700/60 to-transparent" />

        {/* ═══ ANTI-DETECTION MODULES — Collapsible ═══ */}
        <div className="px-5 pt-3 pb-2">
          <button
            onClick={() => setShowModules(!showModules)}
            className="w-full flex items-center justify-between group"
          >
            <span className="text-[10px] font-black text-accent uppercase tracking-widest flex items-center gap-2 font-mono">
              <span className="relative flex items-center justify-center">
                <span className="absolute w-2 h-2 rounded-full bg-accent animate-ping opacity-40" />
                <span className="relative w-1.5 h-1.5 rounded-full bg-accent" />
              </span>
              ระบบป้องกันอัตโนมัติ · 6 MODULES
            </span>
            <motion.div
              animate={{ rotate: showModules ? 180 : 0 }}
              transition={{ duration: 0.3 }}
              className="w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center"
            >
              <ChevronDown className="w-3.5 h-3.5 text-accent" />
            </motion.div>
          </button>

          <AnimatePresence>
            {showModules && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden"
              >
                <div className="pt-3 space-y-2">
                  {MODULES.map((mod, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.05 * i, duration: 0.3 }}
                      className={cn(
                        'group relative flex items-center gap-3 p-2.5 rounded-xl border transition-all duration-200 overflow-hidden',
                        'bg-slate-800/40 hover:bg-slate-800/70',
                        mod.borderColor
                      )}
                    >
                      {/* Scanning line */}
                      <motion.div
                        animate={{ left: ['-10%', '110%'] }}
                        transition={{ duration: 3, repeat: Infinity, ease: 'linear', delay: i * 0.5 }}
                        className="absolute top-0 bottom-0 w-[1px] bg-accent/15 shadow-[0_0_6px_hsl(var(--accent)/0.2)] pointer-events-none"
                      />
                      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 border', mod.bgColor, mod.borderColor)}>
                        <mod.icon className={cn('w-4 h-4', mod.color)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-bold text-slate-200 leading-tight">{mod.title}</p>
                        <p className="text-[9px] text-muted-foreground leading-tight mt-0.5">{mod.desc}</p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className={cn('text-[7px] font-black tracking-wider px-1.5 py-0.5 rounded-full border', mod.bgColor, mod.borderColor, mod.color)}>{mod.tag}</span>
                        <div className="w-4 h-4 rounded-full border-2 border-emerald-500/50 flex items-center justify-center">
                          <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                        </div>
                      </div>
                    </motion.div>
                  ))}

                  {/* Safety Tips */}
                  <div className="pt-2">
                    <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest px-1 mb-2 font-mono">
                      เคล็ดลับเพิ่มเติม
                    </p>
                    <div className="space-y-1.5">
                      {TIPS.map((tip, i) => {
                        const safe = isTipSafe(tip.key);
                        return (
                          <div
                            key={i}
                            className="flex items-start gap-2.5 p-2 rounded-lg bg-slate-800/30 border border-slate-700/30"
                          >
                            <div className="w-6 h-6 rounded-md bg-slate-700/50 flex items-center justify-center flex-shrink-0 mt-0.5">
                              <tip.icon className="w-3 h-3 text-muted-foreground" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] font-bold text-muted-foreground leading-tight flex items-center gap-1">
                                {tip.title}
                                {safe !== undefined && (
                                  safe
                                    ? <CheckCircle2 className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                                    : <AlertCircle className="w-3 h-3 text-red-400 flex-shrink-0" />
                                )}
                              </p>
                              <p className="text-[9px] text-muted-foreground leading-tight mt-0.5">{tip.desc}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Pro Tip */}
                  <div className="p-2.5 rounded-xl bg-accent/5 border border-accent/15">
                    <p className="text-[10px] text-muted-foreground leading-relaxed">
                      <span className="font-bold text-accent">Pro Tip:</span> ระบบมี Checkpoint Detection หยุดอัตโนมัติเมื่อ Facebook เตือน + Pre-post Warm-up จำลองกิจกรรมก่อนโพสต์ทุกครั้ง
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ═══ DIVIDER ═══ */}
        <div className="mx-5 h-px bg-gradient-to-r from-transparent via-slate-700/60 to-transparent" />

        {/* ═══ RISK FACTORS — Collapsible ═══ */}
        <div className="px-5 pt-3 pb-4">
          <button
            onClick={() => setShowFactors(!showFactors)}
            className="w-full flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-muted-foreground transition-colors py-1"
          >
            {showFactors ? hc.hideDetails : hc.showDetails}
            {showFactors ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          <AnimatePresence>
            {showFactors && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
              >
                <div className="pt-3 space-y-2.5">
                  {result.factors.map((factor) => {
                    const fConfig = LEVEL_CONFIG[factor.level];
                    const Icon = FACTOR_ICONS[factor.id] || Activity;
                    return (
                      <div key={factor.id} className="flex items-center gap-2.5">
                        <Icon className={cn('w-3.5 h-3.5 flex-shrink-0', fConfig.color)} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] text-muted-foreground truncate">{factorLabels[factor.id] || factor.id}</span>
                            <span className={cn('text-[10px] font-bold', fConfig.color)}>{factor.score}</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                            <motion.div
                              className={cn('h-full rounded-full', fConfig.progress)}
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.max(2, factor.score)}%` }}
                              transition={{ duration: 0.5 }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Additional Stats */}
                  <div className="pt-3 mt-2 border-t border-slate-700/40 text-xs text-muted-foreground space-y-1.5">
                    <div className="flex justify-between">
                      <span>{hc.statPostsWeek}</span>
                      <span className="font-medium text-muted-foreground">{result.stats.postsThisWeek}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{hc.statCaptionUnique}</span>
                      <span className="font-medium text-muted-foreground">
                        {result.stats.totalCaptions > 0
                          ? `${result.stats.uniqueCaptions}/${result.stats.totalCaptions} (${Math.round((result.stats.uniqueCaptions / result.stats.totalCaptions) * 100)}%)`
                          : '-'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>{hc.statAccountAge}</span>
                      <span className="font-medium text-muted-foreground">{result.stats.accountAgeDays} {hc.days}</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

      </CardContent>
    </Card>
  );
}
