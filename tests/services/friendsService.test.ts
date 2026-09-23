import { friendsService } from '../../src/features/friends/services/friendsService';
import { supabase } from '../../src/lib/supabase';

jest.mock('../../src/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn(),
  },
}));

describe('friendsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchFriends', () => {
    it('fetches and maps mutual friends correctly when user is user_low', async () => {
      const mockRows = [
        {
          id: 'friendship_1',
          created_at: '2026-09-22T00:00:00Z',
          user_low_id: 'user_a',
          user_high_id: 'user_b',
          user_low: {
            user_id: 'user_a',
            username: 'usera',
            display_name: 'User A',
            avatar_path: null,
            bio: null,
          },
          user_high: {
            user_id: 'user_b',
            username: 'userb',
            display_name: 'User B',
            avatar_path: 'b/avatar.jpg',
            bio: 'Hey there',
          },
        },
      ];

      const mockSelect = jest.fn().mockReturnValue({
        or: jest.fn().mockResolvedValueOnce({ data: mockRows, error: null }),
      });
      (supabase.from as jest.Mock).mockReturnValue({ select: mockSelect });

      const { friends, error } = await friendsService.fetchFriends('user_a');

      expect(error).toBeUndefined();
      expect(friends).toHaveLength(1);
      expect(friends[0]).toEqual({
        userId: 'user_b',
        username: 'userb',
        displayName: 'User B',
        avatarPath: 'b/avatar.jpg',
        bio: 'Hey there',
        friendshipId: 'friendship_1',
        friendsSince: '2026-09-22T00:00:00Z',
      });
    });

    it('fetches and maps mutual friends correctly when user is user_high', async () => {
      const mockRows = [
        {
          id: 'friendship_2',
          created_at: '2026-09-22T01:00:00Z',
          user_low_id: 'user_c',
          user_high_id: 'user_a',
          user_low: {
            user_id: 'user_c',
            username: 'userc',
            display_name: 'User C',
            avatar_path: null,
            bio: null,
          },
          user_high: {
            user_id: 'user_a',
            username: 'usera',
            display_name: 'User A',
            avatar_path: null,
            bio: null,
          },
        },
      ];

      const mockSelect = jest.fn().mockReturnValue({
        or: jest.fn().mockResolvedValueOnce({ data: mockRows, error: null }),
      });
      (supabase.from as jest.Mock).mockReturnValue({ select: mockSelect });

      const { friends } = await friendsService.fetchFriends('user_a');

      expect(friends).toHaveLength(1);
      expect(friends[0]?.userId).toBe('user_c');
    });

    it('handles query error gracefully', async () => {
      const mockSelect = jest.fn().mockReturnValue({
        or: jest.fn().mockResolvedValueOnce({ data: null, error: { message: 'Database error' } }),
      });
      (supabase.from as jest.Mock).mockReturnValue({ select: mockSelect });

      const { friends, error } = await friendsService.fetchFriends('user_a');
      expect(friends).toHaveLength(0);
      expect(error).toBe('Database error');
    });
  });

  describe('fetchIncomingRequests', () => {
    it('returns pending incoming requests with sender profiles', async () => {
      const mockRows = [
        {
          id: 'req_1',
          sender_id: 'user_sender',
          receiver_id: 'user_me',
          status: 'PENDING',
          created_at: '2026-09-22T02:00:00Z',
          responded_at: null,
          sender: {
            user_id: 'user_sender',
            username: 'sender_handle',
            display_name: 'Sender Name',
            avatar_path: null,
            bio: 'Sender bio',
          },
        },
      ];

      const mockOrder = jest.fn().mockResolvedValueOnce({ data: mockRows, error: null });
      const mockEqStatus = jest.fn().mockReturnValue({ order: mockOrder });
      const mockEqReceiver = jest.fn().mockReturnValue({ eq: mockEqStatus });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEqReceiver });
      (supabase.from as jest.Mock).mockReturnValue({ select: mockSelect });

      const { requests, error } = await friendsService.fetchIncomingRequests('user_me');

      expect(error).toBeUndefined();
      expect(requests).toHaveLength(1);
      expect(requests[0]?.id).toBe('req_1');
      expect(requests[0]?.profile.username).toBe('sender_handle');
    });
  });

  describe('sendFriendRequest', () => {
    it('rejects sending request to oneself', async () => {
      const result = await friendsService.sendFriendRequest('user_1', 'user_1');
      expect(result.success).toBe(false);
      expect(result.error).toBe('You cannot send a friend request to yourself.');
    });

    it('rejects sending if users are blocked', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValueOnce({ data: true, error: null });

      const result = await friendsService.sendFriendRequest('user_1', 'user_2');

      expect(supabase.rpc).toHaveBeenCalledWith('is_blocked', {
        p_user_a: 'user_1',
        p_user_b: 'user_2',
      });
      expect(result.success).toBe(false);
      expect(result.error).toBe('Unable to send request to this user.');
    });

    it('rejects sending if already mutual friends', async () => {
      // is_blocked -> false
      (supabase.rpc as jest.Mock).mockResolvedValueOnce({ data: false, error: null });
      // are_friends -> true
      (supabase.rpc as jest.Mock).mockResolvedValueOnce({ data: true, error: null });

      const result = await friendsService.sendFriendRequest('user_1', 'user_2');

      expect(result.success).toBe(false);
      expect(result.error).toBe('You are already mutual friends.');
    });

    it('rejects sending if pending request already sent by current user', async () => {
      // is_blocked -> false
      (supabase.rpc as jest.Mock).mockResolvedValueOnce({ data: false, error: null });
      // are_friends -> false
      (supabase.rpc as jest.Mock).mockResolvedValueOnce({ data: false, error: null });

      const mockMaybeSingle = jest.fn().mockResolvedValueOnce({
        data: { id: 'req_existing', sender_id: 'user_1', receiver_id: 'user_2' },
        error: null,
      });
      const mockOr = jest.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
      const mockEq = jest.fn().mockReturnValue({ or: mockOr });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });
      (supabase.from as jest.Mock).mockReturnValue({ select: mockSelect });

      const result = await friendsService.sendFriendRequest('user_1', 'user_2');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Friend request already sent.');
    });

    it('inserts pending friend request successfully', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValueOnce({ data: false, error: null });
      (supabase.rpc as jest.Mock).mockResolvedValueOnce({ data: false, error: null });

      // No existing request
      const mockMaybeSingle = jest.fn().mockResolvedValueOnce({ data: null, error: null });
      const mockOr = jest.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
      const mockEq = jest.fn().mockReturnValue({ or: mockOr });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });
      const mockInsert = jest.fn().mockResolvedValueOnce({ error: null });

      (supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'friend_requests') {
          return { select: mockSelect, insert: mockInsert };
        }
        return {};
      });

      const result = await friendsService.sendFriendRequest('user_1', 'user_2');

      expect(mockInsert).toHaveBeenCalledWith({
        sender_id: 'user_1',
        receiver_id: 'user_2',
        status: 'PENDING',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('respondToFriendRequest', () => {
    it('calls atomic respond_to_friend_request RPC', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValueOnce({ error: null });

      const result = await friendsService.respondToFriendRequest('req_123', true);

      expect(supabase.rpc).toHaveBeenCalledWith('respond_to_friend_request', {
        p_request_id: 'req_123',
        p_accept: true,
      });
      expect(result.success).toBe(true);
    });

    it('handles RPC error', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValueOnce({
        error: { message: 'Friend request not found' },
      });

      const result = await friendsService.respondToFriendRequest('req_123', false);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Friend request not found');
    });
  });

  describe('removeFriend', () => {
    it('sorts canonical user pair and deletes friendship record', async () => {
      const mockEqHigh = jest.fn().mockResolvedValueOnce({ error: null });
      const mockEqLow = jest.fn().mockReturnValue({ eq: mockEqHigh });
      const mockDelete = jest.fn().mockReturnValue({ eq: mockEqLow });
      (supabase.from as jest.Mock).mockReturnValue({ delete: mockDelete });

      const result = await friendsService.removeFriend('user_z', 'user_a');

      // user_a < user_z so low='user_a', high='user_z'
      expect(mockEqLow).toHaveBeenCalledWith('user_low_id', 'user_a');
      expect(mockEqHigh).toHaveBeenCalledWith('user_high_id', 'user_z');
      expect(result.success).toBe(true);
    });
  });

  describe('getRelationshipStatus', () => {
    it('returns SELF if target is current user', async () => {
      const status = await friendsService.getRelationshipStatus('user_1', 'user_1');
      expect(status).toBe('SELF');
      expect(supabase.rpc).not.toHaveBeenCalled();
    });

    it('returns BLOCKED if user is blocked', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValueOnce({ data: true });

      const status = await friendsService.getRelationshipStatus('user_1', 'user_2');
      expect(status).toBe('BLOCKED');
    });

    it('returns FRIENDS if mutual friends', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValueOnce({ data: false }); // not blocked
      (supabase.rpc as jest.Mock).mockResolvedValueOnce({ data: true }); // are friends

      const status = await friendsService.getRelationshipStatus('user_1', 'user_2');
      expect(status).toBe('FRIENDS');
    });

    it('returns REQUEST_SENT if outgoing pending request exists', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValueOnce({ data: false });
      (supabase.rpc as jest.Mock).mockResolvedValueOnce({ data: false });

      const mockMaybeSingle = jest.fn().mockResolvedValueOnce({
        data: { id: 'req_1', sender_id: 'user_1', receiver_id: 'user_2' },
      });
      const mockOr = jest.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
      const mockEq = jest.fn().mockReturnValue({ or: mockOr });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });
      (supabase.from as jest.Mock).mockReturnValue({ select: mockSelect });

      const status = await friendsService.getRelationshipStatus('user_1', 'user_2');
      expect(status).toBe('REQUEST_SENT');
    });

    it('returns NONE if no relation exists', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValueOnce({ data: false });
      (supabase.rpc as jest.Mock).mockResolvedValueOnce({ data: false });

      const mockMaybeSingle = jest.fn().mockResolvedValueOnce({ data: null });
      const mockOr = jest.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
      const mockEq = jest.fn().mockReturnValue({ or: mockOr });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });
      (supabase.from as jest.Mock).mockReturnValue({ select: mockSelect });

      const status = await friendsService.getRelationshipStatus('user_1', 'user_2');
      expect(status).toBe('NONE');
    });
  });
});
