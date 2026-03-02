import { useState, useEffect, useCallback, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  XCircle,
  Users,
  Calendar,
  RefreshCw,
  Loader2,
  Clock,
  Zap,
  Target,
  Award,
  Trash2,
  Lightbulb,
  AlertTriangle,
  Lock,
  Crown,
  Rocket,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Flame,
  Shield,
  Hash,
} from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/i18n/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { getUserPackage, getPackageLimits } from '@/hooks/usePackageLimits';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, Legend,
} from 'recharts';
import { motion } from 'framer-motion';

import { apiFetch } from '@/lib/config';
import { AnimatedCounter } from '@/components/ui/animated-counter';

interface DailyData {
  date: string;
  posts: number;
  success: number;
  failed: number;
  groups: number;
}

interface GroupPerf {
  groupId: string;
  groupName: string;
  totalPosts: number;
  successCount: number;
  failedCount: number;
  lastPosted: string | null;
  successRate: number;
  propertiesCount: number;
}

interface AnalyticsData {
  today: {
    postsCount: number;
    limit: number;
    remaining: number;
    successCount?: number;
    failedCount?: number;
  };
  dailyData: DailyData[];
  groupPerformance: GroupPerf[];
  summary: {
    totalPostsAllTime: number;
    totalSuccessAllTime: number;
    totalGroupsPosted: number;
    avgSuccessRate: number;
  };
}

const COLORS = ['#f59e0b', '#10b981', '#ef4444', '#6366f1', '#ec4899', '#14b8a6', '#8b5cf6', '#f97316'];

