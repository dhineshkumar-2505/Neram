/**
 * Neram Media Vault & Attachment Engine Domain Types
 * Governs private group-scoped file storage, metadata, signed download URLs,
 * upload validation, and lifecycle freezing.
 */

export type FileCategory =
  | 'IMAGE'
  | 'PDF'
  | 'DOCUMENT'
  | 'SPREADSHEET'
  | 'TEXT'
  | 'OTHER';

export interface FileUploader {
  userId: string;
  displayName: string;
  username: string;
  avatarUrl?: string | null;
  avatarPath?: string | null;
}

export interface GroupFile {
  id: string;
  groupId: string;
  ownerId: string;
  uploaderId?: string; // alias for ownerId
  filename: string;
  fileName?: string; // alias for filename
  mimeType: string;
  sizeBytes: number;
  fileSize?: number; // alias for sizeBytes
  storagePath: string;
  createdAt: string;
  category: FileCategory;
  uploader?: FileUploader;
}

export interface UploadFileInput {
  groupId: string;
  fileUri?: string;
  filename: string;
  mimeType?: string | null;
  fileSize?: number | null;
  fileBody?: Blob | ArrayBuffer | Uint8Array;
}

export interface UploadFileResult {
  success: boolean;
  file?: GroupFile;
  error?: string;
}

export interface SignedUrlResult {
  signedUrl: string | null;
  error?: string;
}

export interface FetchFilesResult {
  files: GroupFile[];
  error?: string;
}

export interface DeleteFileResult {
  success: boolean;
  error?: string;
}

export type FileFilterTab = 'ALL' | 'IMAGES' | 'DOCUMENTS';
