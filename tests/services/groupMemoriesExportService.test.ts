import { groupMemoriesExportService } from '../../src/features/export/services/groupMemoriesExportService';
import { supabase } from '../../src/lib/supabase';
import { groupService } from '../../src/features/groups/services/groupService';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

// Mock expo-file-system/legacy
jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///data/user/0/neram/cache/',
  writeAsStringAsync: jest.fn().mockResolvedValue(undefined),
  getInfoAsync: jest.fn().mockResolvedValue({ exists: true, size: 1048576 }),
  EncodingType: {
    Base64: 'base64',
  },
}));

// Mock expo-sharing
jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(true),
  shareAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../src/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

jest.mock('../../src/features/groups/services/groupService', () => ({
  groupService: {
    fetchGroupDetails: jest.fn(),
  },
}));

describe('NERAM PART 11: groupMemoriesExportService Suite', () => {
  const GROUP_ID = 'export-group-1';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fails if group cannot be found or is dissolved', async () => {
    (groupService.fetchGroupDetails as jest.Mock).mockResolvedValue({
      group: null,
      error: 'Temporary space could not be found or has dissolved.',
    });

    const res = await groupMemoriesExportService.exportGroupMemories(GROUP_ID);
    expect(res.success).toBe(false);
    expect(res.error).toContain('dissolved');
  });

  it('compiles full ZIP archive with chat, tasks, events, polls, and manifest', async () => {
    (groupService.fetchGroupDetails as jest.Mock).mockResolvedValue({
      group: {
        id: GROUP_ID,
        name: 'Weekend Hackathon',
        purpose: 'Hacking',
        description: '48hr coding sprint',
        created_at: '2026-09-22T10:00:00Z',
        expires_at: '2026-09-24T10:00:00Z',
        members: [
          {
            user_id: 'u1',
            role: 'OWNER',
            profile: { display_name: 'Alice', username: 'alice' },
          },
          {
            user_id: 'u2',
            role: 'MEMBER',
            profile: { display_name: 'Bob', username: 'bob' },
          },
        ],
      },
    });

    // Mock database tables queries
    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'messages') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          is: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({
            data: [
              {
                id: 'm1',
                sender_id: 'u1',
                body: 'Hello team!',
                created_at: '2026-09-22T11:00:00Z',
                sender: { display_name: 'Alice', username: 'alice' },
              },
            ],
            error: null,
          }),
        };
      }
      if (table === 'tasks') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({
            data: [{ id: 't1', title: 'Setup database', status: 'COMPLETED' }],
            error: null,
          }),
        };
      }
      if (table === 'events') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({
            data: [{ id: 'e1', title: 'Pitch Presentation', starts_at: '2026-09-24T09:00:00Z' }],
            error: null,
          }),
        };
      }
      if (table === 'polls') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({
            data: [{ id: 'p1', question: 'Dinner choice?' }],
            error: null,
          }),
        };
      }
      if (table === 'files') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        };
      }
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: [], error: null }),
      };
    });

    const progressTracker: number[] = [];
    const res = await groupMemoriesExportService.exportGroupMemories(
      GROUP_ID,
      (p) => progressTracker.push(p.progressPercent),
      { includeMedia: false, includeAudio: false },
    );

    expect(res.success).toBe(true);
    expect(res.filePath).toContain('.zip');
    expect(progressTracker).toContain(10);
    expect(progressTracker).toContain(100);

    // Verify FileSystem wrote base64 content
    expect(FileSystem.writeAsStringAsync).toHaveBeenCalledWith(
      expect.stringContaining('neram_weekend_hackathon_memories_'),
      expect.any(String),
      expect.objectContaining({ encoding: 'base64' }),
    );

    // Verify native share was invoked
    expect(Sharing.shareAsync).toHaveBeenCalledWith(
      expect.stringContaining('.zip'),
      expect.objectContaining({ mimeType: 'application/zip' }),
    );
  });
});
