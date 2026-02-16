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

  // Profile state
  const [profileName, setProfileName] = useState(() => localStorage.getItem('profile_name') || '');
  const [profileEmail, setProfileEmail] = useState(() => localStorage.getItem('profile_email') || '');
  const [profileAvatar, setProfileAvatar] = useState(() => localStorage.getItem('profile_avatar') || '');

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

  const handleSave = () => {
    localStorage.setItem('profile_name', profileName);
    localStorage.setItem('profile_email', profileEmail);
    localStorage.removeItem('claudeApiKey');
    localStorage.setItem('defaultBrowser', defaultBrowser);
    window.dispatchEvent(new Event('profile-updated'));
    toast.success(t.common.success);
  };

  const handleClearHistory = () => {
    localStorage.removeItem('healthcheck_post_history');
    localStorage.removeItem('healthcheck_first_post_date');
    toast.success(s.resetConfirm);
  };

  const handleExportData = () => {
    const data = {
      profile: { name: profileName, email: profileEmail },
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
              {t.settings.profile}
            </CardTitle>
            <CardDescription>
              {t.settings.profileDesc}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-4">
              <Avatar className="w-20 h-20 cursor-pointer" onClick={() => profileFileRef.current?.click()}>
                <AvatarImage src={profileAvatar} />
                <AvatarFallback className="bg-primary text-primary-foreground text-xl">
                  {profileName ? profileName.split(' ').map(n => n[0]).join('') : 'U'}
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
                <Label>{t.settings.fullName}</Label>
                <Input value={profileName} onChange={(e) => setProfileName(e.target.value)} placeholder={t.settings.fullName} />
              </div>
              <div className="space-y-2">
                <Label>{t.settings.email}</Label>
                <Input type="email" value={profileEmail} onChange={(e) => setProfileEmail(e.target.value)} placeholder="email@example.com" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Facebook Connection */}
        <Card className={cn(
          "card-elevated transition-all",
          isConnected && "border-green-500/50"
        )}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Facebook className="w-5 h-5 text-[#1877F2]" />
              {t.settings.facebookConnection}
            </CardTitle>
            <CardDescription>
              {t.settings.facebookDesc}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Connection Status */}
            <div className={cn(
              "p-4 rounded-xl border-2 transition-all",
              isConnected
                ? "bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800"
                : "bg-muted border-transparent"
            )}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {/* Avatar/Icon */}
                  <div className={cn(
                    "w-14 h-14 rounded-full flex items-center justify-center overflow-hidden",
                    isConnected
                      ? (user?.profilePic ? "" : "bg-gradient-to-br from-blue-500 to-blue-600")
                      : "bg-[#1877F2]"
                  )}>
                    {isConnected && user?.profilePic ? (
                      <img
                        src={user.profilePic}
                        alt={user?.name || 'FB'}
                        className="w-14 h-14 rounded-full object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    ) : isConnected ? (
                      <span className="text-white text-xl font-bold">
                        {user?.name?.charAt(0) || 'F'}
                      </span>
                    ) : (
                      <Facebook className="w-7 h-7 text-white" />
                    )}
                  </div>

                  {/* Info */}
                  <div>
                    {isChecking ? (
                      <>
                        <div className="flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <p className="font-medium">{t.settings.checking}</p>
                        </div>
                      </>
                    ) : isConnected ? (
                      <>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-5 h-5 text-green-600" />
                          <p className="font-semibold text-green-700 dark:text-green-400">{t.settings.connected}</p>
                        </div>
                        <p className="text-sm font-medium mt-0.5">{user?.name || 'Facebook User'}</p>
                        {user?.connectedAt && (
                          <p className="text-xs text-muted-foreground">
                            {t.settings.connectedAt}: {new Date(user.connectedAt).toLocaleDateString()}
                          </p>
                        )}
                      </>
                    ) : (
                      <>
                        <p className="font-medium text-muted-foreground">{t.settings.notConnected}</p>
                        <p className="text-sm text-muted-foreground">{t.settings.clickToConnect}</p>
                      </>
                    )}
                  </div>
                </div>

                {/* Action Button */}
                {!isChecking && (
                  <div>
                    {isConnected ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleDisconnect}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Unlink className="w-4 h-4 mr-2" />
                        {t.settings.disconnect}
                      </Button>
                    ) : null}
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            {!isConnected && !isChecking && (
              <div className="space-y-3">
                {isConnecting ? (
                  <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center gap-3 mb-3">
                      <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                      <p className="font-medium text-blue-700 dark:text-blue-400">{t.settings.waitingLogin}</p>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      {t.settings.loginInstructions}
                    </p>
                    <p className="text-xs text-blue-600 dark:text-blue-400 animate-pulse">
                      🔄 {t.settings.autoDetect}
                    </p>
                  </div>
                ) : (
                  <Button
                    onClick={handleConnectFacebook}
                    className="w-full h-12 bg-[#1877F2] hover:bg-[#166FE5] text-white"
                    size="lg"
                  >
                    <Facebook className="w-5 h-5 mr-2" />
                    {t.settings.connectFacebook}
                  </Button>
                )}
              </div>
            )}

            {/* Info */}
            <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 text-sm">
              <AlertCircle className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
              <p className="text-muted-foreground">
                {t.settings.connectionInfo}
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

      {/* Facebook Login Dialog */}
      <Dialog open={showLoginPopup} onOpenChange={(open) => { if (!open) handleCloseLoginPopup(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Facebook className="w-5 h-5 text-[#1877F2]" />
              เชื่อมต่อ Facebook
            </DialogTitle>
            <DialogDescription>
              {loginStep === 'success' ? 'เชื่อมต่อสำเร็จแล้ว!' : 'กรุณา Login ในหน้าต่าง Browser ที่เปิดขึ้น'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Step 1: Opening browser */}
            <div className={cn(
              "flex items-center gap-3 p-3 rounded-lg border transition-all",
              loginStep === 'opening'
                ? "bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800"
                : "bg-muted/30 border-transparent"
            )}>
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                loginStep === 'opening' ? "bg-blue-100 dark:bg-blue-900" : "bg-green-100 dark:bg-green-900"
              )}>
                {loginStep === 'opening' ? (
                  <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                )}
              </div>
              <div>
                <p className="font-medium text-sm">เปิด Browser</p>
                <p className="text-xs text-muted-foreground">
                  {loginStep === 'opening' ? 'กำลังเปิด...' : 'เปิดแล้ว ✓'}
                </p>
              </div>
            </div>

            {/* Step 2: Waiting for login */}
            <div className={cn(
              "flex items-center gap-3 p-3 rounded-lg border transition-all",
              (loginStep === 'waiting' || loginStep === 'checking')
                ? "bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800"
                : loginStep === 'success' ? "bg-muted/30 border-transparent" : "bg-muted/30 border-transparent"
            )}>
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                (loginStep === 'waiting' || loginStep === 'checking') ? "bg-blue-100 dark:bg-blue-900" :
                  loginStep === 'success' ? "bg-green-100 dark:bg-green-900" : "bg-muted"
              )}>
                {loginStep === 'opening' ? (
                  <LogIn className="w-4 h-4 text-muted-foreground" />
                ) : (loginStep === 'waiting' || loginStep === 'checking') ? (
                  <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                ) : loginStep === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                ) : (
                  <LogIn className="w-4 h-4 text-muted-foreground" />
                )}
              </div>
              <div>
                <p className="font-medium text-sm">Login Facebook</p>
                <p className="text-xs text-muted-foreground">
                  {loginStep === 'opening' ? 'รอเปิด Browser...' :
                    loginStep === 'checking' ? 'กำลังตรวจสอบ...' :
                      loginStep === 'waiting' ? 'รอ Login ใน Browser...' :
                        loginStep === 'success' ? 'Login สำเร็จ ✓' : 'รอ Login...'}
                </p>
              </div>
            </div>

            {/* Step 3: Connection result */}
            <div className={cn(
              "flex items-center gap-3 p-3 rounded-lg border transition-all",
              loginStep === 'success'
                ? "bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800"
                : "bg-muted/30 border-transparent"
            )}>
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                loginStep === 'success' ? "bg-green-100 dark:bg-green-900" : "bg-muted"
              )}>
                {loginStep === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                ) : (
                  <Wifi className="w-4 h-4 text-muted-foreground" />
                )}
              </div>
              <div>
                <p className="font-medium text-sm">เชื่อมต่อสำเร็จ</p>
                <p className="text-xs text-muted-foreground">
                  {loginStep === 'success'
                    ? `เชื่อมต่อเป็น ${loginUserName} ✓`
                    : 'รอตรวจสอบการเชื่อมต่อ...'}
                </p>
              </div>
            </div>

            {/* Auto-login form (VPS headless) */}
            {(loginStep === 'waiting' || loginStep === 'checking') && (
              <div className="space-y-3 p-3 rounded-lg border border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-800">
                <p className="text-xs font-medium text-blue-700 dark:text-blue-400">🔑 กรอก Facebook เพื่อ Login อัตโนมัติ</p>
                <Input
                  type="email"
                  placeholder="Email หรือเบอร์โทร Facebook"
                  value={fbEmail}
                  onChange={(e) => setFbEmail(e.target.value)}
                  disabled={isAutoLogging}
                />
                <Input
                  type="password"
                  placeholder="Password Facebook"
                  value={fbPassword}
                  onChange={(e) => setFbPassword(e.target.value)}
                  disabled={isAutoLogging}
                  onKeyDown={(e) => e.key === 'Enter' && handleAutoLogin()}
                />
                {loginError && (
                  <p className="text-xs text-red-600">{loginError}</p>
                )}
                <Button
                  onClick={handleAutoLogin}
                  disabled={!fbEmail || !fbPassword || isAutoLogging}
                  className="w-full bg-[#1877F2] hover:bg-[#166FE5]"
                >
                  {isAutoLogging ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> กำลัง Login...</>
                  ) : (
                    <><LogIn className="w-4 h-4 mr-2" /> Login Facebook</>
                  )}
                </Button>
                <p className="text-[10px] text-muted-foreground text-center">🔒 ข้อมูลจะไม่ถูกจัดเก็บ ใช้เพื่อ Login ครั้งเดียวเท่านั้น</p>
              </div>
            )}

            {/* Error state */}
            {loginStep === 'error' && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-red-50 border border-red-200 dark:bg-red-950/30 dark:border-red-800">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                <div>
                  <p className="font-medium text-sm text-red-700 dark:text-red-400">เกิดข้อผิดพลาด</p>
                  <p className="text-xs text-muted-foreground">{loginError || 'ไม่สามารถเปิด Browser ได้ ลองใหม่อีกครั้ง'}</p>
                </div>
              </div>
            )}
          </div>

          {/* Footer buttons */}
          <div className="flex justify-end gap-2">
            {loginStep === 'error' && (
              <Button onClick={handleConnectFacebook} variant="default" className="bg-[#1877F2] hover:bg-[#166FE5]">
                <RefreshCw className="w-4 h-4 mr-2" />
                ลองใหม่
              </Button>
            )}
            {loginStep === 'success' && (
              <Button onClick={() => setShowLoginPopup(false)} variant="default" className="bg-green-600 hover:bg-green-700">
                <CheckCircle2 className="w-4 h-4 mr-2" />
                เสร็จสิ้น
              </Button>
            )}
            {(loginStep !== 'success') && (
              <Button onClick={handleCloseLoginPopup} variant="outline">
                ยกเลิก
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
