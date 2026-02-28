import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Crown, Star, Rocket, Sparkles, Zap, Shield, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LevelUpEffectProps {
    show: boolean;
    rank: 'free' | 'agent' | 'elite';
    ownerName?: string;
    expiresAt?: string;
    onComplete: () => void;
}

const rankConfig = {
    free: {
        name: 'Rookie',
        icon: Rocket,
        gradient: 'from-emerald-400 via-teal-500 to-cyan-500',
        glow: 'shadow-emerald-500/50',
        particleColor: '#10b981',
        bgGlow: 'radial-gradient(circle, rgba(16,185,129,0.3) 0%, transparent 70%)',
        ringColor: 'ring-emerald-400',
        textColor: 'text-emerald-400',
    },
    agent: {
        name: 'Top Agent',
        icon: Star,
        gradient: 'from-amber-400 via-orange-500 to-red-500',
        glow: 'shadow-amber-500/50',
        particleColor: '#f59e0b',
        bgGlow: 'radial-gradient(circle, rgba(245,158,11,0.3) 0%, transparent 70%)',
        ringColor: 'ring-amber-400',
        textColor: 'text-amber-400',
    },
    elite: {
        name: 'Elite',
        icon: Crown,
        gradient: 'from-purple-400 via-pink-500 to-rose-500',
        glow: 'shadow-purple-500/50',
        particleColor: '#a855f7',
        bgGlow: 'radial-gradient(circle, rgba(168,85,247,0.4) 0%, transparent 70%)',
        ringColor: 'ring-purple-400',
        textColor: 'text-purple-400',
    },
};

function Particle({ color, delay, x, y }: { color: string; delay: number; x: number; y: number }) {
    return (
        <motion.div
            className="absolute w-2 h-2 rounded-full"
            style={{ backgroundColor: color, left: '50%', top: '50%' }}
            initial={{ opacity: 0, scale: 0, x: 0, y: 0 }}
            animate={{
                opacity: [0, 1, 1, 0],
                scale: [0, 1.5, 1, 0],
                x: [0, x * 0.5, x],
                y: [0, y * 0.5, y],
            }}
            transition={{ duration: 1.8, delay, ease: 'easeOut' }}
        />
    );
}

function StarBurst({ color, count = 12 }: { color: string; count?: number }) {
    return (
        <>
            {Array.from({ length: count }).map((_, i) => {
                const angle = (i / count) * Math.PI * 2;
                const distance = 80 + Math.random() * 60;
                return (
                    <Particle
                        key={i}
                        color={color}
                        delay={0.3 + Math.random() * 0.3}
                        x={Math.cos(angle) * distance}
                        y={Math.sin(angle) * distance}
                    />
                );
            })}
        </>
    );
}

