import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  TextInput,
  Pressable,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { tokens } from '../../../design';
import Text from '../../../components/Text';
import { RendezvousPinIcon, CloseIcon } from './LocationIcons';
import type { CreateSessionInput, LocationSession } from '../types';

export interface CreateSessionModalProps {
  visible: boolean;
  onClose: () => void;
  onCreate: (
    input: Omit<CreateSessionInput, 'groupId'>,
  ) => Promise<{ session: LocationSession | null; error?: string }>;
}

export const CreateSessionModal: React.FC<CreateSessionModalProps> = ({
  visible,
  onClose,
  onCreate,
}) => {
  const [title, setTitle] = useState('');
  const [destinationName, setDestinationName] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [durationHours, setDurationHours] = useState('2');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const resetForm = () => {
    setTitle('');
    setDestinationName('');
    setLatitude('');
    setLongitude('');
    setDurationHours('2');
    setErrorText(null);
    setIsSubmitting(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleCreate = async () => {
    setErrorText(null);

    const lat = parseFloat(latitude.trim());
    const lng = parseFloat(longitude.trim());

    if (isNaN(lat) || lat < -90 || lat > 90) {
      setErrorText('Please enter a valid latitude (-90 to +90).');
      return;
    }

    if (isNaN(lng) || lng < -180 || lng > 180) {
      setErrorText('Please enter a valid longitude (-180 to +180).');
      return;
    }

    const duration = parseFloat(durationHours.trim()) || 2;
    const durationMinutes = Math.round(duration * 60);

    setIsSubmitting(true);
    try {
      const res = await onCreate({
        title: title.trim() || 'Group Outing',
        destinationName: destinationName.trim() || undefined,
        destinationLat: lat,
        destinationLng: lng,
        durationMinutes,
      });

      if (!res.session && res.error) {
        setErrorText(res.error);
        setIsSubmitting(false);
        return;
      }

      handleClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to start outing session.';
      setErrorText(msg);
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <RendezvousPinIcon size={22} color="#38BDF8" />
            </View>
            <Text variant="title3" weight="bold" style={styles.headerTitle}>
              Start Outing Session
            </Text>
            <Pressable
              testID="close-create-session-modal"
              style={styles.closeButton}
              onPress={handleClose}
              hitSlop={8}
            >
              <CloseIcon size={20} color={tokens.colors.text.tertiary} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollContent}>
            {errorText && (
              <View style={styles.errorBanner}>
                <Text variant="caption" weight="medium" style={styles.errorText}>
                  {errorText}
                </Text>
              </View>
            )}

            {/* Outing Title */}
            <View style={styles.inputGroup}>
              <Text variant="caption" weight="semibold" style={styles.label}>
                OUTING TITLE
              </Text>
              <TextInput
                testID="session-title-input"
                style={styles.textInput}
                value={title}
                onChangeText={setTitle}
                placeholder="e.g. Marina Bay Sands Meetup"
                placeholderTextColor={tokens.colors.text.tertiary}
                maxLength={80}
              />
            </View>

            {/* Destination Name */}
            <View style={styles.inputGroup}>
              <Text variant="caption" weight="semibold" style={styles.label}>
                DESTINATION / VENUE NAME
              </Text>
              <TextInput
                testID="session-dest-name-input"
                style={styles.textInput}
                value={destinationName}
                onChangeText={setDestinationName}
                placeholder="e.g. Waterfront Promenade"
                placeholderTextColor={tokens.colors.text.tertiary}
                maxLength={100}
              />
            </View>

            {/* Coordinates Row */}
            <View style={styles.row}>
              <View style={[styles.inputGroup, styles.halfCol]}>
                <Text variant="caption" weight="semibold" style={styles.label}>
                  LATITUDE (-90 to 90)
                </Text>
                <TextInput
                  testID="session-lat-input"
                  style={styles.textInput}
                  value={latitude}
                  onChangeText={setLatitude}
                  placeholder="1.2834"
                  placeholderTextColor={tokens.colors.text.tertiary}
                  keyboardType="numeric"
                />
              </View>

              <View style={[styles.inputGroup, styles.halfCol]}>
                <Text variant="caption" weight="semibold" style={styles.label}>
                  LONGITUDE (-180 to 180)
                </Text>
                <TextInput
                  testID="session-lng-input"
                  style={styles.textInput}
                  value={longitude}
                  onChangeText={setLongitude}
                  placeholder="103.8607"
                  placeholderTextColor={tokens.colors.text.tertiary}
                  keyboardType="numeric"
                />
              </View>
            </View>

            {/* Duration Selector */}
            <View style={styles.inputGroup}>
              <Text variant="caption" weight="semibold" style={styles.label}>
                SESSION DURATION (HOURS)
              </Text>
              <View style={styles.durationOptions}>
                {['1', '2', '4', '8'].map((hrs) => {
                  const isSelected = durationHours === hrs;
                  return (
                    <Pressable
                      key={hrs}
                      style={[styles.durationChip, isSelected && styles.durationChipActive]}
                      onPress={() => setDurationHours(hrs)}
                    >
                      <Text
                        variant="caption"
                        weight={isSelected ? 'bold' : 'medium'}
                        style={[styles.durationText, isSelected && styles.durationTextActive]}
                      >
                        {hrs}h
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </ScrollView>

          {/* Submit Actions */}
          <View style={styles.actions}>
            <Pressable
              testID="submit-create-session"
              style={({ pressed }) => [
                styles.submitButton,
                isSubmitting && styles.submitButtonDisabled,
                pressed && styles.buttonPressed,
              ]}
              onPress={handleCreate}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#0B0F19" />
              ) : (
                <Text variant="callout" weight="bold" style={styles.submitButtonText}>
                  Start Outing Session
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
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#12141A',
    borderTopLeftRadius: tokens.radius.lg,
    borderTopRightRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.colors.border.subtle,
    padding: tokens.spacing.lg,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: tokens.spacing.md,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: tokens.radius.full,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  headerTitle: {
    flex: 1,
    color: tokens.colors.text.primary,
  },
  closeButton: {
    padding: 6,
  },
  scrollContent: {
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
  inputGroup: {
    marginBottom: tokens.spacing.md,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfCol: {
    flex: 1,
  },
  label: {
    color: tokens.colors.text.tertiary,
    fontSize: 11,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: '#1A1D24',
    borderWidth: 1,
    borderColor: tokens.colors.border.subtle,
    borderRadius: tokens.radius.sm,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: 10,
    color: tokens.colors.text.primary,
    fontSize: 14,
  },
  durationOptions: {
    flexDirection: 'row',
    gap: 10,
  },
  durationChip: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: '#1A1D24',
    borderRadius: tokens.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: tokens.colors.border.subtle,
  },
  durationChipActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderColor: '#38BDF8',
  },
  durationText: {
    color: tokens.colors.text.secondary,
  },
  durationTextActive: {
    color: '#38BDF8',
  },
  actions: {
    marginTop: tokens.spacing.sm,
  },
  submitButton: {
    backgroundColor: '#38BDF8',
    borderRadius: tokens.radius.full,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  buttonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  submitButtonText: {
    color: '#0B0F19',
  },
});

export default CreateSessionModal;
