import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap,
  Building2,
  LogOut,
  Activity,
  Radio,
  ChevronLeft,
  ChevronRight,
  Settings,
  PlusCircle,
  Users,
  Crown,
  BarChart3,
  Shield,
  User,
  Menu,
  X,
} from 'lucide-react';
import { GrandStateLogo } from '@/components/GrandStateLogo';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { useState, useRef, createContext, useContext, useEffect, useCallback } from 'react';
import { useLanguage } from '@/i18n/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { useLicenseAuth } from '@/hooks/useLicenseAuth';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useIsMobile } from '@/hooks/use-mobile';
import { apiFetch, isAdminEmail } from '@/lib/config';

// Context for mobile sidebar toggle
interface MobileSidebarContextType {
  open: boolean;
  setOpen: (open: boolean) => void;
}
const MobileSidebarContext = createContext<MobileSidebarContextType>({ open: false, setOpen: () => {} });
export const useMobileSidebar = () => useContext(MobileSidebarContext);
export function MobileSidebarProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return <MobileSidebarContext.Provider value={{ open, setOpen }}>{children}</MobileSidebarContext.Provider>;
}

const navigationItems = [
  { key: 'properties' as const, href: '/properties', icon: Building2 },
  { key: 'addProperty' as const, href: '/gallery', icon: PlusCircle },
  { key: 'groups' as const, href: '/groups', icon: Users },
  { key: 'automation' as const, href: '/automation', icon: Zap },
  { key: 'analytics' as const, href: '/analytics', icon: BarChart3 },
  { key: 'pricing' as const, href: '/pricing', icon: Crown },
  { key: 'settings' as const, href: '/settings', icon: Settings },
];

interface ActiveUsersState {
  activeUsers: number;
  onlineUsers: number;
  automationUsers: number;
}

interface PresencePayload extends Partial<ActiveUsersState> {
  success?: boolean;
}

const HEARTBEAT_INTERVAL_MS = 15000;

function useActiveUsersPresence() {
  const [activeUserStats, setActiveUserStats] = useState<ActiveUsersState>({
    activeUsers: 0,
    onlineUsers: 0,
    automationUsers: 0,
  });
  const [hasLoadedPresence, setHasLoadedPresence] = useState(false);
  const [joinFlash, setJoinFlash] = useState(0);
  const prevCountRef = useRef(0);

  const applyPresencePayload = useCallback((payload: PresencePayload) => {
    if (!payload?.success) return;
    const newActive = Number(payload.activeUsers) || 0;

    setActiveUserStats(prev => {
      const oldCount = prev.activeUsers;
      if (oldCount > 0 && newActive > oldCount) {
        setJoinFlash(f => f + 1);
      }
      prevCountRef.current = newActive;
      return {
        activeUsers: newActive,
        onlineUsers: Number(payload.onlineUsers) || 0,
        automationUsers: Number(payload.automationUsers) || 0,
      };
    });
    setHasLoadedPresence(true);
  }, []);

  const fetchPresence = useCallback(async () => {
    try {
      const response = await apiFetch('/api/session/active-users');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      applyPresencePayload(data);
    } catch {
      // Keep last known stats if polling fails temporarily
    }
  }, [applyPresencePayload]);

  const markOffline = useCallback(async () => {
    try {
      await apiFetch('/api/session/presence', {
        method: 'POST',
        keepalive: true,
        body: JSON.stringify({ online: false }),
      });
    } catch {
      // Best-effort only
    }
  }, []);

  useEffect(() => {
    let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void fetchPresence();
      }
    };

    const handlePageHide = () => {
      void markOffline();
    };

    void fetchPresence();
    heartbeatTimer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        void fetchPresence();
      }
    }, HEARTBEAT_INTERVAL_MS);

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [fetchPresence, markOffline]);

  return {
    activeUserStats,
    hasLoadedPresence,
    markOffline,
    joinFlash,
  };
}

interface SidebarContentProps {
  collapsed: boolean;
  onNavigate?: () => void;
  activeUserStats: ActiveUsersState;
  hasLoadedPresence: boolean;
  markOffline: () => Promise<void>;
  joinFlash: number;
}

