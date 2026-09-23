import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  Pressable,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { tokens } from '../../../design';
import Text from '../../../components/Text';
import {
  UploadIcon,
  CloseIcon,
  FileGenericIcon,
  ImageIcon,
  PdfIcon,
  DocIcon,
  SheetIcon,
  TextFileIcon,
} from './FileIcons';
import {
  validateFile,
  formatFileSize,
  getFileCategory,
} from '../services/fileValidationService';
import type { UploadFileInput } from '../types';

export interface UploadModalProps {
  visible: boolean;
  onClose: () => void;
  onUpload: (
    input: Omit<UploadFileInput, 'groupId'>,
  ) => Promise<{ success: boolean; error?: string }>;
}

interface PickedFile {
  uri: string;
  name: string;
  size: number | null;
  mimeType: string | null;
}

export const UploadModal: React.FC<UploadModalProps> = ({
  visible,
  onClose,
  onUpload,
}) => {
  const [selectedFile, setSelectedFile] = useState<PickedFile | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const resetForm = () => {
    setSelectedFile(null);
    setIsUploading(false);
    setErrorText(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handlePickDocument = async () => {
    setErrorText(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0]!;
        const picked: PickedFile = {
          uri: asset.uri,
          name: asset.name,
          size: asset.size ?? null,
          mimeType: asset.mimeType ?? null,
        };

        // Instant validation check
        const validation = validateFile({
          filename: picked.name,
          sizeBytes: picked.size,
          mimeType: picked.mimeType,
        });

        if (!validation.valid) {
          setErrorText(validation.error || 'Selected file is invalid.');
          setSelectedFile(null);
          return;
        }

        setSelectedFile(picked);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to select document.';
      setErrorText(message);
    }
  };

  const handleSubmit = async () => {
    if (!selectedFile) {
      setErrorText('Please select a file to upload.');
      return;
    }

    try {
      setIsUploading(true);
      setErrorText(null);

      const res = await onUpload({
        fileUri: selectedFile.uri,
        filename: selectedFile.name,
        fileSize: selectedFile.size,
        mimeType: selectedFile.mimeType,
      });

      if (!res.success) {
        setErrorText(res.error || 'Upload failed.');
        setIsUploading(false);
        return;
      }

      handleClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Upload transaction failed.';
      setErrorText(message);
      setIsUploading(false);
    }
  };

  const fileCategory = selectedFile
    ? getFileCategory(selectedFile.mimeType || '', selectedFile.name)
    : 'OTHER';

  const renderSelectedCategoryIcon = () => {
    switch (fileCategory) {
      case 'IMAGE':
        return <ImageIcon size={28} color="#38BDF8" />;
      case 'PDF':
        return <PdfIcon size={28} color="#EF4444" />;
      case 'DOCUMENT':
        return <DocIcon size={28} color="#818CF8" />;
      case 'SPREADSHEET':
        return <SheetIcon size={28} color="#10B981" />;
      case 'TEXT':
        return <TextFileIcon size={28} color="#F59E0B" />;
      case 'OTHER':
      default:
        return <FileGenericIcon size={28} color="#94A3B8" />;
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={styles.headerTitleRow}>
              <UploadIcon size={20} color={tokens.colors.primary.default} />
              <Text variant="title3" style={styles.headerTitle}>
                Upload Attachment
              </Text>
            </View>

            <Pressable
              onPress={handleClose}
              style={({ pressed }) => [styles.closeButton, pressed && styles.closeButtonPressed]}
              accessibilityLabel="Close"
            >
              <CloseIcon size={20} color={tokens.colors.text.secondary} />
            </Pressable>
          </View>

          {/* Content */}
          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Error Banner */}
            {Boolean(errorText) && (
              <View style={styles.errorBanner}>
                <Text variant="caption" style={styles.errorText}>
                  {errorText}
                </Text>
              </View>
            )}

            {/* Select File Dropzone */}
            <Pressable
              style={({ pressed }) => [
                styles.dropzone,
                Boolean(selectedFile) && styles.dropzoneSelected,
                pressed && styles.dropzonePressed,
              ]}
              onPress={handlePickDocument}
              disabled={isUploading}
            >
              {selectedFile ? (
                <View style={styles.selectedFilePreview}>
                  <View style={styles.selectedIconContainer}>
                    {renderSelectedCategoryIcon()}
                  </View>
                  <View style={styles.selectedFileText}>
                    <Text variant="callout" style={styles.selectedFileName} numberOfLines={1}>
                      {selectedFile.name}
                    </Text>
                    <Text variant="caption" style={styles.selectedFileSize}>
                      {formatFileSize(selectedFile.size || 0)} • {fileCategory}
                    </Text>
                    <Text variant="caption" style={styles.changeFilePrompt}>
                      Tap to change file
                    </Text>
                  </View>
                </View>
              ) : (
                <View style={styles.dropzoneEmpty}>
                  <View style={styles.emptyUploadIcon}>
                    <UploadIcon size={24} color="#818CF8" />
                  </View>
                  <Text variant="callout" style={styles.dropzoneTitle}>
                    Browse Files or Photos
                  </Text>
                  <Text variant="caption" style={styles.dropzoneSubtitle}>
                    Images, PDFs, Word, Excel, CSV up to 50MB
                  </Text>
                </View>
              )}
            </Pressable>

            {/* Security Notice */}
            <View style={styles.securityBox}>
              <Text variant="caption" style={styles.securityTitle}>
                Private Group Storage
              </Text>
              <Text variant="caption" style={styles.securityDesc}>
                Files uploaded to the Media Vault are encrypted in a private bucket with signed download tokens. Only active members of this space can access attachments.
              </Text>
            </View>
          </ScrollView>

          {/* Footer Submit Button */}
          <View style={styles.modalFooter}>
            <Pressable
              style={({ pressed }) => [
                styles.submitButton,
                (!selectedFile || isUploading) && styles.submitButtonDisabled,
                pressed && styles.submitButtonPressed,
              ]}
              onPress={handleSubmit}
              disabled={!selectedFile || isUploading}
            >
              {isUploading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text variant="callout" style={styles.submitButtonText}>
                  Upload to Vault
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#12141A',
    borderTopLeftRadius: tokens.radius.lg,
    borderTopRightRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.colors.border.subtle,
    maxHeight: '85%',
    paddingBottom: tokens.spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing.md,
    paddingTop: tokens.spacing.md,
    paddingBottom: tokens.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    color: tokens.colors.text.primary,
    fontWeight: '700',
  },
  closeButton: {
    padding: 6,
    borderRadius: tokens.radius.full,
    backgroundColor: '#1B1E26',
  },
  closeButtonPressed: {
    opacity: 0.7,
  },
  scrollArea: {
    paddingHorizontal: tokens.spacing.md,
  },
  scrollContent: {
    paddingTop: tokens.spacing.md,
    paddingBottom: tokens.spacing.lg,
  },
  errorBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderWidth: 1,
    borderRadius: tokens.radius.sm,
    padding: tokens.spacing.sm,
    marginBottom: tokens.spacing.md,
  },
  errorText: {
    color: '#EF4444',
    fontWeight: '500',
  },
  dropzone: {
    borderWidth: 2,
    borderColor: 'rgba(129, 140, 248, 0.25)',
    borderStyle: 'dashed',
    borderRadius: tokens.radius.md,
    backgroundColor: '#151821',
    padding: tokens.spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: tokens.spacing.md,
  },
  dropzoneSelected: {
    borderColor: 'rgba(16, 185, 129, 0.4)',
    borderStyle: 'solid',
    backgroundColor: 'rgba(16, 185, 129, 0.04)',
  },
  dropzonePressed: {
    opacity: 0.85,
  },
  dropzoneEmpty: {
    alignItems: 'center',
  },
  emptyUploadIcon: {
    width: 48,
    height: 48,
    borderRadius: tokens.radius.full,
    backgroundColor: 'rgba(129, 140, 248, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: tokens.spacing.sm,
  },
  dropzoneTitle: {
    color: tokens.colors.text.primary,
    fontWeight: '600',
    marginBottom: 4,
  },
  dropzoneSubtitle: {
    color: tokens.colors.text.tertiary,
    fontSize: 11,
  },
  selectedFilePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  selectedIconContainer: {
    width: 50,
    height: 50,
    borderRadius: tokens.radius.md,
    backgroundColor: '#1E232F',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: tokens.spacing.md,
  },
  selectedFileText: {
    flex: 1,
  },
  selectedFileName: {
    color: tokens.colors.text.primary,
    fontWeight: '600',
  },
  selectedFileSize: {
    color: '#10B981',
    fontWeight: '500',
    marginTop: 2,
  },
  changeFilePrompt: {
    color: tokens.colors.text.tertiary,
    fontSize: 10,
    marginTop: 2,
  },
  securityBox: {
    backgroundColor: '#14171E',
    borderRadius: tokens.radius.sm,
    padding: tokens.spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  securityTitle: {
    color: tokens.colors.text.secondary,
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  securityDesc: {
    color: tokens.colors.text.tertiary,
    fontSize: 11,
    lineHeight: 16,
  },
  modalFooter: {
    paddingHorizontal: tokens.spacing.md,
    paddingTop: tokens.spacing.xs,
  },
  submitButton: {
    backgroundColor: tokens.colors.primary.default,
    borderRadius: tokens.radius.md,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});

export default UploadModal;
