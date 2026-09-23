import type { FileCategory } from '../types';

export const MAX_FILE_SIZE_BYTES = 52428800; // 50MB (Matches Supabase Storage bucket configuration)

export const ALLOWED_MIME_TYPES = new Set<string>([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
]);

const DANGEROUS_EXTENSIONS = new Set<string>([
  'exe',
  'bat',
  'cmd',
  'sh',
  'bash',
  'bin',
  'apk',
  'vbs',
  'msi',
  'com',
  'scr',
  'pif',
  'php',
  'py',
  'rb',
  'pl',
  'js',
  'ts',
  'jsx',
  'tsx',
  'jar',
]);

/**
 * Extracts and normalizes the lowercase extension from a filename.
 */
export function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  if (parts.length <= 1) return '';
  return parts[parts.length - 1]!.toLowerCase().trim();
}

/**
 * Categorizes a file into a high-level UI archetype.
 */
export function getFileCategory(mimeType: string, filename: string): FileCategory {
  const lowerMime = (mimeType || '').toLowerCase();
  const ext = getFileExtension(filename);

  if (lowerMime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) {
    return 'IMAGE';
  }
  if (lowerMime === 'application/pdf' || ext === 'pdf') {
    return 'PDF';
  }
  if (
    lowerMime.includes('word') ||
    lowerMime.includes('document') ||
    ['doc', 'docx', 'rtf'].includes(ext)
  ) {
    return 'DOCUMENT';
  }
  if (
    lowerMime.includes('excel') ||
    lowerMime.includes('spreadsheet') ||
    lowerMime === 'text/csv' ||
    ['xls', 'xlsx', 'csv'].includes(ext)
  ) {
    return 'SPREADSHEET';
  }
  if (lowerMime.startsWith('text/') || ext === 'txt') {
    return 'TEXT';
  }
  return 'OTHER';
}

/**
 * Sanitizes untrusted user filename into a safe storage name.
 * Prevents path traversal, directory injection, and control characters.
 */
export function sanitizeFilename(filename: string): string {
  if (!filename || typeof filename !== 'string') {
    return `file_${Date.now()}`;
  }

  // Strip path traversal, illegal chars, brackets, and hash
  let clean = filename.replace(/[/\\?%*:|"<>#[\]]/g, '_').replace(/\.\./g, '_');

  // Strip control characters and non-printable characters
  clean = clean
    .split('')
    .filter((ch) => {
      const code = ch.charCodeAt(0);
      return code >= 32 && code !== 127;
    })
    .join('');

  // Replace whitespace with underscore
  clean = clean.replace(/\s+/g, '_');

  // Collapse consecutive underscores
  clean = clean.replace(/_+/g, '_');

  const ext = getFileExtension(clean);
  const baseName = ext ? clean.slice(0, clean.lastIndexOf('.')) : clean;

  const sanitizedBase = baseName.replace(/^[_\s]+|[_\s]+$/g, '').slice(0, 100) || `file_${Date.now()}`;

  return ext ? `${sanitizedBase}.${ext}` : sanitizedBase;
}

/**
 * Formats byte counts into human-readable strings (e.g., '14.2 MB').
 */
export function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0 || isNaN(bytes)) return '0 B';
  if (bytes < 1024) return `${bytes} B`;

  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;

  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;

  const gb = mb / 1024;
  return `${gb.toFixed(2)} GB`;
}

/**
 * Validates a file for size, MIME type, dangerous extensions, and naming integrity.
 */
export function validateFile(file: {
  filename: string;
  sizeBytes?: number | null;
  mimeType?: string | null;
}): { valid: boolean; error?: string; category: FileCategory } {
  const trimmedName = (file.filename || '').trim();
  const category = getFileCategory(file.mimeType || '', trimmedName);

  if (!trimmedName || trimmedName.length === 0) {
    return { valid: false, error: 'File name is required.', category };
  }

  if (trimmedName.length > 255) {
    return { valid: false, error: 'File name must not exceed 255 characters.', category };
  }

  // Check dangerous extensions (including double extensions)
  const segments = trimmedName.toLowerCase().split('.');
  if (segments.length > 1) {
    for (let i = 1; i < segments.length; i++) {
      const seg = segments[i]?.trim();
      if (seg && DANGEROUS_EXTENSIONS.has(seg)) {
        return {
          valid: false,
          error: `Executable or script file type (.${seg}) is strictly prohibited for security.`,
          category,
        };
      }
    }
  }

  // Check file size
  if (file.sizeBytes !== undefined && file.sizeBytes !== null) {
    if (file.sizeBytes <= 0) {
      return { valid: false, error: 'File is empty (0 bytes).', category };
    }
    if (file.sizeBytes > MAX_FILE_SIZE_BYTES) {
      return {
        valid: false,
        error: `File size exceeds the 50MB limit (${formatFileSize(file.sizeBytes)}).`,
        category,
      };
    }
  }

  // Check MIME type if present
  if (file.mimeType) {
    const normalizedMime = file.mimeType.toLowerCase().split(';')[0]!.trim();
    if (!ALLOWED_MIME_TYPES.has(normalizedMime)) {
      // If MIME is unknown/generic (application/octet-stream), check extension compatibility
      const ext = getFileExtension(trimmedName);
      const isAllowedExt = [
        'jpg',
        'jpeg',
        'png',
        'webp',
        'gif',
        'pdf',
        'doc',
        'docx',
        'xls',
        'xlsx',
        'csv',
        'txt',
      ].includes(ext);

      if (!isAllowedExt) {
        return {
          valid: false,
          error: `Unsupported file type (${normalizedMime}). Permitted: images, PDF, Word, Excel, and text.`,
          category,
        };
      }
    }
  }

  return { valid: true, category };
}
