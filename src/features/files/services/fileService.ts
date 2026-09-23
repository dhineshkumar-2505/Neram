import * as Crypto from 'expo-crypto';
import { supabase } from '../../../lib/supabase';
import type {
  GroupFile,
  UploadFileInput,
  UploadFileResult,
  FetchFilesResult,
  SignedUrlResult,
  DeleteFileResult,
} from '../types';
import {
  validateFile,
  sanitizeFilename,
  getFileCategory,
} from './fileValidationService';

interface RawFileRow {
  id: string;
  group_id: string;
  owner_id: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  storage_path: string;
  created_at: string;
  uploader?: {
    user_id: string;
    display_name: string | null;
    username: string | null;
    avatar_path: string | null;
  } | null;
}

function generateUUID(): string {
  try {
    if (typeof Crypto.randomUUID === 'function') {
      return Crypto.randomUUID();
    }
  } catch {
    // Fallback for tests or unsupported environments
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function mapFileRowToRecord(row: RawFileRow): GroupFile {
  const category = getFileCategory(row.mime_type, row.filename);
  return {
    id: row.id,
    groupId: row.group_id,
    ownerId: row.owner_id,
    uploaderId: row.owner_id,
    filename: row.filename,
    fileName: row.filename,
    mimeType: row.mime_type,
    sizeBytes: Number(row.size_bytes),
    fileSize: Number(row.size_bytes),
    storagePath: row.storage_path,
    createdAt: row.created_at,
    category,
    uploader: row.uploader
      ? {
          userId: row.uploader.user_id,
          displayName: row.uploader.display_name || row.uploader.username || 'Member',
          username: row.uploader.username || 'member',
          avatarUrl: row.uploader.avatar_path,
        }
      : undefined,
  };
}

export const fileService = {
  /**
   * Fetches all files for a group ordered chronologically (newest first).
   */
  async listFiles(groupId: string, _currentUserId?: string): Promise<FetchFilesResult> {
    try {
      if (!groupId) {
        return { files: [], error: 'Group ID is required.' };
      }

      const { data, error } = await supabase
        .from('files')
        .select(`
          id,
          group_id,
          owner_id,
          filename,
          mime_type,
          size_bytes,
          storage_path,
          created_at,
          uploader:profiles!files_owner_id_fkey(
            user_id,
            display_name,
            username,
            avatar_path
          )
        `)
        .eq('group_id', groupId)
        .order('created_at', { ascending: false });

      if (error) {
        return { files: [], error: error.message };
      }

      const rows = (data as unknown as RawFileRow[]) || [];
      const files = rows.map(mapFileRowToRecord);

      return { files };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch vault files.';
      return { files: [], error: message };
    }
  },

  /**
   * Fetches a single file record by ID.
   */
  async getFile(fileId: string): Promise<{ file: GroupFile | null; error?: string }> {
    try {
      if (!fileId) {
        return { file: null, error: 'File ID is required.' };
      }

      const { data, error } = await supabase
        .from('files')
        .select(`
          id,
          group_id,
          owner_id,
          filename,
          mime_type,
          size_bytes,
          storage_path,
          created_at,
          uploader:profiles!files_owner_id_fkey(
            user_id,
            display_name,
            username,
            avatar_path
          )
        `)
        .eq('id', fileId)
        .single();

      if (error) {
        return { file: null, error: error.message };
      }

      const file = mapFileRowToRecord(data as unknown as RawFileRow);
      return { file };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to retrieve file record.';
      return { file: null, error: message };
    }
  },

  /**
   * Two-phase upload pipeline:
   * 1. Validate file (MIME, size, extension)
   * 2. Upload to private Storage bucket 'attachments' under `{groupId}/{fileId}/{safeFilename}`
   * 3. Insert metadata into public.files
   * 4. Automatic rollback: deletes storage object if metadata insert fails.
   */
  async uploadFile(input: UploadFileInput, currentUserId: string): Promise<UploadFileResult> {
    let storagePath = '';
    try {
      if (!currentUserId) {
        return { success: false, error: 'Authentication required to upload files.' };
      }
      if (!input.groupId) {
        return { success: false, error: 'Group ID is required.' };
      }

      // Step 1: Pre-upload validation
      const validation = validateFile({
        filename: input.filename,
        sizeBytes: input.fileSize,
        mimeType: input.mimeType,
      });

      if (!validation.valid) {
        return { success: false, error: validation.error || 'File validation failed.' };
      }

      // Step 2: Prepare body and resolve size
      let body = input.fileBody;
      let resolvedSize = input.fileSize || 0;

      if (!body && input.fileUri) {
        const response = await globalThis.fetch(input.fileUri);
        body = await response.blob();
        if (!resolvedSize && body && 'size' in body) {
          resolvedSize = (body as Blob).size;
        }
      }

      if (!body) {
        return { success: false, error: 'Unable to read file content for upload.' };
      }

      // Check size again if resolved from blob
      if (resolvedSize > 52428800) {
        return { success: false, error: 'File size exceeds the 50MB limit.' };
      }

      // Step 3: Construct stable path
      const fileId = generateUUID();
      const safeFilename = sanitizeFilename(input.filename);
      storagePath = `${input.groupId}/${fileId}/${safeFilename}`;

      // Step 4: Storage Upload
      const { error: storageError } = await supabase.storage
        .from('attachments')
        .upload(storagePath, body, {
          contentType: input.mimeType || 'application/octet-stream',
          upsert: false,
        });

      if (storageError) {
        return { success: false, error: storageError.message };
      }

      // Step 5: Database Metadata Insertion
      const { data: dbData, error: dbError } = await supabase
        .from('files')
        .insert({
          id: fileId,
          group_id: input.groupId,
          owner_id: currentUserId,
          filename: input.filename.trim(),
          mime_type: input.mimeType || 'application/octet-stream',
          size_bytes: resolvedSize > 0 ? resolvedSize : 1024,
          storage_path: storagePath,
        })
        .select(`
          id,
          group_id,
          owner_id,
          filename,
          mime_type,
          size_bytes,
          storage_path,
          created_at,
          uploader:profiles!files_owner_id_fkey(
            user_id,
            display_name,
            username,
            avatar_path
          )
        `)
        .single();

      // Step 6: Orphan Storage Rollback on Database Failure
      if (dbError) {
        // Asynchronously remove the orphan storage object
        await supabase.storage.from('attachments').remove([storagePath]).catch(() => {});
        return { success: false, error: dbError.message };
      }

      const file = mapFileRowToRecord(dbData as unknown as RawFileRow);
      return { success: true, file };
    } catch (err: unknown) {
      // Rollback orphan storage object if path was generated
      if (storagePath) {
        await supabase.storage.from('attachments').remove([storagePath]).catch(() => {});
      }
      const message = err instanceof Error ? err.message : 'Upload transaction failed.';
      return { success: false, error: message };
    }
  },

  /**
   * Generates a time-bound HMAC signed download URL for private attachments.
   * Default expiry: 15 minutes (900 seconds).
   */
  async getSignedDownloadUrl(storagePath: string, expiresInSeconds = 900): Promise<SignedUrlResult> {
    try {
      if (!storagePath) {
        return { signedUrl: null, error: 'Storage path is required.' };
      }

      const { data, error } = await supabase.storage
        .from('attachments')
        .createSignedUrl(storagePath, expiresInSeconds);

      if (error) {
        return { signedUrl: null, error: error.message };
      }

      return { signedUrl: data?.signedUrl || null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to generate signed download URL.';
      return { signedUrl: null, error: message };
    }
  },

  /**
   * Deletes a file: removes the storage object and deletes the database metadata.
   */
  async deleteFile(fileId: string, storagePath?: string): Promise<DeleteFileResult> {
    try {
      if (!fileId) {
        return { success: false, error: 'File ID is required.' };
      }

      // Delete storage object if path provided
      if (storagePath) {
        await supabase.storage.from('attachments').remove([storagePath]).catch(() => {});
      }

      // Delete database metadata
      const { error } = await supabase.from('files').delete().eq('id', fileId);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete file.';
      return { success: false, error: message };
    }
  },
};
