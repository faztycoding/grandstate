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
import { apiFetch } from '@/lib/config';

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
            className="px-2"
          >
            <div className="relative overflow-hidden rounded-xl border border-sidebar-border/80 bg-sidebar-accent/60 px-3 py-2.5 shadow-[0_0_20px_hsl(var(--sidebar-ring)/0.15)]">
              {/* Shimmer sweep */}
              <motion.div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-sidebar-primary/20 to-transparent"
                animate={{ x: ['-120%', '120%'] }}
                transition={{ duration: 2.6, repeat: Infinity, ease: 'linear' }}
              />

              {/* ── JOIN FLASH: burst rings ── */}
              <AnimatePresence>
                {joinFlash > 0 && (
                  <motion.div
                    key={`burst-${joinFlash}`}
                    className="pointer-events-none absolute inset-0 z-20"
                    initial={{ opacity: 1 }}
                    animate={{ opacity: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 2.5 }}
                  >
                    {/* Ring 1 — fast expand */}
                    <motion.div
                      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-amber-400/60"
                      initial={{ width: 0, height: 0, opacity: 1 }}
                      animate={{ width: 200, height: 200, opacity: 0 }}
                      transition={{ duration: 1.2, ease: 'easeOut' }}
                    />
                    {/* Ring 2 — delayed */}
                    <motion.div
                      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-emerald-400/50"
                      initial={{ width: 0, height: 0, opacity: 1 }}
                      animate={{ width: 160, height: 160, opacity: 0 }}
                      transition={{ duration: 1.4, ease: 'easeOut', delay: 0.15 }}
                    />
                    {/* Flash overlay */}
                    <motion.div
                      className="absolute inset-0 bg-amber-400/20 rounded-xl"
                      initial={{ opacity: 1 }}
                      animate={{ opacity: 0 }}
                      transition={{ duration: 0.6 }}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── JOIN FLASH: notification banner ── */}
              <AnimatePresence>
                {joinFlash > 0 && (
                  <motion.div
                    key={`banner-${joinFlash}`}
                    className="absolute inset-x-0 top-0 z-30 flex items-center justify-center py-1 bg-gradient-to-r from-amber-500/90 via-orange-500/90 to-amber-500/90"
                    initial={{ y: -30, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -30, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                  >
                    <motion.p
                      className="text-[10px] font-bold text-white flex items-center gap-1"
                      initial={{ scale: 0.8 }}
                      animate={{ scale: [0.8, 1.1, 1] }}
                      transition={{ duration: 0.4 }}
                    >
                      <Zap className="w-3 h-3" />
                      {language === 'th' ? 'มีผู้ใช้เข้ามาใหม่!' : 'New user joined!'}
                    </motion.p>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="relative flex items-center justify-between gap-3">
                <div>
                  <p className="text-[9px] uppercase tracking-[0.2em] text-sidebar-foreground/50 font-semibold">
                    {activeUsersLabel}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {/* Animated number counter */}
                    <motion.p
                      key={hasLoadedPresence ? activeUserStats.activeUsers : -1}
                      initial={{ opacity: 0, y: 12, scale: 0.5 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                      className="text-xl font-black leading-none bg-gradient-to-r from-sidebar-primary via-sidebar-foreground to-sidebar-primary bg-clip-text text-transparent"
                    >
                      {hasLoadedPresence ? activeUserStats.activeUsers.toLocaleString() : '...'}
                    </motion.p>
                    {/* Pulsing radio with glow on join */}
                    <motion.span
                      key={`radio-${joinFlash}`}
                      animate={joinFlash > 0
                        ? { scale: [1, 1.6, 1, 1.3, 1], opacity: [0.55, 1, 0.7, 1, 0.55] }
                        : { scale: [1, 1.15, 1], opacity: [0.55, 1, 0.55] }
                      }
                      transition={joinFlash > 0
                        ? { duration: 1, ease: 'easeInOut' }
                        : { duration: 1.8, repeat: Infinity, ease: 'easeInOut' }
                      }
                      className="text-sidebar-primary"
                    >
                      <Radio className="w-4 h-4" />
                    </motion.span>
                  </div>
                  <p className="text-[10px] text-sidebar-foreground/55 mt-0.5">
                    {hasLoadedPresence
                      ? `${activeUserStats.onlineUsers} ${onlineLabel} • ${activeUserStats.automationUsers} ${automationLabel}`
                      : language === 'th' ? 'กำลังซิงค์สถานะ...' : 'syncing status...'}
                  </p>
                </div>

                {/* Activity icon with join glow burst */}
                <div className="relative">
                  <AnimatePresence>
                    {joinFlash > 0 && (
                      <motion.span
                        key={`glow-${joinFlash}`}
                        className="absolute inset-0 rounded-full bg-amber-400/40 blur-lg"
                        initial={{ scale: 0.5, opacity: 1 }}
                        animate={{ scale: 3, opacity: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 1.5 }}
                      />
                    )}
                  </AnimatePresence>
                  <motion.div
                    animate={{ rotate: [0, 4, 0, -4, 0] }}
                    transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
                    className="relative"
                  >
                    <span className="absolute inset-0 rounded-full bg-sidebar-primary/20 blur-md" />
                    <Activity className="relative w-5 h-5 text-sidebar-primary" />
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
