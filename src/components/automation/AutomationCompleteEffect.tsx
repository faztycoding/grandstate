import { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2, XCircle, Clock, Trophy, Sparkles, X,
  TrendingUp, AlertTriangle, BarChart3, Timer, Users, Zap,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

interface TaskResult {
  id: string;
  groupId: string;
  groupName: string;
  status: 'completed' | 'pending_approval' | 'failed' | 'pending' | 'in_progress';
  message?: string;
  postUrl?: string;
}

interface AutomationCompleteEffectProps {
  show: boolean;
  tasks: TaskResult[];
  startTime: number | null;
  endTime: number | null;
  onDismiss: () => void;
}

function playCompleteSound(successRate: number) {
  try {
    const ctx = new AudioContext();
    const now = ctx.currentTime;

    if (successRate >= 70) {
      // Victory fanfare — three ascending notes
      const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.15);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.2, now + i * 0.15 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.15 + 0.4);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now + i * 0.15);
        osc.stop(now + i * 0.15 + 0.5);
      });

      // Final chord
      [523.25, 659.25, 783.99, 1046.50].forEach((freq) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + 0.5);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.12, now + 0.52);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now + 0.5);
        osc.stop(now + 1.6);
      });
    } else {
      // Softer completion tone
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.7);
    }

    setTimeout(() => ctx.close(), 2000);
  } catch { /* silent */ }
}

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h} ชม. ${m} นาที ${s} วินาที`;
  if (m > 0) return `${m} นาที ${s} วินาที`;
  return `${s} วินาที`;
}

export function AutomationCompleteEffect({ show, tasks, startTime, endTime, onDismiss }: AutomationCompleteEffectProps) {
  const [phase, setPhase] = useState<'idle' | 'effect' | 'report'>('idle');

  const stats = useMemo(() => {
    const completed = tasks.filter(t => t.status === 'completed').length;
    const pendingApproval = tasks.filter(t => t.status === 'pending_approval').length;
    const failed = tasks.filter(t => t.status === 'failed').length;
    const total = tasks.length;
    const posted = completed + pendingApproval;
    const successRate = total > 0 ? Math.round((posted / total) * 100) : 0;
    const duration = startTime && endTime ? endTime - startTime : 0;
    return { completed, pendingApproval, failed, total, posted, successRate, duration };
  }, [tasks, startTime, endTime]);

  useEffect(() => {
    if (!show) {
      setPhase('idle');
      return;
    }
    playCompleteSound(stats.successRate);
    setPhase('effect');
    const t1 = setTimeout(() => setPhase('report'), 1800);
    return () => clearTimeout(t1);
  }, [show, stats.successRate]);

  const isGreat = stats.successRate >= 80;
  const isOk = stats.successRate >= 50;

  return (
    <AnimatePresence>
      {show && phase !== 'idle' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget && phase === 'report') onDismiss(); }}
        >
          {/* Celebration particles — only on great results */}
          {phase === 'effect' && isGreat && (
            <>
              {Array.from({ length: 24 }).map((_, i) => {
                const angle = (i / 24) * Math.PI * 2;
                const dist = 100 + Math.random() * 150;
                const colors = ['#f97316', '#fbbf24', '#22c55e', '#3b82f6', '#a855f7', '#ec4899'];
                return (
                  <motion.div
                    key={`cp-${i}`}
                    initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                    animate={{
                      x: Math.cos(angle) * dist,
                      y: Math.sin(angle) * dist - 50,
                      opacity: 0,
                      scale: 0,
                    }}
                    transition={{ duration: 1.2, delay: Math.random() * 0.3, ease: 'easeOut' }}
                    className="absolute rounded-full"
                    style={{
                      width: 4 + Math.random() * 6,
                      height: 4 + Math.random() * 6,
                      background: colors[i % colors.length],
                      boxShadow: `0 0 6px ${colors[i % colors.length]}`,
                    }}
                  />
                );
              })}
            </>
          )}

          {/* Trophy icon burst */}
          {phase === 'effect' && (
            <motion.div
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: [0, 1.3, 1], rotate: [-20, 5, 0] }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className="relative z-10"
            >
              <div className={`w-24 h-24 rounded-3xl flex items-center justify-center shadow-2xl ${
                isGreat
                  ? 'bg-gradient-to-br from-amber-400 to-orange-500 shadow-amber-500/40'
                  : isOk
                  ? 'bg-gradient-to-br from-blue-400 to-blue-600 shadow-blue-500/40'
                  : 'bg-gradient-to-br from-gray-400 to-gray-600 shadow-gray-500/40'
              }`}>
                {isGreat ? (
                  <Trophy className="w-12 h-12 text-white" />
                ) : isOk ? (
                  <CheckCircle2 className="w-12 h-12 text-white" />
                ) : (
                  <AlertTriangle className="w-12 h-12 text-white" />
                )}
              </div>
              {isGreat && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.3 }}
                  className="absolute -top-2 -right-2"
                >
                  <Sparkles className="w-8 h-8 text-amber-300 drop-shadow-lg" />
                </motion.div>
              )}
            </motion.div>
          )}

          {/* Result Report Card */}
          {phase === 'report' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className="relative w-[440px] max-w-[calc(100vw-2rem)] max-h-[85vh] overflow-y-auto rounded-2xl bg-card border border-border shadow-2xl"
            >
              {/* Header Banner */}
              <div className={`relative px-6 pt-6 pb-5 overflow-hidden ${
                isGreat
                  ? 'bg-gradient-to-br from-amber-500/15 via-orange-500/10 to-green-500/5'
                  : isOk
                  ? 'bg-gradient-to-br from-blue-500/15 via-blue-500/10 to-sky-500/5'
                  : 'bg-gradient-to-br from-red-500/10 via-gray-500/5 to-transparent'
              }`}>
                {/* Subtle grid pattern */}
                <div className="absolute inset-0 opacity-[0.03]" style={{
                  backgroundImage: 'linear-gradient(rgba(0,0,0,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.3) 1px, transparent 1px)',
                  backgroundSize: '24px 24px',
                }} />

                <div className="relative flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      isGreat ? 'bg-gradient-to-br from-amber-500 to-orange-500' :
                      isOk ? 'bg-gradient-to-br from-blue-500 to-blue-600' :
                      'bg-gradient-to-br from-gray-500 to-gray-600'
                    }`}>
                      {isGreat ? <Trophy className="w-6 h-6 text-white" /> :
                       isOk ? <CheckCircle2 className="w-6 h-6 text-white" /> :
                       <AlertTriangle className="w-6 h-6 text-white" />}
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-foreground">
                        {isGreat ? 'ยอดเยี่ยม!' : isOk ? 'เสร็จสิ้น' : 'ดำเนินการเสร็จ'}
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        Automation {isGreat ? 'สำเร็จอย่างสมบูรณ์' : 'ดำเนินการเรียบร้อย'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={onDismiss}
                    className="p-1.5 rounded-lg hover:bg-muted/60 transition-colors"
                  >
                    <X className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>

                {/* Success rate ring */}
                <div className="flex items-center justify-center mt-5">
                  <div className="relative">
                    <svg width="100" height="100" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="42" fill="none" strokeWidth="8"
                        className="stroke-muted/30" />
                      <motion.circle
                        cx="50" cy="50" r="42" fill="none" strokeWidth="8"
                        strokeLinecap="round"
                        initial={{ strokeDashoffset: 264 }}
                        animate={{ strokeDashoffset: 264 - (264 * stats.successRate / 100) }}
                        transition={{ duration: 1, delay: 0.3, ease: 'easeOut' }}
                        strokeDasharray="264"
                        transform="rotate(-90 50 50)"
                        className={isGreat ? 'stroke-green-500' : isOk ? 'stroke-blue-500' : 'stroke-amber-500'}
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.5 }}
                        className="text-2xl font-black"
                      >
                        {stats.successRate}%
                      </motion.span>
                      <span className="text-[10px] text-muted-foreground">สำเร็จ</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="px-6 py-4">
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="text-center p-3 rounded-xl bg-green-500/10 border border-green-500/20">
                    <CheckCircle2 className="w-5 h-5 text-green-500 mx-auto mb-1" />
                    <p className="text-xl font-bold text-green-600 dark:text-green-400">{stats.completed}</p>
                    <p className="text-[10px] text-muted-foreground">สำเร็จ</p>
                  </div>
                  <div className="text-center p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                    <Clock className="w-5 h-5 text-amber-500 mx-auto mb-1" />
                    <p className="text-xl font-bold text-amber-600 dark:text-amber-400">{stats.pendingApproval}</p>
                    <p className="text-[10px] text-muted-foreground">รออนุมัติ</p>
                  </div>
                  <div className="text-center p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                    <XCircle className="w-5 h-5 text-red-500 mx-auto mb-1" />
                    <p className="text-xl font-bold text-red-600 dark:text-red-400">{stats.failed}</p>
                    <p className="text-[10px] text-muted-foreground">ล้มเหลว</p>
                  </div>
                </div>

                {/* Progress bar summary */}
                <div className="mb-4">
                  <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                    <span className="flex items-center gap-1"><BarChart3 className="w-3 h-3" /> ผลรวม</span>
                    <span>{stats.posted}/{stats.total} กลุ่ม</span>
                  </div>
                  <div className="h-3 rounded-full bg-muted/30 overflow-hidden flex">
                    {stats.completed > 0 && (
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(stats.completed / stats.total) * 100}%` }}
                        transition={{ duration: 0.8, delay: 0.2 }}
                        className="h-full bg-green-500"
                      />
                    )}
                    {stats.pendingApproval > 0 && (
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(stats.pendingApproval / stats.total) * 100}%` }}
                        transition={{ duration: 0.8, delay: 0.4 }}
                        className="h-full bg-amber-500"
                      />
                    )}
                    {stats.failed > 0 && (
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(stats.failed / stats.total) * 100}%` }}
                        transition={{ duration: 0.8, delay: 0.6 }}
                        className="h-full bg-red-500"
                      />
                    )}
                  </div>
                </div>

                {/* Time stats */}
                <div className="flex gap-3 mb-4">
                  <div className="flex-1 flex items-center gap-2 p-2.5 rounded-lg bg-muted/30 border border-border">
                    <Timer className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-[10px] text-muted-foreground">ใช้เวลา</p>
                      <p className="text-xs font-semibold">{stats.duration > 0 ? formatDuration(stats.duration) : '—'}</p>
                    </div>
                  </div>
                  <div className="flex-1 flex items-center gap-2 p-2.5 rounded-lg bg-muted/30 border border-border">
                    <TrendingUp className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-[10px] text-muted-foreground">ความเร็ว</p>
                      <p className="text-xs font-semibold">
                        {stats.duration > 0 && stats.total > 0
                          ? `~${Math.round(stats.duration / 1000 / stats.total)} วิ/กลุ่ม`
                          : '—'}
                      </p>
                    </div>
                  </div>
                  <div className="flex-1 flex items-center gap-2 p-2.5 rounded-lg bg-muted/30 border border-border">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-[10px] text-muted-foreground">กลุ่ม</p>
                      <p className="text-xs font-semibold">{stats.total} กลุ่ม</p>
                    </div>
                  </div>
                </div>

                {/* Task list */}
                <div className="mb-4">
                  <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5" />
                    รายละเอียดแต่ละกลุ่ม
                  </p>
                  <div className="rounded-xl border border-border divide-y divide-border max-h-[200px] overflow-y-auto">
                    {tasks.map((task, i) => (
                      <motion.div
                        key={task.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.05 * i }}
                        className="flex items-center gap-2.5 px-3 py-2 hover:bg-muted/30 transition-colors"
                      >
                        <span className="text-[10px] text-muted-foreground w-5 text-right font-mono">{i + 1}</span>
                        {task.status === 'completed' && <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />}
                        {task.status === 'pending_approval' && <Clock className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />}
                        {task.status === 'failed' && <XCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />}
                        {(task.status === 'pending' || task.status === 'in_progress') && <Clock className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{task.groupName}</p>
                          {task.message && (
                            <p className="text-[10px] text-muted-foreground truncate">{task.message}</p>
                          )}
                        </div>
                        <Badge className={`text-[9px] px-1.5 py-0 ${
                          task.status === 'completed' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                          task.status === 'pending_approval' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                          task.status === 'failed' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                          'bg-muted text-muted-foreground'
                        }`}>
                          {task.status === 'completed' ? 'สำเร็จ' :
                           task.status === 'pending_approval' ? 'รออนุมัติ' :
                           task.status === 'failed' ? 'ล้มเหลว' : 'รอ'}
                        </Badge>
                      </motion.div>
                    ))}
                  </div>
                </div>

                {/* Action */}
                <Button onClick={onDismiss} className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white">
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  ปิดรายงาน
                </Button>
              </div>
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
