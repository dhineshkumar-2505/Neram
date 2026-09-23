/**
 * Social Graph & Friendship Domain Types
 */

export interface FriendProfile {
  userId: string;
  username: string;
  displayName: string;
  avatarPath: string | null;
  bio: string | null;
  friendshipId: string;
  friendsSince: string;
}

export type FriendRequestStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CANCELLED';

export interface FriendRequestProfile {
  userId: string;
  username: string;
  displayName: string;
  avatarPath: string | null;
  bio: string | null;
}

export interface FriendRequest {
  id: string;
  senderId: string;
  receiverId: string;
  status: FriendRequestStatus;
  createdAt: string;
  respondedAt: string | null;
  profile: FriendRequestProfile;
}

export interface BlockedUser {
  id: string;
  blockedId: string;
  username: string;
  displayName: string;
  avatarPath: string | null;
  blockedAt: string;
}

export type RelationshipStatus =
  | 'NONE'
  | 'FRIENDS'
  | 'REQUEST_SENT'
  | 'REQUEST_RECEIVED'
  | 'BLOCKED'
  | 'SELF';
