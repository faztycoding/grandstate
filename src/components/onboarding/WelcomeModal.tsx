import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, Users, Zap, ChevronRight, Sparkles, Home, Shield, BarChart3, CheckCircle2 } from 'lucide-react';

const ONBOARDING_KEY = 'grandstate_onboarded';
const DISMISS_UNTIL_KEY = 'grandstate_tutorial_dismiss_until';
const PERMANENT_DISMISS_KEY = 'grandstate_tutorial_never';
const SESSION_SHOWN_KEY = 'grandstate_tutorial_shown_this_session';
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/* ────────────────────────────────────────────
   Step definitions — 3-step estate workflow
   ──────────────────────────────────────────── */
const STEPS = [
  {
    number: '01',
    tag: 'TARGET',
    title: 'เพิ่มสินทรัพย์',
    desc: 'เพิ่มข้อมูลอสังหาฯ รูปภาพ ราคา และรายละเอียด ข้อมูลซิงค์ข้ามอุปกรณ์อัตโนมัติ',
    icon: Building2,
    gradient: 'from-orange-500 to-amber-500',
    bgLight: 'bg-orange-50 dark:bg-orange-950/20',
    textColor: 'text-orange-600 dark:text-orange-400',
    borderColor: 'border-orange-200 dark:border-orange-800/50',
    ringColor: 'ring-orange-500/20',
  },
  {
    number: '02',
    tag: 'ENCODE',
    title: 'เชื่อมต่อกลุ่ม Facebook',
    desc: 'เชื่อมต่อ Facebook ที่ตั้งค่าก่อน แล้วเพิ่มกลุ่มเป้าหมายได้สูงสุด 750 กลุ่ม (ต้องเชื่อม FB ก่อนถึงจะดึงข้อมูลกลุ่มได้)',
    icon: Users,
    gradient: 'from-blue-500 to-cyan-500',
    bgLight: 'bg-blue-50 dark:bg-blue-950/20',
    textColor: 'text-blue-600 dark:text-blue-400',
    borderColor: 'border-blue-200 dark:border-blue-800/50',
    ringColor: 'ring-blue-500/20',
  },
  {
    number: '03',
    tag: 'LAUNCH',
    title: 'สั่งรันโพสต์อัตโนมัติ',
    desc: 'ระบบโพสต์อัตโนมัติพร้อม AI สร้างแคปชัน และ Anti-Detection ป้องกันบล็อก 24/7',
    icon: Zap,
    gradient: 'from-emerald-500 to-teal-500',
    bgLight: 'bg-emerald-50 dark:bg-emerald-950/20',
    textColor: 'text-emerald-600 dark:text-emerald-400',
    borderColor: 'border-emerald-200 dark:border-emerald-800/50',
    ringColor: 'ring-emerald-500/20',
  },
];

const FEATURES = [
  { icon: Shield, label: 'Anti-Detection 6 ชั้น' },
  { icon: BarChart3, label: 'Analytics & รายงาน' },
  { icon: Sparkles, label: 'AI สร้างแคปชัน' },
];

/* ════════════════════════════════════════════
   MAIN COMPONENT
   ════════════════════════════════════════════ */
