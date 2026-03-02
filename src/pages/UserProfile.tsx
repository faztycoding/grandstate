import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    User,
    Key,
    Package,
    Calendar,
    Monitor,
    Clock,
    Crown,
    Star,
    Rocket,
    Settings,
    Bell,
    Shield,
    CreditCard,
    History,
    ChevronRight,
    LogOut,
    Trash2,
    Check,
    AlertCircle,
    Zap,
    Eye,
    EyeOff
} from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { useLicenseAuth, LicenseInfo } from '@/hooks/useLicenseAuth';
import { useUserProfile } from '@/hooks/useUserProfile';
import { PACKAGE_LIMITS } from '@/hooks/usePackageLimits';
import { supabase } from '@/lib/supabase';
import { apiFetch } from '@/lib/config';
import { cn } from '@/lib/utils';
import { isAdminEmail } from '@/lib/config';
import { DashboardLayout } from '@/components/layout/DashboardLayout';

const packageInfo = {
    admin: {
        name: 'Admin',
        icon: Shield,
        color: 'text-red-600',
        bgColor: 'bg-red-100',
        gradient: 'from-red-600 to-rose-500'
    },
    free: {
        name: 'Rookie',
        icon: Rocket,
        color: 'text-emerald-600',
        bgColor: 'bg-emerald-100',
        gradient: 'from-emerald-500 to-teal-500'
    },
    agent: {
        name: 'Top Agent',
        icon: Star,
        color: 'text-amber-600',
        bgColor: 'bg-amber-100',
        gradient: 'from-amber-500 to-orange-500'
    },
    elite: {
        name: 'Elite',
        icon: Crown,
        color: 'text-purple-600',
        bgColor: 'bg-purple-100',
        gradient: 'from-purple-500 to-pink-500'
    },
};

