import { useState, useEffect, useCallback } from 'react';
import { notificationService } from '../services/notificationService';
import type { NotificationRecord } from '../types';

export interface UseNotificationsResult {
  notifications: NotificationRecord[];
  unreadCount: number;
  isLoading: boolean;
  isRefreshing: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
}

/**
 * Realtime Notifications stream hook.
 * Manages notification feed, unread counter, pagination, and Realtime WebSocket updates.
 */
export function useNotifications(userId?: string): UseNotificationsResult {
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Initial fetch
  const fetchInitial = useCallback(async () => {
    if (!userId) {
      setNotifications([]);
      setUnreadCount(0);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const result = await notificationService.fetchNotifications({
      userId,
      limit: 20,
    });

    if (result.error) {
      setError(result.error);
    } else {
      setNotifications(result.notifications);
      setHasMore(result.hasMore);
      setUnreadCount(result.unreadCount);
    }
    setIsLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchInitial();
  }, [fetchInitial]);

  // Realtime subscription
  useEffect(() => {
    if (!userId) return;

    const unsubscribe = notificationService.subscribeToUserNotifications(userId, {
      onInsert: (newNotification) => {
        setNotifications((prev) => {
          if (prev.some((n) => n.id === newNotification.id)) return prev;
          return [newNotification, ...prev];
        });
        if (!newNotification.readAt) {
          setUnreadCount((prev) => prev + 1);
        }
      },
      onUpdate: (updatedNotification) => {
        setNotifications((prev) =>
          prev.map((n) => (n.id === updatedNotification.id ? updatedNotification : n)),
        );
        // Refresh unread count on update
        notificationService.fetchUnreadCount(userId).then(setUnreadCount);
      },
      onDelete: (deletedId) => {
        setNotifications((prev) => prev.filter((n) => n.id !== deletedId));
        notificationService.fetchUnreadCount(userId).then(setUnreadCount);
      },
      onError: (err) => {
        if (__DEV__) {
          console.warn('[useNotifications] Realtime subscription error:', err.message);
        }
      },
    });

    return () => {
      unsubscribe();
    };
  }, [userId]);

  // Pull to refresh
  const refresh = useCallback(async () => {
    if (!userId) return;
    setIsRefreshing(true);
    setError(null);

    const result = await notificationService.fetchNotifications({
      userId,
      limit: 20,
    });

    if (result.error) {
      setError(result.error);
    } else {
      setNotifications(result.notifications);
      setHasMore(result.hasMore);
      setUnreadCount(result.unreadCount);
    }
    setIsRefreshing(false);
  }, [userId]);

  // Load older notifications
  const loadMore = useCallback(async () => {
    if (!userId || isLoadingMore || !hasMore || notifications.length === 0) return;

    setIsLoadingMore(true);
    const oldestItem = notifications[notifications.length - 1];
    if (!oldestItem) {
      setIsLoadingMore(false);
      return;
    }

    const result = await notificationService.fetchNotifications({
      userId,
      limit: 20,
      beforeCreatedAt: oldestItem.createdAt,
    });

    if (!result.error) {
      setNotifications((prev) => [...prev, ...result.notifications]);
      setHasMore(result.hasMore);
    }
    setIsLoadingMore(false);
  }, [userId, isLoadingMore, hasMore, notifications]);

  // Optimistic mark as read
  const markAsRead = useCallback(
    async (notificationId: string) => {
      if (!userId) return;

      const target = notifications.find((n) => n.id === notificationId);
      if (!target || target.readAt) return; // already read

      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId ? { ...n, readAt: new Date().toISOString() } : n,
        ),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));

      await notificationService.markAsRead(notificationId, userId);
    },
    [userId, notifications],
  );

  // Bulk mark all as read
  const markAllAsRead = useCallback(async () => {
    if (!userId || unreadCount === 0) return;

    const now = new Date().toISOString();
    setNotifications((prev) => prev.map((n) => ({ ...n, readAt: n.readAt || now })));
    setUnreadCount(0);

    await notificationService.markAllAsRead(userId);
  }, [userId, unreadCount]);

  // Delete notification
  const deleteNotification = useCallback(
    async (notificationId: string) => {
      if (!userId) return;

      const target = notifications.find((n) => n.id === notificationId);
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
      if (target && !target.readAt) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }

      await notificationService.deleteNotification(notificationId, userId);
    },
    [userId, notifications],
  );

  return {
    notifications,
    unreadCount,
    isLoading,
    isRefreshing,
    isLoadingMore,
    hasMore,
    error,
    refresh,
    loadMore,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  };
}

export default useNotifications;