export default function Analytics() {
  const { language } = useLanguage();
  const isEn = language === 'en';
  const navigate = useNavigate();
  const currentPkg = getUserPackage();
  const pkgLimits = getPackageLimits(currentPkg);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState('7');
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchData = useCallback(async () => {
    if (!pkgLimits.analytics) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const pkg = getUserPackage();
      const res = await apiFetch(`/api/analytics?days=${days}&userPackage=${pkg}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.success) {
        setData(json);
      }
    } catch (err) {
      console.error('Analytics fetch error:', err);
      const fallbackLimit = pkgLimits.postsPerDay;
      setData({
        today: { postsCount: 0, limit: fallbackLimit, remaining: fallbackLimit },
        dailyData: [],
        groupPerformance: [],
        summary: { totalPostsAllTime: 0, totalSuccessAllTime: 0, totalGroupsPosted: 0, avgSuccessRate: 0 },
      });
    } finally {
      setLoading(false);
    }
  }, [days, pkgLimits.analytics, pkgLimits.postsPerDay]);

  useEffect(() => { fetchData(); }, [fetchData, refreshKey]);

  const handleReset = async () => {
    if (!confirm(isEn ? 'Reset all analytics data? This cannot be undone.' : 'ล้างข้อมูลวิเคราะห์ทั้งหมด? ไม่สามารถย้อนกลับได้')) return;
    try {
      const res = await apiFetch('/api/analytics/reset', { method: 'POST' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.success) {
        localStorage.removeItem('healthcheck_post_history');
        localStorage.removeItem('_stats_reset_v1');
        toast.success(isEn ? 'Analytics data reset successfully' : 'ล้างข้อมูลเรียบร้อยแล้ว');
        setRefreshKey(k => k + 1);
      } else {
        toast.error(json.error || 'Reset failed');
      }
    } catch (err: any) {
      console.error('Reset error:', err);
      toast.error(isEn ? `Reset failed: ${err.message}` : `ล้างข้อมูลล้มเหลว: ${err.message}`);
    }
  };

  const handleRefresh = () => {
    setRefreshKey(k => k + 1);
  };

  // ── Permission gate: Analytics is Agent/Elite only ──
  if (!pkgLimits.analytics) {
    return (
      <DashboardLayout
        title={isEn ? 'Analytics & Reports' : 'Analytics & รายงาน'}
        subtitle={isEn ? 'Track your posting performance' : 'ติดตามผลการโพสต์ของคุณ'}
      >
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-100 to-amber-50 dark:from-amber-900/30 dark:to-amber-800/20 flex items-center justify-center mb-6 shadow-lg">
            <Lock className="w-8 h-8 text-amber-500" />
          </div>
          <h2 className="text-xl font-bold mb-2">{isEn ? 'Analytics Locked' : 'ฟีเจอร์วิเคราะห์ถูกล็อก'}</h2>
          <p className="text-muted-foreground text-sm max-w-md mb-6">
            {isEn
              ? 'Analytics & Reports are available for Top Agent and Elite packages. Upgrade to unlock detailed posting statistics, charts, and performance insights.'
              : 'ฟีเจอร์ Analytics & รายงานใช้ได้สำหรับแพ็กเกจ Top Agent และ Elite อัปเกรดเพื่อดูสถิติการโพสต์ กราฟ และข้อมูลเชิงลึก'}
          </p>
          <div className="flex gap-3">
            <Button onClick={() => navigate('/pricing')} className="gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-lg">
              <Crown className="w-4 h-4" />
              {isEn ? 'View Packages' : 'ดูแพ็กเกจ'}
            </Button>
          </div>
          <div className="mt-8 p-4 rounded-xl bg-muted/50 border text-xs text-muted-foreground max-w-sm">
            <div className="flex items-center gap-2 mb-2">
              <Rocket className="w-4 h-4 text-emerald-500" />
              <span className="font-semibold">{isEn ? 'Current: Rookie (Free)' : 'ปัจจุบัน: Rookie (ฟรี)'}</span>
            </div>
            <p>{isEn ? 'Rookie includes 10 posts/day, 10 groups, 10 properties.' : 'Rookie รวม 10 โพสต์/วัน, 10 กลุ่ม, 10 สินทรัพย์'}</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // ── Computed analytics ──
  const totalPosts = data?.dailyData.reduce((s, d) => s + d.posts, 0) || 0;
  const totalSuccess = data?.dailyData.reduce((s, d) => s + d.success, 0) || 0;
  const totalFailed = data?.dailyData.reduce((s, d) => s + d.failed, 0) || 0;
  const successRate = totalPosts > 0 ? Math.round((totalSuccess / totalPosts) * 100) : 0;
  const totalGroups = data?.dailyData.reduce((s, d) => s + d.groups, 0) || 0;

  // Trend: compare first half vs second half of the period
  const trendData = useMemo(() => {
    if (!data?.dailyData || data.dailyData.length < 2) return { posts: 0, success: 0 };
    const mid = Math.floor(data.dailyData.length / 2);
    const firstHalf = data.dailyData.slice(0, mid);
    const secondHalf = data.dailyData.slice(mid);
    const firstPosts = firstHalf.reduce((s, d) => s + d.posts, 0) || 1;
    const secondPosts = secondHalf.reduce((s, d) => s + d.posts, 0);
    const firstSuccess = firstHalf.reduce((s, d) => s + d.success, 0) || 1;
    const secondSuccess = secondHalf.reduce((s, d) => s + d.success, 0);
    return {
      posts: Math.round(((secondPosts - firstPosts) / firstPosts) * 100),
      success: Math.round(((secondSuccess - firstSuccess) / firstSuccess) * 100),
    };
  }, [data?.dailyData]);

  // Peak day
  const peakDay = useMemo(() => {
    if (!data?.dailyData || data.dailyData.length === 0) return null;
    return data.dailyData.reduce((max, d) => d.posts > max.posts ? d : max, data.dailyData[0]);
  }, [data?.dailyData]);

  // Average posts per day
  const avgPostsPerDay = useMemo(() => {
    if (!data?.dailyData || data.dailyData.length === 0) return 0;
    const activeDays = data.dailyData.filter(d => d.posts > 0).length || 1;
    return Math.round(totalPosts / activeDays);
  }, [data?.dailyData, totalPosts]);

  // Area chart data (cumulative)
  const areaData = useMemo(() => {
    if (!data?.dailyData) return [];
    let cumSuccess = 0, cumFailed = 0;
    return data.dailyData.map(d => {
      cumSuccess += d.success;
      cumFailed += d.failed;
      return { ...d, cumSuccess, cumFailed, cumTotal: cumSuccess + cumFailed };
    });
  }, [data?.dailyData]);

  const pieData = [
    { name: isEn ? 'Success' : 'สำเร็จ', value: totalSuccess || 0 },
    { name: isEn ? 'Failed' : 'ล้มเหลว', value: totalFailed || 0 },
  ].filter(d => d.value > 0);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getDate()}/${d.getMonth() + 1}`;
  };

  const TrendBadge = ({ value, suffix = '%' }: { value: number; suffix?: string }) => {
    if (value === 0) return <span className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground"><Minus className="w-3 h-3" />0{suffix}</span>;
    const isUp = value > 0;
    return (
      <span className={`inline-flex items-center gap-0.5 text-[11px] font-medium ${isUp ? 'text-green-600' : 'text-red-500'}`}>
        {isUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
        {isUp ? '+' : ''}{value}{suffix}
      </span>
    );
  };

  const tooltipStyle = {
    background: 'hsl(var(--card))',
    border: '1px solid hsl(var(--border))',
    borderRadius: '10px',
    fontSize: '12px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
  };

  return (
    <DashboardLayout
      title={isEn ? 'Analytics & Reports' : 'Analytics & รายงาน'}
      subtitle={isEn ? 'Deep insights into your posting performance' : 'ข้อมูลเชิงลึกเกี่ยวกับผลการโพสต์'}
    >
      <div className="space-y-6">
        {/* ── Header Controls ── */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Select value={days} onValueChange={setDays}>
              <SelectTrigger className="w-[160px]">
                <Calendar className="w-4 h-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">{isEn ? 'Last 7 days' : '7 วันล่าสุด'}</SelectItem>
                <SelectItem value="14">{isEn ? 'Last 14 days' : '14 วันล่าสุด'}</SelectItem>
                <SelectItem value="30">{isEn ? 'Last 30 days' : '30 วันล่าสุด'}</SelectItem>
                <SelectItem value="60">{isEn ? 'Last 60 days' : '60 วันล่าสุด'}</SelectItem>
              </SelectContent>
            </Select>
            <Badge variant="outline" className="text-xs gap-1">
              <Activity className="w-3 h-3" />
              {data?.groupPerformance?.length || 0} {isEn ? 'groups' : 'กลุ่ม'}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              <span className="ml-1.5 hidden sm:inline">{isEn ? 'Refresh' : 'รีเฟรช'}</span>
            </Button>
            <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/10" onClick={handleReset}>
              <Trash2 className="w-4 h-4" />
              <span className="ml-1.5 hidden sm:inline">{isEn ? 'Reset' : 'ล้าง'}</span>
            </Button>
          </div>
        </div>

        {/* ── KPI Summary Cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            {
              label: isEn ? 'Total Posts' : 'โพสต์ทั้งหมด',
              value: totalPosts,
              icon: Zap,
              color: 'text-amber-600',
              bg: 'bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/20',
              iconBg: 'bg-amber-100 dark:bg-amber-900/50',
              trend: trendData.posts,
            },
            {
              label: isEn ? 'Successful' : 'สำเร็จ',
              value: totalSuccess,
              icon: CheckCircle2,
              color: 'text-emerald-600',
              bg: 'bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/40 dark:to-green-950/20',
              iconBg: 'bg-emerald-100 dark:bg-emerald-900/50',
              trend: trendData.success,
            },
            {
              label: isEn ? 'Failed' : 'ล้มเหลว',
              value: totalFailed,
              icon: XCircle,
              color: 'text-red-600',
              bg: 'bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/40 dark:to-rose-950/20',
              iconBg: 'bg-red-100 dark:bg-red-900/50',
              trend: 0,
            },
            {
              label: isEn ? 'Success Rate' : 'อัตราสำเร็จ',
              value: successRate,
              suffix: '%',
              icon: Target,
              color: successRate >= 80 ? 'text-emerald-600' : successRate >= 50 ? 'text-amber-600' : 'text-red-600',
              bg: successRate >= 80 ? 'bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/20' : 'bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/20',
              iconBg: successRate >= 80 ? 'bg-emerald-100 dark:bg-emerald-900/50' : 'bg-amber-100 dark:bg-amber-900/50',
              trend: 0,
            },
            {
              label: isEn ? 'Avg/Day' : 'เฉลี่ย/วัน',
              value: avgPostsPerDay,
              icon: Flame,
              color: 'text-purple-600',
              bg: 'bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950/40 dark:to-indigo-950/20',
              iconBg: 'bg-purple-100 dark:bg-purple-900/50',
              trend: 0,
            },
          ].map((stat, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}>
              <Card className={`${stat.bg} border-0 shadow-sm hover:shadow-md transition-shadow`}>
                <CardContent className="pt-4 pb-3 px-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className={`w-9 h-9 rounded-xl ${stat.iconBg} flex items-center justify-center`}>
                      <stat.icon className={`w-4.5 h-4.5 ${stat.color}`} />
                    </div>
                    {stat.trend !== 0 && <TrendBadge value={stat.trend} />}
                  </div>
                  <p className="text-2xl font-bold tracking-tight">
                    <AnimatedCounter value={stat.value} suffix={'suffix' in stat ? (stat as any).suffix : ''} />
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{stat.label}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* ── Charts Row: Bar + Area + Donut ── */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          {/* Daily Bar Chart */}
          <motion.div className="xl:col-span-5" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card className="h-full">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <BarChart3 className="w-4 h-4 text-amber-500" />
                  {isEn ? 'Daily Breakdown' : 'โพสต์รายวัน'}
                </CardTitle>
                <CardDescription className="text-xs">
                  {isEn ? `Success vs failed per day (${days}d)` : `สำเร็จ vs ล้มเหลว รายวัน (${days} วัน)`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {data?.dailyData && data.dailyData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={data.dailyData} barGap={2}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                      <XAxis dataKey="date" tickFormatter={formatDate} fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis fontSize={11} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={tooltipStyle} labelFormatter={formatDate} />
                      <Bar dataKey="success" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} name={isEn ? 'Success' : 'สำเร็จ'} />
                      <Bar dataKey="failed" stackId="a" fill="#ef4444" radius={[3, 3, 0, 0]} name={isEn ? 'Failed' : 'ล้มเหลว'} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[260px] flex items-center justify-center text-muted-foreground">
                    <div className="text-center">
                      <BarChart3 className="w-10 h-10 mx-auto mb-2 opacity-20" />
                      <p className="text-sm">{isEn ? 'No data yet' : 'ยังไม่มีข้อมูล'}</p>
                      <p className="text-xs mt-1 opacity-60">{isEn ? 'Start automation to see charts' : 'เริ่ม automation เพื่อดูกราฟ'}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Cumulative Area Chart */}
          <motion.div className="xl:col-span-4" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Card className="h-full">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <TrendingUp className="w-4 h-4 text-blue-500" />
                  {isEn ? 'Growth Trend' : 'แนวโน้มสะสม'}
                </CardTitle>
                <CardDescription className="text-xs">
                  {isEn ? 'Cumulative posts over time' : 'จำนวนโพสต์สะสมตลอดช่วงเวลา'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {areaData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <AreaChart data={areaData}>
                      <defs>
                        <linearGradient id="successGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="totalGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                      <XAxis dataKey="date" tickFormatter={formatDate} fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis fontSize={11} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={tooltipStyle} labelFormatter={formatDate} />
                      <Area type="monotone" dataKey="cumTotal" stroke="#6366f1" fill="url(#totalGrad)" strokeWidth={2} name={isEn ? 'Total' : 'รวม'} />
                      <Area type="monotone" dataKey="cumSuccess" stroke="#10b981" fill="url(#successGrad)" strokeWidth={2} name={isEn ? 'Success' : 'สำเร็จ'} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[260px] flex items-center justify-center text-muted-foreground">
                    <div className="text-center">
                      <TrendingUp className="w-10 h-10 mx-auto mb-2 opacity-20" />
                      <p className="text-sm">{isEn ? 'No trend data' : 'ยังไม่มีข้อมูลแนวโน้ม'}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Donut Chart with Center Stat */}
          <motion.div className="xl:col-span-3" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            <Card className="h-full">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <Target className="w-4 h-4 text-emerald-500" />
                  {isEn ? 'Success Rate' : 'อัตราสำเร็จ'}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center">
                {pieData.length > 0 ? (
                  <div className="relative">
                    <ResponsiveContainer width={200} height={200}>
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={85}
                          paddingAngle={3}
                          dataKey="value"
                          strokeWidth={0}
                        >
                          <Cell fill="#10b981" />
                          <Cell fill="#ef4444" />
                        </Pie>
                        <Tooltip contentStyle={tooltipStyle} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-3xl font-bold">{successRate}%</span>
                      <span className="text-[10px] text-muted-foreground">{isEn ? 'success' : 'สำเร็จ'}</span>
                    </div>
                  </div>
                ) : (
                  <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                    <Target className="w-10 h-10 opacity-20" />
                  </div>
                )}
                <div className="flex items-center gap-4 mt-2 text-xs">
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> {totalSuccess} {isEn ? 'OK' : 'สำเร็จ'}</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500" /> {totalFailed} {isEn ? 'Fail' : 'ล้มเหลว'}</span>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* ── Today + All-time Row ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Today's Usage */}
          {data?.today && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                    <Clock className="w-4 h-4 text-blue-500" />
                    {isEn ? "Today's Quota" : 'โควต้าวันนี้'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">{isEn ? 'Posts used' : 'โพสต์ที่ใช้'}</span>
                      <span className="text-lg font-bold">{data.today.postsCount}<span className="text-sm font-normal text-muted-foreground">/{data.today.limit === 9999 ? '∞' : data.today.limit}</span></span>
                    </div>
                    <div className="h-3 bg-muted rounded-full overflow-hidden">
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500"
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, (data.today.postsCount / Math.max(data.today.limit, 1)) * 100)}%` }}
                        transition={{ duration: 1, ease: 'easeOut' }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{Math.round((data.today.postsCount / Math.max(data.today.limit, 1)) * 100)}% {isEn ? 'used' : 'ใช้แล้ว'}</span>
                      <span>{data.today.remaining === 9999 ? '∞' : data.today.remaining} {isEn ? 'remaining' : 'เหลือ'}</span>
                    </div>
                    {data.today.successCount !== undefined && (
                      <div className="flex items-center gap-4 pt-2 border-t text-xs">
                        <span className="flex items-center gap-1 text-emerald-600"><CheckCircle2 className="w-3.5 h-3.5" /> {data.today.successCount} {isEn ? 'success' : 'สำเร็จ'}</span>
                        <span className="flex items-center gap-1 text-red-500"><XCircle className="w-3.5 h-3.5" /> {data.today.failedCount || 0} {isEn ? 'failed' : 'ล้มเหลว'}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* All-time Summary */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <Award className="w-4 h-4 text-amber-500" />
                  {isEn ? 'All-time Summary' : 'สรุปทั้งหมด'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: isEn ? 'Total Posts' : 'โพสต์ทั้งหมด', value: data?.summary?.totalPostsAllTime || 0, icon: Hash, color: 'text-indigo-600' },
                    { label: isEn ? 'Total Success' : 'สำเร็จทั้งหมด', value: data?.summary?.totalSuccessAllTime || 0, icon: CheckCircle2, color: 'text-emerald-600' },
                    { label: isEn ? 'Groups Posted' : 'กลุ่มที่โพสต์', value: data?.summary?.totalGroupsPosted || 0, icon: Users, color: 'text-blue-600' },
                    { label: isEn ? 'Avg Success' : 'เฉลี่ยสำเร็จ', value: data?.summary?.avgSuccessRate || 0, icon: Target, color: 'text-amber-600', suffix: '%' },
                  ].map((s, i) => (
                    <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl bg-muted/50">
                      <s.icon className={`w-5 h-5 ${s.color} flex-shrink-0`} />
                      <div>
                        <p className="text-lg font-bold leading-tight"><AnimatedCounter value={s.value} suffix={s.suffix || ''} /></p>
                        <p className="text-[10px] text-muted-foreground leading-tight">{s.label}</p>
                      </div>
                    </div>
                  ))}
                </div>
                {peakDay && peakDay.posts > 0 && (
                  <div className="mt-3 pt-3 border-t flex items-center gap-2 text-xs text-muted-foreground">
                    <Flame className="w-3.5 h-3.5 text-orange-500" />
                    <span>{isEn ? 'Peak day:' : 'วันที่โพสต์มากสุด:'} <strong className="text-foreground">{formatDate(peakDay.date)}</strong> — {peakDay.posts} {isEn ? 'posts' : 'โพสต์'}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* ── AI Insights ── */}
        {data && totalPosts > 0 && (() => {
          const insights: { icon: any; color: string; bg: string; title: string; text: string }[] = [];
          const failedGroups = data.groupPerformance.filter(g => g.successRate < 50 && g.totalPosts >= 2);
          const bestGroups = data.groupPerformance.filter(g => g.successRate >= 80 && g.totalPosts >= 2);
          const usagePercent = data.today ? Math.round((data.today.postsCount / Math.max(data.today.limit, 1)) * 100) : 0;

          if (successRate >= 80) {
            insights.push({ icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/30', title: isEn ? 'Excellent Performance' : 'ผลงานดีเยี่ยม', text: isEn ? `${successRate}% success — automation is healthy and running smoothly.` : `สำเร็จ ${successRate}% — ระบบ automation ทำงานได้ราบรื่น` });
          } else if (successRate >= 50) {
            insights.push({ icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/30', title: isEn ? 'Room for Improvement' : 'ปรับปรุงได้', text: isEn ? `${successRate}% success — increase delay between posts or review caption quality.` : `สำเร็จ ${successRate}% — ลองเพิ่ม delay หรือปรับคุณภาพแคปชั่น` });
          } else if (totalPosts > 0) {
            insights.push({ icon: XCircle, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-950/30', title: isEn ? 'Action Required' : 'ต้องแก้ไข', text: isEn ? `Only ${successRate}% success — groups may require approval or captions may be flagged.` : `สำเร็จแค่ ${successRate}% — กลุ่มอาจต้องอนุมัติก่อนหรือแคปชั่นถูกตรวจจับ` });
          }
          if (failedGroups.length > 0) {
            insights.push({ icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/30', title: isEn ? 'Problem Groups Detected' : 'พบกลุ่มที่มีปัญหา', text: isEn ? `${failedGroups.length} group(s) fail >50% — remove or replace: ${failedGroups.slice(0, 3).map(g => g.groupName.slice(0, 20)).join(', ')}` : `${failedGroups.length} กลุ่มล้มเหลว >50% — ลบหรือเปลี่ยน: ${failedGroups.slice(0, 3).map(g => g.groupName.slice(0, 20)).join(', ')}` });
          }
          if (bestGroups.length > 0) {
            insights.push({ icon: Lightbulb, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950/30', title: isEn ? 'Top Performing Groups' : 'กลุ่มที่ทำได้ดี', text: isEn ? `${bestGroups.length} group(s) have 80%+ success — prioritize these for maximum ROI.` : `${bestGroups.length} กลุ่มสำเร็จ 80%+ — ควรให้ความสำคัญกับกลุ่มเหล่านี้` });
          }
          if (avgPostsPerDay > 0 && trendData.posts > 10) {
            insights.push({ icon: TrendingUp, color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-950/30', title: isEn ? 'Growth Detected' : 'มีแนวโน้มเพิ่ม', text: isEn ? `Post volume increased ${trendData.posts}% in the second half of this period.` : `ปริมาณโพสต์เพิ่มขึ้น ${trendData.posts}% ในช่วงหลัง` });
          } else if (trendData.posts < -10) {
            insights.push({ icon: TrendingDown, color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-950/30', title: isEn ? 'Declining Activity' : 'กิจกรรมลดลง', text: isEn ? `Post volume dropped ${Math.abs(trendData.posts)}% — keep posting consistently for best results.` : `ปริมาณโพสต์ลดลง ${Math.abs(trendData.posts)}% — โพสต์สม่ำเสมอเพื่อผลลัพธ์ที่ดี` });
          }
          if (usagePercent >= 80) {
            insights.push({ icon: Zap, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-950/30', title: isEn ? 'Near Quota Limit' : 'ใกล้ถึงโควต้า', text: isEn ? `${usagePercent}% used today — upgrade package for more daily posts.` : `ใช้โควต้าไปแล้ว ${usagePercent}% — อัพเกรดเพื่อโพสต์ได้มากขึ้น` });
          }

          return insights.length > 0 ? (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}>
              <Card className="border-indigo-200/50 dark:border-indigo-800/30">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                    <Lightbulb className="w-4 h-4 text-indigo-500" />
                    {isEn ? 'AI Insights & Recommendations' : 'วิเคราะห์เชิงลึก & คำแนะนำ'}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {isEn ? 'Smart suggestions based on your posting patterns' : 'คำแนะนำอัจฉริยะจากรูปแบบการโพสต์ของคุณ'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {insights.map((ins, i) => (
                      <div key={i} className={`flex items-start gap-3 p-3 rounded-xl ${ins.bg}`}>
                        <ins.icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${ins.color}`} />
                        <div>
                          <p className="text-sm font-semibold">{ins.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{ins.text}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ) : null;
        })()}

        {/* ── Group Performance ── */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                    <Users className="w-4 h-4 text-accent" />
                    {isEn ? 'Group Performance Ranking' : 'จัดอันดับผลงานรายกลุ่ม'}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {isEn ? 'Sorted by most active — hover for details' : 'เรียงตามโพสต์มากสุด — เลื่อนเมาส์ดูรายละเอียด'}
                  </CardDescription>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {data?.groupPerformance?.length || 0} {isEn ? 'groups' : 'กลุ่ม'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {data?.groupPerformance && data.groupPerformance.length > 0 ? (
                <div className="space-y-2">
                  {data.groupPerformance.map((g, i) => {
                    const isGroupId = /^\d{10,}$/.test(g.groupName);
                    const displayName = isGroupId ? `${isEn ? 'Group' : 'กลุ่ม'} #${g.groupName.slice(-6)}` : g.groupName;
                    const rateColor = g.successRate >= 80 ? 'text-emerald-600' : g.successRate >= 50 ? 'text-amber-600' : 'text-red-500';
                    const barColor = g.successRate >= 80 ? 'bg-emerald-500' : g.successRate >= 50 ? 'bg-amber-500' : 'bg-red-500';
                    const maxPosts = data.groupPerformance[0]?.totalPosts || 1;
                    const barWidth = Math.max(5, (g.totalPosts / maxPosts) * 100);

                    return (
                      <div key={g.groupId} className="group flex items-center gap-3 p-3 rounded-xl border bg-card hover:bg-muted/30 transition-all">
                        {/* Rank Medal */}
                        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                          i === 0 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300' :
                          i === 1 ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' :
                          i === 2 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300' :
                          'bg-muted text-muted-foreground'
                        }`}>
                          {i + 1}
                        </div>

                        {/* Name + Progress Bar */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-sm font-medium truncate max-w-[200px]" title={g.groupName}>{displayName}</p>
                            <span className={`text-sm font-bold ${rateColor}`}>{g.successRate}%</span>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <motion.div
                              className={`h-full rounded-full ${barColor}`}
                              initial={{ width: 0 }}
                              animate={{ width: `${barWidth}%` }}
                              transition={{ duration: 0.8, delay: i * 0.05 }}
                            />
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                            <span>{g.totalPosts} {isEn ? 'posts' : 'โพสต์'}</span>
                            <span className="text-emerald-600">{g.successCount} {isEn ? 'ok' : 'สำเร็จ'}</span>
                            {g.failedCount > 0 && <span className="text-red-500">{g.failedCount} {isEn ? 'fail' : 'ล้มเหลว'}</span>}
                            {g.lastPosted && (
                              <span className="hidden sm:inline">{isEn ? 'Last:' : 'ล่าสุด:'} {new Date(g.lastPosted).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-16 text-center text-muted-foreground">
                  <Award className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p className="text-sm">{isEn ? 'No group data yet' : 'ยังไม่มีข้อมูลกลุ่ม'}</p>
                  <p className="text-xs mt-1 opacity-60">{isEn ? 'Post to groups to see rankings' : 'โพสต์ไปยังกลุ่มเพื่อดูอันดับ'}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

      </div>
    </DashboardLayout>
  );
}
