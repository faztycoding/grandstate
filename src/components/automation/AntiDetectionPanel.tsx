import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  Shield, Sparkles, ChevronDown, CheckCircle2, AlertCircle,
  Fingerprint, Eye, Zap, Timer, Users, Clock,
  Activity, Lock, Cpu, Radio
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { HealthCheckResult } from '@/hooks/useHealthCheck';

interface AntiDetectionPanelProps {
  delayBetweenPosts: number;
  selectedGroupsCount: number;
  healthResult?: HealthCheckResult;
}

const MODULES = [
  { icon: Activity, color: 'text-accent', title: 'Gaussian Jitter Timing', desc: 'สุ่มจังหวะแบบระฆังคว่ำ ทำลาย Pattern', tag: 'TIMING' },
  { icon: Fingerprint, color: 'text-accent', title: 'Fingerprint Masking', desc: 'ปลอม Canvas/WebGL/Audio/Font/Battery ทุก session', tag: 'IDENTITY' },
  { icon: Eye, color: 'text-accent', title: 'WebRTC Leak Protection', desc: 'ปิดกั้น IP จริง + ป้องกันรั่วไหลผ่าน WebRTC', tag: 'NETWORK' },
  { icon: Sparkles, color: 'text-accent', title: 'Image Hash Breaking', desc: 'Pixel noise + EXIF scrub ทุกรูปเปลี่ยน hash 100%', tag: 'MEDIA' },
  { icon: Zap, color: 'text-accent', title: 'Micro-Interactions', desc: 'Scroll, hover, mouse move ก่อนโพสต์เหมือนคนจริง', tag: 'BEHAVIOR' },
  { icon: Cpu, color: 'text-accent', title: 'Typing + Typo Simulation', desc: 'พิมพ์ทีละตัว + พิมพ์ผิดแล้วลบแก้เหมือนมนุษย์', tag: 'INPUT' },
];

const TIPS = [
  { icon: Timer, title: 'ตั้ง Delay 15-30 วินาที', desc: 'ยิ่งนาน ยิ่งปลอดภัย แนะนำ 15 วิ ขึ้นไป', key: 'delay' as const },
  { icon: Users, title: 'ไม่เกิน 30-50 กลุ่ม/วัน', desc: 'บัญชีใหม่ควรเริ่มจาก 10-20 กลุ่ม', key: 'groups' as const },
  { icon: Clock, title: 'โพสต์ช่วง 8:00-22:00', desc: 'หลีกเลี่ยงช่วงดึก ดูไม่เป็นธรรมชาติ', key: 'time' as const },
  { icon: Shield, title: 'บัญชี FB อายุ 3+ เดือน', desc: 'บัญชีใหม่มากจะโดนตรวจจับง่าย', key: 'age' as const },
];

function getRiskLevel(delay: number, groups: number) {
  if (delay >= 15 && groups <= 30) return { level: 'low', label: 'ต่ำมาก', emoji: '🟢', percent: 20, color: 'emerald', gradient: 'from-emerald-500 to-green-400' };
  if (delay >= 10 && groups <= 50) return { level: 'medium', label: 'ปานกลาง', emoji: '🟡', percent: 55, color: 'amber', gradient: 'from-amber-500 to-yellow-400' };
  return { level: 'high', label: 'เสี่ยงสูง', emoji: '🔴', percent: 85, color: 'red', gradient: 'from-red-500 to-orange-400' };
}

