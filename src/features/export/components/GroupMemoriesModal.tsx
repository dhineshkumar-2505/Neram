import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { tokens } from '../../../design';
import { haptics } from '../../../utils/haptics';
import { CloseIcon, CheckIcon, SuccessCircleIcon } from '../../../components/icons/CommonIcons';
import { groupMemoriesExportService } from '../services/groupMemoriesExportService';
import type { ExportProgress, ExportResult } from '../types';

export interface GroupMemoriesModalProps {
  visible: boolean;
  groupId: string;
  groupName: string;
  onClose: () => void;
}

export const GroupMemoriesModal: React.FC<GroupMemoriesModalProps> = ({
  visible,
  groupId,
  groupName,
  onClose,
}) => {
  const [exporting, setExporting] = useState<boolean>(false);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [result, setResult] = useState<ExportResult | null>(null);
  const [includeMedia, setIncludeMedia] = useState<boolean>(true);
  const [includeAudio, setIncludeAudio] = useState<boolean>(true);

  const handleStartExport = async () => {
    setExporting(true);
    setResult(null);
    haptics.selection();

    const res = await groupMemoriesExportService.exportGroupMemories(
      groupId,
      (p) => setProgress(p),
      { includeMedia, includeAudio },
    );

    setExporting(false);
    setResult(res);

    if (res.success) {
      haptics.success();
    } else {
      haptics.error();
    }
  };

  const handleClose = () => {
    if (exporting) return;
    setProgress(null);
    setResult(null);
    onClose();
  };

  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.categoryLabel}>GROUP MEMORIES</Text>
            {!exporting && (
              <TouchableOpacity
                onPress={handleClose}
                style={styles.closeButton}
                accessibilityLabel="Close"
              >
                <CloseIcon size={20} color="#94A3B8" />
              </TouchableOpacity>
            )}
          </View>

          <Text style={styles.titleText}>Preserve Space Archive</Text>
          <Text style={styles.subtitleText}>
            Export your group chat recap, tasks, itinerary, photos, and voice notes into
            a single ZIP archive before this space dissolves permanently.
          </Text>

          {/* Export in Progress View */}
          {exporting && progress ? (
            <View style={styles.progressContainer}>
              <View style={styles.progressBarBackground}>
                <View
                  style={[
                    styles.progressBarFill,
                    { width: `${progress.progressPercent}%` },
                  ]}
                />
              </View>

              <View style={styles.progressMeta}>
                <Text style={styles.statusText}>{progress.statusMessage}</Text>
                <Text style={styles.percentText}>{progress.progressPercent}%</Text>
              </View>

              <ActivityIndicator
                size="small"
                color="#00FF9D"
                style={styles.loaderSpacing}
              />
            </View>
          ) : result?.success ? (
            /* Export Success View */
            <View style={styles.successContainer}>
              <SuccessCircleIcon size={36} color="#00FF9D" />
              <Text style={styles.successTitle}>Archive Created</Text>
              <Text style={styles.successDetails}>
                All memories from {groupName} were compressed and dispatched to your share sheet.
                {result.byteSize ? ` (${formatFileSize(result.byteSize)})` : ''}
              </Text>
              <TouchableOpacity
                style={styles.doneButton}
                onPress={handleClose}
              >
                <Text style={styles.doneButtonText}>Done</Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* Pre-Export Options View */
            <View style={styles.optionsContainer}>
              {/* Option: Include Photos */}
              <TouchableOpacity
                style={styles.optionRow}
                onPress={() => setIncludeMedia(!includeMedia)}
              >
                <View style={[styles.checkbox, includeMedia && styles.checkboxActive]}>
                  {includeMedia && <CheckIcon size={14} color="#0B0F19" />}
                </View>
                <View style={styles.optionTextCol}>
                  <Text style={styles.optionLabel}>Include Media Vault Photos</Text>
                  <Text style={styles.optionDescription}>
                    Embed all photos uploaded during the group duration
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Option: Include Voice Notes */}
              <TouchableOpacity
                style={styles.optionRow}
                onPress={() => setIncludeAudio(!includeAudio)}
              >
                <View style={[styles.checkbox, includeAudio && styles.checkboxActive]}>
                  {includeAudio && <CheckIcon size={14} color="#0B0F19" />}
                </View>
                <View style={styles.optionTextCol}>
                  <Text style={styles.optionLabel}>Include Audio & Voice Notes</Text>
                  <Text style={styles.optionDescription}>
                    Include all recorded voice messages in M4A format
                  </Text>
                </View>
              </TouchableOpacity>

              {result?.error ? (
                <Text style={styles.errorText}>{result.error}</Text>
              ) : null}

              {/* Trigger Button */}
              <TouchableOpacity
                style={styles.exportButton}
                onPress={handleStartExport}
              >
                <Text style={styles.exportButtonText}>Generate & Share Archive</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 8, 16, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: tokens.spacing.md,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#111827',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1F2937',
    padding: tokens.spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tokens.spacing.xs,
  },
  categoryLabel: {
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.semiBold,
    color: '#00FF9D',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  closeButton: {
    padding: tokens.spacing.xs,
  },
  titleText: {
    fontSize: 18,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#F8FAFC',
    marginBottom: tokens.spacing.xxs,
  },
  subtitleText: {
    fontSize: 13,
    color: '#94A3B8',
    lineHeight: 18,
    marginBottom: tokens.spacing.md,
    fontFamily: tokens.typography.fontFamily.regular,
  },
  optionsContainer: {
    gap: tokens.spacing.sm,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161F30',
    borderRadius: 12,
    padding: tokens.spacing.md,
    borderWidth: 1,
    borderColor: '#26334D',
    gap: tokens.spacing.sm,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#64748B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: '#00FF9D',
    borderColor: '#00FF9D',
  },
  optionTextCol: {
    flex: 1,
  },
  optionLabel: {
    color: '#F8FAFC',
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.semiBold,
    marginBottom: 2,
  },
  optionDescription: {
    color: '#94A3B8',
    fontSize: 12,
    fontFamily: tokens.typography.fontFamily.regular,
  },
  exportButton: {
    backgroundColor: '#00FF9D',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: tokens.spacing.xs,
  },
  exportButtonText: {
    color: '#0B0F19',
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.semiBold,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    textAlign: 'center',
  },
  progressContainer: {
    paddingVertical: tokens.spacing.md,
  },
  progressBarBackground: {
    width: '100%',
    height: 8,
    borderRadius: 4,
    backgroundColor: '#1E293B',
    overflow: 'hidden',
    marginBottom: tokens.spacing.sm,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#00FF9D',
    borderRadius: 4,
  },
  progressMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusText: {
    color: '#94A3B8',
    fontSize: 12,
    flex: 1,
    fontFamily: tokens.typography.fontFamily.regular,
  },
  percentText: {
    color: '#00FF9D',
    fontSize: 12,
    fontFamily: tokens.typography.fontFamily.semiBold,
    marginLeft: tokens.spacing.sm,
  },
  loaderSpacing: {
    marginTop: tokens.spacing.md,
  },
  successContainer: {
    paddingVertical: tokens.spacing.lg,
    alignItems: 'center',
  },
  successTitle: {
    fontSize: 16,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#F8FAFC',
    marginTop: tokens.spacing.sm,
    marginBottom: 4,
  },
  successDetails: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: tokens.spacing.lg,
    fontFamily: tokens.typography.fontFamily.regular,
  },
  doneButton: {
    backgroundColor: '#1E293B',
    paddingHorizontal: tokens.spacing.xl,
    paddingVertical: 10,
    borderRadius: 10,
  },
  doneButtonText: {
    color: '#F8FAFC',
    fontSize: 13,
    fontFamily: tokens.typography.fontFamily.medium,
  },
});

export default GroupMemoriesModal;