export default function UserProfile() {
    const navigate = useNavigate();
    const { user, license, logout, currentPackage, limits } = useLicenseAuth();
    const { displayId } = useUserProfile(user?.id);
    const isAdmin = isAdminEmail(user?.email);
    const [adminKeyRevealed, setAdminKeyRevealed] = useState(false);
    const [lightningStrike, setLightningStrike] = useState(false);
    // Usage stats from backend
    const [usageStats, setUsageStats] = useState({
        postsToday: 0,
        groupsUsed: 0,
        propertiesUsed: 0,
    });

    const pkgKey = isAdmin ? 'admin' : currentPackage;
    const pkg = packageInfo[pkgKey as keyof typeof packageInfo] || packageInfo.free;
    const PkgIcon = pkg.icon;
    const pkgLimits = isAdmin
        ? { postsPerDay: 9999, maxGroups: 9999, maxProperties: 9999 }
        : (PACKAGE_LIMITS[currentPackage as keyof typeof PACKAGE_LIMITS] || PACKAGE_LIMITS.free);

    useEffect(() => {
        // Fetch stats for admin (even without license) and licensed users
        if (license || isAdmin) {
            fetchUsageStats();
        }
    }, [license, isAdmin]);

    const fetchUsageStats = async () => {
        try {
            const res = await apiFetch('/api/user/real-stats');
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = await res.json();
            if (json.success) {
                setUsageStats({
                    postsToday: json.postsToday ?? 0,
                    groupsUsed: json.groupsCount ?? 0,
                    propertiesUsed: json.propertiesCount ?? 0,
                });
            }
        } catch (err) {
            console.warn('Failed to fetch usage stats:', err);
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('th-TH', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    };

    const formatRelativeTime = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'เมื่อสักครู่';
        if (diffMins < 60) return `${diffMins} นาทีที่แล้ว`;
        if (diffHours < 24) return `${diffHours} ชั่วโมงที่แล้ว`;
        if (diffDays < 30) return `${diffDays} วันที่แล้ว`;
        return formatDate(dateString);
    };

    // Admin users get a virtual license if they don't have one
    const effectiveLicense: LicenseInfo | null = license || (isAdmin ? {
        id: 'admin',
        licenseKey: 'ADMIN-ACCESS',
        package: 'elite' as const,
        maxFbSessions: 99,
        ownerName: user?.user_metadata?.full_name || user?.email || 'Admin',
        expiresAt: new Date(Date.now() + 365 * 86400000),
        isActive: true,
    } : null);

    const getDaysRemaining = () => {
        if (!effectiveLicense?.expiresAt) return 0;
        const now = new Date();
        const expiry = new Date(effectiveLicense.expiresAt);
        const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / 86400000);
        return Math.max(0, diffDays);
    };

    const daysRemaining = getDaysRemaining();
    const isExpiringSoon = daysRemaining <= 7 && daysRemaining > 0;
    const isExpired = daysRemaining <= 0;

    const handleLogout = async () => {
        await logout();
        navigate('/auth?logout=true');
    };

    if (!effectiveLicense) {
        return (
            <DashboardLayout title="โปรไฟล์ผู้ใช้" subtitle="ข้อมูลบัญชีและแพ็กเกจ">
                <div className="rounded-2xl border border-border bg-card p-8 text-center">
                    <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">กรุณาเข้าสู่ระบบ</p>
                    <Button onClick={() => navigate('/auth')} className="mt-4">
                        เข้าสู่ระบบ
                    </Button>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout title="โปรไฟล์ผู้ใช้" subtitle="ติดตามแพ็กเกจ ใบอนุญาต และการใช้งาน">
            <div className="max-w-5xl mx-auto space-y-6">
                {/* Profile Header */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    <Card className="overflow-hidden">
                        <div className={cn(
                            'h-24 bg-gradient-to-r',
                            pkg.gradient,
                            isAdmin && 'admin-gradient-animated admin-shimmer'
                        )} />
                        <CardContent className="relative pt-0">
                            <div className="flex flex-col md:flex-row md:items-end gap-4 -mt-12">
                                <div className={cn(
                                    'w-20 h-20 rounded-2xl flex items-center justify-center shadow-lg',
                                    pkg.bgColor,
                                    isAdmin && 'admin-pulse-ring'
                                )}>
                                    <PkgIcon className={cn('w-10 h-10', pkg.color, isAdmin && 'admin-shield-glow')} />
                                </div>
                                <div className="flex-1 pb-2">
                                    <div className="flex items-center gap-2">
                                        <h2 className="text-2xl font-bold">{pkg.name}</h2>
                                        <Badge className={cn(pkg.bgColor, pkg.color, isAdmin && 'admin-pulse-ring')}>
                                            {isAdmin ? 'ADMIN' : currentPackage.toUpperCase()}
                                        </Badge>
                                    </div>
                                    <p className="text-muted-foreground">
                                        {effectiveLicense.ownerName || 'ผู้ใช้งาน GrandState'}
                                    </p>
                                    {displayId && (
                                        <div className="flex items-center gap-1.5 mt-1">
                                            <span className="text-[10px] text-muted-foreground/70 uppercase tracking-wider">User ID</span>
                                            <code className="text-xs font-mono font-bold bg-accent/10 text-accent px-2 py-0.5 rounded-md">{displayId}</code>
                                        </div>
                                    )}
                                </div>
                                <Button variant="outline" onClick={() => navigate('/pricing')}>
                                    <Crown className="w-4 h-4 mr-2" />
                                    อัปเกรด
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>

                {/* License Info */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                >
                    {isAdmin ? (
                        /* ═══ ADMIN: ADMINISTRATOR LICENSE ═══ */
                        <Card className="overflow-hidden border-red-500/20">
                            <CardHeader className="bg-gradient-to-r from-red-950/80 via-rose-950/60 to-red-950/80 border-b border-red-500/20">
                                <CardTitle className="flex items-center gap-2 text-red-400">
                                    <Shield className="w-5 h-5 admin-shield-glow" />
                                    ADMINISTRATOR LICENSE
                                    <Badge className="ml-auto bg-red-500/20 text-red-300 border-red-500/30 text-[10px]">
                                        <Zap className="w-3 h-3 mr-0.5" /> SUPREME ACCESS
                                    </Badge>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-5 space-y-5">
                                {/* License Key Field with Lightning Border */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                                            <Key className="w-3.5 h-3.5" /> License Key
                                        </p>
                                        <button
                                            className="p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-all"
                                            onClick={() => {
                                                if (!adminKeyRevealed) {
                                                    setLightningStrike(true);
                                                    setTimeout(() => {
                                                        setAdminKeyRevealed(true);
                                                        setLightningStrike(false);
                                                    }, 600);
                                                } else {
                                                    setAdminKeyRevealed(false);
                                                }
                                            }}
                                        >
                                            {adminKeyRevealed ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                    <div className="relative">
                                        {/* Lightning bolt strike overlay */}
                                        <AnimatePresence>
                                            {lightningStrike && (
                                                <motion.div
                                                    className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none"
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    exit={{ opacity: 0 }}
                                                >
                                                    {/* Central bolt */}
                                                    <motion.div
                                                        className="absolute inset-0 bg-gradient-to-b from-red-500/40 via-transparent to-red-500/40 rounded-xl"
                                                        initial={{ opacity: 0 }}
                                                        animate={{ opacity: [0, 1, 0.3, 1, 0] }}
                                                        transition={{ duration: 0.6, times: [0, 0.1, 0.2, 0.3, 0.6] }}
                                                    />
                                                    {/* Lightning SVG */}
                                                    <motion.svg
                                                        viewBox="0 0 100 120"
                                                        className="absolute w-16 h-20 text-red-400"
                                                        initial={{ opacity: 0, scaleY: 0 }}
                                                        animate={{ opacity: [0, 1, 0.4, 1, 0], scaleY: [0, 1, 1, 1, 1] }}
                                                        transition={{ duration: 0.6, times: [0, 0.12, 0.25, 0.4, 0.6] }}
                                                    >
                                                        <path d="M55 0 L35 50 L50 50 L30 120 L75 45 L55 45 Z" fill="currentColor" opacity="0.9" />
                                                    </motion.svg>
                                                    {/* Spark particles */}
                                                    {[...Array(8)].map((_, i) => (
                                                        <motion.div
                                                            key={i}
                                                            className="absolute w-1 h-1 bg-red-400 rounded-full"
                                                            initial={{ opacity: 1, x: 0, y: 0, scale: 1 }}
                                                            animate={{
                                                                opacity: 0,
                                                                x: (Math.random() - 0.5) * 120,
                                                                y: (Math.random() - 0.5) * 80,
                                                                scale: 0,
                                                            }}
                                                            transition={{ duration: 0.5, delay: 0.1 + i * 0.03 }}
                                                        />
                                                    ))}
                                                </motion.div>
                                            )}
                                        </AnimatePresence>

                                        {/* License key display box */}
                                        <div className={cn(
                                            'relative rounded-xl px-4 py-3 font-mono text-lg tracking-wider bg-gradient-to-r from-red-950/50 via-rose-950/30 to-red-950/50',
                                            'admin-license-border'
                                        )}>
                                            {/* Small crackling sparks on border */}
                                            <div className="absolute -top-0.5 left-[20%] w-1 h-1 bg-red-400 rounded-full animate-ping opacity-40" />
                                            <div className="absolute -bottom-0.5 right-[30%] w-0.5 h-0.5 bg-orange-400 rounded-full animate-ping opacity-30" style={{ animationDelay: '1s' }} />
                                            <div className="absolute top-[50%] -right-0.5 w-0.5 h-0.5 bg-red-300 rounded-full animate-ping opacity-30" style={{ animationDelay: '2s' }} />
                                            <div className="absolute top-[50%] -left-0.5 w-1 h-1 bg-orange-400 rounded-full animate-ping opacity-25" style={{ animationDelay: '0.5s' }} />

                                            <div className="flex items-center justify-between">
                                                {adminKeyRevealed ? (
                                                    <motion.span
                                                        className="text-red-300 font-bold admin-electric-reveal"
                                                        key="revealed"
                                                    >
                                                        ADMIN-SUPREME-ACCESS
                                                    </motion.span>
                                                ) : (
                                                    <span className="text-muted-foreground">
                                                        {'•'.repeat(24)}
                                                    </span>
                                                )}
                                                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px] ml-3">
                                                    Active
                                                </Badge>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Admin License Details */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-3 rounded-xl bg-red-950/30 border border-red-500/10">
                                        <p className="text-[10px] text-red-400/60 uppercase tracking-wider mb-1">สถานะ</p>
                                        <p className="text-sm font-bold text-emerald-400 flex items-center gap-1.5">
                                            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                                            Permanent Active
                                        </p>
                                    </div>
                                    <div className="p-3 rounded-xl bg-red-950/30 border border-red-500/10">
                                        <p className="text-[10px] text-red-400/60 uppercase tracking-wider mb-1">หมดอายุ</p>
                                        <p className="text-sm font-bold text-red-300 flex items-center gap-1.5">
                                            <Zap className="w-3.5 h-3.5" /> ไม่มีวันหมดอายุ
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ) : (
                        /* ═══ Normal User: Standard License ═══ */
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Key className="w-5 h-5" />
                                    ข้อมูล License
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex flex-wrap gap-6">
                                    <div>
                                        <p className="text-sm text-muted-foreground">License Key</p>
                                        <code className="text-lg font-mono bg-muted px-3 py-1 rounded-lg">
                                            {effectiveLicense.licenseKey}
                                        </code>
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">วันหมดอายุ</p>
                                        <p className={cn(
                                            'text-lg font-semibold',
                                            isExpired && 'text-red-500',
                                            isExpiringSoon && 'text-amber-500'
                                        )}>
                                            {formatDate(effectiveLicense.expiresAt.toString())}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">เหลืออีก</p>
                                        <p className={cn(
                                            'text-lg font-semibold',
                                            isExpired && 'text-red-500',
                                            isExpiringSoon && 'text-amber-500'
                                        )}>
                                            {isExpired ? 'หมดอายุแล้ว' : `${daysRemaining} วัน`}
                                        </p>
                                    </div>
                                </div>

                                {(isExpired || isExpiringSoon) && (
                                    <div className={cn(
                                        'p-4 rounded-lg flex items-center gap-3',
                                        isExpired ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
                                    )}>
                                        <AlertCircle className="w-5 h-5" />
                                        <div className="flex-1">
                                            <p className="font-medium">
                                                {isExpired ? 'License หมดอายุแล้ว' : 'License ใกล้หมดอายุ'}
                                            </p>
                                            <p className="text-sm opacity-80">
                                                {isExpired
                                                    ? 'กรุณาต่ออายุเพื่อใช้งานต่อ'
                                                    : `เหลืออีก ${daysRemaining} วัน กรุณาต่ออายุก่อนหมด`
                                                }
                                            </p>
                                        </div>
                                        <Button
                                            size="sm"
                                            className={cn(
                                                isExpired
                                                    ? 'bg-red-500 hover:bg-red-600'
                                                    : 'bg-amber-500 hover:bg-amber-600'
                                            )}
                                            onClick={() => navigate('/pricing')}
                                        >
                                            ต่ออายุ
                                        </Button>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}
                </motion.div>

                {/* Usage Stats */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                >
                    <Card className={isAdmin ? 'border-red-500/10' : ''}>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Package className="w-5 h-5" />
                                {isAdmin ? 'โควต้าการใช้งาน' : 'การใช้งานวันนี้'}
                                {isAdmin && (
                                    <Badge className="ml-auto bg-red-500/15 text-red-400 border-red-500/20 text-[10px] gap-1">
                                        <Zap className="w-3 h-3" /> UNLIMITED
                                    </Badge>
                                )}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span>โพสต์วันนี้</span>
                                        <span className="font-medium">
                                            {isAdmin ? (
                                                <>{usageStats.postsToday} / <span className="text-red-400">∞</span></>
                                            ) : (
                                                <>{usageStats.postsToday} / {pkgLimits.postsPerDay}</>
                                            )}
                                        </span>
                                    </div>
                                    <Progress
                                        value={isAdmin ? Math.min(usageStats.postsToday * 0.5, 30) : (usageStats.postsToday / pkgLimits.postsPerDay) * 100}
                                        className={cn('h-2', isAdmin && '[&>div]:bg-gradient-to-r [&>div]:from-red-500 [&>div]:to-rose-500')}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span>กลุ่มที่ใช้</span>
                                        <span className="font-medium">
                                            {isAdmin ? (
                                                <>{usageStats.groupsUsed} / <span className="text-red-400">∞</span></>
                                            ) : (
                                                <>{usageStats.groupsUsed} / {pkgLimits.maxGroups}</>
                                            )}
                                        </span>
                                    </div>
                                    <Progress
                                        value={isAdmin ? Math.min(usageStats.groupsUsed * 0.5, 30) : (usageStats.groupsUsed / pkgLimits.maxGroups) * 100}
                                        className={cn('h-2', isAdmin && '[&>div]:bg-gradient-to-r [&>div]:from-red-500 [&>div]:to-rose-500')}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span>สินทรัพย์</span>
                                        <span className="font-medium">
                                            {isAdmin ? (
                                                <>{usageStats.propertiesUsed} / <span className="text-red-400">∞</span></>
                                            ) : (
                                                <>{usageStats.propertiesUsed} / {pkgLimits.maxProperties === Infinity ? '∞' : pkgLimits.maxProperties}</>
                                            )}
                                        </span>
                                    </div>
                                    <Progress
                                        value={isAdmin ? Math.min(usageStats.propertiesUsed * 0.5, 30) : (pkgLimits.maxProperties === Infinity ? 10 : (usageStats.propertiesUsed / pkgLimits.maxProperties) * 100)}
                                        className={cn('h-2', isAdmin && '[&>div]:bg-gradient-to-r [&>div]:from-red-500 [&>div]:to-rose-500')}
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>

                {/* FB Session Info */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                >
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Monitor className="w-5 h-5" />
                                Facebook Sessions (สูงสุด {effectiveLicense.maxFbSessions} บัญชี)
                            </CardTitle>
                            <CardDescription>
                                แพ็คเกจของคุณรองรับ Facebook ได้ {effectiveLicense.maxFbSessions} บัญชีพร้อมกัน — login จากเครื่องไหนก็ได้ไม่จำกัด
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center gap-3 p-4 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900">
                                    <Monitor className="w-5 h-5 text-blue-600" />
                                </div>
                                <div>
                                    <p className="font-medium text-sm">เข้าใช้งานจากเครื่องไหนก็ได้</p>
                                    <p className="text-xs text-muted-foreground">
                                        ไม่จำกัดจำนวนอุปกรณ์ — จำกัดเฉพาะ Facebook session ({effectiveLicense.maxFbSessions} บัญชี)
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>

                {/* Quick Actions */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                >
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Settings className="w-5 h-5" />
                                การตั้งค่า
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <Button
                                variant="ghost"
                                className="w-full justify-between h-12"
                                onClick={() => navigate('/pricing')}
                            >
                                <div className="flex items-center gap-3">
                                    <CreditCard className="w-5 h-5" />
                                    <span>แพ็คเกจและการชำระเงิน</span>
                                </div>
                                <ChevronRight className="w-5 h-5" />
                            </Button>
                            <Separator />
                            <Button
                                variant="ghost"
                                className="w-full justify-between h-12 text-red-500 hover:text-red-700 hover:bg-red-50"
                                onClick={handleLogout}
                            >
                                <div className="flex items-center gap-3">
                                    <LogOut className="w-5 h-5" />
                                    <span>ออกจากระบบ</span>
                                </div>
                                <ChevronRight className="w-5 h-5" />
                            </Button>
                        </CardContent>
                    </Card>
                </motion.div>
            </div>
        </DashboardLayout>
    );
}
