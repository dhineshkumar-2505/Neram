import { chatService } from '../../src/features/chat/services/chatService';
import { supabase } from '../../src/lib/supabase';

jest.mock('../../src/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    channel: jest.fn(),
    removeChannel: jest.fn(),
  },
}));

describe('chatService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('sendMessage', () => {
    it('rejects empty message body with validation error', async () => {
      const result = await chatService.sendMessage({
        groupId: 'grp_123',
        senderId: 'usr_abc',
        body: '',
        tempId: 'temp_1',
      });

      expect(result.error).toBe('Message cannot be empty.');
      expect(result.message).toBeNull();
      expect(result.tempId).toBe('temp_1');
      expect(supabase.from).not.toHaveBeenCalled();
    });

    it('rejects whitespace-only message body', async () => {
      const result = await chatService.sendMessage({
        groupId: 'grp_123',
        senderId: 'usr_abc',
        body: '    \n\t  ',
      });

      expect(result.error).toBe('Message cannot be empty.');
      expect(result.message).toBeNull();
    });

    it('rejects message body exceeding 4000 characters (chk_message_body)', async () => {
      const longBody = 'A'.repeat(4001);
      const result = await chatService.sendMessage({
        groupId: 'grp_123',
        senderId: 'usr_abc',
        body: longBody,
      });

      expect(result.error).toBe('Message cannot exceed 4000 characters.');
      expect(result.message).toBeNull();
    });

    it('successfully sends message and returns formatted ChatMessage', async () => {
      const rawDbRow = {
        id: 'msg_999',
        group_id: 'grp_123',
        sender_id: 'usr_abc',
        body: 'Meet at the north entrance',
        reply_to_id: null,
        created_at: '2026-09-23T14:30:00Z',
        edited_at: null,
        deleted_at: null,
        sender: {
          user_id: 'usr_abc',
          username: 'alex_r',
          display_name: 'Alex Rivera',
          avatar_url: 'https://example.com/avatar.jpg',
        },
        reply_to: null,
      };

      const mockSingle = jest.fn().mockResolvedValueOnce({
        data: rawDbRow,
        error: null,
      });
      const mockSelect = jest.fn().mockReturnValue({ single: mockSingle });
      const mockInsert = jest.fn().mockReturnValue({ select: mockSelect });

      (supabase.from as jest.Mock).mockReturnValue({
        insert: mockInsert,
      });

      const result = await chatService.sendMessage({
        groupId: 'grp_123',
        senderId: 'usr_abc',
        body: '  Meet at the north entrance  ',
        tempId: 'temp_msg_1',
      });

      expect(result.error).toBeUndefined();
      expect(result.tempId).toBe('temp_msg_1');
      expect(result.message).toEqual({
        id: 'msg_999',
        groupId: 'grp_123',
        senderId: 'usr_abc',
        body: 'Meet at the north entrance',
        replyToId: null,
        createdAt: '2026-09-23T14:30:00Z',
        editedAt: null,
        deletedAt: null,
        sender: {
          userId: 'usr_abc',
          username: 'alex_r',
          displayName: 'Alex Rivera',
          avatarUrl: 'https://example.com/avatar.jpg',
        },
        replyTo: null,
        status: 'SENT',
      });

      // Verify trimmed body passed to insert
      expect(mockInsert).toHaveBeenCalledWith({
        group_id: 'grp_123',
        sender_id: 'usr_abc',
        body: 'Meet at the north entrance',
        reply_to_id: null,
      });
    });

    it('handles threaded reply message', async () => {
      const rawDbRow = {
        id: 'msg_1000',
        group_id: 'grp_123',
        sender_id: 'usr_def',
        body: 'Sounds good, heading there now',
        reply_to_id: 'msg_999',
        created_at: '2026-09-23T14:31:00Z',
        edited_at: null,
        deleted_at: null,
        sender: {
          user_id: 'usr_def',
          username: 'priya_k',
          display_name: 'Priya Kumar',
          avatar_url: null,
        },
        reply_to: {
          id: 'msg_999',
          sender_id: 'usr_abc',
          body: 'Meet at the north entrance',
          sender: {
            display_name: 'Alex Rivera',
            username: 'alex_r',
          },
        },
      };

      const mockSingle = jest.fn().mockResolvedValueOnce({
        data: rawDbRow,
        error: null,
      });
      const mockSelect = jest.fn().mockReturnValue({ single: mockSingle });
      const mockInsert = jest.fn().mockReturnValue({ select: mockSelect });

      (supabase.from as jest.Mock).mockReturnValue({
        insert: mockInsert,
      });

      const result = await chatService.sendMessage({
        groupId: 'grp_123',
        senderId: 'usr_def',
        body: 'Sounds good, heading there now',
        replyToId: 'msg_999',
      });

      expect(result.error).toBeUndefined();
      expect(result.message?.replyTo).toEqual({
        id: 'msg_999',
        senderId: 'usr_abc',
        body: 'Meet at the north entrance',
        senderName: 'Alex Rivera',
        senderUsername: 'alex_r',
      });
    });

    it('translates RLS policy violations into user-friendly expiry/permission message', async () => {
      const mockSingle = jest.fn().mockResolvedValueOnce({
        data: null,
        error: {
          code: '42501',
          message: 'new row violates row-level security policy for table "messages"',
        },
      });
      const mockSelect = jest.fn().mockReturnValue({ single: mockSingle });
      const mockInsert = jest.fn().mockReturnValue({ select: mockSelect });

      (supabase.from as jest.Mock).mockReturnValue({
        insert: mockInsert,
      });

      const result = await chatService.sendMessage({
        groupId: 'grp_expired',
        senderId: 'usr_abc',
        body: 'Are we still meeting?',
      });

      expect(result.message).toBeNull();
      expect(result.error).toBe(
        'Cannot send message. This temporary space may have expired or chat is disabled.',
      );
    });
  });

  describe('fetchMessages', () => {
    it('fetches paginated messages ordered newest to oldest', async () => {
      const mockRows = [
        {
          id: 'msg_2',
          group_id: 'grp_123',
          sender_id: 'usr_abc',
          body: 'Second message',
          reply_to_id: null,
          created_at: '2026-09-23T14:32:00Z',
          edited_at: null,
          deleted_at: null,
          sender: {
            user_id: 'usr_abc',
            username: 'alex_r',
            display_name: 'Alex Rivera',
            avatar_url: null,
          },
          reply_to: null,
        },
        {
          id: 'msg_1',
          group_id: 'grp_123',
          sender_id: 'usr_def',
          body: 'First message',
          reply_to_id: null,
          created_at: '2026-09-23T14:30:00Z',
          edited_at: null,
          deleted_at: null,
          sender: {
            user_id: 'usr_def',
            username: 'priya_k',
            display_name: 'Priya Kumar',
            avatar_url: null,
          },
          reply_to: null,
        },
      ];

      const mockLimit = jest.fn().mockResolvedValueOnce({
        data: mockRows,
        error: null,
      });
      const mockOrder = jest.fn().mockReturnValue({ limit: mockLimit });
      const mockIs = jest.fn().mockReturnValue({ order: mockOrder });
      const mockEq = jest.fn().mockReturnValue({ is: mockIs });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });

      (supabase.from as jest.Mock).mockReturnValue({
        select: mockSelect,
      });

      const result = await chatService.fetchMessages({
        groupId: 'grp_123',
        limit: 10,
      });

      expect(result.error).toBeUndefined();
      expect(result.hasMore).toBe(false);
      expect(result.messages).toHaveLength(2);
      expect(result.messages[0]?.id).toBe('msg_2');
      expect(result.messages[1]?.id).toBe('msg_1');

      expect(mockEq).toHaveBeenCalledWith('group_id', 'grp_123');
      expect(mockIs).toHaveBeenCalledWith('deleted_at', null);
      expect(mockOrder).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(mockLimit).toHaveBeenCalledWith(11);
    });

    it('supports cursor pagination using beforeCreatedAt', async () => {
      const mockLimit = jest.fn().mockResolvedValueOnce({
        data: [],
        error: null,
      });
      const mockOrder = jest.fn().mockReturnValue({ limit: mockLimit });
      const mockLt = jest.fn().mockReturnValue({ order: mockOrder });
      const mockIs = jest.fn().mockReturnValue({ lt: mockLt });
      const mockEq = jest.fn().mockReturnValue({ is: mockIs });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });

      (supabase.from as jest.Mock).mockReturnValue({
        select: mockSelect,
      });

      const result = await chatService.fetchMessages({
        groupId: 'grp_123',
        limit: 20,
        beforeCreatedAt: '2026-09-23T14:30:00Z',
      });

      expect(result.error).toBeUndefined();
      expect(mockLt).toHaveBeenCalledWith('created_at', '2026-09-23T14:30:00Z');
    });

    it('returns error when database query fails', async () => {
      const mockLimit = jest.fn().mockResolvedValueOnce({
        data: null,
        error: { message: 'Database connection failed' },
      });
      const mockOrder = jest.fn().mockReturnValue({ limit: mockLimit });
      const mockIs = jest.fn().mockReturnValue({ order: mockOrder });
      const mockEq = jest.fn().mockReturnValue({ is: mockIs });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });

      (supabase.from as jest.Mock).mockReturnValue({
        select: mockSelect,
      });

      const result = await chatService.fetchMessages({ groupId: 'grp_123' });

      expect(result.messages).toEqual([]);
      expect(result.hasMore).toBe(false);
      expect(result.error).toBe('Database connection failed');
    });
  });

  describe('fetchMessageById', () => {
    it('returns formatted message when found', async () => {
      const rawDbRow = {
        id: 'msg_single',
        group_id: 'grp_123',
        sender_id: 'usr_abc',
        body: 'Single test message',
        reply_to_id: null,
        created_at: '2026-09-23T14:00:00Z',
        edited_at: null,
        deleted_at: null,
        sender: null,
        reply_to: null,
      };

      const mockSingle = jest.fn().mockResolvedValueOnce({
        data: rawDbRow,
        error: null,
      });
      const mockEq = jest.fn().mockReturnValue({ single: mockSingle });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });

      (supabase.from as jest.Mock).mockReturnValue({
        select: mockSelect,
      });

      const message = await chatService.fetchMessageById('msg_single');
      expect(message).not.toBeNull();
      expect(message?.id).toBe('msg_single');
      expect(message?.body).toBe('Single test message');
    });

    it('returns null when message is not found or query errors', async () => {
      const mockSingle = jest.fn().mockResolvedValueOnce({
        data: null,
        error: { message: 'Not found' },
      });
      const mockEq = jest.fn().mockReturnValue({ single: mockSingle });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });

      (supabase.from as jest.Mock).mockReturnValue({
        select: mockSelect,
      });

      const message = await chatService.fetchMessageById('msg_missing');
      expect(message).toBeNull();
    });
  });

  describe('softDeleteMessage', () => {
    it('updates deleted_at timestamp successfully', async () => {
      const mockEq = jest.fn().mockResolvedValueOnce({ error: null });
      const mockUpdate = jest.fn().mockReturnValue({ eq: mockEq });

      (supabase.from as jest.Mock).mockReturnValue({
        update: mockUpdate,
      });

      const result = await chatService.softDeleteMessage('msg_del');
      expect(result.success).toBe(true);
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          deleted_at: expect.any(String),
        }),
      );
      expect(mockEq).toHaveBeenCalledWith('id', 'msg_del');
    });

    it('returns error when deletion fails', async () => {
      const mockEq = jest.fn().mockResolvedValueOnce({
        error: { message: 'Permission denied' },
      });
      const mockUpdate = jest.fn().mockReturnValue({ eq: mockEq });

      (supabase.from as jest.Mock).mockReturnValue({
        update: mockUpdate,
      });

      const result = await chatService.softDeleteMessage('msg_del');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Permission denied');
    });
  });

  describe('subscribeToGroupMessages', () => {
    it('sets up Realtime channels for INSERT, UPDATE, DELETE and unsubscribes cleanly', async () => {
      const registeredHandlers: Record<string, (payload: unknown) => void> = {};

      const mockChannel = {
        on: jest.fn().mockImplementation((_type, filter, handler) => {
          registeredHandlers[filter.event] = handler;
          return mockChannel;
        }),
        subscribe: jest.fn().mockReturnThis(),
      };

      (supabase.channel as jest.Mock).mockReturnValue(mockChannel);

      const onInsert = jest.fn();
      const onUpdate = jest.fn();
      const onDelete = jest.fn();

      const unsubscribe = chatService.subscribeToGroupMessages('grp_live', {
        onInsert,
        onUpdate,
        onDelete,
      });

      expect(supabase.channel).toHaveBeenCalledWith('group-chat-grp_live');
      expect(mockChannel.on).toHaveBeenCalledWith(
        'postgres_changes',
        expect.objectContaining({
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: 'group_id=eq.grp_live',
        }),
        expect.any(Function),
      );
      expect(mockChannel.on).toHaveBeenCalledWith(
        'postgres_changes',
        expect.objectContaining({
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: 'group_id=eq.grp_live',
        }),
        expect.any(Function),
      );
      expect(mockChannel.on).toHaveBeenCalledWith(
        'postgres_changes',
        expect.objectContaining({
          event: 'DELETE',
          schema: 'public',
          table: 'messages',
          filter: 'group_id=eq.grp_live',
        }),
        expect.any(Function),
      );
      expect(mockChannel.subscribe).toHaveBeenCalled();

      // Mock fetchMessageById for INSERT hydration
      jest.spyOn(chatService, 'fetchMessageById').mockResolvedValueOnce({
        id: 'msg_live_1',
        groupId: 'grp_live',
        senderId: 'usr_live',
        body: 'Hello realtime world',
        replyToId: null,
        createdAt: '2026-09-23T14:40:00Z',
        editedAt: null,
        deletedAt: null,
        status: 'SENT',
      });

      // Simulate Realtime INSERT
      await registeredHandlers['INSERT']!({
        new: {
          id: 'msg_live_1',
          group_id: 'grp_live',
          sender_id: 'usr_live',
          body: 'Hello realtime world',
          reply_to_id: null,
          created_at: '2026-09-23T14:40:00Z',
          edited_at: null,
          deleted_at: null,
        },
      });

      expect(onInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'msg_live_1',
          body: 'Hello realtime world',
        }),
      );

      // Simulate Realtime UPDATE that soft-deletes a message
      await registeredHandlers['UPDATE']!({
        new: {
          id: 'msg_live_1',
          deleted_at: '2026-09-23T14:45:00Z',
        },
      });

      expect(onDelete).toHaveBeenCalledWith('msg_live_1');

      // Simulate Realtime DELETE
      registeredHandlers['DELETE']!({
        old: { id: 'msg_hard_deleted' },
      });

      expect(onDelete).toHaveBeenCalledWith('msg_hard_deleted');

      // Cleanup
      unsubscribe();
      expect(supabase.removeChannel).toHaveBeenCalledWith(mockChannel);
    });
  });
});
