import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, ShieldOff, Clock, User, Copy, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface ExpiredLicensePopupProps {
    show: boolean;
    userId?: string;
    onClose: () => void;
}

export function ExpiredLicensePopup({ show, userId, onClose }: ExpiredLicensePopupProps) {
    const [copied, setCopied] = useState(false);

    const handleCopyId = () => {
        if (userId) {
            navigator.clipboard.writeText(userId);
            setCopied(true);
            toast.success('คัดลอก User ID แล้ว');
            setTimeout(() => setCopied(false), 2000);
        }
    };

    // Truncate user ID for display
    const displayId = userId ? (userId.length > 12 ? userId.slice(0, 8) + '...' + userId.slice(-4) : userId) : '—';

    return (
        <AnimatePresence>
            {show && (
                <motion.div
                    className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                >
                    {/* Backdrop with red-tinted blur */}
                    <motion.div
                        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                    />

                    {/* Pulsing danger glow */}
                    <motion.div
                        className="absolute w-[300px] h-[300px] rounded-full pointer-events-none"
                        style={{ background: 'radial-gradient(circle, rgba(239,68,68,0.25) 0%, transparent 70%)' }}
                        animate={{
                            scale: [1, 1.3, 1],
                            opacity: [0.3, 0.6, 0.3],
                        }}
                        transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                    />

                    {/* Card */}
                    <motion.div
                        className="relative z-10 w-full max-w-md rounded-2xl overflow-hidden border border-red-500/30 bg-gradient-to-b from-slate-900 via-slate-900 to-red-950/30 shadow-2xl shadow-red-500/10"
                        initial={{ scale: 0.8, opacity: 0, y: 30 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.8, opacity: 0, y: 30 }}
                        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                    >
                        {/* Top danger bar */}
                        <div className="h-1 bg-gradient-to-r from-red-500 via-orange-500 to-red-500" />

                        {/* Close button */}
                        <button
                            onClick={onClose}
                            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/60 hover:text-white transition-colors z-10"
                        >
                            <X className="w-4 h-4" />
                        </button>

                        {/* Header with icon */}
                        <div className="px-6 pt-8 pb-4 flex flex-col items-center text-center">
                            <motion.div
                                className="relative w-20 h-20 rounded-full bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center shadow-xl shadow-red-500/30 mb-4"
                                animate={{
                                    boxShadow: [
                                        '0 0 20px rgba(239,68,68,0.3)',
                                        '0 0 40px rgba(239,68,68,0.5)',
                                        '0 0 20px rgba(239,68,68,0.3)',
                                    ],
                                }}
                                transition={{ duration: 2, repeat: Infinity }}
                            >
                                {/* Rotating ring */}
                                <motion.div
                                    className="absolute inset-[-3px] rounded-full border-2 border-dashed border-red-400/50"
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
                                />
                                <ShieldOff className="w-9 h-9 text-white" />
                            </motion.div>

                            <motion.h2
                                className="text-xl font-bold text-red-400 mb-1"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2 }}
                            >
                                License หมดอายุ
                            </motion.h2>
                            <motion.div
                                className="flex items-center gap-1.5 text-red-300/60 text-xs"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.3 }}
                            >
                                <Clock className="w-3 h-3" />
                                <span>สิทธิ์การใช้งานของท่านสิ้นสุดลงแล้ว</span>
                            </motion.div>
                        </div>

                        {/* Message body */}
                        <motion.div
                            className="px-6 pb-4"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4 }}
                        >
                            <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
                                <p className="text-white/80 text-sm leading-relaxed">
                                    สิทธิ์การใช้งาน License ของท่านหมดอายุแล้ว
                                    กรุณาติดต่อผู้ดูแลระบบเพื่อดำเนินการต่ออายุ License
                                    พร้อมแจ้ง <span className="text-red-300 font-semibold">User ID</span> ของท่าน
                                </p>
                                <p className="text-white/50 text-xs">
                                    (User ID สามารถดูได้จากมุมขวาล่างของแอปพลิเคชัน)
                                </p>
                            </div>
                        </motion.div>

                        {/* User ID display + copy */}
                        {userId && (
                            <motion.div
                                className="px-6 pb-4"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.5 }}
                            >
                                <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <div className="w-8 h-8 rounded-lg bg-slate-700/50 flex items-center justify-center flex-shrink-0">
                                            <User className="w-4 h-4 text-slate-400" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-[10px] text-slate-500 uppercase tracking-wider">User ID</p>
                                            <p className="text-sm font-mono text-white/80 truncate">{displayId}</p>
                                        </div>
                                    </div>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className="text-slate-400 hover:text-white hover:bg-slate-700/50 h-8 px-3 flex-shrink-0"
                                        onClick={handleCopyId}
                                    >
                                        {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                                        <span className="text-xs ml-1.5">{copied ? 'คัดลอกแล้ว' : 'คัดลอก'}</span>
                                    </Button>
                                </div>
                            </motion.div>
                        )}

                        {/* Action */}
                        <div className="px-6 pb-6">
                            <Button
                                className="w-full h-11 bg-gradient-to-r from-red-500 to-orange-600 hover:from-red-600 hover:to-orange-700 text-white font-bold shadow-lg shadow-red-500/20"
                                onClick={onClose}
                            >
                                รับทราบ
                            </Button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
