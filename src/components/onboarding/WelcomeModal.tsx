import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Building2, Users, Zap, ShieldCheck, ChevronRight, Crosshair, Database, Radio, Cpu, Shield, BarChart3 } from 'lucide-react';

const ONBOARDING_KEY = 'grandstate_onboarded';

/* ────────────────────────────────────────────
   Typewriter hook — characters appear one by one
   ──────────────────────────────────────────── */
function useTypewriter(text: string, speed = 30, active = true) {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!active) { setDisplayed(''); setDone(false); return; }
    setDisplayed('');
    setDone(false);
    let i = 0;
    const iv = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) { clearInterval(iv); setDone(true); }
    }, speed);
    return () => clearInterval(iv);
  }, [text, speed, active]);
  return { displayed, done };
}

/* ────────────────────────────────────────────
   Step definitions
   ──────────────────────────────────────────── */
interface MachineStep {
  phase: string;
  sysLabel: string;
  title: string;
  desc: string;
  icon: React.ElementType;
  statusTag: string;
  color: string; // cyan / amber / emerald / purple
}

const STEPS: MachineStep[] = [
  {
    phase: 'PHASE 01',
    sysLabel: 'ASSET DATABASE',
    title: 'ระบบจัดการสินทรัพย์',
    desc: 'เพิ่มข้อมูลอสังหาฯ ราคา รูปภาพ สิ่งอำนวยความสะดวก — ข้อมูล Sync ข้ามอุปกรณ์ผ่าน Cloud',
    icon: Database,
    statusTag: 'READY',
    color: 'cyan',
  },
  {
    phase: 'PHASE 02',
    sysLabel: 'GROUP NETWORK',
    title: 'เชื่อมต่อกลุ่ม Facebook',
    desc: 'เพิ่มกลุ่มเป้าหมายได้สูงสุด 750 กลุ่ม — ระบบวิเคราะห์ช่วงเวลาที่เหมาะสมในการโพสต์',
    icon: Users,
    statusTag: 'LINKED',
    color: 'purple',
  },
  {
    phase: 'PHASE 03',
    sysLabel: 'DISTRIBUTION MODULE',
    title: 'Automation Engine',
    desc: 'AI สร้างแคปชัน + Anti-Detection หลีกเลี่ยงการบล็อก + ตั้งเวลาโพสต์อัตโนมัติ 24/7',
    icon: Zap,
    statusTag: 'ARMED',
    color: 'amber',
  },
  {
    phase: 'PHASE 04',
    sysLabel: 'SHIELD PROTOCOL',
    title: 'ระบบป้องกัน & วิเคราะห์',
    desc: 'Anti-Detection 6 ชั้น + สถิติวิเคราะห์ผลงานแบบ Realtime — ปลอดภัยทุกบัญชี',
    icon: Shield,
    statusTag: 'ACTIVE',
    color: 'emerald',
  },
];

const colorMap: Record<string, { border: string; text: string; bg: string; glow: string }> = {
  cyan:    { border: 'border-cyan-500/40',    text: 'text-cyan-400',    bg: 'bg-cyan-500/10',    glow: 'shadow-cyan-500/20' },
  purple:  { border: 'border-purple-500/40',  text: 'text-purple-400',  bg: 'bg-purple-500/10',  glow: 'shadow-purple-500/20' },
  amber:   { border: 'border-amber-500/40',   text: 'text-amber-400',   bg: 'bg-amber-500/10',   glow: 'shadow-amber-500/20' },
  emerald: { border: 'border-emerald-500/40', text: 'text-emerald-400', bg: 'bg-emerald-500/10', glow: 'shadow-emerald-500/20' },
};

/* ────────────────────────────────────────────
   Radar SVG
   ──────────────────────────────────────────── */
