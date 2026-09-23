import * as Crypto from 'expo-crypto';
import { supabase } from '../../../lib/supabase';
import type {
  GenerateInviteOptions,
  GenerateInviteResult,
  InvitePreviewResult,
  JoinInviteResult,
} from '../types';

export const INVITE_URL_PREFIX = 'neram://invite/';

interface RpcInvitePayload {
  id?: string;
  valid?: boolean;
  reason?: string;
  success?: boolean;
  already_member?: boolean;
  group_id?: string;
  group_name?: string;
  purpose?: string;
  expires_at?: string;
  member_count?: number;
  inviter_name?: string;
  inviter_avatar?: string | null;
  is_already_member?: boolean;
  max_uses?: number | null;
}

/**
 * Converts a byte array to a lowercase hex string.
 */
function toHexString(byteArray: Uint8Array): string {
  return Array.from(byteArray)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export const inviteService = {
  /**
   * Generates a random 64-character hexadecimal token.
   */
  generateTokenHex(): string {
    const bytes = new Uint8Array(32);
    if (globalThis.crypto?.getRandomValues) {
      globalThis.crypto.getRandomValues(bytes);
    } else {
      for (let i = 0; i < 32; i++) {
        bytes[i] = Math.floor(Math.random() * 256);
      }
    }
    return toHexString(bytes);
  },

  /**
   * Hashes a raw token with SHA-256 for secure lookup.
   */
  async hashToken(rawToken: string): Promise<string> {
    const trimmed = rawToken.trim();
    return await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      trimmed,
    );
  },

  /**
   * Parses an invitation token from either a deep-link URL or raw token string.
   */
  parseInviteTokenFromUrl(input: string): string | null {
    if (!input || typeof input !== 'string') return null;
    const trimmed = input.trim();

    // Match neram://invite/<token>
    const schemeMatch = trimmed.match(/^neram:\/\/invite\/([a-f0-9]{32,64})/i);
    if (schemeMatch?.[1]) {
      return schemeMatch[1].toLowerCase();
    }

    // Match https://neram.app/invite/<token>
    const webMatch = trimmed.match(/^https?:\/\/[^/]+\/invite\/([a-f0-9]{32,64})/i);
    if (webMatch?.[1]) {
      return webMatch[1].toLowerCase();
    }

    // Direct token string check (hex string between 32 and 64 chars)
    if (/^[a-f0-9]{32,64}$/i.test(trimmed)) {
      return trimmed.toLowerCase();
    }

    return null;
  },

  /**
   * Generates a cryptographically strong, revocable invitation token and registers it.
   */
  async generateInvite(
    groupId: string,
    options?: GenerateInviteOptions,
  ): Promise<GenerateInviteResult> {
    try {
      if (!groupId) {
        return { success: false, error: 'Group ID is required.' };
      }

      // 1. Generate 32 cryptographically secure random bytes (256 bits)
      let rawToken: string;
      try {
        const randomBytes = await Crypto.getRandomBytesAsync(32);
        rawToken = toHexString(randomBytes);
      } catch {
        rawToken = this.generateTokenHex();
      }

      // 2. Hash token for zero-trust database storage
      const tokenHash = await this.hashToken(rawToken);

      // 3. Compute expiration
      const lifespan = options?.lifespanSeconds ?? 86400; // default 24h
      const expiresAt = new Date(Date.now() + lifespan * 1000).toISOString();

      // 4. Invoke server RPC
      const { data, error } = await supabase.rpc('create_group_invite', {
        p_group_id: groupId,
        p_token_hash: tokenHash,
        p_expires_at: expiresAt,
        p_max_uses: options?.maxUses ?? null,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      const inviteUrl = `${INVITE_URL_PREFIX}${rawToken}`;
      const payload = (Array.isArray(data) ? data[0] : data) as RpcInvitePayload | null;

      return {
        success: true,
        inviteId: payload?.id,
        rawToken,
        inviteUrl,
        expiresAt: payload?.expires_at ?? expiresAt,
        maxUses: payload?.max_uses,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to generate invitation';
      return { success: false, error: msg };
    }
  },

  /**
   * Convenience alias accepting an options bag with groupId, maxUses, validHours.
   */
  async createInvite(input: {
    groupId: string;
    maxUses?: number | null;
    validHours?: number;
  }): Promise<{
    success: boolean;
    inviteId?: string;
    token?: string;
    rawToken?: string;
    inviteUrl?: string;
    expiresAt?: string;
    maxUses?: number | null;
    error?: string;
  }> {
    if (!input.groupId) {
      return { success: false, error: 'Group ID is required.' };
    }
    const lifespanSeconds = (input.validHours ?? 24) * 3600;
    const res = await this.generateInvite(input.groupId, {
      maxUses: input.maxUses ?? undefined,
      lifespanSeconds,
    });
    return {
      ...res,
      token: res.rawToken,
    };
  },

  /**
   * Previews invitation metadata without modifying membership state.
   */
  async previewInvite(rawToken: string): Promise<InvitePreviewResult> {
    try {
      const parsedToken = this.parseInviteTokenFromUrl(rawToken);
      if (!parsedToken) {
        return { valid: false, reason: 'INVALID_TOKEN' };
      }

      const tokenHash = await this.hashToken(parsedToken);

      const { data, error } = await supabase.rpc('preview_group_invite', {
        p_token_hash: tokenHash,
      });

      if (error) {
        return { valid: false, reason: 'NETWORK_ERROR' };
      }

      const payload = (Array.isArray(data) ? data[0] : data) as RpcInvitePayload | null;

      if (!payload || !payload.valid) {
        return {
          valid: false,
          reason: payload?.reason ?? 'INVITE_NOT_FOUND',
        };
      }

      return {
        valid: true,
        groupId: payload.group_id,
        groupName: payload.group_name,
        purpose: payload.purpose,
        expiresAt: payload.expires_at,
        memberCount: payload.member_count,
        inviterName: payload.inviter_name,
        inviterAvatar: payload.inviter_avatar,
        isAlreadyMember: payload.is_already_member,
      };
    } catch {
      return { valid: false, reason: 'NETWORK_ERROR' };
    }
  },

  /**
   * Atomically consumes invite usage and establishes group membership.
   */
  async joinViaInvite(rawToken: string): Promise<JoinInviteResult> {
    try {
      const parsedToken = this.parseInviteTokenFromUrl(rawToken);
      if (!parsedToken) {
        return { success: false, error: 'Invalid invitation format.', reason: 'INVALID_TOKEN' };
      }

      const tokenHash = await this.hashToken(parsedToken);

      const { data, error } = await supabase.rpc('join_group_via_invite', {
        p_token_hash: tokenHash,
      });

      if (error) {
        let reason = 'NETWORK_ERROR';
        const msg = error.message;
        if (msg.includes('revoked')) {
          reason = 'INVITE_REVOKED';
        } else if (msg.includes('expired')) {
          reason = msg.includes('group') ? 'GROUP_EXPIRED' : 'INVITE_EXPIRED';
        } else if (msg.includes('maximum')) {
          reason = 'MAX_USES_REACHED';
        } else if (msg.includes('blocking') || msg.includes('block')) {
          reason = 'BLOCKED_BY_MEMBER';
        }

        return { success: false, error: error.message, reason };
      }

      const payload = (Array.isArray(data) ? data[0] : data) as RpcInvitePayload | null;

      if (payload && payload.success === false) {
        let errorMsg = 'Failed to join group.';
        if (payload.reason === 'MAX_USES_REACHED') {
          errorMsg = 'This invitation code has reached its maximum allowed member limit.';
        } else if (payload.reason === 'INVITE_REVOKED') {
          errorMsg = 'This invitation code has been revoked by the space administrator.';
        } else if (payload.reason === 'INVITE_EXPIRED') {
          errorMsg = 'This invitation code has expired.';
        } else if (payload.reason === 'GROUP_EXPIRED') {
          errorMsg = 'This temporary space has already dissolved and expired.';
        } else if (payload.reason === 'BLOCKED_BY_MEMBER') {
          errorMsg = 'Cannot join space with blocking restrictions.';
        }

        return {
          success: false,
          reason: payload.reason,
          error: errorMsg,
        };
      }

      return {
        success: payload?.success ?? true,
        alreadyMember: payload?.already_member,
        groupId: payload?.group_id,
        groupName: payload?.group_name,
        reason: payload?.reason,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error joining group via invite';
      return { success: false, error: msg };
    }
  },

  /**
   * Revokes an existing active invitation.
   */
  async revokeInvite(inviteId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase.rpc('revoke_group_invite', {
        p_invite_id: inviteId,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error revoking invitation';
      return { success: false, error: msg };
    }
  },
};

export default inviteService;
