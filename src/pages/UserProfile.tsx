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
    AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { useLicenseAuth, LicenseInfo } from '@/hooks/useLicenseAuth';
import { PACKAGE_LIMITS } from '@/hooks/usePackageLimits';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

interface DeviceInfo {
    id: string;
    device_id: string;
    device_name: string;
    activated_at: string;
    last_seen: string;
    is_current: boolean;
}

interface SubscriptionHistoryItem {
    id: string;
    action: string;
    package: string;
    amount: number;
    date: string;
}

const packageInfo = {
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
    const { license, logout, currentPackage, limits } = useLicenseAuth();
    const [devices, setDevices] = useState<DeviceInfo[]>([]);
    const [isLoadingDevices, setIsLoadingDevices] = useState(true);
    const [subscriptionHistory, setSubscriptionHistory] = useState<SubscriptionHistoryItem[]>([]);

    // Usage stats (mock - would come from actual usage tracking)
    const [usageStats, setUsageStats] = useState({
        postsToday: 0,
        groupsUsed: 0,
        propertiesUsed: 0,
    });

    const pkg = packageInfo[currentPackage as keyof typeof packageInfo] || packageInfo.free;
    const PkgIcon = pkg.icon;
    const pkgLimits = PACKAGE_LIMITS[currentPackage as keyof typeof PACKAGE_LIMITS] || PACKAGE_LIMITS.free;

    useEffect(() => {
        if (license) {
            fetchDevices();
            fetchUsageStats();
        }
    }, [license]);

    const fetchDevices = async () => {
        if (!license) return;

        setIsLoadingDevices(true);
        try {
            const { data, error } = await supabase
                .from('device_activations')
                .select('*')
                .eq('license_key_id', license.id)
                .order('activated_at', { ascending: false });

            if (error) throw error;

            const currentDeviceId = localStorage.getItem('gstate_device_id');
            const devicesWithCurrent = (data || []).map(d => ({
                ...d,
                is_current: d.device_id === currentDeviceId,
            }));

            setDevices(devicesWithCurrent);
        } catch (error) {
            console.error('Error fetching devices:', error);
        } finally {
            setIsLoadingDevices(false);
        }
    };

    const fetchUsageStats = async () => {
        // In a real app, this would fetch from a usage tracking table
        // For now, we'll use mock data
        setUsageStats({
            postsToday: Math.floor(Math.random() * (pkgLimits.postsPerDay * 0.7)),
            groupsUsed: Math.floor(Math.random() * (pkgLimits.maxGroups * 0.8)),
            propertiesUsed: Math.floor(Math.random() * 10),
        });
    };

    const removeDevice = async (deviceId: string) => {
        if (!license) return;
        if (!confirm('ต้องการลบอุปกรณ์นี้หรือไม่?')) return;

        try {
            const { error } = await supabase
                .from('device_activations')
                .delete()
                .eq('license_key_id', license.id)
                .eq('device_id', deviceId);

            if (error) throw error;

            toast.success('ลบอุปกรณ์แล้ว');
            fetchDevices();
        } catch (error) {
            toast.error('ไม่สามารถลบอุปกรณ์ได้');
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
        await logout();
        navigate('/auth?logout=true');
    };

    if (!license) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">กรุณาเข้าสู่ระบบ</p>
                    <Button onClick={() => navigate('/auth')} className="mt-4">
                        เข้าสู่ระบบ
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 p-6">
            <div className="max-w-4xl mx-auto space-y-6">
                {/* Profile Header */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    <Card className="overflow-hidden">
                        <div className={cn(
                            'h-24 bg-gradient-to-r',
                            pkg.gradient
                        )} />
                        <CardContent className="relative pt-0">
                            <div className="flex flex-col md:flex-row md:items-end gap-4 -mt-12">
                                <div className={cn(
                                    'w-20 h-20 rounded-2xl flex items-center justify-center shadow-lg',
                                    pkg.bgColor
                                )}>
                                    <PkgIcon className={cn('w-10 h-10', pkg.color)} />
                                </div>
                                <div className="flex-1 pb-2">
                                    <div className="flex items-center gap-2">
                                        <h2 className="text-2xl font-bold">{pkg.name}</h2>
                                        <Badge className={cn(pkg.bgColor, pkg.color)}>
                                            {currentPackage.toUpperCase()}
                                        </Badge>
                                    </div>
                                    <p className="text-muted-foreground">
                                        {license.ownerName || 'ผู้ใช้งาน Grand$tate'}
                                    </p>
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
                                        {license.licenseKey}
                                    </code>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">วันหมดอายุ</p>
                                    <p className={cn(
                                        'text-lg font-semibold',
                                        isExpired && 'text-red-500',
                                        isExpiringSoon && 'text-amber-500'
                                    )}>
                                        {formatDate(license.expiresAt.toString())}
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
                </motion.div>

                {/* Usage Stats */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                >
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Package className="w-5 h-5" />
                                การใช้งานวันนี้
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span>โพสต์วันนี้</span>
                                        <span className="font-medium">
                                            {usageStats.postsToday} / {pkgLimits.postsPerDay}
                                        </span>
                                    </div>
                                    <Progress
                                        value={(usageStats.postsToday / pkgLimits.postsPerDay) * 100}
                                        className="h-2"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span>กลุ่มที่ใช้</span>
                                        <span className="font-medium">
                                            {usageStats.groupsUsed} / {pkgLimits.maxGroups}
                                        </span>
                                    </div>
                                    <Progress
                                        value={(usageStats.groupsUsed / pkgLimits.maxGroups) * 100}
                                        className="h-2"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span>สินทรัพย์</span>
                                        <span className="font-medium">
                                            {usageStats.propertiesUsed} / {pkgLimits.maxProperties === Infinity ? '∞' : pkgLimits.maxProperties}
                                        </span>
                                    </div>
                                    <Progress
                                        value={pkgLimits.maxProperties === Infinity
                                            ? 10
                                            : (usageStats.propertiesUsed / pkgLimits.maxProperties) * 100
                                        }
                                        className="h-2"
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>

                {/* Device Management */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                >
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Monitor className="w-5 h-5" />
                                อุปกรณ์ที่เชื่อมต่อ ({devices.length}/{license.maxDevices})
                            </CardTitle>
                            <CardDescription>
                                จัดการอุปกรณ์ที่ใช้งาน License นี้
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {isLoadingDevices ? (
                                <p className="text-center text-muted-foreground py-4">กำลังโหลด...</p>
                            ) : devices.length === 0 ? (
                                <p className="text-center text-muted-foreground py-4">ไม่มีอุปกรณ์ที่เชื่อมต่อ</p>
                            ) : (
                                <div className="space-y-3">
                                    {devices.map((device) => (
                                        <div
                                            key={device.id}
                                            className={cn(
                                                'flex items-center justify-between p-4 rounded-lg border',
                                                device.is_current && 'border-accent bg-accent/5'
                                            )}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={cn(
                                                    'p-2 rounded-lg',
                                                    device.is_current ? 'bg-accent/20' : 'bg-muted'
                                                )}>
                                                    <Monitor className={cn(
                                                        'w-5 h-5',
                                                        device.is_current ? 'text-accent' : 'text-muted-foreground'
                                                    )} />
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <p className="font-medium">{device.device_name}</p>
                                                        {device.is_current && (
                                                            <Badge variant="secondary" className="text-xs">
                                                                เครื่องนี้
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <p className="text-sm text-muted-foreground">
                                                        ใช้งานล่าสุด: {formatRelativeTime(device.last_seen)}
                                                    </p>
                                                </div>
                                            </div>
                                            {!device.is_current && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="text-red-500 hover:text-red-700"
                                                    onClick={() => removeDevice(device.device_id)}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
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
        </div>
    );
}
