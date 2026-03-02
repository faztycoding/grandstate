import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  User,
  RotateCcw,
  Facebook,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Unlink,
  RefreshCw,
  LogIn,
  Wifi,
  Key,
  Monitor,
  X,
  Trash2,
  Download,
  Info,
  Camera,
  Crown,
  Rocket,
  Star,
  ArrowRight,
  Palette,
  Sun,
  Moon,
  Check,
  Lock,
  CircleDot,
  Circle,
  Send,
  MessageCircle,
  Settings as SettingsIcon,
  Zap,
  Activity,
  Database,
  Terminal,
  ShieldCheck,
  Save,
  Clock,
  Power,
  GripHorizontal,
  CalendarDays,
  HardDrive,
  Gauge,
} from 'lucide-react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useFacebookConnection } from '@/hooks/useFacebookConnection';
import { SupportTicketDialog } from '@/components/SupportTicketDialog';
import { getUserPackage, getPackageLimits } from '@/hooks/usePackageLimits';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/i18n/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { useAppTheme, THEME_PALETTES } from '@/hooks/useTheme';
import { useLicenseAuth } from '@/hooks/useLicenseAuth';
import { supabase } from '@/lib/supabase';
import { apiFetch } from '@/lib/config';
import { APP_VERSION } from '@/lib/version';
import { ScrollArea } from '@/components/ui/scroll-area';

const PKG_CONFIG = {
  free: { label: 'Rookie', gradient: 'from-emerald-500 to-teal-500', icon: Rocket, desc: 'เริ่มต้นใช้งาน' },
  agent: { label: 'Top Agent', gradient: 'from-amber-500 to-orange-500', icon: Star, desc: 'สำหรับนายหน้ามืออาชีพ' },
  elite: { label: 'Elite', gradient: 'from-purple-500 to-pink-500', icon: Crown, desc: 'แพ็คเกจสูงสุด ไม่จำกัด' },
} as const;

