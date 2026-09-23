import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  Pressable,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { tokens } from '../../../design';
import Text from '../../../components/Text';
import {
  ShieldLocationIcon,
  CloseIcon,
  CheckCircleIcon,
} from './LocationIcons';
import { locationPermissionService } from '../services/locationPermissionService';

export interface LocationOptInModalProps {
  visible: boolean;
  onClose: () => void;
  onConsentGranted: () => Promise<void> | void;
}

export const LocationOptInModal: React.FC<LocationOptInModalProps> = ({
  visible,
  onClose,
  onConsentGranted,
}) => {
  const [isRequesting, setIsRequesting] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const resetState = () => {
    setIsRequesting(false);
    setIsBlocked(false);
    setErrorText(null);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleContinue = async () => {
    setIsRequesting(true);
    setErrorText(null);

    try {
      const result = await locationPermissionService.requestForegroundPermission();

      if (result.granted) {
        setIsRequesting(false);
        handleClose();
        await onConsentGranted();
        return;
      }

      if (result.state === 'BLOCKED') {
        setIsBlocked(true);
        setErrorText('Location access is blocked in device settings.');
      } else {
        setErrorText('Location permission was denied. You can retry whenever you are ready.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to request location permission.';
      setErrorText(msg);
    } finally {
      setIsRequesting(false);
    }
  };

  const handleOpenSettings = async () => {
    await locationPermissionService.openSettings();
    handleClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <ShieldLocationIcon size={26} color="#38BDF8" />
            </View>
            <Pressable
              testID="close-opt-in-modal"
              style={styles.closeButton}
              onPress={handleClose}
              hitSlop={8}
              accessibilityLabel="Close"
            >
              <CloseIcon size={20} color={tokens.colors.text.tertiary} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={styles.contentScroll}>
            {/* Title & Subtitle */}
            <Text variant="title3" weight="bold" style={styles.title}>
              {isBlocked ? 'Permission Blocked' : 'Share Live Outing Location'}
            </Text>
            <Text variant="caption" style={styles.subtitle}>
              {isBlocked
                ? 'Location access is disabled for Neram in your device settings.'
                : 'Temporary, group-scoped location sharing for outing rendezvous.'}
            </Text>

            {/* Error Banner */}
            {errorText && (
              <View style={styles.errorBanner}>
                <Text variant="caption" weight="medium" style={styles.errorText}>
                  {errorText}
                </Text>
              </View>
            )}

            {/* Educational Guarantees List */}
            {!isBlocked && (
              <View style={styles.guaranteesContainer}>
                <View style={styles.guaranteeRow}>
                  <CheckCircleIcon size={18} color="#38BDF8" />
                  <View style={styles.guaranteeTextContainer}>
                    <Text variant="callout" weight="semibold" style={styles.guaranteeTitle}>
                      Session-Scoped & Temporary
                    </Text>
                    <Text variant="caption" style={styles.guaranteeDescription}>
                      Location is only shared while this specific outing session is active.
                    </Text>
                  </View>
                </View>

                <View style={styles.guaranteeRow}>
                  <CheckCircleIcon size={18} color="#38BDF8" />
                  <View style={styles.guaranteeTextContainer}>
                    <Text variant="callout" weight="semibold" style={styles.guaranteeTitle}>
                      Strict Privacy Boundary
                    </Text>
                    <Text variant="caption" style={styles.guaranteeDescription}>
                      Physical location is completely decoupled from your user profile, presence, and chat.
                    </Text>
                  </View>
                </View>

                <View style={styles.guaranteeRow}>
                  <CheckCircleIcon size={18} color="#38BDF8" />
                  <View style={styles.guaranteeTextContainer}>
                    <Text variant="callout" weight="semibold" style={styles.guaranteeTitle}>
                      Automatic Ephemeral Purge
                    </Text>
                    <Text variant="caption" style={styles.guaranteeDescription}>
                      Coordinates are permanently deleted when you leave, when the session ends, or when the space dissolves.
                    </Text>
                  </View>
                </View>

                <View style={styles.guaranteeRow}>
                  <CheckCircleIcon size={18} color="#38BDF8" />
                  <View style={styles.guaranteeTextContainer}>
                    <Text variant="callout" weight="semibold" style={styles.guaranteeTitle}>
                      Zero Silent Tracking
                    </Text>
                    <Text variant="caption" style={styles.guaranteeDescription}>
                      Neram never tracks your background location when an outing is not active.
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {isBlocked && (
              <View style={styles.blockedContainer}>
                <Text variant="body" style={styles.blockedBody}>
                  To coordinate with your group on the map, open device settings and allow foreground location access.
                </Text>
              </View>
            )}
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.actionsContainer}>
            {isBlocked ? (
              <Pressable
                testID="open-settings-button"
                style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
                onPress={handleOpenSettings}
              >
                <Text variant="callout" weight="bold" style={styles.primaryButtonText}>
                  Open App Settings
                </Text>
              </Pressable>
            ) : (
              <Pressable
                testID="consent-continue-button"
                style={({ pressed }) => [
                  styles.primaryButton,
                  isRequesting && styles.primaryButtonDisabled,
                  pressed && styles.buttonPressed,
                ]}
                onPress={handleContinue}
                disabled={isRequesting}
              >
                {isRequesting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text variant="callout" weight="bold" style={styles.primaryButtonText}>
                    I Understand & Enable
                  </Text>
                )}
              </Pressable>
            )}

            <Pressable
              testID="cancel-opt-in-button"
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}
              onPress={handleClose}
              disabled={isRequesting}
            >
              <Text variant="callout" weight="medium" style={styles.secondaryButtonText}>
                Not Now
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.lg,
  },
  modalCard: {
    width: '100%',
    maxHeight: '85%',
    backgroundColor: '#12141A',
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.colors.border.subtle,
    padding: tokens.spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: tokens.spacing.md,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: tokens.radius.full,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButton: {
    padding: 6,
  },
  contentScroll: {
    flexGrow: 0,
    marginBottom: tokens.spacing.lg,
  },
  title: {
    color: tokens.colors.text.primary,
    marginBottom: 4,
  },
  subtitle: {
    color: tokens.colors.text.tertiary,
    marginBottom: tokens.spacing.md,
  },
  errorBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: tokens.radius.sm,
    padding: tokens.spacing.sm,
    marginBottom: tokens.spacing.md,
  },
  errorText: {
    color: '#EF4444',
  },
  guaranteesContainer: {
    gap: 12,
  },
  guaranteeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  guaranteeTextContainer: {
    flex: 1,
  },
  guaranteeTitle: {
    color: tokens.colors.text.primary,
    marginBottom: 2,
  },
  guaranteeDescription: {
    color: tokens.colors.text.secondary,
    lineHeight: 18,
  },
  blockedContainer: {
    paddingVertical: tokens.spacing.md,
  },
  blockedBody: {
    color: tokens.colors.text.secondary,
    lineHeight: 22,
  },
  actionsContainer: {
    gap: 8,
  },
  primaryButton: {
    backgroundColor: '#38BDF8',
    borderRadius: tokens.radius.full,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  buttonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  primaryButtonText: {
    color: '#0B0F19',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: tokens.colors.text.tertiary,
  },
});

export default LocationOptInModal;
