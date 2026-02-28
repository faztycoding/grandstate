import { useState, useCallback, useEffect } from 'react';

export interface AppNotification {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
}

const STORAGE_KEY = 'grandstate_notifications';
const MAX_NOTIFICATIONS = 50;

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

  useEffect(() => {
    saveNotifications(notifications);
  }, [notifications]);

  const addNotification = useCallback((n: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => {
    const newNotif: AppNotification = {
      ...n,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
      read: false,
    };
    setNotifications(prev => [newNotif, ...prev].slice(0, MAX_NOTIFICATIONS));
    return newNotif;
  }, []);

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
