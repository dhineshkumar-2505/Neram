import React, { useRef } from 'react';
import { View, StyleSheet, Pressable, Image, Animated } from 'react-native';
import { tokens } from '../../../design';
import Text from '../../../components/Text';
import { haptics } from '../../../utils/haptics';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import {
  CheckCircleIcon,
  CircleIcon,
  CalendarIcon,
  TrashIcon,
} from './TaskIcons';
import type { TaskRecord, TaskPriority } from '../types';

export interface TaskCardProps {
  task: TaskRecord;
  onToggleStatus: (taskId: string) => void;
  onPress?: (task: TaskRecord) => void;
  onDelete?: (taskId: string) => void;
  isReadOnly?: boolean;
}

/**
 * Priority color accent configuration.
 */
const PRIORITY_THEMES: Record<
  TaskPriority,
  { text: string; bg: string; border: string; label: string }
> = {
  CRITICAL: {
    text: '#EF4444',
    bg: 'rgba(239, 68, 68, 0.12)',
    border: 'rgba(239, 68, 68, 0.35)',
    label: 'CRITICAL',
  },
  HIGH: {
    text: '#F59E0B',
    bg: 'rgba(245, 158, 11, 0.12)',
    border: 'rgba(245, 158, 11, 0.35)',
    label: 'HIGH',
  },
  MEDIUM: {
    text: '#818CF8',
    bg: 'rgba(129, 140, 248, 0.12)',
    border: 'rgba(129, 140, 248, 0.35)',
    label: 'MEDIUM',
  },
  LOW: {
    text: '#94A3B8',
    bg: 'rgba(148, 163, 184, 0.1)',
    border: 'rgba(148, 163, 184, 0.25)',
    label: 'LOW',
  },
};

/**
 * Formats deadline timestamp to human-friendly relative label.
 */
export function formatDeadline(
  deadlineIso: string | null,
  isCompleted: boolean,
): { text: string; isOverdue: boolean } | null {
  if (!deadlineIso) return null;

  try {
    const target = new Date(deadlineIso).getTime();
    if (isNaN(target)) return null;

    const now = Date.now();
    const diffMs = target - now;
    const isOverdue = diffMs < 0 && !isCompleted;

    if (isOverdue) {
      const overdueHours = Math.max(1, Math.round(Math.abs(diffMs) / (1000 * 60 * 60)));
      if (overdueHours < 24) {
        return { text: `Overdue by ${overdueHours}h`, isOverdue: true };
      }
      const overdueDays = Math.floor(overdueHours / 24);
      return { text: `Overdue by ${overdueDays}d`, isOverdue: true };
    }

    if (diffMs < 0) return { text: 'Past due', isOverdue: false };

    const futureHours = Math.round(diffMs / (1000 * 60 * 60));
    if (futureHours < 24) return { text: `Due in ${Math.max(1, futureHours)}h`, isOverdue: false };
    const diffDays = Math.floor(futureHours / 24);
    if (diffDays === 1) return { text: 'Due tomorrow', isOverdue: false };
    return { text: `Due in ${diffDays}d`, isOverdue: false };
  } catch {
    return null;
  }
}

/**
 * Obsidian Dark styled task card with tactile checkmark and avatar stack.
 */
