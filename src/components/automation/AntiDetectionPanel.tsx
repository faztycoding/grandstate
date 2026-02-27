import { useState, useEffect } from 'react';
import { motion, AnimatePresence, useAnimationControls } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  Shield, Sparkles, ChevronDown, CheckCircle2, AlertCircle,
  Fingerprint, Eye, Zap, Timer, Users, Clock,
  Activity, Lock, Cpu, Radio
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface AntiDetectionPanelProps {
  delayBetweenPosts: number;
  selectedGroupsCount: number;
}

const MODULES = [
  {
    icon: Activity,
    color: 'text-violet-500',
    bg: 'bg-violet-500/10',
    border: 'border-violet-500/20',
    glow: 'shadow-violet-500/20',
    title: 'Gaussian Jitter Timing',
    desc: 'สุ่มจังหวะแบบระฆังคว่ำ ทำลาย Pattern',
    tag: 'TIMING',
  },
  {
    icon: Fingerprint,
    color: 'text-cyan-500',
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/20',
    glow: 'shadow-cyan-500/20',
    title: 'Fingerprint Masking',
    desc: 'ปลอม Canvas/WebGL/Audio/Font/Battery ทุก session',
    tag: 'IDENTITY',
  },
  {
    icon: Eye,
    color: 'text-blue-500',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    glow: 'shadow-blue-500/20',
    title: 'WebRTC Leak Protection',
    desc: 'ปิดกั้น IP จริง + ป้องกันรั่วไหลผ่าน WebRTC',
    tag: 'NETWORK',
  },
  {
    icon: Sparkles,
    color: 'text-amber-500',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    glow: 'shadow-amber-500/20',
    title: 'Image Hash Breaking',
    desc: 'Pixel noise + EXIF scrub ทุกรูปเปลี่ยน hash 100%',
    tag: 'MEDIA',
  },
  {
    icon: Zap,
    color: 'text-rose-500',
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/20',
    glow: 'shadow-rose-500/20',
    title: 'Micro-Interactions',
    desc: 'Scroll, hover, mouse move ก่อนโพสต์เหมือนคนจริง',
    tag: 'BEHAVIOR',
  },
  {
    icon: Cpu,
    color: 'text-emerald-500',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    glow: 'shadow-emerald-500/20',
    title: 'Typing + Typo Simulation',
    desc: 'พิมพ์ทีละตัว + พิมพ์ผิดแล้วลบแก้เหมือนมนุษย์',
    tag: 'INPUT',
  },
];

const TIPS = [
  { icon: Timer, color: 'text-blue-500', bg: 'bg-blue-500/10', title: 'ตั้ง Delay 15-30 วินาที', desc: 'ยิ่งนาน ยิ่งปลอดภัย แนะนำ 15 วิ ขึ้นไป', key: 'delay' as const },
  { icon: Users, color: 'text-purple-500', bg: 'bg-purple-500/10', title: 'ไม่เกิน 30-50 กลุ่ม/วัน', desc: 'บัญชีใหม่ควรเริ่มจาก 10-20 กลุ่ม', key: 'groups' as const },
  { icon: Clock, color: 'text-cyan-500', bg: 'bg-cyan-500/10', title: 'โพสต์ช่วง 8:00-22:00', desc: 'หลีกเลี่ยงช่วงดึก ดูไม่เป็นธรรมชาติ', key: 'time' as const },
  { icon: Shield, color: 'text-rose-500', bg: 'bg-rose-500/10', title: 'บัญชี FB อายุ 3+ เดือน', desc: 'บัญชีใหม่มากจะโดนตรวจจับง่าย', key: 'age' as const },
];

function getRiskLevel(delay: number, groups: number) {
  if (delay >= 15 && groups <= 30) return { level: 'low', label: 'ต่ำมาก', emoji: '🟢', percent: 20, color: 'emerald', gradient: 'from-emerald-500 to-green-400' };
  if (delay >= 10 && groups <= 50) return { level: 'medium', label: 'ปานกลาง', emoji: '🟡', percent: 55, color: 'amber', gradient: 'from-amber-500 to-yellow-400' };
  return { level: 'high', label: 'เสี่ยงสูง', emoji: '🔴', percent: 85, color: 'red', gradient: 'from-red-500 to-orange-400' };
}