export function LevelUpEffect({ show, rank, ownerName, expiresAt, onComplete }: LevelUpEffectProps) {
    const [phase, setPhase] = useState<'burst' | 'reveal' | 'info' | 'done'>('burst');
    const config = rankConfig[rank];
    const RankIcon = config.icon;

    useEffect(() => {
        if (!show) {
            setPhase('burst');
            return;
        }
        const t1 = setTimeout(() => setPhase('reveal'), 600);
        const t2 = setTimeout(() => setPhase('info'), 1600);
        const t3 = setTimeout(() => {
            setPhase('done');
            onComplete();
        }, 4500);
        return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
    }, [show, onComplete]);

    const formatDate = (d: string) => {
        try {
            return new Date(d).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
        } catch { return d; }
    };

    return (
        <AnimatePresence>
            {show && (
                <motion.div
                    className="fixed inset-0 z-[9999] flex items-center justify-center"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                >
                    {/* Dark backdrop */}
                    <motion.div
                        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        onClick={onComplete}
                    />

                    {/* Center glow */}
                    <motion.div
                        className="absolute w-[400px] h-[400px] rounded-full pointer-events-none"
                        style={{ background: config.bgGlow }}
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: [0, 2, 1.5], opacity: [0, 0.8, 0.4] }}
                        transition={{ duration: 1.2, ease: 'easeOut' }}
                    />

                    {/* Particle burst */}
                    <div className="absolute pointer-events-none">
                        <StarBurst color={config.particleColor} count={rank === 'elite' ? 20 : rank === 'agent' ? 16 : 10} />
                    </div>

                    {/* Elite-only: extra ring particles */}
                    {rank === 'elite' && (
                        <div className="absolute pointer-events-none">
                            <StarBurst color="#ec4899" count={12} />
                        </div>
                    )}

                    {/* Main content */}
                    <motion.div
                        className="relative z-10 flex flex-col items-center gap-4 pointer-events-auto"
                        initial={{ scale: 0, opacity: 0 }}
                        animate={phase !== 'burst' ? { scale: 1, opacity: 1 } : { scale: 0, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                    >
                        {/* Rank icon with animated ring */}
                        <motion.div
                            className={cn(
                                "relative w-24 h-24 sm:w-28 sm:h-28 rounded-full flex items-center justify-center",
                                `bg-gradient-to-br ${config.gradient}`,
                                `shadow-2xl ${config.glow}`
                            )}
                            animate={{
                                boxShadow: [
                                    `0 0 20px ${config.particleColor}40`,
                                    `0 0 60px ${config.particleColor}60`,
                                    `0 0 30px ${config.particleColor}40`,
                                ],
                            }}
                            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                        >
                            {/* Rotating ring */}
                            <motion.div
                                className={cn("absolute inset-[-4px] rounded-full border-2 border-dashed", config.ringColor)}
                                animate={{ rotate: 360 }}
                                transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
                            />
                            {rank === 'elite' && (
                                <motion.div
                                    className="absolute inset-[-10px] rounded-full border border-pink-400/40"
                                    animate={{ rotate: -360 }}
                                    transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
                                />
                            )}
                            <RankIcon className="w-10 h-10 sm:w-12 sm:h-12 text-white drop-shadow-lg" />
                        </motion.div>

                        {/* Level up text */}
                        <motion.div
                            className="text-center"
                            initial={{ opacity: 0, y: 20 }}
                            animate={phase === 'reveal' || phase === 'info' ? { opacity: 1, y: 0 } : {}}
                            transition={{ delay: 0.2, duration: 0.5 }}
                        >
                            <motion.p
                                className="text-xs font-mono tracking-[0.3em] text-white/60 uppercase mb-2"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.3 }}
                            >
                                {rank === 'elite' ? '⚡ SUPREME ACTIVATION ⚡' : rank === 'agent' ? '🔥 RANK ACTIVATED 🔥' : '✨ WELCOME ✨'}
                            </motion.p>
                            <motion.h2
                                className={cn("text-3xl sm:text-4xl font-black tracking-tight", config.textColor)}
                                style={{ textShadow: `0 0 30px ${config.particleColor}60` }}
                            >
                                {config.name}
                            </motion.h2>
                            {ownerName && (
                                <motion.p
                                    className="text-white/70 text-sm mt-2"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 0.5 }}
                                >
                                    ยินดีต้อนรับ, <span className="text-white font-semibold">{ownerName}</span>
                                </motion.p>
                            )}
                        </motion.div>

                        {/* Info card */}
                        <AnimatePresence>
                            {phase === 'info' && (
                                <motion.div
                                    className="mt-2 px-6 py-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 text-center"
                                    initial={{ opacity: 0, y: 20, scale: 0.9 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                                >
                                    <p className="text-white/60 text-xs mb-1">License เปิดใช้งานเรียบร้อย</p>
                                    {expiresAt && (
                                        <p className="text-white text-sm font-medium">
                                            หมดอายุ: <span className={config.textColor}>{formatDate(expiresAt)}</span>
                                        </p>
                                    )}
                                    <motion.button
                                        className={cn(
                                            "mt-3 px-6 py-2 rounded-full text-sm font-bold text-white",
                                            `bg-gradient-to-r ${config.gradient}`,
                                            "hover:brightness-110 active:scale-95 transition-all"
                                        )}
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={onComplete}
                                    >
                                        เริ่มใช้งาน
                                    </motion.button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
