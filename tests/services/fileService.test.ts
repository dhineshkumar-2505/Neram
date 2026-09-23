import { fileService } from '../../src/features/files/services/fileService';
import {
  validateFile,
  sanitizeFilename,
  formatFileSize,
  getFileCategory,
} from '../../src/features/files/services/fileValidationService';
import { supabase } from '../../src/lib/supabase';

jest.mock('../../src/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    storage: {
      from: jest.fn(),
    },
  },
}));

describe('fileValidationService', () => {
  describe('validateFile', () => {
    it('approves valid image and document files within size limit', () => {
      const validImage = validateFile({
        filename: 'photo.jpg',
        sizeBytes: 1024 * 1024,
        mimeType: 'image/jpeg',
      });
      expect(validImage.valid).toBe(true);

      const validPdf = validateFile({
        filename: 'report.pdf',
        sizeBytes: 5 * 1024 * 1024,
        mimeType: 'application/pdf',
      });
      expect(validPdf.valid).toBe(true);
    });

    it('rejects files exceeding 50MB', () => {
      const overLimit = 52428800 + 1;
      const res = validateFile({
        filename: 'large_video.mp4',
        sizeBytes: overLimit,
        mimeType: 'video/mp4',
      });
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/exceeds/i);
    });

    it('rejects dangerous executable extensions and scripts', () => {
      const dangerousFiles = [
        'malware.exe',
        'script.sh',
        'virus.bat',
        'exploit.php',
        'app.apk',
      ];
      for (const name of dangerousFiles) {
        const res = validateFile({ filename: name, sizeBytes: 1024 });
        expect(res.valid).toBe(false);
        expect(res.error).toMatch(/prohibited for security/i);
      }
    });

    it('rejects dangerous double extensions', () => {
      const res = validateFile({ filename: 'invoice.pdf.exe', sizeBytes: 2048 });
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/prohibited for security/i);
    });

    it('rejects unsupported mime types', () => {
      const res = validateFile({
        filename: 'audio.wav',
        sizeBytes: 1024,
        mimeType: 'audio/x-wav',
      });
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/unsupported file type/i);
    });
  });

  describe('sanitizeFilename', () => {
    it('cleans special characters and collapses whitespace and dashes', () => {
      expect(sanitizeFilename('my test file #1 [v2]?.pdf')).toBe('my_test_file_1_v2.pdf');
      expect(sanitizeFilename('   spaces   .png')).toBe('spaces.png');
    });

    it('handles empty or extensionless inputs safely', () => {
      expect(sanitizeFilename('')).toMatch(/^file_\d+$/);
      expect(sanitizeFilename('noextension')).toBe('noextension');
    });
  });

  describe('formatFileSize', () => {
    it('formats bytes, KB, MB correctly', () => {
      expect(formatFileSize(500)).toBe('500 B');
      expect(formatFileSize(2048)).toBe('2.0 KB');
      expect(formatFileSize(5 * 1024 * 1024)).toBe('5.0 MB');
    });
  });

  describe('getFileCategory', () => {
    it('identifies image, pdf, document, spreadsheet, and text', () => {
      expect(getFileCategory('image/png', 'img.png')).toBe('IMAGE');
      expect(getFileCategory('application/pdf', 'doc.pdf')).toBe('PDF');
      expect(getFileCategory('application/msword', 'doc.docx')).toBe('DOCUMENT');
      expect(getFileCategory('text/csv', 'data.csv')).toBe('SPREADSHEET');
      expect(getFileCategory('text/plain', 'note.txt')).toBe('TEXT');
      expect(getFileCategory('application/octet-stream', 'unknown.bin')).toBe('OTHER');
    });
  });
});

