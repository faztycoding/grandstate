
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { isAdminEmail, apiFetch, API_BASE } from '@/lib/config';
import { useLanguage } from '@/i18n/LanguageContext';
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
    RadioReceiver,
    Filter,
    CheckCircle2,
    XCircle,
    StopCircle,
    Store,
    Hourglass,
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
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip as RechartsTooltip } from 'recharts';

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

// Animated counter hook — smoothly interpolates between values
function useAnimatedNumber(target: number, duration = 600) {
    const [display, setDisplay] = useState(target);
    const prevRef = useRef(target);
    const rafRef = useRef<number>();

    useEffect(() => {
        const from = prevRef.current;
        const to = target;
        if (from === to) return;
        prevRef.current = to;
        const start = performance.now();
        const step = (now: number) => {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
            setDisplay(Math.round(from + (to - from) * eased));
            if (progress < 1) rafRef.current = requestAnimationFrame(step);
        };
        rafRef.current = requestAnimationFrame(step);
        return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    }, [target, duration]);

    return display;
}

function AnimatedCounter({ value, suffix = '', className }: { value: number | string; suffix?: string; className?: string }) {
    const numericValue = typeof value === 'string' ? parseFloat(value) || 0 : value;
    const isPercentage = typeof value === 'string' && value.includes('%');
    const animated = useAnimatedNumber(numericValue);
    return <span className={className}>{animated}{isPercentage ? '%' : suffix}</span>;
}

