import React from 'react';
import { View, StyleSheet, Pressable, Alert } from 'react-native';
import { tokens } from '../../../design';
import Text from '../../../components/Text';
import {
  FileGenericIcon,
  ImageIcon,
  PdfIcon,
  DocIcon,
  SheetIcon,
  TextFileIcon,
  DownloadIcon,
  TrashIcon,
} from './FileIcons';
import type { GroupFile } from '../types';
import { formatFileSize } from '../services/fileValidationService';

export interface FileCardProps {
  file: GroupFile;
  currentUserId?: string;
  isExpired?: boolean;
  onOpen: (file: GroupFile) => void;
  onDelete?: (file: GroupFile) => void;
}

function formatRelativeTime(dateString: string): string {
  try {
    const diffMs = Date.now() - new Date(dateString).getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSec < 60) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    return `${diffDays}d ago`;
  } catch {
    return dateString;
  }
}

export const FileCard: React.FC<FileCardProps> = ({
  file,
  currentUserId,
  isExpired = false,
  onOpen,
  onDelete,
}) => {
  const isOwner = Boolean(currentUserId && file.ownerId === currentUserId);

  const renderCategoryIcon = () => {
    switch (file.category) {
      case 'IMAGE':
        return <ImageIcon size={22} color="#38BDF8" />;
      case 'PDF':
        return <PdfIcon size={22} color="#EF4444" />;
      case 'DOCUMENT':
        return <DocIcon size={22} color="#818CF8" />;
      case 'SPREADSHEET':
        return <SheetIcon size={22} color="#10B981" />;
      case 'TEXT':
        return <TextFileIcon size={22} color="#F59E0B" />;
      case 'OTHER':
      default:
        return <FileGenericIcon size={22} color="#94A3B8" />;
    }
  };

  const handleDeletePress = () => {
    if (isExpired) {
      Alert.alert(
        'Space Expired',
        'This space has dissolved. The Media Vault has been frozen in read-only archive mode.',
        [{ text: 'Understood' }],
      );
      return;
    }

    Alert.alert(
      'Delete Attachment',
      `Are you sure you want to permanently remove "${file.filename}" from the vault?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => onDelete && onDelete(file),
        },
      ],
    );
  };

  return (
    <View style={styles.card}>
      {/* File Icon Container */}
      <View
        style={[
          styles.iconContainer,
          file.category === 'IMAGE' && styles.iconContainerImage,
          file.category === 'PDF' && styles.iconContainerPdf,
          file.category === 'DOCUMENT' && styles.iconContainerDoc,
          file.category === 'SPREADSHEET' && styles.iconContainerSheet,
        ]}
      >
        {renderCategoryIcon()}
      </View>

      {/* File Info Center */}
      <View style={styles.infoContainer}>
        <Text variant="callout" style={styles.filename} numberOfLines={1}>
          {file.filename}
        </Text>

        <View style={styles.metaRow}>
          <Text variant="caption" style={styles.metaText}>
            {formatFileSize(file.sizeBytes)}
          </Text>
          <Text variant="caption" style={styles.metaDot}>
            •
          </Text>
          <Text variant="caption" style={styles.metaText}>
            {formatRelativeTime(file.createdAt)}
          </Text>
          {file.uploader && (
            <>
              <Text variant="caption" style={styles.metaDot}>
                •
              </Text>
              <Text variant="caption" style={styles.uploaderText} numberOfLines={1}>
                @{file.uploader.username}
              </Text>
            </>
          )}
        </View>
      </View>

      {/* Action Buttons Right */}
      <View style={styles.actionsRow}>
        <Pressable
          style={({ pressed }) => [styles.actionButton, pressed && styles.actionButtonPressed]}
          onPress={() => onOpen(file)}
          accessibilityLabel="Download or View File"
        >
          <DownloadIcon size={18} color="#10B981" />
        </Pressable>

        {!isExpired && (isOwner || onDelete) && (
          <Pressable
            style={({ pressed }) => [styles.actionButton, pressed && styles.actionButtonPressed]}
            onPress={handleDeletePress}
            accessibilityLabel="Delete File"
          >
            <TrashIcon size={18} color="#EF4444" />
          </Pressable>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#13151A',
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.border.subtle,
    padding: tokens.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: tokens.spacing.sm,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: tokens.radius.md,
    backgroundColor: '#1A1D24',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: tokens.spacing.md,
  },
  iconContainerImage: {
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
  },
  iconContainerPdf: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  iconContainerDoc: {
    backgroundColor: 'rgba(129, 140, 248, 0.1)',
  },
  iconContainerSheet: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  infoContainer: {
    flex: 1,
    justifyContent: 'center',
    marginRight: tokens.spacing.sm,
  },
  filename: {
    color: tokens.colors.text.primary,
    fontWeight: '600',
    marginBottom: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  metaText: {
    color: tokens.colors.text.tertiary,
    fontSize: 11,
  },
  metaDot: {
    color: tokens.colors.text.tertiary,
    marginHorizontal: 4,
    fontSize: 10,
  },
  uploaderText: {
    color: '#818CF8',
    fontSize: 11,
    fontWeight: '500',
    maxWidth: 100,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionButton: {
    padding: 8,
    borderRadius: tokens.radius.sm,
    backgroundColor: '#1A1D24',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonPressed: {
    opacity: 0.7,
  },
});

export default FileCard;