describe('fileService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('listFiles', () => {
    it('fetches files for a group and formats domain GroupFile records', async () => {
      const mockRawRows = [
        {
          id: 'file_1',
          group_id: 'grp_123',
          owner_id: 'user_1',
          filename: 'contract.pdf',
          mime_type: 'application/pdf',
          size_bytes: 1048576,
          storage_path: 'grp_123/file_1/contract.pdf',
          created_at: '2026-09-23T12:00:00Z',
          uploader: {
            user_id: 'user_1',
            display_name: 'David Owner',
            username: 'david',
            avatar_path: null,
          },
        },
      ];

      const mockOrder = jest.fn().mockResolvedValue({ data: mockRawRows, error: null });
      const mockEq = jest.fn().mockReturnValue({ order: mockOrder });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });

      (supabase.from as jest.Mock).mockReturnValue({ select: mockSelect });

      const result = await fileService.listFiles('grp_123', 'user_1');

      expect(supabase.from).toHaveBeenCalledWith('files');
      expect(mockEq).toHaveBeenCalledWith('group_id', 'grp_123');
      expect(mockOrder).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(result.files).toHaveLength(1);
      expect(result.files[0]?.filename).toBe('contract.pdf');
      expect(result.files[0]?.category).toBe('PDF');
      expect(result.files[0]?.uploader?.displayName).toBe('David Owner');
    });

    it('returns error when group ID is missing', async () => {
      const result = await fileService.listFiles('');
      expect(result.error).toBe('Group ID is required.');
      expect(result.files).toEqual([]);
    });
  });

  describe('uploadFile', () => {
    it('performs two-phase upload and returns created GroupFile', async () => {
      const mockUpload = jest.fn().mockResolvedValue({
        data: { path: 'grp_1/uuid-123/test.jpg' },
        error: null,
      });
      const mockStorageFrom = jest.fn().mockReturnValue({ upload: mockUpload });
      (supabase.storage.from as jest.Mock) = mockStorageFrom;

      const mockSingle = jest.fn().mockResolvedValue({
        data: {
          id: 'file_created_1',
          group_id: 'grp_1',
          owner_id: 'user_1',
          filename: 'test.jpg',
          mime_type: 'image/jpeg',
          size_bytes: 2048,
          storage_path: 'grp_1/uuid-123/test.jpg',
          created_at: '2026-09-23T12:00:00Z',
        },
        error: null,
      });
      const mockSelect = jest.fn().mockReturnValue({ single: mockSingle });
      const mockInsert = jest.fn().mockReturnValue({ select: mockSelect });
      (supabase.from as jest.Mock).mockReturnValue({ insert: mockInsert });

      const result = await fileService.uploadFile(
        {
          groupId: 'grp_1',
          filename: 'test.jpg',
          fileBody: new Uint8Array([1, 2, 3]),
          fileSize: 2048,
          mimeType: 'image/jpeg',
        },
        'user_1',
      );

      expect(mockStorageFrom).toHaveBeenCalledWith('attachments');
      expect(mockUpload).toHaveBeenCalled();
      expect(mockInsert).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.file?.filename).toBe('test.jpg');
    });

    it('rolls back orphan storage object if database insert fails', async () => {
      const mockUpload = jest.fn().mockResolvedValue({
        data: { path: 'grp_1/uuid-123/test.jpg' },
        error: null,
      });
      const mockRemove = jest.fn().mockResolvedValue({ data: {}, error: null });
      const mockStorageFrom = jest.fn().mockReturnValue({
        upload: mockUpload,
        remove: mockRemove,
      });
      (supabase.storage.from as jest.Mock) = mockStorageFrom;

      const mockSingle = jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'Foreign key constraint violated' },
      });
      const mockSelect = jest.fn().mockReturnValue({ single: mockSingle });
      const mockInsert = jest.fn().mockReturnValue({ select: mockSelect });
      (supabase.from as jest.Mock).mockReturnValue({ insert: mockInsert });

      const result = await fileService.uploadFile(
        {
          groupId: 'grp_1',
          filename: 'test.jpg',
          fileBody: new Uint8Array([1, 2, 3]),
          fileSize: 2048,
          mimeType: 'image/jpeg',
        },
        'user_1',
      );

      expect(mockUpload).toHaveBeenCalled();
      expect(mockInsert).toHaveBeenCalled();
      // Storage rollback MUST have been triggered
      expect(mockRemove).toHaveBeenCalled();
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/foreign key constraint violated/i);
    });

    it('blocks upload if client-side validation fails', async () => {
      const result = await fileService.uploadFile(
        {
          groupId: 'grp_1',
          filename: 'trojan.exe',
          fileBody: new Uint8Array([1]),
          fileSize: 100,
          mimeType: 'application/x-msdownload',
        },
        'user_1',
      );

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/prohibited for security/i);
      expect(supabase.storage.from).not.toHaveBeenCalled();
    });
  });

  describe('getSignedDownloadUrl', () => {
    it('creates a time-bound signed URL for private attachments', async () => {
      const mockCreateSignedUrl = jest.fn().mockResolvedValue({
        data: { signedUrl: 'https://supabase.co/storage/v1/object/sign/attachments/file.pdf?token=abc' },
        error: null,
      });
      (supabase.storage.from as jest.Mock).mockReturnValue({
        createSignedUrl: mockCreateSignedUrl,
      });

      const res = await fileService.getSignedDownloadUrl('grp_1/file_1/file.pdf', 900);

      expect(mockCreateSignedUrl).toHaveBeenCalledWith('grp_1/file_1/file.pdf', 900);
      expect(res.signedUrl).toContain('token=abc');
      expect(res.error).toBeUndefined();
    });

    it('returns error if storage path is empty', async () => {
      const res = await fileService.getSignedDownloadUrl('');
      expect(res.error).toBe('Storage path is required.');
    });
  });

  describe('deleteFile', () => {
    it('deletes database record and storage object', async () => {
      const mockDeleteEq = jest.fn().mockResolvedValue({ error: null });
      const mockDelete = jest.fn().mockReturnValue({ eq: mockDeleteEq });
      (supabase.from as jest.Mock).mockReturnValue({ delete: mockDelete });

      const mockRemove = jest.fn().mockResolvedValue({ error: null });
      (supabase.storage.from as jest.Mock).mockReturnValue({ remove: mockRemove });

      const res = await fileService.deleteFile('file_1', 'grp_1/file_1/test.pdf');

      expect(supabase.from).toHaveBeenCalledWith('files');
      expect(mockDeleteEq).toHaveBeenCalledWith('id', 'file_1');
      expect(mockRemove).toHaveBeenCalledWith(['grp_1/file_1/test.pdf']);
      expect(res.success).toBe(true);
    });
  });
});
