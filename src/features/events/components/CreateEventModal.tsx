import React, { useState } from 'react';
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
  CalendarIcon,
  ClockIcon,
  MilestoneFlagIcon,
  MapPinIcon,
  RouteNavigationIcon,
  CloseIcon,
} from './EventIcons';
import { validateEventCoordinates } from '../types';

export interface CreateEventModalProps {
  visible: boolean;
  onClose: () => void;
  onCreate: (input: {
    title: string;
    description?: string | null;
    targetTime: string;
    locationName?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    isMilestone: boolean;
  }) => Promise<{ success: boolean; error?: string }>;
}

const DATE_PRESETS = [
  { id: 'today', label: 'Today', daysOffset: 0 },
  { id: 'tomorrow', label: 'Tomorrow', daysOffset: 1 },
  { id: 'in2days', label: 'In 2 Days', daysOffset: 2 },
  { id: 'in1week', label: 'In 1 Week', daysOffset: 7 },
];

const TIME_PRESETS = [
  { id: 'morning', label: '09:00 AM', time: '09:00' },
  { id: 'noon', label: '12:00 PM', time: '12:00' },
  { id: 'afternoon', label: '03:00 PM', time: '15:00' },
  { id: 'evening', label: '06:00 PM', time: '18:00' },
  { id: 'night', label: '09:00 PM', time: '21:00' },
];