export function AntiDetectionPanel({ delayBetweenPosts, selectedGroupsCount }: AntiDetectionPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredModule, setHoveredModule] = useState<number | null>(null);
  const pulseControls = useAnimationControls();
  const risk = getRiskLevel(delayBetweenPosts, selectedGroupsCount);

  // Attention-grabbing pulse every 4 seconds when collapsed
  useEffect(() => {
    if (isOpen) return;
    const interval = setInterval(() => {
      pulseControls.start({
        scale: [1, 1.02, 1],
        transition: { duration: 0.6, ease: 'easeInOut' },
      });
    }, 4000);
    return () => clearInterval(interval);
  }, [isOpen, pulseControls]);

  const isTipSafe = (key: string) => {
    if (key === 'delay') return delayBetweenPosts >= 15;
    if (key === 'groups') return selectedGroupsCount <= 50;
    return undefined;
  };

  return (
    <motion.div
      animate={pulseControls}
      className="relative rounded-xl overflow-hidden"
    >
      {/* Animated border glow */}
      <div className="absolute inset-0 rounded-xl p-[1px] overflow-hidden pointer-events-none z-0">
        <motion.div
          className="absolute inset-[-200%] bg-[conic-gradient(from_0deg,transparent_0%,#10b981_10%,transparent_20%)]"
          animate={{ rotate: 360 }}
          transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
          style={{ opacity: isOpen ? 0.6 : 0.3 }}
        />
      </div>

      <div className="relative z-10 rounded-xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 via-teal-500/3 to-cyan-500/5 backdrop-blur-sm overflow-hidden">

        {/* ═══ HEADER — Always visible, clickable ═══ */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center gap-3 p-3 hover:bg-emerald-500/5 transition-all duration-300 group"
        >
          {/* Shield icon with pulse ring */}
          <div className="relative w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500/20 to-teal-500/10 flex items-center justify-center flex-shrink-0">
            <Shield className="w-4.5 h-4.5 text-emerald-500" />
            <motion.span
              className="absolute inset-0 rounded-lg border-2 border-emerald-500/50"
              animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            />
            <span className="absolute -top-1 -right-1 flex items-center justify-center">
              <span className="absolute w-3 h-3 rounded-full bg-emerald-500 animate-ping opacity-50" />
              <span className="relative w-2 h-2 rounded-full bg-emerald-400" />
            </span>
          </div>

          {/* Title + subtitle */}
          <div className="flex-1 text-left">
            <p className="text-sm font-bold flex items-center gap-1.5 text-foreground">
              <Lock className="w-3 h-3 text-emerald-500" />
              ระบบป้องกันการตรวจจับ
              <Badge className="ml-1 text-[8px] px-1.5 py-0 h-4 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 font-bold tracking-wide">
                ACTIVE
              </Badge>
            </p>
            <p className="text-[10px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
              <span>6 Modules</span>
              <span className="w-0.5 h-0.5 rounded-full bg-muted-foreground/50" />
              <span>World-Class Anti-Detection</span>
              {!isOpen && (
                <motion.span
                  className="text-emerald-500 font-semibold ml-auto"
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  กดเพื่อดู →
                </motion.span>
              )}
            </p>
          </div>

          {/* Chevron */}
          <motion.div
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="w-7 h-7 rounded-full bg-emerald-500/10 flex items-center justify-center"
          >
            <ChevronDown className="w-4 h-4 text-emerald-500" />
          </motion.div>
        </button>

        {/* ═══ UNROLLING CONTENT ═══ */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              <div className="px-3 pb-3 space-y-3">

                {/* ── Risk Level Meter ── */}
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.1, duration: 0.4 }}
                  className="p-3 rounded-lg bg-background/80 border border-border/50"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                      <Radio className="w-3 h-3" />
                      ระดับความเสี่ยง
                    </span>
                    <Badge
                      variant="outline"
                      className={cn('text-[10px] font-bold px-2',
                        risk.color === 'emerald' && 'border-emerald-500/50 text-emerald-600 bg-emerald-500/10',
                        risk.color === 'amber' && 'border-amber-500/50 text-amber-600 bg-amber-500/10',
                        risk.color === 'red' && 'border-red-500/50 text-red-600 bg-red-500/10',
                      )}
                    >
                      {risk.emoji} {risk.label}
                    </Badge>
                  </div>
                  <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                    <motion.div
                      className={cn('h-full rounded-full bg-gradient-to-r', risk.gradient)}
                      initial={{ width: 0 }}
                      animate={{ width: `${risk.percent}%` }}
                      transition={{ delay: 0.3, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1.5">
                    {selectedGroupsCount} กลุ่ม • delay {delayBetweenPosts}s
                  </p>
                </motion.div>

                {/* ── Active Protection Modules ── */}
                <div>
                  <motion.p
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.15, duration: 0.4 }}
                    className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest px-1 mb-2 flex items-center gap-1.5"
                  >
                    <span className="relative flex items-center justify-center">
                      <span className="absolute w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                      <span className="relative w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    </span>
                    ระบบป้องกันอัตโนมัติ (ACTIVE)
                  </motion.p>

                  <div className="space-y-1.5">
                    {MODULES.map((mod, i) => (
                      <motion.div
                        key={i}
                        initial={{ x: -30, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: 0.2 + i * 0.07, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                        onMouseEnter={() => setHoveredModule(i)}
                        onMouseLeave={() => setHoveredModule(null)}
                        className={cn(
                          'flex items-center gap-2.5 p-2 rounded-lg border transition-all duration-300 cursor-default',
                          'bg-emerald-500/[0.03] border-emerald-500/10',
                          hoveredModule === i && 'bg-emerald-500/[0.08] border-emerald-500/30 shadow-sm',
                        )}
                      >
                        {/* Icon */}
                        <motion.div
                          className={cn('w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 border', mod.bg, mod.border)}
                          animate={hoveredModule === i ? { scale: [1, 1.15, 1] } : {}}
                          transition={{ duration: 0.3 }}
                        >
                          <mod.icon className={cn('w-3.5 h-3.5', mod.color)} />
                        </motion.div>

                        {/* Text */}
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-bold leading-tight">{mod.title}</p>
                          <p className="text-[9px] text-muted-foreground leading-tight mt-0.5">{mod.desc}</p>
                        </div>

                        {/* Tag + Check */}
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <span className={cn('text-[7px] font-bold tracking-wider px-1.5 py-0.5 rounded-full', mod.bg, mod.color)}>
                            {mod.tag}
                          </span>
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: 0.4 + i * 0.07, type: 'spring', stiffness: 300 }}
                          >
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          </motion.div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>

                {/* ── Tips Section ── */}
                <div>
                  <motion.p
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.6, duration: 0.4 }}
                    className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-1 mb-2"
                  >
                    เคล็ดลับเพิ่มเติม
                  </motion.p>

                  <div className="space-y-1.5">
                    {TIPS.map((tip, i) => {
                      const safe = isTipSafe(tip.key);
                      return (
                        <motion.div
                          key={i}
                          initial={{ x: -20, opacity: 0 }}
                          animate={{ x: 0, opacity: 1 }}
                          transition={{ delay: 0.65 + i * 0.06, duration: 0.4 }}
                          className="flex items-start gap-2.5 p-2 rounded-lg bg-background/60 border border-border/30 hover:bg-background/90 transition-colors"
                        >
                          <div className={cn('w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5', tip.bg)}>
                            <tip.icon className={cn('w-3 h-3', tip.color)} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-bold leading-tight flex items-center gap-1">
                              {tip.title}
                              {safe !== undefined && (
                                safe
                                  ? <CheckCircle2 className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                                  : <AlertCircle className="w-3 h-3 text-amber-500 flex-shrink-0" />
                              )}
                            </p>
                            <p className="text-[9px] text-muted-foreground leading-tight mt-0.5">{tip.desc}</p>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>

                {/* ── Pro Tip Footer ── */}
                <motion.div
                  initial={{ y: 15, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.9, duration: 0.4 }}
                  className="relative p-2.5 rounded-lg overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-amber-500/10 via-orange-500/8 to-amber-500/10" />
                  <div className="absolute inset-0 border border-amber-500/20 rounded-lg" />
                  <p className="relative text-[10px] text-amber-700 dark:text-amber-400 leading-relaxed">
                    <span className="font-bold">💡 Pro Tip:</span> ระบบมี Checkpoint Detection หยุดอัตโนมัติเมื่อ Facebook เตือน + Pre-post Warm-up จำลองกิจกรรมก่อนโพสต์ทุกครั้ง
                  </p>
                </motion.div>

              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
