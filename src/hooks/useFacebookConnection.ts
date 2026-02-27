import { useState, useEffect, useCallback } from 'react';
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

  // Check connection status on mount — returns ALL session slots
  const checkStatus = useCallback(async () => {
    setState(prev => ({ ...prev, isChecking: true, error: null }));

    try {
      const response = await apiFetch('/api/facebook/status');
      const data = await response.json();

      if (data.success) {
        setState(prev => ({
          ...prev,
          isConnected: data.connected ?? false,
          isConnecting: prev.connectingSlot !== null ? prev.isConnecting : false,
          isChecking: false,
          user: data.user || null,
          error: null,
          sessions: Array.isArray(data.sessions) ? data.sessions : [],
          activeSlot: data.activeSlot ?? 0,
          connectedCount: data.connectedCount ?? 0,
        }));
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

    try {
      const response = await apiFetch('/api/facebook/connect', {
        method: 'POST',
        body: JSON.stringify({ slot }),
      });
      const data = await response.json();

      if (data.success) {
        setState(prev => ({ ...prev, isConnecting: true, activeSlot: slot }));
        return { success: true, message: 'กรุณา Login Facebook ในหน้าต่างที่เปิดมา', slot };
      } else {
        setState(prev => ({ ...prev, isConnecting: false, connectingSlot: null, error: data.error }));
        return { success: false, message: data.error };
      }
    } catch (error: any) {
      setState(prev => ({ ...prev, isConnecting: false, connectingSlot: null, error: error.message }));
      return { success: false, message: error.message };
    }
  }, []);

  // Confirm login (after user logs in manually) — saves to active slot
  const confirmLogin = useCallback(async () => {
    try {
      const response = await apiFetch('/api/facebook/confirm-login', { method: 'POST' });
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
    try {
      const response = await apiFetch('/api/facebook/auto-login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();

      if (data.success) {
        await checkStatus();
        setState(prev => ({ ...prev, isConnecting: false, connectingSlot: null }));
        return { success: true, message: data.message, slot: data.slot };
      } else {
        return { success: false, message: data.error };
      }
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }, [checkStatus]);

  // Disconnect a specific slot
  const disconnect = useCallback(async (slot?: number) => {
    try {
      const response = await apiFetch('/api/facebook/disconnect', {
        method: 'POST',
        body: JSON.stringify({ slot: slot ?? state.activeSlot }),
      });
      const data = await response.json();

      if (data.success) {
        await checkStatus();
        return { success: true, message: data.message };
      } else {
        return { success: false, message: data.error };
      }
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }, [checkStatus, state.activeSlot]);

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
    disconnect,
    checkStatus,
    setActiveSlot,
  };
}