function SidebarContent({
  collapsed,
  onNavigate,
  activeUserStats,
  hasLoadedPresence,
  markOffline,
  joinFlash,
}: SidebarContentProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const { user, signOut } = useLicenseAuth();
  const { displayId } = useUserProfile();

  const activeUsersLabel = language === 'th' ? 'ผู้ใช้งานในระบบ' : 'ACTIVE USERS';
  const onlineLabel = language === 'th' ? 'ออนไลน์' : 'online';
  const automationLabel = language === 'th' ? 'กำลังรันออโต้' : 'automation';

  const isAdmin = isAdminEmail(user?.email);
  const onlineCount = hasLoadedPresence ? activeUserStats.onlineUsers : 0;
  const tier: 'standard' | 'wings' | 'storm' = onlineCount >= 10 ? 'storm' : onlineCount >= 5 ? 'wings' : 'standard';
  const hasAutomation = activeUserStats.automationUsers > 0;

  return (
    <>
      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navigationItems.map((item) => {
          const isActive = location.pathname === item.href;
          const label = t.nav[item.key] || item.key;
          return (
            <Link
              key={item.key}
              to={item.href}
              onClick={onNavigate}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative overflow-hidden',
                isActive
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-glow'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              )}
            >
              {isActive && <span className="sidebar-active-bar" />}
              <item.icon className={cn('w-5 h-5 flex-shrink-0 transition-transform duration-200 group-hover:scale-110', isActive && 'animate-pulse-glow')} />
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="font-medium"
                >
                  {label}
                </motion.span>
              )}
              {collapsed && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-foreground text-background text-sm rounded-md opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">
                  {label}
                </div>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Version + User section */}
      <div className="p-3 border-t border-sidebar-border space-y-2">
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="px-2 relative"
          >
            {/* ── TIER: Wings — neon feather lines spreading outside card (5-9) ── */}
            {tier === 'wings' && (
              <div className="pointer-events-none absolute inset-0 z-0" style={{ overflow: 'visible' }}>
                {[0, 1, 2].map(i => (
                  <motion.div key={`lw-${i}`} className="absolute bg-gradient-to-l from-violet-400/50 to-transparent"
                    style={{ left: -4, top: `${32 + i * 12}%`, height: 1.5, transformOrigin: 'right center' }}
                    animate={{ width: [0, 22 + i * 7, 14 + i * 4], opacity: [0, 0.7, 0.25] }}
                    transition={{ duration: 2.2 + i * 0.3, repeat: Infinity, delay: i * 0.25 }} />
                ))}
                {[0, 1, 2].map(i => (
                  <motion.div key={`rw-${i}`} className="absolute bg-gradient-to-r from-violet-400/50 to-transparent"
                    style={{ right: -4, top: `${32 + i * 12}%`, height: 1.5, transformOrigin: 'left center' }}
                    animate={{ width: [0, 22 + i * 7, 14 + i * 4], opacity: [0, 0.7, 0.25] }}
                    transition={{ duration: 2.2 + i * 0.3, repeat: Infinity, delay: i * 0.25 + 0.1 }} />
                ))}
              </div>
            )}

            <div className={cn(
              "relative overflow-hidden rounded-xl px-3 py-2.5 border transition-all duration-500",
              tier === 'storm'
                ? 'border-cyan-400/50 shadow-[0_0_30px_rgba(34,211,238,0.25),inset_0_0_20px_rgba(34,211,238,0.05)]'
                : tier === 'wings'
                ? 'border-violet-400/50 shadow-[0_0_25px_rgba(167,139,250,0.25),inset_0_0_15px_rgba(167,139,250,0.05)]'
                : 'border-pink-500/30 shadow-[0_0_20px_rgba(236,72,153,0.15)]'
            )}>
              {/* ── Animated gradient background ── */}
              <motion.div aria-hidden
                className={cn("pointer-events-none absolute inset-0",
                  tier === 'storm' ? 'bg-gradient-to-br from-cyan-950/90 via-slate-900/90 to-blue-950/90'
                    : tier === 'wings' ? 'bg-gradient-to-br from-violet-950/90 via-purple-900/70 to-fuchsia-950/90'
                    : 'bg-gradient-to-br from-pink-950/70 via-purple-950/70 to-violet-950/70'
                )}
                animate={{ backgroundPosition: ['0% 0%', '100% 100%', '0% 0%'] }}
                transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
                style={{ backgroundSize: '200% 200%' }}
              />

              {/* ── Shimmer sweep — tier colored ── */}
              <motion.div aria-hidden
                className={cn("pointer-events-none absolute inset-0",
                  tier === 'storm' ? 'bg-gradient-to-r from-transparent via-cyan-400/15 to-transparent'
                    : tier === 'wings' ? 'bg-gradient-to-r from-transparent via-violet-400/15 to-transparent'
                    : 'bg-gradient-to-r from-transparent via-pink-400/15 to-transparent'
                )}
                animate={{ x: ['-120%', '120%'] }}
                transition={{ duration: tier === 'storm' ? 1.5 : 2.6, repeat: Infinity, ease: 'linear' }}
              />

              {/* ── TIER: Standard — heartbeat border pulse (1-4) ── */}
              {tier === 'standard' && (
                <motion.div className="pointer-events-none absolute inset-0 rounded-xl border border-pink-400/40"
                  animate={{ opacity: [0.2, 0.8, 0.2], boxShadow: ['0 0 5px rgba(236,72,153,0.1)', '0 0 15px rgba(236,72,153,0.3)', '0 0 5px rgba(236,72,153,0.1)'] }}
                  transition={{ duration: hasAutomation ? 0.8 : 1.5, repeat: Infinity, ease: 'easeInOut' }}
                />
              )}

              {/* ── TIER: Storm — lightning sparks around border (10+) ── */}
              {tier === 'storm' && (
                <>
                  <motion.div className="pointer-events-none absolute top-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-300 to-transparent z-10"
                    animate={{ left: ['-20%', '120%'], opacity: [0, 1, 1, 0] }}
                    transition={{ duration: 1.2, repeat: Infinity, repeatDelay: 0.4 }}
                    style={{ width: '30%' }} />
                  <motion.div className="pointer-events-none absolute bottom-0 h-[2px] bg-gradient-to-r from-transparent via-blue-300 to-transparent z-10"
                    animate={{ right: ['-20%', '120%'], opacity: [0, 1, 1, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity, delay: 0.6, repeatDelay: 0.3 }}
                    style={{ width: '25%' }} />
                  <motion.div className="pointer-events-none absolute left-0 w-[2px] bg-gradient-to-b from-transparent via-cyan-300 to-transparent z-10"
                    animate={{ top: ['-20%', '120%'], opacity: [0, 1, 1, 0] }}
                    transition={{ duration: 1, repeat: Infinity, delay: 0.3, repeatDelay: 0.6 }}
                    style={{ height: '40%' }} />
                  <motion.div className="pointer-events-none absolute right-0 w-[2px] bg-gradient-to-b from-transparent via-blue-400 to-transparent z-10"
                    animate={{ bottom: ['-20%', '120%'], opacity: [0, 1, 1, 0] }}
                    transition={{ duration: 1.3, repeat: Infinity, delay: 0.9, repeatDelay: 0.5 }}
                    style={{ height: '35%' }} />
                  {[0, 1, 2, 3].map(i => (
                    <motion.div key={`sp-${i}`} className="pointer-events-none absolute w-1 h-1 rounded-full bg-cyan-300 z-10"
                      style={{ left: `${20 + i * 20}%`, top: `${30 + (i % 2) * 40}%`, filter: 'blur(0.5px)' }}
                      animate={{ x: [(i-1.5)*10, (i-1.5)*-10], y: [0, -8, 0], opacity: [0, 1, 0], scale: [0.3, 1.5, 0.3] }}
                      transition={{ duration: 1.5 + i * 0.3, repeat: Infinity, delay: i * 0.4 }} />
                  ))}
                </>
              )}

              {/* ── JOIN FLASH: burst rings — tier colored ── */}
              <AnimatePresence>
                {joinFlash > 0 && (
                  <motion.div key={`burst-${joinFlash}`} className="pointer-events-none absolute inset-0 z-20"
                    initial={{ opacity: 1 }} animate={{ opacity: 0 }} exit={{ opacity: 0 }} transition={{ duration: 2.5 }}>
                    <motion.div className={cn("absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2",
                        tier === 'storm' ? 'border-cyan-400/60' : tier === 'wings' ? 'border-violet-400/60' : 'border-pink-400/60')}
                      initial={{ width: 0, height: 0, opacity: 1 }} animate={{ width: 200, height: 200, opacity: 0 }}
                      transition={{ duration: 1.2, ease: 'easeOut' }} />
                    <motion.div className={cn("absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border",
                        tier === 'storm' ? 'border-blue-300/50' : tier === 'wings' ? 'border-fuchsia-400/50' : 'border-purple-400/50')}
                      initial={{ width: 0, height: 0, opacity: 1 }} animate={{ width: 160, height: 160, opacity: 0 }}
                      transition={{ duration: 1.4, ease: 'easeOut', delay: 0.15 }} />
                    <motion.div className={cn("absolute inset-0 rounded-xl",
                        tier === 'storm' ? 'bg-cyan-400/20' : tier === 'wings' ? 'bg-violet-400/20' : 'bg-pink-400/20')}
                      initial={{ opacity: 1 }} animate={{ opacity: 0 }} transition={{ duration: 0.6 }} />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── JOIN FLASH: notification banner — tier colored ── */}
              <AnimatePresence>
                {joinFlash > 0 && (
                  <motion.div key={`banner-${joinFlash}`}
                    className={cn("absolute inset-x-0 top-0 z-30 flex items-center justify-center py-1",
                      tier === 'storm' ? 'bg-gradient-to-r from-cyan-500/90 via-blue-500/90 to-cyan-500/90'
                        : tier === 'wings' ? 'bg-gradient-to-r from-violet-500/90 via-fuchsia-500/90 to-violet-500/90'
                        : 'bg-gradient-to-r from-pink-500/90 via-fuchsia-500/90 to-pink-500/90'
                    )}
                    initial={{ y: -30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -30, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 25 }}>
                    <motion.p className="text-[10px] font-bold text-white flex items-center gap-1"
                      initial={{ scale: 0.8 }} animate={{ scale: [0.8, 1.1, 1] }} transition={{ duration: 0.4 }}>
                      <Zap className="w-3 h-3" />
                      {language === 'th' ? 'มีผู้ใช้เข้ามาใหม่!' : 'New user joined!'}
                    </motion.p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── ADMIN: Crown Entry — golden crown drops + burst ── */}
              {isAdmin && hasLoadedPresence && (
                <div className="pointer-events-none absolute -top-2 left-1/2 -translate-x-1/2 z-40">
                  <motion.div initial={{ y: -24, opacity: 0, scale: 0, rotate: -30 }}
                    animate={{ y: 0, opacity: 1, scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 12, delay: 0.6 }}>
                    <Crown className="w-5 h-5 text-amber-400" style={{ filter: 'drop-shadow(0 0 8px rgba(251,191,36,0.9)) drop-shadow(0 0 20px rgba(251,191,36,0.4))' }} />
                  </motion.div>
                  <motion.div className="absolute inset-0 -inset-x-4 -inset-y-4"
                    initial={{ scale: 0, opacity: 1 }} animate={{ scale: 5, opacity: 0 }}
                    transition={{ duration: 1.8, delay: 0.6 }}>
                    <div className="w-full h-full rounded-full bg-amber-400/30 blur-md" />
                  </motion.div>
                </div>
              )}

              {/* ── Main content ── */}
              <div className="relative flex items-center justify-between gap-3 z-10">
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="text-[9px] uppercase tracking-[0.2em] text-white/50 font-semibold">
                      {activeUsersLabel}
                    </p>
                    {isAdmin && (
                      <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: 0.8 }}
                        className="inline-flex items-center gap-0.5 px-1.5 py-px rounded-full bg-amber-500/20 border border-amber-500/30">
                        <Crown className="w-2.5 h-2.5 text-amber-400" />
                        <span className="text-[7px] font-bold text-amber-300 tracking-wider">ADMIN</span>
                      </motion.span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 mt-0.5">
                    <motion.p key={hasLoadedPresence ? activeUserStats.activeUsers : -1}
                      initial={{ opacity: 0, y: 12, scale: 0.5 }}
                      animate={isAdmin && joinFlash === 0
                        ? { opacity: 1, y: 0, scale: [1, 1.02, 1], textShadow: ['0 0 10px rgba(251,191,36,0.6)', '0 0 20px rgba(251,191,36,0.8)', '0 0 10px rgba(251,191,36,0.6)'] }
                        : { opacity: 1, y: 0, scale: 1 }
                      }
                      transition={isAdmin ? { duration: 2, repeat: Infinity, ease: 'easeInOut' } : { type: 'spring', stiffness: 400, damping: 15 }}
                      className="text-xl font-black leading-none text-white"
                      style={{
                        textShadow: tier === 'storm' ? '0 0 12px rgba(34,211,238,0.8), 0 0 30px rgba(34,211,238,0.4)'
                          : tier === 'wings' ? '0 0 10px rgba(167,139,250,0.7), 0 0 25px rgba(167,139,250,0.35)'
                          : '0 0 10px rgba(236,72,153,0.6), 0 0 20px rgba(236,72,153,0.3)',
                      }}>
                      {hasLoadedPresence ? activeUserStats.activeUsers.toLocaleString() : '...'}
                    </motion.p>

                    <motion.span key={`radio-${joinFlash}`}
                      animate={joinFlash > 0
                        ? { scale: [1, 1.8, 1, 1.4, 1], opacity: [0.5, 1, 0.6, 1, 0.5] }
                        : { scale: [1, 1.3, 1], opacity: [0.4, 1, 0.4] }
                      }
                      transition={joinFlash > 0
                        ? { duration: 0.8, ease: 'easeInOut' }
                        : { duration: hasAutomation ? 0.7 : 1.6, repeat: Infinity, ease: 'easeInOut' }
                      }
                      className={cn(
                        tier === 'storm' ? 'text-cyan-400' : tier === 'wings' ? 'text-violet-400' : 'text-pink-400'
                      )}
                      style={{
                        filter: `drop-shadow(0 0 4px ${tier === 'storm' ? 'rgba(34,211,238,0.6)' : tier === 'wings' ? 'rgba(167,139,250,0.6)' : 'rgba(236,72,153,0.6)'})`,
                      }}>
                      <Radio className="w-4 h-4" />
                    </motion.span>
                  </div>

                  <p className="text-[10px] text-white/55 mt-0.5" style={{
                    textShadow: tier === 'storm' ? '0 0 6px rgba(34,211,238,0.3)' : tier === 'wings' ? '0 0 6px rgba(167,139,250,0.3)' : '0 0 6px rgba(236,72,153,0.2)',
                  }}>
                    {hasLoadedPresence
                      ? `${activeUserStats.onlineUsers} ${onlineLabel} • ${activeUserStats.automationUsers} ${automationLabel}`
                      : language === 'th' ? 'กำลังซิงค์สถานะ...' : 'syncing status...'}
                  </p>
                </div>

                {/* Activity icon with tier glow */}
                <div className="relative">
                  <AnimatePresence>
                    {joinFlash > 0 && (
                      <motion.span key={`glow-${joinFlash}`}
                        className={cn("absolute inset-0 rounded-full blur-lg",
                          tier === 'storm' ? 'bg-cyan-400/50' : tier === 'wings' ? 'bg-violet-400/50' : 'bg-pink-400/50')}
                        initial={{ scale: 0.5, opacity: 1 }} animate={{ scale: 3.5, opacity: 0 }}
                        exit={{ opacity: 0 }} transition={{ duration: 1.5 }} />
                    )}
                  </AnimatePresence>
                  <motion.div animate={{ rotate: [0, 5, 0, -5, 0] }}
                    transition={{ duration: hasAutomation ? 2 : 5, repeat: Infinity, ease: 'easeInOut' }}
                    className="relative">
                    <span className={cn("absolute inset-0 rounded-full blur-md",
                      tier === 'storm' ? 'bg-cyan-400/25' : tier === 'wings' ? 'bg-violet-400/25' : 'bg-pink-400/25')} />
                    <Activity className={cn("relative w-5 h-5",
                      tier === 'storm' ? 'text-cyan-400' : tier === 'wings' ? 'text-violet-400' : 'text-pink-400')}
                      style={{ filter: `drop-shadow(0 0 6px ${tier === 'storm' ? 'rgba(34,211,238,0.5)' : tier === 'wings' ? 'rgba(167,139,250,0.5)' : 'rgba(236,72,153,0.5)'})` }} />
                  </motion.div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {!collapsed && (
          <div className="px-2 py-2 text-center">
            <GrandStateLogo className="w-7 h-7 mx-auto mb-0.5" />
            <p className="text-sm font-bold bg-gradient-to-r from-purple-400 via-violet-300 to-purple-400 bg-clip-text text-transparent tracking-wide">
              GrandState
            </p>
            <p className="text-[9px] text-sidebar-foreground/30 tracking-widest">VERSION 2.0</p>
          </div>
        )}
        {collapsed && (
          <div className="text-center py-1 space-y-1">
            <div className="inline-flex items-center justify-center gap-1 px-1.5 py-0.5 rounded-full bg-sidebar-accent/80 border border-sidebar-border">
              <Radio className="w-2.5 h-2.5 text-sidebar-primary" />
              <span className="text-[9px] font-semibold text-sidebar-foreground/80">{hasLoadedPresence ? activeUserStats.activeUsers : '•'}</span>
            </div>
            <GrandStateLogo className="w-6 h-6 mx-auto" />
          </div>
        )}
        {!collapsed && user?.email && (
          <div className="px-2 py-1 text-center">
            <p className="text-[10px] text-sidebar-foreground/50 truncate">{user.email}</p>
            {displayId && (
              <p className="text-[9px] font-mono font-bold text-accent/80 mt-0.5">{displayId}</p>
            )}
          </div>
        )}
        <Button
          variant="ghost"
          className={cn(
            'w-full justify-start gap-3 text-sidebar-foreground hover:bg-sidebar-accent hover:text-destructive',
            collapsed && 'justify-center'
          )}
          onClick={async () => {
            await markOffline();
            await signOut();
            localStorage.removeItem('fb_connected');
            localStorage.removeItem('fb_user_name');
            localStorage.removeItem('fb_user_profilePic');
            navigate('/auth?logout=true');
          }}
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {!collapsed && <span>{t.common.logout}</span>}
        </Button>
      </div>
    </>
  );
}

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const isMobile = useIsMobile();
  const { open, setOpen } = useMobileSidebar();
  const { activeUserStats, hasLoadedPresence, markOffline, joinFlash } = useActiveUsersPresence();

  // Mobile: Sheet drawer
  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-[280px] p-0 bg-sidebar text-sidebar-foreground border-sidebar-border [&>button]:hidden">
          <div className="flex flex-col h-full">
            {/* Logo */}
            <div className="flex items-center justify-between h-16 px-4 border-b border-sidebar-border">
              <Link to="/automation" className="flex items-center gap-3" onClick={() => setOpen(false)}>
                <GrandStateLogo heroMode className="w-10 h-10 drop-shadow-lg" />
                <span className="font-bold text-lg text-sidebar-foreground">GrandState</span>
              </Link>
              <Button variant="ghost" size="icon-sm" onClick={() => setOpen(false)} className="text-sidebar-foreground">
                <X className="w-5 h-5" />
              </Button>
            </div>
            <SidebarContent
              collapsed={false}
              onNavigate={() => setOpen(false)}
              activeUserStats={activeUserStats}
              hasLoadedPresence={hasLoadedPresence}
              markOffline={markOffline}
              joinFlash={joinFlash}
            />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  // Desktop: Fixed sidebar
  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 80 : 280 }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      className="fixed left-0 top-0 z-40 h-screen bg-sidebar border-r border-sidebar-border flex-col hidden md:flex"
    >
      {/* Logo */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-sidebar-border">
        <Link to="/automation" className="flex items-center gap-3">
          <GrandStateLogo className="w-10 h-10 drop-shadow-lg" />
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="font-bold text-lg text-sidebar-foreground"
            >
              GrandState
            </motion.span>
          )}
        </Link>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setCollapsed(!collapsed)}
          className="text-sidebar-foreground hover:bg-sidebar-accent"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </Button>
      </div>
      <SidebarContent
        collapsed={collapsed}
        activeUserStats={activeUserStats}
        hasLoadedPresence={hasLoadedPresence}
        markOffline={markOffline}
        joinFlash={joinFlash}
      />
    </motion.aside>
  );
}
