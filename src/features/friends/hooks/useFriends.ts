import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../hooks/useAuth';
import { friendsService } from '../services/friendsService';
import type {
  FriendProfile,
  FriendRequest,
  BlockedUser,
} from '../../../types/friends';

export interface UseFriendsValue {
  friends: FriendProfile[];
  incomingRequests: FriendRequest[];
  outgoingRequests: FriendRequest[];
  blockedUsers: BlockedUser[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  sendRequest: (targetUserId: string) => Promise<{ success: boolean; error?: string }>;
  acceptRequest: (requestId: string) => Promise<{ success: boolean; error?: string }>;
  declineRequest: (requestId: string) => Promise<{ success: boolean; error?: string }>;
  cancelRequest: (requestId: string) => Promise<{ success: boolean; error?: string }>;
  unfriend: (friendId: string) => Promise<{ success: boolean; error?: string }>;
  block: (targetUserId: string) => Promise<{ success: boolean; error?: string }>;
  unblock: (targetUserId: string) => Promise<{ success: boolean; error?: string }>;
}

export function useFriends(): UseFriendsValue {
  const { user } = useAuth();
  const [friends, setFriends] = useState<FriendProfile[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<FriendRequest[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const isMountedRef = useRef<boolean>(true);

  const loadAllSocialData = useCallback(
    async (isManualRefresh = false) => {
      if (!user) {
        setFriends([]);
        setIncomingRequests([]);
        setOutgoingRequests([]);
        setBlockedUsers([]);
        setIsLoading(false);
        return;
      }

      if (isManualRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      try {
        const [friendsRes, incomingRes, outgoingRes, blockedRes] = await Promise.all([
          friendsService.fetchFriends(user.id),
          friendsService.fetchIncomingRequests(user.id),
          friendsService.fetchOutgoingRequests(user.id),
          friendsService.fetchBlockedUsers(user.id),
        ]);

        if (!isMountedRef.current) return;

        if (friendsRes.error) setError(friendsRes.error);
        else setFriends(friendsRes.friends);

        if (incomingRes.error && !friendsRes.error) setError(incomingRes.error);
        else setIncomingRequests(incomingRes.requests);

        if (outgoingRes.error && !friendsRes.error && !incomingRes.error)
          setError(outgoingRes.error);
        else setOutgoingRequests(outgoingRes.requests);

        if (blockedRes.error && !friendsRes.error) setError(blockedRes.error);
        else setBlockedUsers(blockedRes.blocked);
      } catch (err) {
        if (isMountedRef.current) {
          const msg = err instanceof Error ? err.message : 'Error loading social connections';
          setError(msg);
        }
      } finally {
        if (isMountedRef.current) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    },
    [user],
  );

  useEffect(() => {
    isMountedRef.current = true;
    loadAllSocialData(false);

    if (!user) {
      return () => {
        isMountedRef.current = false;
      };
    }

    // Set up Realtime listener on social graph changes
    const channelName = `social_graph_${user.id}_${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'friend_requests',
          filter: `receiver_id=eq.${user.id}`,
        },
        () => {
          loadAllSocialData(false);
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'friend_requests',
          filter: `sender_id=eq.${user.id}`,
        },
        () => {
          loadAllSocialData(false);
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'friendships',
          filter: `user_low_id=eq.${user.id}`,
        },
        () => {
          loadAllSocialData(false);
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'friendships',
          filter: `user_high_id=eq.${user.id}`,
        },
        () => {
          loadAllSocialData(false);
        },
      )
      .subscribe();

    return () => {
      isMountedRef.current = false;
      supabase.removeChannel(channel);
    };
  }, [user, loadAllSocialData]);

  const refresh = useCallback(async () => {
    await loadAllSocialData(true);
  }, [loadAllSocialData]);

  const sendRequest = useCallback(
    async (targetUserId: string): Promise<{ success: boolean; error?: string }> => {
      if (!user) return { success: false, error: 'Not authenticated' };
      const res = await friendsService.sendFriendRequest(user.id, targetUserId);
      if (res.success) {
        await loadAllSocialData(false);
      }
      return res;
    },
    [user, loadAllSocialData],
  );

  const acceptRequest = useCallback(
    async (requestId: string): Promise<{ success: boolean; error?: string }> => {
      const res = await friendsService.respondToFriendRequest(requestId, true);
      if (res.success) {
        await loadAllSocialData(false);
      }
      return res;
    },
    [loadAllSocialData],
  );

  const declineRequest = useCallback(
    async (requestId: string): Promise<{ success: boolean; error?: string }> => {
      const res = await friendsService.respondToFriendRequest(requestId, false);
      if (res.success) {
        await loadAllSocialData(false);
      }
      return res;
    },
    [loadAllSocialData],
  );

  const cancelRequest = useCallback(
    async (requestId: string): Promise<{ success: boolean; error?: string }> => {
      if (!user) return { success: false, error: 'Not authenticated' };
      const res = await friendsService.cancelFriendRequest(requestId, user.id);
      if (res.success) {
        await loadAllSocialData(false);
      }
      return res;
    },
    [user, loadAllSocialData],
  );

  const unfriend = useCallback(
    async (friendId: string): Promise<{ success: boolean; error?: string }> => {
      if (!user) return { success: false, error: 'Not authenticated' };
      const res = await friendsService.removeFriend(user.id, friendId);
      if (res.success) {
        await loadAllSocialData(false);
      }
      return res;
    },
    [user, loadAllSocialData],
  );

  const block = useCallback(
    async (targetUserId: string): Promise<{ success: boolean; error?: string }> => {
      if (!user) return { success: false, error: 'Not authenticated' };
      const res = await friendsService.blockUser(user.id, targetUserId);
      if (res.success) {
        await loadAllSocialData(false);
      }
      return res;
    },
    [user, loadAllSocialData],
  );

  const unblock = useCallback(
    async (targetUserId: string): Promise<{ success: boolean; error?: string }> => {
      if (!user) return { success: false, error: 'Not authenticated' };
      const res = await friendsService.unblockUser(user.id, targetUserId);
      if (res.success) {
        await loadAllSocialData(false);
      }
      return res;
    },
    [user, loadAllSocialData],
  );

  return {
    friends,
    incomingRequests,
    outgoingRequests,
    blockedUsers,
    isLoading,
    isRefreshing,
    error,
    refresh,
    sendRequest,
    acceptRequest,
    declineRequest,
    cancelRequest,
    unfriend,
    block,
    unblock,
  };
}

export default useFriends;
