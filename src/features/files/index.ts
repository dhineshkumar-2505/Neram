// Types
export * from './types';

// Services
export { fileService } from './services/fileService';
export {
  validateFile,
  formatFileSize,
  getFileCategory,
  sanitizeFilename,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
} from './services/fileValidationService';

// Hooks
export { useMediaVault } from './hooks/useMediaVault';
export type { UseMediaVaultResult } from './hooks/useMediaVault';

// Components
export { FileCard } from './components/FileCard';
export type { FileCardProps } from './components/FileCard';
export { UploadModal } from './components/UploadModal';
export type { UploadModalProps } from './components/UploadModal';
export * from './components/FileIcons';

// Screens
import { MediaVaultScreen } from './screens/MediaVaultScreen';
export { MediaVaultScreen };
export default MediaVaultScreen;