export function WelcomeModal() {
  const [open, setOpen] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(PERMANENT_DISMISS_KEY)) return;
    if (sessionStorage.getItem(SESSION_SHOWN_KEY)) return;
    const isNewUser = localStorage.getItem('grandstate_is_new_user');
    const alreadyOnboarded = localStorage.getItem(ONBOARDING_KEY);
    if (isNewUser && !alreadyOnboarded) { setOpen(true); return; }
    if (alreadyOnboarded) {
      const dismissUntil = localStorage.getItem(DISMISS_UNTIL_KEY);
      if (!dismissUntil || Date.now() > Number(dismissUntil)) setOpen(true);
    }
  }, []);

  const dismiss = useCallback(() => {
    localStorage.setItem(ONBOARDING_KEY, 'true');
    localStorage.removeItem('grandstate_is_new_user');
    sessionStorage.setItem(SESSION_SHOWN_KEY, '1');
    // Signal Header to show help icon hint animation
    sessionStorage.setItem('grandstate_show_help_hint', '1');
    window.dispatchEvent(new Event('help-hint-trigger'));
    if (dontShowAgain) {
      localStorage.setItem(PERMANENT_DISMISS_KEY, 'true');
    } else {
      localStorage.setItem(DISMISS_UNTIL_KEY, String(Date.now() + SEVEN_DAYS_MS));
    }
  }, [dontShowAgain]);

  const handleClose = useCallback(() => {
    dismiss();
    setOpen(false);
  }, [dismiss]);

  if (!open) return null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4"
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />

          {/* Modal */}
          <motion.div
            initial={{ scale: 0.92, opacity: 0, y: 30 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 30 }}
            transition={{ type: 'spring', damping: 28, stiffness: 350 }}
            className="relative w-full max-w-2xl bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden border border-gray-200/80 dark:border-gray-700"
          >
            {/* Decorative corner accents — industrial estate feel */}
            <div className="absolute top-0 left-0 w-8 h-8 border-t-[3px] border-l-[3px] border-orange-400/60 rounded-tl-2xl pointer-events-none z-20" />
            <div className="absolute top-0 right-0 w-8 h-8 border-t-[3px] border-r-[3px] border-orange-400/60 rounded-tr-2xl pointer-events-none z-20" />
            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-[3px] border-l-[3px] border-orange-400/60 rounded-bl-2xl pointer-events-none z-20" />
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-[3px] border-r-[3px] border-orange-400/60 rounded-br-2xl pointer-events-none z-20" />

            {/* ─── Header ─── */}
            <div className="relative bg-gradient-to-r from-orange-500 via-amber-500 to-orange-400 px-6 py-6 text-center overflow-hidden">
              {/* Subtle grid overlay */}
              <div
                className="absolute inset-0 opacity-[0.07] pointer-events-none"
                style={{
                  backgroundImage: 'linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)',
                  backgroundSize: '24px 24px',
                }}
              />
              <div className="relative">
                <motion.div
                  initial={{ scale: 0, rotate: -20 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', delay: 0.15, stiffness: 300 }}
                  className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center mx-auto mb-3 ring-4 ring-white/10"
                >
                  <Home className="w-7 h-7 text-white" />
                </motion.div>
                <motion.h1
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="text-xl sm:text-2xl font-bold text-white"
                >
                  ยินดีต้อนรับสู่ Grand$tate
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="text-white/80 text-xs sm:text-sm mt-1.5"
                >
                  ระบบโพสต์อสังหาฯ อัตโนมัติ — 3 ขั้นตอนง่ายๆ เริ่มต้นใช้งาน
                </motion.p>
                {/* Machine status bar */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="flex items-center justify-center gap-3 sm:gap-5 mt-3 text-[9px] sm:text-[10px] text-white/50 font-mono tracking-wider"
                >
                  <span>[ SYSTEM: ONLINE ]</span>
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
                    READY
                  </span>
                  <span>[ v1.0 ]</span>
                </motion.div>
              </div>
            </div>

            {/* ─── Steps Grid ─── */}
            <div className="px-5 sm:px-6 pt-6 pb-2">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                {STEPS.map((step, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.35 + i * 0.12 }}
                    className={`relative p-4 rounded-xl border ${step.borderColor} ${step.bgLight} hover:shadow-lg hover:ring-2 ${step.ringColor} transition-all duration-300 group`}
                  >
                    {/* Step badge */}
                    <div className={`absolute -top-2.5 left-3 px-2 py-0.5 rounded-md bg-gradient-to-r ${step.gradient} text-white text-[9px] font-bold font-mono tracking-widest shadow-sm`}>
                      STEP {step.number}
                    </div>

                    {/* Icon */}
                    <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${step.gradient} flex items-center justify-center mt-1.5 mb-2.5 shadow-sm group-hover:scale-105 transition-transform`}>
                      <step.icon className="w-5 h-5 text-white" />
                    </div>

                    {/* Tech label */}
                    <p className={`text-[9px] font-mono ${step.textColor} tracking-wider opacity-60 mb-0.5`}>
                      [ {step.tag} ]
                    </p>

                    {/* Title */}
                    <h3 className="font-bold text-gray-800 dark:text-gray-100 text-sm leading-snug mb-1.5">
                      {step.title}
                    </h3>

                    {/* Description */}
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
                      {step.desc}
                    </p>
                  </motion.div>
                ))}
              </div>

              {/* Step connector line (desktop) */}
              <div className="hidden sm:flex items-center justify-center gap-1 mt-3 mb-1">
                {STEPS.map((s, i) => (
                  <div key={i} className="flex items-center">
                    <div className={`w-2.5 h-2.5 rounded-full bg-gradient-to-br ${s.gradient} shadow-sm`} />
                    {i < STEPS.length - 1 && (
                      <div className="w-[calc(33vw-80px)] max-w-[100px] h-0.5 bg-gradient-to-r from-orange-300/60 via-blue-300/40 to-emerald-300/60 rounded-full" />
                    )}
                  </div>
                ))}
              </div>

              {/* Extra features row */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.75 }}
                className="flex items-center justify-center gap-3 sm:gap-5 mt-3 mb-4"
              >
                {FEATURES.map((f, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-[10px] sm:text-[11px] text-gray-400 dark:text-gray-500">
                    <f.icon className="w-3.5 h-3.5" />
                    <span>{f.label}</span>
                  </div>
                ))}
              </motion.div>
            </div>

            {/* ─── Footer Actions ─── */}
            <div className="px-5 sm:px-6 pb-5 space-y-3">
              {/* Main CTA */}
              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                whileHover={{ scale: 1.015, boxShadow: '0 8px 30px rgba(249, 115, 22, 0.3)' }}
                whileTap={{ scale: 0.98 }}
                onClick={handleClose}
                className="w-full py-3.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold rounded-xl shadow-lg shadow-orange-500/20 transition-all flex items-center justify-center gap-2 text-sm"
              >
                <CheckCircle2 className="w-4.5 h-4.5" />
                เริ่มต้นใช้งาน
                <ChevronRight className="w-4 h-4" />
              </motion.button>

              {/* Dismiss options */}
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={dontShowAgain}
                    onChange={(e) => setDontShowAgain(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-gray-300 dark:border-gray-600 accent-orange-500"
                  />
                  <span className="text-[11px] text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors select-none">
                    ไม่ต้องแสดงอีก
                  </span>
                </label>
                {!dontShowAgain && (
                  <span className="text-[10px] text-gray-300 dark:text-gray-600 font-mono">
                    แสดงอีกครั้งใน 7 วัน
                  </span>
                )}
              </div>
            </div>

            {/* Machine status footer */}
            <div className="px-5 sm:px-6 pb-3 flex items-center justify-between text-[8px] text-gray-300 dark:text-gray-600 font-mono tracking-wider">
              <span>GRAND$TATE CORE v1.0</span>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                CONNECTED
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
