import { useState, useRef, useEffect } from 'react';
import { Bell, CheckCheck, Trash2, X, Shield, ShieldAlert, Zap, RefreshCw, MessageCircle, Info, AlertTriangle, AlertOctagon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNotifications, type AppNotification, type NotificationCategory } from '@/hooks/useNotifications';
import { cn } from '@/lib/utils';

const categoryMeta: Record<NotificationCategory, { label: string; icon: typeof Shield; color: string; dot: string }> = {
  admin: { label: 'ข้อความจากผู้ดูแลระบบ', icon: Shield, color: 'text-amber-500', dot: 'bg-amber-500' },
  automation: { label: 'ระบบอัตโนมัติ', icon: Zap, color: 'text-blue-500', dot: 'bg-blue-500' },
  update: { label: 'อัพเดทระบบ', icon: RefreshCw, color: 'text-purple-500', dot: 'bg-purple-500' },
  system: { label: 'ระบบ', icon: Info, color: 'text-cyan-500', dot: 'bg-cyan-500' },
  general: { label: 'ทั่วไป', icon: MessageCircle, color: 'text-muted-foreground', dot: 'bg-muted-foreground' },
  warning: { label: 'แจ้งเตือน', icon: AlertTriangle, color: 'text-yellow-500', dot: 'bg-yellow-500' },
  risk: { label: 'เสี่ยง', icon: ShieldAlert, color: 'text-orange-500', dot: 'bg-orange-500' },
  danger: { label: 'อันตราย', icon: AlertOctagon, color: 'text-red-500', dot: 'bg-red-500' },
};

const typeStyles: Record<AppNotification['type'], { dot: string }> = {
  success: { dot: 'bg-emerald-500' },
  error: { dot: 'bg-red-500' },
  warning: { dot: 'bg-amber-500' },
  info: { dot: 'bg-blue-500' },
};

