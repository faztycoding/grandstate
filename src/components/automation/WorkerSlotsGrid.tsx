import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Settings,
  Shield,
  Fingerprint,
  Eye,
  Globe,
  Wifi,
  MousePointer2,
  Image as ImageIcon,
  Terminal,
  Lock,
  Monitor,
  Pause,
  Activity,
  Zap,
  Box,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { apiFetch } from '@/lib/config';

// ─── Types ─────────────────────────────────────

interface SlotProgress {
  completed: number;
  failed: number;
  total: number;
  percent: number;
}

interface LogEntry {
  time: number;
  msg: string;
  level: string;
}

interface WorkerSlot {
  slotId: string;
  status: 'standby' | 'running' | 'paused';
  userId: string | null;
  displayName: string | null;
  fbAccount: string | null;
  propertyTitle: string | null;
  automationType: string | null;
  groupCount: number;
  startedAt: number | null;
  runningSec: number;
  progress: SlotProgress;
  logs: LogEntry[];
  generatedCaptions: string[];
}

interface AntiDetectionModule {
  status: string;
  active: boolean;
}

interface WorkerSlotsData {
  maxSlots: number;
  activeCount: number;
  queueCount: number;
  slots: WorkerSlot[];
  antiDetection: Record<string, AntiDetectionModule>;
}

// ─── Node Inspection Dialog ─────────────────────

type InspectionTab = 'live' | 'secure' | 'logs';

