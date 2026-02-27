import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useAnimationControls } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  Shield, Sparkles, ChevronUp, CheckCircle2, AlertCircle,
  Fingerprint, Eye, Zap, Timer, Users, Clock,
  Activity, Lock, Cpu, Radio
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface AntiDetectionPanelProps {
  delayBetweenPosts: number;
  selectedGroupsCount: number;
}

const MODULES = [
  { icon: Activity, color: 'text-violet-500', bg: 'bg-violet-500/10', border: 'border-violet-500/20', title: 'Gaussian Jitter Timing', desc: 'สุ่มจังหวะแบบระฆังคว่ำ ทำลาย Pattern', tag: 'TIMING' },
  { icon: Fingerprint, color: 'text-cyan-500', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20', title: 'Fingerprint Masking', desc: 'ปลอม Canvas/WebGL/Audio/Font/Battery ทุก session', tag: 'IDENTITY' },
  { icon: Eye, color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/20', title: 'WebRTC Leak Protection', desc: 'ปิดกั้น IP จริง + ป้องกันรั่วไหลผ่าน WebRTC', tag: 'NETWORK' },
  { icon: Sparkles, color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/20', title: 'Image Hash Breaking', desc: 'Pixel noise + EXIF scrub ทุกรูปเปลี่ยน hash 100%', tag: 'MEDIA' },
  { icon: Zap, color: 'text-rose-500', bg: 'bg-rose-500/10', border: 'border-rose-500/20', title: 'Micro-Interactions', desc: 'Scroll, hover, mouse move ก่อนโพสต์เหมือนคนจริง', tag: 'BEHAVIOR' },
  { icon: Cpu, color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', title: 'Typing + Typo Simulation', desc: 'พิมพ์ทีละตัว + พิมพ์ผิดแล้วลบแก้เหมือนมนุษย์', tag: 'INPUT' },
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

// Premium wooden scroll roller
function ScrollRoller({ side }: { side: 'top' | 'bottom' }) {
  return (
    <div className={cn('relative w-full h-6 z-20', side === 'top' ? '-mb-0.5' : '-mt-0.5')}>
      <svg viewBox="0 0 400 28" className="w-full h-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id={`wood-${side}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#5c3d2e" />
            <stop offset="15%" stopColor="#8b6914" />
            <stop offset="35%" stopColor="#a67c3a" />
            <stop offset="50%" stopColor="#c49a52" />
            <stop offset="65%" stopColor="#a67c3a" />
            <stop offset="85%" stopColor="#8b6914" />
            <stop offset="100%" stopColor="#4a3222" />
          </linearGradient>
          <linearGradient id={`wood-hi-${side}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fff" stopOpacity="0" />
            <stop offset="30%" stopColor="#fff" stopOpacity="0.15" />
            <stop offset="50%" stopColor="#fff" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#000" stopOpacity="0.12" />
          </linearGradient>
          <linearGradient id={`knob-${side}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#c49a52" />
            <stop offset="50%" stopColor="#8b6914" />
            <stop offset="100%" stopColor="#5c3d2e" />
          </linearGradient>
        </defs>
        {/* Main roller body */}
        <rect x="8" y="4" width="384" height="20" rx="10" fill={`url(#wood-${side})`} />
        <rect x="8" y="4" width="384" height="20" rx="10" fill={`url(#wood-hi-${side})`} />
        {/* Wood grain lines */}
        <line x1="30" y1="8" x2="370" y2="8" stroke="#5c3d2e" strokeWidth="0.5" opacity="0.15" />
        <line x1="40" y1="14" x2="360" y2="14" stroke="#5c3d2e" strokeWidth="0.3" opacity="0.1" />
        <line x1="30" y1="20" x2="370" y2="20" stroke="#5c3d2e" strokeWidth="0.5" opacity="0.15" />
        {/* End caps / knobs */}
        <circle cx="14" cy="14" r="8" fill={`url(#knob-${side})`} />
        <circle cx="386" cy="14" r="8" fill={`url(#knob-${side})`} />
        <circle cx="14" cy="13" r="4" fill="#c49a52" opacity="0.6" />
        <circle cx="386" cy="13" r="4" fill="#c49a52" opacity="0.6" />
        <circle cx="14" cy="12" r="1.5" fill="#e8d5a8" opacity="0.4" />
        <circle cx="386" cy="12" r="1.5" fill="#e8d5a8" opacity="0.4" />
      </svg>
    </div>
  );
}

export function AntiDetectionPanel({ delayBetweenPosts, selectedGroupsCount }: AntiDetectionPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [contentVisible, setContentVisible] = useState(false);
  const pulseControls = useAnimationControls();
  const risk = getRiskLevel(delayBetweenPosts, selectedGroupsCount);
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState(0);

  useEffect(() => {
    if (isOpen && contentRef.current) {
      const h = contentRef.current.scrollHeight;
      setContentHeight(h);
      const timer = setTimeout(() => setContentVisible(true), 100);
      return () => clearTimeout(timer);
    } else {
      setContentVisible(false);
      setContentHeight(0);
    }
  }, [isOpen]);

  // Pulse when collapsed
  useEffect(() => {
    if (isOpen) return;
    const interval = setInterval(() => {
      pulseControls.start({ scale: [1, 1.015, 1], transition: { duration: 0.5, ease: 'easeInOut' } });
    }, 3500);
    return () => clearInterval(interval);
  }, [isOpen, pulseControls]);

  const isTipSafe = (key: string) => {
    if (key === 'delay') return delayBetweenPosts >= 15;
    if (key === 'groups') return selectedGroupsCount <= 50;
    return undefined;
  };

  return (
    <motion.div animate={pulseControls} className="relative">
      {/* ═══ HEADER — Estate theme ═══ */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'w-full rounded-xl border overflow-hidden transition-all duration-300',
          'bg-gradient-to-br from-amber-500/8 via-orange-500/5 to-yellow-500/8',
          isOpen ? 'border-amber-600/40 rounded-b-none' : 'border-amber-500/25 hover:border-amber-500/50 hover:shadow-md hover:shadow-amber-500/10',
        )}
      >
        <div className="flex items-center gap-3 p-3">
          {/* Shield icon */}
          <div className="relative w-9 h-9 rounded-lg bg-gradient-to-br from-amber-500/25 to-orange-500/15 flex items-center justify-center flex-shrink-0">
            <Shield className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span className="absolute -top-1 -right-1 flex items-center justify-center">
              <span className="absolute w-3 h-3 rounded-full bg-amber-500 animate-ping opacity-40" />
              <span className="relative w-2 h-2 rounded-full bg-amber-400" />
            </span>
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-bold flex items-center gap-1.5 text-foreground">
              <Lock className="w-3 h-3 text-amber-600 dark:text-amber-400" />
              ระบบป้องกันการตรวจจับ
              <Badge className="ml-1 text-[8px] px-1.5 py-0 h-4 bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 font-bold tracking-wide">
                ACTIVE
              </Badge>
            </p>
            <p className="text-[10px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
              <span>6 Modules</span>
              <span className="w-0.5 h-0.5 rounded-full bg-muted-foreground/50" />
              <span>World-Class Anti-Detection</span>
            </p>
          </div>
          <motion.div
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ duration: 0.3 }}
            className="w-7 h-7 rounded-full bg-amber-500/15 flex items-center justify-center flex-shrink-0"
          >
            <ChevronUp className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </motion.div>
        </div>
      </button>

      {/* ═══ SCROLL / PARCHMENT UNROLLING ═══ */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: contentHeight || 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{
              height: { duration: 0.8, ease: [0.22, 0.61, 0.36, 1] },
              opacity: { duration: 0.3 },
            }}
            className="overflow-hidden relative"
          >
            {/* Top scroll roller */}
            <ScrollRoller side="top" />

            {/* Parchment body — warm estate parchment */}
            <div
              ref={contentRef}
              className={cn(
                'relative border-x border-amber-700/20',
                'bg-gradient-to-b from-[#fdf6e3] via-[#faf0d4] to-[#fdf6e3]',
                'dark:from-[#1c1810] dark:via-[#201c14] dark:to-[#1c1810]',
              )}
              style={{
                backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'%23a67c3a\' fill-opacity=\'0.03\'%3E%3Cpath d=\'M0 0h30v30H0zM30 30h30v30H30z\'/%3E%3C/g%3E%3C/svg%3E")',
              }}
            >
              {/* Paper edge shadow */}
              <div className="absolute inset-x-0 top-0 h-4 bg-gradient-to-b from-amber-900/[0.08] to-transparent dark:from-black/20 pointer-events-none z-10" />

              <div className="px-3 py-3 space-y-3">

                {/* ── Risk Level ── */}
                <motion.div
                  initial={{ scaleY: 0, opacity: 0, originY: 0 }}
                  animate={contentVisible ? { scaleY: 1, opacity: 1 } : {}}
                  transition={{ delay: 0.1, duration: 0.4 }}
                  className="p-2.5 rounded-lg bg-white/50 dark:bg-white/5 border border-amber-500/20"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                      <Radio className="w-3 h-3" />
                      ระดับความเสี่ยง
                    </span>
                    <Badge variant="outline" className={cn('text-[10px] font-bold px-2',
                      risk.color === 'emerald' && 'border-emerald-500/50 text-emerald-600 bg-emerald-500/10',
                      risk.color === 'amber' && 'border-amber-500/50 text-amber-600 bg-amber-500/10',
                      risk.color === 'red' && 'border-red-500/50 text-red-600 bg-red-500/10',
                    )}>
                      {risk.emoji} {risk.label}
                    </Badge>
                  </div>
                  <div className="w-full h-2 rounded-full bg-muted/50 overflow-hidden">
                    <motion.div
                      className={cn('h-full rounded-full bg-gradient-to-r', risk.gradient)}
                      initial={{ width: 0 }}
                      animate={contentVisible ? { width: `${risk.percent}%` } : {}}
                      transition={{ delay: 0.3, duration: 0.8 }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">{selectedGroupsCount} กลุ่ม • delay {delayBetweenPosts}s</p>
                </motion.div>

                {/* ── Active Modules ── */}
                <div>
                  <motion.p
                    initial={{ x: -15, opacity: 0 }}
                    animate={contentVisible ? { x: 0, opacity: 1 } : {}}
                    transition={{ delay: 0.15 }}
                    className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-widest px-1 mb-2 flex items-center gap-1.5"
                  >
                    <span className="relative flex items-center justify-center">
                      <span className="absolute w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                      <span className="relative w-1.5 h-1.5 rounded-full bg-amber-500" />
                    </span>
                    ระบบป้องกันอัตโนมัติ (ACTIVE)
                  </motion.p>

                  <div className="space-y-1.5">
                    {MODULES.map((mod, i) => (
                      <motion.div
                        key={i}
                        initial={{ x: -25, opacity: 0, filter: 'blur(4px)' }}
                        animate={contentVisible ? { x: 0, opacity: 1, filter: 'blur(0px)' } : {}}
                        transition={{ delay: 0.2 + i * 0.08, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                        className="flex items-center gap-2.5 p-2 rounded-lg bg-white/40 dark:bg-white/[0.03] border border-amber-600/10 hover:bg-white/70 dark:hover:bg-white/[0.06] hover:border-amber-500/30 transition-all duration-200"
                      >
                        <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 border', mod.bg, mod.border)}>
                          <mod.icon className={cn('w-3.5 h-3.5', mod.color)} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-bold leading-tight text-foreground">{mod.title}</p>
                          <p className="text-[9px] text-muted-foreground leading-tight mt-0.5">{mod.desc}</p>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <span className={cn('text-[7px] font-bold tracking-wider px-1.5 py-0.5 rounded-full', mod.bg, mod.color)}>{mod.tag}</span>
                          <motion.div
                            initial={{ scale: 0, rotate: -90 }}
                            animate={contentVisible ? { scale: 1, rotate: 0 } : {}}
                            transition={{ delay: 0.45 + i * 0.08, type: 'spring', stiffness: 400, damping: 15 }}
                          >
                            <CheckCircle2 className="w-4 h-4 text-amber-500" />
                          </motion.div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>

                {/* ── Divider ── */}
                <motion.div
                  initial={{ scaleX: 0 }}
                  animate={contentVisible ? { scaleX: 1 } : {}}
                  transition={{ delay: 0.7, duration: 0.5 }}
                  className="h-px bg-gradient-to-r from-transparent via-amber-600/30 to-transparent"
                />

                {/* ── Tips ── */}
                <div>
                  <motion.p
                    initial={{ x: -15, opacity: 0 }}
                    animate={contentVisible ? { x: 0, opacity: 1 } : {}}
                    transition={{ delay: 0.65 }}
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
                          initial={{ y: 10, opacity: 0 }}
                          animate={contentVisible ? { y: 0, opacity: 1 } : {}}
                          transition={{ delay: 0.7 + i * 0.06, duration: 0.35 }}
                          className="flex items-start gap-2.5 p-2 rounded-lg bg-white/40 dark:bg-white/[0.03] border border-border/20 hover:bg-white/70 dark:hover:bg-white/[0.06] transition-colors"
                        >
                          <div className={cn('w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5', tip.bg)}>
                            <tip.icon className={cn('w-3 h-3', tip.color)} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-bold leading-tight flex items-center gap-1">
                              {tip.title}
                              {safe !== undefined && (
                                safe
                                  ? <CheckCircle2 className="w-3 h-3 text-amber-500 flex-shrink-0" />
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
                  initial={{ y: 10, opacity: 0 }}
                  animate={contentVisible ? { y: 0, opacity: 1 } : {}}
                  transition={{ delay: 1, duration: 0.4 }}
                  className="p-2.5 rounded-lg bg-amber-500/10 dark:bg-amber-500/5 border border-amber-500/20"
                >
                  <p className="text-[10px] text-amber-800 dark:text-amber-400 leading-relaxed">
                    <span className="font-bold">💡 Pro Tip:</span> ระบบมี Checkpoint Detection หยุดอัตโนมัติเมื่อ Facebook เตือน + Pre-post Warm-up จำลองกิจกรรมก่อนโพสต์ทุกครั้ง
                  </p>
                </motion.div>
              </div>

              {/* Paper edge shadow bottom */}
              <div className="absolute inset-x-0 bottom-0 h-4 bg-gradient-to-t from-amber-900/[0.08] to-transparent dark:from-black/20 pointer-events-none z-10" />
            </div>

            {/* Bottom scroll roller */}
            <ScrollRoller side="bottom" />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
