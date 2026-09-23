import { supabase } from '../../../lib/supabase';
import type {
  FriendProfile,
  FriendRequest,
  BlockedUser,
  RelationshipStatus,
} from '../../../types/friends';

interface RawFriendProfileRecord {
  user_id: string;
  username: string;
  display_name: string;
  avatar_path: string | null;
  bio: string | null;
}

interface RawFriendshipRow {
  id: string;
  created_at: string;
  user_low_id: string;
  user_high_id: string;
  user_low: RawFriendProfileRecord | null;
  user_high: RawFriendProfileRecord | null;
}

interface RawFriendRequestRow {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CANCELLED';
  created_at: string;
  responded_at: string | null;
  sender?: RawFriendProfileRecord | null;
  receiver?: RawFriendProfileRecord | null;
}

interface RawBlockRow {
  id: string;
  blocked_id: string;
  created_at: string;
  blocked: RawFriendProfileRecord | null;
}

/**
 * Social Graph Service for Neram.
 * Handles friendships, requests, blocking, and relationship states.
 */
export const friendsService = {
  /**
   * Fetches all mutual friends for the given user.
   */
  async fetchFriends(
    userId: string,
  ): Promise<{ friends: FriendProfile[]; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('friendships')
        .select(`
          id,
          created_at,
          user_low_id,
          user_high_id,
          user_low:profiles!friendships_user_low_id_fkey(user_id, username, display_name, avatar_path, bio),
          user_high:profiles!friendships_user_high_id_fkey(user_id, username, display_name, avatar_path, bio)
        `)
        .or(`user_low_id.eq.${userId},user_high_id.eq.${userId}`);

      if (error) {
        return { friends: [], error: error.message };
      }

      const rows = (data || []) as unknown as RawFriendshipRow[];
      const friends: FriendProfile[] = [];

      for (const row of rows) {
        const isLow = row.user_low_id === userId;
        const otherProfile = isLow ? row.user_high : row.user_low;

        if (otherProfile) {
          friends.push({
            userId: otherProfile.user_id,
            username: otherProfile.username,
            displayName: otherProfile.display_name,
            avatarPath: otherProfile.avatar_path,
            bio: otherProfile.bio,
            friendshipId: row.id,
            friendsSince: row.created_at,
          });
        }
      }

      // Sort alphabetically by display name
      friends.sort((a, b) => a.displayName.localeCompare(b.displayName));
      return { friends };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error fetching friends.';
      return { friends: [], error: msg };
    }
  },

  /**
   * Fetches pending incoming friend requests for the current user.
   */
  async fetchIncomingRequests(
    userId: string,
  ): Promise<{ requests: FriendRequest[]; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('friend_requests')
        .select(`
          id,
          sender_id,
          receiver_id,
          status,
          created_at,
          responded_at,
          sender:profiles!friend_requests_sender_id_fkey(user_id, username, display_name, avatar_path, bio)
        `)
        .eq('receiver_id', userId)
        .eq('status', 'PENDING')
        .order('created_at', { ascending: false });

      if (error) {
        return { requests: [], error: error.message };
      }

      const rows = (data || []) as unknown as RawFriendRequestRow[];
      const requests: FriendRequest[] = rows
        .filter((r) => r.sender != null)
        .map((r) => ({
          id: r.id,
          senderId: r.sender_id,
          receiverId: r.receiver_id,
          status: r.status,
          createdAt: r.created_at,
          respondedAt: r.responded_at,
          profile: {
            userId: r.sender!.user_id,
            username: r.sender!.username,
            displayName: r.sender!.display_name,
            avatarPath: r.sender!.avatar_path,
            bio: r.sender!.bio,
          },
        }));

      return { requests };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error fetching incoming requests.';
      return { requests: [], error: msg };
    }
  },

  /**
   * Fetches pending outgoing friend requests sent by the current user.
   */
  async fetchOutgoingRequests(
    userId: string,
  ): Promise<{ requests: FriendRequest[]; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('friend_requests')
        .select(`
          id,
          sender_id,
          receiver_id,
          status,
          created_at,
          responded_at,
          receiver:profiles!friend_requests_receiver_id_fkey(user_id, username, display_name, avatar_path, bio)
        `)
        .eq('sender_id', userId)
        .eq('status', 'PENDING')
        .order('created_at', { ascending: false });

      if (error) {
        return { requests: [], error: error.message };
      }

      const rows = (data || []) as unknown as RawFriendRequestRow[];
      const requests: FriendRequest[] = rows
        .filter((r) => r.receiver != null)
        .map((r) => ({
          id: r.id,
          senderId: r.sender_id,
          receiverId: r.receiver_id,
          status: r.status,
          createdAt: r.created_at,
          respondedAt: r.responded_at,
          profile: {
            userId: r.receiver!.user_id,
            username: r.receiver!.username,
            displayName: r.receiver!.display_name,
            avatarPath: r.receiver!.avatar_path,
            bio: r.receiver!.bio,
          },
        }));

      return { requests };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error fetching outgoing requests.';
      return { requests: [], error: msg };
    }
  },

  /**
   * Sends a friend request to a target user.
   * Performs client validation and respects RLS constraints.
   */
  async sendFriendRequest(
    senderId: string,
    receiverId: string,
  ): Promise<{ success: boolean; error?: string }> {
    if (senderId === receiverId) {
      return { success: false, error: 'You cannot send a friend request to yourself.' };
    }

    try {
      // 1. Check if blocked
      const { data: isBlocked, error: blockErr } = await supabase.rpc('is_blocked', {
        p_user_a: senderId,
        p_user_b: receiverId,
      });

      if (blockErr) {
        return { success: false, error: blockErr.message };
      }

      if (isBlocked) {
        return { success: false, error: 'Unable to send request to this user.' };
      }

      // 2. Check if already friends
      const { data: areFriends, error: friendErr } = await supabase.rpc('are_friends', {
        p_user_a: senderId,
        p_user_b: receiverId,
      });

      if (friendErr) {
        return { success: false, error: friendErr.message };
      }

      if (areFriends) {
        return { success: false, error: 'You are already mutual friends.' };
      }

      // 3. Check for existing pending request in either direction
      const { data: existing, error: existingErr } = await supabase
        .from('friend_requests')
        .select('id, sender_id, receiver_id')
        .eq('status', 'PENDING')
        .or(
          `and(sender_id.eq.${senderId},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${senderId})`,
        )
        .maybeSingle();

      if (existingErr) {
        return { success: false, error: existingErr.message };
      }

      if (existing) {
        if (existing.sender_id === senderId) {
          return { success: false, error: 'Friend request already sent.' };
        } else {
          return {
            success: false,
            error: 'This user already sent you a friend request. Check your Requests tab.',
          };
        }
      }

      // 4. Insert new pending request
      const { error: insertErr } = await supabase.from('friend_requests').insert({
        sender_id: senderId,
        receiver_id: receiverId,
        status: 'PENDING',
      });

      if (insertErr) {
        return { success: false, error: insertErr.message };
      }

      return { success: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error sending friend request.';
      return { success: false, error: msg };
    }
  },

  /**
   * Responds to an incoming friend request (accept or decline)
   * using the atomic PostgreSQL RPC function `respond_to_friend_request`.
   */
  async respondToFriendRequest(
    requestId: string,
    accept: boolean,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase.rpc('respond_to_friend_request', {
        p_request_id: requestId,
        p_accept: accept,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error responding to request.';
      return { success: false, error: msg };
    }
  },

  /**
   * Cancels a pending outgoing friend request sent by the user.
   */
  async cancelFriendRequest(
    requestId: string,
    senderId: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('friend_requests')
        .update({ status: 'CANCELLED' })
        .eq('id', requestId)
        .eq('sender_id', senderId)
        .eq('status', 'PENDING');

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error cancelling request.';
      return { success: false, error: msg };
    }
  },

  /**
   * Removes an existing mutual friendship.
   */
  async removeFriend(
    userId: string,
    friendId: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const low = userId < friendId ? userId : friendId;
      const high = userId < friendId ? friendId : userId;

      const { error } = await supabase
        .from('friendships')
        .delete()
        .eq('user_low_id', low)
        .eq('user_high_id', high);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error removing friend.';
      return { success: false, error: msg };
    }
  },

  /**
   * Blocks a user. Also dissolves any mutual friendship and cancels pending requests.
   */
  async blockUser(
    blockerId: string,
    blockedId: string,
  ): Promise<{ success: boolean; error?: string }> {
    if (blockerId === blockedId) {
      return { success: false, error: 'You cannot block yourself.' };
    }

    try {
      // 1. Insert into blocks
      const { error: blockErr } = await supabase.from('blocks').insert({
        blocker_id: blockerId,
        blocked_id: blockedId,
      });

      if (blockErr && !blockErr.message.includes('duplicate')) {
        return { success: false, error: blockErr.message };
      }

      // 2. Remove friendship if exists
      await this.removeFriend(blockerId, blockedId);

      // 3. Cancel any pending requests in either direction
      await supabase
        .from('friend_requests')
        .update({ status: 'CANCELLED' })
        .eq('status', 'PENDING')
        .or(
          `and(sender_id.eq.${blockerId},receiver_id.eq.${blockedId}),and(sender_id.eq.${blockedId},receiver_id.eq.${blockerId})`,
        );

      return { success: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error blocking user.';
      return { success: false, error: msg };
    }
  },

  /**
   * Unblocks a previously blocked user.
   */
  async unblockUser(
    blockerId: string,
    blockedId: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('blocks')
        .delete()
        .eq('blocker_id', blockerId)
        .eq('blocked_id', blockedId);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error unblocking user.';
      return { success: false, error: msg };
    }
  },

  /**
   * Fetches list of users blocked by the current user.
   */
  async fetchBlockedUsers(
    userId: string,
  ): Promise<{ blocked: BlockedUser[]; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('blocks')
        .select(`
          id,
          blocked_id,
          created_at,
          blocked:profiles!blocks_blocked_id_fkey(user_id, username, display_name, avatar_path, bio)
        `)
        .eq('blocker_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        return { blocked: [], error: error.message };
      }

      const rows = (data || []) as unknown as RawBlockRow[];
      const blocked: BlockedUser[] = rows
        .filter((r) => r.blocked != null)
        .map((r) => ({
          id: r.id,
          blockedId: r.blocked_id,
          username: r.blocked!.username,
          displayName: r.blocked!.display_name,
          avatarPath: r.blocked!.avatar_path,
          blockedAt: r.created_at,
        }));

      return { blocked };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error fetching blocked users.';
      return { blocked: [], error: msg };
    }
  },

  /**
   * Evaluates the relationship status between two users.
   */
  async getRelationshipStatus(
    currentUserId: string,
    targetUserId: string,
  ): Promise<RelationshipStatus> {
    if (currentUserId === targetUserId) {
      return 'SELF';
    }

    try {
      // 1. Check if blocked
      const { data: isBlocked } = await supabase.rpc('is_blocked', {
        p_user_a: currentUserId,
        p_user_b: targetUserId,
      });
      if (isBlocked) return 'BLOCKED';

      // 2. Check if mutual friends
      const { data: areFriends } = await supabase.rpc('are_friends', {
        p_user_a: currentUserId,
        p_user_b: targetUserId,
      });
      if (areFriends) return 'FRIENDS';

      // 3. Check pending requests
      const { data: pending } = await supabase
        .from('friend_requests')
        .select('id, sender_id, receiver_id')
        .eq('status', 'PENDING')
        .or(
          `and(sender_id.eq.${currentUserId},receiver_id.eq.${targetUserId}),and(sender_id.eq.${targetUserId},receiver_id.eq.${currentUserId})`,
        )
        .maybeSingle();

      if (pending) {
        if (pending.sender_id === currentUserId) {
          return 'REQUEST_SENT';
        } else {
          return 'REQUEST_RECEIVED';
        }
      }

      return 'NONE';
    } catch {
      return 'NONE';
    }
  },
};

export default friendsService;
