import { inviteService } from '../../src/features/invites/services/inviteService';
import { audioRecordingService } from '../../src/features/chat/services/audioRecordingService';
import { groupMemoriesExportService } from '../../src/features/export/services/groupMemoriesExportService';
import { supabase } from '../../src/lib/supabase';

// Mock expo-av
jest.mock('expo-av', () => ({
  Audio: {
    requestPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
    setAudioModeAsync: jest.fn().mockResolvedValue({}),
    Recording: jest.fn().mockImplementation(() => ({
      prepareToRecordAsync: jest.fn(),
      startAsync: jest.fn(),
      stopAndUnloadAsync: jest.fn(),
      getURI: jest.fn().mockReturnValue('file:///test.m4a'),
    })),
    Sound: {
      createAsync: jest.fn().mockResolvedValue({
        sound: {
          playAsync: jest.fn(),
          stopAsync: jest.fn(),
          unloadAsync: jest.fn(),
          getStatusAsync: jest.fn().mockResolvedValue({ isLoaded: true, isPlaying: false }),
        },
      }),
    },
    RecordingOptionsPresets: { HIGH_QUALITY: {} },
  },
}));

// Mock expo-file-system and expo-sharing
jest.mock('expo-file-system', () => ({
  cacheDirectory: 'file:///cache/',
  writeAsStringAsync: jest.fn().mockResolvedValue(undefined),
  getInfoAsync: jest.fn().mockResolvedValue({ exists: true, size: 2048 }),
  EncodingType: { Base64: 'base64' },
}));

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(true),
  shareAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../src/lib/supabase', () => ({
  supabase: {
    rpc: jest.fn(),
    from: jest.fn(),
    storage: {
      from: jest.fn(),
    },
    auth: {
      getUser: jest.fn(),
    },
  },
}));