export default function Settings() {
  const { t, language } = useLanguage();
  const isEn = language === 'en';
  const s = t.settingsPage;
  const navigate = useNavigate();
  const { paletteId, setPaletteId, isDark, toggleDark } = useAppTheme();
  const { user: authUser, license: authLicense, activateLicense, isValidating } = useLicenseAuth();
  const profileFileRef = useRef<HTMLInputElement>(null);
  const [licenseKeyInput, setLicenseKeyInput] = useState('');
  const [licenseError, setLicenseError] = useState<string | null>(null);
  const [licenseSuccess, setLicenseSuccess] = useState(false);

  // Package info
  const pkg = getUserPackage();
  const pkgTheme = PKG_CONFIG[pkg] || PKG_CONFIG.free;
  const pkgLimits = getPackageLimits(pkg);
  const PkgIcon = pkgTheme.icon;

  // Facebook connection (multi-session)
  const {
    isConnected,
    isConnecting,
    isChecking,
    user,
    sessions: fbSessions,
    connectedCount: fbConnectedCount,
    connectingSlot,
    activeSlot,
    connect,
    confirmLogin,
    autoLogin,
    reLogin,
    disconnect,
    checkStatus,
    setActiveSlot
  } = useFacebookConnection();

  const [connectSlot, setConnectSlot] = useState(0);
  const [showSupportTicket, setShowSupportTicket] = useState(false);

  // ─── My Tickets ───
  interface MyTicket {
    id: string;
    subject: string;
    description: string;
    category: string;
    status: string;
    admin_reply: string | null;
    admin_replied_at: string | null;
    created_at: string;
  }
  const [myTickets, setMyTickets] = useState<MyTicket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [deletingTicketId, setDeletingTicketId] = useState<string | null>(null);

  const fetchMyTickets = useCallback(async () => {
    setTicketsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase
        .from('support_tickets')
        .select('id, subject, description, category, status, admin_reply, admin_replied_at, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setMyTickets(data || []);
    } catch (err) {
      console.error('Fetch tickets error:', err);
    } finally {
      setTicketsLoading(false);
    }
  }, []);

  const handleDeleteTicket = async (ticketId: string) => {
    setDeletingTicketId(ticketId);
    try {
      const res = await apiFetch(`/api/support-tickets/${ticketId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        toast.success(isEn ? 'Ticket deleted' : 'ลบเรื่องแจ้งปัญหาแล้ว');
        setMyTickets(prev => prev.filter(t => t.id !== ticketId));
      } else {
        toast.error(data.error || 'Delete failed');
      }
    } catch {
      toast.error(isEn ? 'Failed to delete' : 'ลบไม่สำเร็จ');
    } finally {
      setDeletingTicketId(null);
    }
  };

  useEffect(() => {
    fetchMyTickets();
  }, [fetchMyTickets]);

  const handleDisconnect = async (slot?: number) => {
    const targetSlot = slot ?? activeSlot;
    const sessionName = fbSessions[targetSlot]?.name || `Session ${targetSlot + 1}`;
    const result = await disconnect(targetSlot);
    if (result.success) {
      toast.success(`ยกเลิกการเชื่อมต่อ ${sessionName} (Slot ${targetSlot + 1}) สำเร็จ`);
      // If we disconnected the active slot, switch to next available
      if (targetSlot === activeSlot) {
        const nextConnected = fbSessions.findIndex((s, i) => i !== targetSlot && s && s.name);
        if (nextConnected >= 0) {
          setActiveSlot(nextConnected);
        }
      }
    } else {
      toast.error(result.message || 'ยกเลิกการเชื่อมต่อไม่สำเร็จ');
    }
  };

  // Facebook login popup state
  const [showLoginPopup, setShowLoginPopup] = useState(false);
  const [loginStep, setLoginStep] = useState<'opening' | 'waiting' | 'checking' | 'success' | 'error'>('opening');
  const [loginUserName, setLoginUserName] = useState('');
  const [loginProfilePic, setLoginProfilePic] = useState('');
  const loginPollRef = useRef<NodeJS.Timeout | null>(null);
  const pollCountRef = useRef(0);
  const [loginError, setLoginError] = useState('');
  const [fbEmail, setFbEmail] = useState('');
  const [fbPassword, setFbPassword] = useState('');
  const [isAutoLogging, setIsAutoLogging] = useState(false);
  const [reLoggingSlot, setReLoggingSlot] = useState<number | null>(null);

  // Auto-detect login: poll every 5 seconds when popup is open (NOT during auto-login)
  useEffect(() => {
    if (showLoginPopup && loginStep === 'waiting' && !isAutoLogging && !loginPollRef.current) {
      pollCountRef.current = 0;
      loginPollRef.current = setInterval(async () => {
        pollCountRef.current++;
        try {
          const result = await confirmLogin();
          if (result.success) {
            if (loginPollRef.current) clearInterval(loginPollRef.current);
            loginPollRef.current = null;
            setLoginUserName(result.user?.name || 'Facebook User');
            setLoginProfilePic(result.user?.profilePic || '');
            setLoginStep('success');
            setTimeout(() => {
              setShowLoginPopup(false);
            }, 2000);
          }
        } catch {
          // Silent fail
        }
      }, 5000);
    }

    // Stop polling when auto-login starts
    if (isAutoLogging && loginPollRef.current) {
      clearInterval(loginPollRef.current);
      loginPollRef.current = null;
    }

    return () => {
      if (loginPollRef.current) {
        clearInterval(loginPollRef.current);
        loginPollRef.current = null;
      }
    };
  }, [showLoginPopup, loginStep, confirmLogin, isAutoLogging]);

  const handleConnectFacebook = async (slot: number = 0) => {
    setConnectSlot(slot);
    setLoginStep('opening');
    setShowLoginPopup(true);
    setLoginUserName('');
    setLoginProfilePic('');
    setLoginError('');
    setFbEmail('');
    setFbPassword('');

    const result = await connect(slot);
    if (result.success) {
      setLoginStep('waiting');
    } else {
      setLoginError(result.message || 'ไม่สามารถเชื่อมต่อได้');
      setLoginStep('error');
    }
  };

  const handleAutoLogin = async () => {
    if (!fbEmail || !fbPassword) return;
    setIsAutoLogging(true);
    setLoginError('');
    const result = await autoLogin(fbEmail, fbPassword);
    setIsAutoLogging(false);
    if (result.success) {
      setLoginUserName(result.user?.name || 'Facebook User');
      setLoginProfilePic(result.user?.profilePic || '');
      setLoginStep('success');
      setFbPassword('');
      await checkStatus();
    } else {
      setLoginError(result.message || 'Login ไม่สำเร็จ');
    }
  };

  const handleCloseLoginPopup = () => {
    if (loginPollRef.current) {
      clearInterval(loginPollRef.current);
      loginPollRef.current = null;
    }
    setShowLoginPopup(false);
  };

  // Re-login using stored credentials — if no credentials, fall back to manual login popup
  const handleReLogin = async (slot: number) => {
    setReLoggingSlot(slot);
    try {
      const result = await reLogin(slot);
      if (result.success) {
        toast.success(result.message || `เข้าสู่ระบบใหม่ Slot ${slot + 1} สำเร็จ`);
        setReLoggingSlot(null);
        return;
      }
      // If no stored credentials, fall back to manual login popup
      if (result.needCredentials) {
        toast.info('ยังไม่มีรหัสผ่านที่บันทึกไว้ — กรุณากรอก Email/Password');
        setReLoggingSlot(null);
        handleConnectFacebook(slot);
        return;
      }
      // Other error
      toast.error(result.message || 'เข้าสู่ระบบใหม่ไม่สำเร็จ');
    } catch {
      toast.error('เกิดข้อผิดพลาดระหว่างเข้าสู่ระบบใหม่');
    }
    setReLoggingSlot(null);
  };

  // Profile state — synced with Supabase auth metadata
  const [displayName, setDisplayName] = useState(() => localStorage.getItem('profile_display_name') || '');
  const [lineId, setLineId] = useState(() => localStorage.getItem('profile_line_id') || '');
  const [profileAvatar, setProfileAvatar] = useState(() => localStorage.getItem('profile_avatar') || '');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const handleDisplayNameChange = (value: string) => {
    setDisplayName(value);
    localStorage.setItem('profile_display_name', value);
    localStorage.setItem('profile_name', value);
    window.dispatchEvent(new Event('profile-updated'));
  };

  const handleLineIdChange = (value: string) => {
    setLineId(value);
    localStorage.setItem('profile_line_id', value);
    window.dispatchEvent(new Event('profile-updated'));
  };

  // Load profile from Supabase metadata on mount
  useEffect(() => {
    const loadProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.user_metadata) {
        const meta = user.user_metadata;
        const name = meta.display_name || meta.full_name || '';
        if (name) {
          setDisplayName(name);
          localStorage.setItem('profile_display_name', name);
          localStorage.setItem('profile_name', name);
        }
        if (meta.line_id) { setLineId(meta.line_id); localStorage.setItem('profile_line_id', meta.line_id); }
      }
    };
    loadProfile();
  }, []);

  // Change Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      toast.error(isEn ? 'Please fill in all fields' : 'กรุณากรอกข้อมูลให้ครบ');
      return;
    }
    if (newPassword.length < 6) {
      toast.error(isEn ? 'Password must be at least 6 characters' : 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      toast.error(isEn ? 'Passwords do not match' : 'รหัสผ่านใหม่ไม่ตรงกัน');
      return;
    }
    if (currentPassword === newPassword) {
      toast.error(isEn ? 'New password must be different from current password' : 'รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสเดิม');
      return;
    }
    setIsChangingPassword(true);
    try {
      // Verify current password by re-authenticating
      const email = authUser?.email;
      if (!email) {
        toast.error(isEn ? 'User email not found' : 'ไม่พบอีเมลผู้ใช้');
        return;
      }
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      });
      if (verifyError) {
        toast.error(isEn ? 'Current password is incorrect' : 'รหัสผ่านปัจจุบันไม่ถูกต้อง');
        return;
      }
      // Current password verified — now update to new password
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success(isEn ? 'Password changed successfully' : 'เปลี่ยนรหัสผ่านสำเร็จ');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      toast.error(message || (isEn ? 'Failed to change password' : 'เปลี่ยนรหัสผ่านไม่สำเร็จ'));
    } finally {
      setIsChangingPassword(false);
    }
  };

  // Default browser
  const [defaultBrowser, setDefaultBrowser] = useState<'chrome' | 'firefox' | 'edge'>(() =>
    (localStorage.getItem('defaultBrowser') as 'chrome' | 'firefox' | 'edge') || 'chrome'
  );

  const handleProfileImageUpload = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      setProfileAvatar(base64);
      localStorage.setItem('profile_avatar', base64);
      window.dispatchEvent(new Event('profile-updated'));
      toast.success(t.common.success);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setIsSavingProfile(true);
    const normalizedName = displayName.trim();
    const normalizedLineId = lineId.trim();
    try {
      // Save to Supabase auth metadata
      const { error } = await supabase.auth.updateUser({
        data: { display_name: normalizedName, full_name: normalizedName, line_id: normalizedLineId }
      });
      if (error) throw error;

      // Save to localStorage for fast access
      setDisplayName(normalizedName);
      setLineId(normalizedLineId);
      localStorage.setItem('profile_display_name', normalizedName);
      localStorage.setItem('profile_name', normalizedName);
      localStorage.setItem('profile_line_id', normalizedLineId);
      localStorage.removeItem('claudeApiKey');
      localStorage.setItem('defaultBrowser', defaultBrowser);
      window.dispatchEvent(new Event('profile-updated'));
      toast.success(t.common.success);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ';
      toast.error(msg);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleClearHistory = () => {
    localStorage.removeItem('healthcheck_post_history');
    localStorage.removeItem('healthcheck_first_post_date');
    toast.success(s.resetConfirm);
  };

  const handleExportData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error(isEn ? 'Not logged in' : 'ยังไม่ได้เข้าสู่ระบบ'); return; }

      const [propertiesRes, groupsRes, postHistoryRes] = await Promise.all([
        supabase.from('properties').select('*').eq('user_id', user.id),
        supabase.from('facebook_groups').select('*').eq('user_id', user.id),
        apiFetch('/api/posting-history').then(r => r.json()).catch(() => ({ history: [] })),
      ]);

      const data = {
        profile: { name: displayName, lineId, email: user.email },
        properties: propertiesRes.data || [],
        groups: groupsRes.data || [],
        postHistory: postHistoryRes.history || [],
        exportedAt: new Date().toISOString(),
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `grandstate-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t.common.success);
    } catch (err) {
      console.error('Export error:', err);
      toast.error(isEn ? 'Export failed' : 'ส่งออกข้อมูลไม่สำเร็จ');
    }
  };

  // Real usage stats
  const [realStats, setRealStats] = useState<{ postsToday: number; groupsCount: number; propertiesCount: number; syncedAt: string | null; loading: boolean }>({
    postsToday: 0, groupsCount: 0, propertiesCount: 0, syncedAt: null, loading: false,
  });

  const fetchRealStats = useCallback(async () => {
    setRealStats(prev => ({ ...prev, loading: true }));
    try {
      const res = await apiFetch('/api/user/real-stats');
      const data = await res.json();
      if (data.success) {
        setRealStats({
          postsToday: data.postsToday ?? 0,
          groupsCount: data.groupsCount ?? 0,
          propertiesCount: data.propertiesCount ?? 0,
          syncedAt: data.syncedAt,
          loading: false,
        });
      } else { setRealStats(prev => ({ ...prev, loading: false })); }
    } catch { setRealStats(prev => ({ ...prev, loading: false })); }
  }, []);

  useEffect(() => { fetchRealStats(); }, [fetchRealStats]);

  // Derived data for industrial gauges
  const pkgAccent = pkg === 'elite' ? 'purple' : pkg === 'agent' ? 'amber' : 'emerald';
  const accentMap = { purple: { text: 'text-purple-400', bg: 'bg-purple-500', border: 'border-purple-500', shadow: 'shadow-purple-500/30', glow: 'shadow-[0_0_30px_rgba(168,85,247,0.3)]' }, amber: { text: 'text-amber-400', bg: 'bg-amber-500', border: 'border-amber-500', shadow: 'shadow-amber-500/30', glow: 'shadow-[0_0_30px_rgba(245,158,11,0.3)]' }, emerald: { text: 'text-emerald-400', bg: 'bg-emerald-500', border: 'border-emerald-500', shadow: 'shadow-emerald-500/30', glow: 'shadow-[0_0_30px_rgba(52,211,153,0.3)]' } };
  const accent = accentMap[pkgAccent];
  const licenseDaysLeft = authLicense?.expiresAt ? Math.max(0, Math.ceil((new Date(authLicense.expiresAt).getTime() - Date.now()) / 86400000)) : null;
  const syncTime = realStats.syncedAt
    ? new Date(realStats.syncedAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false })
    : '—';

  return (
    <DashboardLayout title={t.settings.title} subtitle={t.settings.subtitle}>
      {/* ═══ GRANDSTATE INDUSTRIAL IDENTITY CONSOLE ═══ */}
      <div className="relative rounded-3xl overflow-hidden border border-slate-700/70 shadow-2xl" style={{ background: 'linear-gradient(180deg, hsl(222 47% 6%) 0%, hsl(222 47% 4%) 100%)' }}>
        {/* Blueprint Grid */}
        <div className="absolute inset-0 opacity-[0.025] pointer-events-none" style={{ backgroundImage: 'linear-gradient(rgba(148,163,184,.45) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,.45) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        {/* Scanning Line */}
        <motion.div animate={{ top: ['-5%', '105%'] }} transition={{ duration: 12, repeat: Infinity, ease: 'linear' }} className="absolute left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-500/15 to-transparent pointer-events-none z-20" />

        <div className="relative z-10 p-5 lg:p-8 space-y-6">

        {/* ═══ 1. FACTORY PROFILE DECK ═══ */}
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}
          className="rounded-2xl border border-slate-700/60 bg-gradient-to-br from-slate-950/90 via-slate-900/70 to-slate-950/90 p-5 sm:p-6">
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-5 items-stretch">
            <div className="flex flex-col sm:flex-row gap-4 sm:gap-5">
              <div className="relative group self-start">
                <div className="w-28 h-28 rounded-2xl border-2 border-slate-700 bg-slate-950/80 flex items-center justify-center shadow-[inset_0_0_30px_rgba(0,0,0,0.8)]">
                  {profileAvatar ? (
                    <img src={profileAvatar} alt={displayName} className="w-24 h-24 rounded-xl object-cover" />
                  ) : (
                    <span className={cn("text-5xl font-black", accent.text)}>
                      {displayName ? displayName.charAt(0).toUpperCase() : 'U'}
                    </span>
                  )}
                </div>
                <button onClick={() => profileFileRef.current?.click()}
                  className={cn("absolute -bottom-2 -right-2 p-2 rounded-lg text-black shadow-lg opacity-0 group-hover:opacity-100 transition-opacity", accent.bg)}>
                  <Camera size={14} />
                </button>
                <input ref={profileFileRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleProfileImageUpload(e.target.files)} />
              </div>

              <div className="flex-1 space-y-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-400">{isEn ? 'Factory Profile' : 'โปรไฟล์ผู้ใช้งาน'}</p>
                  <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">{displayName || 'User'}</h2>
                  <p className="text-sm text-slate-300 mt-1">{authUser?.email || '—'}</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={cn("border border-transparent", accent.bg, accent.text)}>{pkgTheme.label}</Badge>
                  <Badge variant="outline" className="text-slate-300 border-slate-600">
                    {isEn ? `FB Sessions ${fbConnectedCount}/${pkgLimits.fbAccounts}` : `FB Sessions ${fbConnectedCount}/${pkgLimits.fbAccounts}`}
                  </Badge>
                  {licenseDaysLeft !== null && (
                    <Badge variant="outline" className={cn("border", licenseDaysLeft <= 7 ? 'border-red-500/40 text-red-400' : licenseDaysLeft <= 30 ? 'border-amber-500/40 text-amber-400' : 'border-emerald-500/40 text-emerald-400')}>
                      {isEn ? `${licenseDaysLeft} days left` : `เหลือ ${licenseDaysLeft} วัน`}
                    </Badge>
                  )}
                </div>

                {pkg !== 'elite' && (
                  <Button size="sm" variant="outline" onClick={() => navigate('/pricing')} className="border-slate-600 text-slate-200 hover:bg-slate-800/70">
                    {s.upgrade} <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                {
                  label: isEn ? 'Posts Today' : 'โพสต์วันนี้',
                  value: realStats.loading ? '…' : String(realStats.postsToday),
                  sub: `/ ${pkgLimits.postsPerDay} ${isEn ? 'limit' : 'จำกัด'}`,
                  icon: Zap, valueClass: 'text-cyan-300',
                },
                {
                  label: isEn ? 'Groups' : 'กลุ่ม',
                  value: realStats.loading ? '…' : String(realStats.groupsCount),
                  sub: `/ ${pkgLimits.maxGroups} ${isEn ? 'limit' : 'จำกัด'}`,
                  icon: Activity, valueClass: 'text-amber-300',
                },
                {
                  label: isEn ? 'Properties' : 'สินทรัพย์',
                  value: realStats.loading ? '…' : String(realStats.propertiesCount),
                  sub: pkgLimits.maxProperties === Infinity ? `∞ ${isEn ? 'limit' : 'จำกัด'}` : `/ ${pkgLimits.maxProperties} ${isEn ? 'limit' : 'จำกัด'}`,
                  icon: Database, valueClass: accent.text,
                },
                {
                  label: isEn ? 'Sync Time' : 'เวลาซิงค์',
                  value: syncTime,
                  sub: null,
                  icon: Clock, valueClass: 'text-slate-100',
                },
              ].map((item, i) => (
                <div key={i} className="rounded-xl border border-slate-700/70 bg-slate-950/70 p-3.5 relative">
                  <div className="flex items-center gap-2 text-slate-400 mb-2">
                    <item.icon className="w-4 h-4" />
                    <span className="text-xs uppercase tracking-wider">{item.label}</span>
                    {i === 3 && (
                      <button onClick={fetchRealStats} disabled={realStats.loading} className="ml-auto text-slate-600 hover:text-slate-300 transition-colors disabled:opacity-40">
                        <RefreshCw className={cn('w-3 h-3', realStats.loading && 'animate-spin')} />
                      </button>
                    )}
                  </div>
                  <p className={cn('text-xl font-black font-mono leading-none', item.valueClass)}>{item.value}</p>
                  {item.sub && <p className="text-[10px] text-slate-600 mt-1 font-mono">{item.sub}</p>}
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* ═══ 2. LOWER DECK: SECURITY + IDENTITY SIDE-BY-SIDE ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* SECURITY CALIBRATION */}
          {authUser && (
            <motion.div initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.3 }}
              className="bg-slate-900/60 border-2 border-slate-800 rounded-2xl p-6 relative overflow-hidden">
              <motion.div animate={{ left: ['-10%', '110%'] }} transition={{ duration: 5, repeat: Infinity, ease: 'linear', repeatDelay: 3 }} className="absolute top-0 h-[1px] w-[30%] bg-gradient-to-r from-transparent via-amber-500/30 to-transparent pointer-events-none" />
              <div className="flex items-center gap-3 mb-5">
                <div className="w-9 h-9 bg-slate-950 border-2 border-amber-500/30 rounded-xl flex items-center justify-center">
                  <ShieldCheck size={16} className="text-amber-500" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Security Calibration</h3>
                  <p className="text-xs text-slate-300">{isEn ? 'Change your access credentials' : 'เปลี่ยนรหัสผ่านเข้าสู่ระบบ'}</p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 ml-1">{isEn ? 'Current Password' : 'รหัสผ่านปัจจุบัน'}</label>
                  <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="••••••••"
                    className="bg-black border-2 border-slate-800 rounded-xl h-11 px-4 text-sm text-amber-400 focus:border-amber-500/50 placeholder:text-muted-foreground" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 ml-1">{isEn ? 'New Password' : 'รหัสผ่านใหม่'}</label>
                  <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••"
                    className="bg-black border-2 border-slate-800 rounded-xl h-11 px-4 text-sm text-amber-400 focus:border-amber-500/50 placeholder:text-muted-foreground" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 ml-1">{isEn ? 'Confirm Password' : 'ยืนยันรหัสผ่าน'}</label>
                  <Input type="password" value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} placeholder="••••••••"
                    className="bg-black border-2 border-slate-800 rounded-xl h-11 px-4 text-sm text-amber-400 focus:border-amber-500/50 placeholder:text-muted-foreground" />
                </div>
                <button onClick={handleChangePassword} disabled={isChangingPassword || !currentPassword || !newPassword || !confirmNewPassword}
                  className="w-full py-3.5 bg-slate-950 border-2 border-amber-500 text-amber-500 font-semibold text-sm rounded-xl flex items-center justify-center gap-2 hover:bg-amber-500 hover:text-black transition-all shadow-lg shadow-amber-500/10 disabled:opacity-30 disabled:cursor-not-allowed">
                  {isChangingPassword ? <><Loader2 className="w-4 h-4 animate-spin" />{isEn ? 'Changing...' : 'กำลังเปลี่ยน...'}</> : <><ShieldCheck size={16} />{isEn ? 'Change Password' : 'เปลี่ยนรหัสผ่าน'}</>}
                </button>
              </div>
            </motion.div>
          )}

          {/* IDENTITY MATRIX */}
          <motion.div initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.35 }}
            className="bg-slate-900/60 border-2 border-slate-800 rounded-2xl p-6 relative overflow-hidden">
            <motion.div animate={{ top: ['0%', '100%', '0%'] }} transition={{ duration: 6, repeat: Infinity }} className="absolute inset-x-0 h-[1px] bg-cyan-500/15 shadow-[0_0_6px_rgba(0,200,255,0.3)] pointer-events-none" />
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 bg-slate-950 border-2 border-cyan-500/30 rounded-xl flex items-center justify-center">
                <User size={16} className="text-cyan-500" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Identity Matrix</h3>
                <p className="text-xs text-slate-300">{isEn ? 'Display name & contact — cloud synced' : 'ชื่อแสดงผลและช่องทางติดต่อ — ซิงค์กับระบบ'}</p>
              </div>
            </div>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 ml-1">{isEn ? 'Display Name' : 'ชื่อที่แสดง'}</label>
                <Input value={displayName} onChange={(e) => handleDisplayNameChange(e.target.value)} placeholder={isEn ? 'Your name' : 'ชื่อของคุณ'}
                  className="bg-black border-2 border-slate-800 rounded-xl h-11 px-4 text-sm text-cyan-400 focus:border-cyan-500/50 placeholder:text-muted-foreground" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 ml-1">Line ID</label>
                <Input value={lineId} onChange={(e) => handleLineIdChange(e.target.value)} placeholder="@yourlineid"
                  className="bg-black border-2 border-slate-800 rounded-xl h-11 px-4 text-sm text-cyan-400 focus:border-cyan-500/50 placeholder:text-muted-foreground" />
              </div>
              <button onClick={handleSave} disabled={isSavingProfile}
                className="w-full py-3.5 bg-cyan-600 text-black font-semibold text-sm rounded-xl flex items-center justify-center gap-2 hover:bg-cyan-500 transition-all shadow-lg shadow-cyan-500/10 disabled:opacity-30">
                {isSavingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save size={16} />}
                {isEn ? 'Save Account Details' : 'บันทึกข้อมูลบัญชี'}
              </button>
            </div>
          </motion.div>
        </div>

        {/* ═══ 3. FACEBOOK CONNECTION MODULE ═══ */}
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          className={cn("bg-slate-900/60 border-2 border-slate-800 rounded-2xl overflow-hidden", isConnected && "ring-1 ring-[#1877F2]/20")}>
          <div className="h-1 bg-gradient-to-r from-[#1877F2] to-[#0D47A1]" />
          <div className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-slate-950 border-2 border-[#1877F2]/30 rounded-xl flex items-center justify-center">
                  <Facebook className="w-4 h-4 text-[#1877F2]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">{t.settings.facebookConnection}</h3>
                  <p className="text-xs text-slate-300">{t.settings.facebookDesc}</p>
                </div>
              </div>
              <div className="flex sm:flex-col items-center sm:items-end gap-2 sm:gap-0">
                <div className="flex items-center gap-1">
                  {Array.from({ length: pkgLimits.fbAccounts }, (_, i) => (
                    <div key={i} className={cn("w-3 h-3 rounded-full border-2 transition-all",
                      i < fbConnectedCount ? "bg-[#1877F2] border-[#1877F2] shadow-sm shadow-[#1877F2]/30" : "border-slate-700 bg-transparent"
                    )} />
                  ))}
                </div>
                <p className="text-xs text-slate-300 sm:mt-1">{fbConnectedCount}/{pkgLimits.fbAccounts} sessions ({pkgTheme.label})</p>
              </div>
            </div>
          <div className="space-y-4">
            {/* Active Posting Account — shows which FB ID will be used in automation */}
            {isChecking ? (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-950/50 border border-slate-800">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                <p className="text-sm font-medium text-muted-foreground">{t.settings.checking}</p>
              </div>
            ) : fbConnectedCount > 0 ? (
              <div className="p-4 rounded-xl bg-[#1877F2]/5 border border-[#1877F2]/20">
                <p className="text-[10px] font-semibold text-[#1877F2] dark:text-blue-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                  <Send className="w-3 h-3" /> บัญชีที่ใช้โพสต์อัตโนมัติ
                </p>
                {(() => {
                  const activeSession = fbSessions[activeSlot];
                  const hasActive = activeSession && activeSession.name;
                  return hasActive ? (
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative">
                          {activeSession.profilePic ? (
                            <img src={activeSession.profilePic} alt={activeSession.name || ''} className="w-11 h-11 rounded-full object-cover ring-2 ring-[#1877F2]/40" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                          ) : (
                            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#1877F2] to-[#0D47A1] flex items-center justify-center ring-2 ring-[#1877F2]/40">
                              <span className="text-white font-bold">{activeSession.name?.charAt(0) || 'F'}</span>
                            </div>
                          )}
                          <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#1877F2] border-2 border-white dark:border-gray-900 flex items-center justify-center">
                            <Send className="w-2 h-2 text-white" />
                          </div>
                        </div>
                        <div>
                          <p className="font-semibold text-sm truncate">{activeSession.name}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <Badge className="bg-[#1877F2]/10 text-[#1877F2] dark:bg-[#1877F2]/20 dark:text-blue-400 text-[9px] h-4 px-1.5">
                              Slot {activeSlot + 1} — ใช้โพสต์
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <p className="text-[10px] text-muted-foreground flex-shrink-0 hidden sm:block">เปลี่ยนได้ด้านล่าง ↓</p>
                    </div>
                  ) : (
                    <p className="text-sm text-[#1877F2] dark:text-blue-400">เลือก session ด้านล่างเพื่อกำหนดบัญชีโพสต์</p>
                  );
                })()}
              </div>
            ) : isConnecting ? (
              <div className="p-4 rounded-xl bg-slate-950/50 border border-blue-800">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#1877F2]/10 flex items-center justify-center">
                    <Loader2 className="w-4 h-4 text-[#1877F2] animate-spin" />
                  </div>
                  <div>
                    <p className="font-medium text-sm text-blue-700 dark:text-blue-400">{t.settings.waitingLogin}</p>
                    <p className="text-xs text-muted-foreground">{t.settings.autoDetect}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="relative overflow-hidden rounded-xl border-2 border-dashed border-muted-foreground/20 hover:border-[#1877F2]/40 transition-all group">
                <div className="p-5 text-center space-y-3">
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-[#1877F2]/10 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Facebook className="w-7 h-7 text-[#1877F2]" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{t.settings.notConnected}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{t.settings.clickToConnect}</p>
                  </div>
                  <Button
                    onClick={() => handleConnectFacebook(0)}
                    className="w-full h-11 rounded-xl bg-gradient-to-r from-[#1877F2] to-[#0D47A1] hover:from-[#1565C0] hover:to-[#0B3D91] text-white font-semibold shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 transition-all"
                  >
                    <Facebook className="w-4 h-4 mr-2" />
                    {t.settings.connectFacebook}
                  </Button>
                </div>
              </div>
            )}

            {/* Session Slots Detail — Interactive per-slot with active selector */}
            <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold flex items-center gap-1.5"><Monitor className="w-4 h-4" /> FB Sessions ({fbConnectedCount}/{pkgLimits.fbAccounts})</p>
                <Badge variant="outline" className="text-[10px] h-5">{pkgTheme.label}</Badge>
              </div>
              <p className="text-[11px] text-muted-foreground -mt-1">คลิกเลือก session ที่ต้องการใช้โพสต์ • คลิกช่องว่างเพื่อเชื่อมต่อ Facebook ใหม่</p>

              <div className="space-y-2">
                {Array.from({ length: pkgLimits.fbAccounts }, (_, i) => {
                  const session = fbSessions[i];
                  const hasUser = session && session.name;
                  const isActive = activeSlot === i;
                  const isThisConnecting = connectingSlot === i;

                  return (
                    <div
                      key={i}
                      className={cn(
                        "relative flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-xl border-2 transition-all group",
                        hasUser && isActive
                          ? "border-[#1877F2] bg-[#1877F2]/10 ring-1 ring-[#1877F2]/20 shadow-sm"
                          : hasUser
                            ? "border-slate-700 bg-slate-900/60 hover:border-[#1877F2]/40 cursor-pointer"
                            : "border-dashed border-slate-700 bg-slate-900/30 hover:border-[#1877F2]/40 cursor-pointer"
                      )}
                      onClick={() => {
                        if (hasUser) {
                          setActiveSlot(i);
                          toast.success(`เลือก Session ${i + 1} (${session.name}) สำหรับโพสต์`);
                        } else if (!isThisConnecting) {
                          handleConnectFacebook(i);
                        }
                      }}
                    >
                      {/* Radio selector for active */}
                      <div className="flex-shrink-0">
                        {hasUser ? (
                          isActive ? (
                            <CircleDot className="w-5 h-5 text-[#1877F2]" />
                          ) : (
                            <Circle className="w-5 h-5 text-muted-foreground/40 group-hover:text-[#1877F2]/60 transition-colors" />
                          )
                        ) : (
                          <div className="w-5 h-5 rounded-full border-2 border-dashed border-muted-foreground/20" />
                        )}
                      </div>

                      {/* Avatar */}
                      <div className="relative flex-shrink-0">
                        {hasUser && session.profilePic ? (
                          <img
                            src={session.profilePic}
                            alt={session.name || ''}
                            className="w-10 h-10 rounded-full object-cover ring-2 ring-[#1877F2]/40"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                        ) : hasUser ? (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#1877F2] to-[#0D47A1] flex items-center justify-center ring-2 ring-[#1877F2]/40">
                            <span className="text-white text-sm font-bold">{session.name?.charAt(0) || 'F'}</span>
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center group-hover:bg-[#1877F2]/10 transition-colors">
                            <Facebook className="w-5 h-5 text-muted-foreground/30 group-hover:text-[#1877F2] transition-colors" />
                          </div>
                        )}
                        {/* Online dot */}
                        {hasUser && (
                          <div className={cn(
                            "absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-slate-900",
                            isActive ? "bg-[#1877F2]" : "bg-gray-400"
                          )} />
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        {hasUser ? (
                          <>
                            <p className="text-sm font-semibold truncate">{session.name}</p>
                            <div className="flex flex-wrap items-center gap-1 sm:gap-1.5 mt-0.5">
                              <Badge className={cn(
                                "text-[9px] h-4 px-1.5",
                                isActive
                                  ? "bg-[#1877F2]/10 text-[#1877F2] dark:bg-[#1877F2]/20 dark:text-blue-400"
                                  : "bg-muted text-muted-foreground"
                              )}>
                                Slot {i + 1}
                              </Badge>
                              {isActive && (
                                <Badge className="bg-[#1877F2]/10 text-[#1877F2] dark:bg-[#1877F2]/20 dark:text-blue-400 text-[9px] h-4 px-1.5">
                                  <Send className="w-2.5 h-2.5 mr-0.5" /> ใช้โพสต์
                                </Badge>
                              )}
                              {session.connectedAt && (
                                <span className="text-[9px] text-muted-foreground">
                                  เชื่อมต่อ {new Date(session.connectedAt).toLocaleDateString('th-TH')}
                                </span>
                              )}
                            </div>
                          </>
                        ) : isThisConnecting ? (
                          <>
                            <p className="text-sm font-medium text-blue-600 dark:text-blue-400">กำลังเชื่อมต่อ...</p>
                            <p className="text-[10px] text-muted-foreground">Slot {i + 1} • รอ login Facebook</p>
                          </>
                        ) : (
                          <>
                            <p className="text-sm font-medium text-muted-foreground">ว่าง — คลิกเพื่อเชื่อมต่อ</p>
                            <p className="text-[10px] text-muted-foreground">Slot {i + 1}</p>
                          </>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {hasUser && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="w-7 h-7 text-blue-500 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                              disabled={reLoggingSlot === i}
                              onClick={(e) => { e.stopPropagation(); handleReLogin(i); }}
                              title={`เข้าสู่ระบบใหม่ Slot ${i + 1}`}
                            >
                              {reLoggingSlot === i ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="w-7 h-7 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm(`ลบบัญชี "${session.name}" ออกจาก Slot ${i + 1}?\nจะสามารถเชื่อมต่อบัญชีใหม่แทนได้`)) {
                                  handleDisconnect(i);
                                }
                              }}
                              title={`ลบ Session ${i + 1}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </>
                        )}
                        {isThisConnecting && (
                          <Loader2 className="w-4 h-4 text-[#1877F2] animate-spin" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Trust Signals + Info */}
            <div className="space-y-2">
              <div className="flex items-center gap-3 p-2.5 rounded-lg bg-green-950/10 border border-green-900/30">
                <div className="w-6 h-6 rounded-full bg-green-900/30 flex items-center justify-center flex-shrink-0">
                  <Key className="w-3 h-3 text-green-600" />
                </div>
                <div className="flex-1">
                  <p className="text-[10px] font-medium text-green-400">Session เข้ารหัสในเครื่อง</p>
                  <p className="text-[9px] text-muted-foreground">เราไม่เก็บรหัสผ่าน Facebook ของคุณ — ใช้ browser profile ที่เข้ารหัสบน server</p>
                </div>
              </div>
              <div className="flex items-start gap-2 p-2.5 rounded-lg bg-slate-950/30 border border-slate-800/50 text-xs">
                <Info className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
                <p className="text-muted-foreground leading-relaxed">
                  {t.settings.connectionInfo} แพ็คเกจ {pkgTheme.label} รองรับ {pkgLimits.fbAccounts} FB session{pkgLimits.fbAccounts > 1 ? 's' : ''} • Logout จะล้าง cookies ออกจริง
                </p>
              </div>
            </div>
          </div>{/* end fb content */}
          </div>{/* end p-6 */}
        </motion.div>

        {/* ═══ 4. SYSTEM CONTROL: THEME + DATA ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* THEME ENGINE */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
          className="bg-slate-900/60 border-2 border-slate-800 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 bg-slate-950 border-2 border-purple-500/30 rounded-xl flex items-center justify-center">
              <Palette size={16} className="text-purple-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">{s.themeSettings || 'Theme Engine'}</h3>
              <p className="text-xs text-slate-300">{s.themeSettingsDesc || 'เลือกโทนสีที่เหมาะกับสไตล์ของคุณ'}</p>
            </div>
          </div>
          <div className="space-y-5">
            {/* Dark Mode Toggle */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/50 border border-slate-800">
              <div className="flex items-center gap-3">
                {isDark ? <Moon className="w-5 h-5 text-indigo-400" /> : <Sun className="w-5 h-5 text-amber-500" />}
                <div>
                  <p className="text-sm font-medium">{isDark ? (s.darkMode || 'โหมดมืด') : (s.lightMode || 'โหมดสว่าง')}</p>
                  <p className="text-xs text-muted-foreground">{s.toggleTheme || 'สลับโหมดสว่าง/มืด'}</p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={toggleDark} className="gap-2">
                {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                {isDark ? (s.switchToLight || 'สว่าง') : (s.switchToDark || 'มืด')}
              </Button>
            </div>

            {/* Color Palettes - Premium Grid */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {s.colorPalette || 'โทนสี'} ({THEME_PALETTES.length} {isEn ? 'styles' : 'สไตล์'})
                </p>
                <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-foreground" onClick={() => { setPaletteId('navy-gold'); toast.success(isEn ? 'Reset to default' : 'รีเซ็ตเป็นค่าเริ่มต้น'); }}>
                  <RotateCcw className="w-3.5 h-3.5 mr-1" />
                  {isEn ? 'Reset' : 'คืนค่า'}
                </Button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {THEME_PALETTES.map((p) => {
                  const isActive = paletteId === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => {
                        setPaletteId(p.id);
                        toast.success(isEn ? `Theme changed to ${p.nameEn}` : `เปลี่ยนธีมเป็น ${p.name}`);
                      }}
                      className={cn(
                        'relative group rounded-xl border-2 p-3 transition-all duration-300 text-left hover:shadow-md',
                        isActive
                          ? 'border-accent ring-2 ring-accent/20 bg-gradient-to-br from-accent/10 to-accent/5 scale-[1.02]'
                          : 'border-border hover:border-accent/40 hover:bg-muted/30 hover:scale-[1.01]'
                      )}
                    >
                      {/* Color Preview */}
                      <div className="flex gap-1 mb-3">
                        {p.preview.slice(0, 3).map((color, ci) => (
                          <div
                            key={ci}
                            className={cn(
                              'h-7 rounded-md flex-1 transition-transform duration-200 shadow-sm',
                              ci === 0 && 'rounded-l-lg',
                              ci === 2 && 'rounded-r-lg'
                            )}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-semibold truncate flex-1">{isEn ? p.nameEn : p.name}</p>
                        {isActive && (
                          <div className="w-4 h-4 rounded-full bg-accent flex items-center justify-center flex-shrink-0">
                            <Check className="w-2.5 h-2.5 text-accent-foreground" />
                          </div>
                        )}
                      </div>
                      {isActive && (
                        <div className="absolute inset-0 rounded-xl ring-2 ring-accent/10 pointer-events-none" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>{/* end theme space-y-5 */}
        </motion.div>

        {/* DATA MANAGEMENT */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
          className="bg-slate-900/60 border-2 border-slate-800 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 bg-slate-950 border-2 border-emerald-500/30 rounded-xl flex items-center justify-center">
              <HardDrive size={16} className="text-emerald-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">{isEn ? 'Data Management' : 'จัดการข้อมูล'}</h3>
              <p className="text-xs text-slate-300">{isEn ? 'Export, reset & system info' : 'ส่งออก, รีเซ็ต และข้อมูลระบบ'}</p>
            </div>
          </div>
          <div className="space-y-3">
            <button onClick={handleExportData}
              className="w-full py-3 bg-slate-950 border-2 border-emerald-500/30 text-emerald-400 font-semibold text-sm rounded-xl flex items-center justify-center gap-2 hover:bg-emerald-500/10 transition-all">
              <Download size={14} /> {isEn ? 'Export All Data' : 'ส่งออกข้อมูลทั้งหมด'}
            </button>
            <button onClick={handleClearHistory}
              className="w-full py-3 bg-slate-950 border-2 border-amber-500/20 text-amber-300 font-semibold text-sm rounded-xl flex items-center justify-center gap-2 hover:bg-amber-500/10 transition-all">
              <RotateCcw size={14} /> {isEn ? 'Clear Post History' : 'ล้างประวัติการโพสต์'}
            </button>
            <div className="p-3 bg-slate-950/50 border border-slate-800 rounded-xl space-y-1.5">
              <div className="flex items-center justify-between text-[9px]">
                <span className="text-slate-400 uppercase tracking-wider font-bold">Package</span>
                <span className={accent.text + " font-black"}>{pkgTheme.label}</span>
              </div>
              {licenseDaysLeft !== null && (
                <div className="flex items-center justify-between text-[9px]">
                  <span className="text-slate-400 uppercase tracking-wider font-bold">{isEn ? 'Expires' : 'หมดอายุ'}</span>
                  <span className={cn("font-bold", licenseDaysLeft <= 7 ? 'text-red-400' : licenseDaysLeft <= 30 ? 'text-amber-400' : 'text-slate-300')}>
                    {authLicense?.expiresAt ? new Date(authLicense.expiresAt).toLocaleDateString('th-TH') : '—'}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between text-[9px]">
                <span className="text-slate-400 uppercase tracking-wider font-bold">FB Sessions</span>
                <span className="text-blue-400 font-bold">{fbConnectedCount}/{pkgLimits.fbAccounts}</span>
              </div>
              <div className="flex items-center justify-between text-[9px]">
                <span className="text-slate-400 uppercase tracking-wider font-bold">Version</span>
                <span className="text-slate-400 font-mono">Grand$tate v{APP_VERSION}</span>
              </div>
            </div>
          </div>
        </motion.div>

        </div>{/* end 2-col grid */}

        {/* ═══ 5. SUPPORT TERMINAL ═══ */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}
          className="bg-slate-900/60 border-2 border-slate-800 rounded-2xl overflow-hidden relative">
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent" />
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-slate-950 border-2 border-cyan-500/30 rounded-xl flex items-center justify-center">
                  <MessageCircle size={16} className="text-cyan-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">{isEn ? 'Support Terminal' : 'ศูนย์ช่วยเหลือ'}</h3>
                  <p className="text-xs text-slate-300">{isEn ? 'Report issues & track responses' : 'แจ้งปัญหาและติดตามการตอบกลับ'}</p>
                </div>
              </div>
              <button onClick={() => setShowSupportTicket(true)}
                className="px-3 py-2 bg-slate-950 border-2 border-cyan-500/30 text-cyan-300 font-semibold text-sm rounded-xl flex items-center gap-1.5 hover:bg-cyan-500/10 transition-all">
                <Send size={12} /> {isEn ? 'New Report' : 'แจ้งปัญหาใหม่'}
              </button>
            </div>

            {ticketsLoading ? (
              <div className="flex items-center justify-center py-8 text-slate-400 gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-[10px] font-mono">Loading tickets...</span>
              </div>
            ) : myTickets.length === 0 ? (
              <div className="text-center py-6">
                <MessageCircle className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-[10px] text-slate-400">{isEn ? 'No tickets yet' : 'ยังไม่มีเรื่องแจ้งปัญหา'}</p>
              </div>
            ) : (
              <ScrollArea className="max-h-[250px]">
                <div className="space-y-2">
                  {myTickets.map((ticket) => {
                    const statusColor = ticket.status === 'open' ? 'bg-blue-500' : ticket.status === 'in_progress' ? 'bg-amber-500' : ticket.status === 'resolved' ? 'bg-emerald-500' : 'bg-slate-500';
                    const statusLabel = ticket.status === 'open' ? (isEn ? 'Open' : 'เปิด') : ticket.status === 'in_progress' ? (isEn ? 'In Progress' : 'ดำเนินการ') : ticket.status === 'resolved' ? (isEn ? 'Resolved' : 'แก้ไขแล้ว') : ticket.status === 'closed' ? (isEn ? 'Closed' : 'ปิด') : ticket.status;
                    const createdDate = new Date(ticket.created_at).toLocaleString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                    return (
                      <div key={ticket.id} className="p-3 rounded-xl border border-slate-800 bg-slate-950/50 hover:border-cyan-500/20 transition-colors">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className="text-[8px] font-bold px-1.5 py-0 h-4 border-slate-700">{ticket.category}</Badge>
                              <div className="flex items-center gap-1">
                                <div className={cn('w-1.5 h-1.5 rounded-full', statusColor)} />
                                <span className="text-[8px] font-medium text-slate-400">{statusLabel}</span>
                              </div>
                            </div>
                            <p className="text-[11px] font-semibold text-white truncate">{ticket.subject}</p>
                            <p className="text-[9px] text-slate-400 mt-0.5 line-clamp-1">{ticket.description}</p>
                            <p className="text-[8px] text-muted-foreground mt-1 font-mono">{createdDate}</p>
                          </div>
                          <Button variant="ghost" size="icon" className="w-7 h-7 text-slate-400 hover:text-red-400 hover:bg-red-500/10 flex-shrink-0"
                            onClick={() => handleDeleteTicket(ticket.id)} disabled={deletingTicketId === ticket.id}>
                            {deletingTicketId === ticket.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                          </Button>
                        </div>
                        {ticket.admin_reply && (
                          <div className="mt-2 p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/20">
                            <div className="flex items-center gap-1.5 mb-1">
                              <MessageCircle className="w-2.5 h-2.5 text-amber-500" />
                              <span className="text-[8px] font-bold text-amber-400 uppercase tracking-wider">{isEn ? 'Admin Reply' : 'ผู้ดูแลตอบกลับ'}</span>
                              {ticket.admin_replied_at && <span className="text-[8px] text-slate-400 font-mono ml-auto">{new Date(ticket.admin_replied_at).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>}
                            </div>
                            <p className="text-[10px] text-slate-300 leading-relaxed">{ticket.admin_reply}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </div>
        </motion.div>

        {/* ═══ 6. FACTORY CONTROL BAR ═══ */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-950/55 p-4">
          <div className="flex items-center gap-2 text-slate-300">
            <Gauge className="w-4 h-4 text-cyan-300" />
            <p className="text-sm">
              {isEn ? 'Factory profile controls are ready to sync.' : 'พร้อมซิงก์ค่าตั้งค่าบัญชีและโปรไฟล์'}
            </p>
          </div>

          <button onClick={handleSave} disabled={isSavingProfile}
            className={cn("px-6 py-3 rounded-xl flex items-center justify-center gap-2 font-semibold text-sm transition-all disabled:opacity-30 border-2",
              `bg-slate-950 ${accent.border} ${accent.text} hover:${accent.bg} hover:text-black shadow-lg ${accent.shadow}`
            )}>
            {isSavingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save size={16} />}
            {t.common.saveChanges}
          </button>
        </div>

        </div>{/* end z-10 inner */}
      </div>{/* end factory wrapper */}

      {/* Support Ticket Dialog */}
      <SupportTicketDialog open={showSupportTicket} onOpenChange={(v) => { setShowSupportTicket(v); if (!v) fetchMyTickets(); }} />

      {/* Facebook Login Dialog — World-class UI */}
      <Dialog open={showLoginPopup} onOpenChange={(open) => { if (!open) handleCloseLoginPopup(); }}>
        <DialogContent className="sm:max-w-[440px] p-0 overflow-hidden border-0 shadow-2xl" aria-describedby={undefined}>
          <DialogTitle className="sr-only">เชื่อมต่อ Facebook</DialogTitle>
          {/* Gradient Header */}
          <div className={cn(
            "relative px-6 pt-6 pb-5 text-white transition-all duration-500",
            loginStep === 'success'
              ? "bg-gradient-to-br from-green-500 via-emerald-500 to-teal-600"
              : loginStep === 'error'
                ? "bg-gradient-to-br from-red-500 via-red-600 to-rose-700"
                : "bg-gradient-to-br from-[#1877F2] via-[#1565C0] to-[#0D47A1]"
          )}>
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMSIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjA1KSIvPjwvc3ZnPg==')] opacity-50" />
            <div className="relative flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                {loginStep === 'success' ? <CheckCircle2 className="w-6 h-6" /> : <Facebook className="w-6 h-6" />}
              </div>
              <div>
                <h2 className="text-lg font-bold">
                  {loginStep === 'success' ? 'เชื่อมต่อสำเร็จ!' : loginStep === 'error' ? 'เกิดข้อผิดพลาด' : 'เชื่อมต่อ Facebook'}
                </h2>
                <p className="text-white/70 text-sm">
                  {loginStep === 'success' ? `ยินดีต้อนรับ ${loginUserName}` : loginStep === 'error' ? 'ไม่สามารถเชื่อมต่อได้' : `Session ${connectSlot + 1}/${pkgLimits.fbAccounts} — ${pkgTheme.label}`}
                </p>
              </div>
            </div>
          </div>

          <div className="px-6 py-5 space-y-5">
            {/* Progress Stepper */}
            {loginStep !== 'error' && (
              <div className="flex items-center gap-0">
                {/* Step 1 */}
                <div className="flex flex-col items-center flex-1">
                  <div className={cn(
                    "w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300",
                    loginStep === 'opening'
                      ? "border-[#1877F2] bg-blue-50 dark:bg-blue-950/50"
                      : "border-green-500 bg-green-50 dark:bg-green-950/50"
                  )}>
                    {loginStep === 'opening' ? (
                      <Loader2 className="w-5 h-5 text-[#1877F2] animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                    )}
                  </div>
                  <p className="text-[11px] font-medium mt-1.5">เปิด Browser</p>
                  <p className="text-[10px] text-muted-foreground">{loginStep === 'opening' ? 'กำลังเปิด...' : 'พร้อม'}</p>
                </div>
                {/* Line 1→2 */}
                <div className={cn("h-0.5 flex-1 -mt-5 rounded-full transition-all duration-500", loginStep === 'opening' ? "bg-muted" : "bg-green-500")} />
                {/* Step 2 */}
                <div className="flex flex-col items-center flex-1">
                  <div className={cn(
                    "w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300",
                    loginStep === 'opening' ? "border-muted bg-muted/30" :
                    (loginStep === 'waiting' || loginStep === 'checking') ? "border-[#1877F2] bg-blue-50 dark:bg-blue-950/50" :
                    "border-green-500 bg-green-50 dark:bg-green-950/50"
                  )}>
                    {loginStep === 'opening' ? (
                      <LogIn className="w-5 h-5 text-muted-foreground/50" />
                    ) : (loginStep === 'waiting' || loginStep === 'checking') ? (
                      <Loader2 className="w-5 h-5 text-[#1877F2] animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                    )}
                  </div>
                  <p className="text-[11px] font-medium mt-1.5">Login</p>
                  <p className="text-[10px] text-muted-foreground">
                    {loginStep === 'opening' ? 'รอ...' : loginStep === 'checking' ? 'ตรวจสอบ...' : loginStep === 'waiting' ? 'รอ Login' : 'สำเร็จ'}
                  </p>
                </div>
                {/* Line 2→3 */}
                <div className={cn("h-0.5 flex-1 -mt-5 rounded-full transition-all duration-500", loginStep === 'success' ? "bg-green-500" : "bg-muted")} />
                {/* Step 3 */}
                <div className="flex flex-col items-center flex-1">
                  <div className={cn(
                    "w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300",
                    loginStep === 'success' ? "border-green-500 bg-green-50 dark:bg-green-950/50" : "border-muted bg-muted/30"
                  )}>
                    {loginStep === 'success' ? (
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                    ) : (
                      <Wifi className="w-5 h-5 text-muted-foreground/50" />
                    )}
                  </div>
                  <p className="text-[11px] font-medium mt-1.5">เชื่อมต่อ</p>
                  <p className="text-[10px] text-muted-foreground">{loginStep === 'success' ? 'สำเร็จ' : 'รอ...'}</p>
                </div>
              </div>
            )}

            {/* Auto-login form */}
            {(loginStep === 'waiting' || loginStep === 'checking') && (
              <div className="space-y-3 p-4 rounded-2xl bg-gradient-to-b from-blue-50/80 to-white dark:from-blue-950/30 dark:to-background border border-blue-100 dark:border-blue-900/50">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-6 h-6 rounded-lg bg-[#1877F2] flex items-center justify-center"><LogIn className="w-3.5 h-3.5 text-white"/></div>
                  <p className="text-sm font-semibold">Login อัตโนมัติ</p>
                </div>
                <div className="relative">
                  <Facebook className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="email"
                    placeholder="Email หรือเบอร์โทร Facebook"
                    value={fbEmail}
                    onChange={(e) => setFbEmail(e.target.value)}
                    disabled={isAutoLogging}
                    className="pl-10 h-11 rounded-xl border-blue-200 dark:border-blue-800 focus-visible:ring-[#1877F2]"
                  />
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="password"
                    placeholder="Password Facebook"
                    value={fbPassword}
                    onChange={(e) => setFbPassword(e.target.value)}
                    disabled={isAutoLogging}
                    onKeyDown={(e) => e.key === 'Enter' && handleAutoLogin()}
                    className="pl-10 h-11 rounded-xl border-blue-200 dark:border-blue-800 focus-visible:ring-[#1877F2]"
                  />
                </div>
                {loginError && (
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                    <p className="text-xs text-red-600 dark:text-red-400">{loginError}</p>
                  </div>
                )}
                <Button
                  onClick={handleAutoLogin}
                  disabled={!fbEmail || !fbPassword || isAutoLogging}
                  className="w-full h-11 rounded-xl bg-[#1877F2] hover:bg-[#1565C0] text-white font-semibold shadow-lg shadow-blue-500/25 transition-all hover:shadow-blue-500/40"
                >
                  {isAutoLogging ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> กำลัง Login...</>
                  ) : (
                    <><LogIn className="w-4 h-4 mr-2" /> Login Facebook</>
                  )}
                </Button>
                <p className="text-[10px] text-center text-muted-foreground flex items-center justify-center gap-1">
                  <Lock className="w-3 h-3" /> ข้อมูลจะไม่ถูกจัดเก็บ ใช้เพื่อ Login ครั้งเดียวเท่านั้น
                </p>
              </div>
            )}

            {/* Success state */}
            {loginStep === 'success' && (
              <div className="text-center py-2 space-y-3">
                <div className="relative w-16 h-16 mx-auto">
                  {loginProfilePic ? (
                    <img src={loginProfilePic} alt={loginUserName} className="w-16 h-16 rounded-full object-cover ring-4 ring-green-500/30" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center ring-4 ring-green-500/30">
                      <span className="text-white text-xl font-bold">{loginUserName?.charAt(0) || 'F'}</span>
                    </div>
                  )}
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-green-500 border-2 border-white dark:border-gray-900 flex items-center justify-center">
                    <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                  </div>
                </div>
                <div>
                  <p className="text-lg font-bold">{loginUserName}</p>
                  <p className="text-sm text-muted-foreground">เชื่อมต่อ Facebook สำเร็จแล้ว</p>
                </div>
                <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                  <CheckCircle2 className="w-3 h-3 mr-1" /> Session {connectSlot + 1}/{pkgLimits.fbAccounts} ({pkgTheme.label})
                </Badge>
              </div>
            )}

            {/* Error state */}
            {loginStep === 'error' && (
              <div className="text-center py-4 space-y-4">
                <div className="w-16 h-16 mx-auto rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <AlertCircle className="w-8 h-8 text-red-500" />
                </div>
                <div>
                  <p className="font-semibold">ไม่สามารถเชื่อมต่อได้</p>
                  <p className="text-sm text-muted-foreground mt-1">{loginError || 'ไม่สามารถเปิด Browser ได้ ลองใหม่อีกครั้ง'}</p>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 pb-5 flex gap-2">
            {loginStep === 'error' && (
              <Button onClick={() => handleConnectFacebook(connectSlot)} className="flex-1 h-11 rounded-xl bg-[#1877F2] hover:bg-[#1565C0] shadow-lg shadow-blue-500/20">
                <RefreshCw className="w-4 h-4 mr-2" /> ลองใหม่
              </Button>
            )}
            {loginStep === 'success' ? (
              <Button onClick={() => setShowLoginPopup(false)} className="flex-1 h-11 rounded-xl bg-green-600 hover:bg-green-700 shadow-lg shadow-green-500/20">
                <CheckCircle2 className="w-4 h-4 mr-2" /> เสร็จสิ้น
              </Button>
            ) : (
              <Button onClick={handleCloseLoginPopup} variant="outline" className={cn("h-11 rounded-xl", loginStep === 'error' ? "" : "flex-1")}>
                ยกเลิก
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
