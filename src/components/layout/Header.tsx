import { useState, useEffect } from 'react';
import { Search, User, HelpCircle, Settings, LogOut, ChevronDown, Shield, BarChart3, Crown, Rocket, Star, Menu } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useLanguage } from '@/i18n/LanguageContext';
import { useFacebookConnection } from '@/hooks/useFacebookConnection';
import { useLicenseAuth } from '@/hooks/useLicenseAuth';
import { getUserPackage } from '@/hooks/usePackageLimits';
import { cn } from '@/lib/utils';
import { ProfileDialog } from '@/components/profile/ProfileDialog';
import { useMobileSidebar } from '@/components/layout/Sidebar';

const PKG_THEME = {
  free: {
    label: 'Rookie',
    gradient: 'from-emerald-500 to-teal-500',
    ring: 'ring-emerald-400/50',
    badge: 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
    icon: Rocket,
  },
  agent: {
    label: 'Top Agent',
    gradient: 'from-amber-500 to-orange-500',
    ring: 'ring-amber-400/50',
    badge: 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30',
    icon: Star,
  },
  elite: {
    label: 'Elite',
    gradient: 'from-purple-500 to-pink-500',
    ring: 'ring-purple-400/50',
    badge: 'bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-500/30',
    icon: Crown,
  },
} as const;

