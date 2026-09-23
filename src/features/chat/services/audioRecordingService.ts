import { Audio, AVPlaybackStatus } from 'expo-av';
import { supabase } from '../../../lib/supabase';
import { chatService } from './chatService';
import { fileService } from '../../files/services/fileService';
import type { ChatMessage } from '../types';

export interface RecordingState {
  isRecording: boolean;
  durationMillis: number;
  uri: string | null;
}

export interface PlaybackState {
  isPlaying: boolean;
  positionMillis: number;
  durationMillis: number;
  activeId: string | null;
}

class AudioService {
  private recording: Audio.Recording | null = null;
  private recordingTimer: ReturnType<typeof setInterval> | null = null;
  private recordingDuration: number = 0;
  private onRecordingTick: ((durationMillis: number) => void) | null = null;

  // Global Single-Playback Coordinator
  private activeSound: Audio.Sound | null = null;
  private activeId: string | null = null;
  private onPlaybackStatusCallback: ((state: PlaybackState) => void) | null = null;

  public readonly MAX_RECORDING_DURATION_MS = 120_000; // 120 seconds (2 minutes)

  /**
   * Format milliseconds into mm:ss display
   */
  public formatDuration(millis: number): string {
    if (!millis || millis < 0) return '0:00';
    const totalSeconds = Math.floor(millis / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  }

  /**
   * Request microphone permissions
   */
  public async requestPermissions(): Promise<boolean> {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      return granted;
    } catch {
      return false;
    }
  }

  /**
   * Start in-chat audio recording up to 120 seconds
   */
  public async startRecording(
    onTick?: (durationMillis: number) => void,
    onMaxReached?: () => void,
  ): Promise<boolean> {
    try {
      // If currently playing audio, stop it
      await this.stopAudio();

      const permissionGranted = await this.requestPermissions();
      if (!permissionGranted) {
        return false;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      if (this.recording) {
        try {
          await this.recording.stopAndUnloadAsync();
        } catch {
          // ignore cleanup
        }
        this.recording = null;
      }

      const newRecording = new Audio.Recording();
      await newRecording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);

      this.recording = newRecording;
      this.recordingDuration = 0;
      this.onRecordingTick = onTick || null;

      await newRecording.startAsync();

      // Start ticker
      this.recordingTimer = setInterval(() => {
        this.recordingDuration += 250;
        if (this.onRecordingTick) {
          this.onRecordingTick(this.recordingDuration);
        }

        // Auto-stop at 120s limit
        if (this.recordingDuration >= this.MAX_RECORDING_DURATION_MS) {
          if (this.recordingTimer) {
            clearInterval(this.recordingTimer);
            this.recordingTimer = null;
          }
          if (onMaxReached) {
            onMaxReached();
          }
        }
      }, 250);

      return true;
    } catch {
      this.cleanRecordingTimer();
      return false;
    }
  }

  /**
   * Stop active recording and return the recorded URI and duration
   */
  public async stopRecording(): Promise<{ uri: string; durationMillis: number } | null> {
    this.cleanRecordingTimer();

    if (!this.recording) {
      return null;
    }

    try {
      await this.recording.stopAndUnloadAsync();
      const uri = this.recording.getURI();
      const finalDuration = this.recordingDuration;
      this.recording = null;

      // Revert audio mode to playback
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });

      if (!uri) {
        return null;
      }

