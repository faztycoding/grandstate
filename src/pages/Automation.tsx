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
  Shield,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Eye,
  Timer,
  Fingerprint,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/i18n/LanguageContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useFacebookConnection } from '@/hooks/useFacebookConnection';
import { getUserPackage, getPackageLimits } from '@/hooks/usePackageLimits';
import { useHealthCheck, type RiskFactor } from '@/hooks/useHealthCheck';
import { useNotifications } from '@/hooks/useNotifications';
import { SecurityCenter } from '@/components/automation/SecurityCenter';
import { BulkAddGroupDialog } from '@/components/automation/BulkAddGroupDialog';
import { useGlobalAutomation } from '@/components/layout/DashboardLayout';
import { DailyUsageCard } from '@/components/automation/DailyUsageCard';
import { WorkerSlotsGrid } from '@/components/automation/WorkerSlotsGrid';
import { ScheduledPostsCard } from '@/components/automation/ScheduledPostsCard';
import { apiFetch } from '@/lib/config';

interface TaskStatus {
  id: string;
  groupId: string;
  groupName: string;
  groupUrl?: string;
  status: 'pending' | 'in_progress' | 'pending_approval' | 'completed' | 'failed';
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

interface LogEntry {
  time: number;
  msg: string;
  level: 'info' | 'success' | 'error' | 'warn' | 'start';
}

type AutomationMode = 'group' | 'marketplace';

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

// Caption styles will be set dynamically in component using translations

export default function Automation() {
  const navigate = useNavigate();
  const location = useLocation();
  const { properties } = useSupabaseProperties();
  const { groups, activeGroups, addGroup, deleteGroup, toggleGroupActive } = useSupabaseGroups();
  const { isConnected, isChecking, user, sessions: fbSessions, connectedCount: fbConnectedCount, activeSlot } = useFacebookConnection();
  const { t, language } = useLanguage();
  const globalAutomation = useGlobalAutomation();

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
    return (localStorage.getItem('userPackage') as 'free' | 'agent' | 'elite') || 'free';
  });
  const [postingMode, setPostingMode] = useState<'group' | 'marketplace'>('marketplace'); // Default to marketplace
  const [selectedFbSlot, setSelectedFbSlot] = useState<number>(activeSlot);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [scheduleMode, setScheduleMode] = useState(false);
  const [scheduleDateTime, setScheduleDateTime] = useState('');
  // showGuide removed — SecurityCenter manages its own state

  // Automation state
  const [automation, setAutomation] = useState<AutomationState>({
    isRunning: false,
    isPaused: false,
    currentStep: 0,
    totalSteps: 0,
    tasks: [],
  });

  // Live log buffer from backend
  const [automationLogs, setAutomationLogs] = useState<LogEntry[]>([]);
  const [automationStartTime, setAutomationStartTime] = useState<number | null>(null);
  const [automationEndTime, setAutomationEndTime] = useState<number | null>(null);

  // Queue state
  const [queuePosition, setQueuePosition] = useState<number | null>(null);
  const [queueEstimate, setQueueEstimate] = useState<number>(0);
  const [queueRunningJobs, setQueueRunningJobs] = useState<Array<{ displayName: string; groupCount: number; runningSec: number; automationType: string }> | null>(null);
  const queuePollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Notification hook — for risk-level alerts
  const { addNotification } = useNotifications();

  // Risk escalation callback → push notification to bell
  const handleRiskEscalation = useCallback((level: 'moderate' | 'high' | 'critical', score: number, factors: RiskFactor[]) => {
    const topFactors = factors.filter(f => f.score > 40).sort((a, b) => b.weightedScore - a.weightedScore).slice(0, 2);
    const factorNames = topFactors.map(f => f.id).join(', ');

    if (level === 'moderate') {
      addNotification({
        type: 'warning',
        category: 'warning',
        title: '⚠️ แจ้งเตือนความเสี่ยง',
        message: `คะแนนความเสี่ยง ${score}/100 — ระดับปานกลาง | ปัจจัย: ${factorNames || 'พฤติกรรมโพสต์'} — แนะนำลดความถี่หรือเพิ่ม Delay`,
      });
    } else if (level === 'high') {
      addNotification({
        type: 'warning',
        category: 'risk',
        title: '🟠 ระดับเสี่ยงสูง',
        message: `คะแนนความเสี่ยง ${score}/100 — ระดับเสี่ยงสูง | ปัจจัย: ${factorNames || 'กิจกรรมผิดปกติ'} — ควรหยุดพักบัญชีชั่วคราว`,
      });
    } else if (level === 'critical') {
      addNotification({
        type: 'error',
        category: 'danger',
        title: '🔴 อันตราย — เสี่ยงถูกแบน',
        message: `คะแนนความเสี่ยง ${score}/100 — ระดับวิกฤต | ปัจจัย: ${factorNames || 'พฤติกรรมซ้ำซ้อน'} — หยุดการใช้งานทันทีเพื่อป้องกันบัญชี`,
      });
    }
  }, [addNotification]);

  // Health Check — fetches real data from backend postingTracker
  const { result: healthResult, clearHistory, refetch: refetchHealth } = useHealthCheck(handleRiskEscalation);

  // ONE-TIME RESET: Clear post history + health check to new-user state
  useEffect(() => {
    const resetDone = localStorage.getItem('_stats_reset_v1');
    if (!resetDone) {
      clearHistory();
      localStorage.setItem('_stats_reset_v1', '1');
      // Stats reset to new-user state
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

  const handleAddGroup = async () => {
    if (!newGroupName.trim()) {
      toast.error(t.automation.fillGroupName);
      return;
    }
    if (!newGroupUrl.trim()) {
      toast.error(t.automation.fillGroupUrl);
      return;
    }

    try {
      await addGroup({
        name: newGroupName,
        url: newGroupUrl,
        memberCount: 0,
      });
      toast.success(t.automation.groupAdded);
      setNewGroupName('');
      setNewGroupUrl('');
      setIsAddGroupOpen(false);
    } catch (err) {
      const message = getErrorMessage(err, '');
      toast.error(message ? `เพิ่มกลุ่มไม่สำเร็จ: ${message}` : 'เพิ่มกลุ่มไม่สำเร็จ');
    }
  };

  const handleDeleteGroup = async (groupId: string, groupName: string) => {
    try {
      await deleteGroup(groupId);
      setSelectedGroups(prev => prev.filter(id => id !== groupId));
      toast.success(`${t.automation.groupDeleted}: "${groupName}"`);
    } catch {
      toast.error('ลบกลุ่มไม่สำเร็จ');
    }
  };

  // Get daily post limit based on package (from centralized config)
  const getDailyPostLimit = (pkg: string): number => {
    return getPackageLimits(pkg).postsPerDay;
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
    setGeneratedCaptions([]);
    setAutomationLogs([]);
    setAutomationStartTime(Date.now());
    setAutomationEndTime(null);

    toast.info(t.automation.automationStarting, {
      description: `${t.automation.postingTo} ${selectedGroups.length} ${t.automation.groups}`,
    });

    // Request notification permission so we can alert when done (even if tab is background)
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission();
    }

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
          fbSlot: selectedFbSlot,
        }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
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

      // Handle QUEUED response — user must wait in line
      if (result.queued) {
        setQueuePosition(result.position);
        setQueueEstimate(result.estimatedWaitSec || 0);
        toast.info(`📋 คิวที่ ${result.position}`, {
          description: `รอประมาณ ${Math.ceil((result.estimatedWaitSec || 300) / 60)} นาที — ระบบจะเริ่มอัตโนมัติเมื่อถึงคิว`,
          duration: 6000,
        });
        // Request browser notification permission for queue alerts
        if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
          Notification.requestPermission();
        }
        // Keep running state true so UI shows "waiting"
        setAutomation(prev => ({
          ...prev,
          isRunning: true,
          totalSteps: groupsData.length,
          tasks: groupsData.map((g, i) => ({
            id: `task-${i}`,
            groupId: g.id,
            groupName: g.name,
            groupUrl: g.url,
            status: 'pending' as const,
          })),
        }));
        setAutomationStartTime(Date.now());
        // Notify global monitor about queue
        globalAutomation?.notifyQueued(postingMode, result.position, result.estimatedWaitSec || 0);
        // Poll queue status until it's our turn
        startQueuePolling(postingMode);
        return;
      }

      // Started immediately — no queue
      setQueuePosition(null);

      // Store startup status metadata so popup is accurate immediately
      setAutomation(prev => ({
        ...prev,
        isRunning: result.isRunning ?? true,
        isPaused: result.isPaused ?? false,
        currentStep: result.currentStep ?? prev.currentStep,
        totalSteps: result.totalSteps ?? prev.totalSteps,
        tasks: result.tasks ?? prev.tasks,
      }));
      setAutomationLogs(Array.isArray(result.logs) ? result.logs : []);
      setAutomationStartTime(typeof result.startTime === 'number' ? result.startTime : Date.now());
      setAutomationEndTime(typeof result.endTime === 'number' ? result.endTime : null);

      // Notify global monitor → persistent popup across all pages
      globalAutomation?.notifyStarted(postingMode, {
        totalSteps: result.totalSteps ?? groupsData.length,
        tasks: result.tasks ?? [],
        logs: Array.isArray(result.logs) ? result.logs : [],
        startTime: typeof result.startTime === 'number' ? result.startTime : Date.now(),
        generatedCaptions: result.generatedCaptions || [],
      });

      // Start polling for status updates
      pollAutomationStatus(postingMode);
    } catch (error) {
      toast.error(t.automation.automationError, {
        description: getErrorMessage(error, t.automation.checkBackend),
      });
      // Auto reset UI state
      setAutomation({ isRunning: false, isPaused: false, currentStep: 0, totalSteps: 0, tasks: [] });
      setAutomationLogs([]);
      setAutomationStartTime(null);
      setAutomationEndTime(null);
    }
  };

  // Queue polling — polls queue status until it's user's turn, then switches to automation polling
  const startQueuePolling = useCallback((mode: AutomationMode) => {
    if (queuePollingRef.current) clearInterval(queuePollingRef.current);

    queuePollingRef.current = setInterval(async () => {
      try {
        const res = await apiFetch('/api/group-automation/queue-status');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        if (data.success) {
          // Handle backend notification (queue_ready / queue_timeout)
          if (data.notification) {
            const notif = data.notification;
            if (notif.type === 'queue_ready') {
              toast.success(notif.message, { duration: 5000 });
              // Browser push notification (if permission granted)
              if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
                new Notification('HomePost Pro', { body: notif.message, icon: '/favicon.ico' });
              }
            } else if (notif.type === 'queue_timeout') {
              toast.error(notif.message, { duration: 6000 });
              if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
                new Notification('HomePost Pro', { body: notif.message, icon: '/favicon.ico' });
              }
            }
          }

          if (data.status === 'running' || data.isRunning) {
            // Our turn! Stop queue polling, start automation polling
            setQueuePosition(null);
            setQueueRunningJobs(null);
            if (queuePollingRef.current) clearInterval(queuePollingRef.current);
            queuePollingRef.current = null;
            if (!data.notification?.type) {
              toast.success('🚀 ถึงคิวคุณแล้ว! กำลังเริ่ม Automation...', { duration: 3000 });
            }
            pollAutomationStatus(mode);
          } else if (data.status === 'queued') {
            setQueuePosition(data.position);
            setQueueEstimate(data.estimatedWaitSec || 0);
            // Store running jobs info for queue display
            if (data.runningJobs) setQueueRunningJobs(data.runningJobs);
          } else if (data.status === 'idle') {
            // No longer in queue and not running — was cancelled or timed out
            setQueuePosition(null);
            setQueueRunningJobs(null);
            if (queuePollingRef.current) clearInterval(queuePollingRef.current);
            queuePollingRef.current = null;
            setAutomation(prev => ({ ...prev, isRunning: false }));
          }
        }
      } catch { /* silent */ }
    }, 2000);
  }, []);

  // Cleanup queue polling on unmount
  useEffect(() => {
    return () => {
      if (queuePollingRef.current) clearInterval(queuePollingRef.current);
    };
  }, []);

  // Polling interval ref — prevents stacking intervals
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const getAutomationStatusPath = (mode: AutomationMode) => (
    mode === 'marketplace'
      ? '/api/marketplace-automation/status'
      : '/api/group-automation/status'
  );

  // Poll automation status
  const pollAutomationStatus = useCallback((modeOverride?: AutomationMode) => {
    // Clear any existing interval first
    if (pollingRef.current) clearInterval(pollingRef.current);

    const modeToPoll = modeOverride || postingMode;
    const statusPath = getAutomationStatusPath(modeToPoll);

    pollingRef.current = setInterval(async () => {
      try {
        const response = await apiFetch(statusPath);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
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

          // Capture logs + timing metadata from backend
          setAutomationLogs(Array.isArray(data.logs) ? data.logs : []);
          setAutomationStartTime(typeof data.startTime === 'number' ? data.startTime : null);
          setAutomationEndTime(typeof data.endTime === 'number' ? data.endTime : null);
          if (Array.isArray(data.generatedCaptions) && data.generatedCaptions.length > 0) {
            setGeneratedCaptions(data.generatedCaptions);
          }

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
            const pendingApproval = data.tasks?.filter((t: TaskStatus) => t.status === 'pending_approval').length || 0;
            const failed = data.tasks?.filter((t: TaskStatus) => t.status === 'failed').length || 0;
            const posted = completed + pendingApproval;

            // Refetch health check after task updates (backend records posts directly)
            if (data.tasks?.some((t: TaskStatus) => t.status === 'completed' || t.status === 'pending_approval' || t.status === 'failed')) {
              refetchHealth();
            }

            if (posted > 0 || failed > 0) {
              const summaryParts = [`${t.automation.successCount} ${posted} ${t.automation.groups}`];
              if (pendingApproval > 0) {
                summaryParts.push(`รออนุมัติ ${pendingApproval} ${t.automation.groups}`);
              }
              if (failed > 0) {
                summaryParts.push(`${t.automation.failedCount} ${failed} ${t.automation.groups}`);
              }
              const summaryText = summaryParts.join(', ');

              toast.success(t.automation.automationDone, {
                description: summaryText,
              });

              // Browser push notification (works even if tab is in background)
              if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
                new Notification('GrandState — โพสต์เสร็จแล้ว!', {
                  body: summaryText,
                  icon: '/favicon.ico',
                });
              }
            }
          }
        }
      } catch (error) {
        // Silently fail - backend might not be running
      }
    }, 1000);
  }, [postingMode, refetchHealth, t]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  // ── AUTO-RECONNECT: Check automation status on page load ──
  // If backend is still running (user closed tab / navigated away), restore UI
  useEffect(() => {
    const checkExistingAutomation = async () => {
      try {
        // Try both modes
        for (const mode of ['group', 'marketplace'] as const) {
          const response = await apiFetch(getAutomationStatusPath(mode));
          if (!response.ok) continue;
          const data = await response.json();
          if (data.success && data.isRunning) {
            // Reconnecting to running automation
            setPostingMode(mode);
            setAutomation({
              isRunning: true,
              isPaused: data.isPaused ?? false,
              currentStep: data.currentStep || 0,
              totalSteps: data.totalSteps || 0,
              tasks: data.tasks || [],
            });
            setAutomationLogs(Array.isArray(data.logs) ? data.logs : []);
            setAutomationStartTime(typeof data.startTime === 'number' ? data.startTime : null);
            setAutomationEndTime(typeof data.endTime === 'number' ? data.endTime : null);
            if (Array.isArray(data.generatedCaptions) && data.generatedCaptions.length > 0) {
              setGeneratedCaptions(data.generatedCaptions);
            }
            // Start polling for the detected mode (avoid stale postingMode closure)
            pollAutomationStatus(mode);
            return; // found running automation, stop checking
          }
          // Also check if automation just finished (has tasks but not running)
          if (data.success && !data.isRunning && data.tasks && data.tasks.length > 0) {
            const hasResults = data.tasks.some((t: TaskStatus) => t.status === 'completed' || t.status === 'pending_approval' || t.status === 'failed');
            if (hasResults) {
              // Found completed automation results
              setPostingMode(mode);
              setAutomation({
                isRunning: false,
                isPaused: false,
                currentStep: data.currentStep || 0,
                totalSteps: data.totalSteps || 0,
                tasks: data.tasks,
              });
              setAutomationLogs(Array.isArray(data.logs) ? data.logs : []);
              setAutomationStartTime(typeof data.startTime === 'number' ? data.startTime : null);
              setAutomationEndTime(typeof data.endTime === 'number' ? data.endTime : null);
              if (Array.isArray(data.generatedCaptions) && data.generatedCaptions.length > 0) {
                setGeneratedCaptions(data.generatedCaptions);
              }
              return;
            }
          }
        }
      } catch (err) {
        // Backend not available — silently ignore
      }
    };
    checkExistingAutomation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Stop Automation
  const stopAutomation = async () => {
    // Clear polling immediately
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    // Clear queue polling too
    if (queuePollingRef.current) {
      clearInterval(queuePollingRef.current);
      queuePollingRef.current = null;
    }
    setQueuePosition(null);

    const stopPath = postingMode === 'marketplace'
      ? '/api/marketplace-automation/stop'
      : '/api/group-automation/stop';

    const statusPath = getAutomationStatusPath(postingMode);
    try {
      await apiFetch(stopPath, { method: 'POST' });

      // Sync final state (tasks/logs/endTime) after stop
      const statusResponse = await apiFetch(statusPath);
      const statusData = statusResponse.ok ? await statusResponse.json() : null;
      if (statusData?.success) {
        setAutomation(prev => ({
          ...prev,
          isRunning: false,
          isPaused: false,
          currentStep: statusData.currentStep ?? prev.currentStep,
          totalSteps: statusData.totalSteps ?? prev.totalSteps,
          tasks: statusData.tasks || prev.tasks,
        }));
        setAutomationLogs(Array.isArray(statusData.logs) ? statusData.logs : []);
        setAutomationStartTime(typeof statusData.startTime === 'number' ? statusData.startTime : null);
        setAutomationEndTime(typeof statusData.endTime === 'number' ? statusData.endTime : Date.now());
      } else {
        setAutomation(prev => ({ ...prev, isRunning: false, isPaused: false }));
        setAutomationEndTime(Date.now());
      }

      toast.info(t.automation.automationStopped);
    } catch (error) {
      setAutomation(prev => ({ ...prev, isRunning: false, isPaused: false }));
      setAutomationEndTime(Date.now());
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
  const pendingApprovalTasks = automation.tasks.filter(t => t.status === 'pending_approval').length;
  const failedTasks = automation.tasks.filter(t => t.status === 'failed').length;
  const resolvedTasks = completedTasks + pendingApprovalTasks + failedTasks;
  const progressPercent = automation.totalSteps > 0
    ? Math.round((resolvedTasks / automation.totalSteps) * 100)
    : 0;

  return (
    <DashboardLayout
      title={t.automation.title}
      subtitle={t.automation.subtitle}
    >
      <div className="grid grid-cols-12 gap-4 lg:gap-5">
        {/* ═══ LEFT WING: Raw Material Intake ═══ */}
        <div className="col-span-12 lg:col-span-3 space-y-4">
          {/* Step 1: Property Selection */}
          <Card className="card-elevated card-hover-lift relative overflow-hidden">
            <div className="absolute top-0 left-0 w-24 h-24 bg-gradient-to-br from-blue-500/5 to-transparent rounded-full blur-2xl pointer-events-none" />
            <CardHeader className="relative">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-blue-500/25">1</div>
                    <div className="flex items-center gap-1.5">
                      <Building2 className="w-4 h-4 text-blue-500" />
                      <span>{t.automation.step1}</span>
                    </div>
                  </CardTitle>
                  <CardDescription className="mt-1 ml-12">
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
          <Card className="card-elevated card-hover-lift relative overflow-hidden">
            <div className="absolute top-0 left-0 w-24 h-24 bg-gradient-to-br from-purple-500/5 to-transparent rounded-full blur-2xl pointer-events-none" />
            <CardHeader className="relative">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-fuchsia-500 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-purple-500/25">2</div>
                    <div className="flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-purple-500" />
                      <span>{t.automation.step2}</span>
                    </div>
                  </CardTitle>
                  <CardDescription className="mt-1 ml-12">
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

        {/* ═══ CENTER: The Engine Core ═══ */}
        <div className="col-span-12 lg:col-span-6 space-y-4">
          <Card className="card-elevated relative overflow-hidden border-0 rounded-[2rem]" style={{ background: 'linear-gradient(180deg, hsl(222 47% 7%) 0%, hsl(222 47% 5%) 100%)' }}>
            {/* Blueprint grid overlay */}
            <div className="pointer-events-none absolute inset-0 opacity-[0.04]" style={{
              backgroundImage: 'linear-gradient(rgba(148,163,184,.4) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,.4) 1px, transparent 1px)',
              backgroundSize: '32px 32px',
            }} />
            {/* Radial glow behind core */}
            <div className={cn(
              "pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full blur-[100px] transition-all duration-1000",
              automation.isRunning ? "bg-accent/15" : "bg-slate-500/5"
            )} />
            {/* Floating energy particles */}
            {[...Array(8)].map((_, i) => (
              <motion.div key={`ep-${i}`}
                className={cn("absolute w-1 h-1 rounded-full pointer-events-none", automation.isRunning ? "bg-accent/40" : "bg-slate-600/20")}
                style={{ left: `${12 + i * 11}%`, top: `${15 + (i % 3) * 25}%` }}
                animate={{ y: [0, -15, 0], opacity: automation.isRunning ? [0.3, 0.8, 0.3] : [0.1, 0.2, 0.1] }}
                transition={{ duration: 2.5 + i * 0.3, repeat: Infinity, delay: i * 0.4 }}
              />
            ))}

            <CardContent className="py-8 lg:py-10 flex flex-col items-center justify-center relative min-h-[460px]">

              {/* ═══ REACTOR CORE ═══ */}
              <div className="relative w-56 h-56 lg:w-64 lg:h-64 flex items-center justify-center mb-8">

                {/* Outer orbit ring 1 — slow */}
                <motion.div
                  animate={{ rotate: automation.isRunning ? 360 : 0 }}
                  transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-0"
                >
                  <div className={cn("w-full h-full rounded-full border border-dashed transition-colors duration-500",
                    automation.isRunning ? "border-accent/20" : "border-slate-700/30"
                  )} />
                  {/* Orbit node */}
                  <div className={cn("absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full transition-all duration-500",
                    automation.isRunning ? "bg-accent shadow-[0_0_10px_hsl(var(--accent)/0.6)]" : "bg-slate-700"
                  )} />
                </motion.div>

                {/* Outer orbit ring 2 — counter-rotate */}
                <motion.div
                  animate={{ rotate: automation.isRunning ? -360 : 0 }}
                  transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-4"
                >
                  <div className={cn("w-full h-full rounded-full border transition-colors duration-500",
                    automation.isRunning ? "border-cyan-500/15" : "border-slate-800/20"
                  )} />
                  <div className={cn("absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-2 h-2 rounded-full transition-all duration-500",
                    automation.isRunning ? "bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.5)]" : "bg-slate-700/50"
                  )} />
                </motion.div>

                {/* Gear ring — rotating cog effect */}
                <motion.div
                  animate={{ rotate: automation.isRunning ? 360 : 0 }}
                  transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-8"
                >
                  <Settings className={cn("w-full h-full transition-colors duration-500",
                    automation.isRunning ? "text-accent/[0.07]" : "text-slate-700/[0.04]"
                  )} strokeWidth={0.3} />
                </motion.div>

                {/* Inner gear — counter-rotate */}
                <motion.div
                  animate={{ rotate: automation.isRunning ? -360 : 0 }}
                  transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-14"
                >
                  <Settings className={cn("w-full h-full transition-colors duration-500",
                    automation.isRunning ? "text-purple-500/[0.08]" : "text-slate-700/[0.03]"
                  )} strokeWidth={0.4} />
                </motion.div>

                {/* Scanning line */}
                {automation.isRunning && (
                  <motion.div
                    animate={{ top: ['5%', '95%', '5%'] }}
                    transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                    className="absolute left-[15%] right-[15%] h-px bg-gradient-to-r from-transparent via-accent/40 to-transparent z-10 pointer-events-none shadow-[0_0_8px_hsl(var(--accent)/0.4)]"
                  />
                )}

                {/* ── CENTRAL CORE SPHERE ── */}
                <div className={cn(
                  "relative z-10 w-28 h-28 lg:w-32 lg:h-32 rounded-full flex flex-col items-center justify-center transition-all duration-700",
                  automation.isRunning
                    ? "bg-gradient-to-br from-slate-900 to-slate-800 border-2 border-accent/40 shadow-[0_0_50px_hsl(var(--accent)/0.15),inset_0_0_30px_hsl(var(--accent)/0.05)]"
                    : "bg-gradient-to-br from-slate-900/80 to-slate-800/60 border-2 border-slate-700/50 shadow-lg"
                )}>
                  {/* Pulsing inner glow ring */}
                  <motion.div
                    animate={automation.isRunning ? { scale: [1, 1.15, 1], opacity: [0.3, 0.6, 0.3] } : { scale: 1, opacity: 0 }}
                    transition={{ duration: 2.5, repeat: Infinity }}
                    className="absolute inset-0 rounded-full border-2 border-accent/30 pointer-events-none"
                  />
                  {/* Core icon */}
                  <motion.div
                    animate={automation.isRunning ? { scale: [1, 1.1, 1] } : {}}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <Zap className={cn("w-10 h-10 lg:w-12 lg:h-12 transition-colors duration-500",
                      automation.isRunning ? "text-accent drop-shadow-[0_0_12px_hsl(var(--accent)/0.5)]" : "text-slate-600"
                    )} />
                  </motion.div>
                  <span className={cn(
                    "text-[8px] font-mono uppercase tracking-[0.2em] font-black mt-1 transition-colors duration-500",
                    automation.isRunning ? "text-accent" : "text-slate-600"
                  )}>
                    {automation.isRunning ? 'ACTIVE' : 'STANDBY'}
                  </span>
                </div>

                {/* Energy beams radiating from core (when running) */}
                {automation.isRunning && [...Array(6)].map((_, i) => (
                  <motion.div
                    key={`beam-${i}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0.1, 0.4, 0.1] }}
                    transition={{ duration: 2, repeat: Infinity, delay: i * 0.3 }}
                    className="absolute top-1/2 left-1/2 h-px origin-left pointer-events-none z-0"
                    style={{
                      width: '110px',
                      transform: `translate(-50%, -50%) rotate(${i * 60}deg)`,
                      background: 'linear-gradient(90deg, hsl(var(--accent) / 0.4) 0%, transparent 100%)',
                    }}
                  />
                ))}
              </div>

              {/* ═══ PROGRESS BAR ═══ */}
              <div className="w-full max-w-sm space-y-2.5">
                <div className="flex justify-between items-center">
                  <span className={cn("text-[10px] font-mono uppercase tracking-wider transition-colors",
                    automation.isRunning ? "text-accent/70" : "text-slate-500"
                  )}>
                    {automation.isRunning ? 'Production Progress' : 'System Ready'}
                  </span>
                  {automation.totalSteps > 0 && (
                    <Badge className="text-[10px] font-mono bg-accent/10 text-accent border-accent/20">
                      {resolvedTasks}/{automation.totalSteps}
                    </Badge>
                  )}
                </div>
                {/* Custom progress bar */}
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden relative">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-accent to-amber-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPercent}%` }}
                    transition={{ duration: 0.5 }}
                  />
                  {automation.isRunning && (
                    <motion.div
                      animate={{ x: ['-100%', '400%'] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                      className="absolute top-0 h-full w-1/4 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                    />
                  )}
                </div>
                {automation.isRunning && (
                  <div className="flex justify-between text-[10px]">
                    <span className="text-emerald-400 font-mono">{completedTasks + pendingApprovalTasks} สำเร็จ</span>
                    {failedTasks > 0 && <span className="text-red-400 font-mono">{failedTasks} ล้มเหลว</span>}
                    <span className="text-accent font-mono font-bold">{progressPercent}%</span>
                  </div>
                )}
              </div>

              {/* ═══ ANTI-DETECTION MODULE PANELS ═══ */}
              <div className="w-full max-w-md mt-6 grid grid-cols-3 gap-2.5">
                {[
                  { Icon: Shield, label: 'Anti-Detect', desc: '6-Layer Active', color: 'text-emerald-400', glow: 'shadow-emerald-500/10', borderColor: 'border-emerald-500/20', bgColor: 'bg-emerald-500/5' },
                  { Icon: Fingerprint, label: 'Fingerprint', desc: 'Canvas/WebGL', color: 'text-cyan-400', glow: 'shadow-cyan-500/10', borderColor: 'border-cyan-500/20', bgColor: 'bg-cyan-500/5' },
                  { Icon: Eye, label: 'Gaussian Jitter', desc: `σ=2.5s | ${delayBetweenPosts}s`, color: 'text-amber-400', glow: 'shadow-amber-500/10', borderColor: 'border-amber-500/20', bgColor: 'bg-amber-500/5' },
                ].map((mod, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 * i }}
                    className={cn(
                      "relative flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all duration-500",
                      "bg-slate-900/60 backdrop-blur-sm hover:scale-[1.02]",
                      mod.borderColor, mod.glow
                    )}
                  >
                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", mod.bgColor)}>
                      <mod.Icon className={cn("w-4 h-4", mod.color)} />
                    </div>
                    <p className="text-[10px] font-bold text-slate-300 text-center">{mod.label}</p>
                    <p className="text-[8px] text-slate-500 font-mono text-center">{mod.desc}</p>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Security Center — merged Health Check + Anti-Detection */}
          <SecurityCenter
            result={healthResult}
            delayBetweenPosts={delayBetweenPosts}
            selectedGroupsCount={selectedGroups.length}
          />
        </div>

        {/* ═══ RIGHT WING: Ignition Panel ═══ */}
        <div className="col-span-12 lg:col-span-3 space-y-4">
          {/* Step 3: Start Automation */}
          <Card className="card-elevated card-hover-lift relative overflow-hidden border-accent/40 bg-gradient-to-br from-accent/5 via-orange-500/5 to-rose-500/5">
            {/* Decorative glow */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-accent/10 to-transparent rounded-full blur-2xl pointer-events-none" />
            <CardHeader className="relative">
              <CardTitle className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent to-orange-500 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-accent/25">3</div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-accent" />
                    <span>{t.automation.step4}</span>
                  </div>
                  <p className="text-xs font-normal text-muted-foreground mt-0.5">{t.automation.checklist}</p>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Facebook Session Selector */}
              {!isConnected && !isChecking && fbConnectedCount === 0 && (
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

              {(isConnected || fbConnectedCount > 0) && (
                <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                      <p className="font-medium text-sm text-green-700 dark:text-green-400">{t.automation.connectedAs}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px]">{fbConnectedCount} session{fbConnectedCount > 1 ? 's' : ''}</Badge>
                  </div>
                  {/* Session selector — show connected accounts */}
                  {fbSessions.filter(s => s && s.name).length > 0 && (
                    <div className="flex gap-2 flex-wrap">
                      {fbSessions.map((s, i) => {
                        if (!s || !s.name) return null;
                        const isSelected = selectedFbSlot === i;
                        return (
                          <button key={i} onClick={() => setSelectedFbSlot(i)}
                            className={cn("flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all text-left",
                              isSelected ? "border-green-500 bg-green-100 dark:bg-green-900/30 ring-1 ring-green-500/30" : "border-border hover:border-green-300 bg-background"
                            )}>
                            {s.profilePic ? (
                              <img src={s.profilePic} alt="" className="w-6 h-6 rounded-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center"><span className="text-white text-[10px] font-bold">{s.name?.charAt(0)}</span></div>
                            )}
                            <div className="min-w-0">
                              <p className="text-xs font-medium truncate">{s.name}</p>
                              <p className="text-[10px] text-muted-foreground">Slot {i + 1}</p>
                            </div>
                            {isSelected && <Check className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {/* Fallback if no session metadata yet */}
                  {fbSessions.filter(s => s && s.name).length === 0 && user && (
                    <p className="text-xs text-muted-foreground">{user.name || 'Facebook User'}</p>
                  )}
                </div>
              )}

              {/* Checklist */}
              <div className="p-3 rounded-xl bg-background/60 border border-border/40 space-y-2.5">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1">เช็คลิสต์</p>
                <div className="flex items-center gap-3 p-2.5 rounded-lg transition-colors hover:bg-muted/30">
                  <div className={cn(
                    "w-7 h-7 rounded-lg flex items-center justify-center transition-all",
                    selectedProperty
                      ? "bg-gradient-to-br from-emerald-500 to-green-500 text-white shadow-sm shadow-emerald-500/25"
                      : "bg-muted text-muted-foreground"
                  )}>
                    {selectedProperty ? <Check className="w-3.5 h-3.5" /> : <span className="text-[10px] font-bold">1</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-sm font-medium truncate", !selectedProperty && "text-muted-foreground")}>
                      {selectedProperty ? selectedProperty.title : t.automation.selectProperty}
                    </p>
                    {selectedProperty && (
                      <p className="text-[10px] text-muted-foreground">
                        {selectedProperty.images?.length || 0} {t.properties.images}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 p-2.5 rounded-lg transition-colors hover:bg-muted/30">
                  <div className={cn(
                    "w-7 h-7 rounded-lg flex items-center justify-center transition-all",
                    selectedGroups.length > 0
                      ? "bg-gradient-to-br from-emerald-500 to-green-500 text-white shadow-sm shadow-emerald-500/25"
                      : "bg-muted text-muted-foreground"
                  )}>
                    {selectedGroups.length > 0 ? <Check className="w-3.5 h-3.5" /> : <span className="text-[10px] font-bold">2</span>}
                  </div>
                  <div className="flex-1">
                    <p className={cn("text-sm font-medium", selectedGroups.length === 0 && "text-muted-foreground")}>
                      {selectedGroups.length > 0 ? `${selectedGroups.length} ${t.automation.groupsSelected}` : t.automation.selectGroups}
                    </p>
                  </div>
                </div>
              </div>

              {/* Posting Mode Toggle */}
              <div className="p-3 rounded-xl bg-gradient-to-r from-muted/60 to-muted/30 border border-border/50 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center flex-shrink-0">
                    <Globe className="w-4 h-4 text-violet-500" />
                  </div>
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
                      <span>UNDER DEVELOPMENT</span>
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
              <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-muted/60 to-muted/30 border border-border/50">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                    <Timer className="w-4 h-4 text-blue-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{t.automation.delay}</p>
                    <p className="text-[10px] text-muted-foreground">
                      ระหว่าง batch (+ สุ่ม 2-5 วินาที)
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Input
                    type="number"
                    min={5}
                    max={120}
                    value={delayBetweenPosts}
                    onChange={(e) => setDelayBetweenPosts(Number(e.target.value))}
                    className="w-16 h-8 text-center text-sm font-mono font-semibold"
                  />
                  <span className="text-xs text-muted-foreground">วินาที</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-1">
                {automation.isRunning ? (
                  <Button
                    className="w-full h-11 sm:h-12 text-sm sm:text-base bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white shadow-lg shadow-red-500/20 transition-all duration-300"
                    size="lg"
                    onClick={stopAutomation}
                  >
                    <Square className="w-5 h-5 mr-2" />
                    {t.automation.stopAutomation}
                  </Button>
                ) : (
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Button
                      className="w-full h-11 sm:h-12 text-sm sm:text-base bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 hover:from-amber-600 hover:via-orange-600 hover:to-rose-600 text-white shadow-lg shadow-orange-500/25 disabled:opacity-50 disabled:shadow-none btn-shine relative overflow-hidden"
                      size="lg"
                      onClick={() => setShowConfirmDialog(true)}
                      disabled={!isConnected || !selectedProperty || selectedGroups.length === 0}
                    >
                      <Play className="w-4 h-4 sm:w-5 sm:h-5 mr-1.5 sm:mr-2" />
                      {t.automation.startAutomation} ({selectedGroups.length} {t.automation.groups})
                    </Button>
                  </motion.div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Queue Status Banner — shown inline when user is waiting in queue */}
          {queuePosition && queuePosition > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-yellow-500/5 p-4"
            >
              {/* Facebook User Info */}
              {(fbSessions[selectedFbSlot]?.name || user) && (
                <div className="flex items-center gap-3 mb-3 p-2 rounded-lg bg-card/40 border border-border/50">
                  {(fbSessions[selectedFbSlot]?.profilePic || user?.profilePic) ? (
                    <img 
                      src={fbSessions[selectedFbSlot]?.profilePic || user?.profilePic} 
                      alt={fbSessions[selectedFbSlot]?.name || user?.name} 
                      className="w-8 h-8 rounded-full object-cover border border-background"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-bold text-sm">
                      {(fbSessions[selectedFbSlot]?.name || user?.name)?.charAt(0)?.toUpperCase() || 'F'}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{fbSessions[selectedFbSlot]?.name || user?.name || 'Facebook User'}</p>
                    <p className="text-xs text-muted-foreground">กำลังรอคิว...</p>
                  </div>
                  <div className="flex-shrink-0">
                    <div className="w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center">
                      <span className="text-[10px] font-bold text-white">{queuePosition}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 mb-3">
                <div className="relative flex-shrink-0">
                  <div className="w-10 h-10 rounded-full bg-amber-500/20 border-2 border-amber-500/40 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-amber-500 animate-pulse" />
                  </div>
                  <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center">
                    {queuePosition}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-amber-600 dark:text-amber-400">
                    📋 รอในคิว — ลำดับที่ #{queuePosition}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    ระบบจะเริ่ม Automation อัตโนมัติเมื่อถึงคิวของคุณ ไม่ต้องรอหน้านี้
                  </p>
                </div>
                <div className="flex-shrink-0 text-right">
                  <p className="text-[10px] text-muted-foreground">รอประมาณ</p>
                  <p className="text-lg font-bold font-mono text-amber-500">
                    {queueEstimate > 0
                      ? queueEstimate >= 60
                        ? `~${Math.ceil(queueEstimate / 60)} นาที`
                        : `~${queueEstimate} วิ`
                      : 'เกือบถึงแล้ว'}
                  </p>
                </div>
              </div>
              {/* Queue position progress bar */}
              <div className="flex items-center gap-1.5">
                {Array.from({ length: Math.min(Math.max(queuePosition + 2, 5), 10) }).map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      'h-1.5 flex-1 rounded-full transition-all duration-300',
                      i < queuePosition - 1
                        ? 'bg-muted/30'
                        : i === queuePosition - 1
                          ? 'bg-amber-500 animate-pulse'
                          : 'bg-muted/15'
                    )}
                  />
                ))}
                <span className="text-[10px] text-muted-foreground ml-1 flex-shrink-0">#{queuePosition}</span>
              </div>
            </motion.div>
          )}

        </div>

        {/* ═══ BOTTOM: Worker Nodes (full width) ═══ */}
        <div className="col-span-12">
          <WorkerSlotsGrid />
        </div>

        {/* ═══ BOTTOM: Production Dashboard ═══ */}
        <div className="col-span-12">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {/* Daily Usage */}
            <DailyUsageCard userPackage={userPackage} />

            {/* Scheduled Posts — Agent/Elite only */}
            {getPackageLimits(userPackage).scheduledPosting && <ScheduledPostsCard />}

            {/* Captions Lab — AI-generated captions live viewer */}
            <Card className="card-elevated relative overflow-hidden">
              <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-purple-500/30 to-transparent" />
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-500" />
                  <span>Captions Lab</span>
                  {generatedCaptions.length > 0 && (
                    <Badge variant="secondary" className="text-[10px] font-mono">{generatedCaptions.length}</Badge>
                  )}
                </CardTitle>
                <CardDescription className="text-[11px]">
                  แคปชั่นที่ AI สร้างให้แต่ละกลุ่ม (ดูสดระหว่างโพสต์)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {generatedCaptions.length > 0 ? (
                  <ScrollArea className="h-[200px]">
                    <div className="space-y-2">
                      {generatedCaptions.map((caption, i) => (
                        <div key={i} className="p-2.5 rounded-lg bg-muted/50 border text-xs leading-relaxed group hover:border-accent/30 transition-colors">
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="w-5 h-5 rounded-md bg-accent/10 flex items-center justify-center text-[9px] font-bold text-accent font-mono">{i + 1}</span>
                            <span className="text-[9px] text-muted-foreground font-medium">AI Generated</span>
                          </div>
                          <p className="whitespace-pre-wrap text-[11px] leading-relaxed">{caption.substring(0, 300)}{caption.length > 300 ? '…' : ''}</p>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="h-[200px] flex flex-col items-center justify-center text-muted-foreground/50">
                    <Sparkles className="w-10 h-10 mb-3 opacity-20" />
                    <p className="text-xs font-medium">ยังไม่มี Caption</p>
                    <p className="text-[10px] mt-0.5">เริ่ม Automation เพื่อดู AI Caption สดๆ</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
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

      {/* TaskProgressPopup now rendered globally in DashboardLayout */}

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

                // Connected FB sessions for slot selector
                const connectedFbSessions = fbSessions.map((s: any, i: number) => s && s.name ? { ...s, index: i } : null).filter(Boolean);

                return (
                  <div className="space-y-3">
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

                    {/* FB Account selector for schedule */}
                    {connectedFbSessions.length > 0 && (
                      <div>
                        <label className="text-[11px] text-muted-foreground font-medium mb-1.5 block">
                          {isEn ? '👤 Facebook Account' : '👤 บัญชี Facebook ที่ใช้โพสต์'}
                        </label>
                        <div className="flex gap-2 flex-wrap">
                          {connectedFbSessions.map((s: any) => {
                            const isSelected = selectedFbSlot === s.index;
                            return (
                              <button key={s.index} type="button" onClick={() => setSelectedFbSlot(s.index)}
                                className={cn("flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all text-left text-xs",
                                  isSelected ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 ring-1 ring-blue-500/30" : "border-border hover:border-blue-300 bg-background"
                                )}>
                                {s.profilePic ? (
                                  <img src={s.profilePic} alt="" className="w-5 h-5 rounded-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                ) : (
                                  <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center"><span className="text-white text-[9px] font-bold">{s.name?.charAt(0)}</span></div>
                                )}
                                <span className="truncate max-w-[120px]">{s.name}</span>
                                {isSelected && <Check className="w-3 h-3 text-blue-600 flex-shrink-0" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {displayDate && timeVal && (
                      <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-1.5">
                        {isEn ? 'Scheduled:' : 'กำหนดเวลา:'}{' '}
                        <span className="font-medium text-foreground">{displayDate} {isEn ? 'at' : 'เวลา'} {timeVal} {isEn ? '' : 'น.'}</span>
                      </p>
                    )}

                    <p className="text-[10px] text-muted-foreground bg-blue-50 dark:bg-blue-950/20 rounded-lg px-3 py-2 border border-blue-200/50 dark:border-blue-800/30">
                      💡 {isEn ? 'The system will automatically re-login to Facebook and start posting when the scheduled time arrives, even if you are not online.' : 'ระบบจะ Re-login Facebook อัตโนมัติและเริ่มโพสต์เมื่อถึงเวลาที่ตั้งไว้ แม้คุณไม่ได้ออนไลน์อยู่'}
                    </p>
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
                    const selectedFbSession = fbSessions[selectedFbSlot];
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
                        fbSlot: selectedFbSlot,
                        fbAccountName: selectedFbSession?.name || null,
                      }),
                    });
                    const data = await res.json();
                    if (data.success) {
                      toast.success(language === 'en' ? 'Post scheduled!' : 'ตั้งเวลาโพสต์สำเร็จ!', {
                        description: new Date(scheduleDateTime).toLocaleString('th-TH'),
                      });
                      if (data.warning) {
                        toast.warning(data.warning, { duration: 8000 });
                      }
                    } else {
                      toast.error(data.error || 'Failed to schedule');
                    }
                  } catch (err) {
                    toast.error(getErrorMessage(err, 'Schedule failed'));
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
