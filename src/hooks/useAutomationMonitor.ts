import { useState, useEffect, useCallback, useRef } from 'react';
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

interface LogEntry {
  time: number;
  msg: string;
  level: 'info' | 'success' | 'error' | 'warn' | 'start';
}

export interface AutomationMonitorState {
  isRunning: boolean;
  isPaused: boolean;
  currentStep: number;
  totalSteps: number;
  tasks: TaskStatus[];
  logs: LogEntry[];
  generatedCaptions: string[];
  startTime: number | null;
  endTime: number | null;
  mode: 'group' | 'marketplace' | null;
  orderId: string | null;  // Order ID (AUTO0000001 format)
  // Queue
  queuePosition: number | null;
  queueEstimate: number;
  queueRunningJobs: Array<{ displayName: string; groupCount: number; runningSec: number; automationType: string }> | null;
}

const INITIAL_STATE: AutomationMonitorState = {
  isRunning: false,
  isPaused: false,
  currentStep: 0,
  totalSteps: 0,
  tasks: [],
  logs: [],
  generatedCaptions: [],
  startTime: null,
  endTime: null,
  mode: null,
  orderId: null,
  queuePosition: null,
  queueEstimate: 0,
  queueRunningJobs: null,
};

/**
 * Global automation monitor — polls backend for running/completed automation.
 * Lives in DashboardLayout so the popup persists across page navigation.
 * Backend continues running even if user closes browser — this hook reconnects.
 */
