import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/config';

interface FacebookUser {
  name: string;
  profilePic?: string;
  connectedAt: string;
}

interface FacebookConnectionState {
  isConnected: boolean;
  isConnecting: boolean;
  isChecking: boolean;
  user: FacebookUser | null;
  error: string | null;
}

export function useFacebookConnection() {
  const [state, setState] = useState<FacebookConnectionState>({
    isConnected: false,
    isConnecting: false,
    isChecking: true,
    user: null,
    error: null,
  });

  // Check connection status on mount
  const checkStatus = useCallback(async () => {
    setState(prev => ({ ...prev, isChecking: true, error: null }));
    
    try {
      const response = await apiFetch('/api/facebook/status');
      const data = await response.json();
      
      if (data.success && data.connected) {
        setState({
          isConnected: true,
          isConnecting: false,
          isChecking: false,
          user: data.user,
          error: null,
        });
      } else {
        setState({
          isConnected: false,
          isConnecting: false,
          isChecking: false,
          user: null,
          error: null,
        });
      }
    } catch (error) {
      setState({
        isConnected: false,
        isConnecting: false,
        isChecking: false,
        user: null,
        error: null,
      });
    }
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  // Connect to Facebook (opens browser)
  const connect = useCallback(async () => {
    setState(prev => ({ ...prev, isConnecting: true, error: null }));
    
    try {
      const response = await apiFetch('/api/facebook/connect', {
        method: 'POST',
      });
      const data = await response.json();
      
      if (data.success) {
        // Browser is now open, user needs to login
        setState(prev => ({ ...prev, isConnecting: true }));
        return { success: true, message: 'กรุณา Login Facebook ในหน้าต่างที่เปิดมา' };
      } else {
        setState(prev => ({ ...prev, isConnecting: false, error: data.error }));
        return { success: false, message: data.error };
      }
    } catch (error: any) {
      setState(prev => ({ ...prev, isConnecting: false, error: error.message }));
      return { success: false, message: error.message };
    }
  }, []);

  // Confirm login (after user logs in manually)
  const confirmLogin = useCallback(async () => {
    try {
      const response = await apiFetch('/api/facebook/confirm-login', {
        method: 'POST',
      });
      const data = await response.json();
      
      if (data.success && data.connected) {
        setState({
          isConnected: true,
          isConnecting: false,
          isChecking: false,
          user: data.user,
          error: null,
        });
        return { success: true, message: data.message, user: data.user };
      } else {
        return { success: false, message: data.message };
      }
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }, []);

  // Auto-login to Facebook (VPS headless mode)
  const autoLogin = useCallback(async (email: string, password: string) => {
    try {
      const response = await apiFetch('/api/facebook/auto-login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      
      if (data.success) {
        // Login succeeded, check status to get user info
        await checkStatus();
        return { success: true, message: data.message };
      } else {
        return { success: false, message: data.error };
      }
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }, [checkStatus]);

  // Disconnect from Facebook
  const disconnect = useCallback(async () => {
    try {
      const response = await apiFetch('/api/facebook/disconnect', {
        method: 'POST',
      });
      const data = await response.json();
      
      if (data.success) {
        setState({
          isConnected: false,
          isConnecting: false,
          isChecking: false,
          user: null,
          error: null,
        });
        return { success: true, message: data.message };
      } else {
        return { success: false, message: data.error };
      }
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }, []);

  return {
    ...state,
    connect,
    confirmLogin,
    autoLogin,
    disconnect,
    checkStatus,
  };
}
