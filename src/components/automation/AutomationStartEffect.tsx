import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Rocket, Zap, Radio } from 'lucide-react';

interface AutomationStartEffectProps {
  show: boolean;
  groupCount: number;
  propertyTitle?: string;
  onComplete: () => void;
}

// Play a short "engine start" sound using Web Audio API
function playStartSound() {
  try {
    const ctx = new AudioContext();
    const now = ctx.currentTime;

    // Rising tone — "powering up"
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(200, now);
    osc1.frequency.exponentialRampToValueAtTime(800, now + 0.4);
    gain1.gain.setValueAtTime(0.15, now);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
    osc1.connect(gain1).connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.5);

    // Confirmation ding
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, now + 0.3);
    gain2.gain.setValueAtTime(0, now);
    gain2.gain.setValueAtTime(0.2, now + 0.3);
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.8);
    osc2.connect(gain2).connect(ctx.destination);
    osc2.start(now + 0.3);
    osc2.stop(now + 0.8);

    // Second higher ding
    const osc3 = ctx.createOscillator();
    const gain3 = ctx.createGain();
    osc3.type = 'sine';
    osc3.frequency.setValueAtTime(1174, now + 0.5);
    gain3.gain.setValueAtTime(0, now);
    gain3.gain.setValueAtTime(0.15, now + 0.5);
    gain3.gain.exponentialRampToValueAtTime(0.01, now + 1.0);
    osc3.connect(gain3).connect(ctx.destination);
    osc3.start(now + 0.5);
    osc3.stop(now + 1.0);

    setTimeout(() => ctx.close(), 1500);
  } catch { /* silent */ }
}

export function AutomationStartEffect({ show, groupCount, propertyTitle, onComplete }: AutomationStartEffectProps) {
  const [phase, setPhase] = useState<'idle' | 'burst' | 'text' | 'done'>('idle');

  useEffect(() => {
    if (!show) {
      setPhase('idle');
      return;
    }
    playStartSound();
    setPhase('burst');
    const t1 = setTimeout(() => setPhase('text'), 400);
    const t2 = setTimeout(() => setPhase('done'), 2500);
    const t3 = setTimeout(() => onComplete(), 3000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [show, onComplete]);

  return (
    <AnimatePresence>
      {show && phase !== 'idle' && phase !== 'done' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-none"
        >
          {/* Radial backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.6 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-gradient-radial from-orange-500/20 via-transparent to-transparent"
          />

          {/* Expanding ring burst */}
          {phase === 'burst' && (
            <>
              {[0, 1, 2].map(i => (
                <motion.div
                  key={`ring-${i}`}
                  initial={{ scale: 0, opacity: 0.8 }}
                  animate={{ scale: 3 + i, opacity: 0 }}
                  transition={{ duration: 1.2, delay: i * 0.15, ease: 'easeOut' }}
                  className="absolute w-20 h-20 rounded-full border-2 border-orange-400"
                />
              ))}
            </>
          )}

          {/* Particle burst */}
          {Array.from({ length: 16 }).map((_, i) => {
            const angle = (i / 16) * Math.PI * 2;
            const dist = 120 + Math.random() * 80;
            return (
              <motion.div
                key={`p-${i}`}
                initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                animate={{
                  x: Math.cos(angle) * dist,
                  y: Math.sin(angle) * dist,
                  opacity: 0,
                  scale: 0.3,
                }}
                transition={{ duration: 0.8, delay: 0.1 + Math.random() * 0.2, ease: 'easeOut' }}
                className="absolute w-2 h-2 rounded-full"
                style={{
                  background: i % 3 === 0 ? '#f97316' : i % 3 === 1 ? '#fbbf24' : '#3b82f6',
                  boxShadow: `0 0 8px ${i % 3 === 0 ? '#f97316' : i % 3 === 1 ? '#fbbf24' : '#3b82f6'}`,
                }}
              />
            );
          })}

          {/* Center icon */}
          <motion.div
            initial={{ scale: 0, rotate: -30 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.1 }}
            className="relative z-10"
          >
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shadow-[0_0_40px_rgba(249,115,22,0.5)]">
              <Rocket className="w-10 h-10 text-white" />
            </div>
          </motion.div>

          {/* Text info */}
          {phase === 'text' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="absolute mt-36 text-center z-10"
            >
              <motion.div
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                className="flex items-center justify-center gap-2 mb-2"
              >
                <Zap className="w-5 h-5 text-amber-400" />
                <span className="text-xl font-black text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]">
                  AUTOMATION STARTED
                </span>
                <Zap className="w-5 h-5 text-amber-400" />
              </motion.div>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="text-sm text-white/80 drop-shadow-lg flex items-center justify-center gap-2"
              >
                <Radio className="w-4 h-4 animate-pulse" />
                {propertyTitle ? `"${propertyTitle}"` : 'กำลังโพสต์'} → {groupCount} กลุ่ม
              </motion.p>
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
