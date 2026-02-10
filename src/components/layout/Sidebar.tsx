import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Zap,
  Building2,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Settings,
  PlusCircle,
  Users,
  Crown,
  BarChart3,
  Shield,
  User,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { useLanguage } from '@/i18n/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { useLicenseAuth } from '@/hooks/useLicenseAuth';

const navigationItems = [
  { key: 'properties' as const, href: '/properties', icon: Building2 },
  { key: 'addProperty' as const, href: '/gallery', icon: PlusCircle },
  { key: 'groups' as const, href: '/groups', icon: Users },
  { key: 'automation' as const, href: '/automation', icon: Zap },
  { key: 'analytics' as const, href: '/analytics', icon: BarChart3 },
  { key: 'pricing' as const, href: '/pricing', icon: Crown },
  { key: 'settings' as const, href: '/settings', icon: Settings },
];

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const { t } = useLanguage();
  const { license, user, signOut } = useLicenseAuth();

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 80 : 280 }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      className="fixed left-0 top-0 z-40 h-screen bg-sidebar border-r border-sidebar-border flex flex-col"
    >
      {/* Logo */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-sidebar-border">
        <Link to="/automation" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sidebar-primary flex items-center justify-center shadow-glow">
            <Building2 className="w-5 h-5 text-sidebar-primary-foreground" />
          </div>
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="font-bold text-lg text-sidebar-foreground"
            >
              Grand$tate
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

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navigationItems.map((item) => {
          const isActive = location.pathname === item.href;
          const label = t.nav[item.key] || item.key;
          return (
            <Link
              key={item.key}
              to={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative',
                isActive
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-glow'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              )}
            >
              <item.icon className={cn('w-5 h-5 flex-shrink-0', isActive && 'animate-pulse-glow')} />
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
          <div className="px-2 py-2 text-center">
            <p className="text-[10px] uppercase tracking-[0.2em] text-sidebar-foreground/40 font-medium">Powered by</p>
            <p className="text-sm font-bold bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400 bg-clip-text text-transparent tracking-wide">
              Grand$tate
            </p>
            <p className="text-[9px] text-sidebar-foreground/30 tracking-widest">VERSION 2.0</p>
          </div>
        )}
        {collapsed && (
          <div className="text-center py-1">
            <p className="text-[9px] font-bold bg-gradient-to-r from-amber-400 to-yellow-300 bg-clip-text text-transparent">G$</p>
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
    </motion.aside>
  );
}
