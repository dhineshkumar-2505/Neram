import { supabase } from '../../../lib/supabase';
import type {
  NotificationRecord,
  FetchNotificationsOptions,
  FetchNotificationsResult,
  DeviceRegistrationInput,
  NotificationSubscriptionCallbacks,
  NotificationActor,
  NotificationGroup,
  NotificationType,
} from '../types';

interface RawNotificationRow {
  id: string;
  user_id: string;
  type: string;
  actor_id: string | null;
  group_id: string | null;
  payload_json: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
  actor?: {
    user_id: string;
    display_name: string;
    username: string;
    avatar_path: string | null;
  } | null;
  group?: {
    id: string;
    name: string;
    purpose: string;
    lifecycle_state: string;
  } | null;
}

function formatNotificationRow(row: RawNotificationRow): NotificationRecord {
  const actor: NotificationActor | undefined = row.actor
    ? {
        userId: row.actor.user_id,
        displayName: row.actor.display_name,
        username: row.actor.username,
        avatarUrl: row.actor.avatar_path,
      }
    : undefined;

  const group: NotificationGroup | undefined = row.group
    ? {
        id: row.group.id,
        name: row.group.name,
        purpose: row.group.purpose,
        lifecycleState: row.group.lifecycle_state,
      }
    : undefined;

  return {
    id: row.id,
    userId: row.user_id,
    type: row.type as NotificationType,
    actorId: row.actor_id,
    groupId: row.group_id,
    payload: row.payload_json || {},
    readAt: row.read_at,
    createdAt: row.created_at,
    actor,
    group,
  };
}

const NOTIFICATION_SELECT_QUERY = `
  id,
  user_id,
  type,
  actor_id,
  group_id,
  payload_json,
  read_at,
  created_at,
  actor:profiles!notifications_actor_id_fkey(user_id, display_name, username, avatar_path),
  group:groups!notifications_group_id_fkey(id, name, purpose, lifecycle_state)
`;

export const notificationService = {
  /**
   * Fetches paginated in-app notifications for the authenticated user,
   * ordered from newest to oldest.
   */
  async fetchNotifications(
    options: FetchNotificationsOptions,
  ): Promise<FetchNotificationsResult> {
    try {
      const limit = options.limit || 20;

      let query = supabase
        .from('notifications')
        .select(NOTIFICATION_SELECT_QUERY)
        .eq('user_id', options.userId);

      if (options.beforeCreatedAt) {
        query = query.lt('created_at', options.beforeCreatedAt);
      }

      const { data, error } = await query
        .order('created_at', { ascending: false })
        .limit(limit + 1);

      if (error) {
        return { notifications: [], hasMore: false, unreadCount: 0, error: error.message };
      }

      const rawRows = (data || []) as unknown as RawNotificationRow[];
      const hasMore = rawRows.length > limit;
      const slicedRows = hasMore ? rawRows.slice(0, limit) : rawRows;
      const formatted = slicedRows.map(formatNotificationRow);

      const unreadCount = await notificationService.fetchUnreadCount(options.userId);

      return {
        notifications: formatted,
        hasMore,
        unreadCount,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch notifications';
      return { notifications: [], hasMore: false, unreadCount: 0, error: message };
    }
  },

  /**
   * Look up a single notification by ID with actor and group relations.
   */
  async fetchNotificationById(notificationId: string): Promise<NotificationRecord | null> {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select(NOTIFICATION_SELECT_QUERY)
        .eq('id', notificationId)
        .single();

      if (error || !data) {
        return null;
      }

      return formatNotificationRow(data as unknown as RawNotificationRow);
    } catch {
      return null;
    }
  },

  /**
   * Fast count of unread notifications for tab badge indicators.
   */
  async fetchUnreadCount(userId: string): Promise<number> {
    try {
      const { count, error } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .is('read_at', null);

      if (error || count === null) {
        return 0;
      }

      return count;
    } catch {
      return 0;
    }
  },

  /**
   * Marks a specific notification as read.
   */
  async markAsRead(
    notificationId: string,
    userId: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', notificationId)
        .eq('user_id', userId);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to mark as read';
      return { success: false, error: message };
    }
  },

  /**
   * Bulk-marks all unread notifications as read for the user.
   */
  async markAllAsRead(userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('user_id', userId)
        .is('read_at', null);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to mark all as read';
      return { success: false, error: message };
    }
  },

  /**
   * Deletes an individual notification.
   */
  async deleteNotification(
    notificationId: string,
    userId: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId)
        .eq('user_id', userId);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete notification';
      return { success: false, error: message };
    }
  },

  /**
   * Subscribes to Realtime change events on public.notifications scoped strictly to auth.uid().
   */
  subscribeToUserNotifications(
    userId: string,
    callbacks: NotificationSubscriptionCallbacks,
  ): () => void {
    const channelName = `user-notifications-${userId}`;
    const channel = supabase.channel(channelName);

    channel
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        async (payload) => {
          try {
            const rawNew = payload.new as { id: string };
            if (!rawNew?.id) return;

            const fullNotification = await notificationService.fetchNotificationById(rawNew.id);
            if (fullNotification) {
              callbacks.onInsert?.(fullNotification);
            }
          } catch (err) {
            callbacks.onError?.(err instanceof Error ? err : new Error('Realtime insert error'));
          }
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        async (payload) => {
          try {
            const rawNew = payload.new as { id: string };
            if (!rawNew?.id) return;

            const fullNotification = await notificationService.fetchNotificationById(rawNew.id);
            if (fullNotification) {
              callbacks.onUpdate?.(fullNotification);
            }
          } catch (err) {
            callbacks.onError?.(err instanceof Error ? err : new Error('Realtime update error'));
          }
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          try {
            const rawOld = payload.old as { id: string };
            if (rawOld?.id) {
              callbacks.onDelete?.(rawOld.id);
            }
          } catch (err) {
            callbacks.onError?.(err instanceof Error ? err : new Error('Realtime delete error'));
          }
        },
      )
      .subscribe((_status, err) => {
        if (err) {
          callbacks.onError?.(err);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  },

  /**
   * Registers or refreshes a hardware device push token in public.user_devices.
   */
  async registerDeviceToken(
    input: DeviceRegistrationInput,
    userId: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase.from('user_devices').upsert(
        {
          device_id: input.deviceId,
          user_id: userId,
          platform: input.platform,
          push_token: input.pushToken,
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: 'device_id' },
      );

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to register device token';
      return { success: false, error: message };
    }
  },

  /**
   * Unregisters a hardware device push token upon session logout.
   */
  async unregisterDeviceToken(
    deviceId: string,
    userId: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('user_devices')
        .delete()
        .eq('device_id', deviceId)
        .eq('user_id', userId);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to unregister device token';
      return { success: false, error: message };
    }
  },
};

export default notificationService;