function getInitialDateStr(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export const CreateEventModal: React.FC<CreateEventModalProps> = ({
  visible,
  onClose,
  onCreate,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isMilestone, setIsMilestone] = useState(false);
  const [dateStr, setDateStr] = useState(() => getInitialDateStr(1)); // Tomorrow default
  const [timeStr, setTimeStr] = useState('18:00'); // 6:00 PM default
  const [locationName, setLocationName] = useState('');
  const [latitudeStr, setLatitudeStr] = useState('');
  const [longitudeStr, setLongitudeStr] = useState('');
  const [showCoordinateInputs, setShowCoordinateInputs] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setIsMilestone(false);
    setDateStr(getInitialDateStr(1));
    setTimeStr('18:00');
    setLocationName('');
    setLatitudeStr('');
    setLongitudeStr('');
    setShowCoordinateInputs(false);
    setIsSubmitting(false);
    setValidationError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleDatePresetPress = (offset: number) => {
    setDateStr(getInitialDateStr(offset));
  };

  const handleTimePresetPress = (time: string) => {
    setTimeStr(time);
  };

  const handleSubmit = async () => {
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

    // Construct local Date and convert to UTC ISO string
    const combinedDateStr = `${dateStr.trim()}T${timeStr.trim()}:00`;
    const localDate = new Date(combinedDateStr);
    if (isNaN(localDate.getTime())) {
      setValidationError('Please enter a valid date (YYYY-MM-DD) and time (HH:MM).');
      return;
    }

    // Coordinate validation if provided
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
      const res = await onCreate({
        title: trimmedTitle,
        description: description.trim() || null,
        targetTime: localDate.toISOString(),
        locationName: locationName.trim() || null,
        latitude: lat,
        longitude: lng,
        isMilestone,
      });

      if (!res.success) {
        setValidationError(res.error || 'Failed to create event.');
        setIsSubmitting(false);
        return;
      }

      handleClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to schedule event.';
      setValidationError(message);
      setIsSubmitting(false);
    }
  };

  // Preview formatted time string
  const previewFormattedTime = (() => {
    try {
      const d = new Date(`${dateStr.trim()}T${timeStr.trim()}:00`);
      if (isNaN(d.getTime())) return null;
      return d.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      return null;
    }
  })();

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={styles.headerTitleRow}>
              <CalendarIcon size={20} color={tokens.colors.primary.default} />
              <Text variant="title3" style={styles.headerTitle}>
                Schedule Event
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

          {/* Form Content */}
          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Validation Banner */}
            {Boolean(validationError) && (
              <View style={styles.errorBanner}>
                <Text variant="caption" style={styles.errorText}>
                  {validationError}
                </Text>
              </View>
            )}

            {/* Title Input */}
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
                placeholder="e.g. Design Review, Team Rendezvous, Milestone Launch"
                placeholderTextColor={tokens.colors.text.tertiary}
                value={title}
                onChangeText={setTitle}
                maxLength={100}
                autoFocus
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
                    Showcases in the top itinerary hero with priority countdown
                  </Text>
                </View>
              </View>

              <View style={[styles.checkboxBox, isMilestone && styles.checkboxBoxActive]}>
                {isMilestone && <View style={styles.checkboxInnerDot} />}
              </View>
            </Pressable>

            {/* Date Selection */}
            <View style={styles.inputGroup}>
              <Text variant="caption" style={styles.label}>
                DATE (YYYY-MM-DD) *
              </Text>
              {/* Presets */}
              <View style={styles.presetRow}>
                {DATE_PRESETS.map((p) => {
                  const pDate = getInitialDateStr(p.daysOffset);
                  const isSelected = dateStr === pDate;
                  return (
                    <Pressable
                      key={p.id}
                      style={[styles.presetChip, isSelected && styles.presetChipActive]}
                      onPress={() => handleDatePresetPress(p.daysOffset)}
                    >
                      <Text
                        variant="caption"
                        style={[styles.presetChipText, isSelected && styles.presetChipTextActive]}
                      >
                        {p.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <TextInput
                style={styles.textInput}
                placeholder="2026-09-24"
                placeholderTextColor={tokens.colors.text.tertiary}
                value={dateStr}
                onChangeText={setDateStr}
                keyboardType="numbers-and-punctuation"
              />
            </View>

            {/* Time Selection */}
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text variant="caption" style={styles.label}>
                  TIME (HH:MM 24-HOUR) *
                </Text>
                <ClockIcon size={14} color={tokens.colors.text.tertiary} />
              </View>
              {/* Presets */}
              <View style={styles.presetRow}>
                {TIME_PRESETS.map((p) => {
                  const isSelected = timeStr === p.time;
                  return (
                    <Pressable
                      key={p.id}
                      style={[styles.presetChip, isSelected && styles.presetChipActive]}
                      onPress={() => handleTimePresetPress(p.time)}
                    >
                      <Text
                        variant="caption"
                        style={[styles.presetChipText, isSelected && styles.presetChipTextActive]}
                      >
                        {p.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <TextInput
                style={styles.textInput}
                placeholder="18:00"
                placeholderTextColor={tokens.colors.text.tertiary}
                value={timeStr}
                onChangeText={setTimeStr}
                keyboardType="numbers-and-punctuation"
              />
            </View>

            {/* Target Time Preview */}
            {Boolean(previewFormattedTime) && (
              <View style={styles.previewBox}>
                <ClockIcon size={14} color="#F59E0B" />
                <Text variant="caption" style={styles.previewText}>
                  Scheduled for: {previewFormattedTime} (Local Time)
                </Text>
              </View>
            )}

            {/* Location / Venue Name */}
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text variant="caption" style={styles.label}>
                  LOCATION / VENUE (OPTIONAL)
                </Text>
                <MapPinIcon size={14} color="#38BDF8" />
              </View>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Marina Bay Sands, Conference Room 4B"
                placeholderTextColor={tokens.colors.text.tertiary}
                value={locationName}
                onChangeText={setLocationName}
                maxLength={120}
              />
            </View>

            {/* Description */}
            <View style={styles.inputGroup}>
              <Text variant="caption" style={styles.label}>
                DESCRIPTION / AGENDA (OPTIONAL)
              </Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                placeholder="Add meeting links, presentation topics, or details..."
                placeholderTextColor={tokens.colors.text.tertiary}
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>

            {/* Part 8 Destination Coordinates Toggle */}
            <Pressable
              style={styles.coordinateToggle}
              onPress={() => setShowCoordinateInputs(!showCoordinateInputs)}
            >
              <RouteNavigationIcon size={16} color="#38BDF8" />
              <Text variant="caption" style={styles.coordinateToggleText}>
                {showCoordinateInputs
                  ? 'Hide Rendezvous GPS Coordinates'
                  : 'Add Rendezvous Destination Coordinates (Part 8 Map)'}
              </Text>
            </Pressable>

            {/* Coordinates Input Group */}
            {showCoordinateInputs && (
              <View style={styles.coordinatesContainer}>
                <Text variant="caption" style={styles.coordinatesHint}>
                  Destination coordinates represent the meeting venue for routing & map markers. (Not your personal GPS location).
                </Text>

                <View style={styles.coordInputsRow}>
                  <View style={styles.coordInputCol}>
                    <Text variant="caption" style={styles.label}>
                      LATITUDE (-90 to +90)
                    </Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="1.2834"
                      placeholderTextColor={tokens.colors.text.tertiary}
                      value={latitudeStr}
                      onChangeText={setLatitudeStr}
                      keyboardType="numbers-and-punctuation"
                    />
                  </View>

                  <View style={styles.coordInputCol}>
                    <Text variant="caption" style={styles.label}>
                      LONGITUDE (-180 to +180)
                    </Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="103.8607"
                      placeholderTextColor={tokens.colors.text.tertiary}
                      value={longitudeStr}
                      onChangeText={setLongitudeStr}
                      keyboardType="numbers-and-punctuation"
                    />
                  </View>
                </View>
              </View>
            )}
          </ScrollView>

          {/* Footer Submit Button */}
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
                  {isMilestone ? 'Publish Milestone' : 'Add to Itinerary'}
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
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  presetChip: {
    backgroundColor: '#1E222B',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: tokens.radius.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  presetChipActive: {
    backgroundColor: 'rgba(129, 140, 248, 0.15)',
    borderColor: 'rgba(129, 140, 248, 0.5)',
  },
  presetChipText: {
    color: tokens.colors.text.secondary,
    fontWeight: '500',
    fontSize: 11,
  },
  presetChipTextActive: {
    color: '#818CF8',
    fontWeight: '700',
  },
  previewBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderRadius: tokens.radius.sm,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: 8,
    marginBottom: tokens.spacing.md,
    gap: 8,
  },
  previewText: {
    color: '#F59E0B',
    fontWeight: '600',
    flex: 1,
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
  coordinatesHint: {
    color: tokens.colors.text.tertiary,
    fontSize: 11,
    lineHeight: 16,
    marginBottom: tokens.spacing.sm,
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

export default CreateEventModal;
