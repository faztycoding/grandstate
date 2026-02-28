import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Key,
    Package,
    Monitor,
    Crown,
    Star,
    Rocket,
    CreditCard,
    LogOut,
    Trash2,
    Check,
    AlertCircle,
    User,
    Clock,
    Edit,
    Camera,
    Eye,
    EyeOff,
    Save,
    X,
    Facebook,
    Activity,
    ArrowUpCircle,
    Loader2,
    Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useLicenseAuth } from '@/hooks/useLicenseAuth';
import { useFacebookConnection } from '@/hooks/useFacebookConnection';
import { PACKAGE_LIMITS } from '@/hooks/usePackageLimits';
import { supabase } from '@/lib/supabase';
import { apiFetch } from '@/lib/config';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { LevelUpEffect } from './LevelUpEffect';
import { ExpiredLicensePopup } from './ExpiredLicensePopup';


const packageInfo = {
    free: {
        name: 'Rookie',
        icon: Rocket,
        color: 'text-emerald-600',
        bgColor: 'bg-emerald-100',
        gradient: 'from-emerald-500 to-teal-500',
        limit: 20
    },
    agent: {
        name: 'Top Agent',
        icon: Star,
        color: 'text-amber-600',
        bgColor: 'bg-amber-100',
        gradient: 'from-amber-500 to-orange-500',
        limit: 300
    },
    elite: {
        name: 'Elite',
        icon: Crown,
        color: 'text-purple-600',
        bgColor: 'bg-purple-100',
        gradient: 'from-purple-500 to-pink-500',
        limit: 750
    },
};

interface ProfileDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function ProfileDialog({ open, onOpenChange }: ProfileDialogProps) {
    const navigate = useNavigate();
    const { license, logout, currentPackage, user: authUser, activateLicense, isValidating } = useLicenseAuth();
    const { user: fbUser, isConnected: isFbConnected } = useFacebookConnection();

    // Profile State
    const [profileName, setProfileName] = useState('');
    const [profileAvatar, setProfileAvatar] = useState('');
    const [isEditingName, setIsEditingName] = useState(false);
    const [tempName, setTempName] = useState('');
    const [showLicense, setShowLicense] = useState(false);

    // License Activation State (for Rookies)
    const [licenseKeyInput, setLicenseKeyInput] = useState('');
    const [activationError, setActivationError] = useState('');

    // Level Up Effect State
    const [showLevelUp, setShowLevelUp] = useState(false);
    const [levelUpRank, setLevelUpRank] = useState<'free' | 'agent' | 'elite'>('free');
    const [levelUpName, setLevelUpName] = useState('');
    const [levelUpExpiry, setLevelUpExpiry] = useState('');

    // Expired License Popup State
    const [showExpiredPopup, setShowExpiredPopup] = useState(false);

    // Usage Stats
    const [postedToday, setPostedToday] = useState(0);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const pkg = packageInfo[currentPackage as keyof typeof packageInfo] || packageInfo.free;
    const PkgIcon = pkg.icon;
    const limit = pkg.limit;

    const isRookie = !license || currentPackage === 'free';
    const hasLicense = !!license;

    useEffect(() => {
        if (open) {
            // Load profile data — check localStorage first, then Supabase metadata, then license
            const savedName = localStorage.getItem('profile_display_name') || localStorage.getItem('profile_name') || '';
            const savedAvatar = localStorage.getItem('profile_avatar') || '';
            setProfileName(savedName);
            setProfileAvatar(savedAvatar);

            // Determine best fallback name and sync to localStorage if needed
            const supabaseName = authUser?.user_metadata?.full_name || '';
            const fallbackName = savedName || supabaseName || license?.ownerName || '';
            if (!savedName && fallbackName) {
                // Sync the best name we have to localStorage so Header picks it up
                localStorage.setItem('profile_display_name', fallbackName);
                setProfileName(fallbackName);
                window.dispatchEvent(new Event('profile-updated'));
            }
            setTempName(fallbackName || savedName);

            // Reset activation state
            setLicenseKeyInput('');
            setActivationError('');

            // Fetch usage stats
            fetchUsageStats();

            // Check expired license
            if (license?.expiresAt) {
                const now = new Date();
                const expiry = new Date(license.expiresAt);
                if (expiry <= now) {
                    const expiredShownKey = `expired_popup_shown_${license.id}`;
                    if (!sessionStorage.getItem(expiredShownKey)) {
                        sessionStorage.setItem(expiredShownKey, 'true');
                        setTimeout(() => setShowExpiredPopup(true), 500);
                    }
                }
            }
        }
    }, [open, license]);