export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  onToggleStatus,
  onPress,
  onDelete,
  isReadOnly = false,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const isCompleted = task.status === 'COMPLETED';
  const priorityTheme = PRIORITY_THEMES[task.priority] || PRIORITY_THEMES.MEDIUM;
  const deadlineInfo = formatDeadline(task.deadline, isCompleted);

  const handleToggle = () => {
    if (isReadOnly) return;
    if (isCompleted) {
      haptics.selection();
    } else {
      haptics.success();
    }
    if (!prefersReducedMotion) {
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 1.25, duration: 90, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, friction: 5, tension: 200, useNativeDriver: true }),
      ]).start();
    }
    onToggleStatus(task.id);
  };

  return (
    <Pressable
      onPress={() => onPress?.(task)}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.cardContainer,
        isCompleted && styles.cardCompleted,
        pressed && onPress && styles.cardPressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Task: ${task.title}, priority ${task.priority}, status ${task.status}`}
      testID={`task-card-${task.id}`}
    >
      <View style={styles.mainRow}>
        {/* Tactile Checkmark Button */}
        <Pressable
          onPress={handleToggle}
          disabled={isReadOnly}
          hitSlop={10}
          style={styles.checkButton}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: isCompleted, disabled: isReadOnly }}
          testID={`task-check-${task.id}`}
        >
          <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
            {isCompleted ? <CheckCircleIcon size={24} /> : <CircleIcon size={24} />}
          </Animated.View>
        </Pressable>

        {/* Task Details */}
        <View style={styles.textContainer}>
          <Text
            variant="body"
            weight={isCompleted ? 'regular' : 'semibold'}
            style={[
              styles.taskTitle,
              isCompleted && styles.taskTitleCompleted,
            ]}
            numberOfLines={2}
          >
            {task.title}
          </Text>

          {task.description ? (
            <Text
              variant="caption"
              style={[
                styles.taskDescription,
                isCompleted && styles.taskDescriptionCompleted,
              ]}
              numberOfLines={2}
            >
              {task.description}
            </Text>
          ) : null}

          {/* Meta Badges Row */}
          <View style={styles.metaRow}>
            {/* Priority Chip */}
            <View
              style={[
                styles.priorityChip,
                { backgroundColor: priorityTheme.bg, borderColor: priorityTheme.border },
              ]}
              testID={`priority-badge-${task.priority}`}
            >
              <Text
                variant="caption"
                weight="bold"
                style={[styles.priorityText, { color: priorityTheme.text }]}
              >
                {priorityTheme.label}
              </Text>
            </View>

            {/* Deadline Badge */}
            {deadlineInfo && (
              <View
                style={[
                  styles.deadlineBadge,
                  deadlineInfo.isOverdue && styles.deadlineOverdue,
                ]}
              >
                <CalendarIcon
                  size={12}
                  color={deadlineInfo.isOverdue ? '#EF4444' : '#94A3B8'}
                />
                <Text
                  variant="caption"
                  style={[
                    styles.deadlineText,
                    deadlineInfo.isOverdue && styles.deadlineTextOverdue,
                  ]}
                >
                  {deadlineInfo.text}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Delete action (if not read-only and onDelete provided) */}
        {!isReadOnly && onDelete && (
          <Pressable
            onPress={() => onDelete(task.id)}
            hitSlop={8}
            style={styles.deleteButton}
            accessibilityRole="button"
            accessibilityLabel="Delete task"
            testID={`delete-task-${task.id}`}
          >
            <TrashIcon size={16} color="#64748B" />
          </Pressable>
        )}
      </View>

      {/* Assignee Avatars Bottom Row */}
      {task.assignees.length > 0 && (
        <View style={styles.assigneeRow}>
          <View style={styles.avatarStack}>
            {task.assignees.slice(0, 4).map((assignee, idx) => {
              const initial = (
                assignee.displayName?.[0] ||
                assignee.username?.[0] ||
                '?'
              ).toUpperCase();

              return (
                <View
                  key={assignee.userId}
                  style={[
                    styles.avatarCircle,
                    { zIndex: 10 - idx, marginLeft: idx > 0 ? -8 : 0 },
                  ]}
                  testID={`assignee-avatar-${assignee.userId}`}
                >
                  {assignee.avatarUrl ? (
                    <Image
                      source={{ uri: assignee.avatarUrl }}
                      style={styles.avatarImage}
                    />
                  ) : (
                    <Text variant="caption" weight="bold" style={styles.avatarInitial}>
                      {initial}
                    </Text>
                  )}
                </View>
              );
            })}

            {task.assignees.length > 4 && (
              <View style={[styles.avatarCircle, styles.overflowCircle, { marginLeft: -8 }]}>
                <Text variant="caption" weight="bold" style={styles.overflowText}>
                  +{task.assignees.length - 4}
                </Text>
              </View>
            )}
          </View>

          <Text variant="caption" style={styles.assigneeSummary} numberOfLines={1}>
            {task.assignees.length === 1
              ? task.assignees[0]?.displayName || task.assignees[0]?.username
              : `${task.assignees.length} assignees`}
          </Text>
        </View>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: '#111827',
    borderRadius: 14,
    padding: tokens.spacing.md,
    marginBottom: tokens.spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  cardCompleted: {
    backgroundColor: 'rgba(17, 24, 39, 0.6)',
    borderColor: 'rgba(255, 255, 255, 0.04)',
    opacity: 0.85,
  },
  cardPressed: {
    backgroundColor: '#161F30',
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  checkButton: {
    marginRight: tokens.spacing.sm,
    paddingTop: 2,
  },
  textContainer: {
    flex: 1,
  },
  taskTitle: {
    color: '#F8FAFC',
    fontSize: 15,
    lineHeight: 20,
    marginBottom: 2,
  },
  taskTitleCompleted: {
    color: '#64748B',
    textDecorationLine: 'line-through',
  },
  taskDescription: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: tokens.spacing.xs,
  },
  taskDescriptionCompleted: {
    color: '#475569',
    textDecorationLine: 'line-through',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: tokens.spacing.xs,
    marginTop: 4,
  },
  priorityChip: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  priorityText: {
    fontSize: 10,
    letterSpacing: 0.5,
  },
  deadlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(148, 163, 184, 0.08)',
  },
  deadlineOverdue: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
  },
  deadlineText: {
    color: '#94A3B8',
    fontSize: 11,
  },
  deadlineTextOverdue: {
    color: '#EF4444',
    fontWeight: 'bold',
  },
  deleteButton: {
    padding: tokens.spacing.xs,
    marginLeft: tokens.spacing.xs,
  },
  assigneeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: tokens.spacing.sm,
    paddingTop: tokens.spacing.xs,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  avatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#1E293B',
    borderWidth: 1.5,
    borderColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarInitial: {
    color: '#818CF8',
    fontSize: 10,
  },
  overflowCircle: {
    backgroundColor: '#334155',
  },
  overflowText: {
    color: '#F8FAFC',
    fontSize: 9,
  },
  assigneeSummary: {
    color: '#64748B',
    fontSize: 11,
  },
});

export default TaskCard;
