import { useState, useEffect, useCallback, useRef } from 'react';
import { apiFetch } from '@/lib/config';

export interface FacebookUser {
  name: string;
  profilePic?: string;
  connectedAt: string;
}

export interface FbSessionSlot {
  slot: number;
  name: string | null;
  profilePic: string | null;
  connectedAt: string | null;
}

interface FacebookConnectionState {
  isConnected: boolean;
  isConnecting: boolean;
  isChecking: boolean;
  user: FacebookUser | null;
  error: string | null;
  // Multi-session
  sessions: FbSessionSlot[];
  activeSlot: number;
  connectedCount: number;
  connectingSlot: number | null;
}

const ACTIVE_SLOT_KEY = 'grandstate-active-fb-slot';

export function useFacebookConnection() {
  const [state, setState] = useState<FacebookConnectionState>({
    isConnected: false,
    isConnecting: false,
    isChecking: true,
    user: null,
    error: null,
    sessions: [],
    activeSlot: (() => {
      try { return parseInt(localStorage.getItem(ACTIVE_SLOT_KEY) || '0', 10); } catch { return 0; }
    })(),
    connectedCount: 0,
    connectingSlot: null,
  });

  // Auto-timeout: reset connecting state after 120s to prevent permanent hangs
  const connectingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Check connection status on mount — returns ALL session slots
  const checkStatus = useCallback(async () => {
    setState(prev => ({ ...prev, isChecking: true, error: null }));

    try {
      const response = await apiFetch('/api/facebook/status');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();

      if (data.success) {
        const sessions: FbSessionSlot[] = Array.isArray(data.sessions) ? data.sessions : [];
        setState(prev => {
          // Smart reset: if the connecting slot now has a user OR was disconnected, stop connecting
          let stillConnecting = prev.isConnecting;
          let stillConnectingSlot = prev.connectingSlot;
          if (prev.connectingSlot !== null) {
            const slotData = sessions[prev.connectingSlot];
            // If slot now has a name (login succeeded) or slot doesn't exist → reset
            if (slotData?.name || !slotData) {
              stillConnecting = false;
              stillConnectingSlot = null;
            }
          }
          return {
            ...prev,
            isConnected: data.connected ?? false,
            isConnecting: stillConnecting,
            connectingSlot: stillConnectingSlot,
            isChecking: false,
            user: data.user || null,
            error: null,
            sessions,
            activeSlot: data.activeSlot ?? 0,
            connectedCount: data.connectedCount ?? 0,
          };
        });
      } else {
        setState(prev => ({ ...prev, isChecking: false, error: null }));
      }
    } catch {
      setState(prev => ({ ...prev, isChecking: false, error: null }));
    }
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  // Connect a specific slot (opens browser for that slot)
  const connect = useCallback(async (slot: number = 0) => {
    setState(prev => ({ ...prev, isConnecting: true, connectingSlot: slot, error: null }));

    // Set auto-timeout to prevent permanent hang
    if (connectingTimeoutRef.current) clearTimeout(connectingTimeoutRef.current);
    connectingTimeoutRef.current = setTimeout(() => {
      setState(prev => {
        if (prev.isConnecting && prev.connectingSlot === slot) {
          return { ...prev, isConnecting: false, connectingSlot: null, error: 'หมดเวลาเชื่อมต่อ — กรุณาลองใหม่' };
        }
        return prev;
      });
    }, 120_000); // 120s timeout

    try {
      const response = await apiFetch('/api/facebook/connect', {
        method: 'POST',
        body: JSON.stringify({ slot }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();

      if (data.success) {
        setState(prev => ({ ...prev, isConnecting: true, activeSlot: slot }));
        return { success: true, message: 'กรุณา Login Facebook ในหน้าต่างที่เปิดมา', slot };
      } else {
        if (connectingTimeoutRef.current) { clearTimeout(connectingTimeoutRef.current); connectingTimeoutRef.current = null; }
        setState(prev => ({ ...prev, isConnecting: false, connectingSlot: null, error: data.error }));
        return { success: false, message: data.error };
      }
    } catch (error: any) {
      if (connectingTimeoutRef.current) { clearTimeout(connectingTimeoutRef.current); connectingTimeoutRef.current = null; }
      setState(prev => ({ ...prev, isConnecting: false, connectingSlot: null, error: error.message }));
      return { success: false, message: error.message };
    }
  }, []);

  // Confirm login (after user logs in manually) — saves to active slot
  const confirmLogin = useCallback(async () => {
    try {
      const response = await apiFetch('/api/facebook/confirm-login', { method: 'POST' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();

      if (data.success && data.connected) {
        // Refresh all sessions to get updated slot data
        await checkStatus();
        setState(prev => ({ ...prev, isConnecting: false, connectingSlot: null }));
        return { success: true, message: data.message, user: data.user, slot: data.slot };
      } else {
        return { success: false, message: data.message };
      }
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }, [checkStatus]);

  // Auto-login (VPS headless mode) — uses active slot
  const autoLogin = useCallback(async (email: string, password: string) => {
    // 95-second timeout — backend has 90s guard, this is the frontend safety net
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 95000);
    try {
      const response = await apiFetch('/api/facebook/auto-login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();

      if (data.success) {
        await checkStatus();
        setState(prev => ({ ...prev, isConnecting: false, connectingSlot: null }));
        return { success: true as const, message: data.message, slot: data.slot, user: data.user as { name: string; profilePic: string } | undefined };
      } else {
        return { success: false as const, message: data.error };
      }
    } catch (error: any) {
      clearTimeout(timeoutId);
      const msg = error.name === 'AbortError' ? 'Login หมดเวลา — กรุณาลองใหม่อีกครั้ง' : error.message;
      return { success: false as const, message: msg };
    }
  }, [checkStatus]);

  // Disconnect a specific slot
  const disconnect = useCallback(async (slot?: number) => {
    const targetSlot = slot ?? state.activeSlot;
    try {
      const response = await apiFetch('/api/facebook/disconnect', {
        method: 'POST',
        body: JSON.stringify({ slot: targetSlot }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();

      if (data.success) {
        // Always reset connecting state for the disconnected slot
        if (connectingTimeoutRef.current) { clearTimeout(connectingTimeoutRef.current); connectingTimeoutRef.current = null; }
        setState(prev => ({
          ...prev,
          isConnecting: prev.connectingSlot === targetSlot ? false : prev.isConnecting,
          connectingSlot: prev.connectingSlot === targetSlot ? null : prev.connectingSlot,
        }));
        await checkStatus();
        return { success: true, message: data.message };
      } else {
        return { success: false, message: data.error };
      }
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }, [checkStatus, state.activeSlot]);

  // Re-login using stored credentials (slot-specific)
  // Returns { success, message, needCredentials? } — if needCredentials=true, caller should show email/password form
  const reLogin = useCallback(async (slot: number) => {
    try {
      const response = await apiFetch('/api/facebook/re-login', {
        method: 'POST',
        body: JSON.stringify({ slot }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();

      if (data.success) {
        await checkStatus();
        return { success: true as const, message: data.message, user: data.user as { name: string; profilePic: string } | undefined };
      } else {
        return { success: false as const, message: data.error, needCredentials: data.needCredentials || false };
      }
    } catch (error: any) {
      return { success: false as const, message: error.message, needCredentials: false };
    }
  }, [checkStatus]);

  // Check session health — returns which slots need re-login
  const checkSessionHealth = useCallback(async () => {
    try {
      const response = await apiFetch('/api/facebook/session-health');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (data.success) {
        return data as {
          success: true;
          activeSlot: number;
          activeNeedsRelogin: boolean;
          activeHasCredentials: boolean;
          slots: Array<{ slot: number; connected: boolean; name?: string; ageDays: number; hasCredentials: boolean; needsRelogin: boolean }>;
        };
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  // Set active slot for posting (persisted to localStorage)
  const setActiveSlot = useCallback((slot: number) => {
    setState(prev => ({ ...prev, activeSlot: slot }));
    try { localStorage.setItem(ACTIVE_SLOT_KEY, String(slot)); } catch {}
  }, []);

  return {
    ...state,
    connect,
    confirmLogin,
    autoLogin,
    reLogin,
    checkSessionHealth,
    disconnect,
    checkStatus,
    setActiveSlot,
  };
}
