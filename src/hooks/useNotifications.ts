import { useState, useCallback, useEffect, useRef } from 'react';
import { apiFetch } from '@/lib/config';

export type NotificationCategory = 'admin' | 'system' | 'update' | 'automation' | 'general';

export interface AppNotification {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  category: NotificationCategory;
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
}

const STORAGE_KEY = 'grandstate_notifications';
const MAX_NOTIFICATIONS = 50;
const POLL_INTERVAL_MS = 30_000; // Poll every 30s

function loadNotifications(): AppNotification[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveNotifications(notifs: AppNotification[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notifs.slice(0, MAX_NOTIFICATIONS)));
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<AppNotification[]>(loadNotifications);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    saveNotifications(notifications);
  }, [notifications]);

  const addNotification = useCallback((n: Omit<AppNotification, 'id' | 'timestamp' | 'read'> & { category?: NotificationCategory }) => {
    const newNotif: AppNotification = {
      ...n,
      category: n.category || 'general',
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
      read: false,
    };
    setNotifications(prev => [newNotif, ...prev].slice(0, MAX_NOTIFICATIONS));
    return newNotif;
  }, []);

  // Poll backend for schedule notifications
  const pollScheduleNotifications = useCallback(async () => {
    try {
      const res = await apiFetch('/api/schedules/notifications');
      if (!res.ok) return;
      const data = await res.json();
      if (data.success && Array.isArray(data.notifications) && data.notifications.length > 0) {
        for (const n of data.notifications) {
          addNotification({
            type: 'info',
            category: 'automation',
            title: n.title || '🚀 คิวโพสต์เริ่มทำงาน',
            message: n.message || 'ระบบกำลังโพสต์อัตโนมัติตามที่ตั้งเวลาไว้',
          });
        }
      }
    } catch {
      // Silently ignore — user might be offline
    }
  }, [addNotification]);

  // Poll backend for admin ticket reply notifications
  const pollTicketReplies = useCallback(async () => {
    try {
      const res = await apiFetch('/api/notifications/poll');
      if (!res.ok) return;
      const data = await res.json();
      if (data.success && Array.isArray(data.notifications) && data.notifications.length > 0) {
        for (const n of data.notifications) {
          // Avoid duplicates by checking existing IDs
          setNotifications(prev => {
            const exists = prev.some(p => p.id === n.id);
            if (exists) return prev;
            const newNotif: AppNotification = {
              id: n.id,
              type: 'info',
              category: (n.category as NotificationCategory) || 'admin',
              title: n.title,
              message: n.message,
              timestamp: n.timestamp || Date.now(),
              read: false,
            };
            return [newNotif, ...prev].slice(0, MAX_NOTIFICATIONS);
          });
        }
      }
    } catch {
      // Silently ignore
    }
  }, []);

  // Start polling on mount
  useEffect(() => {
    // Poll immediately on mount
    pollTicketReplies();
    pollRef.current = setInterval(() => {
      pollScheduleNotifications();
      pollTicketReplies();
    }, POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [pollScheduleNotifications, pollTicketReplies]);

  const markAsRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  return { notifications, unreadCount, addNotification, markAsRead, markAllAsRead, clearAll };
}