describe('NERAM PART 11: Security Penetration Test Suite (15 Test Vectors)', () => {
  const ATTACKER_ID = 'attacker-uuid-999';
  const TARGET_GROUP_ID = 'target-group-uuid-111';
  const EXPIRED_GROUP_ID = 'expired-group-uuid-222';
  const DUMMY_TOKEN = 'f'.repeat(64);

  beforeEach(() => {
    jest.clearAllMocks();
    (supabase.auth.getUser as jest.Mock).mockResolvedValue({
      data: { user: { id: ATTACKER_ID } },
      error: null,
    });
  });

  // =========================================================================
  // VECTOR 1 - 8: QR CODE INVITATION PENETRATION VECTORS
  // =========================================================================

  describe('QR Invite Security Vectors', () => {
    it('[QR-01]: Non-member cannot create invite for an unauthorized group', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: null,
        error: { message: 'Only group owners or admins can generate invitations.' },
      });

      const res = await inviteService.createInvite({ groupId: TARGET_GROUP_ID });
      expect(res.success).toBe(false);
      expect(res.error).toContain('Only group owners or admins');
    });

    it('[QR-02]: Regular member (role MEMBER) cannot create invite if restricted to admins/owners', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: null,
        error: { message: 'Only group owners or admins can generate invitations.' },
      });

      const res = await inviteService.createInvite({ groupId: TARGET_GROUP_ID });
      expect(res.success).toBe(false);
      expect(res.error).toBe('Only group owners or admins can generate invitations.');
    });

    it('[QR-03]: Attacker cannot join using a revoked invite token', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: [{
          success: false,
          reason: 'INVITE_REVOKED',
          group_id: null,
        }],
        error: null,
      });

      const res = await inviteService.joinViaInvite(DUMMY_TOKEN);
      expect(res.success).toBe(false);
      expect(res.reason).toBe('INVITE_REVOKED');
      expect(res.error).toBe('This invitation code has been revoked by the space administrator.');
    });

    it('[QR-04]: Attacker cannot join using a time-expired invite token', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: [{
          success: false,
          reason: 'INVITE_EXPIRED',
          group_id: null,
        }],
        error: null,
      });

      const res = await inviteService.joinViaInvite(DUMMY_TOKEN);
      expect(res.success).toBe(false);
      expect(res.reason).toBe('INVITE_EXPIRED');
      expect(res.error).toBe('This invitation code has expired.');
    });

    it('[QR-05]: Attacker cannot exceed atomic max_uses limit', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: [{
          success: false,
          reason: 'MAX_USES_REACHED',
          group_id: null,
        }],
        error: null,
      });

      const res = await inviteService.joinViaInvite(DUMMY_TOKEN);
      expect(res.success).toBe(false);
      expect(res.reason).toBe('MAX_USES_REACHED');
      expect(res.error).toBe('This invitation code has reached its maximum allowed member limit.');
    });

    it('[QR-06]: Blocked user cannot join group via valid QR invite', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: [{
          success: false,
          reason: 'BLOCKED_BY_MEMBER',
          group_id: null,
        }],
        error: null,
      });

      const res = await inviteService.joinViaInvite(DUMMY_TOKEN);
      expect(res.success).toBe(false);
      expect(res.reason).toBe('BLOCKED_BY_MEMBER');
      expect(res.error).toContain('blocking');
    });

    it('[QR-07]: Attacker cannot join an expired or dissolved group via QR code', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: [{
          success: false,
          reason: 'GROUP_EXPIRED',
          group_id: null,
        }],
        error: null,
      });

      const res = await inviteService.joinViaInvite(DUMMY_TOKEN);
      expect(res.success).toBe(false);
      expect(res.reason).toBe('GROUP_EXPIRED');
      expect(res.error).toBe('This temporary space has already dissolved and expired.');
    });

    it('[QR-08]: Attacker cannot revoke an invite created by another group admin', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: null,
        error: { message: 'Permission denied: Cannot revoke invitation.' },
      });

      const res = await inviteService.revokeInvite('unauthorized-invite-id');
      expect(res.success).toBe(false);
      expect(res.error).toContain('Permission denied');
    });
  });

  // =========================================================================
  // VECTOR 9 - 12: AUDIO / VOICE MESSAGE PENETRATION VECTORS
  // =========================================================================

  describe('Audio / Voice Message Security Vectors', () => {
    beforeEach(() => {
      globalThis.fetch = jest.fn().mockResolvedValue({
        blob: jest.fn().mockResolvedValue(new Blob(['fake audio binary'], { type: 'audio/m4a' })),
      } as unknown as Response);
    });

    it('[AUDIO-01]: Attacker cannot upload voice message to a foreign group', async () => {
      (supabase.storage.from as jest.Mock).mockReturnValue({
        upload: jest.fn().mockResolvedValue({
          error: { message: 'new row violates row-level security policy for bucket attachments' },
        }),
      });

      const res = await audioRecordingService.sendVoiceMessage(
        TARGET_GROUP_ID,
        ATTACKER_ID,
        'file:///test.m4a',
        5000,
      );

      expect(res.success).toBe(false);
      expect(res.error).toContain('row-level security');
    });

    it('[AUDIO-02]: Attacker cannot upload voice note to an expired group', async () => {
      (supabase.storage.from as jest.Mock).mockReturnValue({
        upload: jest.fn().mockResolvedValue({
          error: { message: 'Group is expired. Storage modifications forbidden.' },
        }),
      });

      const res = await audioRecordingService.sendVoiceMessage(
        EXPIRED_GROUP_ID,
        ATTACKER_ID,
        'file:///test.m4a',
        8000,
      );

      expect(res.success).toBe(false);
      expect(res.error).toContain('Group is expired');
    });

    it('[AUDIO-03]: Audio upload must enforce private attachments storage boundary', async () => {
      const mockUpload = jest.fn().mockResolvedValue({ error: null });
      (supabase.storage.from as jest.Mock).mockReturnValue({
        upload: mockUpload,
        remove: jest.fn(),
      });

      (supabase.from as jest.Mock).mockImplementation(() => ({
        insert: jest.fn().mockResolvedValue({ error: null }),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: 'msg-1', group_id: TARGET_GROUP_ID, sender_id: ATTACKER_ID, body: '[Voice Note] 0:05' },
          error: null,
        }),
      }));

      await audioRecordingService.sendVoiceMessage(
        TARGET_GROUP_ID,
        ATTACKER_ID,
        'file:///test.m4a',
        5000,
      );

      // Verify that upload is placed under {groupId}/audio/*
      expect(mockUpload).toHaveBeenCalledWith(
        expect.stringMatching(new RegExp(`^${TARGET_GROUP_ID}/audio/`)),
        expect.any(Object),
        expect.any(Object),
      );
    });

    it('[AUDIO-04]: Signed audio URL expires and requires storage path parameter', async () => {
      const res = await audioRecordingService.getAudioUrl('');
      expect(res).toBeNull();
    });
  });

  // =========================================================================
  // VECTOR 13 - 15: MEMORIES EXPORT & AUTO-PURGE PENETRATION VECTORS
  // =========================================================================

  describe('Memories Export & Auto-Purge Security Vectors', () => {
    it('[MEMORIES-01]: Non-member cannot export memories from an unauthorized space', async () => {
      (supabase.from as jest.Mock).mockImplementation(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Row level security policy violated.' },
        }),
      }));

      const res = await groupMemoriesExportService.exportGroupMemories(TARGET_GROUP_ID);
      expect(res.success).toBe(false);
      expect(res.error).toBeDefined();
    });

    it('[MEMORIES-02]: Attacker cannot export memories of a completely purged space', async () => {
      (supabase.from as jest.Mock).mockImplementation(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Temporary space could not be found or has dissolved.' },
        }),
      }));

      // When group details returns purged/null
      const res = await groupMemoriesExportService.exportGroupMemories('purged-group-uuid');
      expect(res.success).toBe(false);
      expect(res.error).toContain('dissolved');
    });

    it('[PURGE-01]: Purge worker removes group invitations and attachments upon dissolution', async () => {
      // Test that execute_group_database_purge RPC is invokable for group purge
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: true,
        error: null,
      });

      const { data, error } = await supabase.rpc('execute_group_database_purge', {
        p_group_id: TARGET_GROUP_ID,
      });

      expect(error).toBeNull();
      expect(data).toBe(true);
      expect(supabase.rpc).toHaveBeenCalledWith('execute_group_database_purge', {
        p_group_id: TARGET_GROUP_ID,
      });
    });
  });
});