export function useAutomationMonitor() {
  const [state, setState] = useState<AutomationMonitorState>(INITIAL_STATE);
  const [showPopup, setShowPopup] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const queuePollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const initialCheckDone = useRef(false);

  const getStatusPath = (mode: 'group' | 'marketplace') =>
    mode === 'marketplace' ? '/api/marketplace-automation/status' : '/api/group-automation/status';

  // ── Poll automation status ──
  const startPolling = useCallback((mode: 'group' | 'marketplace') => {
    if (pollingRef.current) clearInterval(pollingRef.current);

    pollingRef.current = setInterval(async () => {
      try {
        const res = await apiFetch(getStatusPath(mode));
        if (!res.ok) return;
        const data = await res.json();
        if (!data.success) return;

        setState(prev => {
          // Protect against backend returning empty data before automation actually starts
          const newTasks = (Array.isArray(data.tasks) && data.tasks.length > 0) ? data.tasks : prev.tasks;
          const newIsRunning = data.isRunning ?? prev.isRunning;
          // If backend says not running but we have no resolved tasks yet, keep prev state
          // (backend might not have started processing our request yet)
          const hasAnyResult = Array.isArray(data.tasks) && data.tasks.some((t: any) =>
            t.status === 'completed' || t.status === 'pending_approval' || t.status === 'failed' || t.status === 'in_progress'
          );
          const effectiveIsRunning = (!newIsRunning && !hasAnyResult && prev.isRunning) ? true : newIsRunning;
          return {
            ...prev,
            isRunning: effectiveIsRunning,
            isPaused: data.isPaused ?? prev.isPaused,
            currentStep: data.currentStep ?? prev.currentStep,
            totalSteps: data.totalSteps || prev.totalSteps,
            tasks: newTasks,
            logs: Array.isArray(data.logs) && data.logs.length > 0 ? data.logs : prev.logs,
            startTime: typeof data.startTime === 'number' ? data.startTime : prev.startTime,
            endTime: typeof data.endTime === 'number' ? data.endTime : prev.endTime,
            generatedCaptions: Array.isArray(data.generatedCaptions) && data.generatedCaptions.length > 0
              ? data.generatedCaptions : prev.generatedCaptions,
            orderId: data.orderId || prev.orderId,
            mode,
          };
        });

        if (!data.isRunning) {
          // Automation finished — stop polling, keep data for results display
          if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
          setState(prev => ({ ...prev, isRunning: false, isPaused: false }));
        }
      } catch {
        // Silent — backend might be unavailable
      }
    }, 3000);
  }, []);

  // ── Poll queue status ──
  const startQueuePolling = useCallback((mode: 'group' | 'marketplace') => {
    if (queuePollingRef.current) clearInterval(queuePollingRef.current);

    queuePollingRef.current = setInterval(async () => {
      try {
        const res = await apiFetch('/api/group-automation/queue-status');
        if (!res.ok) return;
        const data = await res.json();
        if (!data.success) return;

        if (data.status === 'running' || data.isRunning) {
          // Our turn — switch to automation polling
          setState(prev => ({ ...prev, queuePosition: null, queueRunningJobs: null }));
          if (queuePollingRef.current) { clearInterval(queuePollingRef.current); queuePollingRef.current = null; }
          startPolling(mode);
        } else if (data.status === 'queued') {
          setState(prev => ({
            ...prev,
            queuePosition: data.position,
            queueEstimate: data.estimatedWaitSec || 0,
            queueRunningJobs: data.runningJobs || null,
          }));
        } else if (data.status === 'idle') {
          setState(prev => ({ ...prev, queuePosition: null, queueRunningJobs: null, isRunning: false }));
          if (queuePollingRef.current) { clearInterval(queuePollingRef.current); queuePollingRef.current = null; }
        }
      } catch { /* silent */ }
    }, 5000);
  }, [startPolling]);

  // ── Initial check on mount — detect running automation ──
  useEffect(() => {
    if (initialCheckDone.current) return;
    initialCheckDone.current = true;

    const checkExisting = async () => {
      for (const mode of ['marketplace', 'group'] as const) {
        try {
          const res = await apiFetch(getStatusPath(mode));
          if (!res.ok) continue;
          const data = await res.json();

          if (data.success && data.isRunning) {
            setState(prev => ({
              ...prev,
              isRunning: true,
              isPaused: data.isPaused ?? false,
              currentStep: data.currentStep || 0,
              totalSteps: data.totalSteps || 0,
              tasks: data.tasks || [],
              logs: Array.isArray(data.logs) ? data.logs : [],
              startTime: typeof data.startTime === 'number' ? data.startTime : null,
              endTime: null,
              generatedCaptions: Array.isArray(data.generatedCaptions) ? data.generatedCaptions : [],
              mode,
            }));
            setShowPopup(true);
            startPolling(mode);
            return;
          }

          // Check for recently completed
          if (data.success && !data.isRunning && data.tasks?.length > 0) {
            const hasResults = data.tasks.some((t: any) =>
              t.status === 'completed' || t.status === 'pending_approval' || t.status === 'failed'
            );
            if (hasResults) {
              setState(prev => ({
                ...prev,
                isRunning: false,
                isPaused: false,
                currentStep: data.currentStep || 0,
                totalSteps: data.totalSteps || 0,
                tasks: data.tasks,
                logs: Array.isArray(data.logs) ? data.logs : [],
                startTime: typeof data.startTime === 'number' ? data.startTime : null,
                endTime: typeof data.endTime === 'number' ? data.endTime : null,
                generatedCaptions: Array.isArray(data.generatedCaptions) ? data.generatedCaptions : [],
                mode,
              }));
              setShowPopup(true);
              return;
            }
          }
        } catch { /* silent */ }
      }
    };

    checkExisting();
  }, [startPolling]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (queuePollingRef.current) clearInterval(queuePollingRef.current);
    };
  }, []);

  // ── Actions ──
  const stopAutomation = useCallback(async () => {
    if (!state.mode) return;
    if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
    if (queuePollingRef.current) { clearInterval(queuePollingRef.current); queuePollingRef.current = null; }

    const stopPath = state.mode === 'marketplace'
      ? '/api/marketplace-automation/stop'
      : '/api/group-automation/stop';

    try {
      await apiFetch(stopPath, { method: 'POST' });
      // Fetch final state
      const res = await apiFetch(getStatusPath(state.mode));
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setState(prev => ({
            ...prev,
            isRunning: false,
            isPaused: false,
            tasks: data.tasks ?? prev.tasks,
            logs: Array.isArray(data.logs) ? data.logs : prev.logs,
            endTime: typeof data.endTime === 'number' ? data.endTime : Date.now(),
          }));
        }
      }
    } catch { /* silent */ }
    setState(prev => ({ ...prev, isRunning: false, queuePosition: null }));
  }, [state.mode]);

  const pauseAutomation = useCallback(async () => {
    if (!state.mode) return;
    const path = state.mode === 'marketplace'
      ? '/api/marketplace-automation/pause'
      : '/api/group-automation/pause';
    try {
      await apiFetch(path, { method: 'POST' });
      setState(prev => ({ ...prev, isPaused: !prev.isPaused }));
    } catch { /* silent */ }
  }, [state.mode]);

  const dismissPopup = useCallback(() => {
    setShowPopup(false);
    setState(INITIAL_STATE);
  }, []);

  // ── Called by Automation page when user starts a new automation ──
  const notifyStarted = useCallback((mode: 'group' | 'marketplace', initialData?: Partial<AutomationMonitorState>, shouldPoll = false) => {
    setState(prev => ({
      ...prev,
      isRunning: true,
      isPaused: false,
      mode,
      ...(initialData || {}),
    }));
    setShowPopup(true);
    // Only start polling if explicitly requested (after API call succeeds)
    if (shouldPoll) startPolling(mode);
  }, [startPolling]);

  const notifyQueued = useCallback((mode: 'group' | 'marketplace', position: number, estimate: number) => {
    setState(prev => ({
      ...prev,
      isRunning: true,
      mode,
      queuePosition: position,
      queueEstimate: estimate,
    }));
    setShowPopup(true);
    startQueuePolling(mode);
  }, [startQueuePolling]);

  // Derived values
  const completedTasks = state.tasks.filter(t => t.status === 'completed').length;
  const pendingApprovalTasks = state.tasks.filter(t => t.status === 'pending_approval').length;
  const failedTasks = state.tasks.filter(t => t.status === 'failed').length;
  const inProgressTasks = state.tasks.filter(t => t.status === 'in_progress').length;
  const resolvedTasks = completedTasks + pendingApprovalTasks + failedTasks;
  // Count in_progress tasks as 50% done so progress bar moves during automation
  const effectiveProgress = resolvedTasks + (inProgressTasks * 0.5);
  const progressPercent = state.totalSteps > 0 ? Math.min(Math.round((effectiveProgress / state.totalSteps) * 100), 99) : 0;

  return {
    state,
    showPopup,
    setShowPopup,
    completedTasks,
    pendingApprovalTasks,
    failedTasks,
    progressPercent,
    stopAutomation,
    pauseAutomation,
    dismissPopup,
    notifyStarted,
    notifyQueued,
    startPolling,
  };
}
