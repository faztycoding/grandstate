import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
    CheckCircle2,
    XCircle,
    Clock,
    Loader2,
    Play,
    Pause,
    Square,
    ChevronDown,
    ChevronUp,
    X,
    Terminal,
    Timer,
    ListChecks,
    MessageSquareText,
    Users,
    Hourglass,
    Cloud,
    Zap,
    BarChart3,
    TrendingUp,
    Trophy,
    AlertTriangle,
    Server,
    Activity,
    Copy,
} from 'lucide-react';

interface TaskStatus {
    id: string;
    groupId: string;
    groupName: string;
    groupUrl?: string;
    status: 'pending' | 'in_progress' | 'pending_approval' | 'completed' | 'failed';
    message?: string;
    postUrl?: string;
}

interface LogEntry {
    time: number;
    msg: string;
    level: 'info' | 'success' | 'error' | 'warn' | 'start';
}

interface TaskProgressPopupProps {
    isRunning: boolean;
    isPaused: boolean;
    tasks: TaskStatus[];
    totalSteps: number;
    completedTasks: number;
    failedTasks: number;
    progressPercent: number;
    generatedCaptions: string[];
    logs: LogEntry[];
    startTime: number | null;
    endTime: number | null;
    queuePosition?: number | null;
    queueEstimate?: number;
    fbUser?: { name: string; profilePic?: string } | null;
    onStop: () => void;
    onPause: () => void;
    onDismiss: () => void;
}

function formatElapsed(ms: number): string {
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
}

