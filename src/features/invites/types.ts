export interface GroupInviteRecord {
  id: string;
  groupId: string;
  createdBy: string;
  tokenHash: string;
  expiresAt: string;
  maxUses: number | null;
  usesCount: number;
  revokedAt: string | null;
  createdAt: string;
}

export interface GenerateInviteOptions {
  lifespanSeconds?: number;
  maxUses?: number;
}

export interface GenerateInviteResult {
  success: boolean;
  inviteId?: string;
  rawToken?: string;
  inviteUrl?: string;
  expiresAt?: string;
  maxUses?: number | null;
  error?: string;
}

export interface InvitePreviewResult {
  valid: boolean;
  reason?: 'INVALID_TOKEN' | 'INVITE_NOT_FOUND' | 'INVITE_REVOKED' | 'INVITE_EXPIRED' | 'MAX_USES_REACHED' | 'GROUP_EXPIRED' | 'NETWORK_ERROR' | string;
  groupId?: string;
  groupName?: string;
  purpose?: string;
  expiresAt?: string;
  memberCount?: number;
  inviterName?: string;
  inviterAvatar?: string | null;
  isAlreadyMember?: boolean;
}

export interface JoinInviteResult {
  success: boolean;
  alreadyMember?: boolean;
  groupId?: string;
  groupName?: string;
  reason?: string;
  error?: string;
}

