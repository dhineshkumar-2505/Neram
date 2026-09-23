import { notificationService } from '../../src/features/notifications/services/notificationService';
import { supabase } from '../../src/lib/supabase';

jest.mock('../../src/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    channel: jest.fn(),
    removeChannel: jest.fn(),
  },
}));

describe('notificationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchNotifications', () => {
    it('fetches notifications ordered newest to oldest and computes unread count', async () => {
      const mockRows = [
        {
          id: 'notif_1',
          user_id: 'usr_me',
          type: 'FRIEND_REQUEST',
          actor_id: 'usr_sender',
          group_id: null,
          payload_json: { request_id: 'req_123' },
          read_at: null,
          created_at: '2026-09-23T14:00:00Z',
          actor: {
            user_id: 'usr_sender',
            display_name: 'Alex Rivera',
            username: 'alex_r',
            avatar_path: null,
          },
          group: null,
        },
      ];

      const mockLimit = jest.fn().mockResolvedValueOnce({
        data: mockRows,
        error: null,
      });
      const mockOrder = jest.fn().mockReturnValue({ limit: mockLimit });
      const mockEq = jest.fn().mockReturnValue({ order: mockOrder });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });

      // For fetchUnreadCount query
      const mockHeadEq = jest.fn().mockReturnValue({
        is: jest.fn().mockResolvedValueOnce({ count: 1, error: null }),
      });
      const mockHeadSelect = jest.fn().mockReturnValue({ eq: mockHeadEq });

      (supabase.from as jest.Mock)
        .mockReturnValueOnce({ select: mockSelect })
        .mockReturnValueOnce({ select: mockHeadSelect });

      const result = await notificationService.fetchNotifications({
        userId: 'usr_me',
        limit: 10,
      });

      expect(result.error).toBeUndefined();
      expect(result.notifications).toHaveLength(1);
      expect(result.notifications[0]?.type).toBe('FRIEND_REQUEST');
      expect(result.notifications[0]?.actor?.displayName).toBe('Alex Rivera');
      expect(result.unreadCount).toBe(1);
      expect(result.hasMore).toBe(false);

      expect(mockEq).toHaveBeenCalledWith('user_id', 'usr_me');
      expect(mockOrder).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(mockLimit).toHaveBeenCalledWith(11);
    });

    it('supports cursor pagination via beforeCreatedAt', async () => {
      const mockLimit = jest.fn().mockResolvedValueOnce({
        data: [],
        error: null,
      });
      const mockOrder = jest.fn().mockReturnValue({ limit: mockLimit });
      const mockLt = jest.fn().mockReturnValue({ order: mockOrder });
      const mockEq = jest.fn().mockReturnValue({ lt: mockLt });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });

      // Unread count
      const mockHeadEq = jest.fn().mockReturnValue({
        is: jest.fn().mockResolvedValueOnce({ count: 0, error: null }),
      });
      const mockHeadSelect = jest.fn().mockReturnValue({ eq: mockHeadEq });

      (supabase.from as jest.Mock)
        .mockReturnValueOnce({ select: mockSelect })
        .mockReturnValueOnce({ select: mockHeadSelect });

      const result = await notificationService.fetchNotifications({
        userId: 'usr_me',
        beforeCreatedAt: '2026-09-23T12:00:00Z',
      });

      expect(result.error).toBeUndefined();
      expect(mockLt).toHaveBeenCalledWith('created_at', '2026-09-23T12:00:00Z');
    });

    it('returns error message if database query fails', async () => {
      const mockLimit = jest.fn().mockResolvedValueOnce({
        data: null,
        error: { message: 'Database query failed' },
      });
      const mockOrder = jest.fn().mockReturnValue({ limit: mockLimit });
      const mockEq = jest.fn().mockReturnValue({ order: mockOrder });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });

      (supabase.from as jest.Mock).mockReturnValueOnce({ select: mockSelect });

      const result = await notificationService.fetchNotifications({
        userId: 'usr_me',
      });

      expect(result.notifications).toEqual([]);
      expect(result.error).toBe('Database query failed');
    });
  });

  describe('fetchUnreadCount', () => {
    it('returns exact count of unread notifications', async () => {
      const mockIs = jest.fn().mockResolvedValueOnce({ count: 5, error: null });
      const mockEq = jest.fn().mockReturnValue({ is: mockIs });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });

      (supabase.from as jest.Mock).mockReturnValue({ select: mockSelect });

      const count = await notificationService.fetchUnreadCount('usr_me');
      expect(count).toBe(5);
      expect(mockSelect).toHaveBeenCalledWith('id', { count: 'exact', head: true });
      expect(mockEq).toHaveBeenCalledWith('user_id', 'usr_me');
      expect(mockIs).toHaveBeenCalledWith('read_at', null);
    });

    it('returns 0 on query error', async () => {
      const mockIs = jest.fn().mockResolvedValueOnce({ count: null, error: { message: 'err' } });
      const mockEq = jest.fn().mockReturnValue({ is: mockIs });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });

      (supabase.from as jest.Mock).mockReturnValue({ select: mockSelect });

      const count = await notificationService.fetchUnreadCount('usr_me');
      expect(count).toBe(0);
    });
  });

  describe('markAsRead & markAllAsRead', () => {
    it('marks individual notification as read', async () => {
      const mockUserEq = jest.fn().mockResolvedValueOnce({ error: null });
      const mockIdEq = jest.fn().mockReturnValue({ eq: mockUserEq });
      const mockUpdate = jest.fn().mockReturnValue({ eq: mockIdEq });

      (supabase.from as jest.Mock).mockReturnValue({ update: mockUpdate });

      const result = await notificationService.markAsRead('notif_1', 'usr_me');
      expect(result.success).toBe(true);
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ read_at: expect.any(String) }),
      );
      expect(mockIdEq).toHaveBeenCalledWith('id', 'notif_1');
      expect(mockUserEq).toHaveBeenCalledWith('user_id', 'usr_me');
    });

    it('marks all unread notifications as read', async () => {
      const mockIs = jest.fn().mockResolvedValueOnce({ error: null });
      const mockEq = jest.fn().mockReturnValue({ is: mockIs });
      const mockUpdate = jest.fn().mockReturnValue({ eq: mockEq });

      (supabase.from as jest.Mock).mockReturnValue({ update: mockUpdate });

      const result = await notificationService.markAllAsRead('usr_me');
      expect(result.success).toBe(true);
      expect(mockEq).toHaveBeenCalledWith('user_id', 'usr_me');
      expect(mockIs).toHaveBeenCalledWith('read_at', null);
    });
  });

  describe('deleteNotification', () => {
    it('deletes notification record', async () => {
      const mockUserEq = jest.fn().mockResolvedValueOnce({ error: null });
      const mockIdEq = jest.fn().mockReturnValue({ eq: mockUserEq });
      const mockDelete = jest.fn().mockReturnValue({ eq: mockIdEq });

      (supabase.from as jest.Mock).mockReturnValue({ delete: mockDelete });

      const result = await notificationService.deleteNotification('notif_del', 'usr_me');
      expect(result.success).toBe(true);
      expect(mockIdEq).toHaveBeenCalledWith('id', 'notif_del');
      expect(mockUserEq).toHaveBeenCalledWith('user_id', 'usr_me');
    });
  });

  describe('Device Tokens (public.user_devices)', () => {
    it('registers hardware push token using upsert', async () => {
      const mockUpsert = jest.fn().mockResolvedValueOnce({ error: null });
      (supabase.from as jest.Mock).mockReturnValue({ upsert: mockUpsert });

      const result = await notificationService.registerDeviceToken(
        {
          deviceId: 'dev_android_123',
          platform: 'ANDROID',
          pushToken: 'ExponentPushToken[abc123xyz]',
        },
        'usr_me',
      );

      expect(result.success).toBe(true);
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          device_id: 'dev_android_123',
          user_id: 'usr_me',
          platform: 'ANDROID',
          push_token: 'ExponentPushToken[abc123xyz]',
        }),
        { onConflict: 'device_id' },
      );
    });

    it('unregisters device token upon logout', async () => {
      const mockUserEq = jest.fn().mockResolvedValueOnce({ error: null });
      const mockDevEq = jest.fn().mockReturnValue({ eq: mockUserEq });
      const mockDelete = jest.fn().mockReturnValue({ eq: mockDevEq });

      (supabase.from as jest.Mock).mockReturnValue({ delete: mockDelete });

      const result = await notificationService.unregisterDeviceToken('dev_android_123', 'usr_me');
      expect(result.success).toBe(true);
      expect(mockDevEq).toHaveBeenCalledWith('device_id', 'dev_android_123');
      expect(mockUserEq).toHaveBeenCalledWith('user_id', 'usr_me');
    });
  });

  describe('subscribeToUserNotifications', () => {
    it('subscribes to user-scoped Realtime channel and unmounts cleanly', async () => {
      const registeredHandlers: Record<string, (payload: unknown) => void> = {};

      const mockChannel = {
        on: jest.fn().mockImplementation((_event, filter, handler) => {
          registeredHandlers[filter.event] = handler;
          return mockChannel;
        }),
        subscribe: jest.fn().mockReturnThis(),
      };

      (supabase.channel as jest.Mock).mockReturnValue(mockChannel);

      const onInsert = jest.fn();
      const onUpdate = jest.fn();
      const onDelete = jest.fn();

      const unsubscribe = notificationService.subscribeToUserNotifications('usr_me', {
        onInsert,
        onUpdate,
        onDelete,
      });

      expect(supabase.channel).toHaveBeenCalledWith('user-notifications-usr_me');
      expect(mockChannel.on).toHaveBeenCalledWith(
        'postgres_changes',
        expect.objectContaining({
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: 'user_id=eq.usr_me',
        }),
        expect.any(Function),
      );

      // Mock fetchNotificationById for hydration
      jest.spyOn(notificationService, 'fetchNotificationById').mockResolvedValueOnce({
        id: 'notif_realtime_1',
        userId: 'usr_me',
        type: 'GROUP_EXPIRING',
        actorId: 'usr_owner',
        groupId: 'grp_123',
        payload: { group_name: 'Hackathon Sprint' },
        readAt: null,
        createdAt: '2026-09-23T14:45:00Z',
      });

      // Simulate Realtime INSERT
      await registeredHandlers['INSERT']!({
        new: { id: 'notif_realtime_1' },
      });

      expect(onInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'notif_realtime_1',
          type: 'GROUP_EXPIRING',
        }),
      );

      // Simulate Realtime DELETE
      registeredHandlers['DELETE']!({
        old: { id: 'notif_realtime_1' },
      });
      expect(onDelete).toHaveBeenCalledWith('notif_realtime_1');

      // Unsubscribe cleanup
      unsubscribe();
      expect(supabase.removeChannel).toHaveBeenCalledWith(mockChannel);
    });
  });
});