function RadarSVG() {
  return (
    <svg viewBox="0 0 120 120" className="w-20 h-20">
      <circle cx="60" cy="60" r="55" fill="none" stroke="rgba(34,211,238,0.15)" strokeWidth="1" />
      <circle cx="60" cy="60" r="38" fill="none" stroke="rgba(34,211,238,0.1)" strokeWidth="0.5" />
      <circle cx="60" cy="60" r="20" fill="none" stroke="rgba(34,211,238,0.08)" strokeWidth="0.5" />
      <line x1="60" y1="5" x2="60" y2="115" stroke="rgba(34,211,238,0.08)" strokeWidth="0.5" />
      <line x1="5" y1="60" x2="115" y2="60" stroke="rgba(34,211,238,0.08)" strokeWidth="0.5" />
      <g style={{ transformOrigin: '60px 60px', animation: 'radar-sweep 3s linear infinite' }}>
        <line x1="60" y1="60" x2="60" y2="5" stroke="rgba(34,211,238,0.6)" strokeWidth="1.5" />
        <path d="M60,60 L52,10 A55,55 0 0,1 60,5 Z" fill="rgba(34,211,238,0.08)" />
      </g>
      <circle cx="60" cy="60" r="3" fill="#22d3ee" opacity="0.8" />
    </svg>
  );
}

/* ════════════════════════════════════════════
   MAIN COMPONENT
   ════════════════════════════════════════════ */
