
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { isAdminEmail, apiFetch } from '@/lib/config';
import { User } from '@supabase/supabase-js';
import {
    Users,
    Key,
    DollarSign,
    Search,
    Plus,
    Trash2,
    RefreshCw,
    Crown,
    Star,
    Rocket,
    Check,
    Copy,
    Calendar,
    Monitor,
    TrendingUp,
    AlertCircle,
    Clock,
    Shield,
    LogOut,
    Download,
    Loader2,
    BarChart3,
    PieChart,
    Activity,
    Zap,
    Wifi,
    WifiOff,
    Radio,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// Define types
interface LicenseKey {
    id: string;
    license_key: string;
    package: 'free' | 'agent' | 'elite';
    max_fb_sessions: number;
    expires_at: string;
    is_active: boolean;
    created_at: string;
    owner_name?: string;
    owner_contact?: string;
    note?: string;
}

const packageLabels = {
    free: 'Rookie (Free)',
    agent: 'Top Agent (฿1,390)',
    elite: 'Elite (฿2,990)',
};

const fbSessionLimits = {
    free: 1,
    agent: 3,
    elite: 5,
};

export default function AdminDashboard() {
    const navigate = useNavigate();
    const [licenses, setLicenses] = useState<LicenseKey[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterPackage, setFilterPackage] = useState<string>('all');
    const [filterStatus, setFilterStatus] = useState<string>('all');

    // Modal states
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<{ id: string; key: string } | null>(null);
    const [newLicense, setNewLicense] = useState({
        package: 'agent',
        durationDays: 30,
        ownerName: '',
        ownerContact: '',
        note: '',
    });

    // Queue detail dialog
    const [queueDetail, setQueueDetail] = useState<{ type: string; data: any } | null>(null);

    // Stats
    const [stats, setStats] = useState({
        totalLicenses: 0,
        activeLicenses: 0,
        expiringLicenses: 0,
        totalRevenue: 0,
    });

    // Live stats from backend (active users + automation)
    interface LiveUser {
        userId: string;
        fullUserId?: string;
        email?: string | null;
        displayName?: string;
        lineId?: string | null;
        isOnline: boolean;
        isRunningGroup: boolean;
        isRunningMarketplace: boolean;
        hasBrowser: boolean;
        todayPosts: number;
        todaySuccess: number;
        todayFailed: number;
        automationRuns: number;
        currentTasks: { total: number; completed: number; failed: number; pending: number };
        lastActivity: string;
    }
    interface LiveStats {
        totalSessions: number;
        activeUsers: number;
        onlineUsers: number;
        automationUsers: number;
        activeBrowsers: number;
        maxBrowsers: number;
        automation: {
            totalRunsToday: number;
            currentlyRunning: number;
            totalTasksCompleted: number;
            totalTasksFailed: number;
            totalTasksPending: number;
        };
        queue?: {
            maxConcurrent: number;
            runningCount: number;
            queueLength: number;
            queueTimeoutMin: number;
            running: { userId: string; groupCount: number; runningSec: number; startedAt: number }[];
            queue: { position: number; userId: string; groupCount: number; waitingSec: number; estimatedWaitSec: number }[];
            stats: {
                totalCompleted: number;
                totalFailed: number;
                totalProcessed: number;
                successRate: number;
                avgDurationSec: number;
                avgDurationFormatted: string;
                longestJobSec: number;
                shortestJobSec: number;
            };
            recentHistory: { userId: string; groupCount: number; durationSec: number; durationFormatted: string; success: boolean; completedAtFormatted: string }[];
        };
        users: LiveUser[];
    }
    const [liveStats, setLiveStats] = useState<LiveStats | null>(null);

    // Admin auth state
    const [adminUser, setAdminUser] = useState<User | null>(null);
    const [adminEmail, setAdminEmail] = useState('');
    const [adminPassword, setAdminPassword] = useState('');
    const [adminLoginError, setAdminLoginError] = useState<string | null>(null);
    const [adminLoggingIn, setAdminLoggingIn] = useState(false);
    const [checkingSession, setCheckingSession] = useState(true);

    // Admin tab navigation
    type AdminTab = 'overview' | 'users' | 'licenses' | 'system';
    const [activeTab, setActiveTab] = useState<AdminTab>('overview');

    useEffect(() => {
        // Check existing Supabase session
        supabase.auth.getUser().then(({ data: { user } }) => {
            if (user && isAdminEmail(user.email)) {
                setAdminUser(user);
            }
            setCheckingSession(false);
        });
    }, [navigate]);

    const handleAdminLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setAdminLoginError(null);
        setAdminLoggingIn(true);
        try {
            if (!isAdminEmail(adminEmail)) {
                setAdminLoginError('อีเมลนี้ไม่มีสิทธิ์ Admin');
                return;
            }
            const { data, error } = await supabase.auth.signInWithPassword({
                email: adminEmail.trim(),
                password: adminPassword,
            });
            if (error) {
                setAdminLoginError(error.message === 'Invalid login credentials'
                    ? 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' : error.message);
                return;
            }
            if (!data.user || !isAdminEmail(data.user.email)) {
                await supabase.auth.signOut();
                setAdminLoginError('อีเมลนี้ไม่มีสิทธิ์ Admin');
                return;
            }
            setAdminUser(data.user);
        } catch {
            setAdminLoginError('เกิดข้อผิดพลาด');
        } finally {
            setAdminLoggingIn(false);
        }
    };

    // Fetch licenses after admin is authenticated
    useEffect(() => {
        if (adminUser) fetchLicenses();
    }, [adminUser]);

    // Poll live stats (active users + automation) every 10s
    useEffect(() => {
        if (!adminUser) return;

        const fetchLiveStats = async () => {
            try {
                const res = await apiFetch('/api/admin/stats');
                if (res.ok) {
                    const data = await res.json();
                    if (data.success) setLiveStats(data);
                }
            } catch { /* silent */ }
        };

        fetchLiveStats();
        const interval = setInterval(fetchLiveStats, 10_000);
        return () => clearInterval(interval);
    }, [adminUser]);

    const fetchLicenses = async () => {
        setIsLoading(true);
        try {
            // Get licenses
            const { data: licensesData, error } = await supabase
                .from('license_keys')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Process data
            const processedLicenses = (licensesData || []);

            setLicenses(processedLicenses);

            // Calculate stats
            const now = new Date();
            const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

            const active = processedLicenses.filter(l => l.is_active && new Date(l.expires_at) > now).length;
            const expiring = processedLicenses.filter(l => {
                const expiry = new Date(l.expires_at);
                return l.is_active && expiry > now && expiry <= sevenDays;
            }).length;

            // Simple revenue estimation based on package type
            const revenue = processedLicenses.reduce((sum, l) => {
                if (l.package === 'agent') return sum + 1390;
                if (l.package === 'elite') return sum + 2990;
                return sum;
            }, 0);

            setStats({
                totalLicenses: processedLicenses.length,
                activeLicenses: active,
                expiringLicenses: expiring,
                totalRevenue: revenue
            });

        } catch (error) {
            console.error('Error fetching licenses:', error);
            toast.error('ไม่สามารถโหลดข้อมูล License ได้');
        } finally {
            setIsLoading(false);
        }
    };

    const generateKey = () => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let result = 'GS';
        // First segment 3 chars
        for (let i = 0; i < 3; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
        result += '-';
        // 3 segments of 5 chars
        for (let j = 0; j < 3; j++) {
            for (let i = 0; i < 5; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
            if (j < 2) result += '-';
        }
        return result;
    };

    const handleCreateLicense = async () => {
        try {
            const licenseKey = generateKey();
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + newLicense.durationDays);

            const { error } = await supabase.from('license_keys').insert({
                license_key: licenseKey,
                package: newLicense.package,
                max_devices: fbSessionLimits[newLicense.package as keyof typeof fbSessionLimits],
                expires_at: expiresAt.toISOString(),
                is_active: true,
                owner_name: newLicense.ownerName,
                owner_contact: newLicense.ownerContact,
                note: newLicense.note
            });

            if (error) throw error;

            toast.success('สร้าง License สำเร็จ');
            setShowCreateModal(false);
            setNewLicense({
                package: 'agent',
                durationDays: 30,
                ownerName: '',
                ownerContact: '',
                note: '',
            });
            fetchLicenses();
        } catch (error: any) {
            console.error('Create error:', error);
            toast.error(`สร้าง License ไม่สำเร็จ: ${error?.message || error?.code || JSON.stringify(error)}`);
        }
    };

    const deleteLicense = async (id: string) => {
        try {
            // First delete related device activations
            const { error: devErr } = await supabase
                .from('device_activations')
                .delete()
                .eq('license_key_id', id);

            if (devErr) console.warn('device_activations delete:', devErr.message);

            const { data, error } = await supabase
                .from('license_keys')
                .delete()
                .eq('id', id)
                .select();

            if (error) {
                console.error('Delete error:', error);
                throw error;
            }

            if (!data || data.length === 0) {
                toast.error('ลบไม่สำเร็จ — Supabase RLS อาจบล็อก ลองเช็ค Policy ใน Dashboard');
                return;
            }

            toast.success('ลบ License แล้ว');
            fetchLicenses();
        } catch (error: any) {
            console.error('Delete license error:', error);
            toast.error(`ไม่สามารถลบได้: ${error?.message || 'Unknown error'}`);
        } finally {
            setDeleteTarget(null);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.success('คัดลอกแล้ว');
    };

    const extendLicense = async (id: string, days: number) => {
        try {
            const license = licenses.find(l => l.id === id);
            if (!license) return;

            const currentExpiry = new Date(license.expires_at);
            // If expired, start from now. If active, add to current expiry
            const baseDate = currentExpiry > new Date() ? currentExpiry : new Date();
            const newExpiry = new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000);

            const { error } = await supabase
                .from('license_keys')
                .update({ expires_at: newExpiry.toISOString(), is_active: true })
                .eq('id', id);

            if (error) throw error;

            toast.success(`ต่ออายุ ${days} วันสำเร็จ`);
            fetchLicenses();
        } catch (error) {
            toast.error('ไม่สามารถต่ออายุได้');
        }
    };

    // Admin Logout
    const handleLogout = async () => {
        await supabase.auth.signOut();
        setAdminUser(null);
        toast.success('ออกจากระบบ Admin แล้ว');
        navigate('/');
    };

    // Export to CSV
    const exportToCSV = () => {
        const headers = ['License Key', 'Package', 'Owner Name', 'Owner Contact', 'Devices', 'Expires At', 'Status', 'Created At'];
        const rows = filteredLicenses.map(license => {
            const expired = isExpired(license.expires_at);
            const status = license.is_active && !expired ? 'Active' : 'Inactive';
            return [
                license.license_key,
                packageLabels[license.package],
                license.owner_name || '',
                license.owner_contact || '',
                `${license.max_fb_sessions} FB sessions`,
                formatDate(license.expires_at),
                status,
                formatDate(license.created_at)
            ];
        });

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');

        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `licenses_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        toast.success('ส่งออก CSV สำเร็จ');
    };

    // Filter licenses
    const filteredLicenses = licenses.filter(license => {
        const matchesSearch =
            license.license_key.toLowerCase().includes(searchQuery.toLowerCase()) ||
            license.owner_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            license.owner_contact?.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesPackage = filterPackage === 'all' || license.package === filterPackage;

        const now = new Date();
        const isActive = license.is_active && new Date(license.expires_at) > now;
        const matchesStatus =
            filterStatus === 'all' ||
            (filterStatus === 'active' && isActive) ||
            (filterStatus === 'inactive' && !isActive);

        return matchesSearch && matchesPackage && matchesStatus;
    });

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('th-TH', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    const isExpired = (dateString: string) => new Date(dateString) < new Date();
    const isExpiringSoon = (dateString: string) => {
        const expiry = new Date(dateString);
        const now = new Date();
        const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        return expiry > now && expiry <= sevenDays;
    };

    // Checking existing session
    if (checkingSession) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center space-y-3">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground mx-auto" />
                    <p className="text-muted-foreground">กำลังตรวจสอบ...</p>
                </div>
            </div>
        );
    }

    // No admin session → show inline login
    if (!adminUser) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
                <Card className="w-full max-w-md border-gray-700 bg-gray-900/90">
                    <CardHeader className="text-center">
                        <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center mb-2">
                            <Shield className="w-7 h-7 text-white" />
                        </div>
                        <CardTitle className="text-white">Admin Login</CardTitle>
                        <CardDescription className="text-gray-400">ล็อกอินเพื่อจัดการ License Keys</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleAdminLogin} className="space-y-4">
                            <Input
                                type="email"
                                value={adminEmail}
                                onChange={(e) => { setAdminEmail(e.target.value); setAdminLoginError(null); }}
                                placeholder="อีเมล Admin"
                                className="bg-gray-800 border-gray-700 text-white"
                            />
                            <Input
                                type="password"
                                value={adminPassword}
                                onChange={(e) => { setAdminPassword(e.target.value); setAdminLoginError(null); }}
                                placeholder="รหัสผ่าน"
                                className="bg-gray-800 border-gray-700 text-white"
                            />
                            {adminLoginError && (
                                <p className="text-sm text-red-400 flex items-center gap-1">
                                    <AlertCircle className="w-4 h-4" /> {adminLoginError}
                                </p>
                            )}
                            <Button type="submit" className="w-full bg-gradient-to-r from-red-500 to-orange-500" disabled={adminLoggingIn || !adminEmail || !adminPassword}>
                                {adminLoggingIn ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />กำลังตรวจสอบ...</> : 'เข้าสู่ระบบ Admin'}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const adminTabs: { key: AdminTab; label: string; icon: React.ReactNode }[] = [
        { key: 'overview', label: 'ภาพรวม', icon: <BarChart3 className="w-4 h-4" /> },
        { key: 'users', label: 'ผู้ใช้งาน', icon: <Users className="w-4 h-4" /> },
        { key: 'licenses', label: 'License Keys', icon: <Key className="w-4 h-4" /> },
        { key: 'system', label: 'ระบบ & Queue', icon: <Monitor className="w-4 h-4" /> },
    ];

    return (
        <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
            {/* Top Header */}
            <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b">
                <div className="max-w-7xl mx-auto px-4 md:px-6">
                    <div className="flex items-center justify-between h-14">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center">
                                <Shield className="w-4 h-4 text-white" />
                            </div>
                            <div>
                                <h1 className="text-base font-bold leading-none">Grand$tate Admin</h1>
                                <p className="text-[11px] text-muted-foreground">{adminUser?.email}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {liveStats && (
                                <div className="hidden sm:flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                    {liveStats.onlineUsers} online • {liveStats.automation.currentlyRunning} automation
                                </div>
                            )}
                            <Button variant="outline" size="sm" onClick={exportToCSV}>
                                <Download className="w-4 h-4" />
                            </Button>
                            <Button size="sm" onClick={() => setShowCreateModal(true)}>
                                <Plus className="w-4 h-4 sm:mr-1" />
                                <span className="hidden sm:inline">License</span>
                            </Button>
                            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-red-500 hover:text-red-600">
                                <LogOut className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                    {/* Tab Navigation */}
                    <div className="flex gap-1 -mb-px overflow-x-auto">
                        {adminTabs.map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className={cn(
                                    "flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                                    activeTab === tab.key
                                        ? "border-accent text-accent"
                                        : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
                                )}
                            >
                                {tab.icon}
                                {tab.label}
                                {tab.key === 'users' && liveStats && (
                                    <Badge variant="secondary" className="text-[10px] h-4 px-1 ml-0.5">{liveStats.activeUsers}</Badge>
                                )}
                                {tab.key === 'system' && liveStats?.queue && liveStats.queue.queueLength > 0 && (
                                    <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 text-[10px] h-4 px-1 ml-0.5">{liveStats.queue.queueLength}</Badge>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">

            {/* ═══════════════ TAB: OVERVIEW ═══════════════ */}
            {activeTab === 'overview' && (<>
                {/* Quick Stats */}
                <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
                    <Card><CardContent className="pt-5 pb-4"><div className="flex items-center gap-3"><div className="p-2.5 rounded-xl bg-blue-100 dark:bg-blue-900/30"><Key className="w-5 h-5 text-blue-600" /></div><div><p className="text-xs text-muted-foreground">License ทั้งหมด</p><p className="text-xl font-bold">{stats.totalLicenses}</p></div></div></CardContent></Card>
                    <Card><CardContent className="pt-5 pb-4"><div className="flex items-center gap-3"><div className="p-2.5 rounded-xl bg-green-100 dark:bg-green-900/30"><Check className="w-5 h-5 text-green-600" /></div><div><p className="text-xs text-muted-foreground">ใช้งานอยู่</p><p className="text-xl font-bold">{stats.activeLicenses}</p></div></div></CardContent></Card>
                    <Card><CardContent className="pt-5 pb-4"><div className="flex items-center gap-3"><div className="p-2.5 rounded-xl bg-amber-100 dark:bg-amber-900/30"><Clock className="w-5 h-5 text-amber-600" /></div><div><p className="text-xs text-muted-foreground">ใกล้หมดอายุ</p><p className="text-xl font-bold">{stats.expiringLicenses}</p></div></div></CardContent></Card>
                    <Card><CardContent className="pt-5 pb-4"><div className="flex items-center gap-3"><div className="p-2.5 rounded-xl bg-purple-100 dark:bg-purple-900/30"><DollarSign className="w-5 h-5 text-purple-600" /></div><div><p className="text-xs text-muted-foreground">รายได้รวม</p><p className="text-xl font-bold">฿{stats.totalRevenue.toLocaleString()}</p></div></div></CardContent></Card>
                    <Card><CardContent className="pt-5 pb-4"><div className="flex items-center gap-3"><div className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-900/30"><Wifi className="w-5 h-5 text-emerald-600" /></div><div><p className="text-xs text-muted-foreground">ออนไลน์</p><p className="text-xl font-bold">{liveStats?.onlineUsers ?? '—'}</p></div></div></CardContent></Card>
                    <Card><CardContent className="pt-5 pb-4"><div className="flex items-center gap-3"><div className="p-2.5 rounded-xl bg-orange-100 dark:bg-orange-900/30"><Zap className="w-5 h-5 text-orange-600" /></div><div><p className="text-xs text-muted-foreground">Automation</p><p className="text-xl font-bold">{liveStats?.automation.currentlyRunning ?? '—'}</p></div></div></CardContent></Card>
                </div>

                {/* Charts */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Package Distribution */}
                    <Card>
                        <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><PieChart className="w-4 h-4" /> สัดส่วนแพ็คเกจ</CardTitle></CardHeader>
                        <CardContent>
                            {(() => { const fc = licenses.filter(l => l.package === 'free').length; const ac = licenses.filter(l => l.package === 'agent').length; const ec = licenses.filter(l => l.package === 'elite').length; const t = licenses.length || 1; return (<div className="space-y-3">{[{label:'Rookie',count:fc,color:'bg-emerald-500',icon:<Rocket className="w-3.5 h-3.5 text-emerald-500"/>},{label:'Top Agent',count:ac,color:'bg-amber-500',icon:<Star className="w-3.5 h-3.5 text-amber-500"/>},{label:'Elite',count:ec,color:'bg-purple-500',icon:<Crown className="w-3.5 h-3.5 text-purple-500"/>}].map(p=>(<div key={p.label} className="space-y-1"><div className="flex justify-between text-sm"><span className="flex items-center gap-1.5">{p.icon} {p.label}</span><span>{p.count} ({Math.round(p.count/t*100)}%)</span></div><div className="h-2.5 bg-muted rounded-full overflow-hidden"><div className={cn("h-full rounded-full",p.color)} style={{width:`${p.count/t*100}%`}}/></div></div>))}</div>);})()}
                        </CardContent>
                    </Card>
                    {/* Revenue */}
                    <Card>
                        <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><DollarSign className="w-4 h-4" /> รายได้ตามแพ็คเกจ</CardTitle></CardHeader>
                        <CardContent>
                            {(() => { const ar = licenses.filter(l => l.package === 'agent').length * 1390; const er = licenses.filter(l => l.package === 'elite').length * 2990; const mx = Math.max(ar, er, 1); return (<div className="space-y-3"><div className="space-y-1"><div className="flex justify-between text-sm"><span className="flex items-center gap-1.5"><Star className="w-3.5 h-3.5 text-amber-500"/>Top Agent (฿1,390)</span><span className="font-semibold">฿{ar.toLocaleString()}</span></div><div className="h-5 bg-muted rounded-lg overflow-hidden"><div className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-lg" style={{width:`${ar/mx*100}%`}}/></div></div><div className="space-y-1"><div className="flex justify-between text-sm"><span className="flex items-center gap-1.5"><Crown className="w-3.5 h-3.5 text-purple-500"/>Elite (฿2,990)</span><span className="font-semibold">฿{er.toLocaleString()}</span></div><div className="h-5 bg-muted rounded-lg overflow-hidden"><div className="h-full bg-gradient-to-r from-purple-400 to-purple-500 rounded-lg" style={{width:`${er/mx*100}%`}}/></div></div><div className="pt-3 border-t mt-3 flex justify-between items-center"><span className="text-muted-foreground">รายได้รวมทั้งหมด</span><span className="text-xl font-bold text-green-600">฿{(ar+er).toLocaleString()}</span></div></div>);})()}
                        </CardContent>
                    </Card>
                </div>

                {/* Expiring Soon */}
                {(() => { const now = new Date(); const sd = new Date(now.getTime() + 7*24*60*60*1000); const exp = licenses.filter(l => { const e = new Date(l.expires_at); return l.is_active && e > now && e <= sd; }); if (!exp.length) return null; return (<Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20"><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400 text-base"><AlertCircle className="w-4 h-4"/>⚠️ License ใกล้หมดอายุ ({exp.length})</CardTitle></CardHeader><CardContent><div className="space-y-2">{exp.slice(0,5).map(l=>{const dl=Math.ceil((new Date(l.expires_at).getTime()-now.getTime())/(1000*60*60*24));return(<div key={l.id} className="flex items-center justify-between p-2.5 bg-white dark:bg-gray-800 rounded-lg border"><div className="flex items-center gap-2"><code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">{l.license_key}</code><span className="text-xs text-muted-foreground">{l.owner_name||'ไม่ระบุชื่อ'}</span></div><div className="flex items-center gap-2"><Badge className={cn(dl<=2?'bg-red-100 text-red-700':'bg-amber-100 text-amber-700','text-[10px]')}>เหลือ {dl} วัน</Badge><Button size="sm" variant="outline" className="h-7 text-xs" onClick={()=>extendLicense(l.id,30)}>+30 วัน</Button></div></div>);})}</div></CardContent></Card>);})()}

                {/* Monthly Report */}
                <Card>
                    <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><TrendingUp className="w-4 h-4"/>รายงานรายเดือน (6 เดือนล่าสุด)</CardTitle></CardHeader>
                    <CardContent>
                        {(() => { const months: {month:string;count:number;revenue:number}[] = []; const now = new Date(); for(let i=5;i>=0;i--){const d=new Date(now.getFullYear(),now.getMonth()-i,1);const me=new Date(now.getFullYear(),now.getMonth()-i+1,0);const ml=licenses.filter(l=>{const c=new Date(l.created_at);return c>=d&&c<=me;});const rv=ml.reduce((s,l)=>l.package==='agent'?s+1390:l.package==='elite'?s+2990:s,0);months.push({month:d.toLocaleDateString('th-TH',{month:'short',year:'2-digit'}),count:ml.length,revenue:rv});}const mc=Math.max(...months.map(m=>m.count),1);const mr=Math.max(...months.map(m=>m.revenue),1); return (<div className="space-y-4"><div><h4 className="text-xs font-medium mb-2 flex items-center gap-1.5"><Key className="w-3.5 h-3.5"/>จำนวน License</h4><div className="flex items-end gap-2 h-24">{months.map((m,i)=>(<div key={i} className="flex-1 flex flex-col items-center gap-0.5"><span className="text-[10px] font-medium">{m.count}</span><div className="w-full bg-gradient-to-t from-blue-500 to-blue-400 rounded-t transition-all" style={{height:`${(m.count/mc)*100}%`,minHeight:m.count>0?'6px':'2px'}}/><span className="text-[10px] text-muted-foreground">{m.month}</span></div>))}</div></div><div className="pt-3 border-t"><h4 className="text-xs font-medium mb-2 flex items-center gap-1.5"><DollarSign className="w-3.5 h-3.5"/>รายได้ (บาท)</h4><div className="flex items-end gap-2 h-24">{months.map((m,i)=>(<div key={i} className="flex-1 flex flex-col items-center gap-0.5"><span className="text-[10px] font-medium">{m.revenue>0?`฿${(m.revenue/1000).toFixed(1)}k`:'-'}</span><div className="w-full bg-gradient-to-t from-green-500 to-emerald-400 rounded-t transition-all" style={{height:`${(m.revenue/mr)*100}%`,minHeight:m.revenue>0?'6px':'2px'}}/><span className="text-[10px] text-muted-foreground">{m.month}</span></div>))}</div></div></div>);})()}
                    </CardContent>
                </Card>
            </>)}

            {/* ═══════════════ TAB: USERS (Live) ═══════════════ */}
            {activeTab === 'users' && (<>
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2">
                            <Radio className="w-5 h-5 text-red-500 animate-pulse" />
                            ผู้ใช้งานในระบบ (Real-time)
                            <Badge variant="outline" className="ml-2 text-xs font-normal">อัพเดททุก 10 วินาที</Badge>
                        </CardTitle>
                        <CardDescription>ดูสถานะผู้ใช้ทุกคนแบบ real-time — ออนไลน์, Automation, โพสต์วันนี้</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {!liveStats ? (
                            <div className="flex items-center justify-center py-12 text-muted-foreground gap-2"><Loader2 className="w-5 h-5 animate-spin" />กำลังเชื่อมต่อ Backend...</div>
                        ) : (
                            <div className="space-y-4">
                                {/* Summary Cards */}
                                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                                    <div className="p-3 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800"><div className="flex items-center gap-1.5 mb-1"><Wifi className="w-3.5 h-3.5 text-green-600"/><span className="text-[11px] font-medium text-green-700 dark:text-green-400">ออนไลน์</span></div><p className="text-2xl font-bold text-green-700 dark:text-green-300">{liveStats.onlineUsers}</p></div>
                                    <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800"><div className="flex items-center gap-1.5 mb-1"><Users className="w-3.5 h-3.5 text-blue-600"/><span className="text-[11px] font-medium text-blue-700 dark:text-blue-400">ใช้งานรวม</span></div><p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{liveStats.activeUsers}</p></div>
                                    <div className="p-3 rounded-xl bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800"><div className="flex items-center gap-1.5 mb-1"><Zap className={cn("w-3.5 h-3.5 text-orange-600",liveStats.automation.currentlyRunning>0&&"animate-pulse")}/><span className="text-[11px] font-medium text-orange-700 dark:text-orange-400">Automation</span></div><p className="text-2xl font-bold text-orange-700 dark:text-orange-300">{liveStats.automation.currentlyRunning}</p></div>
                                    <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800"><div className="flex items-center gap-1.5 mb-1"><Activity className="w-3.5 h-3.5 text-purple-600"/><span className="text-[11px] font-medium text-purple-700 dark:text-purple-400">สั่งการวันนี้</span></div><p className="text-2xl font-bold text-purple-700 dark:text-purple-300">{liveStats.automation.totalRunsToday}</p></div>
                                    <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700"><div className="flex items-center gap-1.5 mb-1"><Monitor className="w-3.5 h-3.5 text-gray-600 dark:text-gray-400"/><span className="text-[11px] font-medium text-gray-700 dark:text-gray-400">Browsers</span></div><p className="text-2xl font-bold text-gray-700 dark:text-gray-300">{liveStats.activeBrowsers}/{liveStats.maxBrowsers}</p></div>
                                </div>

                                {/* Tasks Summary */}
                                {(liveStats.automation.totalTasksCompleted > 0 || liveStats.automation.totalTasksFailed > 0 || liveStats.automation.totalTasksPending > 0) && (
                                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 text-sm">
                                        <span className="text-muted-foreground whitespace-nowrap">Tasks:</span>
                                        <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">✅ {liveStats.automation.totalTasksCompleted} สำเร็จ</Badge>
                                        <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">❌ {liveStats.automation.totalTasksFailed} ล้มเหลว</Badge>
                                        {liveStats.automation.totalTasksPending > 0 && <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">⏳ {liveStats.automation.totalTasksPending} กำลังทำ</Badge>}
                                    </div>
                                )}

                                {/* Per-User Table */}
                                {liveStats.users.length > 0 ? (
                                    <div className="border rounded-lg overflow-hidden">
                                        <Table>
                                            <TableHeader><TableRow className="bg-muted/30">
                                                <TableHead className="text-xs">ผู้ใช้</TableHead>
                                                <TableHead className="text-xs">สถานะ</TableHead>
                                                <TableHead className="text-xs">Automation</TableHead>
                                                <TableHead className="text-xs">โพสต์วันนี้</TableHead>
                                                <TableHead className="text-xs">สั่งการ</TableHead>
                                                <TableHead className="text-xs">Tasks</TableHead>
                                            </TableRow></TableHeader>
                                            <TableBody>
                                                {liveStats.users.map(u => (
                                                    <TableRow key={u.userId}>
                                                        <TableCell>
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-accent/30 to-orange-400/30 flex items-center justify-center text-[10px] font-bold text-accent shrink-0">
                                                                    {(u.displayName || u.userId)?.[0]?.toUpperCase() || '?'}
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <p className="text-sm font-medium truncate">{u.displayName || u.userId}</p>
                                                                    <div className="flex items-center gap-2 flex-wrap">
                                                                        {u.email && <p className="text-[10px] text-muted-foreground truncate">{u.email}</p>}
                                                                        {!u.email && <p className="text-[10px] text-muted-foreground font-mono">{u.userId}</p>}
                                                                        {u.lineId && <span className="text-[10px] text-green-600 dark:text-green-400 font-medium">LINE: {u.lineId}</span>}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>{u.isOnline ? <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-[10px]"><Wifi className="w-3 h-3 mr-1"/>Online</Badge> : <Badge variant="secondary" className="text-[10px]"><WifiOff className="w-3 h-3 mr-1"/>Offline</Badge>}</TableCell>
                                                        <TableCell>{u.isRunningGroup || u.isRunningMarketplace ? <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 text-[10px]"><Zap className="w-3 h-3 mr-1 animate-pulse"/>{u.isRunningGroup&&'Groups'}{u.isRunningGroup&&u.isRunningMarketplace&&' + '}{u.isRunningMarketplace&&'Marketplace'}</Badge> : <span className="text-xs text-muted-foreground">—</span>}</TableCell>
                                                        <TableCell><div className="text-xs"><span className="font-semibold">{u.todayPosts}</span><span className="text-muted-foreground ml-1">({u.todaySuccess}✅ {u.todayFailed}❌)</span></div></TableCell>
                                                        <TableCell><span className="text-xs font-semibold">{u.automationRuns} ครั้ง</span></TableCell>
                                                        <TableCell>{u.currentTasks.total > 0 ? <div className="flex items-center gap-1"><div className="w-16 h-2 bg-muted rounded-full overflow-hidden"><div className="h-full bg-green-500 rounded-full" style={{width:`${((u.currentTasks.completed+u.currentTasks.failed)/u.currentTasks.total)*100}%`}}/></div><span className="text-[10px] text-muted-foreground">{u.currentTasks.completed+u.currentTasks.failed}/{u.currentTasks.total}</span></div> : <span className="text-xs text-muted-foreground">—</span>}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                ) : (
                                    <p className="text-center text-sm text-muted-foreground py-8">ยังไม่มีผู้ใช้ในระบบขณะนี้</p>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </>)}

            {/* ═══════════════ TAB: LICENSES ═══════════════ */}
            {activeTab === 'licenses' && (<>
                {/* Filters */}
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex flex-col md:flex-row gap-3">
                            <div className="flex-1 relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"/><Input placeholder="ค้นหา License Key, ชื่อ, อีเมล..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10"/></div>
                            <Select value={filterPackage} onValueChange={setFilterPackage}><SelectTrigger className="w-[160px]"><SelectValue placeholder="แพ็คเกจ"/></SelectTrigger><SelectContent><SelectItem value="all">ทั้งหมด</SelectItem><SelectItem value="free">Rookie</SelectItem><SelectItem value="agent">Top Agent</SelectItem><SelectItem value="elite">Elite</SelectItem></SelectContent></Select>
                            <Select value={filterStatus} onValueChange={setFilterStatus}><SelectTrigger className="w-[160px]"><SelectValue placeholder="สถานะ"/></SelectTrigger><SelectContent><SelectItem value="all">ทั้งหมด</SelectItem><SelectItem value="active">ใช้งานอยู่</SelectItem><SelectItem value="inactive">หมดอายุ</SelectItem></SelectContent></Select>
                            <Button variant="outline" onClick={fetchLicenses}><RefreshCw className={cn("w-4 h-4 mr-2",isLoading&&"animate-spin")}/>รีเฟรช</Button>
                        </div>
                    </CardContent>
                </Card>

                {/* License Table */}
                <Card>
                    <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2"><Key className="w-5 h-5 text-primary"/>License Keys ({filteredLicenses.length})</CardTitle></CardHeader>
                    <CardContent>
                        <ScrollArea className="h-[500px]">
                          <div className="overflow-x-auto">
                            <Table className="min-w-[700px]">
                                <TableHeader><TableRow>
                                    <TableHead>License Key</TableHead><TableHead>แพ็คเกจ</TableHead><TableHead>เจ้าของ</TableHead><TableHead>FB Sessions</TableHead><TableHead>วันหมดอายุ</TableHead><TableHead>สถานะ</TableHead><TableHead className="text-right">จัดการ</TableHead>
                                </TableRow></TableHeader>
                                <TableBody>
                                    {filteredLicenses.length === 0 ? (
                                        <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground"><Key className="w-12 h-12 mx-auto mb-4 opacity-20"/>ไม่พบ License Key</TableCell></TableRow>
                                    ) : filteredLicenses.map(license => {
                                        const expired = isExpired(license.expires_at);
                                        const expiringSoon = isExpiringSoon(license.expires_at);
                                        return (
                                            <TableRow key={license.id}>
                                                <TableCell className="font-mono text-sm">{license.license_key}</TableCell>
                                                <TableCell><Badge variant={license.package === 'elite' ? 'default' : 'secondary'}>{packageLabels[license.package]}</Badge></TableCell>
                                                <TableCell><div><div className="font-medium text-sm">{license.owner_name || '-'}</div><div className="text-xs text-muted-foreground">{license.owner_contact}</div></div></TableCell>
                                                <TableCell>{license.max_fb_sessions} sessions</TableCell>
                                                <TableCell><div className={cn("flex items-center gap-1.5 text-sm",expired?"text-red-500 font-medium":expiringSoon?"text-amber-500 font-medium":"")}>{formatDate(license.expires_at)}{expiringSoon&&!expired&&<AlertCircle className="w-3.5 h-3.5"/>}</div></TableCell>
                                                <TableCell><Badge variant={license.is_active&&!expired?'outline':'destructive'} className={cn(license.is_active&&!expired&&"border-green-500 text-green-500")}>{license.is_active&&!expired?'Active':'Inactive'}</Badge></TableCell>
                                                <TableCell className="text-right"><div className="flex justify-end gap-1.5">
                                                    <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={()=>navigator.clipboard.writeText(license.license_key)}><Copy className="w-3.5 h-3.5"/></Button>
                                                    <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={()=>extendLicense(license.id,30)}><Calendar className="w-3.5 h-3.5 text-green-600"/></Button>
                                                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-50" onClick={()=>setDeleteTarget({id:license.id,key:license.license_key})}><Trash2 className="w-3.5 h-3.5"/></Button>
                                                </div></TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                          </div>
                        </ScrollArea>
                    </CardContent>
                </Card>
            </>)}

            {/* ═══════════════ TAB: SYSTEM & QUEUE — LUXURY ENGINE ROOM ═══════════════ */}
            {activeTab === 'system' && (<>
                {!liveStats?.queue ? (
                    <div className="flex items-center justify-center py-16 text-muted-foreground gap-2"><Loader2 className="w-5 h-5 animate-spin"/>กำลังเชื่อมต่อ Backend...</div>
                ) : (<div className="space-y-5">

                    {/* ── HERO: Queue Engine ── */}
                    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-6 cursor-pointer group" onClick={() => setQueueDetail({ type: 'slots', data: liveStats.queue })}>
                        {/* Animated background grid */}
                        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '24px 24px' }} />
                        {/* Glow effect */}
                        <div className={cn("absolute top-0 left-1/2 -translate-x-1/2 w-96 h-32 rounded-full blur-[80px] transition-all duration-1000", liveStats.queue.runningCount > 0 ? "bg-emerald-500/20" : "bg-blue-500/10")} />

                        <div className="relative z-10">
                            <div className="flex items-center justify-between mb-5">
                                <div>
                                    <h3 className="text-lg font-bold flex items-center gap-2"><Zap className="w-5 h-5 text-amber-400"/>Queue Engine</h3>
                                    <p className="text-xs text-slate-400 mt-0.5">{liveStats.queue.maxConcurrent} concurrent slots • {liveStats.queue.queueTimeoutMin}m timeout</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    {liveStats.queue.queueLength > 0 && (
                                        <div className="px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/30 backdrop-blur-sm">
                                            <p className="text-xl font-bold text-amber-400 tabular-nums">{liveStats.queue.queueLength}</p>
                                            <p className="text-[9px] text-amber-400/70 uppercase tracking-wider">Queue</p>
                                        </div>
                                    )}
                                    <div className="text-right">
                                        <p className="text-4xl font-black tabular-nums tracking-tight">{liveStats.queue.runningCount}<span className="text-lg text-slate-500 font-light">/{liveStats.queue.maxConcurrent}</span></p>
                                        <p className="text-[10px] text-slate-400 uppercase tracking-widest">Active</p>
                                    </div>
                                </div>
                            </div>

                            {/* Animated Slot Grid */}
                            <div className="grid grid-cols-10 gap-1.5">
                                {Array.from({ length: liveStats.queue.maxConcurrent }, (_, i) => {
                                    const isActive = i < liveStats.queue.runningCount;
                                    return (
                                        <div key={i} className="relative group/slot">
                                            <div className={cn(
                                                "h-8 rounded-lg flex items-center justify-center transition-all duration-500 border",
                                                isActive
                                                    ? "bg-gradient-to-t from-emerald-600 to-emerald-400 border-emerald-400/50 shadow-lg shadow-emerald-500/20"
                                                    : "bg-slate-700/50 border-slate-600/30 hover:border-slate-500/50"
                                            )} style={isActive ? { animation: `pulse 2s ease-in-out ${i * 0.15}s infinite` } : undefined}>
                                                <span className={cn("text-[10px] font-bold tabular-nums", isActive ? "text-white" : "text-slate-500")}>{i + 1}</span>
                                            </div>
                                            {isActive && <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-0.5 rounded-full bg-emerald-400 animate-pulse" />}
                                        </div>
                                    );
                                })}
                            </div>
                            <p className="text-[9px] text-slate-500 mt-2 text-center uppercase tracking-[0.2em]">Slot 1 — {liveStats.queue.maxConcurrent}</p>
                        </div>
                    </div>

                    {/* ── ROW: Stats Cards ── */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        {[
                            { label: 'Jobs สำเร็จ', value: liveStats.queue.stats.totalCompleted, color: 'emerald', icon: <Check className="w-4 h-4"/> },
                            { label: 'Jobs ล้มเหลว', value: liveStats.queue.stats.totalFailed, color: 'red', icon: <AlertCircle className="w-4 h-4"/> },
                            { label: 'Success Rate', value: `${liveStats.queue.stats.successRate}%`, color: 'blue', icon: <TrendingUp className="w-4 h-4"/> },
                            { label: 'Avg Duration', value: liveStats.queue.stats.avgDurationFormatted, color: 'purple', icon: <Clock className="w-4 h-4"/> },
                        ].map((stat, i) => (
                            <div key={i} className={cn("relative overflow-hidden rounded-xl border p-4 cursor-pointer hover:shadow-lg transition-all group/stat",
                                `bg-${stat.color}-50/50 dark:bg-${stat.color}-950/10 border-${stat.color}-200/50 dark:border-${stat.color}-800/30 hover:border-${stat.color}-300`
                            )} onClick={() => setQueueDetail({ type: 'stats', data: liveStats.queue.stats })}>
                                <div className={`absolute top-2 right-2 w-8 h-8 rounded-lg bg-${stat.color}-100 dark:bg-${stat.color}-900/30 flex items-center justify-center text-${stat.color}-600 opacity-60 group-hover/stat:opacity-100 transition-opacity`}>{stat.icon}</div>
                                <p className="text-2xl font-black tabular-nums">{stat.value}</p>
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">{stat.label}</p>
                            </div>
                        ))}
                    </div>

                    {/* ── ROW: Running + Waiting ── */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Running */}
                        <div className="rounded-xl border bg-card overflow-hidden">
                            <div className="px-4 py-3 border-b bg-gradient-to-r from-emerald-50/80 to-transparent dark:from-emerald-950/20 flex items-center gap-2">
                                <div className="relative"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500"/><div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping opacity-40"/></div>
                                <span className="font-semibold text-sm">Running</span>
                                <Badge className="ml-auto bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-xs">{liveStats.queue.running.length}</Badge>
                            </div>
                            <div className="p-3">
                                {liveStats.queue.running.length > 0 ? (
                                    <div className="space-y-2">{liveStats.queue.running.map((r: any, i: number) => (
                                        <div key={i} className="relative overflow-hidden flex items-center justify-between p-3 rounded-xl border border-emerald-200 dark:border-emerald-800/50 bg-gradient-to-r from-emerald-50 to-transparent dark:from-emerald-950/20 cursor-pointer hover:shadow-lg hover:border-emerald-300 transition-all group/run"
                                            onClick={() => setQueueDetail({ type: 'running', data: r })}>
                                            {/* Shimmer effect */}
                                            <div className="absolute inset-0 -translate-x-full group-hover/run:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                                            <div className="flex items-center gap-3 relative z-10">
                                                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center text-white text-xs font-bold shadow-md shadow-emerald-500/20">{i+1}</div>
                                                <div><p className="text-sm font-semibold font-mono">{r.userId}</p><p className="text-[10px] text-muted-foreground">{r.groupCount} groups</p></div>
                                            </div>
                                            <div className="text-right relative z-10"><p className="text-lg font-mono font-bold text-emerald-600 tabular-nums">{Math.floor(r.runningSec/60)}:{String(r.runningSec%60).padStart(2,'0')}</p></div>
                                        </div>
                                    ))}</div>
                                ) : (
                                    <div className="py-8 text-center">
                                        <div className="w-12 h-12 mx-auto rounded-full bg-muted/50 flex items-center justify-center mb-2"><Radio className="w-5 h-5 text-muted-foreground/40"/></div>
                                        <p className="text-sm text-muted-foreground">Idle — No active jobs</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Waiting Queue */}
                        <div className="rounded-xl border bg-card overflow-hidden">
                            <div className="px-4 py-3 border-b bg-gradient-to-r from-amber-50/80 to-transparent dark:from-amber-950/20 flex items-center gap-2">
                                <Clock className="w-4 h-4 text-amber-500 animate-[spin_3s_linear_infinite]"/>
                                <span className="font-semibold text-sm">Waiting Queue</span>
                                <Badge className="ml-auto bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-xs">{liveStats.queue.queue.length}</Badge>
                            </div>
                            <div className="p-3">
                                {liveStats.queue.queue.length > 0 ? (
                                    <div className="space-y-2">{liveStats.queue.queue.map((q: any, i: number) => (
                                        <div key={i} className="flex items-center justify-between p-3 rounded-xl border border-amber-200 dark:border-amber-800/50 bg-gradient-to-r from-amber-50 to-transparent dark:from-amber-950/20 cursor-pointer hover:shadow-lg hover:border-amber-300 transition-all"
                                            style={{ animation: `pulse 3s ease-in-out ${i * 0.3}s infinite` }}
                                            onClick={() => setQueueDetail({ type: 'queued', data: q })}>
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center text-white text-xs font-bold shadow-md shadow-amber-500/20">#{q.position}</div>
                                                <div><p className="text-sm font-semibold font-mono">{q.userId}</p><p className="text-[10px] text-muted-foreground">{q.groupCount} groups • ~{Math.ceil(q.estimatedWaitSec/60)}m</p></div>
                                            </div>
                                            <p className="font-mono text-sm tabular-nums text-amber-600">{Math.floor(q.waitingSec/60)}:{String(q.waitingSec%60).padStart(2,'0')}</p>
                                        </div>
                                    ))}</div>
                                ) : (
                                    <div className="py-8 text-center">
                                        <div className="w-12 h-12 mx-auto rounded-full bg-muted/50 flex items-center justify-center mb-2"><Check className="w-5 h-5 text-muted-foreground/40"/></div>
                                        <p className="text-sm text-muted-foreground">Queue empty — All clear</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* ── ROW: Engine Status + History Timeline ── */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Engine Status */}
                        <div className="rounded-xl overflow-hidden border bg-gradient-to-br from-slate-50 to-white dark:from-slate-900/50 dark:to-slate-800/30 cursor-pointer hover:shadow-xl transition-all" onClick={() => setQueueDetail({ type: 'system', data: liveStats })}>
                            <div className="px-4 py-3 border-b flex items-center gap-2 bg-gradient-to-r from-blue-50/80 to-transparent dark:from-blue-950/20">
                                <Monitor className="w-4 h-4 text-blue-500"/>
                                <span className="font-semibold text-sm">Engine Status</span>
                                <Badge variant="outline" className="ml-auto text-[9px] uppercase tracking-wider">Live</Badge>
                            </div>
                            <div className="p-4 space-y-4">
                                {/* Browser Pool */}
                                <div>
                                    <div className="flex justify-between text-xs mb-1.5"><span className="text-muted-foreground uppercase tracking-wider">Browser Pool</span><span className="font-mono font-bold">{liveStats.activeBrowsers}/{liveStats.maxBrowsers}</span></div>
                                    <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                        <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-700 shadow-sm shadow-blue-500/30" style={{width:`${(liveStats.activeBrowsers/(liveStats.maxBrowsers||10))*100}%`}}/>
                                    </div>
                                </div>
                                {/* Metric Grid */}
                                <div className="grid grid-cols-2 gap-2">
                                    {[
                                        { label: 'Sessions', value: liveStats.totalSessions, color: 'slate' },
                                        { label: 'Online', value: liveStats.onlineUsers, color: 'emerald' },
                                        { label: 'Automation', value: liveStats.automationUsers, color: 'orange' },
                                        { label: 'Runs Today', value: liveStats.automation.totalRunsToday, color: 'blue' },
                                        { label: 'Tasks ✓', value: liveStats.automation.totalTasksCompleted, color: 'emerald' },
                                        { label: 'Tasks ✗', value: liveStats.automation.totalTasksFailed, color: 'red' },
                                    ].map((m, i) => (
                                        <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                                            <span className="text-[10px] text-muted-foreground">{m.label}</span>
                                            <span className={`text-sm font-bold tabular-nums text-${m.color}-600`}>{m.value}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* History Timeline */}
                        <div className="rounded-xl border bg-card overflow-hidden">
                            <div className="px-4 py-3 border-b flex items-center gap-2 bg-gradient-to-r from-purple-50/80 to-transparent dark:from-purple-950/20">
                                <Activity className="w-4 h-4 text-purple-500"/>
                                <span className="font-semibold text-sm">Job History</span>
                                <Badge variant="outline" className="ml-auto text-[9px]">{liveStats.queue.recentHistory.length} records</Badge>
                            </div>
                            <div className="p-3">
                                {liveStats.queue.recentHistory.length > 0 ? (
                                    <ScrollArea className="h-[230px]">
                                        <div className="space-y-1">
                                            {liveStats.queue.recentHistory.map((h: any, i: number) => (
                                                <div key={i} className="flex items-center gap-3 text-xs p-2.5 rounded-lg hover:bg-muted/50 cursor-pointer transition-all group/hist"
                                                    onClick={() => setQueueDetail({ type: 'history', data: h })}>
                                                    <div className={cn("w-2 h-2 rounded-full flex-shrink-0 ring-2 ring-offset-1 ring-offset-background", h.success ? "bg-emerald-500 ring-emerald-200" : "bg-red-500 ring-red-200")}/>
                                                    <span className="font-mono text-muted-foreground w-14">{h.completedAtFormatted}</span>
                                                    <span className="font-mono font-medium flex-1 truncate">{h.userId}</span>
                                                    <span className="text-muted-foreground">{h.groupCount}g</span>
                                                    <span className="font-mono font-semibold tabular-nums w-12 text-right">{h.durationFormatted}</span>
                                                    <div className={cn("w-5 h-5 rounded flex items-center justify-center opacity-0 group-hover/hist:opacity-100 transition-opacity", h.success ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-600")}>
                                                        {h.success ? <Check className="w-3 h-3"/> : <AlertCircle className="w-3 h-3"/>}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </ScrollArea>
                                ) : (
                                    <div className="py-10 text-center">
                                        <div className="w-14 h-14 mx-auto rounded-full bg-purple-50 dark:bg-purple-950/20 flex items-center justify-center mb-3"><Activity className="w-6 h-6 text-purple-300"/></div>
                                        <p className="text-sm text-muted-foreground">No history yet</p>
                                        <p className="text-[10px] text-muted-foreground/60 mt-0.5">Records appear after automation completes</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>)}

                {/* ═══ Queue Detail Dialog ═══ */}
                <Dialog open={!!queueDetail} onOpenChange={() => setQueueDetail(null)}>
                    <DialogContent className="max-w-lg">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                {queueDetail?.type === 'running' && <><div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse"/>Running Job</>}
                                {queueDetail?.type === 'queued' && <><Clock className="w-4 h-4 text-amber-500"/>Queued Job</>}
                                {queueDetail?.type === 'history' && <><Activity className="w-4 h-4 text-purple-500"/>Job History</>}
                                {queueDetail?.type === 'stats' && <><BarChart3 className="w-4 h-4"/>Queue Statistics</>}
                                {queueDetail?.type === 'system' && <><Monitor className="w-4 h-4 text-blue-500"/>System Status</>}
                                {queueDetail?.type === 'slots' && <><Zap className="w-4 h-4 text-orange-500"/>Queue Slots Detail</>}
                            </DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                            {/* Running Job Detail */}
                            {queueDetail?.type === 'running' && queueDetail.data && (
                                <div className="space-y-3">
                                    <div className="p-4 rounded-xl bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
                                        <div className="grid grid-cols-2 gap-3 text-sm">
                                            <div><p className="text-muted-foreground text-xs">User ID</p><p className="font-mono font-semibold">{queueDetail.data.fullUserId || queueDetail.data.userId}</p></div>
                                            <div><p className="text-muted-foreground text-xs">Groups</p><p className="font-semibold">{queueDetail.data.groupCount} กลุ่ม</p></div>
                                            <div><p className="text-muted-foreground text-xs">Runtime</p><p className="font-mono font-semibold text-green-700">{Math.floor(queueDetail.data.runningSec/60)}:{String(queueDetail.data.runningSec%60).padStart(2,'0')}</p></div>
                                            <div><p className="text-muted-foreground text-xs">Started</p><p className="font-mono text-xs">{new Date(queueDetail.data.startedAt).toLocaleTimeString('th-TH',{hour12:false})}</p></div>
                                        </div>
                                    </div>
                                    <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">กำลังทำงาน</Badge>
                                </div>
                            )}
                            {/* Queued Job Detail */}
                            {queueDetail?.type === 'queued' && queueDetail.data && (
                                <div className="space-y-3">
                                    <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                                        <div className="grid grid-cols-2 gap-3 text-sm">
                                            <div><p className="text-muted-foreground text-xs">User ID</p><p className="font-mono font-semibold">{queueDetail.data.fullUserId || queueDetail.data.userId}</p></div>
                                            <div><p className="text-muted-foreground text-xs">Position</p><p className="font-semibold text-amber-700">#{queueDetail.data.position}</p></div>
                                            <div><p className="text-muted-foreground text-xs">Groups</p><p className="font-semibold">{queueDetail.data.groupCount} กลุ่ม</p></div>
                                            <div><p className="text-muted-foreground text-xs">Waiting</p><p className="font-mono">{Math.floor(queueDetail.data.waitingSec/60)}:{String(queueDetail.data.waitingSec%60).padStart(2,'0')}</p></div>
                                            <div><p className="text-muted-foreground text-xs">Est. Wait</p><p className="font-mono">~{Math.ceil(queueDetail.data.estimatedWaitSec/60)} นาที</p></div>
                                            <div><p className="text-muted-foreground text-xs">Enqueued</p><p className="font-mono text-xs">{new Date(queueDetail.data.enqueuedAt).toLocaleTimeString('th-TH',{hour12:false})}</p></div>
                                        </div>
                                    </div>
                                    <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">รอคิว</Badge>
                                </div>
                            )}
                            {/* History Job Detail */}
                            {queueDetail?.type === 'history' && queueDetail.data && (
                                <div className="space-y-3">
                                    <div className={cn("p-4 rounded-xl border",queueDetail.data.success?"bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800":"bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800")}>
                                        <div className="grid grid-cols-2 gap-3 text-sm">
                                            <div><p className="text-muted-foreground text-xs">User ID</p><p className="font-mono font-semibold">{queueDetail.data.userId}</p></div>
                                            <div><p className="text-muted-foreground text-xs">Status</p><p className="font-semibold">{queueDetail.data.success?'✅ สำเร็จ':'❌ ล้มเหลว'}</p></div>
                                            <div><p className="text-muted-foreground text-xs">Groups</p><p className="font-semibold">{queueDetail.data.groupCount} กลุ่ม</p></div>
                                            <div><p className="text-muted-foreground text-xs">Duration</p><p className="font-mono font-semibold">{queueDetail.data.durationFormatted}</p></div>
                                            <div><p className="text-muted-foreground text-xs">Completed</p><p className="font-mono text-xs">{queueDetail.data.completedAtFormatted}</p></div>
                                            <div><p className="text-muted-foreground text-xs">Seconds</p><p className="font-mono">{queueDetail.data.durationSec}s</p></div>
                                        </div>
                                    </div>
                                </div>
                            )}
                            {/* Stats Detail */}
                            {queueDetail?.type === 'stats' && queueDetail.data && (
                                <div className="space-y-3">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="p-3 rounded-xl bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 text-center"><p className="text-2xl font-bold text-green-600">{queueDetail.data.totalCompleted}</p><p className="text-xs text-muted-foreground">Jobs สำเร็จ</p></div>
                                        <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 text-center"><p className="text-2xl font-bold text-red-600">{queueDetail.data.totalFailed}</p><p className="text-xs text-muted-foreground">Jobs ล้มเหลว</p></div>
                                    </div>
                                    <Separator />
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between"><span className="text-muted-foreground">Success Rate</span><span className="font-bold text-lg">{queueDetail.data.successRate}%</span></div>
                                        <div className="h-3 bg-muted rounded-full overflow-hidden"><div className="h-full bg-green-500 rounded-full" style={{width:`${queueDetail.data.successRate}%`}}/></div>
                                    </div>
                                    <Separator />
                                    <div className="grid grid-cols-3 gap-3 text-center">
                                        <div><p className="font-mono font-semibold">{queueDetail.data.avgDurationFormatted}</p><p className="text-[10px] text-muted-foreground">เฉลี่ย</p></div>
                                        <div><p className="font-mono font-semibold">{Math.floor(queueDetail.data.longestJobSec/60)}:{String(queueDetail.data.longestJobSec%60).padStart(2,'0')}</p><p className="text-[10px] text-muted-foreground">นานสุด</p></div>
                                        <div><p className="font-mono font-semibold">{Math.floor(queueDetail.data.shortestJobSec/60)}:{String(queueDetail.data.shortestJobSec%60).padStart(2,'0')}</p><p className="text-[10px] text-muted-foreground">เร็วสุด</p></div>
                                    </div>
                                    <Separator />
                                    <div className="flex justify-between text-sm"><span className="text-muted-foreground">Total Processed</span><span className="font-bold">{queueDetail.data.totalProcessed}</span></div>
                                </div>
                            )}
                            {/* System Detail */}
                            {queueDetail?.type === 'system' && queueDetail.data && (
                                <div className="space-y-3">
                                    <div className="space-y-2">
                                        <p className="text-sm font-semibold">Browser Pool</p>
                                        <div className="flex items-center gap-3">
                                            <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden"><div className="h-full bg-blue-500 rounded-full transition-all" style={{width:`${(queueDetail.data.activeBrowsers/(queueDetail.data.maxBrowsers||10))*100}%`}}/></div>
                                            <span className="font-mono font-semibold text-sm">{queueDetail.data.activeBrowsers}/{queueDetail.data.maxBrowsers}</span>
                                        </div>
                                    </div>
                                    <Separator />
                                    <div className="grid grid-cols-2 gap-3 text-sm">
                                        <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground">Sessions</p><p className="font-semibold text-lg">{queueDetail.data.totalSessions}</p></div>
                                        <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/20"><p className="text-xs text-muted-foreground">Online</p><p className="font-semibold text-lg text-green-600">{queueDetail.data.onlineUsers}</p></div>
                                        <div className="p-3 rounded-lg bg-orange-50 dark:bg-orange-950/20"><p className="text-xs text-muted-foreground">Automation</p><p className="font-semibold text-lg text-orange-600">{queueDetail.data.automationUsers}</p></div>
                                        <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20"><p className="text-xs text-muted-foreground">Runs Today</p><p className="font-semibold text-lg text-blue-600">{queueDetail.data.automation?.totalRunsToday || 0}</p></div>
                                    </div>
                                    <Separator />
                                    <div className="grid grid-cols-2 gap-3 text-sm">
                                        <div className="flex justify-between"><span className="text-muted-foreground">Tasks ✅</span><span className="font-semibold text-green-600">{queueDetail.data.automation?.totalTasksCompleted || 0}</span></div>
                                        <div className="flex justify-between"><span className="text-muted-foreground">Tasks ❌</span><span className="font-semibold text-red-600">{queueDetail.data.automation?.totalTasksFailed || 0}</span></div>
                                        <div className="flex justify-between"><span className="text-muted-foreground">Tasks Pending</span><span className="font-semibold">{queueDetail.data.automation?.totalTasksPending || 0}</span></div>
                                        <div className="flex justify-between"><span className="text-muted-foreground">Active Users</span><span className="font-semibold">{queueDetail.data.activeUsers || 0}</span></div>
                                    </div>
                                </div>
                            )}
                            {/* Slots Detail */}
                            {queueDetail?.type === 'slots' && queueDetail.data && (
                                <div className="space-y-3">
                                    <div className="grid grid-cols-5 gap-2">
                                        {Array.from({length:queueDetail.data.maxConcurrent},(_: any,i: number)=>{
                                            const isActive = i < queueDetail.data.runningCount;
                                            const runningJob = isActive ? queueDetail.data.running[i] : null;
                                            return (<div key={i} className={cn("p-2 rounded-lg border text-center",isActive?"bg-green-50 dark:bg-green-950/20 border-green-300":"bg-muted/50 border-transparent")}>
                                                <p className="text-xs font-bold">{i+1}</p>
                                                {runningJob ? (<>
                                                    <p className="text-[9px] font-mono truncate">{runningJob.userId}</p>
                                                    <p className="text-[9px] text-green-600">{runningJob.groupCount}g</p>
                                                </>) : <p className="text-[9px] text-muted-foreground">ว่าง</p>}
                                            </div>);
                                        })}
                                    </div>
                                    <Separator />
                                    <div className="grid grid-cols-3 gap-3 text-center text-sm">
                                        <div><p className="font-bold text-green-600">{queueDetail.data.runningCount}</p><p className="text-[10px] text-muted-foreground">Running</p></div>
                                        <div><p className="font-bold text-amber-600">{queueDetail.data.queueLength}</p><p className="text-[10px] text-muted-foreground">Waiting</p></div>
                                        <div><p className="font-bold">{queueDetail.data.maxConcurrent - queueDetail.data.runningCount}</p><p className="text-[10px] text-muted-foreground">Available</p></div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </DialogContent>
                </Dialog>
            </>)}

            </div>{/* end max-w container */}

            {/* Create License Modal */}
            <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>สร้าง License Key ใหม่</DialogTitle>
                        <DialogDescription>สร้างคีย์ใหม่สำหรับลูกค้า กำหนดแพ็คเกจและวันหมดอายุ</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2"><Label>แพ็คเกจ</Label><Select value={newLicense.package} onValueChange={val=>setNewLicense({...newLicense,package:val})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="agent">Top Agent (฿1,390)</SelectItem><SelectItem value="elite">Elite (฿2,990)</SelectItem><SelectItem value="free">Rookie (Free)</SelectItem></SelectContent></Select></div>
                        <div className="grid gap-2"><Label>ระยะเวลา (วัน)</Label><Select value={newLicense.durationDays.toString()} onValueChange={val=>setNewLicense({...newLicense,durationDays:parseInt(val)})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="30">30 วัน (1 เดือน)</SelectItem><SelectItem value="90">90 วัน (3 เดือน)</SelectItem><SelectItem value="180">180 วัน (6 เดือน)</SelectItem><SelectItem value="365">365 วัน (1 ปี)</SelectItem></SelectContent></Select></div>
                        <div className="grid gap-2"><Label>ชื่อลูกค้า (Optional)</Label><Input value={newLicense.ownerName} onChange={e=>setNewLicense({...newLicense,ownerName:e.target.value})} placeholder="เช่น คุณสมชาย A."/></div>
                        <div className="grid gap-2"><Label>ช่องทางติดต่อ (Optional)</Label><Input value={newLicense.ownerContact} onChange={e=>setNewLicense({...newLicense,ownerContact:e.target.value})} placeholder="Email, Line ID, หรือเบอร์โทร"/></div>
                        <div className="grid gap-2"><Label>หมายเหตุ (Optional)</Label><Input value={newLicense.note} onChange={e=>setNewLicense({...newLicense,note:e.target.value})} placeholder="บันทึกเพิ่มเติม..."/></div>
                    </div>
                    <DialogFooter><Button variant="outline" onClick={()=>setShowCreateModal(false)}>ยกเลิก</Button><Button onClick={handleCreateLicense}>ยืนยันการสร้าง</Button></DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation */}
            <Dialog open={!!deleteTarget} onOpenChange={open=>!open&&setDeleteTarget(null)}>
                <DialogContent>
                    <DialogHeader><DialogTitle className="flex items-center gap-2 text-red-600"><Trash2 className="w-5 h-5"/>ยืนยันการลบ License</DialogTitle><DialogDescription>การกระทำนี้ไม่สามารถย้อนกลับได้</DialogDescription></DialogHeader>
                    {deleteTarget&&<div className="py-3"><div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800"><p className="font-mono text-sm font-semibold text-center">{deleteTarget.key}</p></div></div>}
                    <DialogFooter><Button variant="outline" onClick={()=>setDeleteTarget(null)}>ยกเลิก</Button><Button variant="destructive" onClick={()=>deleteTarget&&deleteLicense(deleteTarget.id)}><Trash2 className="w-4 h-4 mr-2"/>ลบ License</Button></DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
