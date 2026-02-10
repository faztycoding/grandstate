import { useState, useEffect, useCallback } from 'react';
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
} from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/i18n/LanguageContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { motion } from 'framer-motion';

import { apiFetch } from '@/lib/config';

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
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState('7');
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const pkg = localStorage.getItem('userPackage') || 'elite';
      const res = await apiFetch(`/api/analytics?days=${days}&userPackage=${pkg}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.success) {
        setData(json);
      }
    } catch (err) {
      console.error('Analytics fetch error:', err);
      setData({
        today: { postsCount: 0, limit: 750, remaining: 750 },
        dailyData: [],
        groupPerformance: [],
        summary: { totalPostsAllTime: 0, totalSuccessAllTime: 0, totalGroupsPosted: 0, avgSuccessRate: 0 },
      });
    } finally {
      setLoading(false);
    }
  }, [days, refreshKey]);

  useEffect(() => { fetchData(); }, [fetchData]);

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

  const totalPosts = data?.dailyData.reduce((s, d) => s + d.posts, 0) || 0;
  const totalSuccess = data?.dailyData.reduce((s, d) => s + d.success, 0) || 0;
  const totalFailed = data?.dailyData.reduce((s, d) => s + d.failed, 0) || 0;
  const successRate = totalPosts > 0 ? Math.round((totalSuccess / totalPosts) * 100) : 0;

  const pieData = [
    { name: isEn ? 'Success' : 'สำเร็จ', value: totalSuccess || 0 },
    { name: isEn ? 'Failed' : 'ล้มเหลว', value: totalFailed || 0 },
  ].filter(d => d.value > 0);

  // Format date for chart labels
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getDate()}/${d.getMonth() + 1}`;
  };

  return (
    <DashboardLayout
      title={isEn ? 'Analytics & Reports' : 'Analytics & รายงาน'}
      subtitle={isEn ? 'Track your posting performance' : 'ติดตามผลการโพสต์ของคุณ'}
    >
      <div className="space-y-6">
        {/* Header Controls */}
        <div className="flex items-center justify-between">
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
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              <span className="ml-2">{isEn ? 'Refresh' : 'รีเฟรช'}</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive border-destructive/30 hover:bg-destructive/10"
              onClick={handleReset}
            >
              <Trash2 className="w-4 h-4 mr-1" />
              {isEn ? 'Reset' : 'ล้างข้อมูล'}
            </Button>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            {
              label: isEn ? 'Total Posts' : 'โพสต์ทั้งหมด',
              value: totalPosts,
              icon: Zap,
              color: 'text-amber-600',
              bg: 'bg-amber-50 dark:bg-amber-950/30',
            },
            {
              label: isEn ? 'Successful' : 'สำเร็จ',
              value: totalSuccess,
              icon: CheckCircle2,
              color: 'text-green-600',
              bg: 'bg-green-50 dark:bg-green-950/30',
            },
            {
              label: isEn ? 'Failed' : 'ล้มเหลว',
              value: totalFailed,
              icon: XCircle,
              color: 'text-red-600',
              bg: 'bg-red-50 dark:bg-red-950/30',
            },
            {
              label: isEn ? 'Success Rate' : 'อัตราสำเร็จ',
              value: `${successRate}%`,
              icon: Target,
              color: successRate >= 80 ? 'text-green-600' : successRate >= 50 ? 'text-amber-600' : 'text-red-600',
              bg: successRate >= 80 ? 'bg-green-50 dark:bg-green-950/30' : successRate >= 50 ? 'bg-amber-50 dark:bg-amber-950/30' : 'bg-red-50 dark:bg-red-950/30',
            },
          ].map((stat, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
              <Card className={stat.bg}>
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center gap-3">
                    <stat.icon className={`w-8 h-8 ${stat.color}`} />
                    <div>
                      <p className="text-2xl font-bold">{stat.value}</p>
                      <p className="text-xs text-muted-foreground">{stat.label}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Daily Posts Bar Chart */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="w-5 h-5 text-accent" />
                {isEn ? 'Daily Posts' : 'จำนวนโพสต์รายวัน'}
              </CardTitle>
              <CardDescription>
                {isEn ? `Last ${days} days activity` : `กิจกรรม ${days} วันล่าสุด`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data?.dailyData && data.dailyData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={data.dailyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tickFormatter={formatDate} fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip
                      contentStyle={{
                        background: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: '13px',
                      }}
                      labelFormatter={formatDate}
                    />
                    <Bar dataKey="success" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} name={isEn ? 'Success' : 'สำเร็จ'} />
                    <Bar dataKey="failed" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} name={isEn ? 'Failed' : 'ล้มเหลว'} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[280px] flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>{isEn ? 'No posting data yet' : 'ยังไม่มีข้อมูลการโพสต์'}</p>
                    <p className="text-xs mt-1">{isEn ? 'Start automation to see data here' : 'เริ่ม automation เพื่อดูข้อมูล'}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Success/Fail Pie Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="w-5 h-5 text-accent" />
                {isEn ? 'Success Rate' : 'อัตราความสำเร็จ'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={4}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      <Cell fill="#10b981" />
                      <Cell fill="#ef4444" />
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[240px] flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <Target className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">{isEn ? 'No data' : 'ไม่มีข้อมูล'}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Today Stats */}
        {data?.today && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="w-5 h-5 text-accent" />
                {isEn ? "Today's Usage" : 'การใช้งานวันนี้'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-6">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">{isEn ? 'Posts used' : 'โพสต์ที่ใช้'}</span>
                    <span className="text-sm font-medium">{data.today.postsCount}/{data.today.limit}</span>
                  </div>
                  <div className="h-3 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all bg-gradient-to-r from-amber-500 to-orange-500"
                      style={{ width: `${Math.min(100, (data.today.postsCount / data.today.limit) * 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {isEn ? `${data.today.remaining} posts remaining today` : `เหลือ ${data.today.remaining} โพสต์วันนี้`}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Actionable Insights */}
        {data && totalPosts > 0 && (() => {
          const insights: { icon: any; color: string; text: string }[] = [];
          const failedGroups = data.groupPerformance.filter(g => g.successRate < 50 && g.totalPosts >= 2);
          const bestGroups = data.groupPerformance.filter(g => g.successRate >= 80 && g.totalPosts >= 2);
          const usagePercent = data.today ? Math.round((data.today.postsCount / data.today.limit) * 100) : 0;

          if (successRate >= 80) {
            insights.push({ icon: CheckCircle2, color: 'text-green-600', text: isEn ? `Great! ${successRate}% success rate — your automation is running smoothly.` : `เยี่ยม! สำเร็จ ${successRate}% — ระบบทำงานได้ดีมาก` });
          } else if (successRate >= 50) {
            insights.push({ icon: AlertTriangle, color: 'text-amber-600', text: isEn ? `${successRate}% success rate — try increasing delay between batches to improve.` : `สำเร็จ ${successRate}% — ลองเพิ่ม delay ระหว่าง batch เพื่อปรับปรุง` });
          } else if (totalPosts > 0) {
            insights.push({ icon: XCircle, color: 'text-red-600', text: isEn ? `Low success rate (${successRate}%) — check if groups require admin approval or change caption style.` : `อัตราสำเร็จต่ำ (${successRate}%) — เช็คว่ากลุ่มต้องอนุมัติก่อนโพสต์หรือลองเปลี่ยนสไตล์แคปชั่น` });
          }
          if (failedGroups.length > 0) {
            insights.push({ icon: AlertTriangle, color: 'text-amber-600', text: isEn ? `${failedGroups.length} groups have high fail rate — consider removing or replacing them.` : `${failedGroups.length} กลุ่มล้มเหลวบ่อย — พิจารณาลบหรือเปลี่ยนกลุ่ม` });
          }
          if (bestGroups.length > 0) {
            insights.push({ icon: Lightbulb, color: 'text-blue-600', text: isEn ? `${bestGroups.length} groups have 80%+ success — prioritize posting to these groups.` : `${bestGroups.length} กลุ่มสำเร็จ 80%+ — ควรโพสต์กลุ่มเหล่านี้เป็นหลัก` });
          }
          if (usagePercent >= 80) {
            insights.push({ icon: Zap, color: 'text-purple-600', text: isEn ? `You've used ${usagePercent}% of today's limit — consider upgrading your package.` : `ใช้โควต้าวันนี้ไปแล้ว ${usagePercent}% — อัพเกรดแพ็คเกจเพื่อโพสต์ได้มากขึ้น` });
          }

          return insights.length > 0 ? (
            <Card className="border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/20">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Lightbulb className="w-5 h-5 text-blue-500" />
                  {isEn ? 'Insights & Recommendations' : 'คำแนะนำจากข้อมูล'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {insights.map((ins, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <ins.icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${ins.color}`} />
                      <p className="text-sm">{ins.text}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : null;
        })()}

        {/* Group Performance — Card-based layout */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="w-5 h-5 text-accent" />
              {isEn ? 'Group Performance' : 'ผลงานรายกลุ่ม'}
            </CardTitle>
            <CardDescription>
              {isEn ? 'Posting results per group — sorted by most active' : 'ผลโพสต์แต่ละกลุ่ม — เรียงตามกลุ่มที่โพสต์มากสุด'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data?.groupPerformance && data.groupPerformance.length > 0 ? (
              <div className="space-y-3">
                {data.groupPerformance.map((g, i) => {
                  const isGroupId = /^\d{10,}$/.test(g.groupName);
                  const displayName = isGroupId
                    ? `${isEn ? 'Group' : 'กลุ่ม'} #${g.groupName.slice(-6)}`
                    : g.groupName;
                  const rateColor = g.successRate >= 80
                    ? 'text-green-600 bg-green-50 dark:bg-green-950/30'
                    : g.successRate >= 50
                    ? 'text-amber-600 bg-amber-50 dark:bg-amber-950/30'
                    : 'text-red-600 bg-red-50 dark:bg-red-950/30';

                  return (
                    <div
                      key={g.groupId}
                      className="flex items-center gap-4 p-3 rounded-xl border bg-card hover:bg-muted/40 transition-colors"
                    >
                      {/* Rank */}
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                        <span className="text-xs font-bold text-muted-foreground">{i + 1}</span>
                      </div>

                      {/* Group Name + Last Posted */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate" title={g.groupName}>
                          {displayName}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {g.lastPosted
                            ? `${isEn ? 'Last:' : 'ล่าสุด:'} ${new Date(g.lastPosted).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`
                            : isEn ? 'Never posted' : 'ยังไม่เคยโพสต์'}
                        </p>
                      </div>

                      {/* Stats Chips */}
                      <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                        {/* Properties - hidden on mobile */}
                        <div className="text-center px-2 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/30 hidden sm:block" title={isEn ? 'Properties posted' : 'สินทรัพย์ที่โพสต์'}>
                          <p className="text-xs font-bold text-blue-600">{g.propertiesCount || 0}</p>
                          <p className="text-[9px] text-blue-500">{isEn ? 'Props' : 'สินทรัพย์'}</p>
                        </div>
                        {/* Total Posts */}
                        <div className="text-center px-2 py-1 rounded-lg bg-muted" title={isEn ? 'Total posts' : 'โพสต์ทั้งหมด'}>
                          <p className="text-xs font-bold">{g.totalPosts}</p>
                          <p className="text-[9px] text-muted-foreground">{isEn ? 'Posts' : 'โพสต์'}</p>
                        </div>
                        {/* Success - hidden on mobile */}
                        <div className="text-center px-2 py-1 rounded-lg bg-green-50 dark:bg-green-950/30 hidden sm:block" title={isEn ? 'Successful' : 'สำเร็จ'}>
                          <p className="text-xs font-bold text-green-600">{g.successCount}</p>
                          <p className="text-[9px] text-green-500">{isEn ? 'OK' : 'สำเร็จ'}</p>
                        </div>
                        {/* Failed - hidden on mobile */}
                        <div className="text-center px-2 py-1 rounded-lg bg-red-50 dark:bg-red-950/30 hidden sm:block" title={isEn ? 'Failed' : 'ล้มเหลว'}>
                          <p className="text-xs font-bold text-red-600">{g.failedCount}</p>
                          <p className="text-[9px] text-red-500">{isEn ? 'Fail' : 'ล้มเหลว'}</p>
                        </div>
                        {/* Success Rate */}
                        <div className={`text-center px-2.5 py-1 rounded-lg ${rateColor}`} title={isEn ? 'Success rate' : 'อัตราสำเร็จ'}>
                          <p className="text-sm font-bold">{g.successRate}%</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-12 text-center text-muted-foreground">
                <Award className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>{isEn ? 'No group data yet' : 'ยังไม่มีข้อมูลกลุ่ม'}</p>
                <p className="text-xs mt-1">{isEn ? 'Post to groups to see performance data' : 'โพสต์ไปยังกลุ่มเพื่อดูข้อมูลผลงาน'}</p>
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </DashboardLayout>
  );
}
