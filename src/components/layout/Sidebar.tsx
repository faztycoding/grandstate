import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
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
import { useState, createContext, useContext, useEffect, useCallback } from 'react';
import { useLanguage } from '@/i18n/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { useLicenseAuth } from '@/hooks/useLicenseAuth';
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

  const applyPresencePayload = useCallback((payload: PresencePayload) => {
    if (!payload?.success) return;

    setActiveUserStats({
      activeUsers: Number(payload.activeUsers) || 0,
      onlineUsers: Number(payload.onlineUsers) || 0,
      automationUsers: Number(payload.automationUsers) || 0,
    });
    setHasLoadedPresence(true);
  }, []);

  const fetchPresence = useCallback(async () => {
    try {
      const response = await apiFetch('/api/session/active-users');
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
  };
}

interface SidebarContentProps {
  collapsed: boolean;
  onNavigate?: () => void;
  activeUserStats: ActiveUsersState;
  hasLoadedPresence: boolean;
  markOffline: () => Promise<void>;
}

function SidebarContent({
  collapsed,
  onNavigate,
  activeUserStats,
  hasLoadedPresence,
  markOffline,
}: SidebarContentProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const { user, signOut } = useLicenseAuth();

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
              <motion.div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-sidebar-primary/20 to-transparent"
                animate={{ x: ['-120%', '120%'] }}
                transition={{ duration: 2.6, repeat: Infinity, ease: 'linear' }}
              />

              <div className="relative flex items-center justify-between gap-3">
                <div>
                  <p className="text-[9px] uppercase tracking-[0.2em] text-sidebar-foreground/50 font-semibold">
                    {activeUsersLabel}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <motion.p
                      key={hasLoadedPresence ? activeUserStats.activeUsers : -1}
                      initial={{ opacity: 0, y: 6, scale: 0.9 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ duration: 0.24, ease: 'easeOut' }}
                      className="text-xl font-black leading-none bg-gradient-to-r from-sidebar-primary via-sidebar-foreground to-sidebar-primary bg-clip-text text-transparent"
                    >
                      {hasLoadedPresence ? activeUserStats.activeUsers.toLocaleString() : '...'}
                    </motion.p>
                    <motion.span
                      animate={{ scale: [1, 1.15, 1], opacity: [0.55, 1, 0.55] }}
                      transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
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
          </motion.div>
        )}

        {!collapsed && (
          <div className="px-2 py-2 text-center">
            <GrandStateLogo className="w-7 h-7 mx-auto mb-0.5" />
            <p className="text-sm font-bold bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400 bg-clip-text text-transparent tracking-wide">
              Grand<span className="text-amber-400">$</span>tate
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
  const { activeUserStats, hasLoadedPresence, markOffline } = useActiveUsersPresence();

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
                <span className="font-bold text-lg text-sidebar-foreground">Grand<span className="text-amber-500">$</span>tate</span>
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
              Grand<span className="text-amber-500">$</span>tate
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
      />
    </motion.aside>
  );
}
