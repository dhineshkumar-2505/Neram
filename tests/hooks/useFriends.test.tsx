import * as React from 'react';
void React;
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useFriends } from '../../src/features/friends/hooks/useFriends';
import { friendsService } from '../../src/features/friends/services/friendsService';
import * as authHook from '../../src/hooks/useAuth';
import { supabase } from '../../src/lib/supabase';

jest.mock('../../src/hooks/useAuth');
jest.mock('../../src/features/friends/services/friendsService');
jest.mock('../../src/lib/supabase', () => ({
  supabase: {
    channel: jest.fn(() => ({
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn().mockReturnThis(),
    })),
    removeChannel: jest.fn(),
  },
}));

describe('useFriends hook', () => {
  const mockUser = { id: 'user_current_uuid' };

  const mockFriends = [
    {
      userId: 'friend_1',
      username: 'friendone',
      displayName: 'Friend One',
      avatarPath: null,
      bio: 'Bio 1',
      friendshipId: 'f_1',
      friendsSince: '2026-09-22T00:00:00Z',
    },
  ];

  const mockIncoming = [
    {
      id: 'req_inc_1',
      senderId: 'user_sender',
      receiverId: 'user_current_uuid',
      status: 'PENDING' as const,
      createdAt: '2026-09-22T00:00:00Z',
      respondedAt: null,
      profile: {
        userId: 'user_sender',
        username: 'senderone',
        displayName: 'Sender One',
        avatarPath: null,
        bio: null,
      },
    },
  ];

  const mockOutgoing = [
    {
      id: 'req_out_1',
      senderId: 'user_current_uuid',
      receiverId: 'user_recv',
      status: 'PENDING' as const,
      createdAt: '2026-09-22T00:00:00Z',
      respondedAt: null,
      profile: {
        userId: 'user_recv',
        username: 'recvone',
        displayName: 'Receiver One',
        avatarPath: null,
        bio: null,
      },
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (authHook.useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
    });

    (friendsService.fetchFriends as jest.Mock).mockResolvedValue({
      friends: mockFriends,
    });
    (friendsService.fetchIncomingRequests as jest.Mock).mockResolvedValue({
      requests: mockIncoming,
    });
    (friendsService.fetchOutgoingRequests as jest.Mock).mockResolvedValue({
      requests: mockOutgoing,
    });
    (friendsService.fetchBlockedUsers as jest.Mock).mockResolvedValue({
      blocked: [],
    });
  });

  it('fetches all social data and initializes realtime channel on mount', async () => {
    const { result } = renderHook(() => useFriends());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.friends).toEqual(mockFriends);
      expect(result.current.incomingRequests).toEqual(mockIncoming);
      expect(result.current.outgoingRequests).toEqual(mockOutgoing);
    });

    expect(supabase.channel).toHaveBeenCalled();
  });

  it('accepts incoming request and refreshes data', async () => {
    (friendsService.respondToFriendRequest as jest.Mock).mockResolvedValueOnce({
      success: true,
    });

    const { result } = renderHook(() => useFriends());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      const res = await result.current.acceptRequest('req_inc_1');
      expect(res.success).toBe(true);
    });

    expect(friendsService.respondToFriendRequest).toHaveBeenCalledWith('req_inc_1', true);
    expect(friendsService.fetchFriends).toHaveBeenCalledTimes(2);
  });

  it('declines incoming request and refreshes data', async () => {
    (friendsService.respondToFriendRequest as jest.Mock).mockResolvedValueOnce({
      success: true,
    });

    const { result } = renderHook(() => useFriends());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      const res = await result.current.declineRequest('req_inc_1');
      expect(res.success).toBe(true);
    });

    expect(friendsService.respondToFriendRequest).toHaveBeenCalledWith('req_inc_1', false);
  });

  it('unfriends connection and refreshes data', async () => {
    (friendsService.removeFriend as jest.Mock).mockResolvedValueOnce({
      success: true,
    });

    const { result } = renderHook(() => useFriends());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      const res = await result.current.unfriend('friend_1');
      expect(res.success).toBe(true);
    });

    expect(friendsService.removeFriend).toHaveBeenCalledWith('user_current_uuid', 'friend_1');
  });
});
