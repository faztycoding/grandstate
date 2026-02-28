import { useState, useRef, useEffect } from 'react';
import { Bell, Check, CheckCheck, Trash2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNotifications, type AppNotification } from '@/hooks/useNotifications';
import { cn } from '@/lib/utils';

const typeStyles: Record<AppNotification['type'], { dot: string; bg: string }> = {
  success: { dot: 'bg-emerald-500', bg: 'bg-emerald-500/10' },
  error: { dot: 'bg-red-500', bg: 'bg-red-500/10' },
  warning: { dot: 'bg-amber-500', bg: 'bg-amber-500/10' },
  info: { dot: 'bg-blue-500', bg: 'bg-blue-500/10' },
};

function timeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return 'เมื่อสักครู่';
  if (diff < 3600) return `${Math.floor(diff / 60)} นาทีที่แล้ว`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ชม. ที่แล้ว`;
  return `${Math.floor(diff / 86400)} วันที่แล้ว`;
}

export function NotificationBell() {
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearAll } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
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
            className="absolute right-0 top-12 w-80 max-h-[420px] rounded-xl border border-border bg-card shadow-xl overflow-hidden z-50"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h3 className="text-sm font-bold text-foreground">การแจ้งเตือน</h3>
              <div className="flex items-center gap-1">
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

            {/* List */}
            <div className="overflow-y-auto max-h-[350px]">
              {notifications.length === 0 ? (
                <div className="py-10 text-center">
                  <Bell className="w-8 h-8 mx-auto text-muted-foreground/30 mb-2" />
                  <p className="text-xs text-muted-foreground">ยังไม่มีการแจ้งเตือน</p>
                </div>
              ) : (
                notifications.map((n) => {
                  const style = typeStyles[n.type];
                  return (
                    <button
                      key={n.id}
                      onClick={() => markAsRead(n.id)}
                      className={cn(
                        'w-full text-left px-4 py-3 border-b border-border/50 hover:bg-muted/40 transition-colors',
                        !n.read && 'bg-accent/[0.03]'
                      )}
                    >
                      <div className="flex items-start gap-2.5">
                        <div className={cn('w-2 h-2 rounded-full mt-1.5 flex-shrink-0', style.dot, n.read && 'opacity-30')} />
                        <div className="flex-1 min-w-0">
                          <p className={cn('text-xs font-semibold text-foreground truncate', n.read && 'opacity-60')}>
                            {n.title}
                          </p>
                          <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                          <p className="text-[10px] text-muted-foreground/50 mt-1">{timeAgo(n.timestamp)}</p>
                        </div>
                        {!n.read && (
                          <div className="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0 mt-2" />
                        )}
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
  );
}
