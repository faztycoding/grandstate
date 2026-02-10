
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ADMIN_SECRET, isAdminEmail } from '@/lib/config';
import { User } from '@supabase/supabase-js';
import { motion } from 'framer-motion';
import {
    Users,
    Key,
    DollarSign,
    Package,
    Search,
    Plus,
    Trash2,
    Edit,
    RefreshCw,
    Crown,
    Star,
    Rocket,
    Check,
    X,
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

    // Admin auth state
    const [adminUser, setAdminUser] = useState<User | null>(null);
    const [adminEmail, setAdminEmail] = useState('');
    const [adminPassword, setAdminPassword] = useState('');
    const [adminLoginError, setAdminLoginError] = useState<string | null>(null);
    const [adminLoggingIn, setAdminLoggingIn] = useState(false);
    const [checkingSession, setCheckingSession] = useState(true);

    // Check URL secret
    const { secret } = useParams<{ secret: string }>();
    const isAuthorized = !!ADMIN_SECRET && secret === ADMIN_SECRET;

    useEffect(() => {
        if (!isAuthorized) {
            navigate('/');
            return;
        }
        // Check existing Supabase session
        supabase.auth.getUser().then(({ data: { user } }) => {
            if (user && isAdminEmail(user.email)) {
                setAdminUser(user);
            }
            setCheckingSession(false);
        });
    }, [isAuthorized, navigate]);

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
        } catch (error) {
            console.error('Create error:', error);
            toast.error('สร้าง License ไม่สำเร็จ');
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

    // Show nothing if URL secret is wrong (will redirect)
    if (!isAuthorized) return null;

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

    return (
        <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 p-4 md:p-6">
            <div className="max-w-7xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
                            <Shield className="w-6 h-6 md:w-8 md:h-8 text-accent" />
                            Admin Dashboard
                        </h1>
                        <p className="text-sm text-muted-foreground">จัดการ License Keys และผู้ใช้งาน</p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <Button variant="outline" size="sm" onClick={exportToCSV}>
                            <Download className="w-4 h-4 sm:mr-2" />
                            <span className="hidden sm:inline">Export CSV</span>
                        </Button>
                        <Button size="sm" onClick={() => setShowCreateModal(true)}>
                            <Plus className="w-4 h-4 sm:mr-2" />
                            <span className="hidden sm:inline">สร้าง License ใหม่</span>
                        </Button>
                        <Button variant="destructive" size="sm" onClick={handleLogout}>
                            <LogOut className="w-4 h-4 sm:mr-2" />
                            <span className="hidden sm:inline">ออกจากระบบ</span>
                        </Button>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-4">
                                <div className="p-3 rounded-xl bg-blue-100">
                                    <Key className="w-6 h-6 text-blue-600" />
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">License ทั้งหมด</p>
                                    <p className="text-2xl font-bold">{stats.totalLicenses}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-4">
                                <div className="p-3 rounded-xl bg-green-100">
                                    <Check className="w-6 h-6 text-green-600" />
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">ใช้งานอยู่</p>
                                    <p className="text-2xl font-bold">{stats.activeLicenses}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-4">
                                <div className="p-3 rounded-xl bg-amber-100">
                                    <Clock className="w-6 h-6 text-amber-600" />
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">ใกล้หมดอายุ</p>
                                    <p className="text-2xl font-bold">{stats.expiringLicenses}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-4">
                                <div className="p-3 rounded-xl bg-purple-100">
                                    <DollarSign className="w-6 h-6 text-purple-600" />
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">รายได้รวม (ประมาณ)</p>
                                    <p className="text-2xl font-bold">฿{stats.totalRevenue.toLocaleString()}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Analytics Charts */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Package Distribution */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <PieChart className="w-5 h-5" />
                                สัดส่วนแพ็คเกจ
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {(() => {
                                    const freeCount = licenses.filter(l => l.package === 'free').length;
                                    const agentCount = licenses.filter(l => l.package === 'agent').length;
                                    const eliteCount = licenses.filter(l => l.package === 'elite').length;
                                    const total = licenses.length || 1;

                                    return (
                                        <>
                                            <div className="space-y-2">
                                                <div className="flex justify-between text-sm">
                                                    <span className="flex items-center gap-2">
                                                        <Rocket className="w-4 h-4 text-emerald-500" />
                                                        Rookie
                                                    </span>
                                                    <span>{freeCount} ({Math.round(freeCount / total * 100)}%)</span>
                                                </div>
                                                <div className="h-3 bg-muted rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-emerald-500 rounded-full transition-all"
                                                        style={{ width: `${freeCount / total * 100}%` }}
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <div className="flex justify-between text-sm">
                                                    <span className="flex items-center gap-2">
                                                        <Star className="w-4 h-4 text-amber-500" />
                                                        Top Agent
                                                    </span>
                                                    <span>{agentCount} ({Math.round(agentCount / total * 100)}%)</span>
                                                </div>
                                                <div className="h-3 bg-muted rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-amber-500 rounded-full transition-all"
                                                        style={{ width: `${agentCount / total * 100}%` }}
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <div className="flex justify-between text-sm">
                                                    <span className="flex items-center gap-2">
                                                        <Crown className="w-4 h-4 text-purple-500" />
                                                        Elite
                                                    </span>
                                                    <span>{eliteCount} ({Math.round(eliteCount / total * 100)}%)</span>
                                                </div>
                                                <div className="h-3 bg-muted rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-purple-500 rounded-full transition-all"
                                                        style={{ width: `${eliteCount / total * 100}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </>
                                    );
                                })()}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Revenue by Package */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <BarChart3 className="w-5 h-5" />
                                รายได้ตามแพ็คเกจ
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {(() => {
                                    const agentRevenue = licenses.filter(l => l.package === 'agent').length * 1390;
                                    const eliteRevenue = licenses.filter(l => l.package === 'elite').length * 2990;
                                    const maxRevenue = Math.max(agentRevenue, eliteRevenue, 1);

                                    return (
                                        <>
                                            <div className="space-y-2">
                                                <div className="flex justify-between text-sm">
                                                    <span className="flex items-center gap-2">
                                                        <Star className="w-4 h-4 text-amber-500" />
                                                        Top Agent (฿1,390)
                                                    </span>
                                                    <span className="font-semibold">฿{agentRevenue.toLocaleString()}</span>
                                                </div>
                                                <div className="h-6 bg-muted rounded-lg overflow-hidden">
                                                    <div
                                                        className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-lg transition-all flex items-center justify-end pr-2"
                                                        style={{ width: `${agentRevenue / maxRevenue * 100}%` }}
                                                    >
                                                        {agentRevenue > 0 && (
                                                            <span className="text-xs font-medium text-white">
                                                                {licenses.filter(l => l.package === 'agent').length} ใบ
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <div className="flex justify-between text-sm">
                                                    <span className="flex items-center gap-2">
                                                        <Crown className="w-4 h-4 text-purple-500" />
                                                        Elite (฿2,990)
                                                    </span>
                                                    <span className="font-semibold">฿{eliteRevenue.toLocaleString()}</span>
                                                </div>
                                                <div className="h-6 bg-muted rounded-lg overflow-hidden">
                                                    <div
                                                        className="h-full bg-gradient-to-r from-purple-400 to-purple-500 rounded-lg transition-all flex items-center justify-end pr-2"
                                                        style={{ width: `${eliteRevenue / maxRevenue * 100}%` }}
                                                    >
                                                        {eliteRevenue > 0 && (
                                                            <span className="text-xs font-medium text-white">
                                                                {licenses.filter(l => l.package === 'elite').length} ใบ
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="pt-4 border-t mt-4">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-muted-foreground">รายได้รวมทั้งหมด</span>
                                                    <span className="text-2xl font-bold text-green-600">
                                                        ฿{(agentRevenue + eliteRevenue).toLocaleString()}
                                                    </span>
                                                </div>
                                            </div>
                                        </>
                                    );
                                })()}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Expiring Soon Alert */}
                {(() => {
                    const now = new Date();
                    const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
                    const expiringLicenses = licenses.filter(l => {
                        const expiry = new Date(l.expires_at);
                        return l.is_active && expiry > now && expiry <= sevenDays;
                    });

                    if (expiringLicenses.length === 0) return null;

                    return (
                        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
                            <CardHeader className="pb-2">
                                <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                                    <AlertCircle className="w-5 h-5" />
                                    ⚠️ License ใกล้หมดอายุ ({expiringLicenses.length} รายการ)
                                </CardTitle>
                                <CardDescription className="text-amber-600 dark:text-amber-500">
                                    License เหล่านี้จะหมดอายุภายใน 7 วัน - พิจารณาติดต่อลูกค้าเพื่อต่ออายุ
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    {expiringLicenses.slice(0, 5).map(license => {
                                        const daysLeft = Math.ceil(
                                            (new Date(license.expires_at).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
                                        );
                                        return (
                                            <div
                                                key={license.id}
                                                className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <code className="text-sm font-mono bg-muted px-2 py-1 rounded">
                                                        {license.license_key}
                                                    </code>
                                                    <span className="text-sm text-muted-foreground">
                                                        {license.owner_name || 'ไม่ระบุชื่อ'}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Badge className={cn(
                                                        daysLeft <= 2 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                                                    )}>
                                                        เหลือ {daysLeft} วัน
                                                    </Badge>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => extendLicense(license.id, 30)}
                                                    >
                                                        <Calendar className="w-3 h-3 mr-1" />
                                                        +30 วัน
                                                    </Button>
                                                    {license.owner_contact && (
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={() => copyToClipboard(license.owner_contact || '')}
                                                        >
                                                            <Copy className="w-3 h-3" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {expiringLicenses.length > 5 && (
                                        <p className="text-sm text-amber-600 text-center pt-2">
                                            และอีก {expiringLicenses.length - 5} รายการ...
                                        </p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    );
                })()}

                {/* Monthly Report */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <TrendingUp className="w-5 h-5" />
                            รายงานรายเดือน (6 เดือนล่าสุด)
                        </CardTitle>
                        <CardDescription>
                            สรุปยอดสร้าง License และรายได้ในแต่ละเดือน
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {(() => {
                            // Calculate monthly data for last 6 months
                            const months: { month: string; count: number; revenue: number; }[] = [];
                            const now = new Date();

                            for (let i = 5; i >= 0; i--) {
                                const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
                                const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);

                                const monthLicenses = licenses.filter(l => {
                                    const created = new Date(l.created_at);
                                    return created >= date && created <= monthEnd;
                                });

                                const revenue = monthLicenses.reduce((sum, l) => {
                                    if (l.package === 'agent') return sum + 1390;
                                    if (l.package === 'elite') return sum + 2990;
                                    return sum;
                                }, 0);

                                months.push({
                                    month: date.toLocaleDateString('th-TH', { month: 'short', year: '2-digit' }),
                                    count: monthLicenses.length,
                                    revenue,
                                });
                            }

                            const maxCount = Math.max(...months.map(m => m.count), 1);
                            const maxRevenue = Math.max(...months.map(m => m.revenue), 1);

                            return (
                                <div className="space-y-6">
                                    {/* License Count Chart */}
                                    <div>
                                        <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                                            <Key className="w-4 h-4" />
                                            จำนวน License ที่สร้าง
                                        </h4>
                                        <div className="flex items-end gap-2 h-32">
                                            {months.map((m, idx) => (
                                                <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                                                    <span className="text-xs font-medium">{m.count}</span>
                                                    <div
                                                        className="w-full bg-gradient-to-t from-blue-500 to-blue-400 rounded-t transition-all"
                                                        style={{
                                                            height: `${(m.count / maxCount) * 100}%`,
                                                            minHeight: m.count > 0 ? '8px' : '2px',
                                                        }}
                                                    />
                                                    <span className="text-xs text-muted-foreground">{m.month}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Revenue Chart */}
                                    <div className="pt-4 border-t">
                                        <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                                            <DollarSign className="w-4 h-4" />
                                            รายได้ (บาท)
                                        </h4>
                                        <div className="flex items-end gap-2 h-32">
                                            {months.map((m, idx) => (
                                                <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                                                    <span className="text-xs font-medium">
                                                        {m.revenue > 0 ? `฿${(m.revenue / 1000).toFixed(1)}k` : '-'}
                                                    </span>
                                                    <div
                                                        className="w-full bg-gradient-to-t from-green-500 to-emerald-400 rounded-t transition-all"
                                                        style={{
                                                            height: `${(m.revenue / maxRevenue) * 100}%`,
                                                            minHeight: m.revenue > 0 ? '8px' : '2px',
                                                        }}
                                                    />
                                                    <span className="text-xs text-muted-foreground">{m.month}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Summary */}
                                    <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                                        <div className="text-center p-3 bg-muted rounded-lg">
                                            <p className="text-2xl font-bold text-blue-600">
                                                {months.reduce((s, m) => s + m.count, 0)}
                                            </p>
                                            <p className="text-xs text-muted-foreground">License ทั้งหมด</p>
                                        </div>
                                        <div className="text-center p-3 bg-muted rounded-lg">
                                            <p className="text-2xl font-bold text-green-600">
                                                ฿{months.reduce((s, m) => s + m.revenue, 0).toLocaleString()}
                                            </p>
                                            <p className="text-xs text-muted-foreground">รายได้รวม 6 เดือน</p>
                                        </div>
                                        <div className="text-center p-3 bg-muted rounded-lg">
                                            <p className="text-2xl font-bold text-purple-600">
                                                ฿{Math.round(months.reduce((s, m) => s + m.revenue, 0) / 6).toLocaleString()}
                                            </p>
                                            <p className="text-xs text-muted-foreground">เฉลี่ย/เดือน</p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}
                    </CardContent>
                </Card>

                {/* Filters */}
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex flex-col md:flex-row gap-4">
                            <div className="flex-1">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <Input
                                        placeholder="ค้นหา License Key, ชื่อ, หรืออีเมล..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="pl-10"
                                    />
                                </div>
                            </div>
                            <Select value={filterPackage} onValueChange={setFilterPackage}>
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue placeholder="แพ็คเกจ" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">ทั้งหมด</SelectItem>
                                    <SelectItem value="free">Rookie (Free)</SelectItem>
                                    <SelectItem value="agent">Top Agent</SelectItem>
                                    <SelectItem value="elite">Elite</SelectItem>
                                </SelectContent>
                            </Select>
                            <Select value={filterStatus} onValueChange={setFilterStatus}>
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue placeholder="สถานะ" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">ทั้งหมด</SelectItem>
                                    <SelectItem value="active">ใช้งานอยู่</SelectItem>
                                    <SelectItem value="inactive">หมดอายุ</SelectItem>
                                </SelectContent>
                            </Select>
                            <Button variant="outline" onClick={fetchLicenses}>
                                <RefreshCw className={cn("w-4 h-4 mr-2", isLoading && "animate-spin")} />
                                รีเฟรช
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* License List */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Key className="w-5 h-5 text-primary" />
                            License Keys ({filteredLicenses.length})
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ScrollArea className="h-[500px]">
                          <div className="overflow-x-auto">
                            <Table className="min-w-[700px]">
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>License Key</TableHead>
                                        <TableHead>แพ็คเกจ</TableHead>
                                        <TableHead>เจ้าของ</TableHead>
                                        <TableHead>FB Sessions</TableHead>
                                        <TableHead>วันหมดอายุ</TableHead>
                                        <TableHead>สถานะ</TableHead>
                                        <TableHead className="text-right">จัดการ</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredLicenses.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                                                <Key className="w-12 h-12 mx-auto mb-4 opacity-20" />
                                                ไม่พบ License Key
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredLicenses.map((license) => {
                                            const expired = isExpired(license.expires_at);
                                            const expiringSoon = isExpiringSoon(license.expires_at);

                                            return (
                                                <TableRow key={license.id}>
                                                    <TableCell className="font-mono">{license.license_key}</TableCell>
                                                    <TableCell>
                                                        <Badge variant={license.package === 'elite' ? 'default' : 'secondary'}>
                                                            {packageLabels[license.package]}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div>
                                                            <div className="font-medium">{license.owner_name || '-'}</div>
                                                            <div className="text-xs text-muted-foreground">{license.owner_contact}</div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        {license.max_fb_sessions} sessions
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className={cn(
                                                            "flex items-center gap-2",
                                                            expired ? "text-red-500 font-medium" :
                                                                expiringSoon ? "text-amber-500 font-medium" : ""
                                                        )}>
                                                            {formatDate(license.expires_at)}
                                                            {expiringSoon && !expired && (
                                                                <AlertCircle className="w-4 h-4" />
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant={license.is_active && !expired ? 'outline' : 'destructive'} className={cn(license.is_active && !expired && "border-green-500 text-green-500")}>
                                                            {license.is_active && !expired ? 'Active' : 'Inactive'}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex justify-end gap-2">
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => navigator.clipboard.writeText(license.license_key)}
                                                            >
                                                                <Copy className="w-4 h-4" />
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => extendLicense(license.id, 30)}
                                                            >
                                                                <Calendar className="w-4 h-4 text-green-600" />
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                className="text-red-500 hover:text-red-600 hover:bg-red-50"
                                                                onClick={() => setDeleteTarget({ id: license.id, key: license.license_key })}
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })
                                    )}
                                </TableBody>
                            </Table>
                          </div>
                        </ScrollArea>
                    </CardContent>
                </Card>
            </div>

            {/* Create License Modal */}
            <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>สร้าง License Key ใหม่</DialogTitle>
                        <DialogDescription>
                            สร้างคีย์ใหม่สำหรับลูกค้า กำหนดแพ็คเกจและวันหมดอายุ
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label>แพ็คเกจ</Label>
                            <Select
                                value={newLicense.package}
                                onValueChange={(val) => setNewLicense({ ...newLicense, package: val })}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="agent">Top Agent (฿1,390)</SelectItem>
                                    <SelectItem value="elite">Elite (฿2,990)</SelectItem>
                                    <SelectItem value="free">Rookie (Free)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid gap-2">
                            <Label>ระยะเวลา (วัน)</Label>
                            <Select
                                value={newLicense.durationDays.toString()}
                                onValueChange={(val) => setNewLicense({ ...newLicense, durationDays: parseInt(val) })}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="30">30 วัน (1 เดือน)</SelectItem>
                                    <SelectItem value="90">90 วัน (3 เดือน)</SelectItem>
                                    <SelectItem value="180">180 วัน (6 เดือน)</SelectItem>
                                    <SelectItem value="365">365 วัน (1 ปี)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid gap-2">
                            <Label>ชื่อลูกค้า (Optional)</Label>
                            <Input
                                value={newLicense.ownerName}
                                onChange={(e) => setNewLicense({ ...newLicense, ownerName: e.target.value })}
                                placeholder="เช่น คุณสมชาย A."
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label>ช่องทางติดต่อ (Optional)</Label>
                            <Input
                                value={newLicense.ownerContact}
                                onChange={(e) => setNewLicense({ ...newLicense, ownerContact: e.target.value })}
                                placeholder="Email, Line ID, หรือเบอร์โทร"
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label>หมายเหตุ (Optional)</Label>
                            <Input
                                value={newLicense.note}
                                onChange={(e) => setNewLicense({ ...newLicense, note: e.target.value })}
                                placeholder="บันทึกเพิ่มเติม..."
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowCreateModal(false)}>ยกเลิก</Button>
                        <Button onClick={handleCreateLicense}>ยืนยันการสร้าง</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-red-600">
                            <Trash2 className="w-5 h-5" />
                            ยืนยันการลบ License
                        </DialogTitle>
                        <DialogDescription>
                            คุณต้องการลบ License Key นี้หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้
                        </DialogDescription>
                    </DialogHeader>
                    {deleteTarget && (
                        <div className="py-3">
                            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
                                <p className="font-mono text-sm font-semibold text-center">{deleteTarget.key}</p>
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteTarget(null)}>ยกเลิก</Button>
                        <Button
                            variant="destructive"
                            onClick={() => deleteTarget && deleteLicense(deleteTarget.id)}
                        >
                            <Trash2 className="w-4 h-4 mr-2" />
                            ลบ License
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
