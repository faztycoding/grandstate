import { useState, useEffect, useRef } from 'react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
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
    onStop: () => void;
    onPause: () => void;
    onDismiss: () => void;
}

// Format elapsed time as m:ss or h:mm:ss
function formatElapsed(ms: number): string {
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
}

// Format timestamp as HH:mm:ss
function formatTime(ts: number): string {
    const d = new Date(ts);
    return d.toLocaleTimeString('th-TH', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// Get color class for log level / emoji
function getLogColor(msg: string, level: string): string {
    if (level === 'error' || msg.includes('❌') || msg.includes('🚨')) return 'text-red-400';
    if (level === 'success' || msg.includes('✅') || msg.includes('🏁')) return 'text-green-400';
    if (level === 'warn' || msg.includes('⏳') || msg.includes('🔄') || msg.includes('🕓')) return 'text-yellow-400';
    if (level === 'start' || msg.includes('🚀') || msg.includes('📦')) return 'text-blue-400';
    return 'text-gray-300';
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
    onStop,
    onPause,
    onDismiss,
}: TaskProgressPopupProps) {
    const [isMinimized, setIsMinimized] = useState(false);
    const [activeTab, setActiveTab] = useState<TabType>('tasks');
    const [elapsed, setElapsed] = useState('0:00');
    const logEndRef = useRef<HTMLDivElement>(null);
    const logContainerRef = useRef<HTMLDivElement>(null);
    const [autoScroll, setAutoScroll] = useState(true);

    const pendingApprovalTasks = tasks.filter(t => t.status === 'pending_approval').length;
    const isDone = !isRunning && tasks.length > 0 && tasks.every(
        t => t.status === 'completed' || t.status === 'pending_approval' || t.status === 'failed'
    );
    const hasContent = isRunning || isDone || tasks.length > 0;

    // Elapsed time timer
    useEffect(() => {
        if (!startTime) {
            setElapsed('0:00');
            return;
        }

        const update = () => {
            const referenceTime = !isRunning && typeof endTime === 'number'
                ? endTime
                : Date.now();
            setElapsed(formatElapsed(Math.max(0, referenceTime - startTime)));
        };

        update();
        if (isRunning) {
            const id = setInterval(update, 1000);
            return () => clearInterval(id);
        }
    }, [startTime, endTime, isRunning]);

    // Auto-scroll logs
    useEffect(() => {
        if (autoScroll && activeTab === 'logs' && logEndRef.current) {
            logEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs, activeTab, autoScroll]);

    // Detect user scroll to toggle auto-scroll
    const handleLogScroll = () => {
        if (!logContainerRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = logContainerRef.current;
        setAutoScroll(scrollHeight - scrollTop - clientHeight < 40);
    };

    if (!hasContent) return null;

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'completed': return <CheckCircle2 className="w-4 h-4 text-green-500" />;
            case 'pending_approval': return <Clock className="w-4 h-4 text-amber-500" />;
            case 'failed': return <XCircle className="w-4 h-4 text-red-500" />;
            case 'in_progress': return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
            default: return <Clock className="w-4 h-4 text-muted-foreground" />;
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'completed': return <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-[10px]">สำเร็จ</Badge>;
            case 'pending_approval': return <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-[10px]">รออนุมัติ</Badge>;
            case 'failed': return <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-[10px]">ล้มเหลว</Badge>;
            case 'in_progress': return <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-[10px]">กำลังทำ</Badge>;
            default: return <Badge variant="secondary" className="text-[10px]">รอคิว</Badge>;
        }
    };

    const tabs: { key: TabType; label: string; icon: React.ReactNode; count?: number }[] = [
        { key: 'tasks', label: 'Tasks', icon: <ListChecks className="w-3.5 h-3.5" />, count: tasks.length },
        { key: 'captions', label: 'Captions', icon: <MessageSquareText className="w-3.5 h-3.5" />, count: generatedCaptions.length },
        { key: 'logs', label: 'Logs', icon: <Terminal className="w-3.5 h-3.5" />, count: logs.length },
    ];

    return (
        <div className="fixed bottom-4 right-4 z-50 w-[420px] max-w-[calc(100vw-2rem)]">
            <div className="bg-card border border-border rounded-xl shadow-2xl overflow-hidden">
                {/* Header */}
                <div
                    className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-accent/10 to-orange-500/10 border-b border-border cursor-pointer"
                    onClick={() => setIsMinimized(!isMinimized)}
                >
                    <div className="flex items-center gap-2">
                        {isRunning ? (
                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        ) : isDone ? (
                            <div className="w-2 h-2 rounded-full bg-blue-500" />
                        ) : null}
                        <span className="font-semibold text-sm">
                            {isDone
                                ? (pendingApprovalTasks > 0 ? '✅ โพสต์เสร็จ (บางกลุ่มรออนุมัติ)' : '✅ เสร็จสิ้น')
                                : isPaused
                                    ? '⏸️ หยุดชั่วคราว'
                                    : '🚀 กำลังโพสต์อัตโนมัติ'}
                        </span>

                        {/* Elapsed Time */}
                        {startTime && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-full">
                                <Timer className="w-3 h-3" />
                                <span className="font-mono">{elapsed}</span>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-1">
                        {isRunning && (
                            <>
                                <button onClick={(e) => { e.stopPropagation(); onPause(); }} className="p-1 hover:bg-muted rounded" title={isPaused ? 'Resume' : 'Pause'}>
                                    {isPaused ? <Play className="w-3.5 h-3.5 text-green-500" /> : <Pause className="w-3.5 h-3.5 text-yellow-500" />}
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); onStop(); }} className="p-1 hover:bg-muted rounded" title="Stop">
                                    <Square className="w-3.5 h-3.5 text-red-500" />
                                </button>
                            </>
                        )}
                        {isDone && (
                            <button onClick={(e) => { e.stopPropagation(); onDismiss(); }} className="p-1 hover:bg-muted rounded" title="Close">
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                        {isMinimized ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                    </div>
                </div>

                {!isMinimized && (
                    <>
                        {/* Progress */}
                        <div className="px-4 py-2 border-b border-border">
                            <>
                            {(() => {
                                const resolvedTasks = completedTasks + pendingApprovalTasks + failedTasks;
                                return (
                            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                                <span>{resolvedTasks} / {totalSteps} กลุ่ม</span>
                                <span>
                                    <span className="text-green-500">{completedTasks} สำเร็จ</span>
                                    {pendingApprovalTasks > 0 && <span className="text-amber-500 ml-2">{pendingApprovalTasks} รออนุมัติ</span>}
                                    {failedTasks > 0 && <span className="text-red-500 ml-2">{failedTasks} ล้มเหลว</span>}
                                </span>
                            </div>
                                );
                            })()}
                            </>
                            <Progress value={progressPercent} className="h-2" />
                        </div>

                        {/* Tabs */}
                        <div className="flex border-b border-border">
                            {tabs.map(tab => (
                                <button
                                    key={tab.key}
                                    onClick={() => setActiveTab(tab.key)}
                                    className={cn(
                                        'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors',
                                        activeTab === tab.key
                                            ? 'text-accent border-b-2 border-accent bg-accent/5'
                                            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                                    )}
                                >
                                    {tab.icon}
                                    {tab.label}
                                    {tab.count !== undefined && tab.count > 0 && (
                                        <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded-full">{tab.count}</span>
                                    )}
                                </button>
                            ))}
                        </div>

                        {/* Tab Content */}
                        <div className="max-h-[300px] overflow-y-auto">
                            {/* Tasks Tab */}
                            {activeTab === 'tasks' && (
                                <div className="divide-y divide-border">
                                    {tasks.map((task) => (
                                        <div key={task.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors">
                                            {getStatusIcon(task.status)}
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium truncate">{task.groupName}</p>
                                                {task.message && (
                                                    <p className="text-xs text-muted-foreground truncate">{task.message}</p>
                                                )}
                                            </div>
                                            {getStatusBadge(task.status)}
                                        </div>
                                    ))}
                                    {tasks.length === 0 && (
                                        <div className="px-4 py-8 text-center text-sm text-muted-foreground">ไม่มี task</div>
                                    )}
                                </div>
                            )}

                            {/* Captions Tab */}
                            {activeTab === 'captions' && (
                                <div className="p-4 space-y-3">
                                    {generatedCaptions.length > 0 ? generatedCaptions.map((cap, i) => (
                                        <div key={i} className="p-3 rounded-lg bg-muted/50 border border-border">
                                            <div className="flex items-center gap-2 mb-1">
                                                <Badge variant="secondary" className="text-[10px]">Caption {i + 1}</Badge>
                                            </div>
                                            <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed">{cap}</p>
                                        </div>
                                    )) : (
                                        <div className="text-center py-8 text-sm text-muted-foreground">ยังไม่มี caption</div>
                                    )}
                                </div>
                            )}

                            {/* Logs Tab — Terminal style */}
                            {activeTab === 'logs' && (
                                <div
                                    ref={logContainerRef}
                                    onScroll={handleLogScroll}
                                    className="bg-gray-950 text-gray-300 font-mono text-[11px] leading-[1.6] p-3 max-h-[300px] overflow-y-auto"
                                >
                                    {logs.length > 0 ? logs.map((entry, i) => (
                                        <div key={i} className={cn('flex gap-2', getLogColor(entry.msg, entry.level))}>
                                            <span className="text-gray-600 flex-shrink-0 select-none">{formatTime(entry.time)}</span>
                                            <span className="break-all">{entry.msg}</span>
                                        </div>
                                    )) : (
                                        <div className="text-gray-600 text-center py-8">รอ log จาก VPS...</div>
                                    )}
                                    <div ref={logEndRef} />
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
