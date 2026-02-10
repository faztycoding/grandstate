import { useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useSupabaseProperties } from '@/hooks/useSupabaseProperties';
import { useGroups } from '@/hooks/useGroups';
import { useHealthCheck } from '@/hooks/useHealthCheck';
import { useLanguage } from '@/i18n/LanguageContext';
import { WelcomeModal } from '@/components/onboarding/WelcomeModal';
import {
  Building2, Users, Send, ShieldCheck, Plus, Zap, HelpCircle,
  CheckCircle2, XCircle, Clock, ArrowRight, Rocket,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { format, subDays, isToday, parseISO } from 'date-fns';

interface ActivityRecord {
  timestamp: string;
  groupCount?: number;
  status?: string;
  propertyTitle?: string;
}

function getPostHistory(): ActivityRecord[] {
  try {
    const raw = localStorage.getItem('healthcheck_post_history');
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function getActivityLog(): ActivityRecord[] {
  try {
    const raw = localStorage.getItem('automation_activity_log');
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export default function Dashboard() {
  const { t } = useLanguage();
  const d = t.dashboard;
  const { properties } = useSupabaseProperties();
  const { groups } = useGroups();
  const { result: healthResult } = useHealthCheck();
  const score = healthResult.overallScore;
  const riskLevel = healthResult.overallLevel;

  const postHistory = useMemo(() => getPostHistory(), []);
  const activityLog = useMemo(() => getActivityLog(), []);

  const postsToday = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    return postHistory.filter((r: any) => r.timestamp > todayStart.getTime()).length;
  }, [postHistory]);

  // Chart data: last 7 days
  const chartData = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const dayStart = new Date(date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(date);
      dayEnd.setHours(23, 59, 59, 999);

      const count = postHistory.filter((r: any) => {
        const ts = typeof r.timestamp === 'number' ? r.timestamp : new Date(r.timestamp).getTime();
        return ts >= dayStart.getTime() && ts <= dayEnd.getTime();
      }).length;

      days.push({
        day: format(date, 'EEE'),
        posts: count,
        isToday: isToday(date),
      });
    }
    return days;
  }, [postHistory]);

  const healthColor = score >= 80 ? 'text-green-600' : score >= 50 ? 'text-amber-600' : 'text-red-600';
  const healthBg = score >= 80 ? 'bg-green-500' : score >= 50 ? 'bg-amber-500' : 'bg-red-500';

  const profileName = localStorage.getItem('profile_name') || 'User';

  return (
    <DashboardLayout
      title={d.title}
      subtitle={`${d.welcomeBack} ${profileName.split(' ')[0]}`}
    >
      <WelcomeModal />

      <div className="space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard
            title={d.totalProperties}
            value={properties.length}
            subtitle={d.activeListings}
            icon={<Building2 className="w-6 h-6" />}
          />
          <StatsCard
            title={d.totalGroups}
            value={groups.length}
            subtitle={`${groups.filter(g => g.isActive).length} ${d.savedGroups}`}
            icon={<Users className="w-6 h-6" />}
          />
          <StatsCard
            title={d.postsToday}
            value={postsToday}
            subtitle={`${d.postsRemaining}`}
            icon={<Send className="w-6 h-6" />}
            variant="primary"
          />
          <StatsCard
            title={d.healthScore}
            value={`${score}%`}
            subtitle={d.safeLevel}
            icon={<ShieldCheck className="w-6 h-6" />}
            variant="accent"
          />
        </div>

        {/* Quick Actions */}
        <Card className="card-elevated">
          <CardHeader className="pb-4">
            <CardTitle>{d.quickActions}</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link to="/gallery">
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/20 hover:bg-blue-100 dark:hover:bg-blue-950/30 transition-colors flex flex-col items-center gap-2 text-center"
              >
                <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                  <Plus className="w-6 h-6 text-blue-600" />
                </div>
                <span className="font-medium text-sm">{d.addProperty}</span>
              </motion.div>
            </Link>
            <Link to="/automation">
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/20 hover:bg-amber-100 dark:hover:bg-amber-950/30 transition-colors flex flex-col items-center gap-2 text-center"
              >
                <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
                  <Zap className="w-6 h-6 text-amber-600" />
                </div>
                <span className="font-medium text-sm">{d.startAutomation}</span>
              </motion.div>
            </Link>
            <Link to="/groups">
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="p-4 rounded-xl bg-purple-50 dark:bg-purple-950/20 hover:bg-purple-100 dark:hover:bg-purple-950/30 transition-colors flex flex-col items-center gap-2 text-center"
              >
                <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center">
                  <Users className="w-6 h-6 text-purple-600" />
                </div>
                <span className="font-medium text-sm">{d.manageGroups}</span>
              </motion.div>
            </Link>
            <Link to="/help">
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="p-4 rounded-xl bg-green-50 dark:bg-green-950/20 hover:bg-green-100 dark:hover:bg-green-950/30 transition-colors flex flex-col items-center gap-2 text-center"
              >
                <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
                  <HelpCircle className="w-6 h-6 text-green-600" />
                </div>
                <span className="font-medium text-sm">{d.viewHelp}</span>
              </motion.div>
            </Link>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Posting Activity Chart */}
          <div className="lg:col-span-2 space-y-4">
            <Card className="card-elevated">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{d.postingActivity}</CardTitle>
                  <Badge variant="secondary" className="text-xs">{d.last7Days}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                {chartData.some(d => d.posts > 0) ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={chartData} barSize={32}>
                      <XAxis dataKey="day" axisLine={false} tickLine={false} className="text-xs" />
                      <YAxis allowDecimals={false} axisLine={false} tickLine={false} className="text-xs" width={30} />
                      <Tooltip
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                        formatter={(value: number) => [`${value} ${d.posts}`, '']}
                      />
                      <Bar dataKey="posts" radius={[6, 6, 0, 0]}>
                        {chartData.map((entry, index) => (
                          <Cell
                            key={index}
                            fill={entry.isToday ? '#f59e0b' : '#e5e7eb'}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[220px] flex flex-col items-center justify-center text-muted-foreground">
                    <Rocket className="w-12 h-12 mb-3 opacity-30" />
                    <p className="font-medium">{d.noData}</p>
                    <p className="text-sm">{d.noActivityDesc}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Activity Feed + Health */}
          <div className="space-y-4">
            {/* Recent Activity Feed */}
            <Card className="card-elevated">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{d.recentActivity}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {activityLog.length > 0 ? (
                  activityLog.slice(0, 5).map((item, i) => (
                    <div key={i} className="flex items-start gap-3 p-2 rounded-lg bg-muted/30">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        item.status === 'success' ? 'bg-green-100 dark:bg-green-900/30' :
                        item.status === 'failed' ? 'bg-red-100 dark:bg-red-900/30' :
                        'bg-amber-100 dark:bg-amber-900/30'
                      }`}>
                        {item.status === 'success' ? <CheckCircle2 className="w-4 h-4 text-green-600" /> :
                         item.status === 'failed' ? <XCircle className="w-4 h-4 text-red-600" /> :
                         <Clock className="w-4 h-4 text-amber-600" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.propertyTitle || 'Post'}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.groupCount ? `${d.postedTo} ${item.groupCount} ${d.groups}` : ''}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {item.timestamp ? format(new Date(item.timestamp), 'MMM d, HH:mm') : ''}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    <Clock className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm font-medium">{d.noActivity}</p>
                    <p className="text-xs">{d.noActivityDesc}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Health Score Card */}
            <Card className="card-elevated overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium">{d.healthScore}</span>
                  <Badge variant="outline" className={healthColor}>
                    {score}%
                  </Badge>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${score}%` }}
                    transition={{ duration: 1.2, ease: 'easeOut' }}
                    className={`h-full rounded-full ${healthBg}`}
                  />
                </div>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-xs text-muted-foreground">
                    {d.postsDone}: {postsToday}
                  </p>
                  <p className={`text-xs font-medium ${healthColor}`}>
                    {riskLevel}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Go to Automation CTA */}
            <Button className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white" asChild>
              <Link to="/automation">
                <Zap className="w-4 h-4 mr-2" />
                {d.startAutomation}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