      return {
        uri,
        durationMillis: Math.max(finalDuration, 1000),
      };
    } catch {
      this.recording = null;
      return null;
    }
  }

  /**
   * Discard active recording without saving
   */
  public async cancelRecording(): Promise<void> {
    this.cleanRecordingTimer();
    if (this.recording) {
      try {
        await this.recording.stopAndUnloadAsync();
      } catch {
        // ignore
      }
      this.recording = null;
    }
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
    });
  }

  private cleanRecordingTimer(): void {
    if (this.recordingTimer) {
      clearInterval(this.recordingTimer);
      this.recordingTimer = null;
    }
  }

  // =========================================================================
  // SINGLE-PLAYBACK COORDINATOR
  // =========================================================================

  /**
   * Plays the designated audio clip. If another clip is playing, it is stopped.
   */
  public async playAudio(
    id: string,
    uriOrUrl: string,
    onStatusUpdate: (state: PlaybackState) => void,
  ): Promise<boolean> {
    try {
      // 1. If this exact sound is already active, toggle resume/play
      if (this.activeId === id && this.activeSound) {
        const status = await this.activeSound.getStatusAsync();
        if (status.isLoaded) {
          if (!status.isPlaying) {
            await this.activeSound.playAsync();
            return true;
          }
        }
      }

      // 2. Stop any existing playback across the app
      await this.stopAudio();

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });

      this.activeId = id;
      this.onPlaybackStatusCallback = onStatusUpdate;

      const { sound } = await Audio.Sound.createAsync(
        { uri: uriOrUrl },
        { shouldPlay: true },
        this.handlePlaybackStatusUpdate,
      );

      this.activeSound = sound;
      return true;
    } catch {
      this.activeId = null;
      this.activeSound = null;
      return false;
    }
  }

  /**
   * Pause active audio
   */
  public async pauseAudio(): Promise<void> {
    if (this.activeSound) {
      try {
        await this.activeSound.pauseAsync();
      } catch {
        // ignore
      }
    }
  }

  /**
   * Stop and unload active audio
   */
  public async stopAudio(): Promise<void> {
    if (this.activeSound) {
      const prevCallback = this.onPlaybackStatusCallback;
      const prevId = this.activeId;

      try {
        await this.activeSound.stopAsync();
        await this.activeSound.unloadAsync();
      } catch {
        // ignore
      }

      this.activeSound = null;
      this.activeId = null;
      this.onPlaybackStatusCallback = null;

      if (prevCallback) {
        prevCallback({
          isPlaying: false,
          positionMillis: 0,
          durationMillis: 0,
          activeId: prevId,
        });
      }
    }
  }

  /**
   * Seek active audio to specific position
   */
  public async seekAudio(positionMillis: number): Promise<void> {
    if (this.activeSound) {
      try {
        await this.activeSound.setPositionAsync(positionMillis);
      } catch {
        // ignore
      }
    }
  }

  public getActiveAudioId(): string | null {
    return this.activeId;
  }

  private handlePlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (!status.isLoaded) {
      if (status.error && this.onPlaybackStatusCallback) {
        this.onPlaybackStatusCallback({
          isPlaying: false,
          positionMillis: 0,
          durationMillis: 0,
          activeId: this.activeId,
        });
      }
      return;
    }

    if (this.onPlaybackStatusCallback) {
      this.onPlaybackStatusCallback({
        isPlaying: status.isPlaying,
        positionMillis: status.positionMillis,
        durationMillis: status.durationMillis || 0,
        activeId: this.activeId,
      });
    }

    // Auto cleanup when playback finishes
    if (status.didJustFinish) {
      this.stopAudio().catch(() => {});
    }
  };

  // =========================================================================
  // VOICE MESSAGE UPLOAD & SEND DISPATCHER
  // =========================================================================

  /**
   * Uploads .m4a audio file to Supabase private storage and dispatches
   * ChatMessage with public.files and public.message_attachments relations.
   */
  public async sendVoiceMessage(
    groupId: string,
    senderId: string,
    audioUri: string,
    durationMillis: number,
    replyToId?: string | null,
  ): Promise<{ success: boolean; message: ChatMessage | null; error?: string }> {
    let storagePath = '';
    try {
      if (!groupId || !senderId || !audioUri) {
        return { success: false, message: null, error: 'Missing required audio parameters.' };
      }

      // 1. Fetch binary blob from local URI
      const response = await globalThis.fetch(audioUri);
      const blob = await response.blob();
      const resolvedSize = blob.size > 0 ? blob.size : 32768;

      const fileId = globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `audio-${Date.now()}`;
      storagePath = `${groupId}/audio/${fileId}.m4a`;

      // 2. Upload to private Storage bucket 'attachments'
      const { error: storageError } = await supabase.storage
        .from('attachments')
        .upload(storagePath, blob, {
          contentType: 'audio/m4a',
          upsert: false,
        });

      if (storageError) {
        return { success: false, message: null, error: storageError.message };
      }

      // 3. Insert metadata into public.files
      const { error: fileDbError } = await supabase
        .from('files')
        .insert({
          id: fileId,
          group_id: groupId,
          owner_id: senderId,
          filename: `voice_note_${Date.now()}.m4a`,
          mime_type: 'audio/m4a',
          size_bytes: resolvedSize,
          storage_path: storagePath,
        });

      if (fileDbError) {
        // Rollback storage upload
        await supabase.storage.from('attachments').remove([storagePath]).catch(() => {});
        return { success: false, message: null, error: fileDbError.message };
      }

      // 4. Send Message via chatService
      const formattedDuration = this.formatDuration(durationMillis);
      const messageBody = `[Voice Note] ${formattedDuration}`;

      const sendResult = await chatService.sendMessage({
        groupId,
        senderId,
        body: messageBody,
        replyToId: replyToId || null,
      });

      if (!sendResult.message) {
        return {
          success: false,
          message: null,
          error: sendResult.error || 'Failed to send voice message.',
        };
      }

      // 5. Link in public.message_attachments
      try {
        await supabase
          .from('message_attachments')
          .insert({
            message_id: sendResult.message.id,
            file_id: fileId,
          });
      } catch {
        // non-blocking
      }

      // Enrich message with attachment
      const enrichedMessage: ChatMessage = {
        ...sendResult.message,
        attachments: [
          {
            id: fileId,
            fileId,
            filename: `voice_note_${Date.now()}.m4a`,
            mimeType: 'audio/m4a',
            sizeBytes: resolvedSize,
            storagePath,
          },
        ],
      };

      return {
        success: true,
        message: enrichedMessage,
      };
    } catch (err) {
      if (storagePath) {
        await supabase.storage.from('attachments').remove([storagePath]).catch(() => {});
      }
      const message = err instanceof Error ? err.message : 'Failed to process voice message.';
      return { success: false, message: null, error: message };
    }
  }

  /**
   * Resolves a temporary signed download URL for an audio storage path
   */
  public async getAudioUrl(storagePath: string): Promise<string | null> {
    const res = await fileService.getSignedDownloadUrl(storagePath, 1800);
    return res.signedUrl;
  }
}

export const audioRecordingService = new AudioService();
export default audioRecordingService;
