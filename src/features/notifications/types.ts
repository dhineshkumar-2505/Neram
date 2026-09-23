import type { Database } from '../../types/database';

export type NotificationType = Database['public']['Enums']['notification_type'];

export interface NotificationActor {
  userId: string;
  displayName: string;
  username: string;
  avatarUrl: string | null;
}

export interface NotificationGroup {
  id: string;
  name: string;
  purpose: string;
  lifecycleState: string;
}

export interface NotificationRecord {
  id: string;
  userId: string;
  type: NotificationType;
  actorId: string | null;
  groupId: string | null;
  payload: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
  actor?: NotificationActor;
  group?: NotificationGroup;
}

export interface DeviceRegistrationInput {
  deviceId: string;
  platform: 'ANDROID' | 'IOS';
  pushToken: string;
}

export interface FetchNotificationsOptions {
  userId: string;
  limit?: number;
  beforeCreatedAt?: string;
}

export interface FetchNotificationsResult {
  notifications: NotificationRecord[];
  hasMore: boolean;
  unreadCount: number;
  error?: string;
}

export interface NotificationSubscriptionCallbacks {
  onInsert?: (notification: NotificationRecord) => void;
  onUpdate?: (notification: NotificationRecord) => void;
  onDelete?: (notificationId: string) => void;
  onError?: (error: Error) => void;
}