function formatTimestamp(ts: number): { relative: string; full: string } {
  const diff = Math.floor((Date.now() - ts) / 1000);
  let relative: string;
  if (diff < 60) relative = 'เมื่อสักครู่';
  else if (diff < 3600) relative = `${Math.floor(diff / 60)} นาทีที่แล้ว`;
  else if (diff < 86400) relative = `${Math.floor(diff / 3600)} ชม. ที่แล้ว`;
  else relative = `${Math.floor(diff / 86400)} วันที่แล้ว`;

  const d = new Date(ts);
  const full = d.toLocaleString('th-TH', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
  return { relative, full };
}

export function NotificationBell() {
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearAll } = useNotifications();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<NotificationCategory | 'all'>('all');
  const [selectedNotif, setSelectedNotif] = useState<AppNotification | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const filtered = filter === 'all'
    ? notifications
    : notifications.filter(n => n.category === filter);

  // Group by category for section headers
  const categoryCounts = notifications.reduce((acc, n) => {
    const cat = n.category || 'general';
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <>
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg hover:bg-muted/60 transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5 text-muted-foreground" />
        {unreadCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </motion.span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute right-0 top-12 w-[360px] max-h-[500px] rounded-xl border border-border bg-card shadow-2xl overflow-hidden z-50"
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-border bg-gradient-to-r from-card to-muted/20">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-foreground">การแจ้งเตือน</h3>
                  {unreadCount > 0 && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-500 border border-red-500/20">
                      {unreadCount} ใหม่
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-0.5">
                  {unreadCount > 0 && (
                    <button onClick={markAllAsRead} className="p-1.5 rounded-md hover:bg-muted transition-colors" title="อ่านทั้งหมด">
                      <CheckCheck className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  )}
                  {notifications.length > 0 && (
                    <button onClick={clearAll} className="p-1.5 rounded-md hover:bg-muted transition-colors" title="ลบทั้งหมด">
                      <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  )}
                  <button onClick={() => setOpen(false)} className="p-1.5 rounded-md hover:bg-muted transition-colors">
                    <X className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                </div>
              </div>

              {/* Category Filter Pills */}
              {notifications.length > 0 && (
                <div className="flex gap-1 overflow-x-auto pb-0.5 -mx-1 px-1">
                  <button
                    onClick={() => setFilter('all')}
                    className={cn(
                      'text-[9px] font-bold px-2 py-1 rounded-md whitespace-nowrap transition-all',
                      filter === 'all' ? 'bg-accent text-accent-foreground shadow-sm' : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                    )}
                  >
                    ทั้งหมด {notifications.length}
                  </button>
                  {Object.entries(categoryCounts).map(([cat, count]) => {
                    const meta = categoryMeta[cat as NotificationCategory] || categoryMeta.general;
                    const CatIcon = meta.icon;
                    return (
                      <button
                        key={cat}
                        onClick={() => setFilter(cat as NotificationCategory)}
                        className={cn(
                          'text-[9px] font-bold px-2 py-1 rounded-md whitespace-nowrap transition-all flex items-center gap-1',
                          filter === cat ? 'bg-accent text-accent-foreground shadow-sm' : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                        )}
                      >
                        <CatIcon className="w-2.5 h-2.5" />
                        {meta.label} {count}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* List */}
            <div className="overflow-y-auto max-h-[380px]">
              {filtered.length === 0 ? (
                <div className="py-12 text-center">
                  <Bell className="w-10 h-10 mx-auto text-muted-foreground/20 mb-3" />
                  <p className="text-xs font-medium text-muted-foreground">ยังไม่มีการแจ้งเตือน</p>
                  <p className="text-[10px] text-muted-foreground/50 mt-0.5">
                    {filter !== 'all' ? 'ลองเปลี่ยนหมวดหมู่ดู' : 'การแจ้งเตือนจะปรากฏที่นี่'}
                  </p>
                </div>
              ) : (
                filtered.map((n) => {
                  const style = typeStyles[n.type];
                  const cat = categoryMeta[n.category] || categoryMeta.general;
                  const CatIcon = cat.icon;
                  const { relative, full } = formatTimestamp(n.timestamp);
                  return (
                    <button
                      key={n.id}
                      onClick={() => { markAsRead(n.id); setSelectedNotif(n); }}
                      className={cn(
                        'w-full text-left px-4 py-3 border-b border-border/40 hover:bg-muted/40 transition-colors',
                        !n.read && 'bg-accent/[0.04]'
                      )}
                    >
                      <div className="flex items-start gap-3">
                        {/* Category Icon */}
                        <div className={cn(
                          'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5',
                          n.read ? 'bg-muted/50' : 'bg-accent/10'
                        )}>
                          <CatIcon className={cn('w-4 h-4', n.read ? 'text-muted-foreground/40' : cat.color)} />
                        </div>

                        <div className="flex-1 min-w-0">
                          {/* Category label */}
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className={cn('text-[9px] font-bold uppercase tracking-wider', n.read ? 'text-muted-foreground/40' : cat.color)}>
                              {cat.label}
                            </span>
                            {!n.read && (
                              <div className={cn('w-1.5 h-1.5 rounded-full', style.dot)} />
                            )}
                          </div>

                          {/* Title */}
                          <p className={cn('text-xs font-semibold text-foreground truncate leading-tight', n.read && 'opacity-50')}>
                            {n.title}
                          </p>

                          {/* Message */}
                          <p className={cn('text-[11px] text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed', n.read && 'opacity-40')}>
                            {n.message}
                          </p>

                          {/* Time */}
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-[10px] text-muted-foreground/50">{relative}</span>
                            <span className="text-[10px] text-muted-foreground/30">•</span>
                            <span className="text-[10px] text-muted-foreground/40 font-mono">{full}</span>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>

    {/* ═══ Notification Detail Modal ═══ */}
    <AnimatePresence>
      {selectedNotif && (() => {
        const cat = categoryMeta[selectedNotif.category] || categoryMeta.general;
        const CatIcon = cat.icon;
        const { relative, full } = formatTimestamp(selectedNotif.timestamp);
        const typeBorder = selectedNotif.type === 'error' ? 'border-red-500/30' : selectedNotif.type === 'warning' ? 'border-amber-500/30' : 'border-[hsl(var(--accent)/0.25)]';
        const typeGlow = selectedNotif.type === 'error' ? 'shadow-red-500/10' : selectedNotif.type === 'warning' ? 'shadow-amber-500/10' : 'shadow-[hsl(var(--accent)/0.08)]';
        return (
          <motion.div
            key="notif-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setSelectedNotif(null)}
          >
            <motion.div
              key="notif-modal"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className={cn(
                'w-full max-w-md rounded-2xl border bg-card shadow-2xl overflow-hidden',
                typeBorder, typeGlow
              )}
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="px-5 pt-5 pb-3 border-b border-border/50 bg-gradient-to-r from-card to-muted/20">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', 'bg-accent/10')}>
                      <CatIcon className={cn('w-5 h-5', cat.color)} />
                    </div>
                    <div>
                      <span className={cn('text-[10px] font-bold uppercase tracking-wider', cat.color)}>{cat.label}</span>
                      <h3 className="text-sm font-bold text-foreground mt-0.5 leading-tight">{selectedNotif.title}</h3>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedNotif(null)}
                    className="p-1.5 rounded-lg hover:bg-muted transition-colors -mt-1 -mr-1"
                  >
                    <X className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="px-5 py-4">
                <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
                  {selectedNotif.message}
                </p>
              </div>

              {/* Footer */}
              <div className="px-5 py-3 border-t border-border/50 bg-muted/20 flex items-center justify-between">
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span>{relative}</span>
                  <span className="text-muted-foreground/30">|</span>
                  <span className="font-mono text-muted-foreground/60">{full}</span>
                </div>
                <button
                  onClick={() => setSelectedNotif(null)}
                  className="text-xs font-semibold px-4 py-1.5 rounded-lg bg-accent/10 text-accent hover:bg-accent/20 transition-colors border border-accent/20"
                >
                  ปิด
                </button>
              </div>
            </motion.div>
          </motion.div>
        );
      })()}
    </AnimatePresence>
    </>
  );
}
