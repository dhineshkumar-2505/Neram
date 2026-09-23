import React, { useState, useCallback } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { tokens } from '../../../design';
import Text from '../../../components/Text';
import { FlagIcon, UsersIcon, CalendarIcon } from './TaskIcons';
import type { TaskPriority, TaskAssignee, CreateTaskInput, TaskRecord } from '../types';

export interface CreateTaskModalProps {
  visible: boolean;
  onClose: () => void;
  onCreate: (
    input: Omit<CreateTaskInput, 'groupId'>,
  ) => Promise<{ task: TaskRecord | null; error?: string }>;
  eligibleAssignees: TaskAssignee[];
}

const PRIORITIES: TaskPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

type DeadlinePreset = 'NONE' | 'TODAY' | 'TOMORROW' | '3DAYS';

const DEADLINE_OPTIONS: Array<{ key: DeadlinePreset; label: string }> = [
  { key: 'NONE', label: 'None' },
  { key: 'TODAY', label: '+4 Hours' },
  { key: 'TOMORROW', label: '+1 Day' },
  { key: '3DAYS', label: '+3 Days' },
];

export const CreateTaskModal: React.FC<CreateTaskModalProps> = ({
  visible,
  onClose,
  onCreate,
  eligibleAssignees,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('MEDIUM');
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<string[]>([]);
  const [deadlinePreset, setDeadlinePreset] = useState<DeadlinePreset>('NONE');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setPriority('MEDIUM');
    setSelectedAssigneeIds([]);
    setDeadlinePreset('NONE');
    setErrorBanner(null);
    setIsSubmitting(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const toggleAssignee = (userId: string) => {
    setSelectedAssigneeIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  };

  const calculateDeadline = (): string | null => {
    const now = Date.now();
    if (deadlinePreset === 'TODAY') {
      return new Date(now + 4 * 3600 * 1000).toISOString();
    }
    if (deadlinePreset === 'TOMORROW') {
      return new Date(now + 24 * 3600 * 1000).toISOString();
    }
    if (deadlinePreset === '3DAYS') {
      return new Date(now + 72 * 3600 * 1000).toISOString();
    }
    return null;
  };

  const handleSubmit = useCallback(async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setErrorBanner('Please provide a task title.');
      return;
    }
    if (trimmedTitle.length > 120) {
      setErrorBanner('Task title must be 120 characters or less.');
      return;
    }

    setIsSubmitting(true);
    setErrorBanner(null);

    const deadline = calculateDeadline();

    const res = await onCreate({
      title: trimmedTitle,
      description: description.trim() || null,
      priority,
      deadline,
      assigneeIds: selectedAssigneeIds,
    });

    setIsSubmitting(false);

    if (res.error || !res.task) {
      setErrorBanner(res.error || 'Failed to create task.');
    } else {
      handleClose();
    }
  }, [title, description, priority, selectedAssigneeIds, deadlinePreset, onCreate]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalOverlay}
      >
        <View style={styles.modalContent} testID="create-task-modal">
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text variant="title2" weight="bold" style={styles.modalTitle}>
              New Space Task
            </Text>
            <Pressable
              onPress={handleClose}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
            >
              <Text variant="body" style={styles.cancelText}>
                Cancel
              </Text>
            </Pressable>
          </View>

          {errorBanner && (
            <View style={styles.errorBox}>
              <Text variant="caption" style={styles.errorText}>
                {errorBanner}
              </Text>
            </View>
          )}

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollBody}>
            {/* Title Input */}
            <Text variant="caption" weight="semibold" style={styles.inputLabel}>
              TASK TITLE *
            </Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Reserve photo studio equipment"
              placeholderTextColor="#64748B"
              value={title}
              onChangeText={setTitle}
              maxLength={120}
              autoFocus
              testID="task-title-input"
            />

            {/* Description Input */}
            <Text variant="caption" weight="semibold" style={styles.inputLabel}>
              DESCRIPTION (OPTIONAL)
            </Text>
            <TextInput
              style={[styles.input, styles.multilineInput]}
              placeholder="Add details, notes, or specific requirements..."
              placeholderTextColor="#64748B"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
              testID="task-description-input"
            />

            {/* Priority Selector */}
            <View style={styles.sectionHeader}>
              <FlagIcon size={14} color="#818CF8" />
              <Text variant="caption" weight="semibold" style={styles.inputLabelNoMargin}>
                PRIORITY
              </Text>
            </View>
            <View style={styles.segmentRow}>
              {PRIORITIES.map((p) => {
                const isSelected = priority === p;
                return (
                  <Pressable
                    key={p}
                    onPress={() => setPriority(p)}
                    style={[
                      styles.segmentButton,
                      isSelected && styles.segmentButtonActive,
                    ]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSelected }}
                    testID={`priority-option-${p}`}
                  >
                    <Text
                      variant="caption"
                      weight={isSelected ? 'bold' : 'regular'}
                      style={[
                        styles.segmentText,
                        isSelected && styles.segmentTextActive,
                      ]}
                    >
                      {p}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Deadline Presets */}
            <View style={styles.sectionHeader}>
              <CalendarIcon size={14} color="#818CF8" />
              <Text variant="caption" weight="semibold" style={styles.inputLabelNoMargin}>
                DUE DATE
              </Text>
            </View>
            <View style={styles.segmentRow}>
              {DEADLINE_OPTIONS.map((opt) => {
                const isSelected = deadlinePreset === opt.key;
                return (
                  <Pressable
                    key={opt.key}
                    onPress={() => setDeadlinePreset(opt.key)}
                    style={[
                      styles.segmentButton,
                      isSelected && styles.segmentButtonActive,
                    ]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSelected }}
                  >
                    <Text
                      variant="caption"
                      weight={isSelected ? 'bold' : 'regular'}
                      style={[
                        styles.segmentText,
                        isSelected && styles.segmentTextActive,
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Eligible Assignees Multi-Select */}
            {eligibleAssignees.length > 0 && (
              <>
                <View style={styles.sectionHeader}>
                  <UsersIcon size={14} color="#818CF8" />
                  <Text variant="caption" weight="semibold" style={styles.inputLabelNoMargin}>
                    ASSIGN MEMBERS
                  </Text>
                </View>
                <View style={styles.assigneeList}>
                  {eligibleAssignees.map((member) => {
                    const isSelected = selectedAssigneeIds.includes(member.userId);
                    return (
                      <Pressable
                        key={member.userId}
                        onPress={() => toggleAssignee(member.userId)}
                        style={[
                          styles.assigneePill,
                          isSelected && styles.assigneePillActive,
                        ]}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: isSelected }}
                        testID={`assignee-pill-${member.userId}`}
                      >
                        <Text
                          variant="caption"
                          weight={isSelected ? 'bold' : 'regular'}
                          style={[
                            styles.assigneePillText,
                            isSelected && styles.assigneePillTextActive,
                          ]}
                        >
                          {member.displayName || `@${member.username}`}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            )}
          </ScrollView>

          {/* Submit Action */}
          <Pressable
            onPress={handleSubmit}
            disabled={isSubmitting}
            style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
            accessibilityRole="button"
            accessibilityLabel="Create Task"
            testID="submit-create-task-button"
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#F8FAFC" />
            ) : (
              <Text variant="body" weight="bold" style={styles.submitButtonText}>
                Create Task
              </Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#0D111C',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: tokens.spacing.lg,
    maxHeight: '90%',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tokens.spacing.md,
  },
  modalTitle: {
    color: '#F8FAFC',
  },
  cancelText: {
    color: '#94A3B8',
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 8,
    padding: tokens.spacing.sm,
    marginBottom: tokens.spacing.md,
  },
  errorText: {
    color: '#EF4444',
  },
  scrollBody: {
    paddingBottom: tokens.spacing.lg,
  },
  inputLabel: {
    color: '#94A3B8',
    fontSize: 11,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  inputLabelNoMargin: {
    color: '#94A3B8',
    fontSize: 11,
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: '#161F30',
    color: '#F8FAFC',
    borderRadius: 10,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    fontSize: 15,
    marginBottom: tokens.spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  multilineInput: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  segmentRow: {
    flexDirection: 'row',
    backgroundColor: '#111827',
    borderRadius: 10,
    padding: 3,
    marginBottom: tokens.spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  segmentButtonActive: {
    backgroundColor: '#818CF8',
  },
  segmentText: {
    color: '#94A3B8',
    fontSize: 12,
  },
  segmentTextActive: {
    color: '#F8FAFC',
  },
  assigneeList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: tokens.spacing.md,
  },
  assigneePill: {
    backgroundColor: '#161F30',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  assigneePillActive: {
    backgroundColor: 'rgba(129, 140, 248, 0.15)',
    borderColor: '#818CF8',
  },
  assigneePillText: {
    color: '#94A3B8',
    fontSize: 12,
  },
  assigneePillTextActive: {
    color: '#818CF8',
  },
  submitButton: {
    backgroundColor: '#818CF8',
    paddingVertical: tokens.spacing.md,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#F8FAFC',
    fontSize: 16,
  },
});

export default CreateTaskModal;