export function AntiDetectionPanel({ delayBetweenPosts, selectedGroupsCount, healthResult }: AntiDetectionPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const staticRisk = getRiskLevel(delayBetweenPosts, selectedGroupsCount);

  // Use real-time health data if available, otherwise fall back to static
  const hasRealData = healthResult && healthResult.stats.postsToday > 0;
  const risk = hasRealData ? {
    level: healthResult.overallLevel === 'safe' ? 'low' : healthResult.overallLevel === 'moderate' ? 'medium' : 'high',
    label: healthResult.overallLevel === 'safe' ? 'ปลอดภัย' : healthResult.overallLevel === 'moderate' ? 'ปานกลาง' : healthResult.overallLevel === 'high' ? 'เสี่ยงสูง' : 'วิกฤต',
    emoji: healthResult.overallLevel === 'safe' ? '🟢' : healthResult.overallLevel === 'moderate' ? '🟡' : healthResult.overallLevel === 'high' ? '🟠' : '🔴',
    percent: healthResult.overallScore,
    color: healthResult.overallLevel === 'safe' ? 'emerald' : healthResult.overallLevel === 'moderate' ? 'amber' : healthResult.overallLevel === 'critical' ? 'red' : 'red',
    gradient: healthResult.overallLevel === 'safe' ? 'from-emerald-500 to-green-400' : healthResult.overallLevel === 'moderate' ? 'from-amber-500 to-yellow-400' : healthResult.overallLevel === 'high' ? 'from-orange-500 to-amber-400' : 'from-red-500 to-orange-400',
  } : staticRisk;

  const isTipSafe = (key: string) => {
    if (key === 'delay') return delayBetweenPosts >= 15;
    if (key === 'groups') return selectedGroupsCount <= 50;
    return undefined;
  };

  return (
    <div className="relative">
      {/* ═══ HEADER ═══ */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'w-full rounded-xl border overflow-hidden transition-all duration-300',
          'bg-gradient-to-r from-[hsl(var(--accent)/0.08)] via-[hsl(var(--accent)/0.04)] to-[hsl(var(--accent)/0.08)]',
          isOpen
            ? 'border-[hsl(var(--accent)/0.4)] rounded-b-none shadow-[0_0_15px_hsl(var(--accent)/0.08)]'
            : 'border-[hsl(var(--accent)/0.2)] hover:border-[hsl(var(--accent)/0.4)] hover:shadow-md',
        )}
      >
        <div className="flex items-center gap-3 p-3">
          <div className="relative w-9 h-9 rounded-lg bg-accent flex items-center justify-center flex-shrink-0 shadow-[0_0_12px_hsl(var(--accent)/0.3)]">
            <Shield className="w-4 h-4 text-accent-foreground" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-bold flex items-center gap-1.5 text-foreground">
              <Lock className="w-3 h-3 text-accent" />
              ระบบป้องกันการตรวจจับ
              <Badge className="ml-1 text-[8px] px-1.5 py-0 h-4 bg-[hsl(var(--accent)/0.12)] text-accent border-[hsl(var(--accent)/0.25)] font-bold tracking-wide">
                ACTIVE
              </Badge>
            </p>
            <p className="text-[10px] text-muted-foreground flex items-center gap-1.5 mt-0.5 font-mono">
              {hasRealData ? `Score ${healthResult.overallScore}/100 · ` : ''}6 Modules · World-Class Anti-Detection
            </p>
          </div>
          <motion.div
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ duration: 0.3 }}
            className="w-7 h-7 rounded-full bg-[hsl(var(--accent)/0.12)] flex items-center justify-center flex-shrink-0"
          >
            <ChevronDown className="w-4 h-4 text-accent" />
          </motion.div>
        </div>
      </button>

      {/* ═══ BLUEPRINT SLIDE-DOWN CONTENT ═══ */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="relative border-x border-b border-[hsl(var(--accent)/0.2)] rounded-b-xl bg-card/95 backdrop-blur-sm">
              {/* Blueprint grid background */}
              <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.06] pointer-events-none" style={{
                backgroundImage: 'linear-gradient(hsl(var(--accent) / 0.6) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--accent) / 0.6) 1px, transparent 1px)',
                backgroundSize: '24px 24px',
              }} />

              <div className="relative px-3 py-3 space-y-3">

                {/* ── Risk Level ── */}
                <motion.div
                  initial={{ opacity: 0, x: -15 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1, duration: 0.4 }}
                  className="p-2.5 rounded-lg bg-muted/40 border border-border/50"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5 font-mono">
                      <Radio className="w-3 h-3" />
                      ระดับความเสี่ยง
                    </span>
                    <Badge variant="outline" className={cn('text-[10px] font-bold px-2',
                      risk.color === 'emerald' && 'border-emerald-500/50 text-emerald-600 bg-emerald-500/10',
                      risk.color === 'amber' && 'border-accent/50 text-accent bg-[hsl(var(--accent)/0.1)]',
                      risk.color === 'red' && 'border-red-500/50 text-red-600 bg-red-500/10',
                    )}>
                      {risk.emoji} {risk.label}
                    </Badge>
                  </div>
                  <div className="w-full h-2 rounded-full bg-muted/50 overflow-hidden">
                    <motion.div
                      className={cn('h-full rounded-full bg-gradient-to-r', risk.gradient)}
                      initial={{ width: 0 }}
                      animate={{ width: `${risk.percent}%` }}
                      transition={{ delay: 0.3, duration: 0.8, ease: 'easeOut' }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1 font-mono">
                    {hasRealData
                      ? `${healthResult.stats.postsToday} โพสต์วันนี้ · ${healthResult.stats.postsThisHour} โพสต์/ชม. · delay ${healthResult.stats.avgDelayMinutes < 999 ? `${healthResult.stats.avgDelayMinutes}m` : '-'}`
                      : `${selectedGroupsCount} กลุ่ม · delay ${delayBetweenPosts}s`
                    }
                  </p>
                  {hasRealData && (
                    <div className="grid grid-cols-3 gap-1.5 mt-2">
                      <div className="text-center p-1.5 rounded-md bg-muted/30 border border-border/30">
                        <p className="text-sm font-bold text-foreground">{healthResult.stats.postsToday}</p>
                        <p className="text-[8px] text-muted-foreground">โพสต์วันนี้</p>
                      </div>
                      <div className="text-center p-1.5 rounded-md bg-muted/30 border border-border/30">
                        <p className="text-sm font-bold text-foreground">{healthResult.stats.postsThisHour}</p>
                        <p className="text-[8px] text-muted-foreground">โพสต์/ชั่วโมง</p>
                      </div>
                      <div className="text-center p-1.5 rounded-md bg-muted/30 border border-border/30">
                        <p className="text-sm font-bold text-foreground">{healthResult.stats.avgDelayMinutes < 999 ? `${healthResult.stats.avgDelayMinutes}m` : '-'}</p>
                        <p className="text-[8px] text-muted-foreground">ห่างเฉลี่ย</p>
                      </div>
                    </div>
                  )}
                </motion.div>

                {/* ── Active Modules ── */}
                <div>
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.15 }}
                    className="text-[10px] font-bold text-accent uppercase tracking-widest px-1 mb-2 flex items-center gap-1.5 font-mono"
                  >
                    <span className="relative flex items-center justify-center">
                      <span className="absolute w-2 h-2 rounded-full bg-accent animate-ping opacity-40" />
                      <span className="relative w-1.5 h-1.5 rounded-full bg-accent" />
                    </span>
                    ระบบป้องกันอัตโนมัติ (ACTIVE)
                  </motion.p>

                  <div className="space-y-1.5">
                    {MODULES.map((mod, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -15 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2 + i * 0.07, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                        className="group relative flex items-center gap-2.5 p-2 rounded-lg bg-muted/20 border border-border/30 hover:border-[hsl(var(--accent)/0.3)] hover:bg-muted/40 transition-all duration-200 overflow-hidden"
                      >
                        {/* Scanning line */}
                        <motion.div
                          animate={{ left: ['-10%', '110%'] }}
                          transition={{ duration: 3, repeat: Infinity, ease: 'linear', delay: i * 0.5 }}
                          className="absolute top-0 bottom-0 w-[1px] bg-accent/20 shadow-[0_0_6px_hsl(var(--accent)/0.3)] pointer-events-none"
                        />
                        <div className="w-7 h-7 rounded-lg bg-[hsl(var(--accent)/0.08)] border border-[hsl(var(--accent)/0.15)] flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                          <mod.icon className={cn('w-3.5 h-3.5', mod.color)} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-bold leading-tight">{mod.title}</p>
                          <p className="text-[9px] text-muted-foreground leading-tight mt-0.5">{mod.desc}</p>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <span className="text-[7px] font-bold tracking-wider px-1.5 py-0.5 rounded-full bg-[hsl(var(--accent)/0.08)] text-accent border border-[hsl(var(--accent)/0.15)]">{mod.tag}</span>
                          <div className="w-4 h-4 rounded-full border-2 border-emerald-500/60 flex items-center justify-center">
                            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>

                {/* ── Divider ── */}
                <motion.div
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ delay: 0.7, duration: 0.5 }}
                  className="h-px bg-gradient-to-r from-transparent via-accent/20 to-transparent"
                />

                {/* ── Tips ── */}
                <div>
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.75 }}
                    className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-1 mb-2 font-mono"
                  >
                    เคล็ดลับเพิ่มเติม
                  </motion.p>

                  <div className="space-y-1.5">
                    {TIPS.map((tip, i) => {
                      const safe = isTipSafe(tip.key);
                      return (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, x: -12 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.8 + i * 0.07, duration: 0.35 }}
                          className="flex items-start gap-2.5 p-2 rounded-lg bg-muted/20 border border-border/20 hover:bg-muted/30 transition-colors"
                        >
                          <div className="w-6 h-6 rounded-lg bg-muted/50 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <tip.icon className="w-3 h-3 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-bold leading-tight flex items-center gap-1">
                              {tip.title}
                              {safe !== undefined && (
                                safe
                                  ? <CheckCircle2 className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                                  : <AlertCircle className="w-3 h-3 text-red-400 flex-shrink-0" />
                              )}
                            </p>
                            <p className="text-[9px] text-muted-foreground leading-tight mt-0.5">{tip.desc}</p>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>

                {/* ── Pro Tip ── */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.1, duration: 0.4 }}
                  className="p-2.5 rounded-lg bg-[hsl(var(--accent)/0.06)] border border-[hsl(var(--accent)/0.15)]"
                >
                  <p className="text-[10px] text-foreground/80 leading-relaxed">
                    <span className="font-bold text-accent">💡 Pro Tip:</span> ระบบมี Checkpoint Detection หยุดอัตโนมัติเมื่อ Facebook เตือน + Pre-post Warm-up จำลองกิจกรรมก่อนโพสต์ทุกครั้ง
                  </p>
                </motion.div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
