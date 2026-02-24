
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
            running: { userId: string; groupCount: number; runningSec: number }[];
            queue: { position: number; userId: string; groupCount: number; waitingSec: number }[];
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
                                                <TableHead className="text-xs">User ID</TableHead>
                                                <TableHead className="text-xs">สถานะ</TableHead>
                                                <TableHead className="text-xs">Automation</TableHead>
                                                <TableHead className="text-xs">โพสต์วันนี้</TableHead>
                                                <TableHead className="text-xs">สั่งการ</TableHead>
                                                <TableHead className="text-xs">Tasks</TableHead>
                                            </TableRow></TableHeader>
                                            <TableBody>
                                                {liveStats.users.map(u => (
                                                    <TableRow key={u.userId}>
                                                        <TableCell className="font-mono text-xs">{u.userId}</TableCell>
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

            {/* ═══════════════ TAB: SYSTEM & QUEUE ═══════════════ */}
            {activeTab === 'system' && (<>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Queue Status */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2"><Zap className="w-5 h-5 text-orange-500"/>Automation Queue</CardTitle>
                            <CardDescription>จำกัด automation พร้อมกันเพื่อให้ VPS เสถียร</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {liveStats?.queue ? (
                                <div className="space-y-4">
                                    <div className="flex items-center gap-4">
                                        <div className="text-center"><p className="text-3xl font-bold">{liveStats.queue.runningCount}</p><p className="text-xs text-muted-foreground">กำลังรัน</p></div>
                                        <div className="text-2xl text-muted-foreground">/</div>
                                        <div className="text-center"><p className="text-3xl font-bold">{liveStats.queue.maxConcurrent}</p><p className="text-xs text-muted-foreground">สูงสุด</p></div>
                                        <div className="ml-auto text-center"><p className="text-3xl font-bold text-amber-600">{liveStats.queue.queueLength}</p><p className="text-xs text-muted-foreground">รอคิว</p></div>
                                    </div>
                                    {/* Slot Bar */}
                                    <div className="flex gap-1">{Array.from({length:liveStats.queue.maxConcurrent},(_,i)=>(<div key={i} className={cn("flex-1 h-3 rounded-full",i<liveStats.queue.runningCount?"bg-green-500 animate-pulse":"bg-muted")}/>))}</div>

                                    {liveStats.queue.running.length > 0 && (<div className="space-y-1.5"><p className="text-xs font-medium text-muted-foreground">▶ Running</p>{liveStats.queue.running.map((r,i)=>(<div key={i} className="flex items-center justify-between text-xs p-2 bg-green-50 dark:bg-green-950/20 rounded-lg"><span className="font-mono">{r.userId}</span><span>{r.groupCount} กลุ่ม • {Math.floor(r.runningSec/60)}:{String(r.runningSec%60).padStart(2,'0')}</span></div>))}</div>)}
                                    {liveStats.queue.queue.length > 0 && (<div className="space-y-1.5"><p className="text-xs font-medium text-muted-foreground">⏳ Waiting</p>{liveStats.queue.queue.map((q,i)=>(<div key={i} className="flex items-center justify-between text-xs p-2 bg-amber-50 dark:bg-amber-950/20 rounded-lg"><span>#{q.position} <span className="font-mono">{q.userId}</span></span><span>{q.groupCount} กลุ่ม • รอ {Math.floor(q.waitingSec/60)}:{String(q.waitingSec%60).padStart(2,'0')}</span></div>))}</div>)}
                                    {liveStats.queue.running.length===0 && liveStats.queue.queue.length===0 && <p className="text-center text-sm text-muted-foreground py-4">ไม่มี automation ในระบบตอนนี้</p>}
                                </div>
                            ) : <div className="flex items-center justify-center py-8 text-muted-foreground gap-2"><Loader2 className="w-5 h-5 animate-spin"/>กำลังโหลด...</div>}
                        </CardContent>
                    </Card>

                    {/* System Health */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2"><Monitor className="w-5 h-5 text-blue-500"/>สถานะระบบ</CardTitle>
                            <CardDescription>ทรัพยากรและการเชื่อมต่อ</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm"><span>Browser Pool</span><span className="font-semibold">{liveStats?.activeBrowsers ?? 0}/{liveStats?.maxBrowsers ?? 10}</span></div>
                                    <div className="h-3 bg-muted rounded-full overflow-hidden"><div className="h-full bg-blue-500 rounded-full transition-all" style={{width:`${((liveStats?.activeBrowsers??0)/(liveStats?.maxBrowsers||10))*100}%`}}/></div>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm"><span>Sessions</span><span className="font-semibold">{liveStats?.totalSessions ?? 0}</span></div>
                                    <div className="flex justify-between text-sm"><span>Online Users</span><span className="font-semibold text-green-600">{liveStats?.onlineUsers ?? 0}</span></div>
                                    <div className="flex justify-between text-sm"><span>Automation Users</span><span className="font-semibold text-orange-600">{liveStats?.automationUsers ?? 0}</span></div>
                                </div>
                                <div className="pt-3 border-t space-y-2">
                                    <div className="flex justify-between text-sm"><span>Tasks Completed Today</span><span className="font-semibold text-green-600">{liveStats?.automation.totalTasksCompleted ?? 0}</span></div>
                                    <div className="flex justify-between text-sm"><span>Tasks Failed Today</span><span className="font-semibold text-red-600">{liveStats?.automation.totalTasksFailed ?? 0}</span></div>
                                    <div className="flex justify-between text-sm"><span>Automation Runs Today</span><span className="font-semibold">{liveStats?.automation.totalRunsToday ?? 0}</span></div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
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