    const fetchUsageStats = async () => {
        try {
            const response = await apiFetch(`/api/posting/today?userPackage=${currentPackage}`);
            if (!response.ok) return;
            const data = await response.json();
            if (data.success) {
                setPostedToday(data.postedToday || 0);
            }
        } catch {
            // Silent — usage stats are non-critical
        }
    };

    // --- License Activation Handler ---
    const handleActivateLicense = async () => {
        if (!licenseKeyInput.trim()) {
            setActivationError('กรุณาใส่ License Key');
            return;
        }
        setActivationError('');

        const result = await activateLicense(licenseKeyInput.trim());
        if (result.valid && result.license) {
            // Trigger level-up effect
            setLevelUpRank(result.license.package);
            setLevelUpName(result.license.ownerName || '');
            setLevelUpExpiry(result.license.expiresAt.toString());
            setShowLevelUp(true);
            setLicenseKeyInput('');
        } else {
            setActivationError(result.error || 'License Key ไม่ถูกต้อง');
        }
    };

    const handleLevelUpComplete = useCallback(() => {
        setShowLevelUp(false);
    }, []);


    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('th-TH', {
            year: 'numeric', month: 'long', day: 'numeric',
        });
    };

    const getDaysRemaining = () => {
        if (!license?.expiresAt) return 0;
        const now = new Date();
        const expiry = new Date(license.expiresAt);
        const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / 86400000);
        return Math.max(0, diffDays);
    };

    const daysRemaining = getDaysRemaining();
    const isExpiringSoon = daysRemaining <= 7 && daysRemaining > 0;
    const isExpired = hasLicense && daysRemaining <= 0;

    const handleLogout = async () => {
        if (!confirm('ยืนยันออกจากระบบ?')) return;
        await logout();
        navigate('/auth?logout=true');
    };

    // --- Profile Editing Handlers ---

    const handleNameSave = async () => {
        if (!tempName.trim()) {
            toast.error('กรุณาระบุชื่อ');
            return;
        }
        const trimmed = tempName.trim();
        setProfileName(trimmed);
        localStorage.setItem('profile_display_name', trimmed);
        window.dispatchEvent(new Event('profile-updated'));
        setIsEditingName(false);
        toast.success('บันทึกชื่อเรียบร้อย');

        // Persist to Supabase user_metadata so name survives across devices/browsers
        try {
            await supabase.auth.updateUser({ data: { full_name: trimmed } });
        } catch {
            // Silent — localStorage is the primary store, Supabase is backup
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleNameSave();
        if (e.key === 'Escape') {
            setTempName(profileName);
            setIsEditingName(false);
        }
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64 = reader.result as string;
                setProfileAvatar(base64);
                localStorage.setItem('profile_avatar', base64);
                window.dispatchEvent(new Event('profile-updated'));
                toast.success('อัปเดตรูปโปรไฟล์เรียบร้อย');
            };
            reader.readAsDataURL(file);
        }
    };

    const triggerFileInput = () => {
        fileInputRef.current?.click();
    };

    // --- Display Logic ---
    const displayName = profileName || license?.ownerName || fbUser?.name || authUser?.user_metadata?.full_name || authUser?.email?.split('@')[0] || 'User';
    const displayAvatar = profileAvatar || fbUser?.profilePic || '';
    const initials = displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

    const usagePercent = Math.min(100, (postedToday / limit) * 100);

    const maxFbSessions = license?.maxFbSessions || 1;

    return (
        <>
            {/* Level Up Effect (fullscreen overlay) */}
            <LevelUpEffect
                show={showLevelUp}
                rank={levelUpRank}
                ownerName={levelUpName}
                expiresAt={levelUpExpiry}
                onComplete={handleLevelUpComplete}
            />

            {/* Expired License Popup (fullscreen overlay) */}
            <ExpiredLicensePopup
                show={showExpiredPopup}
                userId={authUser?.id}
                onClose={() => setShowExpiredPopup(false)}
            />

            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-xl max-h-[90vh] w-[calc(100vw-2rem)] sm:w-full p-0 gap-0 overflow-hidden border-none shadow-2xl">
                    {/* Hidden File Input */}
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept="image/*"
                        onChange={handleImageUpload}
                    />

                    {/* Header Banner */}
                    <div className={cn('bg-gradient-to-r px-4 py-4 sm:p-6 relative', pkg.gradient)}>
                        <div className="flex items-center gap-4">
                            {/* Avatar with Camera Overlay */}
                            <div className={cn(
                                'w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center shadow-xl border-3 border-white dark:border-zinc-900 overflow-hidden bg-white relative group cursor-pointer flex-shrink-0',
                                pkg.bgColor
                            )} onClick={triggerFileInput}>
                                {displayAvatar ? (
                                    <img src={displayAvatar} alt="Profile" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="flex items-center justify-center w-full h-full text-xl sm:text-2xl font-bold opacity-50 text-slate-500">
                                        {initials}
                                    </div>
                                )}

                                {/* Edit Overlay (Hover + Click) */}
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <Camera className="w-5 h-5 text-white drop-shadow-md" />
                                </div>
                            </div>

                            {/* Name & Package Info */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1 min-h-[28px]">
                                    {isEditingName ? (
                                        <div className="flex items-center gap-2 w-full animate-in fade-in zoom-in-95 duration-200">
                                            <Input
                                                value={tempName}
                                                onChange={(e) => setTempName(e.target.value)}
                                                onKeyDown={handleKeyDown}
                                                className="h-8 text-sm sm:text-lg font-bold bg-white/90 backdrop-blur shadow-sm"
                                                autoFocus
                                                placeholder="ชื่อของคุณ..."
                                            />
                                            <Button size="icon" variant="secondary" className="h-8 w-8 text-green-600 shadow-sm" onClick={handleNameSave}>
                                                <Check className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2 group cursor-pointer" onClick={() => {
                                            setTempName(displayName);
                                            setIsEditingName(true);
                                        }}>
                                            <h2 className="text-lg sm:text-xl font-bold truncate text-white drop-shadow-md">{displayName}</h2>
                                            <Edit className="w-4 h-4 text-white/80 group-hover:text-white transition-colors flex-shrink-0" />
                                        </div>
                                    )}
                                </div>

                                <Badge variant="secondary" className="bg-white/20 text-white hover:bg-white/30 border-none backdrop-blur-md shadow-sm text-xs">
                                    <PkgIcon className="w-3 h-3 mr-1" />
                                    {pkg.name} | {currentPackage.toUpperCase()}
                                </Badge>
                                {authUser?.email && (
                                    <p className="text-white/70 text-xs mt-1 truncate">{authUser.email}</p>
                                )}
                            </div>

                            {/* Logout Button */}
                            <Button
                                variant="ghost"
                                size="icon"
                                className="text-white hover:bg-white/20 flex-shrink-0"
                                onClick={handleLogout}
                                title="ออกจากระบบ"
                            >
                                <LogOut className="w-5 h-5" />
                            </Button>
                        </div>
                    </div>

                    <ScrollArea className="h-full max-h-[calc(90vh-140px)] bg-zinc-50/50 dark:bg-zinc-900/50">
                        <div className="p-4 sm:p-6 space-y-5 sm:space-y-6">

                            {/* Usage Stats Section */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="font-semibold flex items-center gap-2 text-foreground/80">
                                        <Activity className="w-4 h-4 text-primary" />
                                        โควต้าโพสต์วันนี้
                                    </span>
                                    <span className="text-muted-foreground">{postedToday} / {limit}</span>
                                </div>
                                <Progress value={usagePercent} className="h-2" />
                                <p className="text-xs text-muted-foreground text-right">เหลืออีก {Math.max(0, limit - postedToday)} โพสต์</p>
                            </div>

                            <Separator />

                            {/* Status Cards Grid */}
                            <div className="grid grid-cols-1 gap-4">

                                {/* ═══ License Section ═══ */}
                                {hasLicense ? (
                                    /* Paid user: show license info */
                                    <div className="p-4 rounded-xl border bg-card text-card-foreground shadow-sm space-y-3">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2 text-muted-foreground">
                                                <Key className="w-4 h-4" />
                                                <span className="text-sm font-medium">License Key</span>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                                onClick={() => setShowLicense(!showLicense)}
                                            >
                                                {showLicense ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                            </Button>
                                        </div>
                                        <div className="flex items-center justify-between bg-muted/50 p-2 rounded-lg">
                                            <code className="text-sm font-mono block truncate text-foreground/90">
                                                {showLicense ? license.licenseKey : '••••••••-••••••••-••••••••-••••••••'}
                                            </code>
                                            <div className="flex items-center gap-2">
                                                <span className={cn(
                                                    "text-xs px-2 py-0.5 rounded-full font-medium",
                                                    isExpired ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
                                                        isExpiringSoon ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
                                                            "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                                                )}>
                                                    {isExpired ? "Expired" : "Active"}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                                            <span>หมดอายุ: {formatDate(license.expiresAt.toString())}</span>
                                            <span className={cn(
                                                isExpired && "text-red-500 font-semibold",
                                                isExpiringSoon && "text-amber-500 font-semibold"
                                            )}>
                                                ({isExpired ? 'หมดอายุแล้ว' : `${daysRemaining} วัน`})
                                            </span>
                                        </div>
                                        {/* Expired warning inline */}
                                        {isExpired && (
                                            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
                                                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                                                <p className="text-xs text-red-600 dark:text-red-400">
                                                    License หมดอายุแล้ว กรุณาติดต่อผู้ดูแลระบบเพื่อต่ออายุ
                                                </p>
                                            </div>
                                        )}
                                        {isExpiringSoon && !isExpired && (
                                            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                                                <Clock className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                                                <p className="text-xs text-amber-600 dark:text-amber-400">
                                                    License จะหมดอายุใน {daysRemaining} วัน กรุณาต่ออายุก่อนหมด
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    /* Rookie: show license key input to upgrade */
                                    <div className="p-4 rounded-xl border-2 border-dashed border-primary/30 bg-gradient-to-br from-primary/5 to-accent/5 space-y-3">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                                                <ArrowUpCircle className="w-4 h-4 text-white" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold">อัพเกรดแพ็คเกจ</p>
                                                <p className="text-[10px] text-muted-foreground">ใส่ License Key เพื่อปลดล็อคความสามารถเต็มรูปแบบ</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <Input
                                                value={licenseKeyInput}
                                                onChange={(e) => { setLicenseKeyInput(e.target.value); setActivationError(''); }}
                                                placeholder="GSXXX-XXXXX-XXXXX-XXXXX"
                                                className="flex-1 font-mono text-sm h-10"
                                                onKeyDown={(e) => { if (e.key === 'Enter') handleActivateLicense(); }}
                                            />
                                            <Button
                                                onClick={handleActivateLicense}
                                                disabled={isValidating || !licenseKeyInput.trim()}
                                                className="h-10 px-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
                                            >
                                                {isValidating ? (
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                ) : (
                                                    <Sparkles className="w-4 h-4" />
                                                )}
                                            </Button>
                                        </div>
                                        {activationError && (
                                            <p className="text-xs text-red-500 flex items-center gap-1">
                                                <AlertCircle className="w-3 h-3" />
                                                {activationError}
                                            </p>
                                        )}
                                        <p className="text-[10px] text-muted-foreground">
                                            ยังไม่มี License Key? ติดต่อผู้ดูแลระบบ หรือดูแพ็คเกจที่{' '}
                                            <button onClick={() => { onOpenChange(false); navigate('/pricing'); }} className="text-primary underline underline-offset-2">
                                                หน้าราคา
                                            </button>
                                        </p>
                                    </div>
                                )}

                                {/* Facebook Status Card */}
                                <div className="p-4 rounded-xl border bg-card text-card-foreground shadow-sm flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={cn("p-2 rounded-full", isFbConnected ? "bg-blue-100 text-blue-600" : "bg-zinc-100 text-zinc-500")}>
                                            <Facebook className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium">Facebook Account</p>
                                            <p className="text-xs text-muted-foreground">
                                                {isFbConnected ? (fbUser?.name || 'Connected') : 'ยังไม่ได้เชื่อมต่อ'}
                                            </p>
                                        </div>
                                    </div>
                                    <Button variant="outline" size="sm" onClick={() => { onOpenChange(false); navigate('/settings'); }}>
                                        {isFbConnected ? 'ตั้งค่า' : 'เชื่อมต่อ'}
                                    </Button>
                                </div>
                            </div>

                            {/* FB Session Limit */}
                            <div className="space-y-3 pt-2">
                                <h3 className="font-semibold flex items-center gap-2 text-sm text-foreground/80">
                                    <Facebook className="w-4 h-4" />
                                    Facebook Sessions (สูงสุด {maxFbSessions} บัญชี)
                                </h3>
                                <p className="text-xs text-muted-foreground">
                                    แพ็คเกจของคุณรองรับ Facebook ได้ {maxFbSessions} บัญชีพร้อมกัน
                                    — login จากเครื่องไหนก็ได้ไม่จำกัด
                                </p>
                            </div>
                        </div>
                    </ScrollArea>

                    {/* Footer Action */}
                    <div className="p-3 sm:p-4 border-t bg-background">
                        <Button
                            className="w-full font-bold text-sm sm:text-md h-10 sm:h-12 shadow-sm active:scale-[0.98] transition-transform"
                            onClick={() => onOpenChange(false)}
                        >
                            <Check className="w-5 h-5 mr-2" />
                            บันทึกข้อมูล
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
