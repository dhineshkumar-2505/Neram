import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { tokens } from '../../../design';
import Text from '../../../components/Text';
import { PlusIcon, TrashIcon } from './PollIcons';

export interface CreatePollModalProps {
  visible: boolean;
  onClose: () => void;
  onCreate: (input: {
    question: string;
    options: string[];
    isMultipleChoice: boolean;
    durationHours: number | null;
  }) => Promise<{ success: boolean; error?: string }>;
}

const DURATION_PRESETS = [
  { id: '1h', label: '1 Hour', hours: 1 },
  { id: '4h', label: '4 Hours', hours: 4 },
  { id: '24h', label: '24 Hours', hours: 24 },
  { id: 'space', label: 'Space Expiry', hours: null },
];

export const CreatePollModal: React.FC<CreatePollModalProps> = ({
  visible,
  onClose,
  onCreate,
}) => {
  const [question, setQuestion] = useState('');
  const [isMultipleChoice, setIsMultipleChoice] = useState(false);
  const [options, setOptions] = useState<string[]>(['', '']);
  const [selectedDuration, setSelectedDuration] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setQuestion('');
    setIsMultipleChoice(false);
    setOptions(['', '']);
    setSelectedDuration(null);
    setIsSubmitting(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleAddOption = () => {
    if (options.length >= 6) return;
    setOptions((prev) => [...prev, '']);
  };

  const handleRemoveOption = (index: number) => {
    if (options.length <= 2) return;
    setOptions((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleOptionChange = (text: string, index: number) => {
    setOptions((prev) => {
      const copy = [...prev];
      copy[index] = text;
      return copy;
    });
  };

  const handleSubmit = async () => {
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion) {
      Alert.alert('Required', 'Please enter a poll question.');
      return;
    }

    const trimmedOptions = options.map((o) => o.trim()).filter(Boolean);
    if (trimmedOptions.length < 2) {
      Alert.alert('Required', 'Please enter at least 2 distinct options.');
      return;
    }

    // Check for duplicates
    const seen = new Set<string>();
    for (const opt of trimmedOptions) {
      const lower = opt.toLowerCase();
      if (seen.has(lower)) {
        Alert.alert('Duplicate Option', `The option "${opt}" is listed more than once.`);
        return;
      }
      seen.add(lower);
    }

    setIsSubmitting(true);
    try {
      const res = await onCreate({
        question: trimmedQuestion,
        options: trimmedOptions,
        isMultipleChoice,
        durationHours: selectedDuration,
      });

      if (res.success) {
        handleClose();
      } else {
        Alert.alert('Error', res.error || 'Failed to create poll.');
      }
    } catch {
      Alert.alert('Error', 'An unexpected error occurred.');
    } finally {
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
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={handleClose} />

        <View style={styles.sheet}>
          {/* Handle */}
          <View style={styles.dragHandle} />

          {/* Title */}
          <View style={styles.header}>
            <Text variant="title3" weight="bold" style={styles.title}>
              New Consensus Poll
            </Text>
            <Pressable onPress={handleClose} hitSlop={8}>
              <Text variant="body" style={styles.cancelText}>
                Cancel
              </Text>
            </Pressable>
          </View>

          <ScrollView style={styles.scrollContent} keyboardShouldPersistTaps="handled">
            {/* Question Input */}
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text variant="caption" weight="semibold" style={styles.label}>
                  QUESTION
                </Text>
                <Text variant="caption" style={styles.counter}>
                  {question.length}/250
                </Text>
              </View>
              <TextInput
                testID="poll-question-input"
                style={styles.textInput}
                placeholder="What should the group decide?"
                placeholderTextColor={tokens.colors.text.secondary}
                value={question}
                onChangeText={(text) => setQuestion(text.slice(0, 250))}
                multiline
                maxLength={250}
              />
            </View>

            {/* Poll Type Toggle */}
            <View style={styles.inputGroup}>
              <Text variant="caption" weight="semibold" style={styles.label}>
                SELECTION MODE
              </Text>
              <View style={styles.segmentContainer}>
                <Pressable
                  testID="segment-single-choice"
                  style={[styles.segmentBtn, !isMultipleChoice && styles.segmentBtnActive]}
                  onPress={() => setIsMultipleChoice(false)}
                >
                  <Text
                    variant="caption"
                    weight={!isMultipleChoice ? 'bold' : 'medium'}
                    style={[
                      styles.segmentBtnText,
                      !isMultipleChoice && styles.segmentBtnTextActive,
                    ]}
                  >
                    Single Choice
                  </Text>
                </Pressable>

                <Pressable
                  testID="segment-multi-choice"
                  style={[styles.segmentBtn, isMultipleChoice && styles.segmentBtnActive]}
                  onPress={() => setIsMultipleChoice(true)}
                >
                  <Text
                    variant="caption"
                    weight={isMultipleChoice ? 'bold' : 'medium'}
                    style={[
                      styles.segmentBtnText,
                      isMultipleChoice && styles.segmentBtnTextActive,
                    ]}
                  >
                    Multiple Choice
                  </Text>
                </Pressable>
              </View>
              <Text variant="caption" style={styles.segmentHelper}>
                {isMultipleChoice
                  ? 'Members can vote for multiple options.'
                  : 'Members can vote for exactly one option.'}
              </Text>
            </View>

            {/* Options List */}
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text variant="caption" weight="semibold" style={styles.label}>
                  OPTIONS (2–6)
                </Text>
                <Text variant="caption" style={styles.counter}>
                  {options.length}/6
                </Text>
              </View>

              {options.map((opt, idx) => (
                <View key={`opt-${idx}`} style={styles.optionInputRow}>
                  <TextInput
                    testID={`poll-option-input-${idx}`}
                    style={styles.optionInput}
                    placeholder={`Option ${idx + 1}`}
                    placeholderTextColor={tokens.colors.text.secondary}
                    value={opt}
                    onChangeText={(text) => handleOptionChange(text.slice(0, 120), idx)}
                    maxLength={120}
                  />

                  {options.length > 2 && (
                    <Pressable
                      testID={`remove-option-${idx}`}
                      style={styles.deleteOptionBtn}
                      onPress={() => handleRemoveOption(idx)}
                      hitSlop={8}
                    >
                      <TrashIcon size={16} />
                    </Pressable>
                  )}
                </View>
              ))}

              {options.length < 6 && (
                <Pressable
                  testID="add-option-button"
                  style={styles.addOptionBtn}
                  onPress={handleAddOption}
                >
                  <PlusIcon size={16} color="#818CF8" />
                  <Text variant="caption" weight="semibold" style={styles.addOptionText}>
                    Add Option
                  </Text>
                </Pressable>
              )}
            </View>

            {/* Duration Presets */}
            <View style={styles.inputGroup}>
              <Text variant="caption" weight="semibold" style={styles.label}>
                POLL LIFESPAN
              </Text>
              <View style={styles.presetsRow}>
                {DURATION_PRESETS.map((preset) => {
                  const isSelected = selectedDuration === preset.hours;
                  return (
                    <Pressable
                      key={preset.id}
                      style={[styles.presetChip, isSelected && styles.presetChipActive]}
                      onPress={() => setSelectedDuration(preset.hours)}
                    >
                      <Text
                        variant="caption"
                        weight={isSelected ? 'bold' : 'medium'}
                        style={[
                          styles.presetChipText,
                          isSelected && styles.presetChipTextActive,
                        ]}
                      >
                        {preset.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </ScrollView>

          {/* Submit Button */}
          <View style={styles.footer}>
            <Pressable
              testID="create-poll-submit-button"
              style={[
                styles.submitButton,
                (!question.trim() || isSubmitting) && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={!question.trim() || isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text variant="body" weight="bold" style={styles.submitButtonText}>
                  Publish Poll
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
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  sheet: {
    backgroundColor: '#0F1626',
    borderTopLeftRadius: tokens.radius.xl,
    borderTopRightRadius: tokens.radius.xl,
    borderWidth: 1,
    borderColor: tokens.colors.border.subtle,
    maxHeight: '90%',
    paddingBottom: 24,
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing.lg,
    paddingBottom: tokens.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.border.subtle,
  },
  title: {
    color: tokens.colors.text.primary,
  },
  cancelText: {
    color: tokens.colors.text.secondary,
  },
  scrollContent: {
    paddingHorizontal: tokens.spacing.lg,
    paddingTop: tokens.spacing.md,
  },
  inputGroup: {
    marginBottom: tokens.spacing.md,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  label: {
    color: tokens.colors.text.secondary,
    letterSpacing: 0.5,
  },
  counter: {
    color: tokens.colors.text.secondary,
    fontSize: 10,
  },
  textInput: {
    backgroundColor: '#0B0F19',
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.border.subtle,
    color: tokens.colors.text.primary,
    padding: tokens.spacing.md,
    minHeight: 70,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: '#0B0F19',
    borderRadius: tokens.radius.md,
    padding: 3,
    borderWidth: 1,
    borderColor: tokens.colors.border.subtle,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: tokens.radius.sm,
  },
  segmentBtnActive: {
    backgroundColor: tokens.colors.primary.default,
  },
  segmentBtnText: {
    color: tokens.colors.text.secondary,
  },
  segmentBtnTextActive: {
    color: '#FFFFFF',
  },
  segmentHelper: {
    color: tokens.colors.text.secondary,
    fontSize: 11,
    marginTop: 4,
    paddingHorizontal: 2,
  },
  optionInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  optionInput: {
    flex: 1,
    backgroundColor: '#0B0F19',
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.border.subtle,
    color: tokens.colors.text.primary,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: 10,
    fontSize: 13,
  },
  deleteOptionBtn: {
    padding: 8,
  },
  addOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
    marginTop: 4,
  },
  addOptionText: {
    color: '#818CF8',
  },
  presetsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  presetChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: tokens.radius.sm,
    backgroundColor: '#0B0F19',
    borderWidth: 1,
    borderColor: tokens.colors.border.subtle,
    alignItems: 'center',
  },
  presetChipActive: {
    borderColor: tokens.colors.primary.default,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
  },
  presetChipText: {
    color: tokens.colors.text.secondary,
    fontSize: 11,
  },
  presetChipTextActive: {
    color: '#FFFFFF',
  },
  footer: {
    paddingHorizontal: tokens.spacing.lg,
    paddingTop: tokens.spacing.sm,
  },
  submitButton: {
    backgroundColor: tokens.colors.primary.default,
    borderRadius: tokens.radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
  },
});
