import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { tokens } from '../../../design';
import Text from '../../../components/Text';
import {
  EditIcon,
  MilestoneFlagIcon,
  MapPinIcon,
  RouteNavigationIcon,
  CloseIcon,
} from './EventIcons';
import { validateEventCoordinates, EventRecord, UpdateEventInput } from '../types';

export interface EditEventModalProps {
  visible: boolean;
  event: EventRecord | null;
  onClose: () => void;
  onUpdate: (
    eventId: string,
    input: UpdateEventInput,
  ) => Promise<{ success: boolean; error?: string }>;
}

export const EditEventModal: React.FC<EditEventModalProps> = ({
  visible,
  event,
  onClose,
  onUpdate,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isMilestone, setIsMilestone] = useState(false);
  const [dateStr, setDateStr] = useState('');
  const [timeStr, setTimeStr] = useState('');
  const [locationName, setLocationName] = useState('');
  const [latitudeStr, setLatitudeStr] = useState('');
  const [longitudeStr, setLongitudeStr] = useState('');
  const [showCoordinates, setShowCoordinates] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (event) {
      setTitle(event.title);
      setDescription(event.description || '');
      setIsMilestone(Boolean(event.isMilestone));
      setLocationName(event.locationName || '');

      try {
        const d = new Date(event.targetTime);
        const pad = (n: number) => String(n).padStart(2, '0');
        setDateStr(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
        setTimeStr(`${pad(d.getHours())}:${pad(d.getMinutes())}`);
      } catch {
        setDateStr('');
        setTimeStr('');
      }

      if (event.latitude !== null && event.longitude !== null && event.latitude !== undefined && event.longitude !== undefined) {
        setLatitudeStr(String(event.latitude));
        setLongitudeStr(String(event.longitude));
        setShowCoordinates(true);
      } else {
        setLatitudeStr('');
        setLongitudeStr('');
        setShowCoordinates(false);
      }

      setValidationError(null);
    }
  }, [event]);

  const handleSubmit = async () => {
    if (!event) return;
    setValidationError(null);

    const trimmedTitle = title.trim();
    if (!trimmedTitle || trimmedTitle.length === 0) {
      setValidationError('Please enter an event or milestone title.');
      return;
    }
    if (trimmedTitle.length > 100) {
      setValidationError('Title must not exceed 100 characters.');
      return;
    }

    const combinedDateStr = `${dateStr.trim()}T${timeStr.trim()}:00`;
    const localDate = new Date(combinedDateStr);
    if (isNaN(localDate.getTime())) {
      setValidationError('Please enter a valid date (YYYY-MM-DD) and time (HH:MM).');
      return;
    }

    let lat: number | null = null;
    let lng: number | null = null;

    if (latitudeStr.trim() || longitudeStr.trim()) {
      lat = parseFloat(latitudeStr.trim());
      lng = parseFloat(longitudeStr.trim());

      const coordCheck = validateEventCoordinates(lat, lng);
      if (!coordCheck.valid) {
        setValidationError(coordCheck.error || 'Invalid coordinates.');
        return;
      }
    }

    try {
      setIsSubmitting(true);
      const res = await onUpdate(event.id, {
        title: trimmedTitle,
        description: description.trim() || null,
        targetTime: localDate.toISOString(),
        locationName: locationName.trim() || null,
        latitude: lat,
        longitude: lng,
        isMilestone,
      });

      if (!res.success) {
        setValidationError(res.error || 'Failed to update event.');
        setIsSubmitting(false);
        return;
      }

      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update event.';
      setValidationError(message);
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={styles.headerTitleRow}>
              <EditIcon size={20} color={tokens.colors.primary.default} />
              <Text variant="title3" style={styles.headerTitle}>
                Edit Event
              </Text>
            </View>

            <Pressable
              onPress={onClose}
              style={({ pressed }) => [styles.closeButton, pressed && styles.closeButtonPressed]}
              accessibilityLabel="Close"
            >
              <CloseIcon size={20} color={tokens.colors.text.secondary} />
            </Pressable>
          </View>

          {/* Form Content */}
          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {Boolean(validationError) && (
              <View style={styles.errorBanner}>
                <Text variant="caption" style={styles.errorText}>
                  {validationError}
                </Text>
              </View>
            )}

            {/* Title */}
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text variant="caption" style={styles.label}>
                  EVENT TITLE *
                </Text>
                <Text variant="caption" style={styles.charCount}>
                  {title.length}/100
                </Text>
              </View>
              <TextInput
                style={styles.textInput}
                value={title}
                onChangeText={setTitle}
                maxLength={100}
              />
            </View>

            {/* Milestone Toggle */}
            <Pressable
              style={({ pressed }) => [
                styles.milestoneToggleRow,
                isMilestone && styles.milestoneToggleRowActive,
                pressed && styles.togglePressed,
              ]}
              onPress={() => setIsMilestone(!isMilestone)}
            >
              <View style={styles.milestoneToggleLeft}>
                <MilestoneFlagIcon size={18} color={isMilestone ? '#EC4899' : tokens.colors.text.tertiary} />
                <View>
                  <Text variant="callout" style={[styles.milestoneToggleTitle, isMilestone && styles.milestoneTitleActive]}>
                    Flag as Group Milestone
                  </Text>
                  <Text variant="caption" style={styles.milestoneToggleSubtitle}>
                    Showcases in top hero itinerary countdown
                  </Text>
                </View>
              </View>

              <View style={[styles.checkboxBox, isMilestone && styles.checkboxBoxActive]}>
                {isMilestone && <View style={styles.checkboxInnerDot} />}
              </View>
            </Pressable>

            {/* Date & Time Row */}
            <View style={styles.dateTimeRow}>
              <View style={styles.dateCol}>
                <Text variant="caption" style={styles.label}>
                  DATE (YYYY-MM-DD) *
                </Text>
                <TextInput
                  style={styles.textInput}
                  value={dateStr}
                  onChangeText={setDateStr}
                  keyboardType="numbers-and-punctuation"
                />
              </View>

              <View style={styles.timeCol}>
                <Text variant="caption" style={styles.label}>
                  TIME (HH:MM) *
                </Text>
                <TextInput
                  style={styles.textInput}
                  value={timeStr}
                  onChangeText={setTimeStr}
                  keyboardType="numbers-and-punctuation"
                />
              </View>
            </View>

            {/* Location / Venue */}
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text variant="caption" style={styles.label}>
                  LOCATION / VENUE
                </Text>
                <MapPinIcon size={14} color="#38BDF8" />
              </View>
              <TextInput
                style={styles.textInput}
                value={locationName}
                onChangeText={setLocationName}
                maxLength={120}
              />
            </View>

            {/* Description */}
            <View style={styles.inputGroup}>
              <Text variant="caption" style={styles.label}>
                DESCRIPTION / AGENDA
              </Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>

            {/* Destination Coordinates Toggle */}
            <Pressable
              style={styles.coordinateToggle}
              onPress={() => setShowCoordinates(!showCoordinates)}
            >
              <RouteNavigationIcon size={16} color="#38BDF8" />
              <Text variant="caption" style={styles.coordinateToggleText}>
                {showCoordinates
                  ? 'Hide Rendezvous GPS Coordinates'
                  : 'Edit Rendezvous Destination Coordinates (Part 8 Map)'}
              </Text>
            </Pressable>

            {showCoordinates && (
              <View style={styles.coordinatesContainer}>
                <View style={styles.coordInputsRow}>
                  <View style={styles.coordInputCol}>
                    <Text variant="caption" style={styles.label}>
                      LATITUDE
                    </Text>
                    <TextInput
                      style={styles.textInput}
                      value={latitudeStr}
                      onChangeText={setLatitudeStr}
                      keyboardType="numbers-and-punctuation"
                      placeholder="e.g. 1.2834"
                      placeholderTextColor={tokens.colors.text.tertiary}
                    />
                  </View>

                  <View style={styles.coordInputCol}>
                    <Text variant="caption" style={styles.label}>
                      LONGITUDE
                    </Text>
                    <TextInput
                      style={styles.textInput}
                      value={longitudeStr}
                      onChangeText={setLongitudeStr}
                      keyboardType="numbers-and-punctuation"
                      placeholder="e.g. 103.8607"
                      placeholderTextColor={tokens.colors.text.tertiary}
                    />
                  </View>
                </View>
              </View>
            )}
          </ScrollView>

          {/* Footer Submit */}
          <View style={styles.modalFooter}>
            <Pressable
              style={({ pressed }) => [
                styles.submitButton,
                isSubmitting && styles.submitButtonDisabled,
                pressed && styles.submitButtonPressed,
              ]}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text variant="callout" style={styles.submitButtonText}>
                  Save Changes
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
    maxHeight: '90%',
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
  inputGroup: {
    marginBottom: tokens.spacing.md,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  label: {
    color: tokens.colors.text.secondary,
    fontWeight: '700',
    fontSize: 10,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  charCount: {
    color: tokens.colors.text.tertiary,
    fontSize: 10,
  },
  textInput: {
    backgroundColor: '#171A21',
    borderWidth: 1,
    borderColor: tokens.colors.border.subtle,
    borderRadius: tokens.radius.md,
    color: tokens.colors.text.primary,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: 10,
    fontSize: 14,
  },
  textArea: {
    minHeight: 70,
  },
  dateTimeRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: tokens.spacing.md,
  },
  dateCol: {
    flex: 3,
  },
  timeCol: {
    flex: 2,
  },
  milestoneToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#171A21',
    borderWidth: 1,
    borderColor: tokens.colors.border.subtle,
    borderRadius: tokens.radius.md,
    padding: tokens.spacing.md,
    marginBottom: tokens.spacing.md,
  },
  milestoneToggleRowActive: {
    borderColor: 'rgba(236, 72, 153, 0.5)',
    backgroundColor: 'rgba(236, 72, 153, 0.06)',
  },
  togglePressed: {
    opacity: 0.85,
  },
  milestoneToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  milestoneToggleTitle: {
    color: tokens.colors.text.primary,
    fontWeight: '600',
  },
  milestoneTitleActive: {
    color: '#EC4899',
  },
  milestoneToggleSubtitle: {
    color: tokens.colors.text.tertiary,
    fontSize: 11,
    marginTop: 2,
  },
  checkboxBox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: tokens.colors.border.subtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxBoxActive: {
    borderColor: '#EC4899',
    backgroundColor: 'rgba(236, 72, 153, 0.2)',
  },
  checkboxInnerDot: {
    width: 8,
    height: 8,
    borderRadius: 3,
    backgroundColor: '#EC4899',
  },
  coordinateToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    marginBottom: tokens.spacing.sm,
  },
  coordinateToggleText: {
    color: '#38BDF8',
    fontWeight: '600',
  },
  coordinatesContainer: {
    backgroundColor: 'rgba(56, 189, 248, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.15)',
    borderRadius: tokens.radius.md,
    padding: tokens.spacing.md,
    marginBottom: tokens.spacing.md,
  },
  coordInputsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  coordInputCol: {
    flex: 1,
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
    opacity: 0.6,
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

export default EditEventModal;
