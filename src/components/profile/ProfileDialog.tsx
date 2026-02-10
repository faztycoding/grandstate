import { useState, useEffect, useRef } from 'react';
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
    Activity
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
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';


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
    const { license, logout, currentPackage } = useLicenseAuth();
    const { user: fbUser, isConnected: isFbConnected } = useFacebookConnection();

    // Profile State
    const [profileName, setProfileName] = useState('');
    const [profileAvatar, setProfileAvatar] = useState('');
    const [isEditingName, setIsEditingName] = useState(false);
    const [tempName, setTempName] = useState('');
    const [showLicense, setShowLicense] = useState(false);

    // Usage Stats
    const [postedToday, setPostedToday] = useState(0);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const pkg = packageInfo[currentPackage as keyof typeof packageInfo] || packageInfo.free;
    const PkgIcon = pkg.icon;
    const limit = pkg.limit;

    useEffect(() => {
        if (open) {
            // Load profile data
            const savedName = localStorage.getItem('profile_name') || '';
            const savedAvatar = localStorage.getItem('profile_avatar') || '';
            setProfileName(savedName);
            setProfileAvatar(savedAvatar);

            // Check if name is empty, default to license owner
            if (!savedName && license?.ownerName) {
                setTempName(license.ownerName);
            } else {
                setTempName(savedName);
            }

            // Fetch usage stats (or mock for now if API not ready, but we should try API)
            fetchUsageStats();
        }
    }, [open, license]);

    const fetchUsageStats = async () => {
        try {
            // Try to fetch from backend if available
            const response = await fetch(`/api/posting/today?userPackage=${currentPackage}`);
            const data = await response.json();
            if (data.success) {
                setPostedToday(data.postedToday || 0);
            }
        } catch (e) {
            // Fallback to minimal mock if offline/error
            console.error("Failed to fetch stats", e);
        }
    };


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
    const isExpired = daysRemaining <= 0;

    const handleLogout = async () => {
        if (!confirm('ยืนยันออกจากระบบ?')) return;
        await logout();
        navigate('/auth?logout=true');
    };

    // --- Profile Editing Handlers ---

    const handleNameSave = () => {
        if (!tempName.trim()) {
            toast.error('กรุณาระบุชื่อ');
            return;
        }
        setProfileName(tempName);
        localStorage.setItem('profile_name', tempName);
        window.dispatchEvent(new Event('profile-updated')); // Sync with Header
        setIsEditingName(false);
        toast.success('บันทึกชื่อเรียบร้อย');
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
                window.dispatchEvent(new Event('profile-updated')); // Sync with Header
                toast.success('อัปเดตรูปโปรไฟล์เรียบร้อย');
            };
            reader.readAsDataURL(file);
        }
    };

    const triggerFileInput = () => {
        fileInputRef.current?.click();
    };

    // --- Display Logic ---
    const displayName = profileName || license?.ownerName || fbUser?.name || 'User';
    const displayAvatar = profileAvatar || fbUser?.profilePic || '';
    const initials = displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

    const usagePercent = Math.min(100, (postedToday / limit) * 100);

    if (!license) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-xl max-h-[90vh] p-0 gap-0 overflow-hidden border-none shadow-2xl">
                {/* Hidden File Input */}
                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={handleImageUpload}
                />

                {/* Header Banner */}
                <div className={cn('h-36 bg-gradient-to-r p-6 relative', pkg.gradient)}>
                    <div className="absolute -bottom-10 left-6 flex items-end gap-5">
                        {/* Avatar with Camera Overlay */}
                        <div className={cn(
                            'w-28 h-28 rounded-full flex items-center justify-center shadow-xl border-4 border-white dark:border-zinc-900 overflow-hidden bg-white relative group cursor-pointer',
                            pkg.bgColor
                        )} onClick={triggerFileInput}>
                            {displayAvatar ? (
                                <img src={displayAvatar} alt="Profile" className="w-full h-full object-cover" />
                            ) : (
                                <div className="flex items-center justify-center w-full h-full text-3xl font-bold opacity-50 text-slate-500">
                                    {initials}
                                </div>
                            )}

                            {/* Edit Overlay (Hover + Click) */}
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <Camera className="w-8 h-8 text-white drop-shadow-md" />
                            </div>
                        </div>

                        {/* Name & Package Info */}
                        <div className="pb-2 w-full max-w-[300px]">
                            <div className="flex items-center gap-2 mb-1 min-h-[32px]">
                                {isEditingName ? (
                                    <div className="flex items-center gap-2 w-full animate-in fade-in zoom-in-95 duration-200">
                                        <Input
                                            value={tempName}
                                            onChange={(e) => setTempName(e.target.value)}
                                            onKeyDown={handleKeyDown}
                                            className="h-8 text-lg font-bold bg-white/90 backdrop-blur shadow-sm"
                                            autoFocus
                                            placeholder="ชื่อของคุณ..."
                                        />
                                        <Button size="icon" variant="secondary" className="h-8 w-8 text-green-600 shadow-sm" onClick={handleNameSave}>
                                            <Check className="w-4 h-4" />
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 group cursor-pointer py-1" onClick={() => {
                                        setTempName(displayName);
                                        setIsEditingName(true);
                                    }}>
                                        <h2 className="text-2xl font-bold truncate max-w-[200px] text-white drop-shadow-md">{displayName}</h2>
                                        <Edit className="w-4 h-4 text-white/80 group-hover:text-white transition-colors opacity-0 group-hover:opacity-100" />
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center gap-2">
                                <Badge variant="secondary" className="bg-white/20 text-white hover:bg-white/30 border-none backdrop-blur-md shadow-sm">
                                    <PkgIcon className="w-3 h-3 mr-1" />
                                    {pkg.name} | {currentPackage.toUpperCase()}
                                </Badge>
                            </div>
                        </div>
                    </div>

                    {/* Logout Button (Top Right) */}
                    <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-4 right-4 text-white hover:bg-white/20"
                        onClick={handleLogout}
                        title="ออกจากระบบ"
                    >
                        <LogOut className="w-5 h-5" />
                    </Button>
                </div>

                <ScrollArea className="h-full max-h-[calc(90vh-140px)] pt-14 bg-zinc-50/50 dark:bg-zinc-900/50">
                    <div className="p-6 space-y-6">

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
                            {/* License Card */}
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
                                            isExpired ? "bg-red-100 text-red-700" :
                                                isExpiringSoon ? "bg-amber-100 text-amber-700" :
                                                    "bg-emerald-100 text-emerald-700"
                                        )}>
                                            {isExpired ? "Expired" : "Active"}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                                    <span>หมดอายุ: {formatDate(license.expiresAt.toString())}</span>
                                    <span>({daysRemaining} วัน)</span>
                                </div>
                            </div>

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
                                <Button variant="outline" size="sm" onClick={() => navigate('/settings')}>
                                    {isFbConnected ? 'ตั้งค่า' : 'เชื่อมต่อ'}
                                </Button>
                            </div>
                        </div>

                        {/* FB Session Limit */}
                        <div className="space-y-3 pt-2">
                            <h3 className="font-semibold flex items-center gap-2 text-sm text-foreground/80">
                                <Facebook className="w-4 h-4" />
                                Facebook Sessions (สูงสุด {license.maxFbSessions} บัญชี)
                            </h3>
                            <p className="text-xs text-muted-foreground">
                                แพ็คเกจของคุณรองรับ Facebook ได้ {license.maxFbSessions} บัญชีพร้อมกัน
                                — login จากเครื่องไหนก็ได้ไม่จำกัด
                            </p>
                        </div>
                    </div>
                </ScrollArea>

                {/* Footer Action */}
                <div className="p-4 border-t bg-background">
                    <Button
                        className="w-full font-bold text-md h-12 shadow-sm active:scale-[0.98] transition-transform"
                        onClick={() => onOpenChange(false)}
                    >
                        <Check className="w-5 h-5 mr-2" />
                        บันทึกข้อมูล
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