export function WelcomeModal() {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<'boot' | 'steps' | 'complete'>('boot');
  const [step, setStep] = useState(0);
  const [bootLine, setBootLine] = useState(0);
  const [showFlash, setShowFlash] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const isNewUser = localStorage.getItem('grandstate_is_new_user');
    const alreadyOnboarded = localStorage.getItem(ONBOARDING_KEY);
    if (isNewUser && !alreadyOnboarded) setOpen(true);
  }, []);

  // Boot sequence lines
  const bootLines = [
    '[ SYSTEM: INITIALIZING... ]',
    '[ GRAND$TATE CORE v1.0 ]',
    '[ NEURAL LINK: ESTABLISHING... ]',
    '[ CONNECTION: SECURED ]',
    '[ STATUS: ALL SYSTEMS NOMINAL ]',
    '[ NEURAL LINK ESTABLISHED ]',
  ];

  useEffect(() => {
    if (!open || phase !== 'boot') return;
    if (bootLine >= bootLines.length) {
      const t = setTimeout(() => setPhase('steps'), 600);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setBootLine(prev => prev + 1), 400);
    return () => clearTimeout(t);
  }, [open, phase, bootLine]);

  const currentStep = STEPS[step];
  const colors = currentStep ? colorMap[currentStep.color] : colorMap.cyan;

  const { displayed: typeTitle, done: titleDone } = useTypewriter(
    currentStep?.title || '', 35, phase === 'steps'
  );
  const { displayed: typeDesc } = useTypewriter(
    currentStep?.desc || '', 18, phase === 'steps' && titleDone
  );

  const handleFinish = useCallback(() => {
    setPhase('complete');
    setShowFlash(true);
    setTimeout(() => {
      setShowFlash(false);
      localStorage.setItem(ONBOARDING_KEY, 'true');
      localStorage.removeItem('grandstate_is_new_user');
      setOpen(false);
    }, 1200);
  }, []);

  const handleNext = useCallback(() => {
    if (step < STEPS.length - 1) {
      setStep(prev => prev + 1);
    } else {
      handleFinish();
    }
  }, [step, handleFinish]);

  const handleSkip = useCallback(() => {
    localStorage.setItem(ONBOARDING_KEY, 'true');
    localStorage.removeItem('grandstate_is_new_user');
    setOpen(false);
  }, []);

  if (!open) return null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" onClick={handleSkip} />

          {/* Flash overlay on complete */}
          {showFlash && (
            <motion.div
              initial={{ opacity: 1 }}
              animate={{ opacity: 0 }}
              transition={{ duration: 1.2, ease: 'easeOut' }}
              className="absolute inset-0 bg-cyan-400 z-[10000] pointer-events-none"
            />
          )}

          {/* Main container */}
          <motion.div
            ref={containerRef}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-lg machine-screen rounded-2xl border border-cyan-500/20 overflow-hidden"
            style={{ animation: 'neon-pulse 3s ease-in-out infinite' }}
          >
            {/* Grid background */}
            <div className="absolute inset-0 grid-flow-bg z-0" />

            {/* Content layer above CRT effects */}
            <div className="relative z-10 p-6 md:p-8" style={{ fontFamily: "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace" }}>

              {/* ═══ BOOT PHASE ═══ */}
              <AnimatePresence mode="wait">
                {phase === 'boot' && (
                  <motion.div
                    key="boot"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="space-y-4"
                  >
                    {/* Radar */}
                    <div className="flex justify-center mb-2">
                      <RadarSVG />
                    </div>

                    {/* Boot log */}
                    <div className="space-y-1.5 min-h-[160px]">
                      {bootLines.slice(0, bootLine).map((line, i) => {
                        const isLast = i === bootLine - 1;
                        const isSuccess = line.includes('ESTABLISHED') || line.includes('SECURED') || line.includes('NOMINAL');
                        return (
                          <motion.p
                            key={i}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.2 }}
                            className={cn(
                              'text-xs tracking-wider',
                              isSuccess ? 'text-emerald-400' : 'text-cyan-400/80',
                              isLast && 'cursor-blink'
                            )}
                          >
                            {line}
                          </motion.p>
                        );
                      })}
                    </div>

                    {/* Progress bar */}
                    <div className="h-1 bg-cyan-950 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-cyan-500 to-cyan-300"
                        initial={{ width: '0%' }}
                        animate={{ width: `${(bootLine / bootLines.length) * 100}%` }}
                        transition={{ duration: 0.3 }}
                      />
                    </div>

                    <p className="text-[10px] text-cyan-600 text-center tracking-widest">
                      GRAND$TATE CORE INITIALIZATION
                    </p>
                  </motion.div>
                )}

                {/* ═══ STEPS PHASE ═══ */}
                {phase === 'steps' && (
                  <motion.div
                    key={`step-${step}`}
                    initial={{ opacity: 0, x: 40 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -40 }}
                    transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                    className="space-y-5"
                  >
                    {/* Header: Phase + System label */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Crosshair className={cn('w-4 h-4', colors.text)} />
                        <span className="text-[10px] tracking-[0.2em] text-cyan-600 uppercase">
                          {currentStep.phase}
                        </span>
                      </div>
                      <motion.span
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className={cn(
                          'text-[9px] tracking-widest px-2.5 py-0.5 rounded border font-bold',
                          colors.border, colors.text, colors.bg
                        )}
                      >
                        {currentStep.statusTag}
                      </motion.span>
                    </div>

                    {/* Icon + System label */}
                    <div className="flex items-center gap-4">
                      <motion.div
                        initial={{ scale: 0, rotate: -90 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 15, delay: 0.1 }}
                        className={cn(
                          'w-14 h-14 rounded-xl border flex items-center justify-center',
                          colors.border, colors.bg
                        )}
                        style={{ animation: 'neon-pulse 2s ease-in-out infinite' }}
                      >
                        <currentStep.icon className={cn('w-7 h-7', colors.text)} />
                      </motion.div>
                      <div>
                        <p className={cn('text-[10px] tracking-[0.15em] uppercase mb-0.5', colors.text)}>
                          [ {currentStep.sysLabel} ]
                        </p>
                        <p className="text-white text-base font-bold tracking-wide">
                          {typeTitle}
                          {!titleDone && <span className="inline-block w-2 h-4 bg-cyan-400 ml-0.5 animate-pulse" />}
                        </p>
                      </div>
                    </div>

                    {/* Description — terminal typewriter */}
                    <div className={cn('rounded-lg border p-4 min-h-[80px]', colors.border, 'bg-black/40')}>
                      {/* Terminal header bar */}
                      <div className="flex items-center gap-1.5 mb-2.5">
                        <div className="w-2 h-2 rounded-full bg-red-500/60" />
                        <div className="w-2 h-2 rounded-full bg-amber-500/60" />
                        <div className="w-2 h-2 rounded-full bg-emerald-500/60" />
                        <span className="text-[8px] text-cyan-700 ml-2 tracking-wider">SYSTEM_LOG</span>
                      </div>
                      <p className="text-xs text-cyan-300/90 leading-relaxed tracking-wide">
                        <span className="text-cyan-600">{'> '}</span>
                        {typeDesc}
                        {titleDone && <span className="inline-block w-1.5 h-3 bg-cyan-400 ml-0.5 animate-pulse" />}
                      </p>
                    </div>

                    {/* HUD crosshair connectors */}
                    <svg className="w-full h-4 overflow-visible" viewBox="0 0 400 16">
                      <motion.line
                        x1="0" y1="8" x2="400" y2="8"
                        stroke="rgba(34,211,238,0.15)" strokeWidth="0.5"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 0.8, delay: 0.3 }}
                      />
                      {STEPS.map((_, i) => {
                        const x = 50 + i * 100;
                        return (
                          <motion.circle
                            key={i}
                            cx={x} cy="8" r={i === step ? 5 : 3}
                            fill={i === step ? '#22d3ee' : i < step ? '#10b981' : 'transparent'}
                            stroke={i <= step ? '#22d3ee' : 'rgba(34,211,238,0.3)'}
                            strokeWidth="1"
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: 0.4 + i * 0.1 }}
                          />
                        );
                      })}
                    </svg>

                    {/* Step indicators */}
                    <div className="flex items-center justify-between text-[9px] tracking-wider">
                      {STEPS.map((s, i) => (
                        <span
                          key={i}
                          className={cn(
                            'transition-colors',
                            i === step ? 'text-cyan-400' : i < step ? 'text-emerald-500' : 'text-cyan-800'
                          )}
                        >
                          {i < step ? '[OK]' : i === step ? `[${s.statusTag}]` : '[---]'}
                        </span>
                      ))}
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-3 pt-1">
                      {step > 0 && (
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.97 }}
                          onClick={() => setStep(prev => prev - 1)}
                          className="flex-1 py-3 text-xs tracking-widest text-cyan-500 border border-cyan-800/50 rounded-lg bg-cyan-950/20 hover:bg-cyan-950/40 transition-colors uppercase"
                        >
                          {'<'} PREV
                        </motion.button>
                      )}
                      <motion.button
                        whileHover={{
                          scale: 1.03,
                          boxShadow: '0 0 25px rgba(34,211,238,0.3)',
                        }}
                        whileTap={{ scale: 0.95 }}
                        onClick={handleNext}
                        className={cn(
                          'relative flex-1 py-3 text-xs tracking-widest uppercase rounded-lg overflow-hidden font-bold transition-all',
                          step === STEPS.length - 1
                            ? 'text-black bg-gradient-to-r from-cyan-400 to-emerald-400 shadow-lg shadow-cyan-500/30'
                            : 'text-cyan-300 border border-cyan-500/40 bg-cyan-500/10 hover:bg-cyan-500/20'
                        )}
                      >
                        {/* Scanning line on button */}
                        <motion.div
                          className="absolute inset-x-0 h-[2px] bg-white/20"
                          animate={{ top: ['0%', '100%', '0%'] }}
                          transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }}
                        />
                        <span className="relative z-10 flex items-center justify-center gap-2">
                          {step === STEPS.length - 1 ? 'ENGAGE ENGINE' : 'NEXT MODULE'}
                          <ChevronRight className="w-3.5 h-3.5" />
                        </span>
                      </motion.button>
                    </div>

                    {/* Skip */}
                    <button
                      onClick={handleSkip}
                      className="w-full text-[10px] text-cyan-800 hover:text-cyan-500 transition-colors tracking-widest uppercase"
                    >
                      [ SKIP CALIBRATION ]
                    </button>
                  </motion.div>
                )}

                {/* ═══ COMPLETE PHASE ═══ */}
                {phase === 'complete' && (
                  <motion.div
                    key="complete"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center py-8 space-y-4"
                  >
                    <motion.div
                      animate={{ rotate: [0, 360] }}
                      transition={{ duration: 1, ease: 'easeOut' }}
                    >
                      <Cpu className="w-12 h-12 text-cyan-400 mx-auto" />
                    </motion.div>
                    <p className="text-lg font-bold text-cyan-300 tracking-widest glitch-text" data-text="FULL ACCESS GRANTED">
                      FULL ACCESS GRANTED
                    </p>
                    <p className="text-xs text-cyan-600 tracking-wider">
                      [ ALL SYSTEMS OPERATIONAL ]
                    </p>
                    <div className="flex justify-center gap-4 text-[9px] text-emerald-500 tracking-wider">
                      <span>[ASSETS: OK]</span>
                      <span>[NETWORK: OK]</span>
                      <span>[ENGINE: OK]</span>
                      <span>[SHIELD: OK]</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Bottom status bar */}
            <div className="relative z-10 px-6 pb-4 flex items-center justify-between text-[8px] text-cyan-700 tracking-wider">
              <span>GRAND$TATE CORE v1.0</span>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                STATUS: ONLINE
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
