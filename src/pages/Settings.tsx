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
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useFacebookConnection } from '@/hooks/useFacebookConnection';
import { getUserPackage, getPackageLimits } from '@/hooks/usePackageLimits';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/i18n/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { useAppTheme, THEME_PALETTES } from '@/hooks/useTheme';
import { useLicenseAuth } from '@/hooks/useLicenseAuth';
import { supabase } from '@/lib/supabase';

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
  const { user: authUser, license: authLicense } = useLicenseAuth();
  const profileFileRef = useRef<HTMLInputElement>(null);

  // Package info
  const pkg = getUserPackage();
  const pkgTheme = PKG_CONFIG[pkg] || PKG_CONFIG.free;
  const pkgLimits = getPackageLimits(pkg);
  const PkgIcon = pkgTheme.icon;

  // Facebook connection
  const {
    isConnected,
    isConnecting,
    isChecking,
    user,
    connect,
    confirmLogin,
    autoLogin,
    disconnect,
    checkStatus
  } = useFacebookConnection();

  const handleDisconnect = async () => {
    const result = await disconnect();
    if (result.success) {
      toast.info(result.message);
    }
  };

  // Facebook login popup state
  const [showLoginPopup, setShowLoginPopup] = useState(false);
  const [loginStep, setLoginStep] = useState<'opening' | 'waiting' | 'checking' | 'success' | 'error'>('opening');
  const [loginUserName, setLoginUserName] = useState('');
  const loginPollRef = useRef<NodeJS.Timeout | null>(null);
  const pollCountRef = useRef(0);

  // Auto-detect login: poll every 1.5 seconds when popup is open
  useEffect(() => {
    if (showLoginPopup && loginStep === 'waiting' && !loginPollRef.current) {
      pollCountRef.current = 0;
      loginPollRef.current = setInterval(async () => {
        pollCountRef.current++;
        setLoginStep('checking');
        try {
          const result = await confirmLogin();
          if (result.success) {
            // Login detected!
            if (loginPollRef.current) clearInterval(loginPollRef.current);
            loginPollRef.current = null;
            setLoginUserName(result.user?.name || 'Facebook User');
            setLoginStep('success');
            // Auto-close after 2 seconds
            setTimeout(() => {
              setShowLoginPopup(false);
            }, 2000);
          } else {
            setLoginStep('waiting');
          }
        } catch {
          setLoginStep('waiting');
        }
      }, 1500);
    }

    return () => {
      if (loginPollRef.current) {
        clearInterval(loginPollRef.current);
        loginPollRef.current = null;
      }
    };
  }, [showLoginPopup, loginStep, confirmLogin]);

  const [loginError, setLoginError] = useState('');
  const [fbEmail, setFbEmail] = useState('');
  const [fbPassword, setFbPassword] = useState('');
  const [isAutoLogging, setIsAutoLogging] = useState(false);

  const handleConnectFacebook = async () => {
    setLoginStep('opening');
    setShowLoginPopup(true);
    setLoginUserName('');
    setLoginError('');
    setFbEmail('');
    setFbPassword('');

    const result = await connect();
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

  // Profile state — synced with Supabase auth metadata
  const [displayName, setDisplayName] = useState(() => localStorage.getItem('profile_display_name') || '');
  const [lineId, setLineId] = useState(() => localStorage.getItem('profile_line_id') || '');
  const [profileAvatar, setProfileAvatar] = useState(() => localStorage.getItem('profile_avatar') || '');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Load profile from Supabase metadata on mount
  useEffect(() => {
    const loadProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.user_metadata) {
        const meta = user.user_metadata;
        if (meta.display_name) { setDisplayName(meta.display_name); localStorage.setItem('profile_display_name', meta.display_name); }
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
    if (!newPassword || !confirmNewPassword) {
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
    setIsChangingPassword(true);
    try {
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
    try {
      // Save to Supabase auth metadata
      const { error } = await supabase.auth.updateUser({
        data: { display_name: displayName, line_id: lineId }
      });
      if (error) throw error;

      // Save to localStorage for fast access
      localStorage.setItem('profile_display_name', displayName);
      localStorage.setItem('profile_line_id', lineId);
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

  const handleExportData = () => {
    const data = {
      profile: { name: displayName, lineId },
      properties: JSON.parse(localStorage.getItem('properties') || '[]'),
      groups: JSON.parse(localStorage.getItem('groups') || '[]'),
      postHistory: JSON.parse(localStorage.getItem('healthcheck_post_history') || '[]'),
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
  };

  return (
    <DashboardLayout title={t.settings.title} subtitle={t.settings.subtitle}>
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Package Banner */}
        <div className={cn('relative overflow-hidden rounded-2xl bg-gradient-to-r p-5', pkgTheme.gradient)}>
          <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <PkgIcon className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
              </div>
              <div>
                <p className="text-white/70 text-xs font-medium uppercase tracking-wider">{s.currentPackage}</p>
                <p className="text-white text-lg sm:text-xl font-bold">{pkgTheme.label}</p>
                <p className="text-white/70 text-xs sm:text-sm">{pkgTheme.desc}</p>
              </div>
            </div>
            <div className="flex flex-col items-start sm:items-end gap-2 w-full sm:w-auto">
              <div className="flex items-center gap-3">
                <div className="text-left sm:text-right">
                  <p className="text-white/60 text-[10px] uppercase">{s.postsPerDay}</p>
                  <p className="text-white font-bold text-base sm:text-lg">{pkgLimits.postsPerDay}</p>
                </div>
                <div className="w-px h-8 bg-white/20" />
                <div className="text-left sm:text-right">
                  <p className="text-white/60 text-[10px] uppercase">{s.groupsLabel}</p>
                  <p className="text-white font-bold text-base sm:text-lg">{pkgLimits.maxGroups}</p>
                </div>
                <div className="w-px h-8 bg-white/20" />
                <div className="text-left sm:text-right">
                  <p className="text-white/60 text-[10px] uppercase">{s.propertiesLabel}</p>
                  <p className="text-white font-bold text-base sm:text-lg">{pkgLimits.maxProperties === Infinity ? '∞' : pkgLimits.maxProperties}</p>
                </div>
              </div>
              {pkg !== 'elite' && (
                <Button
                  size="sm"
                  className="bg-white/20 hover:bg-white/30 text-white border-white/30 text-xs"
                  variant="outline"
                  onClick={() => navigate('/pricing')}
                >
                  {s.upgrade} <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
              )}
            </div>
          </div>
          {/* Decorative circles */}
          <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/10" />
          <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full bg-white/5" />
        </div>

        {/* Account Info */}
        {authUser && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Key className="w-4 h-4" />
                {isEn ? 'Account' : 'บัญชีผู้ใช้'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{isEn ? 'Email' : 'อีเมล'}</p>
                  <p className="text-sm font-medium">{authUser.email}</p>
                </div>
                {authUser.user_metadata?.full_name && (
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">{isEn ? 'Name' : 'ชื่อ'}</p>
                    <p className="text-sm font-medium">{authUser.user_metadata.full_name}</p>
                  </div>
                )}
              </div>
              {authLicense && (
                <div className="flex items-center justify-between pt-2 border-t">
                  <div>
                    <p className="text-xs text-muted-foreground">License Key</p>
                    <p className="text-sm font-mono">{authLicense.licenseKey}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">{isEn ? 'Expires' : 'หมดอายุ'}</p>
                    <p className="text-sm">{authLicense.expiresAt.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Change Password */}
        {authUser && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Lock className="w-4 h-4" />
                {isEn ? 'Change Password' : 'เปลี่ยนรหัสผ่าน'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label>{isEn ? 'New Password' : 'รหัสผ่านใหม่'}</Label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={isEn ? 'At least 6 characters' : 'อย่างน้อย 6 ตัวอักษร'}
                />
              </div>
              <div className="space-y-2">
                <Label>{isEn ? 'Confirm New Password' : 'ยืนยันรหัสผ่านใหม่'}</Label>
                <Input
                  type="password"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  placeholder={isEn ? 'Confirm new password' : 'กรอกรหัสผ่านใหม่อีกครั้ง'}
                />
              </div>
              <Button
                onClick={handleChangePassword}
                disabled={isChangingPassword || !newPassword || !confirmNewPassword}
                className="w-full"
              >
                {isChangingPassword ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{isEn ? 'Changing...' : 'กำลังเปลี่ยน...'}</>
                ) : (
                  <><Lock className="w-4 h-4 mr-2" />{isEn ? 'Change Password' : 'เปลี่ยนรหัสผ่าน'}</>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Profile Settings */}
        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5 text-accent" />
              {isEn ? 'Profile' : 'โปรไฟล์'}
            </CardTitle>
            <CardDescription>
              {isEn ? 'Your display name and contact info — synced to cloud' : 'ชื่อแสดงผลและช่องทางติดต่อ — ซิงค์กับระบบ'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-4">
              <Avatar className="w-20 h-20 cursor-pointer" onClick={() => profileFileRef.current?.click()}>
                <AvatarImage src={profileAvatar} />
                <AvatarFallback className="bg-primary text-primary-foreground text-xl">
                  {displayName ? displayName.split(' ').map(n => n[0]).join('').substring(0, 2) : 'U'}
                </AvatarFallback>
              </Avatar>
              <div>
                <Button variant="outline" size="sm" onClick={() => profileFileRef.current?.click()}>
                  <Camera className="w-4 h-4 mr-2" />
                  {t.settings.changeAvatar}
                </Button>
                <input
                  ref={profileFileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleProfileImageUpload(e.target.files)}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{isEn ? 'Display Name' : 'ชื่อที่แสดง'}</Label>
                <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder={isEn ? 'Your name' : 'ชื่อของคุณ'} />
              </div>
              <div className="space-y-2">
                <Label>Line ID</Label>
                <Input value={lineId} onChange={(e) => setLineId(e.target.value)} placeholder="@yourlineid" />
              </div>
            </div>
            {authUser?.email && (
              <p className="text-xs text-muted-foreground">{isEn ? 'Login email' : 'อีเมลที่ใช้เข้าสู่ระบบ'}: {authUser.email}</p>
            )}
          </CardContent>
        </Card>

        {/* Facebook Connection — World-class UI */}
        <Card className={cn(
          "card-elevated overflow-hidden transition-all",
          isConnected && "ring-1 ring-green-500/30"
        )}>
          {/* Card gradient accent bar */}
          <div className={cn("h-1 transition-all", isConnected ? "bg-gradient-to-r from-green-400 to-emerald-500" : "bg-gradient-to-r from-[#1877F2] to-[#0D47A1]")} />
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[#1877F2] flex items-center justify-center">
                    <Facebook className="w-4.5 h-4.5 text-white" />
                  </div>
                  {t.settings.facebookConnection}
                </CardTitle>
                <CardDescription className="mt-1">
                  {t.settings.facebookDesc}
                </CardDescription>
              </div>
              {/* Session Slots Indicator */}
              <div className="text-right">
                <div className="flex items-center gap-1 justify-end">
                  {Array.from({ length: pkgLimits.fbAccounts }, (_, i) => (
                    <div key={i} className={cn(
                      "w-3 h-3 rounded-full border-2 transition-all",
                      i < (isConnected ? 1 : 0)
                        ? "bg-green-500 border-green-500 shadow-sm shadow-green-500/30"
                        : "border-muted-foreground/30 bg-transparent"
                    )} />
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">{isConnected ? 1 : 0}/{pkgLimits.fbAccounts} sessions ({pkgTheme.label})</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Connection Status */}
            {isChecking ? (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-muted/50">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                <p className="text-sm font-medium text-muted-foreground">{t.settings.checking}</p>
              </div>
            ) : isConnected ? (
              <div className="p-4 rounded-xl bg-gradient-to-r from-green-50 to-emerald-50/50 dark:from-green-950/20 dark:to-emerald-950/10 border border-green-200 dark:border-green-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {/* Profile Avatar */}
                    <div className="relative">
                      <div className={cn(
                        "w-12 h-12 rounded-full flex items-center justify-center overflow-hidden ring-2 ring-green-500/30",
                        !user?.profilePic && "bg-gradient-to-br from-blue-500 to-blue-600"
                      )}>
                        {user?.profilePic ? (
                          <img src={user.profilePic} alt={user?.name || 'FB'} className="w-12 h-12 rounded-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        ) : (
                          <span className="text-white text-lg font-bold">{user?.name?.charAt(0) || 'F'}</span>
                        )}
                      </div>
                      <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-green-500 border-2 border-white dark:border-gray-900 flex items-center justify-center">
                        <Check className="w-2.5 h-2.5 text-white" />
                      </div>
                    </div>
                    {/* User Info */}
                    <div>
                      <p className="font-semibold text-sm">{user?.name || 'Facebook User'}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Badge className="bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 text-[10px] h-5 px-1.5">
                          <CheckCircle2 className="w-3 h-3 mr-0.5" /> {t.settings.connected}
                        </Badge>
                        {user?.connectedAt && (
                          <span className="text-[10px] text-muted-foreground">{new Date(user.connectedAt).toLocaleDateString('th-TH')}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  {/* Disconnect */}
                  <Button variant="ghost" size="sm" onClick={handleDisconnect} className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 h-8 px-2.5">
                    <Unlink className="w-3.5 h-3.5 mr-1.5" />
                    <span className="text-xs">{t.settings.disconnect}</span>
                  </Button>
                </div>
              </div>
            ) : (
              /* Not Connected — Beautiful connect CTA */
              <div className="space-y-3">
                {isConnecting ? (
                  <div className="p-4 rounded-xl bg-gradient-to-b from-blue-50 to-white dark:from-blue-950/20 dark:to-background border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center gap-3 mb-2">
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
                        onClick={handleConnectFacebook}
                        className="w-full h-11 rounded-xl bg-gradient-to-r from-[#1877F2] to-[#0D47A1] hover:from-[#1565C0] hover:to-[#0B3D91] text-white font-semibold shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 transition-all"
                      >
                        <Facebook className="w-4 h-4 mr-2" />
                        {t.settings.connectFacebook}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Session Slots Detail */}
            <div className="p-3 rounded-xl bg-muted/40 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium flex items-center gap-1.5"><Monitor className="w-3.5 h-3.5" /> FB Sessions</p>
                <Badge variant="outline" className="text-[10px] h-5">{pkgTheme.label}</Badge>
              </div>
              <div className="flex gap-2">
                {Array.from({ length: pkgLimits.fbAccounts }, (_, i) => {
                  const isActive = i < (isConnected ? 1 : 0);
                  return (
                    <div key={i} className={cn(
                      "flex-1 p-2 rounded-lg border text-center transition-all",
                      isActive
                        ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800"
                        : "bg-background border-dashed border-muted-foreground/20"
                    )}>
                      <div className={cn("w-5 h-5 mx-auto rounded-full flex items-center justify-center mb-1", isActive ? "bg-green-500" : "bg-muted")}>
                        {isActive ? <Check className="w-3 h-3 text-white" /> : <Facebook className="w-3 h-3 text-muted-foreground/50" />}
                      </div>
                      <p className="text-[10px] font-medium">{isActive ? 'Active' : 'ว่าง'}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Info */}
            <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/30 text-xs">
              <Info className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
              <p className="text-muted-foreground leading-relaxed">
                {t.settings.connectionInfo} แพ็คเกจ {pkgTheme.label} รองรับ {pkgLimits.fbAccounts} FB session{pkgLimits.fbAccounts > 1 ? 's' : ''}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Theme & Appearance */}
        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="w-5 h-5 text-accent" />
              {s.themeSettings || 'ธีมและการแสดงผล'}
            </CardTitle>
            <CardDescription>
              {s.themeSettingsDesc || 'เลือกโทนสีที่เหมาะกับสไตล์ของคุณ'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Dark Mode Toggle */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
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
          </CardContent>
        </Card>

        {/* App Version */}
        <div className="flex items-center justify-center gap-2 py-4 text-xs text-muted-foreground">
          <Info className="w-3 h-3" />
          <span>{s.appVersion}: Grand$tate v1.0.0</span>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button variant="accent" onClick={handleSave}>
            {t.common.saveChanges}
          </Button>
        </div>
      </div>

      {/* Facebook Login Dialog — World-class UI */}
      <Dialog open={showLoginPopup} onOpenChange={(open) => { if (!open) handleCloseLoginPopup(); }}>
        <DialogContent className="sm:max-w-[440px] p-0 overflow-hidden border-0 shadow-2xl">
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
                  {loginStep === 'success' ? `ยินดีต้อนรับ ${loginUserName}` : loginStep === 'error' ? 'ไม่สามารถเชื่อมต่อได้' : `Session ${1}/${pkgLimits.fbAccounts} — ${pkgTheme.label}`}
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
                    "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300",
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
                    "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300",
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
                    "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300",
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
                <div className="w-16 h-16 mx-auto rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-green-500" />
                </div>
                <div>
                  <p className="text-lg font-bold">{loginUserName}</p>
                  <p className="text-sm text-muted-foreground">เชื่อมต่อ Facebook สำเร็จแล้ว</p>
                </div>
                <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                  <CheckCircle2 className="w-3 h-3 mr-1" /> Session 1/{pkgLimits.fbAccounts} ({pkgTheme.label})
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
              <Button onClick={handleConnectFacebook} className="flex-1 h-11 rounded-xl bg-[#1877F2] hover:bg-[#1565C0] shadow-lg shadow-blue-500/20">
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