export default function AdminDashboard() {
    const navigate = useNavigate();
    const { t } = useLanguage();
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

    // History filter: 'all' | 'success' | 'failed'
    const [historyFilter, setHistoryFilter] = useState<'all' | 'success' | 'failed'>('all');

    // SSE connection status
    const [sseConnected, setSseConnected] = useState(false);
    const [sseLastUpdate, setSseLastUpdate] = useState<number>(0);

    // Admin force-stop
    const [forceStoppingUser, setForceStoppingUser] = useState<string | null>(null);
    const handleForceStop = async (fullUserId: string, displayName: string) => {
        if (!confirm(t.admin.forceStopConfirm.replace('{name}', displayName))) return;
        setForceStoppingUser(fullUserId);
        try {
            const res = await apiFetch('/api/admin/force-stop', {
                method: 'POST',
                body: JSON.stringify({ targetUserId: fullUserId }),
            });
            const data = await res.json();
            if (data.success) {
                toast.success(t.admin.forceStopSuccess.replace('{name}', displayName), { description: data.message });
            } else {
                toast.error(data.error || t.admin.forceStopError);
            }
        } catch {
            toast.error(t.admin.errorGeneral);
        } finally {
            setForceStoppingUser(null);
        }
    };

    // License activations
    const [licenseActivations, setLicenseActivations] = useState<any[]>([]);
    const fetchLicenseActivations = useCallback(async () => {
        try {
            const res = await apiFetch('/api/admin/license-activations');
            const data = await res.json();
            if (data.success) setLicenseActivations(data.activations || []);
        } catch { /* silent */ }
    }, []);

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
            running: { userId: string; fullUserId: string; displayName?: string; email?: string; fbAccount?: string; propertyTitle?: string; groupCount: number; runningSec: number; startedAt: number; automationType?: string; progress?: any }[];
            queue: { position: number; userId: string; fullUserId: string; displayName?: string; groupCount: number; waitingSec: number; estimatedWaitSec: number; enqueuedAt: number; automationType?: string }[];
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
            recentHistory: { userId: string; groupCount: number; durationSec: number; durationFormatted: string; success: boolean; completedAtFormatted: string; automationType?: string }[];
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
                setAdminLoginError(t.admin.errorNoPermission);
                return;
            }
            const { data, error } = await supabase.auth.signInWithPassword({
                email: adminEmail.trim(),
                password: adminPassword,
            });
            if (error) {
                setAdminLoginError(error.message === 'Invalid login credentials'
                    ? t.admin.errorInvalidCredentials : error.message);
                return;
            }
            if (!data.user || !isAdminEmail(data.user.email)) {
                await supabase.auth.signOut();
                setAdminLoginError(t.admin.errorNoPermission);
                return;
            }
            setAdminUser(data.user);
        } catch {
            setAdminLoginError(t.admin.errorGeneral);
        } finally {
            setAdminLoggingIn(false);
        }
    };

    // Fetch licenses + activations after admin is authenticated
    useEffect(() => {
        if (adminUser) {
            fetchLicenses();
            fetchLicenseActivations();
        }
    }, [adminUser, fetchLicenseActivations]);

    // Connected to SSE stream (Real-time Elon Musk Level)
    useEffect(() => {
        if (!adminUser) return;

        let eventSource: EventSource | null = null;
        let isConnecting = false;

        const connectStream = async () => {
            if (isConnecting || eventSource) return;
            isConnecting = true;

            try {
                // To authenticate EventSource pointing to another domain with our custom auth token,
                // we have to retrieve the token and pass it. The easiest way without external libs
                // for cross-domain SSE with custom headers is passing token in URL query
                // Note: Ensure your backend handles `?token=` if using custom auth this way.
                // Assuming standard `supabase.auth.getSession()` for JWT:
                const { data: { session } } = await supabase.auth.getSession();
                const token = session?.access_token || '';

                // Using fallback fetch fallback if standard EventSource isn't easily customized 
                // but since this is an admin dashboard, a direct SSE with query token is fine:
                const url = `${API_BASE}/api/admin/stats/stream?token=${encodeURIComponent(token)}`;

                eventSource = new EventSource(url);

                eventSource.onopen = () => {
                    setSseConnected(true);
                };

                eventSource.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        if (data.success) {
                            setLiveStats(data);
                            setSseLastUpdate(Date.now());
                            setSseConnected(true);
                        }
                    } catch (e) {
                        console.error('SSE Parse Error', e);
                    }
                };

                eventSource.onerror = (error) => {
                    console.error('SSE Error:', error);
                    setSseConnected(false);
                    eventSource?.close();
                    eventSource = null;
                    isConnecting = false;
                    // Reconnect after 5 seconds
                    setTimeout(connectStream, 5000);
                };
            } catch (err) {
                isConnecting = false;
            }
        };

        connectStream();

        return () => {
            if (eventSource) {
                eventSource.close();
            }
        };
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

    const updateFbSessions = async (id: string, newValue: number) => {
        if (newValue < 1 || newValue > 10) return;
        try {
            const { error } = await supabase
                .from('license_keys')
                .update({ max_fb_sessions: newValue })
                .eq('id', id);
            if (error) throw error;
            setLicenses(prev => prev.map(l => l.id === id ? { ...l, max_fb_sessions: newValue } : l));
            toast.success(t.admin.updateFbSessions);
        } catch {
            toast.error(t.admin.errorGeneral);
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
                    <p className="text-muted-foreground">{t.admin.checking}</p>
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
                        <CardTitle className="text-white">{t.admin.loginTitle}</CardTitle>
                        <CardDescription className="text-gray-400">{t.admin.loginDesc}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleAdminLogin} className="space-y-4">
                            <Input
                                type="email"
                                value={adminEmail}
                                onChange={(e) => { setAdminEmail(e.target.value); setAdminLoginError(null); }}
                                placeholder={t.admin.emailPlaceholder}
                                className="bg-gray-800 border-gray-700 text-white"
                            />
                            <Input
                                type="password"
                                value={adminPassword}
                                onChange={(e) => { setAdminPassword(e.target.value); setAdminLoginError(null); }}
                                placeholder={t.admin.passwordPlaceholder}
                                className="bg-gray-800 border-gray-700 text-white"
                            />
                            {adminLoginError && (
                                <p className="text-sm text-red-400 flex items-center gap-1">
                                    <AlertCircle className="w-4 h-4" /> {adminLoginError}
                                </p>
                            )}
                            <Button type="submit" className="w-full bg-gradient-to-r from-red-500 to-orange-500" disabled={adminLoggingIn || !adminEmail || !adminPassword}>
                                {adminLoggingIn ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t.admin.loggingIn}</> : t.admin.loginButton}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const adminTabs: { key: AdminTab; label: string; icon: React.ReactNode }[] = [
        { key: 'overview', label: t.admin.tabOverview, icon: <BarChart3 className="w-4 h-4" /> },
        { key: 'users', label: t.admin.tabUsers, icon: <Users className="w-4 h-4" /> },
        { key: 'licenses', label: t.admin.tabLicenses, icon: <Key className="w-4 h-4" /> },
        { key: 'system', label: t.admin.tabSystem, icon: <Monitor className="w-4 h-4" /> },
    ];

    return (
        <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
            {/* CSS Keyframes for radar pinging */}
            <style>{`
                @keyframes radar-ping {
                    0% {
                        transform: scale(0.5);
                        opacity: 0.5;
                    }
                    50% {
                        transform: scale(1);
                        opacity: 0;
                    }
                    100% {
                        transform: scale(0.5);
                        opacity: 0.5;
                    }
                }
                .animate-radar-ping {
                    animation: radar-ping 2s infinite;
                }
                @keyframes spin-slow {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                @keyframes spin-slow-reverse {
                    from { transform: rotate(360deg); }
                    to { transform: rotate(0deg); }
                }
                @keyframes float-y {
                    0%, 100% { transform: translateY(0px); }
                    50% { transform: translateY(-6px); }
                }
                .animate-gear { animation: spin-slow 12s linear infinite; }
                .animate-gear-reverse { animation: spin-slow-reverse 8s linear infinite; }
                .animate-gear-active { animation: spin-slow 4s linear infinite; }
                .animate-gear-active-reverse { animation: spin-slow-reverse 3s linear infinite; }
                .animate-float { animation: float-y 4s ease-in-out infinite; }
            `}</style>

            {/* Top Header */}
            <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b">
                <div className="max-w-7xl mx-auto px-4 md:px-6">
                    <div className="flex items-center justify-between h-14">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center">
                                <Shield className="w-4 h-4 text-white" />
                            </div>
                            <div>
                                <h1 className="text-base font-bold leading-none">{t.admin.title}</h1>
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
                        <Card><CardContent className="pt-5 pb-4"><div className="flex items-center gap-3"><div className="p-2.5 rounded-xl bg-blue-100 dark:bg-blue-900/30"><Key className="w-5 h-5 text-blue-600" /></div><div><p className="text-xs text-muted-foreground">{t.admin.totalLicenses}</p><p className="text-xl font-bold">{stats.totalLicenses}</p></div></div></CardContent></Card>
                        <Card><CardContent className="pt-5 pb-4"><div className="flex items-center gap-3"><div className="p-2.5 rounded-xl bg-green-100 dark:bg-green-900/30"><Check className="w-5 h-5 text-green-600" /></div><div><p className="text-xs text-muted-foreground">{t.admin.activeLicenses}</p><p className="text-xl font-bold">{stats.activeLicenses}</p></div></div></CardContent></Card>
                        <Card><CardContent className="pt-5 pb-4"><div className="flex items-center gap-3"><div className="p-2.5 rounded-xl bg-amber-100 dark:bg-amber-900/30"><Clock className="w-5 h-5 text-amber-600" /></div><div><p className="text-xs text-muted-foreground">{t.admin.expiringSoon}</p><p className="text-xl font-bold">{stats.expiringLicenses}</p></div></div></CardContent></Card>
                        <Card><CardContent className="pt-5 pb-4"><div className="flex items-center gap-3"><div className="p-2.5 rounded-xl bg-purple-100 dark:bg-purple-900/30"><DollarSign className="w-5 h-5 text-purple-600" /></div><div><p className="text-xs text-muted-foreground">{t.admin.totalRevenue}</p><p className="text-xl font-bold">฿{stats.totalRevenue.toLocaleString()}</p></div></div></CardContent></Card>
                        <Card><CardContent className="pt-5 pb-4"><div className="flex items-center gap-3"><div className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-900/30"><Wifi className="w-5 h-5 text-emerald-600" /></div><div><p className="text-xs text-muted-foreground">{t.admin.online}</p><p className="text-xl font-bold">{liveStats?.onlineUsers ?? '—'}</p></div></div></CardContent></Card>
                        <Card><CardContent className="pt-5 pb-4"><div className="flex items-center gap-3"><div className="p-2.5 rounded-xl bg-orange-100 dark:bg-orange-900/30"><Zap className="w-5 h-5 text-orange-600" /></div><div><p className="text-xs text-muted-foreground">Automation</p><p className="text-xl font-bold">{liveStats?.automation.currentlyRunning ?? '—'}</p></div></div></CardContent></Card>
                    </div>

                    {/* Charts */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Package Distribution */}
                        <Card>
                            <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><PieChart className="w-4 h-4" /> {t.admin.packageDistribution}</CardTitle></CardHeader>
                            <CardContent>
                                {(() => { const fc = licenses.filter(l => l.package === 'free').length; const ac = licenses.filter(l => l.package === 'agent').length; const ec = licenses.filter(l => l.package === 'elite').length; const total = licenses.length || 1; return (<div className="space-y-3">{[{ label: 'Rookie', count: fc, color: 'bg-emerald-500', icon: <Rocket className="w-3.5 h-3.5 text-emerald-500" /> }, { label: 'Top Agent', count: ac, color: 'bg-amber-500', icon: <Star className="w-3.5 h-3.5 text-amber-500" /> }, { label: 'Elite', count: ec, color: 'bg-purple-500', icon: <Crown className="w-3.5 h-3.5 text-purple-500" /> }].map(p => (<div key={p.label} className="space-y-1"><div className="flex justify-between text-sm"><span className="flex items-center gap-1.5">{p.icon} {p.label}</span><span>{p.count} ({Math.round(p.count / total * 100)}%)</span></div><div className="h-2.5 bg-muted rounded-full overflow-hidden"><div className={cn("h-full rounded-full", p.color)} style={{ width: `${p.count / total * 100}%` }} /></div></div>))}</div>); })()}
                            </CardContent>
                        </Card>
                        {/* Revenue */}
                        <Card>
                            <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><DollarSign className="w-4 h-4" /> {t.admin.revenueByPackage}</CardTitle></CardHeader>
                            <CardContent>
                                {(() => { const ar = licenses.filter(l => l.package === 'agent').length * 1390; const er = licenses.filter(l => l.package === 'elite').length * 2990; const mx = Math.max(ar, er, 1); return (<div className="space-y-3"><div className="space-y-1"><div className="flex justify-between text-sm"><span className="flex items-center gap-1.5"><Star className="w-3.5 h-3.5 text-amber-500" />Top Agent (฿1,390)</span><span className="font-semibold">฿{ar.toLocaleString()}</span></div><div className="h-5 bg-muted rounded-lg overflow-hidden"><div className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-lg" style={{ width: `${ar / mx * 100}%` }} /></div></div><div className="space-y-1"><div className="flex justify-between text-sm"><span className="flex items-center gap-1.5"><Crown className="w-3.5 h-3.5 text-purple-500" />Elite (฿2,990)</span><span className="font-semibold">฿{er.toLocaleString()}</span></div><div className="h-5 bg-muted rounded-lg overflow-hidden"><div className="h-full bg-gradient-to-r from-purple-400 to-purple-500 rounded-lg" style={{ width: `${er / mx * 100}%` }} /></div></div><div className="pt-3 border-t mt-3 flex justify-between items-center"><span className="text-muted-foreground">{t.admin.totalRevenueAll}</span><span className="text-xl font-bold text-green-600">฿{(ar + er).toLocaleString()}</span></div></div>); })()}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Expiring Soon */}
                    {(() => { const now = new Date(); const sd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); const exp = licenses.filter(l => { const e = new Date(l.expires_at); return l.is_active && e > now && e <= sd; }); if (!exp.length) return null; return (<Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20"><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400 text-base"><AlertCircle className="w-4 h-4" />⚠️ {t.admin.expiringLicenses} ({exp.length})</CardTitle></CardHeader><CardContent><div className="space-y-2">{exp.slice(0, 5).map(l => { const dl = Math.ceil((new Date(l.expires_at).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)); return (<div key={l.id} className="flex items-center justify-between p-2.5 bg-white dark:bg-gray-800 rounded-lg border"><div className="flex items-center gap-2"><code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">{l.license_key}</code><span className="text-xs text-muted-foreground">{l.owner_name || '{t.admin.noName}'}</span></div><div className="flex items-center gap-2"><Badge className={cn(dl <= 2 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700', 'text-[10px]')}>เหลือ {dl} วัน</Badge><Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => extendLicense(l.id, 30)}>+30 วัน</Button></div></div>); })}</div></CardContent></Card>); })()}

                    {/* Monthly Report */}
                    <Card>
                        <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><TrendingUp className="w-4 h-4" />{t.admin.monthlyReport}</CardTitle></CardHeader>
                        <CardContent>
                            {(() => { const months: { month: string; count: number; revenue: number }[] = []; const now = new Date(); for (let i = 5; i >= 0; i--) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); const me = new Date(now.getFullYear(), now.getMonth() - i + 1, 0); const ml = licenses.filter(l => { const c = new Date(l.created_at); return c >= d && c <= me; }); const rv = ml.reduce((s, l) => l.package === 'agent' ? s + 1390 : l.package === 'elite' ? s + 2990 : s, 0); months.push({ month: d.toLocaleDateString('th-TH', { month: 'short', year: '2-digit' }), count: ml.length, revenue: rv }); } const mc = Math.max(...months.map(m => m.count), 1); const mr = Math.max(...months.map(m => m.revenue), 1); return (<div className="space-y-4"><div><h4 className="text-xs font-medium mb-2 flex items-center gap-1.5"><Key className="w-3.5 h-3.5" />จำนวน License</h4><div className="flex items-end gap-2 h-24">{months.map((m, i) => (<div key={i} className="flex-1 flex flex-col items-center gap-0.5"><span className="text-[10px] font-medium">{m.count}</span><div className="w-full bg-gradient-to-t from-blue-500 to-blue-400 rounded-t transition-all" style={{ height: `${(m.count / mc) * 100}%`, minHeight: m.count > 0 ? '6px' : '2px' }} /><span className="text-[10px] text-muted-foreground">{m.month}</span></div>))}</div></div><div className="pt-3 border-t"><h4 className="text-xs font-medium mb-2 flex items-center gap-1.5"><DollarSign className="w-3.5 h-3.5" />รายได้ (บาท)</h4><div className="flex items-end gap-2 h-24">{months.map((m, i) => (<div key={i} className="flex-1 flex flex-col items-center gap-0.5"><span className="text-[10px] font-medium">{m.revenue > 0 ? `฿${(m.revenue / 1000).toFixed(1)}k` : '-'}</span><div className="w-full bg-gradient-to-t from-green-500 to-emerald-400 rounded-t transition-all" style={{ height: `${(m.revenue / mr) * 100}%`, minHeight: m.revenue > 0 ? '6px' : '2px' }} /><span className="text-[10px] text-muted-foreground">{m.month}</span></div>))}</div></div></div>); })()}
                        </CardContent>
                    </Card>
                </>)}

                {/* ═══════════════ TAB: USERS (Live) ═══════════════ */}
                {activeTab === 'users' && (<>
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2">
                                <RadioReceiver className="w-5 h-5 text-red-500 animate-radar-ping" />
                                {t.admin.usersTitle}
                                <Badge variant="outline" className="text-xs bg-red-50 text-red-600 border-red-200 dark:bg-red-950/20 dark:border-red-800 gap-1.5 px-2 py-0.5 animate-pulse">
                                    <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                                    LIVE Stream
                                </Badge>
                            </CardTitle>
                            <CardDescription>{t.admin.usersDesc}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {!liveStats ? (
                                <div className="flex items-center justify-center py-12 text-muted-foreground gap-2"><Loader2 className="w-5 h-5 animate-spin" />{t.admin.connectingBackend}</div>
                            ) : (
                                <div className="space-y-4">
                                    {/* Summary Cards */}
                                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                                        <div className="p-3 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800"><div className="flex items-center gap-1.5 mb-1"><Wifi className="w-3.5 h-3.5 text-green-600" /><span className="text-[11px] font-medium text-green-700 dark:text-green-400">{t.admin.online}</span></div><p className="text-2xl font-bold text-green-700 dark:text-green-300">{liveStats.onlineUsers}</p></div>
                                        <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800"><div className="flex items-center gap-1.5 mb-1"><Users className="w-3.5 h-3.5 text-blue-600" /><span className="text-[11px] font-medium text-blue-700 dark:text-blue-400">{t.admin.totalUsers}</span></div><p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{liveStats.activeUsers}</p></div>
                                        <div className="p-3 rounded-xl bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800"><div className="flex items-center gap-1.5 mb-1"><Zap className={cn("w-3.5 h-3.5 text-orange-600", liveStats.automation.currentlyRunning > 0 && "animate-pulse")} /><span className="text-[11px] font-medium text-orange-700 dark:text-orange-400">Automation</span></div><p className="text-2xl font-bold text-orange-700 dark:text-orange-300">{liveStats.automation.currentlyRunning}</p></div>
                                        <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800"><div className="flex items-center gap-1.5 mb-1"><Activity className="w-3.5 h-3.5 text-purple-600" /><span className="text-[11px] font-medium text-purple-700 dark:text-purple-400">{t.admin.runsToday}</span></div><p className="text-2xl font-bold text-purple-700 dark:text-purple-300">{liveStats.automation.totalRunsToday}</p></div>
                                        <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700"><div className="flex items-center gap-1.5 mb-1"><Monitor className="w-3.5 h-3.5 text-gray-600 dark:text-gray-400" /><span className="text-[11px] font-medium text-gray-700 dark:text-gray-400">Browsers</span></div><p className="text-2xl font-bold text-gray-700 dark:text-gray-300">{liveStats.activeBrowsers}/{liveStats.maxBrowsers}</p></div>
                                    </div>

                                    {/* Tasks Summary */}
                                    {(liveStats.automation.totalTasksCompleted > 0 || liveStats.automation.totalTasksFailed > 0 || liveStats.automation.totalTasksPending > 0) && (
                                        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 text-sm">
                                            <span className="text-muted-foreground whitespace-nowrap">Tasks:</span>
                                            <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">✅ {liveStats.automation.totalTasksCompleted} {t.admin.success}</Badge>
                                            <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">❌ {liveStats.automation.totalTasksFailed} {t.admin.failed}</Badge>
                                            {liveStats.automation.totalTasksPending > 0 && <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">⏳ {liveStats.automation.totalTasksPending} {t.admin.inProgress}</Badge>}
                                        </div>
                                    )}

                                    {/* Per-User Table */}
                                    {liveStats.users.length > 0 ? (
                                        <div className="border rounded-lg overflow-hidden">
                                            <Table>
                                                <TableHeader><TableRow className="bg-muted/30">
                                                    <TableHead className="text-xs">{t.admin.colUser}</TableHead>
                                                    <TableHead className="text-xs">{t.admin.colStatus}</TableHead>
                                                    <TableHead className="text-xs">Automation</TableHead>
                                                    <TableHead className="text-xs">{t.admin.colPostsToday}</TableHead>
                                                    <TableHead className="text-xs">{t.admin.colRuns}</TableHead>
                                                    <TableHead className="text-xs">Tasks</TableHead>
                                                    <TableHead className="text-xs text-right">{t.admin.colManage}</TableHead>
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
                                                            <TableCell>{u.isOnline ? <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-[10px]"><Wifi className="w-3 h-3 mr-1" />Online</Badge> : <Badge variant="secondary" className="text-[10px]"><WifiOff className="w-3 h-3 mr-1" />Offline</Badge>}</TableCell>
                                                            <TableCell>{u.isRunningGroup || u.isRunningMarketplace ? <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 text-[10px]"><Zap className="w-3 h-3 mr-1 animate-pulse" />{u.isRunningGroup && 'Groups'}{u.isRunningGroup && u.isRunningMarketplace && ' + '}{u.isRunningMarketplace && 'Marketplace'}</Badge> : <span className="text-xs text-muted-foreground">—</span>}</TableCell>
                                                            <TableCell><div className="text-xs"><span className="font-semibold">{u.todayPosts}</span><span className="text-muted-foreground ml-1">({u.todaySuccess}✅ {u.todayFailed}❌)</span></div></TableCell>
                                                            <TableCell><span className="text-xs font-semibold">{u.automationRuns} {t.admin.times}</span></TableCell>
                                                            <TableCell>{u.currentTasks.total > 0 ? <div className="flex items-center gap-1"><div className="w-16 h-2 bg-muted rounded-full overflow-hidden"><div className="h-full bg-green-500 rounded-full" style={{ width: `${((u.currentTasks.completed + u.currentTasks.failed) / u.currentTasks.total) * 100}%` }} /></div><span className="text-[10px] text-muted-foreground">{u.currentTasks.completed + u.currentTasks.failed}/{u.currentTasks.total}</span></div> : <span className="text-xs text-muted-foreground">—</span>}</TableCell>
                                                            <TableCell className="text-right">
                                                                {(u.isRunningGroup || u.isRunningMarketplace) && u.fullUserId ? (
                                                                    <Button size="sm" variant="ghost" className="h-7 px-2 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                                                                        disabled={forceStoppingUser === u.fullUserId}
                                                                        onClick={() => handleForceStop(u.fullUserId!, u.displayName || u.userId)}>
                                                                        {forceStoppingUser === u.fullUserId
                                                                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                                            : <StopCircle className="w-3.5 h-3.5" />}
                                                                    </Button>
                                                                ) : <span className="text-xs text-muted-foreground">—</span>}
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    ) : (
                                        <p className="text-center text-sm text-muted-foreground py-8">{t.admin.noUsers}</p>
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
                                <div className="flex-1 relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input placeholder={t.admin.searchLicense} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10" /></div>
                                <Select value={filterPackage} onValueChange={setFilterPackage}><SelectTrigger className="w-[160px]"><SelectValue placeholder={t.admin.package} /></SelectTrigger><SelectContent><SelectItem value="all">{t.admin.all}</SelectItem><SelectItem value="free">Rookie</SelectItem><SelectItem value="agent">Top Agent</SelectItem><SelectItem value="elite">Elite</SelectItem></SelectContent></Select>
                                <Select value={filterStatus} onValueChange={setFilterStatus}><SelectTrigger className="w-[160px]"><SelectValue placeholder={t.admin.status} /></SelectTrigger><SelectContent><SelectItem value="all">{t.admin.all}</SelectItem><SelectItem value="active">{t.admin.active}</SelectItem><SelectItem value="inactive">{t.admin.expired}</SelectItem></SelectContent></Select>
                                <Button variant="outline" onClick={fetchLicenses}><RefreshCw className={cn("w-4 h-4 mr-2", isLoading && "animate-spin")} />{t.admin.refresh}</Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* License Table */}
                    <Card>
                        <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2"><Key className="w-5 h-5 text-primary" />License Keys ({filteredLicenses.length})</CardTitle></CardHeader>
                        <CardContent>
                            <ScrollArea className="h-[500px]">
                                <div className="overflow-x-auto">
                                    <Table className="min-w-[700px]">
                                        <TableHeader><TableRow>
                                            <TableHead>License Key</TableHead><TableHead>{t.admin.package}</TableHead><TableHead>{t.admin.owner}</TableHead><TableHead>{t.admin.user}</TableHead><TableHead>{t.admin.fbSessions}</TableHead><TableHead>{t.admin.expiryDate}</TableHead><TableHead>{t.admin.status}</TableHead><TableHead className="text-right">{t.admin.colManage}</TableHead>
                                        </TableRow></TableHeader>
                                        <TableBody>
                                            {filteredLicenses.length === 0 ? (
                                                <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground"><Key className="w-12 h-12 mx-auto mb-4 opacity-20" />{t.admin.noLicenseFound}</TableCell></TableRow>
                                            ) : filteredLicenses.map(license => {
                                                const expired = isExpired(license.expires_at);
                                                const expiringSoon = isExpiringSoon(license.expires_at);
                                                const activation = licenseActivations.find((a: any) => a.license_key_id === license.id);
                                                return (
                                                    <TableRow key={license.id}>
                                                        <TableCell className="font-mono text-sm">{license.license_key}</TableCell>
                                                        <TableCell><Badge variant={license.package === 'elite' ? 'default' : 'secondary'}>{packageLabels[license.package]}</Badge></TableCell>
                                                        <TableCell><div><div className="font-medium text-sm">{license.owner_name || '-'}</div><div className="text-xs text-muted-foreground">{license.owner_contact}</div></div></TableCell>
                                                        <TableCell>{activation ? (
                                                            <div className="min-w-0">
                                                                <p className="text-xs font-medium truncate max-w-[120px]">{activation.device_name || activation.device_id?.substring(0, 12) + '...'}</p>
                                                                <p className="text-[10px] text-muted-foreground">{activation.activated_at ? formatDate(activation.activated_at) : ''}</p>
                                                            </div>
                                                        ) : <span className="text-[10px] text-muted-foreground">—</span>}</TableCell>
                                                        <TableCell><div className="flex items-center gap-1">
                                                            <button className="w-5 h-5 rounded bg-muted hover:bg-muted-foreground/20 flex items-center justify-center text-xs font-bold transition-colors" onClick={() => updateFbSessions(license.id, license.max_fb_sessions - 1)} disabled={license.max_fb_sessions <= 1}>−</button>
                                                            <span className="text-sm font-semibold w-5 text-center tabular-nums">{license.max_fb_sessions}</span>
                                                            <button className="w-5 h-5 rounded bg-muted hover:bg-muted-foreground/20 flex items-center justify-center text-xs font-bold transition-colors" onClick={() => updateFbSessions(license.id, license.max_fb_sessions + 1)} disabled={license.max_fb_sessions >= 10}>+</button>
                                                        </div></TableCell>
                                                        <TableCell><div className={cn("flex items-center gap-1.5 text-sm", expired ? "text-red-500 font-medium" : expiringSoon ? "text-amber-500 font-medium" : "")}>{formatDate(license.expires_at)}{expiringSoon && !expired && <AlertCircle className="w-3.5 h-3.5" />}</div></TableCell>
                                                        <TableCell><Badge variant={license.is_active && !expired ? 'outline' : 'destructive'} className={cn(license.is_active && !expired && "border-green-500 text-green-500")}>{license.is_active && !expired ? 'Active' : 'Inactive'}</Badge></TableCell>
                                                        <TableCell className="text-right"><div className="flex justify-end gap-1.5">
                                                            <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => navigator.clipboard.writeText(license.license_key)}><Copy className="w-3.5 h-3.5" /></Button>
                                                            <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => extendLicense(license.id, 30)}><Calendar className="w-3.5 h-3.5 text-green-600" /></Button>
                                                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => setDeleteTarget({ id: license.id, key: license.license_key })}><Trash2 className="w-3.5 h-3.5" /></Button>
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

                {/* ═══════════════ TAB: SYSTEM & QUEUE — WORLD-CLASS ENGINE ROOM ═══════════════ */}
                {activeTab === 'system' && (<>
                    {!liveStats?.queue ? (
                        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
                            <div className="relative">
                                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center shadow-2xl">
                                    <Loader2 className="w-7 h-7 animate-spin text-slate-400" />
                                </div>
                                <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-amber-500 animate-pulse" />
                            </div>
                            <p className="text-sm font-medium">{t.admin.connectingEngine}</p>
                        </div>
                    ) : (<div className="space-y-5">

                        {/* ── SSE Connection Status Bar ── */}
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-muted/30 border border-border/50">
                            <div className="flex items-center gap-2">
                                <div className={cn("w-2 h-2 rounded-full transition-colors", sseConnected ? "bg-emerald-500" : "bg-red-500 animate-pulse")} />
                                <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                                    {sseConnected ? t.admin.liveConnected : t.admin.reconnecting}
                                </span>
                            </div>
                            {sseLastUpdate > 0 && (
                                <span className="text-[10px] text-muted-foreground/60 tabular-nums">
                                    Updated {new Date(sseLastUpdate).toLocaleTimeString('th-TH', { hour12: false })}
                                </span>
                            )}
                        </motion.div>

                        {/* ── HERO: Queue Engine — World-Class Gear Theme ── */}
                        <TooltipProvider delayDuration={200}>
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="relative overflow-hidden rounded-2xl text-white cursor-pointer group"
                            style={{ background: 'linear-gradient(135deg, #0c0e14 0%, #141825 30%, #1a1f30 50%, #141825 70%, #0c0e14 100%)' }}
                            onClick={() => setQueueDetail({ type: 'slots', data: liveStats.queue })}
                        >
                            {/* Industrial grid pattern */}
                            <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

                            {/* Animated gear decorations */}
                            <svg className={cn("absolute -top-8 -left-8 w-32 h-32 text-white/[0.04]", liveStats.queue.runningCount > 0 ? "animate-gear-active" : "animate-gear")} viewBox="0 0 100 100" fill="currentColor">
                                <path d="M50 10 L54 10 L56 2 L60 2 L62 10 L66 12 L72 6 L76 8 L74 16 L78 20 L86 18 L88 22 L80 26 L82 30 L90 32 L90 36 L82 38 L80 42 L88 48 L86 52 L78 48 L74 52 L76 60 L72 62 L66 56 L62 58 L60 66 L56 66 L54 58 L50 58 L46 66 L42 66 L40 58 L36 56 L30 62 L26 60 L28 52 L24 48 L16 52 L14 48 L22 42 L20 38 L12 36 L12 32 L20 30 L22 26 L14 22 L16 18 L24 20 L28 16 L26 8 L30 6 L36 12 L40 10 L42 2 L46 2 L48 10Z M50 30 a20 20 0 1 0 0 40 a20 20 0 1 0 0-40Z"/>
                            </svg>
                            <svg className={cn("absolute -bottom-6 -right-6 w-24 h-24 text-white/[0.03]", liveStats.queue.runningCount > 0 ? "animate-gear-active-reverse" : "animate-gear-reverse")} viewBox="0 0 100 100" fill="currentColor">
                                <path d="M50 10 L54 10 L56 2 L60 2 L62 10 L66 12 L72 6 L76 8 L74 16 L78 20 L86 18 L88 22 L80 26 L82 30 L90 32 L90 36 L82 38 L80 42 L88 48 L86 52 L78 48 L74 52 L76 60 L72 62 L66 56 L62 58 L60 66 L56 66 L54 58 L50 58 L46 66 L42 66 L40 58 L36 56 L30 62 L26 60 L28 52 L24 48 L16 52 L14 48 L22 42 L20 38 L12 36 L12 32 L20 30 L22 26 L14 22 L16 18 L24 20 L28 16 L26 8 L30 6 L36 12 L40 10 L42 2 L46 2 L48 10Z M50 30 a20 20 0 1 0 0 40 a20 20 0 1 0 0-40Z"/>
                            </svg>

                            {/* Top ambient glow — shifts color based on state */}
                            <div className={cn(
                                "absolute -top-20 left-1/3 w-[500px] h-48 rounded-full blur-[120px] transition-all duration-[3000ms]",
                                liveStats.queue.runningCount > 0 ? "bg-emerald-500/20" : "bg-slate-500/5"
                            )} />
                            <div className={cn(
                                "absolute -bottom-16 right-1/4 w-80 h-32 rounded-full blur-[100px] transition-all duration-[3000ms]",
                                liveStats.queue.queueLength > 0 ? "bg-amber-500/12" : "bg-transparent"
                            )} />

                            <div className="relative z-10 p-5 md:p-8">
                                {/* Header row */}
                                <div className="flex items-start justify-between mb-7">
                                    <div className="flex items-center gap-3.5">
                                        {/* Animated gear icon */}
                                        <div className="relative">
                                            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-400/90 via-orange-500 to-red-500/80 flex items-center justify-center shadow-xl shadow-orange-600/30 ring-1 ring-white/10">
                                                <svg className={cn("w-5 h-5 text-white", liveStats.queue.runningCount > 0 ? "animate-gear-active" : "")} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/>
                                                </svg>
                                            </div>
                                            {liveStats.queue.runningCount > 0 && (
                                                <div className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 shadow-lg shadow-emerald-400/50 animate-pulse" />
                                            )}
                                        </div>
                                        <div>
                                            <h3 className="text-lg md:text-xl font-black tracking-tight bg-gradient-to-r from-white via-white to-slate-400 bg-clip-text text-transparent">
                                                {t.admin.engineTitle}
                                            </h3>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className="text-[10px] text-slate-500 font-medium">{liveStats.queue.maxConcurrent} Slots</span>
                                                <span className="text-slate-700">•</span>
                                                <span className="text-[10px] text-slate-500 font-medium">{liveStats.queue.queueTimeoutMin}m Timeout</span>
                                                <span className="text-slate-700">•</span>
                                                <span className={cn("text-[10px] font-bold uppercase tracking-wider", liveStats.queue.runningCount > 0 ? "text-emerald-400" : "text-slate-600")}>
                                                    {liveStats.queue.runningCount > 0 ? t.admin.processing : t.admin.idle}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Big counter + queue badge */}
                                    <div className="flex items-center gap-3 md:gap-5">
                                        {liveStats.queue.queueLength > 0 && (
                                            <motion.div
                                                initial={{ scale: 0.8, opacity: 0 }}
                                                animate={{ scale: 1, opacity: 1 }}
                                                className="px-3 md:px-4 py-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 backdrop-blur-md text-center animate-float"
                                            >
                                                <p className="text-2xl md:text-3xl font-black text-amber-400 tabular-nums leading-none drop-shadow-lg">{liveStats.queue.queueLength}</p>
                                                <p className="text-[7px] text-amber-400/50 uppercase tracking-[0.2em] mt-1 font-semibold">{t.admin.inQueue}</p>
                                            </motion.div>
                                        )}
                                        <div className="text-right">
                                            <div className="flex items-baseline gap-0.5">
                                                <AnimatedCounter value={liveStats.queue.runningCount} className="text-4xl md:text-6xl font-black tabular-nums tracking-tighter leading-none text-white drop-shadow-lg" />
                                                <span className="text-lg md:text-2xl text-slate-600 font-extralight">/{liveStats.queue.maxConcurrent}</span>
                                            </div>
                                            <p className="text-[8px] text-slate-600 uppercase tracking-[0.25em] mt-1 font-semibold">{t.admin.activeSlots}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Slot Grid — Industrial Machine Cards */}
                                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                                    {Array.from({ length: liveStats.queue.maxConcurrent }, (_, i) => {
                                        const isActive = i < liveStats.queue!.runningCount;
                                        const runJob = isActive ? liveStats.queue!.running[i] : null;
                                        const progressPct = runJob?.progress ? Math.round((runJob.progress.currentStep / Math.max(runJob.progress.totalSteps, 1)) * 100) : 0;
                                        const runMin = runJob ? Math.floor(runJob.runningSec / 60) : 0;
                                        const runSec = runJob ? runJob.runningSec % 60 : 0;
                                        return (
                                            <motion.div
                                                key={i}
                                                initial={{ opacity: 0, scale: 0.9 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                transition={{ delay: i * 0.04 }}
                                                className={cn(
                                                    "relative rounded-xl border overflow-hidden transition-all duration-500 group/slot",
                                                    isActive
                                                        ? "bg-gradient-to-br from-slate-800/80 via-slate-900 to-slate-800/80 border-emerald-500/30 shadow-lg shadow-emerald-500/10 ring-1 ring-emerald-400/10"
                                                        : "bg-white/[0.015] border-white/[0.06] hover:border-white/[0.12]"
                                                )}
                                            >
                                                {/* Active slot scan line */}
                                                {isActive && <div className="absolute inset-0 bg-gradient-to-b from-emerald-400/5 via-transparent to-transparent animate-pulse" />}

                                                <div className="relative z-10 p-2.5 min-h-[88px] flex flex-col justify-between">
                                                    {/* Slot header */}
                                                    <div className="flex items-center justify-between mb-1.5">
                                                        <div className="flex items-center gap-1.5">
                                                            {/* Spinning gear for active, static for idle */}
                                                            <svg className={cn("w-3.5 h-3.5 flex-shrink-0", isActive ? "text-emerald-400 animate-gear-active" : "text-slate-700")} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/>
                                                            </svg>
                                                            <span className={cn("text-[10px] font-bold tabular-nums", isActive ? "text-emerald-400" : "text-slate-600")}>#{i + 1}</span>
                                                        </div>
                                                        {isActive ? (
                                                            <span className={cn(
                                                                "text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full",
                                                                runJob?.automationType === 'marketplace'
                                                                    ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                                                                    : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                                            )}>
                                                                {runJob?.automationType === 'marketplace' ? '🏪 MKT' : '👥 GRP'}
                                                            </span>
                                                        ) : (
                                                            <span className="text-[8px] text-slate-700 uppercase tracking-wider">IDLE</span>
                                                        )}
                                                    </div>

                                                    {runJob ? (
                                                        <>
                                                            {/* User info */}
                                                            <div className="space-y-0.5 mb-1.5">
                                                                <p className="text-[11px] font-semibold text-white truncate leading-tight">{runJob.displayName || runJob.userId}</p>
                                                                {runJob.email && <p className="text-[9px] text-slate-500 truncate leading-tight">{runJob.email}</p>}
                                                                {runJob.fbAccount && (
                                                                    <div className="flex items-center gap-1 mt-0.5">
                                                                        <svg className="w-2.5 h-2.5 text-blue-400 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                                                                        <span className="text-[9px] text-blue-400/80 truncate leading-tight">{runJob.fbAccount}</span>
                                                                    </div>
                                                                )}
                                                                {runJob.propertyTitle && (
                                                                    <p className="text-[9px] text-amber-400/70 truncate leading-tight mt-0.5">🏠 {runJob.propertyTitle}</p>
                                                                )}
                                                            </div>

                                                            {/* Progress bar */}
                                                            <div className="space-y-1">
                                                                <div className="flex items-center justify-between">
                                                                    <span className="text-[9px] text-slate-400 tabular-nums">
                                                                        {runJob.progress ? `Step ${runJob.progress.currentStep}/${runJob.progress.totalSteps}` : `${runJob.groupCount} groups`}
                                                                    </span>
                                                                    <span className="text-[9px] text-slate-500 tabular-nums font-mono">{runMin}:{String(runSec).padStart(2, '0')}</span>
                                                                </div>
                                                                <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                                                                    <motion.div
                                                                        className={cn(
                                                                            "h-full rounded-full",
                                                                            runJob.progress?.isPaused
                                                                                ? "bg-yellow-500"
                                                                                : "bg-gradient-to-r from-emerald-500 to-emerald-400"
                                                                        )}
                                                                        initial={{ width: 0 }}
                                                                        animate={{ width: `${progressPct}%` }}
                                                                        transition={{ duration: 0.5, ease: 'easeOut' }}
                                                                    />
                                                                </div>
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <div className="flex-1 flex items-center justify-center">
                                                            <span className="text-[10px] text-slate-700">Available</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </motion.div>
                                        );
                                    })}
                                </div>

                                {/* Queue waiting list — shown when users are waiting */}
                                {liveStats.queue.queue && liveStats.queue.queue.length > 0 && (
                                    <div className="mt-4 p-3 rounded-xl bg-amber-500/5 border border-amber-500/15">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Hourglass className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                                            <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">Waiting Queue — {liveStats.queue.queue.length} user(s)</span>
                                        </div>
                                        <div className="space-y-1.5">
                                            {liveStats.queue.queue.map((q: any, qi: number) => (
                                                <div key={qi} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-amber-500/5 border border-amber-500/10">
                                                    <span className="text-[10px] font-bold text-amber-400 tabular-nums w-5 text-center">#{q.position}</span>
                                                    <span className="text-[10px] text-slate-300 truncate flex-1">{q.displayName || q.userId}</span>
                                                    <span className="text-[9px] text-slate-500 tabular-nums">{q.groupCount} groups</span>
                                                    <span className="text-[9px] text-amber-400/60 tabular-nums">~{Math.ceil((q.estimatedWaitSec || 300) / 60)}m</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Bottom bar: slot label + live indicator */}
                                <div className="flex items-center justify-between mt-3">
                                    <p className="text-[8px] text-slate-700 uppercase tracking-[0.3em] font-medium">Slot 1 — {liveStats.queue.maxConcurrent}</p>
                                    <div className="flex items-center gap-1.5">
                                        <div className={cn("w-1.5 h-1.5 rounded-full", sseConnected ? "bg-emerald-500 animate-pulse" : "bg-red-500")} />
                                        <span className="text-[8px] text-slate-600 uppercase tracking-wider font-medium">{sseConnected ? 'Live' : 'Offline'}</span>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                        </TooltipProvider>

                        {/* ── Stats Cards with Animated Counters ── */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                            {/* Jobs Success */}
                            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
                                className="relative overflow-hidden rounded-xl border p-4 cursor-pointer hover:shadow-lg transition-all bg-emerald-50/50 dark:bg-emerald-950/10 border-emerald-200/50 dark:border-emerald-800/30 hover:border-emerald-300 group/stat"
                                onClick={() => setQueueDetail({ type: 'stats', data: liveStats.queue!.stats })}>
                                <div className="absolute top-2 right-2 w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 opacity-60 group-hover/stat:opacity-100 transition-opacity"><Check className="w-4 h-4" /></div>
                                <AnimatedCounter value={liveStats.queue.stats.totalCompleted} className="text-2xl font-black tabular-nums text-emerald-700 dark:text-emerald-400" />
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">{t.admin.jobsSuccess}</p>
                            </motion.div>
                            {/* Jobs Failed */}
                            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                                className="relative overflow-hidden rounded-xl border p-4 cursor-pointer hover:shadow-lg transition-all bg-red-50/50 dark:bg-red-950/10 border-red-200/50 dark:border-red-800/30 hover:border-red-300 group/stat"
                                onClick={() => setQueueDetail({ type: 'stats', data: liveStats.queue!.stats })}>
                                <div className="absolute top-2 right-2 w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 opacity-60 group-hover/stat:opacity-100 transition-opacity"><AlertCircle className="w-4 h-4" /></div>
                                <AnimatedCounter value={liveStats.queue.stats.totalFailed} className="text-2xl font-black tabular-nums text-red-700 dark:text-red-400" />
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">{t.admin.jobsFailed}</p>
                            </motion.div>
                            {/* Success Rate */}
                            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                                className="relative overflow-hidden rounded-xl border p-4 cursor-pointer hover:shadow-lg transition-all bg-blue-50/50 dark:bg-blue-950/10 border-blue-200/50 dark:border-blue-800/30 hover:border-blue-300 group/stat"
                                onClick={() => setQueueDetail({ type: 'stats', data: liveStats.queue!.stats })}>
                                <div className="absolute top-2 right-2 w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 opacity-60 group-hover/stat:opacity-100 transition-opacity"><TrendingUp className="w-4 h-4" /></div>
                                <AnimatedCounter value={liveStats.queue.stats.successRate} suffix="%" className="text-2xl font-black tabular-nums text-blue-700 dark:text-blue-400" />
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Success Rate</p>
                            </motion.div>
                            {/* Avg Duration */}
                            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                                className="relative overflow-hidden rounded-xl border p-4 cursor-pointer hover:shadow-lg transition-all bg-purple-50/50 dark:bg-purple-950/10 border-purple-200/50 dark:border-purple-800/30 hover:border-purple-300 group/stat"
                                onClick={() => setQueueDetail({ type: 'stats', data: liveStats.queue!.stats })}>
                                <div className="absolute top-2 right-2 w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 opacity-60 group-hover/stat:opacity-100 transition-opacity"><Clock className="w-4 h-4" /></div>
                                <p className="text-2xl font-black tabular-nums text-purple-700 dark:text-purple-400">{liveStats.queue.stats.avgDurationFormatted || '—'}</p>
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Avg Duration</p>
                            </motion.div>
                        </div>

                        {/* ── Running + Waiting ── */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {/* Running */}
                            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }} className="rounded-xl border bg-card overflow-hidden shadow-sm">
                                <div className="px-4 py-3 border-b bg-gradient-to-r from-emerald-50/80 to-transparent dark:from-emerald-950/20 flex items-center gap-2">
                                    <div className="relative">
                                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                                        {liveStats.queue.running.length > 0 && <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping opacity-40" />}
                                    </div>
                                    <span className="font-semibold text-sm">Running</span>
                                    <Badge className="ml-auto bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-xs">{liveStats.queue.running.length}</Badge>
                                </div>
                                <div className="p-3 min-h-[140px]">
                                    {liveStats.queue.running.length > 0 ? (
                                        <div className="space-y-2">
                                            <AnimatePresence mode="popLayout">
                                                {liveStats.queue.running.map((r: any, i: number) => (
                                                    <motion.div layout key={r.fullUserId || r.userId}
                                                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                                        exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                                                        transition={{ type: "spring", stiffness: 300, damping: 25 }}
                                                        className="relative overflow-hidden flex items-center justify-between p-3 rounded-xl border border-emerald-200 dark:border-emerald-800/50 bg-gradient-to-r from-emerald-50 to-transparent dark:from-emerald-950/20 cursor-pointer hover:shadow-lg hover:border-emerald-300 transition-all group/run"
                                                        onClick={() => setQueueDetail({ type: 'running', data: r })}>
                                                        <div className="absolute inset-0 -translate-x-full group-hover/run:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                                                        <div className="flex items-center gap-3 relative z-10">
                                                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center text-white text-xs font-bold shadow-md shadow-emerald-500/20">{i + 1}</div>
                                                            <div className="min-w-0">
                                                                <div className="flex items-center gap-1.5">
                                                                    <p className="text-sm font-semibold truncate">{r.displayName || r.userId}</p>
                                                                    {r.automationType && <Badge variant="outline" className={cn("text-[8px] h-4 px-1 uppercase tracking-wider", r.automationType === 'marketplace' ? "border-blue-300 text-blue-600 dark:border-blue-700 dark:text-blue-400" : "border-emerald-300 text-emerald-600 dark:border-emerald-700 dark:text-emerald-400")}>{r.automationType === 'marketplace' ? <><Store className="w-2.5 h-2.5 mr-0.5" />MKT</> : <><Users className="w-2.5 h-2.5 mr-0.5" />GRP</>}</Badge>}
                                                                </div>
                                                                <p className="text-[10px] text-muted-foreground">{r.groupCount} groups{r.progress ? ` • ${r.progress.currentStep}/${r.progress.totalSteps}` : ''}</p>
                                                                {r.progress?.latestLog && <p className="text-[9px] text-emerald-600/70 dark:text-emerald-400/60 truncate max-w-[180px]">{r.progress.latestLog.text}</p>}
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2 relative z-10 flex-shrink-0">
                                                            <div className="text-right">
                                                                <p className="text-lg font-mono font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{Math.floor(r.runningSec / 60)}:{String(r.runningSec % 60).padStart(2, '0')}</p>
                                                                {r.progress && <div className="w-16 h-1 bg-emerald-200 dark:bg-emerald-900/40 rounded-full mt-1 overflow-hidden"><div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${(r.progress.currentStep / Math.max(r.progress.totalSteps, 1)) * 100}%` }} /></div>}
                                                            </div>
                                                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 opacity-0 group-hover/run:opacity-100 transition-opacity"
                                                                disabled={forceStoppingUser === r.fullUserId}
                                                                onClick={(e) => { e.stopPropagation(); handleForceStop(r.fullUserId, r.displayName || r.userId); }}>
                                                                {forceStoppingUser === r.fullUserId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <StopCircle className="w-3.5 h-3.5" />}
                                                            </Button>
                                                        </div>
                                                    </motion.div>
                                                ))}
                                            </AnimatePresence>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center py-8">
                                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900 flex items-center justify-center mb-2 shadow-inner">
                                                <Radio className="w-5 h-5 text-muted-foreground/30" />
                                            </div>
                                            <p className="text-sm font-medium text-muted-foreground">{t.admin.idleNoJobs}</p>
                                            <p className="text-[10px] text-muted-foreground/50 mt-0.5">{t.admin.jobsAppearHere}</p>
                                        </div>
                                    )}
                                </div>
                            </motion.div>

                            {/* Waiting Queue */}
                            <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }} className="rounded-xl border bg-card overflow-hidden shadow-sm">
                                <div className="px-4 py-3 border-b bg-gradient-to-r from-amber-50/80 to-transparent dark:from-amber-950/20 flex items-center gap-2">
                                    <Clock className={cn("w-4 h-4 text-amber-500", liveStats.queue.queue.length > 0 && "animate-[spin_3s_linear_infinite]")} />
                                    <span className="font-semibold text-sm">Waiting Queue</span>
                                    <Badge className="ml-auto bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-xs">{liveStats.queue.queue.length}</Badge>
                                </div>
                                <div className="p-3 min-h-[140px]">
                                    {liveStats.queue.queue.length > 0 ? (
                                        <div className="space-y-2">
                                            <AnimatePresence mode="popLayout">
                                                {liveStats.queue.queue.map((q: any) => (
                                                    <motion.div layout key={q.fullUserId || q.userId}
                                                        initial={{ opacity: 0, x: 20 }}
                                                        animate={{ opacity: 1, x: 0 }}
                                                        exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                                                        transition={{ type: "spring", stiffness: 300, damping: 25 }}
                                                        className="flex items-center justify-between p-3 rounded-xl border border-amber-200 dark:border-amber-800/50 bg-gradient-to-r from-amber-50 to-transparent dark:from-amber-950/20 cursor-pointer hover:shadow-lg hover:border-amber-300 transition-all"
                                                        onClick={() => setQueueDetail({ type: 'queued', data: q })}>
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center text-white text-xs font-bold shadow-md shadow-amber-500/20 flex-shrink-0">#{q.position}</div>
                                                            <div className="min-w-0">
                                                                <div className="flex items-center gap-1.5">
                                                                    <p className="text-sm font-semibold truncate">{q.displayName || q.userId}</p>
                                                                    {q.automationType && <Badge variant="outline" className={cn("text-[8px] h-4 px-1 uppercase tracking-wider", q.automationType === 'marketplace' ? "border-blue-300 text-blue-600 dark:border-blue-700 dark:text-blue-400" : "border-amber-300 text-amber-600 dark:border-amber-700 dark:text-amber-400")}>{q.automationType === 'marketplace' ? <><Store className="w-2.5 h-2.5 mr-0.5" />MKT</> : <><Users className="w-2.5 h-2.5 mr-0.5" />GRP</>}</Badge>}
                                                                </div>
                                                                <p className="text-[10px] text-muted-foreground truncate">{q.groupCount} groups • ~{Math.ceil(q.estimatedWaitSec / 60)}m wait</p>
                                                            </div>
                                                        </div>
                                                        <p className="font-mono text-sm tabular-nums text-amber-600 dark:text-amber-400 flex-shrink-0">{Math.floor(q.waitingSec / 60)}:{String(q.waitingSec % 60).padStart(2, '0')}</p>
                                                    </motion.div>
                                                ))}
                                            </AnimatePresence>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center py-8">
                                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900 flex items-center justify-center mb-2 shadow-inner">
                                                <Check className="w-5 h-5 text-muted-foreground/30" />
                                            </div>
                                            <p className="text-sm font-medium text-muted-foreground">{t.admin.queueEmpty}</p>
                                            <p className="text-[10px] text-muted-foreground/50 mt-0.5">{t.admin.noUsersWaiting}</p>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        </div>

                        {/* ── Engine Status + History ── */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {/* Engine Status */}
                            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                                className="rounded-xl overflow-hidden border bg-gradient-to-br from-slate-50 to-white dark:from-slate-900/50 dark:to-slate-800/30 cursor-pointer hover:shadow-xl transition-all shadow-sm"
                                onClick={() => setQueueDetail({ type: 'system', data: liveStats })}>
                                <div className="px-4 py-3 border-b flex items-center gap-2 bg-gradient-to-r from-blue-50/80 to-transparent dark:from-blue-950/20">
                                    <Monitor className="w-4 h-4 text-blue-500" />
                                    <span className="font-semibold text-sm">Engine Status</span>
                                    <Badge variant="outline" className="ml-auto text-[9px] uppercase tracking-wider border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 gap-1">
                                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />Live
                                    </Badge>
                                </div>
                                <div className="p-4 space-y-4">
                                    {/* Browser Pool */}
                                    <div>
                                        <div className="flex justify-between text-xs mb-1.5">
                                            <span className="text-muted-foreground uppercase tracking-wider font-medium">Browser Pool</span>
                                            <span className="font-mono font-bold">{liveStats.activeBrowsers}/{liveStats.maxBrowsers}</span>
                                        </div>
                                        <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                            <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-700 shadow-sm shadow-blue-500/30" style={{ width: `${(liveStats.activeBrowsers / (liveStats.maxBrowsers || 10)) * 100}%` }} />
                                        </div>
                                    </div>
                                    {/* Metrics */}
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                                            <span className="text-[10px] text-muted-foreground">Sessions</span>
                                            <span className="text-sm font-bold tabular-nums">{liveStats.totalSessions}</span>
                                        </div>
                                        <div className="flex items-center justify-between p-2.5 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/10 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-colors">
                                            <span className="text-[10px] text-muted-foreground">Online</span>
                                            <span className="text-sm font-bold tabular-nums text-emerald-600">{liveStats.onlineUsers}</span>
                                        </div>
                                        <div className="flex items-center justify-between p-2.5 rounded-lg bg-orange-50/50 dark:bg-orange-950/10 hover:bg-orange-50 dark:hover:bg-orange-950/20 transition-colors">
                                            <span className="text-[10px] text-muted-foreground">Automation</span>
                                            <span className="text-sm font-bold tabular-nums text-orange-600">{liveStats.automationUsers}</span>
                                        </div>
                                        <div className="flex items-center justify-between p-2.5 rounded-lg bg-blue-50/50 dark:bg-blue-950/10 hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-colors">
                                            <span className="text-[10px] text-muted-foreground">Runs Today</span>
                                            <span className="text-sm font-bold tabular-nums text-blue-600">{liveStats.automation.totalRunsToday}</span>
                                        </div>
                                        <div className="flex items-center justify-between p-2.5 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/10 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-colors">
                                            <span className="text-[10px] text-muted-foreground">Tasks ✓</span>
                                            <span className="text-sm font-bold tabular-nums text-emerald-600">{liveStats.automation.totalTasksCompleted}</span>
                                        </div>
                                        <div className="flex items-center justify-between p-2.5 rounded-lg bg-red-50/50 dark:bg-red-950/10 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors">
                                            <span className="text-[10px] text-muted-foreground">Tasks ✗</span>
                                            <span className="text-sm font-bold tabular-nums text-red-600">{liveStats.automation.totalTasksFailed}</span>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>

                            {/* History Timeline + Chart */}
                            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="rounded-xl border bg-card overflow-hidden shadow-sm">
                                <div className="px-4 py-3 border-b flex items-center gap-2 bg-gradient-to-r from-purple-50/80 to-transparent dark:from-purple-950/20">
                                    <Activity className="w-4 h-4 text-purple-500" />
                                    <span className="font-semibold text-sm">Job History</span>
                                    {/* Filter buttons */}
                                    <div className="ml-auto flex items-center gap-1">
                                        {([
                                            { key: 'all' as const, label: 'All', icon: <Filter className="w-3 h-3" /> },
                                            { key: 'success' as const, label: 'OK', icon: <CheckCircle2 className="w-3 h-3 text-emerald-500" /> },
                                            { key: 'failed' as const, label: 'Fail', icon: <XCircle className="w-3 h-3 text-red-500" /> },
                                        ]).map(f => (
                                            <button key={f.key} onClick={(e) => { e.stopPropagation(); setHistoryFilter(f.key); }}
                                                className={cn(
                                                    "flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-all",
                                                    historyFilter === f.key
                                                        ? "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300"
                                                        : "text-muted-foreground hover:bg-muted/50"
                                                )}>
                                                {f.icon}{f.label}
                                            </button>
                                        ))}
                                        <Badge variant="outline" className="ml-1 text-[9px] border-purple-200 dark:border-purple-800 text-purple-600 dark:text-purple-400">
                                            {historyFilter === 'all'
                                                ? liveStats.queue.recentHistory.length
                                                : liveStats.queue.recentHistory.filter((h: any) => historyFilter === 'success' ? h.success : !h.success).length
                                            }
                                        </Badge>
                                    </div>
                                </div>
                                <div className="p-3">
                                    {liveStats.queue.recentHistory.length > 0 ? (<>
                                        {/* Mini Duration Chart */}
                                        <div className="mb-3 rounded-lg bg-muted/20 p-2">
                                            <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1 px-1">Duration (recent jobs)</p>
                                            <ResponsiveContainer width="100%" height={60}>
                                                <BarChart data={[...liveStats.queue.recentHistory].reverse().slice(-12).map((h: any, i: number) => ({
                                                    name: i,
                                                    duration: h.durationSec,
                                                    success: h.success,
                                                }))}>
                                                    <Bar dataKey="duration" radius={[2, 2, 0, 0]}>
                                                        {[...liveStats.queue.recentHistory].reverse().slice(-12).map((h: any, i: number) => (
                                                            <Cell key={i} fill={h.success ? '#10b981' : '#ef4444'} opacity={0.7} />
                                                        ))}
                                                    </Bar>
                                                    <RechartsTooltip
                                                        contentStyle={{ fontSize: '11px', borderRadius: '8px', padding: '4px 8px' }}
                                                        formatter={(value: number) => [`${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`, 'Duration']}
                                                        labelFormatter={() => ''}
                                                    />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                        {/* Filtered History List */}
                                        <ScrollArea className="h-[180px]">
                                            <div className="space-y-1">
                                                {liveStats.queue.recentHistory
                                                    .filter((h: any) => historyFilter === 'all' ? true : historyFilter === 'success' ? h.success : !h.success)
                                                    .map((h: any, i: number) => (
                                                    <div key={i} className="flex items-center gap-2 md:gap-3 text-xs p-2 md:p-2.5 rounded-lg hover:bg-muted/50 cursor-pointer transition-all group/hist"
                                                        onClick={() => setQueueDetail({ type: 'history', data: h })}>
                                                        <div className={cn("w-2.5 h-2.5 rounded-full flex-shrink-0 ring-2 ring-offset-1 ring-offset-background transition-all group-hover/hist:scale-125", h.success ? "bg-emerald-500 ring-emerald-200 dark:ring-emerald-800" : "bg-red-500 ring-red-200 dark:ring-red-800")} />
                                                        <span className="font-mono text-muted-foreground w-14 flex-shrink-0 hidden md:inline">{h.completedAtFormatted}</span>
                                                        <span className="font-medium flex-1 truncate">{h.userId}</span>
                                                        {h.automationType && <span className={cn("text-[8px] font-bold uppercase px-1 py-0.5 rounded flex-shrink-0", h.automationType === 'marketplace' ? "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" : "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400")}>{h.automationType === 'marketplace' ? 'MKT' : 'GRP'}</span>}
                                                        <span className="text-muted-foreground flex-shrink-0">{h.groupCount}g</span>
                                                        <span className="font-mono font-semibold tabular-nums w-12 text-right flex-shrink-0">{h.durationFormatted}</span>
                                                        <div className={cn("w-5 h-5 rounded flex items-center justify-center opacity-0 group-hover/hist:opacity-100 transition-opacity flex-shrink-0", h.success ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600" : "bg-red-100 dark:bg-red-900/30 text-red-600")}>
                                                            {h.success ? <Check className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </ScrollArea>
                                    </>) : (
                                        <div className="py-10 text-center">
                                            <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-purple-100 to-purple-50 dark:from-purple-950/30 dark:to-purple-900/20 flex items-center justify-center mb-3 shadow-inner">
                                                <Activity className="w-6 h-6 text-purple-300 dark:text-purple-600" />
                                            </div>
                                            <p className="text-sm font-medium text-muted-foreground">{t.admin.noHistory}</p>
                                            <p className="text-[10px] text-muted-foreground/50 mt-0.5">{t.admin.recordsAppear}</p>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        </div>
                    </div>)}

                    {/* ═══ Queue Detail Dialog ═══ */}
                    <Dialog open={!!queueDetail} onOpenChange={() => setQueueDetail(null)}>
                        <DialogContent className="max-w-lg">
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2">
                                    {queueDetail?.type === 'running' && <><div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />{t.admin.runningJob}</>}
                                    {queueDetail?.type === 'queued' && <><Clock className="w-4 h-4 text-amber-500" />{t.admin.queuedJob}</>}
                                    {queueDetail?.type === 'history' && <><Activity className="w-4 h-4 text-purple-500" />{t.admin.jobHistoryTitle}</>}
                                    {queueDetail?.type === 'stats' && <><BarChart3 className="w-4 h-4" />{t.admin.queueStats}</>}
                                    {queueDetail?.type === 'system' && <><Monitor className="w-4 h-4 text-blue-500" />{t.admin.systemStatus}</>}
                                    {queueDetail?.type === 'slots' && <><Zap className="w-4 h-4 text-orange-500" />{t.admin.slotsDetail}</>}
                                </DialogTitle>
                                <DialogDescription>
                                    {queueDetail?.type === 'running' && t.admin.runningJobDesc}
                                    {queueDetail?.type === 'queued' && t.admin.queuedJobDesc}
                                    {queueDetail?.type === 'history' && t.admin.historyDesc}
                                    {queueDetail?.type === 'stats' && t.admin.statsDesc}
                                    {queueDetail?.type === 'system' && t.admin.systemDesc}
                                    {queueDetail?.type === 'slots' && t.admin.slotsDesc}
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                                {/* Running Job Detail */}
                                {queueDetail?.type === 'running' && queueDetail.data && (
                                    <div className="space-y-3">
                                        <div className="p-4 rounded-xl bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
                                            <div className="grid grid-cols-2 gap-3 text-sm">
                                                <div><p className="text-muted-foreground text-xs">User</p><p className="font-semibold truncate">{queueDetail.data.displayName || queueDetail.data.userId}</p></div>
                                                <div><p className="text-muted-foreground text-xs">Groups</p><p className="font-semibold">{queueDetail.data.groupCount} {t.admin.groups}</p></div>
                                                <div><p className="text-muted-foreground text-xs">Runtime</p><p className="font-mono font-semibold text-green-700 dark:text-green-400">{Math.floor(queueDetail.data.runningSec / 60)}:{String(queueDetail.data.runningSec % 60).padStart(2, '0')}</p></div>
                                                <div><p className="text-muted-foreground text-xs">Started</p><p className="font-mono text-xs">{new Date(queueDetail.data.startedAt).toLocaleTimeString('th-TH', { hour12: false })}</p></div>
                                            </div>
                                            {queueDetail.data.progress && (
                                                <div className="mt-3 pt-3 border-t border-green-200 dark:border-green-800/50 space-y-1.5">
                                                    <div className="flex justify-between text-xs">
                                                        <span className="text-muted-foreground">Progress</span>
                                                        <span className="font-medium text-green-700 dark:text-green-400">{queueDetail.data.progress.currentStep} / {queueDetail.data.progress.totalSteps}</span>
                                                    </div>
                                                    <div className="h-2 bg-green-200 dark:bg-green-900/40 rounded-full overflow-hidden">
                                                        <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${(queueDetail.data.progress.currentStep / Math.max(queueDetail.data.progress.totalSteps, 1)) * 100}%` }} />
                                                    </div>
                                                    {queueDetail.data.progress.isPaused && <p className="text-xs text-amber-600 font-bold mt-1">⚠️ Automation Paused</p>}
                                                    {queueDetail.data.progress.latestLog && <p className="text-[11px] text-muted-foreground truncate mt-1">Log: {queueDetail.data.progress.latestLog.text}</p>}
                                                </div>
                                            )}
                                        </div>
                                        <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">{t.admin.working}</Badge>
                                    </div>
                                )}
                                {/* Queued Job Detail */}
                                {queueDetail?.type === 'queued' && queueDetail.data && (
                                    <div className="space-y-3">
                                        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                                            <div className="grid grid-cols-2 gap-3 text-sm">
                                                <div><p className="text-muted-foreground text-xs">User</p><p className="font-semibold truncate">{queueDetail.data.displayName || queueDetail.data.userId}</p></div>
                                                <div><p className="text-muted-foreground text-xs">Position</p><p className="font-semibold text-amber-700 dark:text-amber-400">#{queueDetail.data.position}</p></div>
                                                <div><p className="text-muted-foreground text-xs">Groups</p><p className="font-semibold">{queueDetail.data.groupCount} {t.admin.groups}</p></div>
                                                <div><p className="text-muted-foreground text-xs">Waiting</p><p className="font-mono">{Math.floor(queueDetail.data.waitingSec / 60)}:{String(queueDetail.data.waitingSec % 60).padStart(2, '0')}</p></div>
                                                <div><p className="text-muted-foreground text-xs">Est. Wait</p><p className="font-mono">~{Math.ceil(queueDetail.data.estimatedWaitSec / 60)} {t.admin.minutes}</p></div>
                                                <div><p className="text-muted-foreground text-xs">Enqueued</p><p className="font-mono text-xs">{new Date(queueDetail.data.enqueuedAt).toLocaleTimeString('th-TH', { hour12: false })}</p></div>
                                            </div>
                                        </div>
                                        <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">{t.admin.waiting}</Badge>
                                    </div>
                                )}
                                {/* History Detail */}
                                {queueDetail?.type === 'history' && queueDetail.data && (
                                    <div className="space-y-3">
                                        <div className={cn("p-4 rounded-xl border", queueDetail.data.success ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800" : "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800")}>
                                            <div className="grid grid-cols-2 gap-3 text-sm">
                                                <div><p className="text-muted-foreground text-xs">User ID</p><p className="font-mono font-semibold">{queueDetail.data.userId}</p></div>
                                                <div><p className="text-muted-foreground text-xs">Status</p><p className="font-semibold">{queueDetail.data.success ? `✅ ${t.admin.success}` : `❌ ${t.admin.failed}`}</p></div>
                                                <div><p className="text-muted-foreground text-xs">Groups</p><p className="font-semibold">{queueDetail.data.groupCount} {t.admin.groups}</p></div>
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
                                            <div className="p-3 rounded-xl bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 text-center"><p className="text-2xl font-bold text-green-600">{queueDetail.data.totalCompleted}</p><p className="text-xs text-muted-foreground">{t.admin.jobsSuccess}</p></div>
                                            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 text-center"><p className="text-2xl font-bold text-red-600">{queueDetail.data.totalFailed}</p><p className="text-xs text-muted-foreground">{t.admin.jobsFailed}</p></div>
                                        </div>
                                        <Separator />
                                        <div className="space-y-2 text-sm">
                                            <div className="flex justify-between"><span className="text-muted-foreground">Success Rate</span><span className="font-bold text-lg">{queueDetail.data.successRate}%</span></div>
                                            <div className="h-3 bg-muted rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-green-500 to-emerald-400 rounded-full transition-all" style={{ width: `${queueDetail.data.successRate}%` }} /></div>
                                        </div>
                                        <Separator />
                                        <div className="grid grid-cols-3 gap-3 text-center">
                                            <div className="p-2 rounded-lg bg-muted/30"><p className="font-mono font-semibold">{queueDetail.data.avgDurationFormatted}</p><p className="text-[10px] text-muted-foreground">{t.admin.average}</p></div>
                                            <div className="p-2 rounded-lg bg-muted/30"><p className="font-mono font-semibold">{Math.floor(queueDetail.data.longestJobSec / 60)}:{String(queueDetail.data.longestJobSec % 60).padStart(2, '0')}</p><p className="text-[10px] text-muted-foreground">{t.admin.longest}</p></div>
                                            <div className="p-2 rounded-lg bg-muted/30"><p className="font-mono font-semibold">{Math.floor(queueDetail.data.shortestJobSec / 60)}:{String(queueDetail.data.shortestJobSec % 60).padStart(2, '0')}</p><p className="text-[10px] text-muted-foreground">{t.admin.shortest}</p></div>
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
                                                <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full transition-all" style={{ width: `${(queueDetail.data.activeBrowsers / (queueDetail.data.maxBrowsers || 10)) * 100}%` }} /></div>
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
                                            {Array.from({ length: queueDetail.data.maxConcurrent }, (_: any, i: number) => {
                                                const isActive = i < queueDetail.data.runningCount;
                                                const runningJob = isActive ? queueDetail.data.running[i] : null;
                                                return (<div key={i} className={cn("p-2.5 rounded-xl border text-center transition-all", isActive ? "bg-green-50 dark:bg-green-950/20 border-green-300 dark:border-green-800 shadow-sm" : "bg-muted/50 border-transparent")}>
                                                    <p className={cn("text-xs font-bold", isActive ? "text-green-700 dark:text-green-400" : "text-muted-foreground")}>{i + 1}</p>
                                                    {runningJob ? (<>
                                                        <p className="text-[9px] font-semibold truncate px-0.5 mt-0.5">{runningJob.displayName || runningJob.userId}</p>
                                                        <p className="text-[9px] text-green-600 dark:text-green-400">{runningJob.groupCount}g</p>
                                                    </>) : <p className="text-[9px] text-muted-foreground/50 mt-0.5">{t.admin.empty}</p>}
                                                </div>);
                                            })}
                                        </div>
                                        <Separator />
                                        <div className="grid grid-cols-3 gap-3 text-center text-sm">
                                            <div className="p-2 rounded-lg bg-green-50 dark:bg-green-950/20"><p className="font-bold text-green-600">{queueDetail.data.runningCount}</p><p className="text-[10px] text-muted-foreground">Running</p></div>
                                            <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/20"><p className="font-bold text-amber-600">{queueDetail.data.queueLength}</p><p className="text-[10px] text-muted-foreground">Waiting</p></div>
                                            <div className="p-2 rounded-lg bg-muted/30"><p className="font-bold">{queueDetail.data.maxConcurrent - queueDetail.data.runningCount}</p><p className="text-[10px] text-muted-foreground">Available</p></div>
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
                        <DialogTitle>{t.admin.createTitle}</DialogTitle>
                        <DialogDescription>{t.admin.createDesc}</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2"><Label>{t.admin.package}</Label><Select value={newLicense.package} onValueChange={val => setNewLicense({ ...newLicense, package: val })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="agent">Top Agent (฿1,390)</SelectItem><SelectItem value="elite">Elite (฿2,990)</SelectItem><SelectItem value="free">Rookie (Free)</SelectItem></SelectContent></Select></div>
                        <div className="grid gap-2"><Label>{t.admin.duration}</Label><Select value={newLicense.durationDays.toString()} onValueChange={val => setNewLicense({ ...newLicense, durationDays: parseInt(val) })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="30">{t.admin.days30}</SelectItem><SelectItem value="90">{t.admin.days90}</SelectItem><SelectItem value="180">{t.admin.days180}</SelectItem><SelectItem value="365">{t.admin.days365}</SelectItem></SelectContent></Select></div>
                        <div className="grid gap-2"><Label>{t.admin.customerName}</Label><Input value={newLicense.ownerName} onChange={e => setNewLicense({ ...newLicense, ownerName: e.target.value })} placeholder={t.admin.customerNamePlaceholder} /></div>
                        <div className="grid gap-2"><Label>{t.admin.contact}</Label><Input value={newLicense.ownerContact} onChange={e => setNewLicense({ ...newLicense, ownerContact: e.target.value })} placeholder={t.admin.contactPlaceholder} /></div>
                        <div className="grid gap-2"><Label>{t.admin.note}</Label><Input value={newLicense.note} onChange={e => setNewLicense({ ...newLicense, note: e.target.value })} placeholder={t.admin.notePlaceholder} /></div>
                    </div>
                    <DialogFooter><Button variant="outline" onClick={() => setShowCreateModal(false)}>{t.admin.cancel}</Button><Button onClick={handleCreateLicense}>{t.admin.confirmCreate}</Button></DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation */}
            <Dialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
                <DialogContent>
                    <DialogHeader><DialogTitle className="flex items-center gap-2 text-red-600"><Trash2 className="w-5 h-5" />{t.admin.deleteTitle}</DialogTitle><DialogDescription>{t.admin.deleteDesc}</DialogDescription></DialogHeader>
                    {deleteTarget && <div className="py-3"><div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800"><p className="font-mono text-sm font-semibold text-center">{deleteTarget.key}</p></div></div>}
                    <DialogFooter><Button variant="outline" onClick={() => setDeleteTarget(null)}>{t.admin.cancel}</Button><Button variant="destructive" onClick={() => deleteTarget && deleteLicense(deleteTarget.id)}><Trash2 className="w-4 h-4 mr-2" />{t.admin.deleteLicense}</Button></DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