function NodeInspectionDialog({
  open,
  onOpenChange,
  slot,
  antiDetection,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  slot: WorkerSlot | null;
  antiDetection: Record<string, AntiDetectionModule>;
}) {
  const [tab, setTab] = useState<InspectionTab>('live');

  if (!slot) return null;

  const isActive = slot.status === 'running' || slot.status === 'paused';

  // Build synthetic live log entries for standby nodes
  const liveEntries: { prefix: string; color: string; msg: string }[] = [];
  if (slot.logs.length > 0) {
    slot.logs.forEach(l => {
      let prefix = 'INFO';
      let color = 'text-slate-400';
      if (l.level === 'success' || l.msg.includes('✅') || l.msg.includes('สำเร็จ')) { prefix = 'OK'; color = 'text-green-400'; }
      else if (l.level === 'error' || l.msg.includes('❌')) { prefix = 'ERR'; color = 'text-red-400'; }
      else if (l.level === 'warn' || l.msg.includes('⚠')) { prefix = 'WARN'; color = 'text-amber-400'; }
      else if (l.msg.includes('[SEC]') || l.msg.includes('Anti') || l.msg.includes('stealth')) { prefix = 'SEC'; color = 'text-cyan-400'; }
      else if (l.msg.includes('[NET]') || l.msg.includes('Proxy') || l.msg.includes('SSE')) { prefix = 'NET'; color = 'text-blue-400'; }
      else if (l.msg.includes('[SYS]') || l.msg.includes('Init') || l.msg.includes('Start')) { prefix = 'SYS'; color = 'text-amber-500'; }
      liveEntries.push({ prefix, color, msg: l.msg });
    });
  } else {
    // Standby synthetic logs
    liveEntries.push(
      { prefix: 'SYS', color: 'text-amber-500', msg: `Initializing Node_${slot.slotId}...` },
      { prefix: 'NET', color: 'text-blue-400', msg: 'Proxy connected: SG-Server-001' },
      { prefix: 'SEC', color: 'text-cyan-400', msg: 'Anti-detection stealth modules loaded' },
      { prefix: 'SEC', color: 'text-cyan-400', msg: 'Gaussian Jitter: HIGH' },
      { prefix: 'NET', color: 'text-blue-400', msg: 'SSE stream: Connected' },
      { prefix: 'SYS', color: 'text-amber-500', msg: `Node_${slot.slotId} on standby — no active task` },
      { prefix: 'IDLE', color: 'text-slate-500', msg: 'Awaiting task assignment...' },
    );
  }

  const antiModules = [
    { key: 'gaussianJitter', label: 'GAUSSIAN JITTER', desc: 'Human-like timing randomization', icon: Activity, tag: antiDetection.gaussianJitter?.status || 'HIGH' },
    { key: 'fingerprintMasking', label: 'FINGERPRINT MASKING', desc: 'Browser identity spoofing 100%', icon: Fingerprint, tag: antiDetection.fingerprintMasking?.status || 'OK' },
    { key: 'webrtcShield', label: 'WEBRTC LEAK SHIELD', desc: 'Real IP leak prevention active', icon: Globe, tag: antiDetection.webrtcShield?.status || 'OK' },
    { key: 'behaviorSimulation', label: 'BEHAVIOR SIMULATION', desc: 'Mouse/scroll movement emulation', icon: MousePointer2, tag: antiDetection.behaviorSimulation?.status || 'OK' },
    { key: 'canvasNoise', label: 'CANVAS NOISE', desc: 'Canvas fingerprint randomization', icon: ImageIcon, tag: antiDetection.canvasNoise?.status || 'OK' },
    { key: 'networkStealth', label: 'NETWORK STEALTH', desc: 'Request header normalization', icon: Wifi, tag: antiDetection.networkStealth?.status || 'OK' },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 bg-[hsl(var(--card))] border-border overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-6 pt-5 pb-3 border-b border-border">
          <DialogTitle className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center">
              <Monitor className="w-5 h-5 text-accent" />
            </div>
            <div>
              <span className="text-base font-black uppercase tracking-tight">Node Inspection #{slot.slotId}</span>
              <p className="text-[10px] font-mono text-accent uppercase tracking-widest mt-0.5">
                DIRECT_ENGINE_ACCESS // SLOT_{slot.slotId}
              </p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="flex min-h-[420px]">
          {/* Left Tab Rail */}
          <div className="w-14 border-r border-border flex flex-col items-center py-4 gap-1">
            {([
              { id: 'live' as const, icon: Terminal, label: 'LIVE' },
              { id: 'secure' as const, icon: Shield, label: 'SECURE' },
              { id: 'logs' as const, icon: Settings, label: 'LOGS' },
            ]).map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  'w-10 h-14 rounded-lg flex flex-col items-center justify-center gap-0.5 transition-all text-[8px] font-bold uppercase tracking-wider',
                  tab === t.id
                    ? 'bg-accent/10 text-accent border border-accent/20'
                    : 'text-muted-foreground hover:bg-muted/50'
                )}
              >
                <t.icon className="w-4 h-4" />
                <span>{t.label}</span>
              </button>
            ))}
          </div>

          {/* Main Content */}
          <div className="flex-1 p-5 overflow-hidden">
            {/* LIVE Tab */}
            {tab === 'live' && (
              <ScrollArea className="h-[360px]">
                <div className="font-mono text-xs space-y-1 bg-background/50 border border-border rounded-xl p-4">
                  {liveEntries.map((entry, i) => (
                    <div key={i} className="flex gap-2">
                      <span className={cn('font-bold text-[10px] w-10 flex-shrink-0', entry.color)}>[{entry.prefix}]</span>
                      <span className="text-muted-foreground text-[11px]">{entry.msg}</span>
                    </div>
                  ))}
                  {isActive && (
                    <div className="flex gap-2 mt-2">
                      <span className="text-accent font-bold text-[10px] w-10 flex-shrink-0 animate-pulse">{'>'}</span>
                      <span className="text-accent/60 text-[11px] animate-pulse">Processing...</span>
                    </div>
                  )}
                </div>
              </ScrollArea>
            )}

            {/* SECURE Tab */}
            {tab === 'secure' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black uppercase tracking-tight">Anti-Detection Modules</h3>
                  <Badge className="bg-green-500/10 text-green-500 border-green-500/20 text-[10px] font-bold">ALL SECURE</Badge>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {antiModules.map(mod => (
                    <div key={mod.key} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-background/50 hover:border-accent/20 transition-colors">
                      <div className="w-9 h-9 rounded-lg bg-accent/5 flex items-center justify-center flex-shrink-0">
                        <mod.icon className="w-4 h-4 text-accent/70" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-tight truncate">{mod.label}</p>
                        <p className="text-[9px] text-muted-foreground truncate">{mod.desc}</p>
                      </div>
                      <Badge variant="outline" className={cn(
                        'text-[9px] font-bold flex-shrink-0',
                        mod.tag === 'HIGH' ? 'border-amber-500/30 text-amber-500' : 'border-green-500/30 text-green-500'
                      )}>{mod.tag}</Badge>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/5 border border-amber-500/20">
                  <span className="text-[10px] font-bold text-amber-500 flex-shrink-0">NOTE:</span>
                  <span className="text-[10px] text-muted-foreground">Gaussian Jitter set to HIGH for maximum stealth. All modules auto-calibrated per session.</span>
                </div>
              </div>
            )}

            {/* LOGS Tab */}
            {tab === 'logs' && (
              <ScrollArea className="h-[360px]">
                {slot.logs.length > 0 ? (
                  <div className="space-y-1.5">
                    {slot.logs.map((l, i) => {
                      const time = new Date(l.time).toLocaleTimeString('th-TH', { hour12: false });
                      return (
                        <div key={i} className="flex gap-2 text-[11px] font-mono px-2 py-1 rounded hover:bg-muted/30">
                          <span className="text-muted-foreground/50 flex-shrink-0 w-16">{time}</span>
                          <span className={cn(
                            l.level === 'error' ? 'text-red-400' :
                            l.level === 'success' ? 'text-green-400' :
                            l.level === 'warn' ? 'text-amber-400' : 'text-muted-foreground'
                          )}>{l.msg}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground/40 py-16">
                    <Terminal className="w-10 h-10 mb-3 opacity-30" />
                    <p className="text-xs font-medium">No logs yet</p>
                    <p className="text-[10px] mt-0.5">Logs will appear when this node processes tasks</p>
                  </div>
                )}
              </ScrollArea>
            )}
          </div>

          {/* Right Info Panel */}
          <div className="w-48 border-l border-border p-4 space-y-4 hidden md:block">
            <div>
              <h4 className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider mb-3">Node Controls</h4>
              <div className={cn(
                'w-full p-3 rounded-xl border text-center text-[10px] font-bold uppercase tracking-wider',
                isActive
                  ? 'border-green-500/30 bg-green-500/5 text-green-500'
                  : 'border-border bg-muted/30 text-muted-foreground'
              )}>
                {slot.status === 'paused' ? (
                  <span className="flex items-center justify-center gap-1.5"><Pause className="w-3.5 h-3.5" /> Paused</span>
                ) : isActive ? (
                  <span className="flex items-center justify-center gap-1.5"><Zap className="w-3.5 h-3.5" /> Running</span>
                ) : (
                  <span className="flex items-center justify-center gap-1.5"><Lock className="w-3.5 h-3.5" /> Standby</span>
                )}
              </div>
              <div className={cn(
                'w-full p-2.5 rounded-xl border text-center text-[10px] font-bold uppercase mt-2',
                isActive ? 'border-accent/20 text-accent' : 'border-border text-muted-foreground/50'
              )}>
                ● {isActive ? 'ACTIVE' : 'IDLE'}
              </div>
            </div>

            {/* Slot Info */}
            <div className="space-y-2 text-[11px]">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Slot</span>
                <span className="font-bold text-accent font-mono">#{slot.slotId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Engine</span>
                <span className="font-bold font-mono">v1.0</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">SSE</span>
                <Badge className="text-[9px] bg-green-500/10 text-green-500 border-green-500/20 px-1.5">Live</Badge>
              </div>
              {slot.displayName && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">User</span>
                  <span className="font-medium truncate max-w-[80px]">{slot.displayName}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-2.5 border-t border-border flex items-center justify-between">
          <span className="text-[9px] font-mono text-muted-foreground/40 uppercase tracking-[0.2em]">
            GRAND$TATE ENGINE V1.0
          </span>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]" />
            <span className="text-[9px] font-mono text-green-500/70">Live</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Worker Slots Grid (Main Export) ────────────

export function WorkerSlotsGrid() {
  const [data, setData] = useState<WorkerSlotsData | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<WorkerSlot | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [expandedSlotId, setExpandedSlotId] = useState<string | null>(null);

  const backoffRef = useRef(false);

  const fetchSlots = useCallback(async () => {
    try {
      const res = await apiFetch('/api/worker-slots');
      if (res.status === 404) { backoffRef.current = true; return; }
      if (!res.ok) return;
      backoffRef.current = false;
      const json = await res.json();
      if (json.success) setData(json);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    fetchSlots();
    const interval = setInterval(() => {
      if (!backoffRef.current) fetchSlots();
    }, 3000);
    // Slow retry when endpoint is unavailable
    const retryInterval = setInterval(() => {
      if (backoffRef.current) fetchSlots();
    }, 30000);
    return () => { clearInterval(interval); clearInterval(retryInterval); };
  }, [fetchSlots]);

  const openInspection = (slot: WorkerSlot) => {
    setSelectedSlot(slot);
    setDialogOpen(true);
  };

  const slots = data?.slots || Array.from({ length: 15 }, (_, i) => ({
    slotId: String(i + 1).padStart(3, '0'),
    status: 'standby' as const,
    userId: null,
    displayName: null,
    fbAccount: null,
    propertyTitle: null,
    automationType: null,
    groupCount: 0,
    startedAt: null,
    runningSec: 0,
    progress: { completed: 0, failed: 0, total: 0, percent: 0 },
    logs: [],
    generatedCaptions: [],
  }));

  return (
    <>
      <Card className="card-elevated relative overflow-hidden">
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-accent/30 to-transparent" />
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Box className="w-4 h-4 text-accent" />
              <span>Worker Nodes</span>
              <Badge variant="secondary" className="text-[10px] font-mono ml-1">
                {data?.activeCount || 0}/{data?.maxSlots || 15}
              </Badge>
            </CardTitle>
            {data && data.activeCount > 0 && (
              <Badge className="bg-green-500/10 text-green-500 border-green-500/20 text-[10px]">
                {data.activeCount} ACTIVE
              </Badge>
            )}
          </div>
          <CardDescription className="text-[10px]">
            คลิกที่ slot เพื่อดู Node Inspection — logs, anti-detection, status แบบ real-time
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-5 xl:grid-cols-10 gap-2.5">
            {slots.map((slot) => {
              const isActive = slot.status === 'running' || slot.status === 'paused';
              const isExpanded = expandedSlotId === slot.slotId;
              return (
                <AnimatePresence key={slot.slotId} mode="popLayout">
                  {isExpanded ? (
                    /* ═══ EXPANDED CARD (Image 2 style) ═══ */
                    <motion.div
                      layoutId={`slot-${slot.slotId}`}
                      initial={{ opacity: 0.8 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0.8 }}
                      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                      className={cn(
                        'col-span-2 row-span-2 p-4 rounded-xl border-2 text-left relative overflow-hidden cursor-pointer group',
                        isActive
                          ? 'border-accent/40 bg-accent/[0.04] shadow-[0_0_20px_hsl(var(--accent)/0.1)]'
                          : 'border-muted-foreground/30 bg-card/80 shadow-lg'
                      )}
                      onClick={() => {
                        openInspection(slot);
                        setExpandedSlotId(null);
                      }}
                    >
                      {/* Header */}
                      <div className="flex items-center justify-between mb-3">
                        <span className={cn('text-xs font-mono font-black', isActive ? 'text-accent' : 'text-accent/70')}>
                          No. {slot.slotId}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <Settings className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-muted-foreground/70 transition-colors" />
                          <div className={cn(
                            'w-2.5 h-2.5 rounded-full',
                            isActive ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-muted-foreground/25'
                          )} />
                        </div>
                      </div>

                      {/* Title + Status */}
                      <p className="text-sm font-black uppercase tracking-tight leading-tight">
                        Worker Slot
                      </p>
                      <p className={cn(
                        'text-xs font-bold uppercase mt-0.5',
                        isActive ? 'text-green-500' : 'text-muted-foreground/40'
                      )}>
                        {slot.status === 'paused' ? 'PAUSED' : isActive ? 'RUNNING' : 'STANDBY'}
                      </p>

                      {/* User / Info */}
                      <p className="text-[10px] text-muted-foreground/50 truncate mt-2">
                        {slot.displayName || 'No user'}
                      </p>

                      {/* Progress bar — larger */}
                      <div className="mt-3 h-1.5 bg-border rounded-full overflow-hidden">
                        <div
                          className={cn('h-full rounded-full transition-all duration-500', isActive ? 'bg-accent' : 'bg-muted-foreground/10')}
                          style={{ width: `${isActive ? slot.progress.percent : 0}%` }}
                        />
                      </div>

                      {/* Hint */}
                      <p className="text-[8px] text-muted-foreground/30 text-center mt-2 uppercase tracking-widest font-mono">
                        คลิกเพื่อดู Inspection
                      </p>
                    </motion.div>
                  ) : (
                    /* ═══ COMPACT CARD (Image 1 style) ═══ */
                    <motion.button
                      layoutId={`slot-${slot.slotId}`}
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => setExpandedSlotId(isExpanded ? null : slot.slotId)}
                      className={cn(
                        'p-3 rounded-xl border-2 text-left transition-all relative overflow-hidden group',
                        isActive
                          ? 'border-accent/30 bg-accent/[0.03] shadow-[0_0_15px_hsl(var(--accent)/0.06)]'
                          : 'border-border hover:border-muted-foreground/30 bg-card/50'
                      )}
                    >
                      {/* Top: Slot number + status dot */}
                      <div className="flex items-center justify-between mb-1.5">
                        <span className={cn('text-[9px] font-mono font-bold', isActive ? 'text-accent' : 'text-muted-foreground/50')}>
                          No. {slot.slotId}
                        </span>
                        <div className="flex items-center gap-1">
                          <Settings className="w-3 h-3 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors" />
                          <div className={cn(
                            'w-2 h-2 rounded-full',
                            isActive ? 'bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]' : 'bg-muted-foreground/20'
                          )} />
                        </div>
                      </div>

                      {/* Title */}
                      <p className="text-[10px] font-bold uppercase tracking-tight leading-tight">
                        Worker Slot
                      </p>
                      <p className={cn(
                        'text-[9px] font-bold uppercase',
                        isActive ? 'text-green-500' : 'text-muted-foreground/40'
                      )}>
                        {slot.status === 'paused' ? 'PAUSED' : isActive ? 'RUNNING' : 'STANDBY'}
                      </p>

                      {/* User */}
                      <p className="text-[8px] text-muted-foreground/40 truncate mt-1">
                        {slot.displayName || 'No user'}
                      </p>

                      {/* Progress bar */}
                      <div className="mt-2 h-1 bg-border rounded-full overflow-hidden">
                        <div
                          className={cn('h-full rounded-full transition-all duration-500', isActive ? 'bg-accent' : 'bg-transparent')}
                          style={{ width: `${slot.progress.percent}%` }}
                        />
                      </div>
                    </motion.button>
                  )}
                </AnimatePresence>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <NodeInspectionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        slot={selectedSlot}
        antiDetection={data?.antiDetection || {}}
      />
    </>
  );
}
