import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Share,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { tokens } from '../../../design';
import { inviteService } from '../services/inviteService';
import { haptics } from '../../../utils/haptics';
import { CloseIcon, CheckIcon } from '../../../components/icons/CommonIcons';
import type { GenerateInviteResult } from '../types';

interface QRInviteModalProps {
  visible: boolean;
  groupId: string;
  groupName: string;
  groupExpiresAt?: string;
  onClose: () => void;
}

export const QRInviteModal: React.FC<QRInviteModalProps> = ({
  visible,
  groupId,
  groupName,
  groupExpiresAt,
  onClose,
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [inviteData, setInviteData] = useState<GenerateInviteResult | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOrCreateInvite = useCallback(async () => {
    setLoading(true);
    setError(null);
    setCopied(false);

    try {
      let lifespanSeconds = 86400;
      if (groupExpiresAt) {
        const remainingSec = Math.max(Math.floor((new Date(groupExpiresAt).getTime() - Date.now()) / 1000), 300);
        lifespanSeconds = Math.min(86400, remainingSec);
      }

      const res = await inviteService.generateInvite(groupId, {
        lifespanSeconds,
      });

      if (!res.success) {
        setError(res.error || 'Failed to generate invitation');
      } else {
        setInviteData(res);
        haptics.selection();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error');
    } finally {
      setLoading(false);
    }
  }, [groupId, groupExpiresAt]);

  useEffect(() => {
    if (visible) {
      fetchOrCreateInvite();
    }
  }, [visible, fetchOrCreateInvite]);

  const handleShare = async () => {
    if (!inviteData?.inviteUrl) return;
    haptics.tick();
    try {
      await Share.share({
        message: `Join my temporary space "${groupName}" on Neram: ${inviteData.inviteUrl}`,
        url: inviteData.inviteUrl,
      });
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // User cancelled share
    }
  };

  const handleRevoke = async () => {
    if (!inviteData?.inviteId) return;
    haptics.warning();
    setLoading(true);
    const res = await inviteService.revokeInvite(inviteData.inviteId);
    if (res.success) {
      haptics.success();
      onClose();
    } else {
      setError(res.error || 'Failed to revoke invitation');
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.categoryLabel}>INVITE LINK</Text>
              <Text style={styles.title} numberOfLines={1}>
                {groupName}
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeButton}
              accessibilityLabel="Close QR invitation modal"
            >
              <CloseIcon size={20} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          {/* Body */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#00FF9D" />
              <Text style={styles.loadingText}>Generating secure invitation...</Text>
            </View>
          ) : error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity
                style={styles.retryButton}
                onPress={fetchOrCreateInvite}
              >
                <Text style={styles.retryButtonText}>Try Again</Text>
              </TouchableOpacity>
            </View>
          ) : inviteData?.inviteUrl ? (
            <View style={styles.contentContainer}>
              {/* QR Code Container */}
              <View style={styles.qrContainer}>
                <QRCode
                  value={inviteData.inviteUrl}
                  size={190}
                  color="#000000"
                  backgroundColor="#FFFFFF"
                  quietZone={12}
                />
              </View>

              <Text style={styles.instructionsText}>
                Scan with any phone camera or Neram scanner to join immediately.
              </Text>

              {/* Action Buttons */}
              <View style={styles.actionsContainer}>
                <TouchableOpacity
                  style={[styles.primaryButton, copied && styles.primaryButtonSuccess]}
                  onPress={handleShare}
                >
                  {copied ? (
                    <View style={styles.buttonRow}>
                      <CheckIcon size={16} color="#0B0F19" />
                      <Text style={styles.primaryButtonText}>Link Shared</Text>
                    </View>
                  ) : (
                    <Text style={styles.primaryButtonText}>Share Invite Link</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.revokeButton}
                  onPress={handleRevoke}
                >
                  <Text style={styles.revokeButtonText}>Revoke Code</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
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
    alignItems: 'flex-start',
    marginBottom: tokens.spacing.md,
  },
  categoryLabel: {
    fontSize: 11,
    fontFamily: tokens.typography.fontFamily.semiBold,
    color: '#00FF9D',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  title: {
    fontSize: 18,
    fontFamily: tokens.typography.fontFamily.bold,
    color: '#F8FAFC',
    maxWidth: 240,
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
    paddingVertical: tokens.spacing.xl,
    alignItems: 'center',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: tokens.spacing.md,
    fontFamily: tokens.typography.fontFamily.regular,
  },
  retryButton: {
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.xs,
    backgroundColor: '#1E293B',
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#F8FAFC',
    fontSize: 13,
  },
  contentContainer: {
    alignItems: 'center',
  },
  qrContainer: {
    padding: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: tokens.spacing.md,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  instructionsText: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: tokens.spacing.lg,
    lineHeight: 18,
    fontFamily: tokens.typography.fontFamily.regular,
  },
  actionsContainer: {
    width: '100%',
    gap: tokens.spacing.xs,
  },
  primaryButton: {
    backgroundColor: '#00FF9D',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonSuccess: {
    backgroundColor: '#34D399',
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  primaryButtonText: {
    color: '#0B0F19',
    fontSize: 14,
    fontFamily: tokens.typography.fontFamily.semiBold,
  },
  revokeButton: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  revokeButtonText: {
    color: '#64748B',
    fontSize: 12,
    fontFamily: tokens.typography.fontFamily.medium,
  },
});

export default QRInviteModal;
