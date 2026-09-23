import { inviteService } from '../../src/features/invites/services/inviteService';
import { supabase } from '../../src/lib/supabase';

jest.mock('../../src/lib/supabase', () => ({
  supabase: {
    rpc: jest.fn(),
    from: jest.fn(),
  },
}));

describe('NERAM PART 11: inviteService Suite', () => {
  const TEST_GROUP_ID = '11111111-2222-3333-4444-555555555555';
  const MOCK_TOKEN = 'a'.repeat(64); // 64-char hex string

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Token Generation & Hashing', () => {
    it('generates a 64-character hexadecimal token', () => {
      const token = inviteService.generateTokenHex();
      expect(token).toHaveLength(64);
      expect(/^[0-9a-f]{64}$/.test(token)).toBe(true);
    });

    it('generates unique tokens on subsequent calls', () => {
      const t1 = inviteService.generateTokenHex();
      const t2 = inviteService.generateTokenHex();
      expect(t1).not.toBe(t2);
    });

    it('computes deterministic SHA-256 hash', async () => {
      const input = 'test-token-123';
      const hash1 = await inviteService.hashToken(input);
      const hash2 = await inviteService.hashToken(input);
      expect(hash1).toHaveLength(64);
      expect(hash1).toBe(hash2);
      expect(/^[0-9a-f]{64}$/.test(hash1)).toBe(true);
    });
  });

  describe('parseInviteTokenFromUrl', () => {
    it('extracts token from custom URL scheme (neram://invite/:token)', () => {
      const url = `neram://invite/${MOCK_TOKEN}`;
      expect(inviteService.parseInviteTokenFromUrl(url)).toBe(MOCK_TOKEN);
    });

    it('extracts token from web URL (https://neram.app/invite/:token)', () => {
      const url = `https://neram.app/invite/${MOCK_TOKEN}`;
      expect(inviteService.parseInviteTokenFromUrl(url)).toBe(MOCK_TOKEN);
    });

    it('accepts raw 64-char hex token', () => {
      expect(inviteService.parseInviteTokenFromUrl(MOCK_TOKEN)).toBe(MOCK_TOKEN);
    });

    it('returns null for invalid or malicious inputs', () => {
      expect(inviteService.parseInviteTokenFromUrl('not-a-token')).toBeNull();
      expect(inviteService.parseInviteTokenFromUrl('')).toBeNull();
      expect(inviteService.parseInviteTokenFromUrl('https://evil.com/invite/123')).toBeNull();
      expect(inviteService.parseInviteTokenFromUrl('neram://other/route')).toBeNull();
    });
  });

  describe('createInvite', () => {
    it('fails if group ID is missing', async () => {
      const res = await inviteService.createInvite({ groupId: '' });
      expect(res.success).toBe(false);
      expect(res.error).toBe('Group ID is required.');
    });

    it('successfully calls create_group_invite RPC with token hash', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: [{
          invite_id: 'inv-uuid-1',
          expires_at: '2026-09-24T12:00:00Z',
          max_uses: 10,
        }],
        error: null,
      });

      const res = await inviteService.createInvite({
        groupId: TEST_GROUP_ID,
        maxUses: 10,
        validHours: 24,
      });

      expect(res.success).toBe(true);
      expect(res.token).toHaveLength(64);
      expect(res.inviteUrl).toContain(`neram://invite/${res.token}`);
      expect(supabase.rpc).toHaveBeenCalledWith('create_group_invite', expect.objectContaining({
        p_group_id: TEST_GROUP_ID,
        p_max_uses: 10,
        p_token_hash: expect.any(String),
      }));
    });

    it('handles RPC errors gracefully', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: null,
        error: { message: 'Only group owners or admins can generate invitations.' },
      });

      const res = await inviteService.createInvite({ groupId: TEST_GROUP_ID });
      expect(res.success).toBe(false);
      expect(res.error).toContain('Only group owners or admins');
    });
  });

  describe('previewInvite', () => {
    it('returns invalid if token is malformed', async () => {
      const res = await inviteService.previewInvite('short-invalid');
      expect(res.valid).toBe(false);
      expect(res.reason).toBe('INVALID_TOKEN');
    });

    it('returns preview data from preview_group_invite RPC', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: [{
          valid: true,
          reason: 'VALID',
          group_id: TEST_GROUP_ID,
          group_name: 'Summer Trip 2026',
          purpose: 'Trip Planning',
          member_count: 5,
          inviter_name: 'Alice',
          is_already_member: false,
        }],
        error: null,
      });

      const res = await inviteService.previewInvite(MOCK_TOKEN);
      expect(res.valid).toBe(true);
      expect(res.groupName).toBe('Summer Trip 2026');
      expect(res.memberCount).toBe(5);
      expect(res.isAlreadyMember).toBe(false);
    });

    it('accurately propagates revocation or expiry reason', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: [{
          valid: false,
          reason: 'INVITE_REVOKED',
          group_id: null,
        }],
        error: null,
      });

      const res = await inviteService.previewInvite(MOCK_TOKEN);
      expect(res.valid).toBe(false);
      expect(res.reason).toBe('INVITE_REVOKED');
    });
  });

  describe('joinViaInvite', () => {
    it('calls join_group_via_invite RPC and returns groupId upon success', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: [{
          success: true,
          reason: 'JOINED',
          group_id: TEST_GROUP_ID,
          group_name: 'Summer Trip 2026',
        }],
        error: null,
      });

      const res = await inviteService.joinViaInvite(MOCK_TOKEN);
      expect(res.success).toBe(true);
      expect(res.groupId).toBe(TEST_GROUP_ID);
      expect(res.groupName).toBe('Summer Trip 2026');
    });

    it('rejects join when max uses reached or user is blocked', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: [{
          success: false,
          reason: 'MAX_USES_REACHED',
          group_id: null,
        }],
        error: null,
      });

      const res = await inviteService.joinViaInvite(MOCK_TOKEN);
      expect(res.success).toBe(false);
      expect(res.reason).toBe('MAX_USES_REACHED');
      expect(res.error).toBe('This invitation code has reached its maximum allowed member limit.');
    });
  });

  describe('revokeInvite', () => {
    it('calls revoke_group_invite RPC', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: true,
        error: null,
      });

      const res = await inviteService.revokeInvite('inv-uuid-1');
      expect(res.success).toBe(true);
      expect(supabase.rpc).toHaveBeenCalledWith('revoke_group_invite', {
        p_invite_id: 'inv-uuid-1',
      });
    });
  });
});