function MobileMenuButton() {
  const { setOpen } = useMobileSidebar();
  return (
    <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setOpen(true)}>
      <Menu className="w-5 h-5" />
    </Button>
  );
}

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export function Header({ title, subtitle }: HeaderProps) {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const { isConnected, user: fbUser } = useFacebookConnection();
  const { license, user: authUser } = useLicenseAuth();

  const [profileName, setProfileName] = useState('');
  const [profileAvatar, setProfileAvatar] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const updateProfileFromStorage = () => {
    setProfileName(localStorage.getItem('profile_name') || '');
    setProfileAvatar(localStorage.getItem('profile_avatar') || '');
    setProfileEmail(localStorage.getItem('profile_email') || '');
  };

  useEffect(() => {
    updateProfileFromStorage();

    // Listen for local updates (from Settings)
    window.addEventListener('profile-updated', updateProfileFromStorage);
    // Listen for cross-tab updates
    window.addEventListener('storage', updateProfileFromStorage);

    return () => {
      window.removeEventListener('profile-updated', updateProfileFromStorage);
      window.removeEventListener('storage', updateProfileFromStorage);
    };
  }, []);

  // Use real profile data, fallback to license owner, FB user, auth email, then default
  const displayName = profileName || license?.ownerName || fbUser?.name || authUser?.user_metadata?.full_name || authUser?.email?.split('@')[0] || 'User';
  const displayAvatar = profileAvatar || fbUser?.profilePic || '';
  const initials = displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const pkg = getUserPackage();
  const theme = PKG_THEME[pkg] || PKG_THEME.free;
  const PkgIcon = theme.icon;

  return (
    <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-lg border-b border-border">
      <div className="flex items-center justify-between h-16 px-4 md:px-6">
        <div className="flex items-center gap-3">
          <MobileMenuButton />
          <div>
            <h1 className="text-lg md:text-xl font-bold text-foreground">{title}</h1>
            {subtitle && (
              <p className="text-sm text-muted-foreground hidden md:block">{subtitle}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={t.common.searchProperties}
              className="w-64 pl-10 bg-muted/50 border-0 focus-visible:ring-1"
            />
          </div>

          {/* Language Switcher */}
          <LanguageSwitcher />

          {/* Help */}
          <Link to="/help">
            <Button variant="ghost" size="icon" className="relative">
              <HelpCircle className="w-5 h-5" />
            </Button>
          </Link>

          {/* User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-2 pl-1.5 pr-2 h-10 hover:bg-muted/80">
                <Avatar className={cn('w-8 h-8 ring-2', theme.ring)}>
                  <AvatarImage src={displayAvatar} />
                  <AvatarFallback className={cn('bg-gradient-to-br text-white text-xs font-bold', theme.gradient)}>
                    {initials || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden md:flex flex-col items-start">
                  <span className="font-medium text-sm max-w-[120px] truncate leading-tight">{displayName}</span>
                  <span className="text-[10px] text-muted-foreground leading-tight flex items-center gap-0.5">
                    <PkgIcon className="w-2.5 h-2.5" />
                    {theme.label}
                  </span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground hidden md:block" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72 p-0 overflow-hidden">
              {/* Profile Banner — package-themed gradient */}
              <div className={cn('bg-gradient-to-r p-4', theme.gradient)}>
                <div className="flex items-center gap-3">
                  <Avatar className="w-12 h-12 ring-2 ring-white/40">
                    <AvatarImage src={displayAvatar} />
                    <AvatarFallback className="bg-white/20 text-white text-sm font-bold">
                      {initials || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold text-sm truncate">{displayName}</p>
                    {profileEmail && (
                      <p className="text-white/70 text-xs truncate">{profileEmail}</p>
                    )}
                    <div className="flex items-center gap-1.5 mt-1">
                      <Badge className="bg-white/20 text-white border-white/30 text-[10px] px-1.5 py-0 font-semibold">
                        <PkgIcon className="w-2.5 h-2.5 mr-0.5" />
                        {theme.label}
                      </Badge>
                      {isConnected && (
                        <Badge className="bg-white/20 text-white border-white/30 text-[10px] px-1.5 py-0">
                          <Shield className="w-2.5 h-2.5 mr-0.5" />
                          FB
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Menu Items */}
              <div className="p-1.5">
                <DropdownMenuItem
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer"
                  onClick={() => setIsProfileOpen(true)}
                >
                  <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <User className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{t.common.profile}</p>
                    <p className="text-xs text-muted-foreground">{t.settings.profileDesc || ''}</p>
                  </div>
                </DropdownMenuItem>

                <DropdownMenuItem
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer"
                  onClick={() => navigate('/analytics')}
                >
                  <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                    <BarChart3 className="w-4 h-4 text-indigo-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{t.nav.analytics || 'Analytics'}</p>
                    <p className="text-xs text-muted-foreground">{language === 'th' ? 'ดูสถิติการโพสต์' : 'View posting stats'}</p>
                  </div>
                </DropdownMenuItem>

                <DropdownMenuItem
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer"
                  onClick={() => navigate('/pricing')}
                >
                  <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center',
                    pkg === 'elite' ? 'bg-purple-100 dark:bg-purple-900/30' : 'bg-amber-100 dark:bg-amber-900/30'
                  )}>
                    <Crown className={cn('w-4 h-4', pkg === 'elite' ? 'text-purple-600' : 'text-amber-600')} />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{pkg === 'elite' ? (t.nav.pricing || 'Package') : (language === 'th' ? 'อัพเกรดแพ็คเกจ' : 'Upgrade Package')}</p>
                    <p className="text-xs text-muted-foreground">{theme.label}</p>
                  </div>
                </DropdownMenuItem>

                <DropdownMenuItem
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer"
                  onClick={() => navigate('/settings')}
                >
                  <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                    <Settings className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{t.nav.settings}</p>
                  </div>
                </DropdownMenuItem>

                <DropdownMenuSeparator className="my-1.5" />

                <DropdownMenuItem
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer text-red-600 dark:text-red-400 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/20"
                  onClick={() => {
                    // Clear all auth data including license
                    localStorage.removeItem('gstate_license');
                    localStorage.removeItem('isLoggedIn');
                    localStorage.removeItem('userPackage');
                    localStorage.removeItem('fb_connected');
                    localStorage.removeItem('fb_user_name');
                    localStorage.removeItem('fb_user_profilePic');
                    localStorage.removeItem('profile_name');
                    localStorage.removeItem('profile_email');
                    localStorage.removeItem('profile_avatar');
                    window.location.href = '/auth?logout=true';
                  }}
                >
                  <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                    <LogOut className="w-4 h-4 text-red-600 dark:text-red-400" />
                  </div>
                  <p className="text-sm font-medium">{t.common.logout}</p>
                </DropdownMenuItem>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <ProfileDialog open={isProfileOpen} onOpenChange={setIsProfileOpen} />
    </header>
  );
}
