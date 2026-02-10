import { useState, useEffect, useCallback, useRef } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useSupabaseProperties } from '@/hooks/useSupabaseProperties';
import { useSupabaseGroups } from '@/hooks/useSupabaseGroups';
import { Property, FacebookGroup } from '@/types/property';
import {
  Zap,
  Building2,
  Users,
  ExternalLink,
  Check,
  Image as ImageIcon,
  Plus,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Play,
  Pause,
  Square,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Search,
  ChevronRight,
  AlertCircle,
  Settings,
  Globe,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/i18n/LanguageContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useFacebookConnection } from '@/hooks/useFacebookConnection';
import { getUserPackage, getPackageLimits } from '@/hooks/usePackageLimits';
import { useHealthCheck } from '@/hooks/useHealthCheck';
import { HealthCheckCard } from '@/components/automation/HealthCheckCard';
import { TaskProgressPopup } from '@/components/automation/TaskProgressPopup';
import { BulkAddGroupDialog } from '@/components/automation/BulkAddGroupDialog';
import { DailyUsageCard } from '@/components/automation/DailyUsageCard';
import { ScheduledPostsCard } from '@/components/automation/ScheduledPostsCard';
import { apiFetch } from '@/lib/config';

interface TaskStatus {
  id: string;
  groupId: string;
  groupName: string;
  groupUrl?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  message?: string;
  postUrl?: string;
}

interface AutomationState {
  isRunning: boolean;
  isPaused: boolean;
  currentStep: number;
  totalSteps: number;
  tasks: TaskStatus[];
  startTime?: Date;
}

// Caption styles will be set dynamically in component using translations