function formatTime(ts: number): string {
    const d = new Date(ts);
    return d.toLocaleTimeString('th-TH', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatDuration(ms: number): string {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    if (m > 0) return `${m} นาที ${s} วินาที`;
    return `${s} วินาที`;
}

function getLogColor(msg: string, level: string): string {
    if (level === 'error' || msg.includes('❌') || msg.includes('🚨')) return 'text-red-400';
    if (level === 'success' || msg.includes('✅') || msg.includes('🏁')) return 'text-emerald-400';
    if (level === 'warn' || msg.includes('⏳') || msg.includes('🔄') || msg.includes('🕓')) return 'text-amber-400';
    if (level === 'start' || msg.includes('🚀') || msg.includes('📦')) return 'text-blue-400';
    return 'text-zinc-400';
}

type TabType = 'tasks' | 'captions' | 'logs';

export function TaskProgressPopup({
    isRunning,
    isPaused,
    tasks,
    totalSteps,
    completedTasks,
    failedTasks,
    progressPercent,
    generatedCaptions,
    logs,
    startTime,
    endTime,
    queuePosition,
    queueEstimate,
    fbUser,
    onStop,
    onPause,
    onDismiss,
}: TaskProgressPopupProps) {
    const [isMinimized, setIsMinimized] = useState(false);
    const [activeTab, setActiveTab] = useState<TabType>('tasks');
    const [elapsed, setElapsed] = useState('0:00');
    const [countdown, setCountdown] = useState(queueEstimate || 0);
    const logEndRef = useRef<HTMLDivElement>(null);
    const logContainerRef = useRef<HTMLDivElement>(null);
    const [autoScroll, setAutoScroll] = useState(true);

    const pendingApprovalTasks = tasks.filter(t => t.status === 'pending_approval').length;
    const resolvedTasks = completedTasks + pendingApprovalTasks + failedTasks;
    const posted = completedTasks + pendingApprovalTasks;
    const isDone = !isRunning && tasks.length > 0 && tasks.every(
        t => t.status === 'completed' || t.status === 'pending_approval' || t.status === 'failed'
    );
    const hasContent = isRunning || isDone || tasks.length > 0;
    const isInQueue = !!(queuePosition && queuePosition > 0);
    const successRate = totalSteps > 0 ? Math.round((posted / totalSteps) * 100) : 0;
    const duration = startTime && endTime ? endTime - startTime : 0;

    useEffect(() => { setCountdown(queueEstimate || 0); }, [queueEstimate]);

    useEffect(() => {
        if (!queuePosition || queuePosition <= 0 || countdown <= 0) return;
        const id = setInterval(() => setCountdown(prev => (prev > 0 ? prev - 1 : 0)), 1000);
        return () => clearInterval(id);
    }, [queuePosition, countdown]);

    useEffect(() => {
        if (!startTime) { setElapsed('0:00'); return; }
        const update = () => {
            const ref = !isRunning && typeof endTime === 'number' ? endTime : Date.now();
            setElapsed(formatElapsed(Math.max(0, ref - startTime)));
        };
        update();
        if (isRunning) { const id = setInterval(update, 1000); return () => clearInterval(id); }
    }, [startTime, endTime, isRunning]);

    useEffect(() => {
        if (autoScroll && activeTab === 'logs' && logEndRef.current) {
            logEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs, activeTab, autoScroll]);

    const handleLogScroll = () => {
        if (!logContainerRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = logContainerRef.current;
        setAutoScroll(scrollHeight - scrollTop - clientHeight < 40);
    };

    if (!hasContent) return null;

    // ── Status config ──
    const statusConfig: Record<string, { icon: React.ReactNode; badge: string; badgeCls: string }> = {
        completed: {
            icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />,
            badge: 'สำเร็จ',
            badgeCls: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/25',
        },
        pending_approval: {
            icon: <Clock className="w-3.5 h-3.5 text-amber-500" />,
            badge: 'รออนุมัติ',
            badgeCls: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/25',
        },
        failed: {
            icon: <XCircle className="w-3.5 h-3.5 text-red-500" />,
            badge: 'ล้มเหลว',
            badgeCls: 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/25',
        },
        in_progress: {
            icon: <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin" />,
            badge: 'กำลังทำ',
            badgeCls: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/25',
        },
        pending: {
            icon: <Clock className="w-3.5 h-3.5 text-muted-foreground/50" />,
            badge: 'รอคิว',
            badgeCls: 'bg-muted text-muted-foreground border-border',
        },
    };

    const tabs: { key: TabType; label: string; icon: React.ReactNode; count?: number }[] = [
        { key: 'tasks', label: 'Tasks', icon: <ListChecks className="w-3.5 h-3.5" />, count: tasks.length },
        { key: 'captions', label: 'Captions', icon: <MessageSquareText className="w-3.5 h-3.5" />, count: generatedCaptions.length },
        { key: 'logs', label: 'Logs', icon: <Terminal className="w-3.5 h-3.5" />, count: logs.length },
    ];

    // ── Header gradient based on state ──
    const headerGradient = isInQueue
        ? 'from-amber-600/90 via-orange-600/90 to-amber-700/90'
        : isDone
            ? (successRate >= 70 ? 'from-emerald-600/90 via-emerald-700/90 to-teal-700/90' : 'from-zinc-600/90 via-zinc-700/90 to-zinc-800/90')
            : isPaused
                ? 'from-amber-600/90 via-amber-700/90 to-orange-700/90'
                : 'from-orange-600/90 via-amber-600/90 to-orange-700/90';

    const headerStatusText = isInQueue
        ? `QUEUE #${queuePosition}`
        : isDone ? 'COMPLETED' : isPaused ? 'PAUSED' : 'RUNNING';

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: 40, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 40, scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                className="fixed bottom-4 right-4 z-50 w-[440px] max-w-[calc(100vw-2rem)]"
            >
                <div className="rounded-2xl overflow-hidden shadow-2xl shadow-black/20 border border-white/10 backdrop-blur-sm">
                    {/* ═══ Header ═══ */}
                    <div
                        className={cn('relative cursor-pointer select-none', `bg-gradient-to-r ${headerGradient}`)}
                        onClick={() => setIsMinimized(!isMinimized)}
                    >
                        {/* Subtle grid overlay */}
                        <div className="absolute inset-0 opacity-[0.06]" style={{
                            backgroundImage: 'linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)',
                            backgroundSize: '20px 20px',
                        }} />

                        <div className="relative px-4 py-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                    {/* Animated status dot */}
                                    <div className="relative">
                                        <div className={cn(
                                            'w-2.5 h-2.5 rounded-full',
                                            isInQueue ? 'bg-amber-300' : isDone ? 'bg-white' : isPaused ? 'bg-amber-300' : 'bg-emerald-300'
                                        )} />
                                        {(isRunning || isInQueue) && !isPaused && (
                                            <div className={cn(
                                                'absolute inset-0 w-2.5 h-2.5 rounded-full animate-ping',
                                                isInQueue ? 'bg-amber-300' : 'bg-emerald-300'
                                            )} />
                                        )}
                                    </div>

                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-bold tracking-widest text-white/60 uppercase">
                                                {headerStatusText}
                                            </span>
                                            {startTime && (
                                                <span className="text-[10px] font-mono text-white/40 flex items-center gap-0.5">
                                                    <Timer className="w-2.5 h-2.5" /> {elapsed}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-sm font-bold text-white leading-tight mt-0.5">
                                            {isInQueue
                                                ? `รอคิวที่ ${queuePosition} — ~${Math.ceil((countdown || (queueEstimate || 300)) / 60)} นาที`
                                                : isDone
                                                    ? `โพสต์เสร็จสิ้น — ${posted}/${totalSteps} กลุ่ม`
                                                    : isPaused
                                                        ? 'หยุดชั่วคราว'
                                                        : `กำลังโพสต์ — ${resolvedTasks}/${totalSteps}`}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-0.5">
                                    {isRunning && !isInQueue && (
                                        <>
                                            <button onClick={(e) => { e.stopPropagation(); onPause(); }}
                                                className="p-1.5 rounded-lg hover:bg-white/15 transition-colors" title={isPaused ? 'Resume' : 'Pause'}>
                                                {isPaused
                                                    ? <Play className="w-4 h-4 text-white" />
                                                    : <Pause className="w-4 h-4 text-white/80" />}
                                            </button>
                                            <button onClick={(e) => { e.stopPropagation(); onStop(); }}
                                                className="p-1.5 rounded-lg hover:bg-white/15 transition-colors" title="Stop">
                                                <Square className="w-4 h-4 text-red-300" />
                                            </button>
                                        </>
                                    )}
                                    {isDone && (
                                        <button onClick={(e) => { e.stopPropagation(); onDismiss(); }}
                                            className="p-1.5 rounded-lg hover:bg-white/15 transition-colors" title="Close">
                                            <X className="w-4 h-4 text-white/80" />
                                        </button>
                                    )}
                                    <div className="p-1">
                                        {isMinimized
                                            ? <ChevronUp className="w-4 h-4 text-white/50" />
                                            : <ChevronDown className="w-4 h-4 text-white/50" />}
                                    </div>
                                </div>
                            </div>

                            {/* Progress bar in header */}
                            {!isInQueue && !isMinimized && (
                                <div className="mt-3 mb-1">
                                    <div className="h-1.5 rounded-full bg-white/15 overflow-hidden flex">
                                        {completedTasks > 0 && (
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${(completedTasks / totalSteps) * 100}%` }}
                                                transition={{ duration: 0.5 }}
                                                className="h-full bg-emerald-400"
                                            />
                                        )}
                                        {pendingApprovalTasks > 0 && (
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${(pendingApprovalTasks / totalSteps) * 100}%` }}
                                                transition={{ duration: 0.5 }}
                                                className="h-full bg-amber-400"
                                            />
                                        )}
                                        {failedTasks > 0 && (
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${(failedTasks / totalSteps) * 100}%` }}
                                                transition={{ duration: 0.5 }}
                                                className="h-full bg-red-400"
                                            />
                                        )}
                                        {isRunning && (
                                            <div className="h-full w-4 bg-white/30 animate-pulse rounded-full" />
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ═══ Body ═══ */}
                    <AnimatePresence>
                        {!isMinimized && (
                            <motion.div
                                initial={{ height: 0 }}
                                animate={{ height: 'auto' }}
                                exit={{ height: 0 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden bg-card"
                            >
                                {/* ── Queue Panel ── */}
                                {isInQueue ? (
                                    <div className="px-4 py-4 border-b border-border bg-gradient-to-b from-amber-500/5 to-transparent">
                                        {fbUser && (
                                            <div className="flex items-center gap-3 mb-4 p-2.5 rounded-xl bg-muted/40 border border-border/60">
                                                {fbUser.profilePic ? (
                                                    <img src={fbUser.profilePic} alt={fbUser.name}
                                                        className="w-9 h-9 rounded-full object-cover ring-2 ring-background" />
                                                ) : (
                                                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-bold text-sm">
                                                        {fbUser.name?.charAt(0)?.toUpperCase() || 'F'}
                                                    </div>
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-semibold truncate">{fbUser.name || 'Facebook User'}</p>
                                                    <p className="text-[11px] text-muted-foreground">กำลังรอคิว...</p>
                                                </div>
                                            </div>
                                        )}

                                        <div className="flex items-center gap-3 mb-3">
                                            <div className="relative flex-shrink-0">
                                                <div className="w-11 h-11 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center">
                                                    <Hourglass className="w-5 h-5 text-amber-500 animate-pulse" />
                                                </div>
                                                <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center shadow-lg">
                                                    <span className="text-[9px] font-black text-white">{queuePosition}</span>
                                                </div>
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-sm font-bold text-foreground">ลำดับที่ {queuePosition} ในคิว</p>
                                                <p className="text-[11px] text-muted-foreground mt-0.5">ระบบจะเริ่มอัตโนมัติเมื่อถึงคิว</p>
                                            </div>
                                        </div>

                                        {/* Queue progress dots */}
                                        <div className="flex items-center gap-1 mb-3">
                                            {Array.from({ length: Math.min(Math.max(queuePosition!, 5), 10) }).map((_, i) => (
                                                <div key={i} className={cn(
                                                    'h-1 rounded-full transition-all',
                                                    i < queuePosition! - 1 ? 'flex-1 bg-amber-500/30' :
                                                    i === queuePosition! - 1 ? 'flex-1 bg-amber-500 animate-pulse' :
                                                    'w-3 bg-muted/30'
                                                )} />
                                            ))}
                                        </div>

                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-muted/30 border border-border/60">
                                                <Users className="w-4 h-4 text-amber-500 flex-shrink-0" />
                                                <div>
                                                    <p className="text-[10px] text-muted-foreground">คิวของคุณ</p>
                                                    <p className="text-sm font-bold font-mono">#{queuePosition}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-muted/30 border border-border/60">
                                                <Timer className="w-4 h-4 text-amber-500 flex-shrink-0" />
                                                <div>
                                                    <p className="text-[10px] text-muted-foreground">รอประมาณ</p>
                                                    <p className="text-sm font-bold font-mono">
                                                        {countdown > 0
                                                            ? countdown >= 60
                                                                ? `${Math.floor(countdown / 60)}:${String(countdown % 60).padStart(2, '0')}`
                                                                : `${countdown}s`
                                                            : '—'}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        {/* ── Stats Dashboard ── */}
                                        <div className="px-4 py-3 border-b border-border">
                                            {/* Server info */}
                                            {isRunning && (
                                                <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-xl bg-gradient-to-r from-blue-500/8 to-blue-600/5 border border-blue-500/15">
                                                    <Server className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                                                    <span className="text-[11px] text-blue-600 dark:text-blue-400">
                                                        รันบน Server — ปิดหน้านี้ได้ กลับมาดูทีหลัง
                                                    </span>
                                                </div>
                                            )}

                                            {/* Stats grid */}
                                            <div className="grid grid-cols-4 gap-2">
                                                <div className="text-center p-2 rounded-xl bg-muted/30 border border-border/50">
                                                    <p className="text-base font-bold text-foreground">{resolvedTasks}/{totalSteps}</p>
                                                    <p className="text-[9px] text-muted-foreground mt-0.5">ทั้งหมด</p>
                                                </div>
                                                <div className="text-center p-2 rounded-xl bg-emerald-500/8 border border-emerald-500/15">
                                                    <p className="text-base font-bold text-emerald-600 dark:text-emerald-400">{completedTasks}</p>
                                                    <p className="text-[9px] text-muted-foreground mt-0.5">สำเร็จ</p>
                                                </div>
                                                <div className="text-center p-2 rounded-xl bg-amber-500/8 border border-amber-500/15">
                                                    <p className="text-base font-bold text-amber-600 dark:text-amber-400">{pendingApprovalTasks}</p>
                                                    <p className="text-[9px] text-muted-foreground mt-0.5">รออนุมัติ</p>
                                                </div>
                                                <div className="text-center p-2 rounded-xl bg-red-500/8 border border-red-500/15">
                                                    <p className="text-base font-bold text-red-600 dark:text-red-400">{failedTasks}</p>
                                                    <p className="text-[9px] text-muted-foreground mt-0.5">ล้มเหลว</p>
                                                </div>
                                            </div>

                                            {/* Completion summary — only when done */}
                                            {isDone && (
                                                <motion.div
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ delay: 0.2 }}
                                                    className={cn(
                                                        'mt-3 p-3 rounded-xl border flex items-center gap-3',
                                                        successRate >= 80 ? 'bg-emerald-500/8 border-emerald-500/20' :
                                                        successRate >= 50 ? 'bg-amber-500/8 border-amber-500/20' :
                                                        'bg-red-500/8 border-red-500/20'
                                                    )}
                                                >
                                                    <div className={cn(
                                                        'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
                                                        successRate >= 80 ? 'bg-emerald-500/15' :
                                                        successRate >= 50 ? 'bg-amber-500/15' :
                                                        'bg-red-500/15'
                                                    )}>
                                                        {successRate >= 80 ? <Trophy className="w-5 h-5 text-emerald-500" /> :
                                                         successRate >= 50 ? <BarChart3 className="w-5 h-5 text-amber-500" /> :
                                                         <AlertTriangle className="w-5 h-5 text-red-500" />}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-bold">
                                                            {successRate >= 80 ? 'ยอดเยี่ยม!' : successRate >= 50 ? 'ดำเนินการเสร็จ' : 'พบปัญหา'}
                                                        </p>
                                                        <p className="text-[11px] text-muted-foreground">
                                                            อัตราสำเร็จ {successRate}%
                                                            {duration > 0 && ` · ${formatDuration(duration)}`}
                                                        </p>
                                                    </div>
                                                    <div className="text-right flex-shrink-0">
                                                        <p className={cn('text-xl font-black',
                                                            successRate >= 80 ? 'text-emerald-600 dark:text-emerald-400' :
                                                            successRate >= 50 ? 'text-amber-600 dark:text-amber-400' :
                                                            'text-red-600 dark:text-red-400'
                                                        )}>
                                                            {successRate}%
                                                        </p>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </div>
                                    </>
                                )}

                                {/* ── Tabs ── */}
                                <div className="flex border-b border-border bg-muted/20">
                                    {tabs.map(tab => (
                                        <button
                                            key={tab.key}
                                            onClick={() => setActiveTab(tab.key)}
                                            className={cn(
                                                'flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-all relative',
                                                activeTab === tab.key
                                                    ? 'text-foreground'
                                                    : 'text-muted-foreground hover:text-foreground/70'
                                            )}
                                        >
                                            {tab.icon}
                                            {tab.label}
                                            {tab.count !== undefined && tab.count > 0 && (
                                                <span className={cn(
                                                    'text-[9px] px-1.5 py-0.5 rounded-full font-bold',
                                                    activeTab === tab.key
                                                        ? 'bg-orange-500/15 text-orange-600 dark:text-orange-400'
                                                        : 'bg-muted text-muted-foreground'
                                                )}>{tab.count}</span>
                                            )}
                                            {activeTab === tab.key && (
                                                <motion.div
                                                    layoutId="activeTab"
                                                    className="absolute bottom-0 left-2 right-2 h-0.5 bg-orange-500 rounded-full"
                                                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                                                />
                                            )}
                                        </button>
                                    ))}
                                </div>

                                {/* ── Tab Content ── */}
                                <div className={cn(
                                    'max-h-[280px] overflow-y-auto',
                                    isInQueue ? 'opacity-40 pointer-events-none' : ''
                                )}>
                                    {/* Tasks */}
                                    {activeTab === 'tasks' && (
                                        <div className="divide-y divide-border/50">
                                            {tasks.map((task, idx) => {
                                                const cfg = statusConfig[task.status] || statusConfig.pending;
                                                return (
                                                    <motion.div
                                                        key={task.id}
                                                        initial={{ opacity: 0, x: -8 }}
                                                        animate={{ opacity: 1, x: 0 }}
                                                        transition={{ delay: idx * 0.02 }}
                                                        className={cn(
                                                            'flex items-center gap-2.5 px-4 py-2.5 transition-colors',
                                                            task.status === 'in_progress' ? 'bg-blue-500/5' :
                                                            task.status === 'completed' ? 'bg-emerald-500/3' :
                                                            task.status === 'failed' ? 'bg-red-500/3' :
                                                            'hover:bg-muted/30'
                                                        )}
                                                    >
                                                        <span className="text-[10px] text-muted-foreground/50 font-mono w-4 text-right flex-shrink-0">
                                                            {idx + 1}
                                                        </span>
                                                        {cfg.icon}
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-xs font-medium truncate">{task.groupName}</p>
                                                            {task.message && (
                                                                <p className="text-[10px] text-muted-foreground truncate mt-0.5">{task.message}</p>
                                                            )}
                                                        </div>
                                                        <Badge variant="outline" className={cn('text-[9px] px-1.5 py-0 border', cfg.badgeCls)}>
                                                            {cfg.badge}
                                                        </Badge>
                                                    </motion.div>
                                                );
                                            })}
                                            {tasks.length === 0 && (
                                                <div className="px-4 py-10 text-center">
                                                    <Activity className="w-6 h-6 text-muted-foreground/30 mx-auto mb-2" />
                                                    <p className="text-xs text-muted-foreground">ยังไม่มี task</p>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Captions */}
                                    {activeTab === 'captions' && (
                                        <div className="p-3 space-y-2">
                                            {generatedCaptions.length > 0 ? generatedCaptions.map((cap, i) => (
                                                <div key={i} className="group relative p-3 rounded-xl bg-muted/30 border border-border/50 hover:border-border transition-colors">
                                                    <div className="flex items-center justify-between mb-1.5">
                                                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-orange-500/25 text-orange-600 dark:text-orange-400 bg-orange-500/10">
                                                            Caption {i + 1}
                                                        </Badge>
                                                        <button
                                                            onClick={() => navigator.clipboard?.writeText(cap)}
                                                            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-muted transition-all"
                                                            title="Copy"
                                                        >
                                                            <Copy className="w-3 h-3 text-muted-foreground" />
                                                        </button>
                                                    </div>
                                                    <p className="text-[11px] text-foreground/80 whitespace-pre-wrap leading-relaxed">{cap}</p>
                                                </div>
                                            )) : (
                                                <div className="text-center py-10">
                                                    <MessageSquareText className="w-6 h-6 text-muted-foreground/30 mx-auto mb-2" />
                                                    <p className="text-xs text-muted-foreground">ยังไม่มี caption</p>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Logs */}
                                    {activeTab === 'logs' && (
                                        <div
                                            ref={logContainerRef}
                                            onScroll={handleLogScroll}
                                            className="bg-zinc-950 text-zinc-300 font-mono text-[10.5px] leading-[1.7] p-3 max-h-[280px] overflow-y-auto"
                                        >
                                            {logs.length > 0 ? logs.map((entry, i) => (
                                                <div key={i} className={cn('flex gap-2 hover:bg-white/[0.02] px-1 rounded', getLogColor(entry.msg, entry.level))}>
                                                    <span className="text-zinc-600 flex-shrink-0 select-none">{formatTime(entry.time)}</span>
                                                    <span className="break-all">{entry.msg}</span>
                                                </div>
                                            )) : (
                                                <div className="text-zinc-600 text-center py-10 space-y-2">
                                                    <Terminal className="w-5 h-5 mx-auto opacity-30" />
                                                    <p>รอ log จาก Server...</p>
                                                </div>
                                            )}
                                            <div ref={logEndRef} />
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
