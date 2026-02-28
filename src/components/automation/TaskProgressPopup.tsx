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
            icon: <Loader2 className="w-3.5 h-3.5 text-accent animate-spin" />,
            badge: 'กำลังทำ',
            badgeCls: 'bg-[hsl(var(--accent)/0.12)] text-accent border-[hsl(var(--accent)/0.25)]',
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

    const headerStatusText = isInQueue
        ? `QUEUE #${queuePosition}`
        : isDone ? 'MISSION COMPLETE' : isPaused ? 'PAUSED' : 'POSTING';

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: 40, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 40, scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                className="fixed bottom-4 right-4 z-50 w-[440px] max-w-[calc(100vw-2rem)]"
            >
                <div className="rounded-2xl overflow-hidden card-elevated border border-[hsl(var(--accent)/0.15)]">
                    {/* ═══ Header ═══ */}
                    <div
                        className="relative cursor-pointer select-none gradient-accent"
                        onClick={() => setIsMinimized(!isMinimized)}
                    >
                        {/* Data-circuit pattern overlay */}
                        <div className="absolute inset-0 data-circuit opacity-30" />

                        <div className="relative px-4 py-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                    {/* Status indicator */}
                                    <div className="relative">
                                        <div className={cn(
                                            'w-2 h-2 rounded-full',
                                            isDone ? 'bg-white' : 'bg-white/80'
                                        )} />
                                        {(isRunning || isInQueue) && !isPaused && (
                                            <div className="absolute inset-0 w-2 h-2 rounded-full animate-ping bg-white/60" />
                                        )}
                                    </div>

                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-bold tracking-[0.15em] text-white/70 uppercase font-mono">
                                                {headerStatusText}
                                            </span>
                                            {startTime && (
                                                <span className="text-[10px] font-mono text-white/50 flex items-center gap-0.5">
                                                    <Timer className="w-2.5 h-2.5" /> {elapsed}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-[13px] font-bold text-white leading-tight mt-0.5">
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
                                                className="p-1.5 rounded-lg hover:bg-white/20 transition-colors" title={isPaused ? 'Resume' : 'Pause'}>
                                                {isPaused
                                                    ? <Play className="w-3.5 h-3.5 text-white" />
                                                    : <Pause className="w-3.5 h-3.5 text-white/90" />}
                                            </button>
                                            <button onClick={(e) => { e.stopPropagation(); onStop(); }}
                                                className="p-1.5 rounded-lg hover:bg-white/20 transition-colors" title="Stop">
                                                <Square className="w-3.5 h-3.5 text-white/90" />
                                            </button>
                                        </>
                                    )}
                                    {isDone && (
                                        <button onClick={(e) => { e.stopPropagation(); onDismiss(); }}
                                            className="p-1.5 rounded-lg hover:bg-white/20 transition-colors" title="Close">
                                            <X className="w-3.5 h-3.5 text-white/90" />
                                        </button>
                                    )}
                                    <div className="p-1">
                                        {isMinimized
                                            ? <ChevronUp className="w-3.5 h-3.5 text-white/60" />
                                            : <ChevronDown className="w-3.5 h-3.5 text-white/60" />}
                                    </div>
                                </div>
                            </div>

                            {/* Segmented progress bar */}
                            {!isInQueue && !isMinimized && (
                                <div className="mt-2.5 mb-0.5">
                                    <div className="h-1 rounded-full bg-white/20 overflow-hidden flex">
                                        {completedTasks > 0 && (
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${(completedTasks / totalSteps) * 100}%` }}
                                                transition={{ duration: 0.5 }}
                                                className="h-full bg-white"
                                            />
                                        )}
                                        {pendingApprovalTasks > 0 && (
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${(pendingApprovalTasks / totalSteps) * 100}%` }}
                                                transition={{ duration: 0.5 }}
                                                className="h-full bg-white/60"
                                            />
                                        )}
                                        {failedTasks > 0 && (
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${(failedTasks / totalSteps) * 100}%` }}
                                                transition={{ duration: 0.5 }}
                                                className="h-full bg-red-300/80"
                                            />
                                        )}
                                        {isRunning && (
                                            <div className="h-full w-6 bg-white/40 animate-pulse rounded-full" />
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
                                className="overflow-hidden bg-card/95 backdrop-blur-sm"
                            >
                                {/* ── Queue Panel ── */}
                                {isInQueue ? (
                                    <div className="px-4 py-4 border-b border-border/50 bg-gradient-to-b from-[hsl(var(--accent)/0.04)] to-transparent">
                                        {fbUser && (
                                            <div className="flex items-center gap-3 mb-4 p-2.5 rounded-lg bg-muted/40 border border-border/50">
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
                                                <div className="w-10 h-10 rounded-lg bg-[hsl(var(--accent)/0.12)] border border-[hsl(var(--accent)/0.2)] flex items-center justify-center">
                                                    <Hourglass className="w-4.5 h-4.5 text-accent animate-pulse" />
                                                </div>
                                                <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-accent flex items-center justify-center shadow-lg">
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
                                                    i < queuePosition! - 1 ? 'flex-1 bg-[hsl(var(--accent)/0.25)]' :
                                                    i === queuePosition! - 1 ? 'flex-1 bg-accent animate-pulse' :
                                                    'w-3 bg-muted/30'
                                                )} />
                                            ))}
                                        </div>

                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/50">
                                                <Users className="w-4 h-4 text-accent flex-shrink-0" />
                                                <div>
                                                    <p className="text-[10px] text-muted-foreground">คิวของคุณ</p>
                                                    <p className="text-sm font-bold font-mono">#{queuePosition}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/50">
                                                <Timer className="w-4 h-4 text-accent flex-shrink-0" />
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
                                        <div className="px-4 py-3 border-b border-border/50">
                                            {/* Server info */}
                                            {isRunning && (
                                                <div className="flex items-center gap-2 mb-3 px-2.5 py-1.5 rounded-lg bg-[hsl(var(--accent)/0.06)] border border-[hsl(var(--accent)/0.12)]">
                                                    <Server className="w-3.5 h-3.5 text-accent flex-shrink-0" />
                                                    <span className="text-[11px] text-muted-foreground">
                                                        รันบน Server — ปิดหน้านี้ได้ กลับมาดูทีหลัง
                                                    </span>
                                                </div>
                                            )}

                                            {/* Stats grid — matches HealthCheckCard style */}
                                            <div className="grid grid-cols-3 gap-2">
                                                <div className="text-center p-2.5 rounded-lg bg-muted/50">
                                                    <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{completedTasks}</p>
                                                    <p className="text-[10px] text-muted-foreground">สำเร็จ</p>
                                                </div>
                                                <div className="text-center p-2.5 rounded-lg bg-muted/50">
                                                    <p className="text-lg font-bold text-amber-600 dark:text-amber-400">{pendingApprovalTasks}</p>
                                                    <p className="text-[10px] text-muted-foreground">รออนุมัติ</p>
                                                </div>
                                                <div className="text-center p-2.5 rounded-lg bg-muted/50">
                                                    <p className="text-lg font-bold text-red-600 dark:text-red-400">{failedTasks}</p>
                                                    <p className="text-[10px] text-muted-foreground">ล้มเหลว</p>
                                                </div>
                                            </div>

                                            {/* Completion summary */}
                                            {isDone && (
                                                <motion.div
                                                    initial={{ opacity: 0, y: 6 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ delay: 0.15 }}
                                                    className={cn(
                                                        'mt-3 p-2.5 rounded-lg border flex items-center gap-3',
                                                        successRate >= 80 ? 'bg-emerald-500/8 border-emerald-500/20' :
                                                        successRate >= 50 ? 'bg-[hsl(var(--accent)/0.08)] border-[hsl(var(--accent)/0.2)]' :
                                                        'bg-red-500/8 border-red-500/20'
                                                    )}
                                                >
                                                    <div className={cn(
                                                        'w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0',
                                                        successRate >= 80 ? 'bg-emerald-500/15' :
                                                        successRate >= 50 ? 'bg-[hsl(var(--accent)/0.15)]' :
                                                        'bg-red-500/15'
                                                    )}>
                                                        {successRate >= 80 ? <Trophy className="w-4 h-4 text-emerald-500" /> :
                                                         successRate >= 50 ? <BarChart3 className="w-4 h-4 text-accent" /> :
                                                         <AlertTriangle className="w-4 h-4 text-red-500" />}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-semibold">
                                                            {successRate >= 80 ? 'ยอดเยี่ยม!' : successRate >= 50 ? 'ดำเนินการเสร็จ' : 'พบปัญหา'}
                                                        </p>
                                                        <p className="text-[11px] text-muted-foreground">
                                                            อัตราสำเร็จ {successRate}%
                                                            {duration > 0 && ` · ${formatDuration(duration)}`}
                                                        </p>
                                                    </div>
                                                    <div className="text-right flex-shrink-0">
                                                        <p className={cn('text-lg font-black',
                                                            successRate >= 80 ? 'text-emerald-600 dark:text-emerald-400' :
                                                            successRate >= 50 ? 'text-accent' :
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
                                <div className="flex border-b border-border/50">
                                    {tabs.map(tab => (
                                        <button
                                            key={tab.key}
                                            onClick={() => setActiveTab(tab.key)}
                                            className={cn(
                                                'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition-all relative',
                                                activeTab === tab.key
                                                    ? 'text-accent'
                                                    : 'text-muted-foreground hover:text-foreground/70'
                                            )}
                                        >
                                            {tab.icon}
                                            {tab.label}
                                            {tab.count !== undefined && tab.count > 0 && (
                                                <span className={cn(
                                                    'text-[9px] px-1.5 py-0.5 rounded-full font-bold',
                                                    activeTab === tab.key
                                                        ? 'bg-[hsl(var(--accent)/0.12)] text-accent'
                                                        : 'bg-muted text-muted-foreground'
                                                )}>{tab.count}</span>
                                            )}
                                            {activeTab === tab.key && (
                                                <motion.div
                                                    layoutId="activeTab"
                                                    className="absolute bottom-0 left-2 right-2 h-0.5 bg-accent rounded-full"
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
                                        <div className="divide-y divide-border/30">
                                            {tasks.map((task, idx) => {
                                                const cfg = statusConfig[task.status] || statusConfig.pending;
                                                return (
                                                    <motion.div
                                                        key={task.id}
                                                        initial={{ opacity: 0, x: -6 }}
                                                        animate={{ opacity: 1, x: 0 }}
                                                        transition={{ delay: idx * 0.02 }}
                                                        className={cn(
                                                            'flex items-center gap-2 px-3 py-2 transition-colors',
                                                            task.status === 'in_progress' ? 'bg-[hsl(var(--accent)/0.04)]' :
                                                            task.status === 'completed' ? 'bg-emerald-500/[0.03]' :
                                                            task.status === 'failed' ? 'bg-red-500/[0.03]' :
                                                            'hover:bg-muted/20'
                                                        )}
                                                    >
                                                        <span className="text-[10px] text-muted-foreground/40 font-mono w-4 text-right flex-shrink-0">
                                                            {idx + 1}
                                                        </span>
                                                        {cfg.icon}
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-xs font-medium truncate">{task.groupName}</p>
                                                            {task.message && (
                                                                <p className="text-[10px] text-muted-foreground truncate mt-0.5">{task.message}</p>
                                                            )}
                                                        </div>
                                                        <Badge variant="outline" className={cn('text-[9px] px-1.5 py-0 border font-semibold', cfg.badgeCls)}>
                                                            {cfg.badge}
                                                        </Badge>
                                                    </motion.div>
                                                );
                                            })}
                                            {tasks.length === 0 && (
                                                <div className="px-4 py-8 text-center">
                                                    <Activity className="w-5 h-5 text-muted-foreground/20 mx-auto mb-1.5" />
                                                    <p className="text-[11px] text-muted-foreground">ยังไม่มี task</p>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Captions */}
                                    {activeTab === 'captions' && (
                                        <div className="p-3 space-y-2">
                                            {generatedCaptions.length > 0 ? generatedCaptions.map((cap, i) => (
                                                <div key={i} className="group relative p-2.5 rounded-lg bg-muted/30 border border-border/40 hover:border-[hsl(var(--accent)/0.2)] transition-colors">
                                                    <div className="flex items-center justify-between mb-1.5">
                                                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-[hsl(var(--accent)/0.25)] text-accent bg-[hsl(var(--accent)/0.08)]">
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
                                                <div className="text-center py-8">
                                                    <MessageSquareText className="w-5 h-5 text-muted-foreground/20 mx-auto mb-1.5" />
                                                    <p className="text-[11px] text-muted-foreground">ยังไม่มี caption</p>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Logs — terminal style matching GRAND$TATE ENGINE */}
                                    {activeTab === 'logs' && (
                                        <div
                                            ref={logContainerRef}
                                            onScroll={handleLogScroll}
                                            className="relative bg-[hsl(217,71%,8%)] text-zinc-300 font-mono text-[10.5px] leading-[1.65] p-3 max-h-[280px] overflow-y-auto"
                                        >
                                            {/* CRT scanline overlay */}
                                            <div className="pointer-events-none absolute inset-0 opacity-[0.03]" style={{
                                                backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.05) 2px, rgba(255,255,255,0.05) 4px)',
                                            }} />
                                            {logs.length > 0 ? logs.map((entry, i) => (
                                                <div key={i} className={cn('flex gap-2 hover:bg-white/[0.02] px-1 rounded', getLogColor(entry.msg, entry.level))}>
                                                    <span className="text-zinc-600 flex-shrink-0 select-none">{formatTime(entry.time)}</span>
                                                    <span className="break-all">{entry.msg}</span>
                                                </div>
                                            )) : (
                                                <div className="text-zinc-600 text-center py-8 space-y-1.5">
                                                    <Terminal className="w-4 h-4 mx-auto opacity-30" />
                                                    <p className="text-[10px]">รอ log จาก Server...</p>
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