export default function Automation() {
  const navigate = useNavigate();
  const location = useLocation();
  const { properties } = useSupabaseProperties();
  const { groups, activeGroups, addGroup, deleteGroup, toggleGroupActive } = useSupabaseGroups();
  const { isConnected, isChecking, user } = useFacebookConnection();
  const { t, language } = useLanguage();

  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [generatedCaptions, setGeneratedCaptions] = useState<string[]>([]);
  const [isAddGroupOpen, setIsAddGroupOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupUrl, setNewGroupUrl] = useState('');
  const [propertySearch, setPropertySearch] = useState('');
  const [delayBetweenPosts, setDelayBetweenPosts] = useState(10);
  const [selectedBrowser, setSelectedBrowser] = useState<'chrome' | 'firefox' | 'edge'>('chrome');
  const [userPackage, setUserPackage] = useState<'free' | 'agent' | 'elite'>(() => {
    return (localStorage.getItem('userPackage') as 'free' | 'agent' | 'elite') || 'elite';
  });
  const [postingMode, setPostingMode] = useState<'group' | 'marketplace'>('marketplace'); // Default to marketplace
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [scheduleMode, setScheduleMode] = useState(false);
  const [scheduleDateTime, setScheduleDateTime] = useState('');

  // Automation state
  const [automation, setAutomation] = useState<AutomationState>({
    isRunning: false,
    isPaused: false,
    currentStep: 0,
    totalSteps: 0,
    tasks: [],
  });

  // Health Check — fetches real data from backend postingTracker
  const { result: healthResult, clearHistory, refetch: refetchHealth } = useHealthCheck();

  // ONE-TIME RESET: Clear post history + health check to new-user state
  useEffect(() => {
    const resetDone = localStorage.getItem('_stats_reset_v1');
    if (!resetDone) {
      clearHistory();
      localStorage.setItem('_stats_reset_v1', '1');
      console.log('🔄 Stats reset to new-user state');
    }
  }, [clearHistory]);

  // Filtered properties
  const filteredProperties = properties.filter(p =>
    p.title.toLowerCase().includes(propertySearch.toLowerCase()) ||
    p.location.toLowerCase().includes(propertySearch.toLowerCase())
  );

  // Select/Deselect all groups
  const selectAllGroups = () => {
    const activeGroupIds = groups.filter(g => g.isActive).map(g => g.id);
    setSelectedGroups(activeGroupIds);
  };

  const deselectAllGroups = () => {
    setSelectedGroups([]);
  };

  // Auto-select property from navigation state
  useEffect(() => {
    const state = location.state as { propertyId?: string } | null;
    if (state?.propertyId) {
      const property = properties.find(p => p.id === state.propertyId);
      if (property) {
        setSelectedProperty(property);
      }
    }
  }, [location.state, properties]);

  const toggleGroup = (groupId: string) => {
    setSelectedGroups(prev =>
      prev.includes(groupId)
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    );
  };

  const handleAddGroup = () => {
    if (!newGroupName.trim()) {
      toast.error(t.automation.fillGroupName);
      return;
    }
    if (!newGroupUrl.trim()) {
      toast.error(t.automation.fillGroupUrl);
      return;
    }

    addGroup({
      name: newGroupName,
      url: newGroupUrl,
      memberCount: 0,
    });

    toast.success(t.automation.groupAdded);
    setNewGroupName('');
    setNewGroupUrl('');
    setIsAddGroupOpen(false);
  };

  const handleDeleteGroup = (groupId: string, groupName: string) => {
    deleteGroup(groupId);
    setSelectedGroups(prev => prev.filter(id => id !== groupId));
    toast.success(`${t.automation.groupDeleted}: "${groupName}"`);
  };

  // Get daily post limit based on package
  const getDailyPostLimit = (pkg: string): number => {
    switch (pkg) {
      case 'free': return 10;
      case 'agent': return 300;
      case 'elite': return 750;
      default: return 10;
    }
  };

  // Validate post limit
  const validatePostLimit = (): boolean => {
    const limit = getDailyPostLimit(userPackage);
    if (selectedGroups.length > limit) {
      toast.error(`${t.automation.packageLimit}: ${userPackage.toUpperCase()} ${limit} ${t.automation.postsPerDay}`, {
        description: `${selectedGroups.length} ${t.automation.groups} ${t.automation.exceeded} ${limit}`,
      });
      return false;
    }
    return true;
  };

  // Start Automation
  const startAutomation = async () => {
    if (!selectedProperty) {
      toast.error(t.automation.pleaseSelectProperty);
      return;
    }
    if (selectedGroups.length === 0) {
      toast.error(t.automation.pleaseSelectGroups);
      return;
    }
    // Validate post limit based on package
    if (!validatePostLimit()) {
      return;
    }

    // Initialize tasks
    const tasks: TaskStatus[] = selectedGroups.map(groupId => {
      const group = groups.find(g => g.id === groupId);
      return {
        id: `task-${groupId}`,
        groupId,
        groupName: group?.name || 'Unknown',
        status: 'pending',
      };
    });

    setAutomation({
      isRunning: true,
      isPaused: false,
      currentStep: 0,
      totalSteps: tasks.length,
      tasks,
      startTime: new Date(),
    });

    toast.info(t.automation.automationStarting, {
      description: `${t.automation.postingTo} ${tasks.length} ${t.automation.groups}`,
    });

    // Prepare groups data with URLs
    const groupsData = selectedGroups.map(groupId => {
      const group = groups.find(g => g.id === groupId);
      return {
        id: groupId,
        name: group?.name || 'Unknown',
        url: group?.url || '',
      };
    });

    // Call backend to start automation (group or marketplace mode)
    // Backend will auto-generate captions based on group count
    const apiPath = postingMode === 'marketplace'
      ? '/api/marketplace-automation/start'
      : '/api/group-automation/start';

    try {
      const response = await apiFetch(apiPath, {
        method: 'POST',
        body: JSON.stringify({
          property: selectedProperty,
          groups: groupsData,
          images: selectedProperty?.images || [],
          delaySeconds: delayBetweenPosts,
          browser: selectedBrowser,
          userPackage,
          claudeApiKey: localStorage.getItem('claudeApiKey') || undefined,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        // Handle login required error
        if (result.errorType === 'login_required') {
          toast.error(result.error || t.automation.notConnected, {
            description: result.message || t.automation.connectFirst,
          });
          setAutomation({ isRunning: false, isPaused: false, currentStep: 0, totalSteps: 0, tasks: [] });
          return;
        }
        // Handle daily limit reached
        if (result.errorType === 'limit_reached') {
          toast.error(result.error || 'ถึงลิมิตวันนี้แล้ว', {
            description: `รีเซ็ตเวลาตี 5 — ${result.dailyStats?.remaining ?? 0} โพสต์เหลือ`,
            duration: 8000,
          });
          setAutomation({ isRunning: false, isPaused: false, currentStep: 0, totalSteps: 0, tasks: [] });
          return;
        }
        throw new Error(result.error || 'Failed to start automation');
      }

      // Show skip info if any groups were filtered
      if (result.skippedDuplicate > 0 || result.skippedOverLimit > 0) {
        toast.info(`เริ่มโพสต์ ${result.totalGroups} กลุ่ม`, {
          description: [
            result.skippedDuplicate > 0 ? `ข้ามซ้ำ ${result.skippedDuplicate}` : '',
            result.skippedOverLimit > 0 ? `เกินลิมิต ${result.skippedOverLimit}` : '',
          ].filter(Boolean).join(', '),
        });
      }

      // Store generated captions for TaskProgressPopup display
      if (result.generatedCaptions) {
        setGeneratedCaptions(result.generatedCaptions);
      }

      // Start polling for status updates
      pollAutomationStatus();
    } catch (error: any) {
      toast.error(t.automation.automationError, {
        description: error.message || t.automation.checkBackend,
      });
      // Auto reset UI state
      setAutomation({ isRunning: false, isPaused: false, currentStep: 0, totalSteps: 0, tasks: [] });
    }
  };

  // Polling interval ref — prevents stacking intervals
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  // Poll automation status
  const pollAutomationStatus = useCallback(() => {
    // Clear any existing interval first
    if (pollingRef.current) clearInterval(pollingRef.current);

    const statusPath = postingMode === 'marketplace'
      ? '/api/marketplace-automation/status'
      : '/api/group-automation/status';

    pollingRef.current = setInterval(async () => {
      try {
        const response = await apiFetch(statusPath);
        const data = await response.json();

        if (data.success) {
          setAutomation(prev => ({
            ...prev,
            currentStep: data.currentStep || prev.currentStep,
            totalSteps: data.totalSteps || prev.totalSteps,
            tasks: data.tasks || prev.tasks,
            isRunning: data.isRunning ?? prev.isRunning,
            isPaused: data.isPaused ?? prev.isPaused,
          }));

          if (!data.isRunning) {
            if (pollingRef.current) clearInterval(pollingRef.current);
            pollingRef.current = null;

            // Keep tasks in state so popup shows final results
            setAutomation(prev => ({
              ...prev,
              isRunning: false,
              isPaused: false,
              tasks: data.tasks || prev.tasks,
            }));

            const completed = data.tasks?.filter((t: TaskStatus) => t.status === 'completed').length || 0;
            const failed = data.tasks?.filter((t: TaskStatus) => t.status === 'failed').length || 0;

            // Refetch health check after task updates (backend records posts directly)
            if (data.tasks?.some((t: TaskStatus) => t.status === 'completed' || t.status === 'failed')) {
              refetchHealth();
            }

            if (completed > 0 || failed > 0) {
              toast.success(t.automation.automationDone, {
                description: `${t.automation.successCount} ${completed} ${t.automation.groups}${failed > 0 ? `, ${t.automation.failedCount} ${failed} ${t.automation.groups}` : ''}`,
              });
            }
          }
        }
      } catch (error) {
        // Silently fail - backend might not be running
      }
    }, 1000);
  }, [postingMode, refetchHealth, t]);

  // Stop Automation
  const stopAutomation = async () => {
    // Clear polling immediately
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }

    const stopPath = postingMode === 'marketplace'
      ? '/api/marketplace-automation/stop'
      : '/api/group-automation/stop';
    try {
      await apiFetch(stopPath, { method: 'POST' });
      setAutomation(prev => ({ ...prev, isRunning: false, isPaused: false }));
      toast.info(t.automation.automationStopped);
    } catch (error) {
      setAutomation(prev => ({ ...prev, isRunning: false, isPaused: false }));
    }
  };

  // Pause/Resume Automation
  const pauseAutomation = async () => {
    const basePath = postingMode === 'marketplace'
      ? '/api/marketplace-automation'
      : '/api/group-automation';
    try {
      const action = automation.isPaused ? 'resume' : 'pause';
      await apiFetch(`${basePath}/${action}`, { method: 'POST' });
      setAutomation(prev => ({ ...prev, isPaused: !prev.isPaused }));
      toast.info(automation.isPaused ? t.automation.resumed : t.automation.paused);
    } catch (error) {
      toast.error(t.common.error);
    }
  };

  // Calculate progress
  const completedTasks = automation.tasks.filter(t => t.status === 'completed').length;
  const failedTasks = automation.tasks.filter(t => t.status === 'failed').length;
  const progressPercent = automation.totalSteps > 0
    ? Math.round((completedTasks / automation.totalSteps) * 100)
    : 0;

  return (
    <DashboardLayout
      title={t.automation.title}
      subtitle={t.automation.subtitle}
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Property & Groups Selection */}
        <div className="lg:col-span-2 space-y-6">
          {/* Step 1: Property Selection */}
          <Card className="card-elevated">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center text-accent font-bold">1</div>
                    <Building2 className="w-5 h-5 text-accent" />
                    {t.automation.step1}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {t.automation.selectProperty}
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => navigate('/gallery')}>
                  <Plus className="w-4 h-4 mr-1" />
                  {t.common.add}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={propertySearch}
                  onChange={(e) => setPropertySearch(e.target.value)}
                  placeholder={t.automation.searchProperty}
                  className="pl-10"
                />
              </div>

              {filteredProperties.length > 0 ? (
                <ScrollArea className="h-[280px] pr-4">
                  <div className="grid grid-cols-1 gap-3">
                    {filteredProperties.map((property) => (
                      <motion.div
                        key={property.id}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <button
                          onClick={() => setSelectedProperty(property)}
                          className={cn(
                            'w-full p-4 rounded-xl border-2 transition-all duration-200 text-left',
                            selectedProperty?.id === property.id
                              ? 'border-accent bg-accent/5 shadow-glow'
                              : 'border-border hover:border-accent/50 hover:bg-muted/50'
                          )}
                        >
                          <div className="flex gap-3">
                            {property.images[0] ? (
                              <img
                                src={property.images[0]}
                                alt={property.title}
                                className="w-16 h-16 rounded-lg object-cover"
                              />
                            ) : (
                              <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center">
                                <ImageIcon className="w-6 h-6 text-muted-foreground" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium text-sm truncate">
                                {property.title}
                              </h4>
                              <p className="text-xs text-muted-foreground truncate">
                                {property.location}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="secondary" className="text-xs">
                                  {property.listingType === 'rent' ? t.properties.forRent : t.properties.forSale}
                                </Badge>
                                <span className="text-xs font-semibold text-accent">
                                  ฿{new Intl.NumberFormat('th-TH').format(property.price)}
                                </span>
                              </div>
                            </div>
                            {selectedProperty?.id === property.id && (
                              <Check className="w-5 h-5 text-accent" />
                            )}
                          </div>
                        </button>
                      </motion.div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center py-8">
                  <Building2 className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground mb-4">{t.automation.noProperty}</p>
                  <Button onClick={() => navigate('/gallery')}>
                    {t.automation.addPropertyFirst}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Step 2: Group Selection */}
          <Card className="card-elevated">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center text-accent font-bold">2</div>
                    <Users className="w-5 h-5 text-accent" />
                    {t.automation.step2}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {t.automation.selectGroups}
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => setIsAddGroupOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  {t.automation.addGroup}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Select All / Deselect All */}
              {groups.length > 0 && (
                <div className="flex items-center justify-between pb-2 border-b">
                  <span className="text-sm text-muted-foreground">
                    {t.automation.selected} {selectedGroups.length} / {groups.filter(g => g.isActive).length} {t.automation.groups}
                  </span>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={selectAllGroups}>
                      {t.common.selectAll}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={deselectAllGroups}>
                      {t.common.deselectAll}
                    </Button>
                  </div>
                </div>
              )}

              {groups.length > 0 ? (
                <ScrollArea className="h-[250px] pr-4">
                  <div className="space-y-2">
                    {groups.map((group) => (
                      <div
                        key={group.id}
                        className={cn(
                          'flex items-center gap-3 p-3 rounded-lg border transition-all',
                          !group.isActive && 'opacity-50',
                          selectedGroups.includes(group.id) && group.isActive
                            ? 'border-accent bg-accent/5'
                            : 'border-border hover:border-accent/50'
                        )}
                      >
                        <Checkbox
                          checked={selectedGroups.includes(group.id)}
                          disabled={!group.isActive}
                          onCheckedChange={() => toggleGroup(group.id)}
                        />
                        <div
                          className="flex-1 cursor-pointer"
                          onClick={() => group.isActive && toggleGroup(group.id)}
                        >
                          <p className="font-medium text-sm">{group.name}</p>
                          {group.memberCount && group.memberCount > 0 && (
                            <p className="text-xs text-muted-foreground">
                              {new Intl.NumberFormat('th-TH').format(group.memberCount)} {t.groups.members}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => toggleGroupActive(group.id)}
                            title={group.isActive ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
                          >
                            {group.isActive ? (
                              <ToggleRight className="w-4 h-4 text-success" />
                            ) : (
                              <ToggleLeft className="w-4 h-4 text-muted-foreground" />
                            )}
                          </Button>
                          <a
                            href={group.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-accent"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleDeleteGroup(group.id, group.name)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center py-8">
                  <Users className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground mb-4">{t.automation.noGroups}</p>
                  <Button onClick={() => setIsAddGroupOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    {t.automation.addGroup}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Actions */}
        <div className="space-y-6">
          {/* Step 3: Start Automation */}
          <Card className="card-elevated border-accent/50 bg-gradient-to-br from-accent/5 to-orange-500/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center text-accent font-bold">3</div>
                <Zap className="w-5 h-5 text-accent" />
                {t.automation.step4}
              </CardTitle>
              <CardDescription>
                {t.automation.checklist}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Facebook Connection Status */}
              {!isConnected && !isChecking && (
                <div className="p-4 rounded-lg bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-medium text-orange-700 dark:text-orange-400">{t.automation.notConnected}</p>
                      <p className="text-sm text-muted-foreground mt-1">{t.automation.connectFirst}</p>
                      <Link to="/settings">
                        <Button variant="outline" size="sm" className="mt-3">
                          <Settings className="w-4 h-4 mr-2" />
                          {t.automation.goToSettings}
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              )}

              {isConnected && (
                <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
                  <div className="flex items-center gap-3">
                    {user?.profilePic ? (
                      <img src={user.profilePic} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    ) : (
                      <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                    )}
                    <div>
                      <p className="font-medium text-green-700 dark:text-green-400">{t.automation.connectedAs}</p>
                      <p className="text-xs text-muted-foreground">{user?.name || 'Facebook User'}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Checklist */}
              <div className="p-4 rounded-lg bg-background/80 space-y-3">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center",
                    selectedProperty ? "bg-green-100 text-green-600" : "bg-muted text-muted-foreground"
                  )}>
                    {selectedProperty ? <Check className="w-4 h-4" /> : <span className="text-xs">1</span>}
                  </div>
                  <div className="flex-1">
                    <p className={cn("text-sm font-medium", !selectedProperty && "text-muted-foreground")}>
                      {selectedProperty ? selectedProperty.title : t.automation.selectProperty}
                    </p>
                    {selectedProperty && (
                      <p className="text-xs text-muted-foreground">
                        {selectedProperty.images?.length || 0} {t.properties.images}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center",
                    selectedGroups.length > 0 ? "bg-green-100 text-green-600" : "bg-muted text-muted-foreground"
                  )}>
                    {selectedGroups.length > 0 ? <Check className="w-4 h-4" /> : <span className="text-xs">2</span>}
                  </div>
                  <div className="flex-1">
                    <p className={cn("text-sm font-medium", selectedGroups.length === 0 && "text-muted-foreground")}>
                      {selectedGroups.length > 0 ? `${selectedGroups.length} ${t.automation.groupsSelected}` : t.automation.selectGroups}
                    </p>
                  </div>
                </div>

              </div>

              {/* Posting Mode Toggle */}
              <div className="p-3 rounded-lg bg-muted/50 space-y-2">
                <div className="flex items-center gap-2">
                  <Globe className="w-5 h-5 text-muted-foreground" />
                  <p className="text-sm font-medium">โหมดโพสต์</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {/* Marketplace - Locked Coming Soon */}
                  <div className="relative group">
                    <button
                      disabled
                      className="w-full p-3 rounded-lg border-2 border-dashed border-muted-foreground/30 bg-gradient-to-br from-muted/80 to-muted/40 text-center cursor-not-allowed relative overflow-hidden"
                    >
                      {/* Animated chain pattern background */}
                      <div className="absolute inset-0 opacity-[0.08]" style={{
                        backgroundImage: `url("data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h20v20H0z' fill='none'/%3E%3Ccircle cx='10' cy='10' r='3' fill='%23888' fill-opacity='0.4'/%3E%3C/svg%3E")`,
                        backgroundSize: '12px 12px'
                      }} />

                      {/* Lock icon overlay */}
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-8 h-8 rounded-full bg-muted-foreground/10 flex items-center justify-center">
                          <span className="text-lg opacity-40">🔒</span>
                        </div>
                      </div>

                      {/* Content */}
                      <div className="relative z-10">
                        <span className="text-lg opacity-50 grayscale">🏪</span>
                        <p className="text-xs mt-1 font-medium text-muted-foreground/70">Marketplace</p>
                        <p className="text-[10px] text-muted-foreground/50">โพสต์ + ติ๊กกลุ่ม 20/รอบ</p>
                      </div>
                    </button>

                    {/* Coming Soon Badge - Premium style */}
                    <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 px-2.5 py-1 bg-gradient-to-r from-slate-600 to-slate-700 dark:from-slate-500 dark:to-slate-600 text-white text-[9px] font-bold rounded-md shadow-md flex items-center gap-1 whitespace-nowrap">
                      <span className="text-[10px]">🔗</span>
                      <span>COMING SOON</span>
                    </div>
                  </div>
                  <button
                    onClick={() => setPostingMode('group')}
                    className={cn(
                      'p-3 rounded-lg border-2 transition-all text-center',
                      postingMode === 'group'
                        ? 'border-accent bg-accent/10'
                        : 'border-border hover:border-accent/50'
                    )}
                  >
                    <span className="text-lg">👥</span>
                    <p className="text-xs mt-1 font-medium">Group Post</p>
                    <p className="text-[10px] text-muted-foreground">โพสต์ทีละกลุ่ม</p>
                  </button>
                </div>
                {postingMode === 'marketplace' && selectedGroups.length > 20 && (
                  <p className="text-xs text-blue-600 dark:text-blue-400">
                    📦 {selectedGroups.length} กลุ่ม → {Math.ceil(selectedGroups.length / 20)} batches (20 กลุ่ม/รอบ)
                  </p>
                )}
              </div>

              {/* Delay Setting */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Clock className="w-5 h-5 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm font-medium">{t.automation.delay}</p>
                  <p className="text-xs text-muted-foreground">
                    ระหว่าง batch (+ สุ่ม 2-5 วินาที)
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={5}
                    max={120}
                    value={delayBetweenPosts}
                    onChange={(e) => setDelayBetweenPosts(Number(e.target.value))}
                    className="w-16 h-8 text-center"
                  />
                  <span className="text-sm text-muted-foreground">วินาที</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2">
                {automation.isRunning ? (
                  <Button
                    className="w-full h-12 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-lg"
                    size="lg"
                    onClick={stopAutomation}
                  >
                    <Square className="w-5 h-5 mr-2" />
                    {t.automation.stopAutomation}
                  </Button>
                ) : (
                  <Button
                    className="w-full h-12 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-lg disabled:opacity-50"
                    size="lg"
                    onClick={() => setShowConfirmDialog(true)}
                    disabled={!isConnected || !selectedProperty || selectedGroups.length === 0}
                  >
                    <Play className="w-5 h-5 mr-2" />
                    {t.automation.startAutomation} ({selectedGroups.length} {t.automation.groups})
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Task Progress — handled by floating TaskProgressPopup at bottom-right */}

          {/* Scheduled Posts — shows only when there are schedules */}
          <ScheduledPostsCard />

          {/* Daily Usage Card */}
          <DailyUsageCard userPackage={userPackage} />

          {/* Health Check Card */}
          <HealthCheckCard result={healthResult} />
        </div>
      </div>

      {/* Add Group Dialog — supports single + bulk mode */}
      <BulkAddGroupDialog
        open={isAddGroupOpen}
        onOpenChange={setIsAddGroupOpen}
        existingGroupUrls={groups.map(g => g.url)}
        onAddGroups={(newGroups) => {
          newGroups.forEach(g => {
            addGroup({
              name: g.name,
              url: g.url,
              memberCount: g.memberCount,
            });
          });
        }}
      />

      {/* Floating Task Progress Popup */}
      <TaskProgressPopup
        isRunning={automation.isRunning}
        isPaused={automation.isPaused}
        tasks={automation.tasks}
        totalSteps={automation.totalSteps}
        completedTasks={completedTasks}
        failedTasks={failedTasks}
        progressPercent={progressPercent}
        generatedCaptions={generatedCaptions}
        onStop={stopAutomation}
        onPause={pauseAutomation}
        onDismiss={() => {
          setAutomation({ isRunning: false, isPaused: false, currentStep: 0, totalSteps: 0, tasks: [] });
          setGeneratedCaptions([]);
        }}
      />

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-accent" />
              {t.automationConfirm.title}
            </DialogTitle>
            <DialogDescription>{t.automationConfirm.desc}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {(() => {
              const n = selectedGroups.length;
              const isMarketplace = postingMode === 'marketplace';

              // Marketplace: fixed 20/batch | Group: dynamic batch
              let bMin: number, bMax: number;
              if (isMarketplace) {
                bMin = 20; bMax = 20;
              } else {
                if (n <= 10) { bMin = 1; bMax = 4; }
                else if (n <= 30) { bMin = 3; bMax = 6; }
                else if (n <= 50) { bMin = 4; bMax = 7; }
                else { bMin = 6; bMax = 10; }
              }

              const avgBatch = isMarketplace ? 20 : (bMin + bMax) / 2;
              const estBatches = Math.ceil(n / avgBatch);

              // Realistic time calc per mode:
              let totalSeconds: number;
              if (isMarketplace) {
                // Marketplace: ~90s fill form + scroll-tick + publish per batch
                const perBatchTime = 90;
                const betweenBatchDelay = delayBetweenPosts + 3.5;
                totalSeconds = estBatches * perBatchTime + Math.max(0, estBatches - 1) * betweenBatchDelay;
              } else {
                // Group Post: sliding-window parallel (2-3 tabs) — ~15s effective per group + batch delay
                const concurrency = 2.5; // avg 2-3 tabs
                const perGroupTime = 18; // ~18s per group with parallel overlap
                const betweenBatchDelay = delayBetweenPosts + 3.5;
                totalSeconds = Math.ceil(n / concurrency) * perGroupTime + Math.max(0, estBatches - 1) * betweenBatchDelay;
              }
              const estMinutes = Math.ceil(totalSeconds / 60);

              return (
                <>
                  {/* Property */}
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{t.automationConfirm.property}</span>
                    </div>
                    <span className="text-sm truncate max-w-[200px] font-medium">{selectedProperty?.title}</span>
                  </div>

                  {/* Groups */}
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{t.automationConfirm.groups}</span>
                    </div>
                    <Badge variant="secondary">{n} {t.automationConfirm.groupCount}</Badge>
                  </div>

                  {/* Mode */}
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{t.automationConfirm.mode}</span>
                    </div>
                    <Badge variant="outline">
                      {isMarketplace ? '🏪 Marketplace' : '👥 Group Post'}
                    </Badge>
                  </div>

                  {/* Batch Size — different display per mode */}
                  <div className="flex items-center justify-between p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-blue-500" />
                      <span className="text-sm font-medium">{t.automationConfirm.batchSize}</span>
                    </div>
                    <div className="text-right">
                      {isMarketplace ? (
                        <>
                          <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                            20 {t.automationConfirm.groupsPerBatch}
                          </span>
                          <p className="text-[10px] text-muted-foreground">
                            {estBatches} {t.automationConfirm.batches} ({n > 20 ? `20+${n - 20 * (estBatches - 1)}` : n})
                          </p>
                        </>
                      ) : (
                        <>
                          <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                            {t.automationConfirm.batchSizeRange} {bMin}-{bMax} {t.automationConfirm.groupsPerBatch}
                          </span>
                          <p className="text-[10px] text-muted-foreground">
                            ~{estBatches} {t.automationConfirm.batches}
                          </p>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Images */}
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2">
                      <ImageIcon className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{t.automationConfirm.images}</span>
                    </div>
                    <span className="text-sm">{selectedProperty?.images?.length || 0} {t.automationConfirm.imageCount}</span>
                  </div>

                  {/* Delay */}
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{t.automationConfirm.delay}</span>
                    </div>
                    <span className="text-sm">{delayBetweenPosts} {t.automationConfirm.seconds} <span className="text-muted-foreground">(+2-5s)</span></span>
                  </div>

                  {/* Estimated Time */}
                  <div className="flex items-center justify-between p-3 rounded-lg bg-accent/10 border border-accent/20">
                    <span className="text-sm font-medium">{t.automationConfirm.estimatedTime}</span>
                    <span className="text-sm font-bold text-accent">
                      ~{estMinutes}-{estMinutes + 2} {t.automationConfirm.minutes}
                    </span>
                  </div>

                  {/* Warning */}
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800">
                    <AlertCircle className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-orange-700 dark:text-orange-400">{t.automationConfirm.warning}</p>
                  </div>
                </>
              );
            })()}
          </div>

          {/* Schedule Option (Agent/Elite only) */}
          {getPackageLimits(userPackage).scheduledPosting && (
            <div className="pt-2 border-t">
              <div className="flex items-center gap-2 mb-2">
                <Checkbox
                  id="schedule-toggle"
                  checked={scheduleMode}
                  onCheckedChange={(v) => setScheduleMode(!!v)}
                />
                <Label htmlFor="schedule-toggle" className="text-sm cursor-pointer flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  {language === 'en' ? 'Schedule for later' : 'ตั้งเวลาโพสต์'}
                </Label>
              </div>
              {scheduleMode && (() => {
                // Build date/time picker with locale-aware labels
                const isEn = language === 'en';
                const now = new Date();
                const minDate = now.toISOString().split('T')[0];
                const dateVal = scheduleDateTime ? scheduleDateTime.split('T')[0] : '';
                const timeVal = scheduleDateTime ? scheduleDateTime.split('T')[1]?.slice(0, 5) : '';

                const setDatePart = (date: string) => {
                  const t = timeVal || `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
                  setScheduleDateTime(`${date}T${t}`);
                };
                const setTimePart = (time: string) => {
                  const d = dateVal || minDate;
                  setScheduleDateTime(`${d}T${time}`);
                };

                // Format display
                const displayDate = dateVal
                  ? new Date(dateVal + 'T00:00').toLocaleDateString(isEn ? 'en-US' : 'th-TH', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
                  : '';

                return (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] text-muted-foreground font-medium mb-1 block">
                          {isEn ? '📅 Date' : '📅 วันที่'}
                        </label>
                        <Input
                          type="date"
                          value={dateVal}
                          onChange={(e) => setDatePart(e.target.value)}
                          min={minDate}
                          className="text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-muted-foreground font-medium mb-1 block">
                          {isEn ? '⏰ Time' : '⏰ เวลา'}
                        </label>
                        <Input
                          type="time"
                          value={timeVal}
                          onChange={(e) => setTimePart(e.target.value)}
                          className="text-sm"
                        />
                      </div>
                    </div>
                    {displayDate && timeVal && (
                      <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-1.5">
                        {isEn ? 'Scheduled:' : 'กำหนดเวลา:'}{' '}
                        <span className="font-medium text-foreground">{displayDate} {isEn ? 'at' : 'เวลา'} {timeVal} {isEn ? '' : 'น.'}</span>
                      </p>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => { setShowConfirmDialog(false); setScheduleMode(false); }}>
              {t.automationConfirm.cancel}
            </Button>
            {scheduleMode ? (
              <Button
                className="flex-1 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white"
                disabled={!scheduleDateTime}
                onClick={async () => {
                  try {
                    const selectedGroupObjects = groups.filter(g => selectedGroups.includes(g.id));
                    const res = await apiFetch('/api/schedules', {
                      method: 'POST',
                      body: JSON.stringify({
                        scheduledAt: new Date(scheduleDateTime).toISOString(),
                        mode: postingMode,
                        property: selectedProperty,
                        groups: selectedGroupObjects,
                        images: selectedProperty?.images || [],
                        delaySeconds: delayBetweenPosts,
                        userPackage,
                        browser: selectedBrowser,
                      }),
                    });
                    const data = await res.json();
                    if (data.success) {
                      toast.success(language === 'en' ? 'Post scheduled!' : 'ตั้งเวลาโพสต์สำเร็จ!', {
                        description: new Date(scheduleDateTime).toLocaleString('th-TH'),
                      });
                    } else {
                      toast.error(data.error || 'Failed to schedule');
                    }
                  } catch (err: any) {
                    toast.error(err.message || 'Schedule failed');
                  }
                  setShowConfirmDialog(false);
                  setScheduleMode(false);
                  setScheduleDateTime('');
                }}
              >
                <Clock className="w-4 h-4 mr-2" />
                {language === 'en' ? 'Schedule' : 'ตั้งเวลา'}
              </Button>
            ) : (
              <Button
                className="flex-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
                onClick={() => {
                  setShowConfirmDialog(false);
                  startAutomation();
                }}
              >
                <Play className="w-4 h-4 mr-2" />
                {t.automationConfirm.confirm}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
