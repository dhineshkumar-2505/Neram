/**
 * Group Memories Export Feature Types.
 * Strict types for deterministic ZIP generation, progress tracking, and file sharing.
 */

export type ExportStep =
  | 'IDLE'
  | 'FETCHING_METADATA'
  | 'GATHERING_CHAT'
  | 'COLLECTING_MODULES'
  | 'DOWNLOADING_MEDIA'
  | 'BUILDING_ARCHIVE'
  | 'READY'
  | 'ERROR';

export interface ExportProgress {
  step: ExportStep;
  progressPercent: number; // 0 to 100
  statusMessage: string;
}

export interface ExportOptions {
  includeMedia?: boolean;
  includeAudio?: boolean;
}

export interface ExportResult {
  success: boolean;
  filePath?: string;
  error?: string;
  byteSize?: number;
}
