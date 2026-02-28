
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
    ChevronDown,
    ChevronRight,
    Sparkles,
    Mail,
    MessageCircle,
    Eye,
    ArrowRight,
    Send,
    AlertTriangle,
    Settings,
    Terminal,
    Fingerprint,
    MousePointer2,
    Globe,
    Pause,
    Play,
} from 'lucide-react';
import { GrandStateLogo } from '@/components/GrandStateLogo';
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
import { Textarea } from '@/components/ui/textarea';
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
    const [inspectTab, setInspectTab] = useState<'monitor' | 'security' | 'logs'>('monitor');

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

    // User management: ban/unban
    const [banningUser, setBanningUser] = useState<string | null>(null);
    const handleBanUser = async (fullUserId: string, displayName: string, ban: boolean) => {
        const msg = ban ? `แบน "${displayName}" — จะ login ไม่ได้ + automation หยุดทันที` : `ปลดแบน "${displayName}" — จะ login ได้ตามปกติ`;
        if (!confirm(msg)) return;
        setBanningUser(fullUserId);
        try {
            const res = await apiFetch('/api/admin/ban-user', { method: 'POST', body: JSON.stringify({ targetUserId: fullUserId, banned: ban }) });
            const data = await res.json();
            if (data.success) { toast.success(data.message); } else { toast.error(data.error); }
        } catch { toast.error('Failed'); } finally { setBanningUser(null); }
    };

    // User management: delete user + all data
    const [deletingUser, setDeletingUser] = useState<string | null>(null);
    const handleDeleteUser = async (fullUserId: string, displayName: string) => {
        const msg = `⚠️ ลบ "${displayName}" ถาวร!\n\nข้อมูลทั้งหมดจะถูกลบ:\n• บัญชีผู้ใช้\n• ทรัพย์สินทั้งหมด\n• กลุ่ม Facebook ทั้งหมด\n• License key\n\nดำเนินการ?`;
        if (!confirm(msg)) return;
        if (!confirm(`ยืนยันอีกครั้ง — ลบ "${displayName}" จริงๆ? กู้คืนไม่ได้!`)) return;
        setDeletingUser(fullUserId);
        try {
            const res = await apiFetch('/api/admin/delete-user', { method: 'POST', body: JSON.stringify({ targetUserId: fullUserId }) });
            const data = await res.json();
            if (data.success) {
                toast.success(data.message);
                fetchAllUsers();
                fetchUserLicenses();
            } else {
                toast.error(data.error || 'ลบไม่สำเร็จ');
            }
        } catch (err: any) { toast.error(err?.message || 'เชื่อมต่อ backend ไม่ได้'); } finally { setDeletingUser(null); }
    };

    // User management: change package
    const [changingPkgUser, setChangingPkgUser] = useState<string | null>(null);
    const handleChangePackage = async (fullUserId: string, newPkg: string) => {
        setChangingPkgUser(fullUserId);
        try {
            const res = await apiFetch('/api/admin/change-package', { method: 'POST', body: JSON.stringify({ targetUserId: fullUserId, newPackage: newPkg }) });
            const data = await res.json();
            if (data.success) { toast.success(`เปลี่ยนเป็น ${newPkg.toUpperCase()} สำเร็จ`); fetchUserLicenses(); fetchAllUsers(); } else { toast.error(data.error); }
        } catch { toast.error('Failed'); } finally { setChangingPkgUser(null); }
    };

    // User licenses map: userId -> license info
    const [userLicenses, setUserLicenses] = useState<Record<string, any>>({});
    const fetchUserLicenses = useCallback(async () => {
        try {
            const res = await apiFetch('/api/admin/user-licenses');
            const data = await res.json();
            if (data.success) setUserLicenses(data.licenses || {});
        } catch { /* silent */ }
    }, []);

    // ALL registered users (from Supabase Auth, not just in-memory sessions)
    const [allUsers, setAllUsers] = useState<LiveUser[]>([]);
    const [allUsersLoaded, setAllUsersLoaded] = useState(false);
    const fetchAllUsers = useCallback(async () => {
        try {
            const res = await apiFetch('/api/admin/all-users');
            const data = await res.json();
            if (data.success) { setAllUsers(data.users || []); setAllUsersLoaded(true); }
        } catch { /* silent */ }
    }, []);

    // Expanded user card (to show management controls)
    const [expandedUser, setExpandedUser] = useState<string | null>(null);

    // Support tickets
    interface SupportTicket {
        id: string;
        user_id: string;
        user_email: string;
        user_name: string;
        subject: string;
        description: string;
        category: string;
        status: string;
        admin_reply: string | null;
        admin_replied_at: string | null;
        created_at: string;
        updated_at: string;
    }
    const [tickets, setTickets] = useState<SupportTicket[]>([]);
    const [ticketsLoading, setTicketsLoading] = useState(false);
    const [ticketFilter, setTicketFilter] = useState<string>('all');
    const [replyingTicket, setReplyingTicket] = useState<string | null>(null);
    const [replyText, setReplyText] = useState('');

    const fetchTickets = useCallback(async () => {
        setTicketsLoading(true);
        try {
            const { data, error } = await supabase
                .from('support_tickets')
                .select('*')
                .order('created_at', { ascending: false });
            if (error) throw error;
            setTickets(data || []);
        } catch (err) {
            console.error('Fetch tickets error:', err);
        } finally {
            setTicketsLoading(false);
        }
    }, []);

    const handleUpdateTicketStatus = async (ticketId: string, newStatus: string) => {
        try {
            const { error } = await supabase
                .from('support_tickets')
                .update({ status: newStatus, updated_at: new Date().toISOString() })
                .eq('id', ticketId);
            if (error) throw error;
            toast.success(`อัปเดตสถานะเป็น ${newStatus}`);
            fetchTickets();
        } catch { toast.error('อัปเดตไม่สำเร็จ'); }
    };

    const handleReplyTicket = async (ticketId: string) => {
        if (!replyText.trim()) return;
        try {
            const { error } = await supabase
                .from('support_tickets')
                .update({
                    admin_reply: replyText.trim(),
                    admin_replied_at: new Date().toISOString(),
                    status: 'in_progress',
                    updated_at: new Date().toISOString(),
                })
                .eq('id', ticketId);
            if (error) throw error;
            toast.success('ตอบกลับสำเร็จ');
            setReplyingTicket(null);
            setReplyText('');
            fetchTickets();
        } catch { toast.error('ตอบกลับไม่สำเร็จ'); }
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
        fullName?: string | null;
        lineId?: string | null;
        createdAt?: string;
        lastSignIn?: string | null;
        banned?: boolean;
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
    type AdminTab = 'overview' | 'users' | 'licenses' | 'system' | 'tickets';
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
            fetchUserLicenses();
            fetchAllUsers();
            fetchTickets();
        }
    }, [adminUser, fetchLicenseActivations, fetchUserLicenses, fetchAllUsers, fetchTickets]);

    // Auto-refresh allUsers every 30s when on users tab
    useEffect(() => {
        if (!adminUser || activeTab !== 'users') return;
        const interval = setInterval(() => { fetchAllUsers(); fetchUserLicenses(); }, 30_000);
        return () => clearInterval(interval);
    }, [adminUser, activeTab, fetchAllUsers, fetchUserLicenses]);

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
            const resp = await apiFetch('/api/admin/delete-license', {
                method: 'POST',
                body: JSON.stringify({ licenseId: id }),
            });
            const data = await resp.json();

            if (!data.success) {
                toast.error(`ลบไม่สำเร็จ: ${data.error || 'Unknown error'}`);
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
            <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4">
                {/* Subtle grid pattern */}
                <div className="fixed inset-0 opacity-[0.03] dark:opacity-[0.02] pointer-events-none" style={{ backgroundImage: 'linear-gradient(rgba(0,0,0,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.1) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
                <Card className="relative w-full max-w-md border-gray-200 dark:border-gray-700 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm shadow-2xl">
                    {/* Corner accents */}
                    <div className="absolute top-0 left-0 w-6 h-6 border-t-[3px] border-l-[3px] border-orange-400/50 rounded-tl-xl pointer-events-none" />
                    <div className="absolute top-0 right-0 w-6 h-6 border-t-[3px] border-r-[3px] border-orange-400/50 rounded-tr-xl pointer-events-none" />
                    <div className="absolute bottom-0 left-0 w-6 h-6 border-b-[3px] border-l-[3px] border-orange-400/50 rounded-bl-xl pointer-events-none" />
                    <div className="absolute bottom-0 right-0 w-6 h-6 border-b-[3px] border-r-[3px] border-orange-400/50 rounded-br-xl pointer-events-none" />
                    <CardHeader className="text-center">
                        <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center mb-2 shadow-lg shadow-orange-500/20">
                            <Shield className="w-7 h-7 text-white" />
                        </div>
                        <CardTitle>{t.admin.loginTitle}</CardTitle>
                        <CardDescription>{t.admin.loginDesc}</CardDescription>
                        <p className="text-[9px] font-mono text-muted-foreground/40 tracking-wider mt-1">[ GRAND$TATE ADMIN CONSOLE ]</p>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleAdminLogin} className="space-y-4">
                            <Input
                                type="email"
                                value={adminEmail}
                                onChange={(e) => { setAdminEmail(e.target.value); setAdminLoginError(null); }}
                                placeholder={t.admin.emailPlaceholder}
                            />
                            <Input
                                type="password"
                                value={adminPassword}
                                onChange={(e) => { setAdminPassword(e.target.value); setAdminLoginError(null); }}
                                placeholder={t.admin.passwordPlaceholder}
                            />
                            {adminLoginError && (
                                <p className="text-sm text-red-500 flex items-center gap-1">
                                    <AlertCircle className="w-4 h-4" /> {adminLoginError}
                                </p>
                            )}
                            <Button type="submit" className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 shadow-lg shadow-orange-500/20" disabled={adminLoggingIn || !adminEmail || !adminPassword}>
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
        { key: 'tickets', label: 'แจ้งปัญหา', icon: <Mail className="w-4 h-4" /> },
    ];

    return (
        <div className="min-h-screen bg-gradient-to-b from-background to-muted/30" style={{ fontSize: '17px' }}>
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
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center">
                                <GrandStateLogo className="w-8 h-8" />
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
                    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="grid grid-cols-2 lg:grid-cols-6 gap-3">
                        <Card><CardContent className="pt-5 pb-4"><div className="flex items-center gap-3"><div className="p-2.5 rounded-xl bg-blue-100 dark:bg-blue-900/30"><Key className="w-5 h-5 text-blue-600" /></div><div><p className="text-xs text-muted-foreground">{t.admin.totalLicenses}</p><p className="text-xl font-bold">{stats.totalLicenses}</p></div></div></CardContent></Card>
                        <Card><CardContent className="pt-5 pb-4"><div className="flex items-center gap-3"><div className="p-2.5 rounded-xl bg-green-100 dark:bg-green-900/30"><Check className="w-5 h-5 text-green-600" /></div><div><p className="text-xs text-muted-foreground">{t.admin.activeLicenses}</p><p className="text-xl font-bold">{stats.activeLicenses}</p></div></div></CardContent></Card>
                        <Card><CardContent className="pt-5 pb-4"><div className="flex items-center gap-3"><div className="p-2.5 rounded-xl bg-amber-100 dark:bg-amber-900/30"><Clock className="w-5 h-5 text-amber-600" /></div><div><p className="text-xs text-muted-foreground">{t.admin.expiringSoon}</p><p className="text-xl font-bold">{stats.expiringLicenses}</p></div></div></CardContent></Card>
                        <Card><CardContent className="pt-5 pb-4"><div className="flex items-center gap-3"><div className="p-2.5 rounded-xl bg-purple-100 dark:bg-purple-900/30"><DollarSign className="w-5 h-5 text-purple-600" /></div><div><p className="text-xs text-muted-foreground">{t.admin.totalRevenue}</p><p className="text-xl font-bold">฿{stats.totalRevenue.toLocaleString()}</p></div></div></CardContent></Card>
                        <Card><CardContent className="pt-5 pb-4"><div className="flex items-center gap-3"><div className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-900/30"><Wifi className="w-5 h-5 text-emerald-600" /></div><div><p className="text-xs text-muted-foreground">{t.admin.online}</p><p className="text-xl font-bold">{liveStats?.onlineUsers ?? '—'}</p></div></div></CardContent></Card>
                        <Card><CardContent className="pt-5 pb-4"><div className="flex items-center gap-3"><div className="p-2.5 rounded-xl bg-orange-100 dark:bg-orange-900/30"><Zap className="w-5 h-5 text-orange-600" /></div><div><p className="text-xs text-muted-foreground">Automation</p><p className="text-xl font-bold">{liveStats?.automation.currentlyRunning ?? '—'}</p></div></div></CardContent></Card>
                    </motion.div>

                    {/* Charts */}
                    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.4 }} className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    </motion.div>

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

                {/* ═══════════════ TAB: USERS — MATRIX CONTROL ═══════════════ */}
                {activeTab === 'users' && (<>
                <div className="relative rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(180deg, hsl(222 47% 6%) 0%, hsl(222 47% 4%) 100%)' }}>
                    {/* Blueprint Grid BG */}
                    <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'linear-gradient(rgba(148,163,184,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,.5) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
                    {/* Background Gear */}
                    <div className="absolute -top-32 -right-32 opacity-[0.02] pointer-events-none">
                        <motion.div animate={{ rotate: 360 }} transition={{ duration: 120, repeat: Infinity, ease: 'linear' }}>
                            <Settings size={400} className="text-slate-400" />
                        </motion.div>
                    </div>
                    {/* Scanning line */}
                    <motion.div animate={{ top: ['-5%', '105%'] }} transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
                        className="absolute left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-amber-500/30 to-transparent pointer-events-none z-20" />

                    <div className="relative z-10 p-6">
                        {/* ── Header ── */}
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 border-b border-amber-500/20 pb-5 gap-4">
                            <div>
                                <div className="flex items-center gap-3 mb-1">
                                    <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight uppercase">User <span className="text-amber-500">Matrix Control</span></h2>
                                    <Badge variant="outline" className="text-[9px] bg-red-500/10 text-red-400 border-red-500/30 gap-1.5 px-2 py-0.5 animate-pulse font-bold">
                                        <div className="w-1.5 h-1.5 rounded-full bg-red-500" /> LIVE
                                    </Badge>
                                </div>
                                <p className="text-[10px] text-slate-500 font-mono tracking-widest uppercase">Master Administration Interface</p>
                            </div>
                            <div className="relative w-full md:w-80">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                                <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="SEARCH BY NAME OR EMAIL..."
                                    className="w-full bg-slate-900/80 border border-slate-800 rounded-xl py-2.5 pl-9 pr-4 text-[11px] text-amber-400 font-mono placeholder:text-slate-600 focus:border-amber-500/50 focus:outline-none transition-all" />
                            </div>
                        </div>

                        {!liveStats ? (
                            <div className="flex items-center justify-center py-20 text-slate-500 gap-3">
                                <Loader2 className="w-6 h-6 animate-spin text-amber-500/50" />
                                <span className="text-sm font-mono">{t.admin.connectingBackend}</span>
                            </div>
                        ) : (<>
                            {/* ── Stats Grid ── */}
                            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
                                {[
                                    { label: 'Online', value: liveStats.onlineUsers, icon: <Zap className="w-3.5 h-3.5" />, color: 'text-green-400' },
                                    { label: 'Total Users', value: allUsers.length || liveStats.activeUsers, icon: <Users className="w-3.5 h-3.5" />, color: 'text-blue-400' },
                                    { label: 'Automation', value: liveStats.automation.currentlyRunning, icon: <Activity className="w-3.5 h-3.5" />, color: 'text-amber-400' },
                                    { label: 'Runs Today', value: liveStats.automation.totalRunsToday, icon: <TrendingUp className="w-3.5 h-3.5" />, color: 'text-purple-400' },
                                    { label: 'Browsers', value: `${liveStats.activeBrowsers}/${liveStats.maxBrowsers}`, icon: <Monitor className="w-3.5 h-3.5" />, color: 'text-slate-400' },
                                ].map((s, i) => (
                                    <div key={i} className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl backdrop-blur-sm hover:border-slate-700 transition-colors">
                                        <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                                            {s.icon} {s.label}
                                        </div>
                                        <p className={cn('text-2xl font-black font-mono', s.color)}>{s.value}</p>
                                    </div>
                                ))}
                            </div>

                            {/* Tasks summary bar */}
                            {(liveStats.automation.totalTasksCompleted > 0 || liveStats.automation.totalTasksFailed > 0 || liveStats.automation.totalTasksPending > 0) && (
                                <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-900/60 border border-slate-800 mb-5 text-[11px]">
                                    <span className="text-slate-500 font-mono text-[10px] uppercase tracking-wider">Tasks</span>
                                    <span className="text-emerald-400 font-bold">✅ {liveStats.automation.totalTasksCompleted}</span>
                                    <span className="text-red-400 font-bold">❌ {liveStats.automation.totalTasksFailed}</span>
                                    {liveStats.automation.totalTasksPending > 0 && <span className="text-amber-400 font-bold">⏳ {liveStats.automation.totalTasksPending}</span>}
                                </div>
                            )}

                            {/* ── User Cards ── */}
                            {(() => {
                                const liveMap = new Map<string, LiveUser>();
                                for (const lu of (liveStats.users || [])) { if (lu.fullUserId) liveMap.set(lu.fullUserId, lu); }
                                const displayUsers: LiveUser[] = allUsersLoaded
                                    ? allUsers.map(au => { const live = au.fullUserId ? liveMap.get(au.fullUserId) : null; return live ? { ...au, ...live, displayName: au.displayName || live.displayName, fullName: au.fullName || live.fullName } : au; })
                                    : liveStats.users || [];
                                // Filter by search
                                const searched = searchQuery.trim()
                                    ? displayUsers.filter(u => {
                                        const q = searchQuery.toLowerCase();
                                        return (u.displayName || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q) || (u.userId || '').toLowerCase().includes(q);
                                    })
                                    : displayUsers;
                                const sorted = [...searched].sort((a, b) => {
                                    const aRun = (a.isRunningGroup || a.isRunningMarketplace) ? 1 : 0;
                                    const bRun = (b.isRunningGroup || b.isRunningMarketplace) ? 1 : 0;
                                    if (bRun !== aRun) return bRun - aRun;
                                    if (b.isOnline !== a.isOnline) return b.isOnline ? 1 : -1;
                                    return b.todayPosts - a.todayPosts;
                                });
                                if (sorted.length === 0) return <div className="text-center py-12"><Users className="w-10 h-10 text-slate-700 mx-auto mb-2" /><p className="text-sm text-slate-600 font-mono">{searchQuery ? 'No results found' : t.admin.noUsers}</p></div>;
                                return (<div className="space-y-3">
                                    <AnimatePresence>
                                    {sorted.map((u, idx) => {
                                        const isRunning = u.isRunningGroup || u.isRunningMarketplace;
                                        const taskPct = u.currentTasks.total > 0 ? Math.round(((u.currentTasks.completed + u.currentTasks.failed) / u.currentTasks.total) * 100) : 0;
                                        const lic = u.fullUserId ? userLicenses[u.fullUserId] : null;
                                        const userPkg = lic?.package || 'free';
                                        const isExpanded = expandedUser === u.fullUserId;
                                        const tierConfig = {
                                            elite: { color: 'text-purple-400', bg: 'bg-purple-500/15', border: 'border-purple-500/30', icon: <Crown className="w-3 h-3" />, label: 'ELITE' },
                                            agent: { color: 'text-amber-400', bg: 'bg-amber-500/15', border: 'border-amber-500/30', icon: <Star className="w-3 h-3" />, label: 'AGENT' },
                                            free: { color: 'text-emerald-400', bg: 'bg-emerald-500/15', border: 'border-emerald-500/30', icon: <Rocket className="w-3 h-3" />, label: 'ROOKIE' },
                                        };
                                        const tier = tierConfig[userPkg as keyof typeof tierConfig] || tierConfig.free;
                                        return (
                                        <motion.div key={u.userId}
                                            initial={{ opacity: 0, x: -15 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: idx * 0.03 }}
                                            className={cn(
                                                "rounded-2xl border overflow-hidden transition-all group/card",
                                                u.banned ? "bg-red-950/20 border-red-900/40 opacity-60" :
                                                isRunning ? "bg-slate-900/60 border-amber-500/30 shadow-lg shadow-amber-500/5" :
                                                "bg-slate-900/40 border-slate-800 hover:border-amber-500/30"
                                            )}
                                        >
                                            {/* Main row */}
                                            <div className="p-4 cursor-pointer flex items-center gap-4" onClick={() => setExpandedUser(isExpanded ? null : (u.fullUserId || null))}>
                                                {/* Avatar */}
                                                <div className="relative flex-shrink-0">
                                                    <div className={cn(
                                                        "w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-black border transition-transform group-hover/card:scale-105",
                                                        u.banned ? "bg-red-500/10 border-red-500/30 text-red-400" :
                                                        userPkg === 'elite' ? "bg-purple-500/10 border-purple-500/25 text-purple-400" :
                                                        userPkg === 'agent' ? "bg-amber-500/10 border-amber-500/25 text-amber-400" :
                                                        "bg-emerald-500/10 border-emerald-500/25 text-emerald-400"
                                                    )}>
                                                        {u.banned ? '🚫' : (u.displayName || u.email || u.userId)?.[0]?.toUpperCase() || '?'}
                                                    </div>
                                                    {u.isOnline && !u.banned && (
                                                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-[3px] border-slate-950 rounded-full animate-pulse" />
                                                    )}
                                                    {!u.isOnline && !u.banned && (
                                                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-slate-700 border-[3px] border-slate-950 rounded-full" />
                                                    )}
                                                </div>

                                                {/* User Info */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                                                        <p className={cn("text-sm font-black text-white truncate", u.banned && "line-through text-red-400/70")}>
                                                            {u.displayName || u.email?.split('@')[0] || u.userId}
                                                        </p>
                                                        <span className={cn("text-[8px] font-black px-2 py-0.5 rounded-full border flex items-center gap-1", tier.bg, tier.color, tier.border)}>
                                                            {tier.icon} {tier.label}
                                                        </span>
                                                        {u.banned && <span className="text-[8px] font-black text-red-400 bg-red-500/15 border border-red-500/30 px-2 py-0.5 rounded-full">BANNED</span>}
                                                        {isAdminEmail(u.email) && <span className="text-[8px] font-black text-amber-400 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-full flex items-center gap-0.5"><Crown className="w-2.5 h-2.5" />ADMIN</span>}
                                                    </div>
                                                    <p className="text-[11px] text-slate-500 font-mono truncate">
                                                        {u.email || u.userId}
                                                        {(u as any).displayId && <> • <span className="text-amber-500/60">{(u as any).displayId}</span></>}
                                                    </p>
                                                </div>

                                                {/* Right stats */}
                                                <div className="flex items-center gap-4 flex-shrink-0">
                                                    {isRunning && (
                                                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-500/10 border border-amber-500/20">
                                                            <Zap className="w-3 h-3 text-amber-500 animate-pulse" />
                                                            <span className="text-[9px] font-black text-amber-400">
                                                                {u.isRunningGroup && u.isRunningMarketplace ? 'GRP+MKT' : u.isRunningGroup ? 'Groups' : 'MKT'}
                                                            </span>
                                                            {u.fullUserId && (
                                                                <button className="ml-1 text-red-400 hover:text-red-300 transition-colors" disabled={forceStoppingUser === u.fullUserId}
                                                                    onClick={(e) => { e.stopPropagation(); handleForceStop(u.fullUserId!, u.displayName || u.userId); }}>
                                                                    {forceStoppingUser === u.fullUserId ? <Loader2 className="w-3 h-3 animate-spin" /> : <StopCircle className="w-3 h-3" />}
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}
                                                    <div className="text-center">
                                                        <p className="text-lg font-black text-white tabular-nums leading-none">{u.todayPosts}</p>
                                                        <p className="text-[8px] text-slate-600 font-bold uppercase mt-0.5">Posts</p>
                                                    </div>
                                                    <div className="text-center border-l border-slate-800 pl-4">
                                                        <p className="text-lg font-black text-white tabular-nums leading-none">{u.automationRuns}</p>
                                                        <p className="text-[8px] text-slate-600 font-bold uppercase mt-0.5">Runs</p>
                                                    </div>
                                                    {u.currentTasks.total > 0 && (
                                                        <div className="w-14">
                                                            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                                                <motion.div initial={{ width: 0 }} animate={{ width: `${taskPct}%` }} className="h-full bg-gradient-to-r from-amber-500 to-orange-400 rounded-full" />
                                                            </div>
                                                            <span className="text-[8px] text-slate-600 font-mono">{taskPct}%</span>
                                                        </div>
                                                    )}
                                                    <button className="p-2.5 bg-slate-800 hover:bg-amber-500 hover:text-black text-slate-400 rounded-xl transition-all" onClick={(e) => { e.stopPropagation(); setExpandedUser(isExpanded ? null : (u.fullUserId || null)); }}>
                                                        <Settings size={16} />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Expanded management panel */}
                                            <AnimatePresence>
                                            {isExpanded && u.fullUserId && (
                                                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
                                                <div className="px-4 pb-4 pt-0 border-t border-slate-800 space-y-4">
                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3">
                                                        {/* License info */}
                                                        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
                                                            <p className="text-[9px] text-amber-500 font-black uppercase tracking-widest flex items-center gap-1.5"><Key className="w-3 h-3" /> License</p>
                                                            {lic ? (
                                                                <>
                                                                    <p className="text-[11px] font-mono text-slate-300 truncate">{lic.license_key}</p>
                                                                    <p className="text-[10px] text-slate-500">
                                                                        Expires: <span className="text-slate-300">{new Date(lic.expires_at).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                                                                        {!lic.is_active && <span className="text-red-400 ml-1">(suspended)</span>}
                                                                    </p>
                                                                </>
                                                            ) : (
                                                                <p className="text-[11px] text-slate-600">No License (Free tier)</p>
                                                            )}
                                                        </div>

                                                        {/* Change package */}
                                                        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                                                            <p className="text-[9px] text-amber-500 font-black uppercase tracking-widest flex items-center gap-1.5"><Crown className="w-3 h-3" /> Subscription Tier</p>
                                                            <div className="flex gap-1.5">
                                                                {(['free', 'agent', 'elite'] as const).map(pkg => {
                                                                    const isActive = userPkg === pkg;
                                                                    const styles = {
                                                                        free: isActive ? 'bg-emerald-500 text-black border-emerald-500' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-emerald-500/50 hover:text-emerald-400',
                                                                        agent: isActive ? 'bg-amber-500 text-black border-amber-500' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-amber-500/50 hover:text-amber-400',
                                                                        elite: isActive ? 'bg-purple-500 text-black border-purple-500' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-purple-500/50 hover:text-purple-400',
                                                                    };
                                                                    const labels = { free: 'ROOKIE', agent: 'AGENT', elite: 'ELITE' };
                                                                    return (
                                                                        <button key={pkg}
                                                                            className={cn("flex-1 py-2 rounded-lg border text-[9px] font-black transition-all", styles[pkg], isActive && "pointer-events-none shadow-sm")}
                                                                            disabled={changingPkgUser === u.fullUserId}
                                                                            onClick={(e) => { e.stopPropagation(); handleChangePackage(u.fullUserId!, pkg); }}>
                                                                            {changingPkgUser === u.fullUserId ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : labels[pkg]}
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>

                                                        {/* Actions */}
                                                        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                                                            <p className="text-[9px] text-amber-500 font-black uppercase tracking-widest flex items-center gap-1.5"><Shield className="w-3 h-3" /> Actions</p>
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                {u.banned ? (
                                                                    <button className="px-3 py-1.5 rounded-lg text-[10px] font-black bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500 hover:text-black transition-all"
                                                                        disabled={banningUser === u.fullUserId}
                                                                        onClick={(e) => { e.stopPropagation(); handleBanUser(u.fullUserId!, u.displayName || u.userId, false); }}>
                                                                        {banningUser === u.fullUserId ? '...' : '✅ UNBAN'}
                                                                    </button>
                                                                ) : (
                                                                    <button className="px-3 py-1.5 rounded-lg text-[10px] font-black bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500 hover:text-white transition-all"
                                                                        disabled={banningUser === u.fullUserId}
                                                                        onClick={(e) => { e.stopPropagation(); handleBanUser(u.fullUserId!, u.displayName || u.userId, true); }}>
                                                                        {banningUser === u.fullUserId ? '...' : '🚫 BAN'}
                                                                    </button>
                                                                )}
                                                                <button className="px-3 py-1.5 rounded-lg text-[10px] font-black bg-rose-500/10 text-rose-400 border border-rose-500/30 hover:bg-rose-500 hover:text-white transition-all"
                                                                    disabled={deletingUser === u.fullUserId}
                                                                    onClick={(e) => { e.stopPropagation(); handleDeleteUser(u.fullUserId!, u.displayName || u.userId); }}>
                                                                    {deletingUser === u.fullUserId ? '...' : <><Trash2 className="w-3 h-3 inline mr-1" />DELETE</>}
                                                                </button>
                                                                {u.todayPosts > 0 && (
                                                                    <span className="text-[10px] text-slate-500 font-mono">✅{u.todaySuccess} ❌{u.todayFailed}</span>
                                                                )}
                                                                {u.lineId && <span className="text-[10px] text-green-400 font-mono">LINE: {u.lineId}</span>}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                                </motion.div>
                                            )}
                                            </AnimatePresence>
                                        </motion.div>
                                        );
                                    })}
                                    </AnimatePresence>
                                </div>);
                            })()}

                            {/* ── Console Footer ── */}
                            <div className="mt-6 bg-slate-950/80 border border-slate-800 rounded-2xl p-4 font-mono">
                                <div className="flex items-center gap-2 text-slate-600 text-[9px] mb-3 uppercase tracking-[0.2em] font-black">
                                    <Activity size={12} className="text-amber-500/50" /> User Activity Log
                                </div>
                                <div className="space-y-1 text-[10px]">
                                    {(liveStats.users || []).filter(u => u.isOnline).slice(0, 3).map((u, i) => (
                                        <p key={i} className="text-green-500/70">
                                            <span className="text-amber-500/50">[{new Date().toLocaleTimeString('th-TH', { hour12: false })}]</span>{' '}
                                            {u.displayName || u.email?.split('@')[0] || u.userId} — <span className="text-emerald-500/60">online</span>
                                            {(u.isRunningGroup || u.isRunningMarketplace) && <span className="text-amber-400/70"> • running automation</span>}
                                        </p>
                                    ))}
                                    <p className="text-slate-700">
                                        <span className="text-slate-800">[SYS]</span> {allUsers.length || liveStats.activeUsers} users registered • {liveStats.onlineUsers} online • {liveStats.automation.currentlyRunning} automating
                                    </p>
                                    <p className="animate-pulse text-amber-500/40">{'>'} Awaiting admin commands...</p>
                                </div>
                            </div>
                        </>)}
                    </div>
                </div>
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
                                            <TableHead>License Key</TableHead><TableHead>{t.admin.package}</TableHead><TableHead>{t.admin.owner}</TableHead><TableHead>{t.admin.user}</TableHead><TableHead>{t.admin.expiryDate}</TableHead><TableHead>{t.admin.status}</TableHead><TableHead className="text-right">{t.admin.colManage}</TableHead>
                                        </TableRow></TableHeader>
                                        <TableBody>
                                            {filteredLicenses.length === 0 ? (
                                                <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground"><Key className="w-12 h-12 mx-auto mb-4 opacity-20" />{t.admin.noLicenseFound}</TableCell></TableRow>
                                            ) : filteredLicenses.map(license => {
                                                const expired = isExpired(license.expires_at);
                                                const expiringSoon = isExpiringSoon(license.expires_at);
                                                const activation = licenseActivations.find((a: any) => a.license_key_id === license.id);
                                                const pkgColor = license.package === 'elite'
                                                    ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30'
                                                    : license.package === 'agent'
                                                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                                                    : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';
                                                const pkgDot = license.package === 'elite' ? 'bg-purple-500' : license.package === 'agent' ? 'bg-amber-500' : 'bg-emerald-500';
                                                return (
                                                    <TableRow key={license.id} className={cn(expired && "opacity-60")}>
                                                        <TableCell><code className="text-[11px] font-mono bg-muted/60 px-2 py-1 rounded-md border border-border/50 select-all">{license.license_key}</code></TableCell>
                                                        <TableCell><Badge variant="outline" className={cn("font-semibold text-[10px] gap-1 border", pkgColor)}><div className={cn("w-1.5 h-1.5 rounded-full", pkgDot)} />{packageLabels[license.package]}</Badge></TableCell>
                                                        <TableCell><div><div className="font-medium text-sm">{license.owner_name || '—'}</div>{license.owner_contact && <div className="text-[10px] text-muted-foreground truncate max-w-[100px]">{license.owner_contact}</div>}</div></TableCell>
                                                        <TableCell>{activation ? (
                                                            <div className="min-w-0">
                                                                <p className="text-xs font-medium truncate max-w-[120px]">{activation.device_name || activation.device_id?.substring(0, 12) + '...'}</p>
                                                                <p className="text-[10px] text-muted-foreground">{activation.activated_at ? formatDate(activation.activated_at) : ''}</p>
                                                            </div>
                                                        ) : <span className="text-[10px] text-muted-foreground italic">—</span>}</TableCell>
                                                        <TableCell><div className={cn("flex items-center gap-1.5 text-sm tabular-nums", expired ? "text-red-500 font-semibold" : expiringSoon ? "text-amber-500 font-semibold" : "")}>{expired && <span className="text-[9px] px-1 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-bold mr-1">EXP</span>}{formatDate(license.expires_at)}{expiringSoon && !expired && <AlertCircle className="w-3.5 h-3.5 text-amber-500" />}</div></TableCell>
                                                        <TableCell><Badge variant={license.is_active && !expired ? 'outline' : 'destructive'} className={cn("text-[10px] font-bold", license.is_active && !expired ? "border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5" : "")}>{license.is_active && !expired ? '● Active' : '● Inactive'}</Badge></TableCell>
                                                        <TableCell className="text-right"><div className="flex justify-end gap-1">
                                                            <Button size="sm" variant="outline" className="h-7 w-7 p-0 hover:bg-blue-50 dark:hover:bg-blue-950/20 hover:border-blue-300" title="Copy Key" onClick={() => { navigator.clipboard.writeText(license.license_key); toast.success('Copied!'); }}><Copy className="w-3 h-3" /></Button>
                                                            <Button size="sm" variant="outline" className="h-7 w-7 p-0 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 hover:border-emerald-300" title="Extend 30 days" onClick={() => extendLicense(license.id, 30)}><Calendar className="w-3 h-3 text-emerald-600" /></Button>
                                                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20" title="Delete" onClick={() => setDeleteTarget({ id: license.id, key: license.license_key })}><Trash2 className="w-3 h-3" /></Button>
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

                        {/* ── HERO: Grand$tate Mechanical Engine — Dark Luxury ── */}
                        <TooltipProvider delayDuration={200}>
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="relative overflow-hidden rounded-3xl text-white cursor-pointer group shadow-2xl border border-amber-500/20"
                            style={{ background: 'linear-gradient(180deg, hsl(222 47% 6%) 0%, hsl(222 47% 4%) 100%)' }}
                            onClick={() => setQueueDetail({ type: 'slots', data: liveStats.queue })}
                        >
                            {/* Blueprint Grid */}
                            <div className="absolute inset-0 opacity-[0.04] pointer-events-none" style={{
                                backgroundImage: 'linear-gradient(rgba(148,163,184,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,.5) 1px, transparent 1px)',
                                backgroundSize: '40px 40px'
                            }} />

                            {/* Rotating Gear BG */}
                            <motion.div animate={{ rotate: 360 }} transition={{ duration: 60, repeat: Infinity, ease: 'linear' }}
                                className="absolute -top-[200px] -right-[200px] w-[600px] h-[600px] text-amber-500/[0.03] pointer-events-none">
                                <Settings size={600} strokeWidth={0.3} />
                            </motion.div>
                            <motion.div animate={{ rotate: -360 }} transition={{ duration: 45, repeat: Infinity, ease: 'linear' }}
                                className="absolute -bottom-[150px] -left-[150px] w-[400px] h-[400px] text-blue-500/[0.03] pointer-events-none">
                                <Settings size={400} strokeWidth={0.3} />
                            </motion.div>

                            {/* Scanning Laser Line */}
                            <motion.div
                                animate={{ top: ['-5%', '105%'] }}
                                transition={{ duration: 5, repeat: Infinity, ease: 'linear' }}
                                className="absolute left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-amber-500/30 to-transparent pointer-events-none z-30"
                            />

                            {/* Amber glow orbs */}
                            <div className={cn(
                                "absolute -top-20 -left-20 w-64 h-64 rounded-full blur-[100px] transition-all pointer-events-none",
                                liveStats.queue.runningCount > 0 ? "bg-amber-500/15" : "bg-amber-500/5"
                            )} style={{ transitionDuration: '3000ms' }} />
                            <div className={cn(
                                "absolute -bottom-20 -right-20 w-64 h-64 rounded-full blur-[100px] transition-all pointer-events-none",
                                liveStats.queue.runningCount > 0 ? "bg-emerald-500/15" : "bg-emerald-500/5"
                            )} style={{ transitionDuration: '3000ms' }} />

                            <div className="relative z-10 p-6 md:p-10">
                                {/* ── Header: Engine Identity + Metrics Panel ── */}
                                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-10">
                                    <div className="flex items-center gap-5">
                                        {/* 3D Rotating Gear */}
                                        <div className="relative w-16 h-16 flex-shrink-0">
                                            {/* Outer glow ring */}
                                            <div className={cn(
                                                "absolute inset-0 rounded-2xl transition-all",
                                                liveStats.queue.runningCount > 0
                                                    ? "shadow-[0_0_30px_rgba(245,158,11,0.3),0_0_60px_rgba(245,158,11,0.1)] bg-amber-500/10"
                                                    : "shadow-[0_0_15px_rgba(245,158,11,0.1)] bg-amber-500/5"
                                            )} style={{ transitionDuration: '2000ms' }} />
                                            {/* Main gear container with 3D perspective */}
                                            <div className="absolute inset-0 rounded-2xl border border-amber-500/30 bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 overflow-hidden" style={{ perspective: '200px' }}>
                                                {/* Inner highlight for 3D depth */}
                                                <div className="absolute inset-[1px] rounded-2xl bg-gradient-to-br from-amber-500/10 via-transparent to-amber-500/5" />
                                                {/* Back gear layer (slower, opacity) */}
                                                <motion.div
                                                    animate={{ rotate: -360 }}
                                                    transition={{ duration: liveStats.queue.runningCount > 0 ? 8 : 30, repeat: Infinity, ease: 'linear' }}
                                                    className="absolute inset-0 flex items-center justify-center"
                                                    style={{ transform: 'translateZ(-10px)' }}
                                                >
                                                    <Settings className="w-14 h-14 text-amber-500/10" strokeWidth={1.5} />
                                                </motion.div>
                                                {/* Front gear layer (main, spinning) */}
                                                <motion.div
                                                    animate={{ rotate: 360 }}
                                                    transition={{ duration: liveStats.queue.runningCount > 0 ? 3 : 15, repeat: Infinity, ease: 'linear' }}
                                                    className="absolute inset-0 flex items-center justify-center"
                                                >
                                                    <Settings className={cn(
                                                        "w-9 h-9 transition-all",
                                                        liveStats.queue.runningCount > 0
                                                            ? "text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.6)]"
                                                            : "text-amber-500/60"
                                                    )} strokeWidth={2} style={{ transitionDuration: '2000ms' }} />
                                                </motion.div>
                                                {/* Metallic sheen sweep */}
                                                <motion.div
                                                    animate={{ x: ['-100%', '200%'] }}
                                                    transition={{ duration: 3, repeat: Infinity, repeatDelay: 4, ease: 'easeInOut' }}
                                                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none"
                                                    style={{ width: '50%' }}
                                                />
                                            </div>
                                            {/* Active indicator */}
                                            {liveStats.queue.runningCount > 0 && (
                                                <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.7)] animate-pulse border-2 border-slate-900" />
                                            )}
                                        </div>
                                        <div>
                                            <h3 className="text-xl md:text-2xl font-black tracking-tighter uppercase flex items-baseline gap-0">
                                                <span className="text-white">GRAND</span>
                                                <span className="relative inline-block">
                                                    <span className="bg-gradient-to-b from-yellow-300 via-amber-400 to-yellow-600 bg-clip-text text-transparent" style={{ filter: 'drop-shadow(0 0 8px rgba(245,158,11,0.5)) drop-shadow(0 0 2px rgba(255,215,0,0.8))' }}>$</span>
                                                    <motion.span
                                                        animate={{ opacity: [0.3, 0.8, 0.3] }}
                                                        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                                                        className="absolute inset-0 bg-gradient-to-b from-yellow-200 via-amber-300 to-yellow-500 bg-clip-text text-transparent blur-[1px]"
                                                        aria-hidden="true"
                                                    >$</motion.span>
                                                </span>
                                                <span className="text-white">TATE ENGINE</span>
                                                <span className="text-amber-500/50 text-[10px] font-mono font-normal ml-2 tracking-wider">v1.0</span>
                                            </h3>
                                            <p className="text-[10px] text-amber-500/40 uppercase tracking-[0.25em] mt-0.5 font-mono">Real Estate Automation Core</p>
                                        </div>
                                    </div>

                                    {/* Metrics panel */}
                                    <div className="flex gap-6 md:gap-8 bg-slate-950/60 backdrop-blur-sm px-6 py-4 rounded-2xl border border-amber-500/15 shadow-lg">
                                        <div className="text-center">
                                            <AnimatedCounter value={liveStats.queue.runningCount} className="text-3xl md:text-4xl font-black text-white tabular-nums leading-none" />
                                            <p className="text-[9px] text-slate-500 uppercase tracking-[0.15em] mt-1 font-bold">Active Threads</p>
                                        </div>
                                        <div className="w-[1px] bg-slate-800" />
                                        <div className="text-center">
                                            <p className="text-3xl md:text-4xl font-black text-amber-500 tabular-nums leading-none">
                                                {liveStats.queue.runningCount > 0 ? Math.min(Math.round((liveStats.queue.runningCount / liveStats.queue.maxConcurrent) * 100), 100) : 0}%
                                            </p>
                                            <p className="text-[9px] text-slate-500 uppercase tracking-[0.15em] mt-1 font-bold">System Load</p>
                                        </div>
                                        {liveStats.queue.queueLength > 0 && (
                                            <>
                                                <div className="w-[1px] bg-slate-800" />
                                                <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center">
                                                    <p className="text-3xl md:text-4xl font-black text-yellow-400 tabular-nums leading-none animate-pulse">{liveStats.queue.queueLength}</p>
                                                    <p className="text-[9px] text-yellow-400/50 uppercase tracking-[0.15em] mt-1 font-bold">{t.admin.inQueue}</p>
                                                </motion.div>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* ── Slot Grid — Mechanical Worker Cards ── */}
                                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3">
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
                                                onClick={(e) => { e.stopPropagation(); setInspectTab('monitor'); setQueueDetail({ type: 'slot-inspect', data: { slotIndex: i, job: runJob, queueData: liveStats.queue } }); }}
                                                className={cn(
                                                    "relative rounded-2xl border-2 overflow-hidden transition-all duration-500 group/slot backdrop-blur-sm cursor-pointer hover:scale-[1.02]",
                                                    isActive
                                                        ? "border-amber-500/40 bg-slate-900/80 shadow-lg shadow-amber-500/10"
                                                        : "border-slate-800 bg-slate-950/60 hover:border-slate-700"
                                                )}
                                            >
                                                {/* Slot scanning line */}
                                                {isActive && <motion.div animate={{ top: ['-10%', '110%'] }} transition={{ duration: 3, repeat: Infinity, ease: 'linear', delay: i * 0.3 }}
                                                    className="absolute left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent pointer-events-none z-20" />}

                                                <div className="relative z-10 p-3 min-h-[120px] flex flex-col justify-between">
                                                    {/* Slot header: ID + gear + status */}
                                                    <div className="flex justify-between items-start mb-2">
                                                        <span className="text-[10px] text-amber-500/60 font-mono font-bold tracking-widest">No. {String(i + 1).padStart(3, '0')}</span>
                                                        <div className="flex items-center gap-1.5">
                                                            <motion.div animate={isActive ? { rotate: 360 } : {}} transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                                                                className={cn(isActive ? "text-amber-500" : "text-slate-700")}>
                                                                <Settings className="w-3.5 h-3.5" />
                                                            </motion.div>
                                                            <div className={cn("w-2 h-2 rounded-full transition-colors",
                                                                isActive ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" : "bg-slate-700"
                                                            )} />
                                                        </div>
                                                    </div>

                                                    {/* Slot title + status */}
                                                    <div className="mb-2">
                                                        <h4 className={cn("text-xs font-black uppercase transition-colors leading-tight",
                                                            isActive ? "text-white" : "text-slate-600 group-hover/slot:text-slate-400")}>
                                                            {isActive ? (runJob?.automationType === 'marketplace' ? 'Marketplace' : 'Group Post') : 'Worker Slot'}
                                                        </h4>
                                                        <p className={cn("text-[10px] uppercase font-bold tracking-wider",
                                                            isActive ? (runJob?.progress?.isPaused ? "text-yellow-400" : "text-emerald-400") : "text-slate-700")}>
                                                            {isActive ? (runJob?.progress?.isPaused ? 'Paused' : 'Processing') : 'Standby'}
                                                        </p>
                                                        {/* User ID */}
                                                        <p className={cn("text-[8px] font-mono truncate mt-0.5",
                                                            isActive ? "text-cyan-400/70" : "text-slate-700/50")}>
                                                            {isActive ? `USER: ${runJob?.displayName || runJob?.userId || '—'}` : 'No user'}
                                                        </p>
                                                    </div>

                                                    {/* Progress bar */}
                                                    <div className="w-full bg-slate-800 h-[3px] rounded-full mb-2.5 overflow-hidden">
                                                        {isActive ? (
                                                            <motion.div className="h-full rounded-full"
                                                                style={{
                                                                    background: runJob?.progress?.isPaused ? '#eab308' : '#10b981',
                                                                    boxShadow: runJob?.progress?.isPaused ? '0 0 10px #eab308' : '0 0 10px #10b981'
                                                                }}
                                                                initial={{ width: 0 }} animate={{ width: `${progressPct}%` }}
                                                                transition={{ duration: 0.5, ease: 'easeOut' }}
                                                            />
                                                        ) : <div className="h-full w-0" />}
                                                    </div>

                                                    {/* Job details */}
                                                    {runJob ? (
                                                        <div className="space-y-1">
                                                            <p className="text-[10px] font-semibold text-white truncate leading-tight">{runJob.displayName || runJob.userId}</p>
                                                            {runJob.fbAccount && (
                                                                <div className="flex items-center gap-1">
                                                                    <svg className="w-2 h-2 text-blue-400 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                                                                    <span className="text-[8px] text-blue-400/70 truncate leading-tight">{runJob.fbAccount}</span>
                                                                </div>
                                                            )}
                                                            {runJob.propertyTitle && (
                                                                <p className="text-[8px] text-amber-400/70 truncate leading-tight">🏠 {runJob.propertyTitle}</p>
                                                            )}
                                                            <div className="flex justify-between items-center pt-0.5">
                                                                <span className="text-[9px] text-emerald-400/70 font-mono">
                                                                    {runJob.progress ? `${runJob.progress.currentStep}/${runJob.progress.totalSteps}` : `${runJob.groupCount}g`}
                                                                </span>
                                                                <span className="text-[9px] text-slate-500 font-mono">{runMin}:{String(runSec).padStart(2, '0')}</span>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="flex-1 flex items-center justify-center opacity-0 group-hover/slot:opacity-100 transition-opacity">
                                                            <span className="text-[9px] text-slate-600 font-mono">Available</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </motion.div>
                                        );
                                    })}
                                </div>

                                {/* ── Queue waiting list ── */}
                                {liveStats.queue.queue && liveStats.queue.queue.length > 0 && (
                                    <div className="mt-5 p-3 rounded-xl bg-amber-500/5 border border-amber-500/15">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Hourglass className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                                            <span className="text-[10px] text-amber-400 font-black uppercase tracking-wider">Waiting Queue — {liveStats.queue.queue.length} user(s)</span>
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

                                {/* ── Terminal Console ── */}
                                <div className="mt-5 bg-slate-950/80 backdrop-blur-sm rounded-xl p-4 border border-slate-800 max-h-32 overflow-y-auto">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                        <span className="text-[9px] text-amber-500/50 uppercase tracking-[0.2em] font-black">Engine Console</span>
                                    </div>
                                    <div className="space-y-0.5 font-mono">
                                        <p className="text-[11px]"><span className="text-amber-500/50">[SYS]</span> <span className="text-emerald-400/60">Engine initialized — {liveStats.queue.maxConcurrent} slots configured</span></p>
                                        <p className="text-[11px]"><span className="text-amber-500/50">[CFG]</span> <span className="text-slate-500">Timeout: {liveStats.queue.queueTimeoutMin}m per session</span></p>
                                        <p className="text-[11px]"><span className="text-amber-500/50">[SEC]</span> <span className="text-blue-400/50">Anti-detection stealth modules loaded</span></p>
                                        <p className="text-[11px]"><span className="text-amber-500/50">[NET]</span> <span className="text-emerald-400/50">{sseConnected ? 'SSE connection stable — heartbeat OK' : 'SSE disconnected — reconnecting...'}</span></p>
                                        {liveStats.queue.runningCount > 0 && (
                                            <p className="text-[11px]"><span className="text-emerald-400/60">[RUN]</span> <span className="text-emerald-300/70">{liveStats.queue.runningCount} thread(s) active — processing...</span></p>
                                        )}
                                        {liveStats.queue.queueLength > 0 && (
                                            <p className="text-[11px]"><span className="text-yellow-400/60">[QUE]</span> <span className="text-yellow-300/60">{liveStats.queue.queueLength} request(s) in queue — awaiting slot...</span></p>
                                        )}
                                        <p className="text-[11px] animate-pulse"><span className="text-amber-500/30">{'>'}</span> <span className="text-slate-600">Waiting for user input...</span></p>
                                    </div>
                                </div>

                                {/* ── Bottom bar ── */}
                                <div className="flex items-center justify-between mt-4">
                                    <p className="text-[9px] text-slate-700 uppercase tracking-[0.3em] font-black font-mono">Slot 1 — {liveStats.queue.maxConcurrent}</p>
                                    <div className="flex items-center gap-1.5">
                                        <div className={cn("w-1.5 h-1.5 rounded-full", sseConnected ? "bg-emerald-400 animate-pulse" : "bg-red-400")} />
                                        <span className="text-[9px] text-slate-600 uppercase tracking-wider font-bold">{sseConnected ? 'Live' : 'Offline'}</span>
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

                    {/* ═══ Queue Detail — Dark Mechanical Node Inspect ═══ */}
                    <Dialog open={!!queueDetail} onOpenChange={() => setQueueDetail(null)}>
                        <DialogContent className={cn("p-0 overflow-hidden border-amber-500/20 bg-[hsl(222,47%,5%)]", queueDetail?.type === 'slot-inspect' ? 'max-w-5xl' : 'max-w-2xl')}>
                            {/* Blueprint grid overlay */}
                            <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'linear-gradient(rgba(148,163,184,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,.5) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
                            {/* Scanning line */}
                            <motion.div animate={{ top: ['-5%', '105%'] }} transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
                                className="absolute left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-amber-500/20 to-transparent pointer-events-none z-30" />
                            {/* Glow orb */}
                            <div className="absolute -top-20 -right-20 w-48 h-48 rounded-full bg-amber-500/5 blur-[80px] pointer-events-none" />

                            <div className="relative z-10 p-6">
                                {/* Header */}
                                <DialogHeader className="pb-5 border-b border-slate-800">
                                    <DialogTitle className="flex items-center gap-3 text-white">
                                        <div className="p-2 bg-amber-500/15 rounded-xl border border-amber-500/30">
                                            {queueDetail?.type === 'running' && <Activity className="w-5 h-5 text-emerald-400" />}
                                            {queueDetail?.type === 'queued' && <Clock className="w-5 h-5 text-amber-400" />}
                                            {queueDetail?.type === 'history' && <Activity className="w-5 h-5 text-purple-400" />}
                                            {queueDetail?.type === 'stats' && <BarChart3 className="w-5 h-5 text-blue-400" />}
                                            {queueDetail?.type === 'system' && <Monitor className="w-5 h-5 text-cyan-400" />}
                                            {queueDetail?.type === 'slots' && <motion.div animate={{ rotate: 360 }} transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}><Settings className="w-5 h-5 text-amber-500" /></motion.div>}
                                            {queueDetail?.type === 'slot-inspect' && <Monitor className="w-5 h-5 text-amber-500" />}
                                        </div>
                                        <div>
                                            <span className="font-black uppercase tracking-tight text-base">
                                                {queueDetail?.type === 'running' && 'Node Inspect — Active'}
                                                {queueDetail?.type === 'queued' && 'Node Inspect — Queued'}
                                                {queueDetail?.type === 'history' && 'Job History Log'}
                                                {queueDetail?.type === 'stats' && 'Engine Statistics'}
                                                {queueDetail?.type === 'system' && 'System Diagnostics'}
                                                {queueDetail?.type === 'slots' && 'Engine Slots Overview'}
                                                {queueDetail?.type === 'slot-inspect' && `Node Inspection #${String((queueDetail.data?.slotIndex ?? 0) + 1).padStart(3, '0')}`}
                                            </span>
                                            <p className="text-[9px] text-amber-500/40 font-mono uppercase tracking-[0.2em] mt-0.5">
                                                {queueDetail?.type === 'running' && `thread_${queueDetail.data?.userId?.slice(0,8) || 'unknown'}`}
                                                {queueDetail?.type === 'queued' && `queue_pos_${queueDetail.data?.position || 0}`}
                                                {queueDetail?.type === 'history' && 'historical_data_log'}
                                                {queueDetail?.type === 'stats' && 'performance_metrics'}
                                                {queueDetail?.type === 'system' && 'sys_diagnostics_v1.0'}
                                                {queueDetail?.type === 'slots' && `slots_1-${queueDetail.data?.maxConcurrent || 10}`}
                                                {queueDetail?.type === 'slot-inspect' && `direct_engine_access // slot_${String((queueDetail.data?.slotIndex ?? 0) + 1).padStart(3, '0')}`}
                                            </p>
                                        </div>
                                    </DialogTitle>
                                    <DialogDescription className="sr-only">Engine detail view</DialogDescription>
                                </DialogHeader>

                                <div className="space-y-5 pt-5">
                                    {/* ══ Running Job Detail ══ */}
                                    {queueDetail?.type === 'running' && queueDetail.data && (
                                        <div className="space-y-4">
                                            {/* Simulated Live Browser */}
                                            <div className="relative bg-slate-950 rounded-2xl border border-slate-800 h-36 overflow-hidden">
                                                <div className="absolute top-3 left-3 z-20 flex gap-2">
                                                    <span className="bg-emerald-500 text-[8px] px-2 py-0.5 rounded font-black text-white animate-pulse">LIVE</span>
                                                    <span className="bg-slate-800/80 text-[8px] px-2 py-0.5 rounded font-bold text-slate-300 backdrop-blur-md">{queueDetail.data.automationType === 'marketplace' ? 'Marketplace' : 'Group Posting'}</span>
                                                </div>
                                                <motion.div animate={{ rotate: 360 }} transition={{ duration: 20, repeat: Infinity, ease: 'linear' }} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-amber-500/5"><Settings size={200} /></motion.div>
                                                <motion.div animate={{ opacity: [0.3, 0.7, 0.3] }} transition={{ duration: 2, repeat: Infinity }} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[10px] font-mono text-amber-500/60 tracking-[0.3em]">EXECUTING...</motion.div>
                                                <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_30px_rgba(0,0,0,0.7)]" />
                                            </div>

                                            {/* Data Grid */}
                                            <div className="grid grid-cols-2 gap-2">
                                                {[
                                                    { label: 'User', value: queueDetail.data.displayName || queueDetail.data.userId, color: 'text-white' },
                                                    { label: 'Groups', value: `${queueDetail.data.groupCount} groups`, color: 'text-amber-400' },
                                                    { label: 'Runtime', value: `${Math.floor(queueDetail.data.runningSec / 60)}:${String(queueDetail.data.runningSec % 60).padStart(2, '0')}`, color: 'text-emerald-400' },
                                                    { label: 'Started', value: new Date(queueDetail.data.startedAt).toLocaleTimeString('th-TH', { hour12: false }), color: 'text-slate-400' },
                                                ].map((item, idx) => (
                                                    <div key={idx} className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                                                        <p className="text-[9px] text-slate-600 font-bold uppercase tracking-wider">{item.label}</p>
                                                        <p className={cn("text-sm font-bold font-mono truncate", item.color)}>{item.value}</p>
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Progress */}
                                            {queueDetail.data.progress && (
                                                <div className="p-3 rounded-xl bg-slate-900/60 border border-emerald-500/20">
                                                    <div className="flex justify-between text-xs mb-2">
                                                        <span className="text-slate-500 font-bold uppercase text-[9px]">Progress</span>
                                                        <span className="font-mono font-bold text-emerald-400">{queueDetail.data.progress.currentStep}/{queueDetail.data.progress.totalSteps}</span>
                                                    </div>
                                                    <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                                                        <motion.div className="h-full bg-emerald-500 rounded-full" style={{ boxShadow: '0 0 10px #10b981' }}
                                                            initial={{ width: 0 }} animate={{ width: `${(queueDetail.data.progress.currentStep / Math.max(queueDetail.data.progress.totalSteps, 1)) * 100}%` }} />
                                                    </div>
                                                    {queueDetail.data.progress.isPaused && <p className="text-[10px] text-yellow-400 font-bold mt-2">⚠ AUTOMATION PAUSED</p>}
                                                    {queueDetail.data.progress.latestLog && <p className="text-[10px] text-slate-500 truncate mt-1 font-mono">{queueDetail.data.progress.latestLog.text}</p>}
                                                </div>
                                            )}

                                            {/* Security Blueprint */}
                                            <div>
                                                <p className="text-[9px] text-slate-600 font-black uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                                    <Shield className="w-3 h-3 text-amber-500" /> Security Blueprint
                                                </p>
                                                <div className="grid grid-cols-2 gap-1.5">
                                                    {['Gaussian Jitter', 'Fingerprint Mask', 'Network Stealth', 'Typing Sim'].map(m => (
                                                        <div key={m} className="flex items-center gap-2 p-2 bg-slate-950/60 border border-slate-800 rounded-lg">
                                                            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                                                            <span className="text-[10px] font-bold text-slate-400">{m}</span>
                                                            <span className="text-[8px] text-emerald-500/50 ml-auto font-mono">OK</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* ══ Queued Job Detail ══ */}
                                    {queueDetail?.type === 'queued' && queueDetail.data && (
                                        <div className="space-y-4">
                                            <div className="grid grid-cols-2 gap-2">
                                                {[
                                                    { label: 'User', value: queueDetail.data.displayName || queueDetail.data.userId, color: 'text-white' },
                                                    { label: 'Position', value: `#${queueDetail.data.position}`, color: 'text-amber-400' },
                                                    { label: 'Groups', value: `${queueDetail.data.groupCount} groups`, color: 'text-slate-300' },
                                                    { label: 'Waiting', value: `${Math.floor(queueDetail.data.waitingSec / 60)}:${String(queueDetail.data.waitingSec % 60).padStart(2, '0')}`, color: 'text-amber-400' },
                                                    { label: 'Est. Wait', value: `~${Math.ceil(queueDetail.data.estimatedWaitSec / 60)} min`, color: 'text-slate-400' },
                                                    { label: 'Enqueued', value: new Date(queueDetail.data.enqueuedAt).toLocaleTimeString('th-TH', { hour12: false }), color: 'text-slate-400' },
                                                ].map((item, idx) => (
                                                    <div key={idx} className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                                                        <p className="text-[9px] text-slate-600 font-bold uppercase tracking-wider">{item.label}</p>
                                                        <p className={cn("text-sm font-bold font-mono truncate", item.color)}>{item.value}</p>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                                                <Hourglass className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                                                <span className="text-[10px] text-amber-400 font-black uppercase tracking-wider">{t.admin.waiting}</span>
                                            </div>
                                        </div>
                                    )}

                                    {/* ══ History Detail ══ */}
                                    {queueDetail?.type === 'history' && queueDetail.data && (
                                        <div className="space-y-4">
                                            <div className="grid grid-cols-2 gap-2">
                                                {[
                                                    { label: 'User ID', value: queueDetail.data.userId, color: 'text-white' },
                                                    { label: 'Status', value: queueDetail.data.success ? 'SUCCESS' : 'FAILED', color: queueDetail.data.success ? 'text-emerald-400' : 'text-red-400' },
                                                    { label: 'Groups', value: `${queueDetail.data.groupCount} groups`, color: 'text-slate-300' },
                                                    { label: 'Duration', value: queueDetail.data.durationFormatted, color: 'text-amber-400' },
                                                    { label: 'Completed', value: queueDetail.data.completedAtFormatted, color: 'text-slate-400' },
                                                    { label: 'Seconds', value: `${queueDetail.data.durationSec}s`, color: 'text-slate-400' },
                                                ].map((item, idx) => (
                                                    <div key={idx} className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                                                        <p className="text-[9px] text-slate-600 font-bold uppercase tracking-wider">{item.label}</p>
                                                        <p className={cn("text-sm font-bold font-mono truncate", item.color)}>{item.value}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* ══ Stats Detail ══ */}
                                    {queueDetail?.type === 'stats' && queueDetail.data && (
                                        <div className="space-y-4">
                                            <div className="grid grid-cols-2 gap-2">
                                                <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-center">
                                                    <p className="text-3xl font-black text-emerald-400 tabular-nums">{queueDetail.data.totalCompleted}</p>
                                                    <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mt-1">{t.admin.jobsSuccess}</p>
                                                </div>
                                                <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/20 text-center">
                                                    <p className="text-3xl font-black text-red-400 tabular-nums">{queueDetail.data.totalFailed}</p>
                                                    <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mt-1">{t.admin.jobsFailed}</p>
                                                </div>
                                            </div>
                                            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                                                <div className="flex justify-between text-xs mb-2">
                                                    <span className="text-slate-500 font-bold uppercase text-[9px]">Success Rate</span>
                                                    <span className="font-mono font-black text-amber-400 text-lg">{queueDetail.data.successRate}%</span>
                                                </div>
                                                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                                                    <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all" style={{ width: `${queueDetail.data.successRate}%`, boxShadow: '0 0 8px #10b981' }} />
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-3 gap-2 text-center">
                                                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800"><p className="font-mono font-bold text-white text-sm">{queueDetail.data.avgDurationFormatted}</p><p className="text-[8px] text-slate-600 font-bold uppercase">{t.admin.average}</p></div>
                                                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800"><p className="font-mono font-bold text-white text-sm">{Math.floor(queueDetail.data.longestJobSec / 60)}:{String(queueDetail.data.longestJobSec % 60).padStart(2, '0')}</p><p className="text-[8px] text-slate-600 font-bold uppercase">{t.admin.longest}</p></div>
                                                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800"><p className="font-mono font-bold text-white text-sm">{Math.floor(queueDetail.data.shortestJobSec / 60)}:{String(queueDetail.data.shortestJobSec % 60).padStart(2, '0')}</p><p className="text-[8px] text-slate-600 font-bold uppercase">{t.admin.shortest}</p></div>
                                            </div>
                                            <div className="flex justify-between items-center p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                                                <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Total Processed</span>
                                                <span className="font-mono font-black text-white text-lg">{queueDetail.data.totalProcessed}</span>
                                            </div>
                                        </div>
                                    )}

                                    {/* ══ System Detail ══ */}
                                    {queueDetail?.type === 'system' && queueDetail.data && (
                                        <div className="space-y-4">
                                            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                                                <p className="text-[9px] text-slate-600 font-bold uppercase tracking-wider mb-2">Browser Pool</p>
                                                <div className="flex items-center gap-3">
                                                    <div className="flex-1 h-3 bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full transition-all" style={{ width: `${(queueDetail.data.activeBrowsers / (queueDetail.data.maxBrowsers || 10)) * 100}%`, boxShadow: '0 0 8px #3b82f6' }} /></div>
                                                    <span className="font-mono font-black text-white text-sm">{queueDetail.data.activeBrowsers}/{queueDetail.data.maxBrowsers}</span>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                {[
                                                    { label: 'Sessions', value: queueDetail.data.totalSessions, color: 'text-white' },
                                                    { label: 'Online', value: queueDetail.data.onlineUsers, color: 'text-emerald-400' },
                                                    { label: 'Automation', value: queueDetail.data.automationUsers, color: 'text-amber-400' },
                                                    { label: 'Runs Today', value: queueDetail.data.automation?.totalRunsToday || 0, color: 'text-blue-400' },
                                                ].map((item, idx) => (
                                                    <div key={idx} className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                                                        <p className="text-[9px] text-slate-600 font-bold uppercase tracking-wider">{item.label}</p>
                                                        <p className={cn("text-xl font-black font-mono tabular-nums", item.color)}>{item.value}</p>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 flex justify-between items-center">
                                                    <span className="text-[9px] text-slate-500 font-bold">Tasks Done</span><span className="font-mono font-bold text-emerald-400">{queueDetail.data.automation?.totalTasksCompleted || 0}</span>
                                                </div>
                                                <div className="p-3 rounded-xl bg-red-500/5 border border-red-500/20 flex justify-between items-center">
                                                    <span className="text-[9px] text-slate-500 font-bold">Tasks Failed</span><span className="font-mono font-bold text-red-400">{queueDetail.data.automation?.totalTasksFailed || 0}</span>
                                                </div>
                                                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex justify-between items-center">
                                                    <span className="text-[9px] text-slate-500 font-bold">Pending</span><span className="font-mono font-bold text-white">{queueDetail.data.automation?.totalTasksPending || 0}</span>
                                                </div>
                                                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex justify-between items-center">
                                                    <span className="text-[9px] text-slate-500 font-bold">Active Users</span><span className="font-mono font-bold text-white">{queueDetail.data.activeUsers || 0}</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* ══ Node Master Inspect — Full Panel ══ */}
                                    {queueDetail?.type === 'slot-inspect' && queueDetail.data && (() => {
                                        const { slotIndex, job } = queueDetail.data;
                                        const slotId = String(slotIndex + 1).padStart(3, '0');
                                        const isActive = !!job;
                                        const progressPct = job?.progress ? Math.round((job.progress.currentStep / Math.max(job.progress.totalSteps, 1)) * 100) : 0;
                                        const rMin = job ? Math.floor(job.runningSec / 60) : 0;
                                        const rSec = job ? job.runningSec % 60 : 0;
                                        return (
                                        <div className="flex -mx-6 -mb-3 border-t border-slate-800" style={{ minHeight: '430px' }}>
                                            {/* Left: Tab Navigation */}
                                            <div className="w-[68px] bg-slate-950/50 border-r border-slate-800 flex flex-col items-center py-6 gap-4 flex-shrink-0">
                                                {([
                                                    { id: 'monitor' as const, icon: <Monitor size={17} />, label: 'Live' },
                                                    { id: 'security' as const, icon: <Shield size={17} />, label: 'Secure' },
                                                    { id: 'logs' as const, icon: <Terminal size={17} />, label: 'Logs' },
                                                ]).map(tab => (
                                                    <button key={tab.id} onClick={() => setInspectTab(tab.id)}
                                                        className={cn("p-3 rounded-xl transition-all flex flex-col items-center gap-1",
                                                            inspectTab === tab.id ? "bg-amber-500 text-black shadow-lg shadow-amber-500/20" : "text-slate-500 hover:text-white hover:bg-slate-800")}>
                                                        {tab.icon}
                                                        <span className="text-[7px] font-black uppercase tracking-tighter">{tab.label}</span>
                                                    </button>
                                                ))}
                                            </div>

                                            {/* Center: Content Area */}
                                            <div className="flex-1 p-5 overflow-y-auto bg-[#020617]">
                                                <AnimatePresence mode="wait">
                                                    {/* ─── MONITOR TAB ─── */}
                                                    {inspectTab === 'monitor' && (
                                                        <motion.div key="monitor" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                                                            {/* Simulated Browser Viewport */}
                                                            <div className="bg-black rounded-2xl border border-slate-800 h-48 relative overflow-hidden">
                                                                <div className="absolute top-0 inset-x-0 h-7 bg-slate-800/80 backdrop-blur-md flex items-center px-3 justify-between border-b border-white/5 z-10">
                                                                    <div className="flex gap-1.5"><div className="w-2 h-2 rounded-full bg-red-500/50" /><div className="w-2 h-2 rounded-full bg-amber-500/50" /><div className="w-2 h-2 rounded-full bg-green-500/50" /></div>
                                                                    <div className="bg-slate-900 px-3 py-0.5 rounded-full text-[8px] text-slate-500 font-mono truncate max-w-[280px]">
                                                                        {isActive ? `https://facebook.com/${job?.automationType === 'marketplace' ? 'marketplace/listing' : 'groups'}/node_${slotId}` : 'about:blank'}
                                                                    </div>
                                                                    <div className="w-8" />
                                                                </div>
                                                                <div className="flex items-center justify-center h-full">
                                                                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 20, repeat: Infinity, ease: 'linear' }} className="absolute opacity-[0.03]">
                                                                        <Settings size={180} strokeWidth={1} />
                                                                    </motion.div>
                                                                    {isActive ? (
                                                                        <div className="text-center z-10">
                                                                            <Activity className="text-amber-500/40 mx-auto mb-2 animate-pulse" size={32} />
                                                                            <p className="text-[9px] font-mono text-amber-500/60 tracking-[0.3em] uppercase">EXECUTING_TASK_{slotId}...</p>
                                                                            {job?.progress?.latestLog && <p className="text-[8px] text-emerald-400/40 mt-1 font-mono max-w-[250px] truncate mx-auto">{job.progress.latestLog.text}</p>}
                                                                        </div>
                                                                    ) : (
                                                                        <div className="text-center z-10">
                                                                            <Monitor className="text-slate-700 mx-auto mb-2" size={32} />
                                                                            <p className="text-[9px] font-mono text-slate-600 tracking-[0.2em] uppercase">AWAITING_ASSIGNMENT...</p>
                                                                        </div>
                                                                    )}
                                                                    {isActive && <motion.div animate={{ x: [0, 80, -40, 15], y: [0, -20, 30, 5] }} transition={{ duration: 6, repeat: Infinity }} className="absolute z-10">
                                                                        <MousePointer2 className="text-white fill-white opacity-40" size={14} />
                                                                    </motion.div>}
                                                                </div>
                                                                {isActive && <div className="absolute bottom-3 left-4 flex items-center gap-2 z-10">
                                                                    <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                                                                    <span className="text-[8px] font-black text-white uppercase tracking-widest opacity-80">Live View</span>
                                                                </div>}
                                                            </div>

                                                            {/* Task Info Grid */}
                                                            <div className="grid grid-cols-2 gap-3">
                                                                <div className="bg-slate-900/60 border border-slate-800 p-3 rounded-xl">
                                                                    <p className="text-[9px] text-slate-600 font-bold uppercase mb-1">Target Task</p>
                                                                    <p className="text-xs font-bold text-white truncate">{isActive ? (job?.propertyTitle || (job?.automationType === 'marketplace' ? 'Marketplace Posting' : 'Group Posting')) : 'No task assigned'}</p>
                                                                    {job?.fbAccount && <p className="text-[8px] text-blue-400/60 truncate mt-0.5">FB: {job.fbAccount}</p>}
                                                                </div>
                                                                <div className="bg-slate-900/60 border border-slate-800 p-3 rounded-xl">
                                                                    <p className="text-[9px] text-slate-600 font-bold uppercase mb-1">Automation Progress</p>
                                                                    {isActive ? (<>
                                                                        <div className="flex items-center gap-2">
                                                                            <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                                                                <motion.div initial={{ width: 0 }} animate={{ width: `${progressPct}%` }}
                                                                                    className="h-full bg-amber-500 rounded-full" style={{ boxShadow: '0 0 8px rgba(245,158,11,0.5)' }} />
                                                                            </div>
                                                                            <span className="text-xs font-mono text-amber-400 font-bold">{progressPct}%</span>
                                                                        </div>
                                                                        <p className="text-[8px] text-slate-500 mt-1 font-mono">{job?.progress ? `${job.progress.currentStep}/${job.progress.totalSteps} tasks` : `${job?.groupCount || 0} groups`}</p>
                                                                    </>) : <p className="text-xs text-slate-600">Idle</p>}
                                                                </div>
                                                            </div>

                                                            {/* Runtime + User + Groups */}
                                                            {isActive && (
                                                                <div className="grid grid-cols-3 gap-2">
                                                                    <div className="bg-slate-900/60 border border-slate-800 p-2.5 rounded-xl text-center">
                                                                        <p className="text-[8px] text-slate-600 font-bold uppercase">User</p>
                                                                        <p className="text-[11px] font-bold text-white truncate">{job?.displayName || job?.userId || '—'}</p>
                                                                    </div>
                                                                    <div className="bg-slate-900/60 border border-slate-800 p-2.5 rounded-xl text-center">
                                                                        <p className="text-[8px] text-slate-600 font-bold uppercase">Runtime</p>
                                                                        <p className="text-sm font-mono font-bold text-emerald-400">{rMin}:{String(rSec).padStart(2, '0')}</p>
                                                                    </div>
                                                                    <div className="bg-slate-900/60 border border-slate-800 p-2.5 rounded-xl text-center">
                                                                        <p className="text-[8px] text-slate-600 font-bold uppercase">Groups</p>
                                                                        <p className="text-sm font-mono font-bold text-amber-400">{job?.groupCount || 0}</p>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </motion.div>
                                                    )}

                                                    {/* ─── SECURITY TAB ─── */}
                                                    {inspectTab === 'security' && (
                                                        <motion.div key="security" initial={{ opacity: 0, x: 15 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="space-y-4">
                                                            <div className="flex items-center justify-between mb-1">
                                                                <h4 className="text-xs font-black text-white uppercase tracking-tight">Anti-Detection Modules</h4>
                                                                <span className="text-[9px] text-green-400 font-bold bg-green-500/10 px-2 py-0.5 rounded border border-green-500/20 uppercase">All Secure</span>
                                                            </div>
                                                            <div className="grid grid-cols-2 gap-2.5">
                                                                {[
                                                                    { name: 'Gaussian Jitter', icon: <Activity className="w-4 h-4" />, desc: 'Human-like timing randomization', status: 'HIGH' },
                                                                    { name: 'Fingerprint Masking', icon: <Fingerprint className="w-4 h-4" />, desc: 'Browser identity spoofing 100%', status: 'OK' },
                                                                    { name: 'WebRTC Leak Shield', icon: <Globe className="w-4 h-4" />, desc: 'Real IP leak prevention active', status: 'OK' },
                                                                    { name: 'Behavior Simulation', icon: <MousePointer2 className="w-4 h-4" />, desc: 'Mouse/scroll movement emulation', status: 'OK' },
                                                                    { name: 'Canvas Noise', icon: <Sparkles className="w-4 h-4" />, desc: 'Canvas fingerprint randomization', status: 'OK' },
                                                                    { name: 'Network Stealth', icon: <Wifi className="w-4 h-4" />, desc: 'Request header normalization', status: 'OK' },
                                                                ].map((m, mi) => (
                                                                    <div key={mi} className="p-3 bg-slate-900/50 border border-slate-800 rounded-xl flex items-center gap-3 hover:border-amber-500/20 transition-all group/sec">
                                                                        <div className="p-1.5 bg-slate-950 rounded-lg text-amber-500/40 group-hover/sec:text-amber-500 transition-colors">{m.icon}</div>
                                                                        <div className="flex-1 min-w-0">
                                                                            <div className="flex items-center justify-between gap-1">
                                                                                <p className="text-[9px] font-black text-white uppercase tracking-tight truncate">{m.name}</p>
                                                                                <span className={cn("text-[7px] font-mono font-bold flex-shrink-0", m.status === 'HIGH' ? "text-amber-400" : "text-emerald-500")}>{m.status}</span>
                                                                            </div>
                                                                            <p className="text-[8px] text-slate-500 leading-tight">{m.desc}</p>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                            <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl">
                                                                <p className="text-[9px] text-slate-400">
                                                                    <span className="text-amber-500 font-bold uppercase mr-1.5">Note:</span>
                                                                    Gaussian Jitter set to HIGH for maximum stealth. All modules auto-calibrated per session.
                                                                </p>
                                                            </div>
                                                        </motion.div>
                                                    )}

                                                    {/* ─── LOGS TAB ─── */}
                                                    {inspectTab === 'logs' && (
                                                        <motion.div key="logs" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                                                            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 font-mono text-[10px] min-h-[320px]">
                                                                <div className="space-y-1.5">
                                                                    <p className="text-slate-600"><span className="text-amber-500/70">[SYS]</span> Initializing Node_{slotId}...</p>
                                                                    <p className="text-slate-600"><span className="text-blue-400/70">[NET]</span> Proxy connected: SG-Server-{slotId}</p>
                                                                    <p className="text-slate-600"><span className="text-emerald-400/70">[SEC]</span> Anti-detection stealth modules loaded</p>
                                                                    <p className="text-slate-600"><span className="text-emerald-400/70">[SEC]</span> Gaussian Jitter: HIGH</p>
                                                                    <p className="text-slate-600"><span className="text-blue-400/70">[NET]</span> SSE stream: {sseConnected ? 'Connected' : 'Disconnected'}</p>
                                                                    {isActive ? (<>
                                                                        <p className="text-slate-600"><span className="text-green-400/70">[AUTH]</span> Facebook Session: Valid</p>
                                                                        <p className="text-white"><span className="text-amber-400">[TASK]</span> Target: {job?.automationType === 'marketplace' ? 'Marketplace' : 'Group Posting'} — {job?.groupCount || 0} targets</p>
                                                                        <p className="text-slate-600"><span className="text-cyan-400/70">[USER]</span> {job?.displayName || job?.userId}</p>
                                                                        {job?.fbAccount && <p className="text-slate-600"><span className="text-blue-400/60">[FB]</span> Account: {job.fbAccount}</p>}
                                                                        {job?.propertyTitle && <p className="text-slate-600"><span className="text-amber-400/60">[PROP]</span> {job.propertyTitle}</p>}
                                                                        {job?.progress && <p className="text-slate-600"><span className="text-emerald-400/60">[PROG]</span> Step {job.progress.currentStep}/{job.progress.totalSteps} ({progressPct}%)</p>}
                                                                        {job?.progress?.latestLog && <p className="text-white"><span className="text-emerald-400">[LOG]</span> {job.progress.latestLog.text}</p>}
                                                                        <p className="text-slate-600"><span className="text-slate-500">[TIME]</span> Runtime: {rMin}:{String(rSec).padStart(2, '0')}</p>
                                                                        <p className="text-slate-600 animate-pulse"><span className="text-amber-400/50">[WAIT]</span> Anti-spam delay active...</p>
                                                                    </>) : (<>
                                                                        <p className="text-slate-600"><span className="text-slate-500">[SYS]</span> Node_{slotId} on standby — no active task</p>
                                                                        <p className="text-slate-600 animate-pulse"><span className="text-slate-600">[IDLE]</span> Awaiting task assignment...</p>
                                                                    </>)}
                                                                </div>
                                                            </div>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>

                                            {/* Right: Controls Panel */}
                                            <div className="w-48 bg-slate-950/50 border-l border-slate-800 p-5 flex flex-col gap-3 flex-shrink-0">
                                                <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1">Node Controls</p>

                                                {isActive && job?.fullUserId && (<>
                                                    <button
                                                        className="flex items-center gap-2 px-4 py-3 bg-amber-500 text-black font-black text-[10px] rounded-xl hover:bg-amber-400 transition-all shadow-lg shadow-amber-500/20 uppercase tracking-wider"
                                                        disabled={forceStoppingUser === job.fullUserId}
                                                        onClick={() => handleForceStop(job.fullUserId, job.displayName || job.userId)}>
                                                        {forceStoppingUser === job.fullUserId ? <Loader2 size={14} className="animate-spin" /> : <StopCircle size={14} />} Force Stop
                                                    </button>
                                                </>)}

                                                {!isActive && (
                                                    <div className="flex items-center gap-2 px-4 py-3 bg-slate-800/50 text-slate-600 font-black text-[10px] rounded-xl border border-slate-700 uppercase tracking-wider">
                                                        <Pause size={14} /> Standby
                                                    </div>
                                                )}

                                                {/* Status Summary */}
                                                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2 mt-2">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <div className={cn("w-2 h-2 rounded-full", isActive ? "bg-emerald-500 animate-pulse shadow-[0_0_6px_rgba(16,185,129,0.6)]" : "bg-slate-700")} />
                                                        <span className={cn("text-[9px] font-black uppercase", isActive ? "text-emerald-400" : "text-slate-600")}>{isActive ? 'Running' : 'Idle'}</span>
                                                    </div>
                                                    {isActive && job?.automationType && (
                                                        <div className="flex items-center gap-1">
                                                            {job.automationType === 'marketplace' ? <Store className="w-3 h-3 text-blue-400" /> : <Users className="w-3 h-3 text-emerald-400" />}
                                                            <span className="text-[9px] text-slate-400 font-bold uppercase">{job.automationType === 'marketplace' ? 'MKT' : 'Groups'}</span>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Slot Metadata */}
                                                <div className="mt-auto pt-4 border-t border-slate-800 space-y-1.5">
                                                    <div className="flex justify-between text-[9px]">
                                                        <span className="text-slate-600">Slot</span>
                                                        <span className="text-amber-400 font-mono font-bold">#{slotId}</span>
                                                    </div>
                                                    <div className="flex justify-between text-[9px]">
                                                        <span className="text-slate-600">Engine</span>
                                                        <span className="text-slate-400 font-mono">v1.0</span>
                                                    </div>
                                                    <div className="flex justify-between text-[9px]">
                                                        <span className="text-slate-600">SSE</span>
                                                        <span className={sseConnected ? "text-emerald-400" : "text-red-400"}>{sseConnected ? 'Live' : 'Off'}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        );
                                    })()}

                                    {/* ══ Slots Detail — Mechanical Grid ══ */}
                                    {queueDetail?.type === 'slots' && queueDetail.data && (
                                        <div className="space-y-4">
                                            <div className="grid grid-cols-5 gap-2">
                                                {Array.from({ length: queueDetail.data.maxConcurrent }, (_: any, i: number) => {
                                                    const isActive = i < queueDetail.data.runningCount;
                                                    const runningJob = isActive ? queueDetail.data.running[i] : null;
                                                    return (
                                                        <div key={i} className={cn("p-3 rounded-xl border-2 text-center transition-all relative overflow-hidden",
                                                            isActive ? "bg-slate-900/80 border-amber-500/40 shadow-lg shadow-amber-500/10" : "bg-slate-950/60 border-slate-800")}>
                                                            {isActive && <motion.div animate={{ top: ['-10%', '110%'] }} transition={{ duration: 2, repeat: Infinity, ease: 'linear', delay: i * 0.2 }}
                                                                className="absolute left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent pointer-events-none" />}
                                                            <div className="flex justify-center mb-1">
                                                                <motion.div animate={isActive ? { rotate: 360 } : {}} transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                                                                    className={cn(isActive ? "text-amber-500" : "text-slate-700")}>
                                                                    <Settings className="w-3.5 h-3.5" />
                                                                </motion.div>
                                                            </div>
                                                            <p className={cn("text-[10px] font-mono font-black", isActive ? "text-amber-400" : "text-slate-600")}>No. {String(i + 1).padStart(3, '0')}</p>
                                                            {runningJob ? (<>
                                                                <p className="text-[8px] font-bold text-white truncate px-0.5 mt-1">{runningJob.displayName || runningJob.userId}</p>
                                                                <p className="text-[8px] text-emerald-400 font-mono">{runningJob.groupCount}g</p>
                                                            </>) : <p className="text-[8px] text-slate-700 mt-1 font-mono">STANDBY</p>}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            <div className="h-px bg-slate-800" />
                                            <div className="grid grid-cols-3 gap-2 text-center">
                                                <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20"><p className="text-xl font-black text-emerald-400 tabular-nums">{queueDetail.data.runningCount}</p><p className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">Running</p></div>
                                                <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20"><p className="text-xl font-black text-amber-400 tabular-nums">{queueDetail.data.queueLength}</p><p className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">Waiting</p></div>
                                                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800"><p className="text-xl font-black text-white tabular-nums">{queueDetail.data.maxConcurrent - queueDetail.data.runningCount}</p><p className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">Available</p></div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Footer terminal line */}
                                <div className="mt-5 pt-3 border-t border-slate-800 flex items-center justify-between">
                                    <p className="text-[8px] text-slate-700 font-mono uppercase tracking-[0.3em]">GRAND$TATE ENGINE v1.0</p>
                                    <div className="flex items-center gap-1.5">
                                        <div className={cn("w-1.5 h-1.5 rounded-full", sseConnected ? "bg-emerald-400 animate-pulse" : "bg-red-400")} />
                                        <span className="text-[8px] text-slate-600 font-mono uppercase">{sseConnected ? 'Live' : 'Offline'}</span>
                                    </div>
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>
                </>)}

                {/* ═══════════════ TAB: SUPPORT TERMINAL ═══════════════ */}
                {activeTab === 'tickets' && (<>
                    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>

                        {/* Summary Cards — Neon stat modules */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                            {[
                                { label: 'Total Tickets', count: tickets.length, icon: <Mail className="w-5 h-5" />, dotColor: 'bg-blue-500', textColor: 'text-blue-500', borderColor: 'border-blue-500/20 hover:border-blue-500/40' },
                                { label: 'Open', count: tickets.filter(t => t.status === 'open').length, icon: <AlertTriangle className="w-5 h-5" />, dotColor: 'bg-red-500 animate-pulse', textColor: 'text-red-500', borderColor: 'border-red-500/20 hover:border-red-500/40' },
                                { label: 'In Progress', count: tickets.filter(t => t.status === 'in_progress').length, icon: <Settings className="w-5 h-5" />, dotColor: 'bg-amber-500', textColor: 'text-amber-500', borderColor: 'border-amber-500/20 hover:border-amber-500/40', gear: true },
                                { label: 'Resolved', count: tickets.filter(t => t.status === 'resolved' || t.status === 'closed').length, icon: <CheckCircle2 className="w-5 h-5" />, dotColor: 'bg-emerald-500', textColor: 'text-emerald-500', borderColor: 'border-emerald-500/20 hover:border-emerald-500/40' },
                            ].map((s, si) => (
                                <Card key={si} className={cn("transition-all group", s.borderColor)}>
                                    <CardContent className="pt-5 pb-4">
                                        <div className="flex items-center gap-3">
                                            <div className={cn("opacity-50 group-hover:opacity-100 transition-opacity", s.textColor)}>
                                                {s.gear ? (
                                                    <motion.div animate={s.count > 0 ? { rotate: 360 } : {}} transition={{ duration: 4, repeat: Infinity, ease: "linear" }}>
                                                        {s.icon}
                                                    </motion.div>
                                                ) : s.icon}
                                            </div>
                                            <div>
                                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-mono">{s.label}</p>
                                                <p className={cn("text-2xl font-bold font-mono", s.textColor)}>{s.count}</p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>

                        {/* Filter Bar — Status tabs with counts */}
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex gap-1.5 flex-wrap">
                                {([
                                    { key: 'all', label: 'ทั้งหมด', count: tickets.length, dot: '' as const },
                                    { key: 'open', label: 'เปิด', count: tickets.filter(t => t.status === 'open').length, dot: 'bg-red-500' },
                                    { key: 'in_progress', label: 'ดำเนินการ', count: tickets.filter(t => t.status === 'in_progress').length, dot: 'bg-amber-500' },
                                    { key: 'resolved', label: 'แก้ไขแล้ว', count: tickets.filter(t => t.status === 'resolved').length, dot: 'bg-emerald-500' },
                                    { key: 'closed', label: 'ปิด', count: tickets.filter(t => t.status === 'closed').length, dot: 'bg-muted-foreground' },
                                ] as const).map(f => (
                                    <Button
                                        key={f.key}
                                        variant={ticketFilter === f.key ? 'default' : 'outline'}
                                        size="sm"
                                        onClick={() => setTicketFilter(f.key)}
                                        className={cn("text-xs h-8 gap-1.5", ticketFilter === f.key && "shadow-sm")}
                                    >
                                        {f.dot && <div className={cn("w-1.5 h-1.5 rounded-full", f.dot, f.key === 'open' && ticketFilter !== f.key && "animate-pulse")} />}
                                        {f.label}
                                        {f.count > 0 && <span className={cn("text-[9px] px-1 py-0.5 rounded-full font-bold", ticketFilter === f.key ? "bg-white/20" : "bg-muted")}>{f.count}</span>}
                                    </Button>
                                ))}
                            </div>
                            <Button variant="outline" size="sm" onClick={fetchTickets} disabled={ticketsLoading} className="h-8">
                                <RefreshCw className={cn("w-3.5 h-3.5 mr-1.5", ticketsLoading && "animate-spin")} /> รีเฟรช
                            </Button>
                        </div>

                        {/* Ticket Table — Professional layout */}
                        <Card className="overflow-hidden">
                            {ticketsLoading && tickets.length === 0 ? (
                                <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
                                    <Loader2 className="w-5 h-5 animate-spin" /> กำลังโหลด...
                                </div>
                            ) : (tickets.filter(t => ticketFilter === 'all' || t.status === ticketFilter)).length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
                                    <Mail className="w-10 h-10 opacity-20" />
                                    <p className="text-sm">ไม่มีเรื่องแจ้งปัญหา</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-border">
                                    {/* Table Header */}
                                    <div className="hidden md:grid grid-cols-[100px_1fr_100px_120px_120px] gap-3 px-4 py-2.5 bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground font-mono">
                                        <span>Ticket ID</span>
                                        <span>Subject</span>
                                        <span>Priority</span>
                                        <span>Status</span>
                                        <span className="text-right">Action</span>
                                    </div>

                                    {/* Ticket Rows */}
                                    {(tickets.filter(t => ticketFilter === 'all' || t.status === ticketFilter)).map((ticket, idx) => {
                                        const catConfig: Record<string, { label: string; color: string; priority: string }> = {
                                            general: { label: 'ทั่วไป', color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20', priority: 'Low' },
                                            bug: { label: 'บัค', color: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20', priority: 'High' },
                                            feature: { label: 'ฟีเจอร์', color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20', priority: 'Medium' },
                                            billing: { label: 'ชำระเงิน', color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20', priority: 'High' },
                                            facebook: { label: 'Facebook', color: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20', priority: 'Medium' },
                                            automation: { label: 'ออโต้', color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20', priority: 'Medium' },
                                        };
                                        const statusDot: Record<string, string> = {
                                            open: 'bg-red-500 animate-pulse',
                                            in_progress: 'bg-amber-500',
                                            resolved: 'bg-emerald-500',
                                            closed: 'bg-muted-foreground',
                                        };
                                        const cat = catConfig[ticket.category] || catConfig.general;
                                        const isExpanded = replyingTicket === ticket.id;
                                        const ticketNum = `GS-${String(idx + 1).padStart(3, '0')}`;

                                        return (
                                            <div key={ticket.id} className={cn("transition-all", ticket.status === 'open' && "bg-red-500/[0.02]")}>
                                                {/* Main row */}
                                                <div className="grid grid-cols-1 md:grid-cols-[100px_1fr_100px_120px_120px] gap-2 md:gap-3 items-start px-4 py-3 hover:bg-muted/30 transition-colors">
                                                    {/* Ticket ID */}
                                                    <div className="font-mono text-sm font-bold text-accent">{ticketNum}</div>

                                                    {/* Subject + User */}
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                            <h4 className="text-sm font-semibold truncate">{ticket.subject}</h4>
                                                            <Badge variant="outline" className={cn("text-[9px] h-4 px-1.5 border", cat.color)}>{cat.label}</Badge>
                                                        </div>
                                                        <p className="text-xs text-muted-foreground line-clamp-1">{ticket.description}</p>
                                                        <p className="text-[10px] text-muted-foreground/60 mt-1">
                                                            {ticket.user_name || ticket.user_email} · {new Date(ticket.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                                        </p>
                                                    </div>

                                                    {/* Priority */}
                                                    <div>
                                                        <span className={cn(
                                                            "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border",
                                                            cat.priority === 'High' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                                                            cat.priority === 'Medium' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                                                            'bg-muted text-muted-foreground border-border'
                                                        )}>
                                                            {cat.priority}
                                                        </span>
                                                    </div>

                                                    {/* Status */}
                                                    <div>
                                                        <Select value={ticket.status} onValueChange={(val) => handleUpdateTicketStatus(ticket.id, val)}>
                                                            <SelectTrigger className="w-full h-7 text-[10px]">
                                                                <div className="flex items-center gap-1.5">
                                                                    <div className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", statusDot[ticket.status] || 'bg-muted-foreground')} />
                                                                    <SelectValue />
                                                                </div>
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="open">เปิด</SelectItem>
                                                                <SelectItem value="in_progress">กำลังดำเนินการ</SelectItem>
                                                                <SelectItem value="resolved">แก้ไขแล้ว</SelectItem>
                                                                <SelectItem value="closed">ปิด</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>

                                                    {/* Action */}
                                                    <div className="flex justify-end">
                                                        <Button
                                                            size="sm"
                                                            variant={isExpanded ? 'outline' : 'default'}
                                                            className={cn("h-7 text-[10px] font-bold", !isExpanded && "bg-accent text-accent-foreground hover:bg-accent/90 shadow-sm shadow-accent/20")}
                                                            onClick={() => { setReplyingTicket(isExpanded ? null : ticket.id); setReplyText(ticket.admin_reply || ''); }}
                                                        >
                                                            <MessageCircle className="w-3 h-3 mr-1" />
                                                            {isExpanded ? 'CLOSE' : 'VIEW & REPLY'}
                                                        </Button>
                                                    </div>
                                                </div>

                                                {/* Expanded: Admin reply + Reply form */}
                                                <AnimatePresence>
                                                    {isExpanded && (
                                                        <motion.div
                                                            initial={{ height: 0, opacity: 0 }}
                                                            animate={{ height: 'auto', opacity: 1 }}
                                                            exit={{ height: 0, opacity: 0 }}
                                                            className="overflow-hidden"
                                                        >
                                                            <div className="px-4 pb-4 space-y-3">
                                                                {/* Full description */}
                                                                <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                                                                    <p className="text-[10px] text-muted-foreground font-mono mb-1">DESCRIPTION</p>
                                                                    <p className="text-sm whitespace-pre-wrap">{ticket.description}</p>
                                                                    <p className="text-[10px] text-muted-foreground mt-2">จาก: <strong>{ticket.user_name || 'N/A'}</strong> ({ticket.user_email})</p>
                                                                </div>

                                                                {/* Existing admin reply */}
                                                                {ticket.admin_reply && (
                                                                    <div className="p-3 rounded-lg bg-accent/5 border border-accent/15">
                                                                        <p className="text-[10px] text-accent font-bold font-mono mb-1">ADMIN REPLY</p>
                                                                        <p className="text-sm">{ticket.admin_reply}</p>
                                                                        {ticket.admin_replied_at && <p className="text-[9px] text-muted-foreground mt-1.5">{new Date(ticket.admin_replied_at).toLocaleString('th-TH')}</p>}
                                                                    </div>
                                                                )}

                                                                {/* Reply input */}
                                                                <div className="space-y-2">
                                                                    <Textarea
                                                                        value={replyText}
                                                                        onChange={(e) => setReplyText(e.target.value)}
                                                                        placeholder="พิมพ์ข้อความตอบกลับ..."
                                                                        className="min-h-[80px] text-sm resize-none"
                                                                    />
                                                                    <div className="flex justify-end gap-2">
                                                                        <Button variant="outline" size="sm" onClick={() => setReplyingTicket(null)}>ยกเลิก</Button>
                                                                        <Button size="sm" onClick={() => handleReplyTicket(ticket.id)} disabled={!replyText.trim()} className="bg-accent text-accent-foreground hover:bg-accent/90">
                                                                            <Send className="w-3.5 h-3.5 mr-1.5" /> ส่งตอบกลับ
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </Card>
                    </motion.div>
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
