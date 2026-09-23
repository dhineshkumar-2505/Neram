import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { tokens } from '../../../design';
import { inviteService } from '../services/inviteService';
import { haptics } from '../../../utils/haptics';
import { CloseIcon, CheckIcon } from '../../../components/icons/CommonIcons';
import type { InvitePreviewResult } from '../types';

interface JoinGroupModalProps {
  visible: boolean;
  token: string;
  onClose: () => void;
  onSuccess: (groupId: string, groupName: string) => void;
}

export const JoinGroupModal: React.FC<JoinGroupModalProps> = ({
  visible,
  token,
  onClose,
  onSuccess,
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [joining, setJoining] = useState<boolean>(false);
  const [preview, setPreview] = useState<InvitePreviewResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchPreview = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);

    const res = await inviteService.previewInvite(token);
    setPreview(res);
    setLoading(false);

    if (!res.valid) {
      haptics.error();
    } else {
      haptics.selection();
    }
  }, [token]);

  useEffect(() => {
    if (visible && token) {
      fetchPreview();
    }
  }, [visible, token, fetchPreview]);

  const handleJoin = async () => {
    if (!preview?.valid || !preview.groupId) return;

    if (preview.isAlreadyMember) {
      onSuccess(preview.groupId, preview.groupName || 'Temporary Space');
      return;
    }

    setJoining(true);
    setErrorMessage(null);
    haptics.tick();

    const res = await inviteService.joinViaInvite(token);

    if (res.success && res.groupId) {
      haptics.success();
      onSuccess(res.groupId, res.groupName || preview.groupName || 'Temporary Space');
    } else {
      haptics.error();
      setErrorMessage(res.error || 'Failed to join group. Please try again.');
      setJoining(false);
    }
  };

  const getReasonMessage = (reason?: string): string => {
    switch (reason) {
      case 'INVITE_REVOKED':
        return 'This invitation code has been revoked by the space administrator.';
      case 'INVITE_EXPIRED':
        return 'This invitation code has expired.';
      case 'MAX_USES_REACHED':
        return 'This invitation code has reached its maximum allowed member limit.';
      case 'GROUP_EXPIRED':
        return 'This temporary space has already dissolved and expired.';
      default:
        return 'This invitation code is invalid or could not be found.';
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.categoryLabel}>SPACE INVITATION</Text>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeButton}
              accessibilityLabel="Close"
            >
              <CloseIcon size={20} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#00FF9D" />
              <Text style={styles.loadingText}>Validating invitation code...</Text>
            </View>
          ) : !preview?.valid ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorTitle}>Invalid Invitation</Text>
              <Text style={styles.errorDescription}>
                {getReasonMessage(preview?.reason)}
              </Text>
              <TouchableOpacity
                style={styles.dismissButton}
                onPress={onClose}
              >
                <Text style={styles.dismissButtonText}>Dismiss</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.contentContainer}>
              {/* Space Information Card */}
              <View style={styles.infoCard}>
                <Text style={styles.spaceName} numberOfLines={2}>
                  {preview.groupName}
                </Text>
                {preview.purpose ? (
                  <Text style={styles.purposeText} numberOfLines={3}>
                    {preview.purpose}
                  </Text>
                ) : null}

                <View style={styles.metaRow}>
                  <View style={styles.metaBadge}>
                    <Text style={styles.metaBadgeText}>
                      {preview.memberCount} {preview.memberCount === 1 ? 'member' : 'members'}
                    </Text>
                  </View>

                  {preview.inviterName ? (
                    <Text style={styles.inviterText} numberOfLines={1}>
                      Invited by {preview.inviterName}
                    </Text>
                  ) : null}
                </View>
              </View>

              {errorMessage ? (
                <Text style={styles.errorMessageText}>{errorMessage}</Text>
              ) : null}

              {/* Action Button */}
              <TouchableOpacity
                style={[
                  styles.joinButton,
                  preview.isAlreadyMember && styles.alreadyMemberButton,
                ]}
                onPress={handleJoin}
                disabled={joining}
              >
                {joining ? (
                  <ActivityIndicator size="small" color="#0B0F19" />
                ) : preview.isAlreadyMember ? (
                  <View style={styles.buttonRow}>
                    <CheckIcon size={16} color="#F8FAFC" />
                    <Text style={styles.alreadyMemberButtonText}>Enter Space</Text>
                  </View>
                ) : (
                  <Text style={styles.joinButtonText}>Join Temporary Space</Text>
                )}
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
    maxWidth: 360,
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
    marginBottom: tokens.spacing.md,
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
  loadingContainer: {
    paddingVertical: tokens.spacing.xxl,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: tokens.spacing.sm,
    fontSize: 13,
    color: '#94A3B8',
    fontFamily: tokens.typography.fontFamily.regular,
  },
  errorContainer: {
    paddingVertical: tokens.spacing.lg,
    alignItems: 'center',
  },
  errorTitle: {
    fontSize: 16,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#EF4444',
    marginBottom: tokens.spacing.xs,
  },
  errorDescription: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: tokens.spacing.lg,
    fontFamily: tokens.typography.fontFamily.regular,
  },
  dismissButton: {
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.xs,
    backgroundColor: '#1E293B',
    borderRadius: 8,
  },
  dismissButtonText: {
    color: '#F8FAFC',
    fontSize: 13,
  },
  contentContainer: {
    width: '100%',
  },
  infoCard: {
    backgroundColor: '#1A2234',
    borderRadius: 14,
    padding: tokens.spacing.md,
    borderWidth: 1,
    borderColor: '#26334D',
    marginBottom: tokens.spacing.md,
  },
  spaceName: {
    fontSize: 17,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#F8FAFC',
    marginBottom: 4,
  },
  purposeText: {
    fontSize: 13,
    color: '#94A3B8',
    lineHeight: 18,
    marginBottom: tokens.spacing.sm,
    fontFamily: tokens.typography.fontFamily.regular,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    marginTop: 2,
  },
  metaBadge: {
    backgroundColor: 'rgba(0, 255, 157, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 157, 0.3)',
  },
  metaBadgeText: {
    color: '#00FF9D',
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.medium,
  },
  inviterText: {
    color: '#64748B',
    fontSize: 12,
    flex: 1,
    fontFamily: tokens.typography.fontFamily.regular,
  },
  errorMessageText: {
    color: '#EF4444',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: tokens.spacing.sm,
    fontFamily: tokens.typography.fontFamily.regular,
  },
  joinButton: {
    backgroundColor: '#00FF9D',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alreadyMemberButton: {
    backgroundColor: '#2563EB',
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  joinButtonText: {
    color: '#0B0F19',
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.semiBold,
  },
  alreadyMemberButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.semiBold,
  },
});

export default JoinGroupModal;
