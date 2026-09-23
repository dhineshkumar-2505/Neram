import { audioRecordingService } from '../../src/features/chat/services/audioRecordingService';
import { supabase } from '../../src/lib/supabase';
import { chatService } from '../../src/features/chat/services/chatService';

// Mock expo-av
jest.mock('expo-av', () => {
  const mockRecording = {
    prepareToRecordAsync: jest.fn().mockResolvedValue({}),
    startAsync: jest.fn().mockResolvedValue({}),
    stopAndUnloadAsync: jest.fn().mockResolvedValue({}),
    getURI: jest.fn().mockReturnValue('file:///data/user/0/neram/cache/voice_1.m4a'),
    setOnRecordingStatusUpdate: jest.fn(),
  };

  const mockSound = {
    playAsync: jest.fn().mockResolvedValue({}),
    pauseAsync: jest.fn().mockResolvedValue({}),
    stopAsync: jest.fn().mockResolvedValue({}),
    unloadAsync: jest.fn().mockResolvedValue({}),
    setPositionAsync: jest.fn().mockResolvedValue({}),
    getStatusAsync: jest.fn().mockResolvedValue({ isLoaded: true, isPlaying: false }),
  };

  return {
    Audio: {
      requestPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
      setAudioModeAsync: jest.fn().mockResolvedValue({}),
      Recording: jest.fn().mockImplementation(() => mockRecording),
      Sound: {
        createAsync: jest.fn().mockResolvedValue({ sound: mockSound }),
      },
      RecordingOptionsPresets: {
        HIGH_QUALITY: {},
      },
    },
  };
});

jest.mock('../../src/lib/supabase', () => ({
  supabase: {
    storage: {
      from: jest.fn(),
    },
    from: jest.fn(),
  },
}));

jest.mock('../../src/features/chat/services/chatService', () => ({
  chatService: {
    sendMessage: jest.fn(),
  },
}));

describe('NERAM PART 11: audioRecordingService Suite', () => {
  const GROUP_ID = 'group-uuid-1';
  const SENDER_ID = 'user-uuid-1';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('formatDuration', () => {
    it('formats millisecond timestamps into mm:ss accurately', () => {
      expect(audioRecordingService.formatDuration(0)).toBe('0:00');
      expect(audioRecordingService.formatDuration(5000)).toBe('0:05');
      expect(audioRecordingService.formatDuration(15000)).toBe('0:15');
      expect(audioRecordingService.formatDuration(65000)).toBe('1:05');
      expect(audioRecordingService.formatDuration(120000)).toBe('2:00');
    });

    it('handles negative or undefined inputs gracefully', () => {
      expect(audioRecordingService.formatDuration(-500)).toBe('0:00');
      expect(audioRecordingService.formatDuration(NaN)).toBe('0:00');
    });
  });

  describe('Recording Lifecycle', () => {
    it('starts recording and tracks duration', async () => {
      const onTick = jest.fn();
      const success = await audioRecordingService.startRecording(onTick);
      expect(success).toBe(true);

      const res = await audioRecordingService.stopRecording();
      expect(res).not.toBeNull();
      expect(res?.uri).toBe('file:///data/user/0/neram/cache/voice_1.m4a');
      expect(res?.durationMillis).toBeGreaterThanOrEqual(1000);
    });

    it('cancels recording cleanly without returning URI', async () => {
      await audioRecordingService.startRecording();
      await audioRecordingService.cancelRecording();
      const res = await audioRecordingService.stopRecording();
      expect(res).toBeNull();
    });
  });

  describe('Single-Playback Coordinator', () => {
    it('enforces single playback by stopping previous clip when new one starts', async () => {
      const updateA = jest.fn();
      const updateB = jest.fn();

      // Play Audio A
      await audioRecordingService.playAudio('msg-A', 'https://neram.app/audio/a.m4a', updateA);
      expect(audioRecordingService.getActiveAudioId()).toBe('msg-A');

      // Play Audio B -> Audio A must be stopped
      await audioRecordingService.playAudio('msg-B', 'https://neram.app/audio/b.m4a', updateB);
      expect(audioRecordingService.getActiveAudioId()).toBe('msg-B');

      // Callback for A should have received stopped state
      expect(updateA).toHaveBeenCalledWith(
        expect.objectContaining({
          isPlaying: false,
          activeId: 'msg-A',
        }),
      );
    });

    it('pauses and stops playback cleanly', async () => {
      const update = jest.fn();
      await audioRecordingService.playAudio('msg-1', 'https://neram.app/audio/1.m4a', update);
      await audioRecordingService.pauseAudio();
      await audioRecordingService.stopAudio();
      expect(audioRecordingService.getActiveAudioId()).toBeNull();
    });
  });

  describe('sendVoiceMessage Dispatcher', () => {
    beforeEach(() => {
      // Mock global fetch for blob reading
      globalThis.fetch = jest.fn().mockResolvedValue({
        blob: jest.fn().mockResolvedValue(new Blob(['fake audio binary'], { type: 'audio/m4a' })),
      } as unknown as Response);
    });

    it('uploads to storage, inserts file, and dispatches message with attachment', async () => {
      const mockUpload = jest.fn().mockResolvedValue({ error: null });
      (supabase.storage.from as jest.Mock).mockReturnValue({
        upload: mockUpload,
        remove: jest.fn().mockResolvedValue({}),
      });

      const mockFileInsert = jest.fn().mockResolvedValue({ error: null });
      const mockAttachmentInsert = jest.fn().mockResolvedValue({ error: null });

      (supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'files') {
          return { insert: mockFileInsert };
        }
        if (table === 'message_attachments') {
          return { insert: mockAttachmentInsert };
        }
        return { insert: jest.fn().mockResolvedValue({ error: null }) };
      });

      (chatService.sendMessage as jest.Mock).mockResolvedValue({
        message: {
          id: 'server-msg-1',
          groupId: GROUP_ID,
          senderId: SENDER_ID,
          body: '[Voice Note] 0:15',
          replyToId: null,
          createdAt: new Date().toISOString(),
          status: 'SENT',
        },
      });

      const res = await audioRecordingService.sendVoiceMessage(
        GROUP_ID,
        SENDER_ID,
        'file:///test.m4a',
        15000,
      );

      expect(res.success).toBe(true);
      expect(res.message).not.toBeNull();
      expect(res.message?.body).toBe('[Voice Note] 0:15');
      expect(res.message?.attachments).toHaveLength(1);
      expect(mockUpload).toHaveBeenCalledWith(
        expect.stringContaining(`${GROUP_ID}/audio/`),
        expect.any(Object),
        expect.objectContaining({ contentType: 'audio/m4a' }),
      );
    });

    it('rolls back storage upload if file database metadata insert fails', async () => {
      const mockRemove = jest.fn().mockResolvedValue({});
      (supabase.storage.from as jest.Mock).mockReturnValue({
        upload: jest.fn().mockResolvedValue({ error: null }),
        remove: mockRemove,
      });

      (supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'files') {
          return {
            insert: jest.fn().mockResolvedValue({
              error: { message: 'Database insert rejected by RLS policy.' },
            }),
          };
        }
        return { insert: jest.fn() };
      });

      const res = await audioRecordingService.sendVoiceMessage(
        GROUP_ID,
        SENDER_ID,
        'file:///test.m4a',
        10000,
      );

      expect(res.success).toBe(false);
      expect(res.error).toContain('Database insert rejected');
      expect(mockRemove).toHaveBeenCalled();
    });
  });
});
