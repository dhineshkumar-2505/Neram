import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '../../../design';
import Text from '../../../components/Text';
import { LoadingState, ErrorState, EmptyState } from '../../../components';
import { useAuth } from '../../../hooks/useAuth';
import type { GroupDetailedRecord } from '../../groups/types';
import { groupService } from '../../groups/services/groupService';
import { useGroupLifecycle } from '../../groups/hooks/useGroupLifecycle';
import { useTasks } from '../hooks/useTasks';
import { TaskCard } from '../components/TaskCard';
import { CreateTaskModal } from '../components/CreateTaskModal';
import { PlusIcon, LockIcon, SortIcon } from '../components/TaskIcons';
import type { TaskFilterTab, TaskSortOption } from '../types';
import type { RootStackScreenProps } from '../../../navigation/types';

export const TaskBoardScreen: React.FC<RootStackScreenProps<'TaskBoard'>> = ({
  route,
  navigation,
}) => {
  const insets = useSafeAreaInsets();
  const { groupId, groupName: initialGroupName } = route.params;
  const { user } = useAuth();
  const currentUserId = user?.id;

  const [group, setGroup] = useState<GroupDetailedRecord | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  // Fetch initial group for lifecycle computation
  useEffect(() => {
    let isCurrent = true;
    groupService.fetchGroupDetails(groupId).then((res) => {
      if (isCurrent && res.group) {
        setGroup(res.group);
      }
    });
    return () => {
      isCurrent = false;
    };
  }, [groupId]);

  const { isExpired, remainingTime } = useGroupLifecycle(
    group?.starts_at,
    group?.expires_at,
    group?.lifecycle_state || 'ACTIVE',
    groupId,
  );

  const {
    tasks,
    counts,
    eligibleAssignees,
    filterTab,
    setFilterTab,
    selectedAssigneeId,
    setSelectedAssigneeId,
    sortBy,
    setSortBy,
    isLoading,
    isRefreshing,
    error,
    refresh,
    createTask,
    toggleTaskStatus,
    deleteTask,
    isReadOnly,
  } = useTasks({
    groupId,
    isExpired,
    currentUserId,
  });

  const spaceTitle = group?.name || initialGroupName || 'Space Tasks';

  const cycleSort = () => {
    if (sortBy === 'POSITION') setSortBy('PRIORITY');
    else if (sortBy === 'PRIORITY') setSortBy('DEADLINE');
    else setSortBy('POSITION');
  };

  const getSortLabel = (sort: TaskSortOption): string => {
    switch (sort) {
      case 'PRIORITY':
        return 'Priority';
      case 'DEADLINE':
        return 'Due Date';
      case 'POSITION':
      default:
        return 'Custom';
    }
  };

  return (
    <View style={[styles.screenContainer, { paddingTop: insets.top }]}>
      {/* Obsidian Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={8}
          testID="task-board-back-button"
        >
          <Text variant="title2" style={styles.backText}>
            ‹
          </Text>
        </Pressable>

        <View style={styles.headerTitleContainer}>
          <Text variant="body" weight="bold" style={styles.headerTitle} numberOfLines={1}>
            {spaceTitle}
          </Text>
          <Text variant="caption" style={styles.headerSubtitle}>
            {isExpired
              ? 'EXPIRED • ARCHIVED'
              : `${remainingTime.formattedText} remaining`}
          </Text>
        </View>

        <View style={styles.headerRightSpacer} />
      </View>

      {/* Lifecycle Expiration Read-Only Banner */}
      {isReadOnly && (
        <View style={styles.readOnlyBanner} testID="task-board-readonly-banner">
          <LockIcon size={16} color="#94A3B8" />
          <Text variant="caption" weight="semibold" style={styles.readOnlyText}>
            Space lifecycle concluded. Task board is in read-only archive mode.
          </Text>
        </View>
      )}

      {/* Segment Tabs Row */}
      <View style={styles.segmentRow}>
        {(
          [
            { key: 'ALL', label: `All (${counts.total})` },
            { key: 'ACTIVE', label: `Active (${counts.active})` },
            { key: 'COMPLETED', label: `Done (${counts.completed})` },
          ] as Array<{ key: TaskFilterTab; label: string }>
        ).map((tab) => {
          const isActive = filterTab === tab.key;
          return (
            <Pressable
              key={tab.key}
              onPress={() => setFilterTab(tab.key)}
              style={[styles.segmentTab, isActive && styles.segmentTabActive]}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              testID={`filter-tab-${tab.key}`}
            >
              <Text
                variant="caption"
                weight={isActive ? 'bold' : 'medium'}
                style={[styles.segmentTabText, isActive && styles.segmentTabTextActive]}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Secondary Controls: Assignee Filter Chips & Sort Toggle */}
      <View style={styles.controlsRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.assigneeFilterScroll}
        >
          <Pressable
            onPress={() => setSelectedAssigneeId(null)}
            style={[
              styles.filterChip,
              selectedAssigneeId === null && styles.filterChipActive,
            ]}
            accessibilityRole="button"
            testID="filter-assignee-all"
          >
            <Text
              variant="caption"
              weight={selectedAssigneeId === null ? 'bold' : 'regular'}
              style={[
                styles.filterChipText,
                selectedAssigneeId === null && styles.filterChipTextActive,
              ]}
            >
              All Members
            </Text>
          </Pressable>

          {eligibleAssignees.map((member) => {
            const isSelected = selectedAssigneeId === member.userId;
            return (
              <Pressable
                key={member.userId}
                onPress={() => setSelectedAssigneeId(isSelected ? null : member.userId)}
                style={[styles.filterChip, isSelected && styles.filterChipActive]}
                accessibilityRole="button"
                testID={`filter-assignee-${member.userId}`}
              >
                <Text
                  variant="caption"
                  weight={isSelected ? 'bold' : 'regular'}
                  style={[styles.filterChipText, isSelected && styles.filterChipTextActive]}
                >
                  {member.displayName || `@${member.username}`}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Sort Button */}
        <Pressable
          onPress={cycleSort}
          style={styles.sortButton}
          accessibilityRole="button"
          accessibilityLabel={`Sorted by ${getSortLabel(sortBy)}`}
          testID="cycle-sort-button"
        >
          <SortIcon size={14} color="#818CF8" />
          <Text variant="caption" weight="semibold" style={styles.sortButtonText}>
            {getSortLabel(sortBy)}
          </Text>
        </Pressable>
      </View>

      {/* Content Area */}
      {isLoading ? (
        <LoadingState message="Connecting to secure task board..." />
      ) : error ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : (
        <FlatList
          data={tasks}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TaskCard
              task={item}
              onToggleStatus={toggleTaskStatus}
              onDelete={deleteTask}
              isReadOnly={isReadOnly}
            />
          )}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={refresh}
              tintColor="#818CF8"
              colors={['#818CF8']}
            />
          }
          ListEmptyComponent={
            <EmptyState
              title={
                filterTab === 'COMPLETED'
                  ? 'No Completed Tasks'
                  : filterTab === 'ACTIVE'
                    ? 'All Caught Up'
                    : 'No Tasks Yet'
              }
              description={
                filterTab === 'COMPLETED'
                  ? 'Check off active tasks as milestones are completed.'
                  : filterTab === 'ACTIVE'
                    ? 'Great job! All tasks for this temporary space have been finished.'
                    : 'Create action items, assign team members, and track sprint goals.'
              }
            />
          }
          contentContainerStyle={styles.listContent}
        />
      )}

      {/* Floating Action Button for Task Creation */}
      {!isReadOnly && (
        <Pressable
          onPress={() => setModalVisible(true)}
          style={styles.fab}
          accessibilityRole="button"
          accessibilityLabel="Add Task"
          testID="add-task-fab"
        >
          <PlusIcon size={22} color="#F8FAFC" />
          <Text variant="body" weight="bold" style={styles.fabText}>
            Add Task
          </Text>
        </Pressable>
      )}

      {/* Create Task Modal */}
      <CreateTaskModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onCreate={createTask}
        eligibleAssignees={eligibleAssignees}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: '#0B0F19',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
    backgroundColor: '#0D111C',
  },
  backButton: {
    padding: tokens.spacing.xs,
    width: 40,
  },
  backText: {
    color: '#818CF8',
    fontSize: 28,
    lineHeight: 28,
  },
  headerTitleContainer: {
    alignItems: 'center',
    flex: 1,
  },
  headerTitle: {
    color: '#F8FAFC',
    fontSize: 16,
  },
  headerSubtitle: {
    color: '#94A3B8',
    fontSize: 11,
  },
  headerRightSpacer: {
    width: 40,
  },
  readOnlyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161F30',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  readOnlyText: {
    color: '#94A3B8',
    flex: 1,
    fontSize: 12,
  },
  segmentRow: {
    flexDirection: 'row',
    backgroundColor: '#111827',
    marginHorizontal: tokens.spacing.md,
    marginTop: tokens.spacing.sm,
    borderRadius: 10,
    padding: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  segmentTab: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: 8,
  },
  segmentTabActive: {
    backgroundColor: '#818CF8',
  },
  segmentTabText: {
    color: '#94A3B8',
    fontSize: 12,
  },
  segmentTabTextActive: {
    color: '#F8FAFC',
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    gap: 8,
  },
  assigneeFilterScroll: {
    flexDirection: 'row',
    gap: 6,
    paddingRight: tokens.spacing.xs,
  },
  filterChip: {
    backgroundColor: '#161F30',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  filterChipActive: {
    backgroundColor: 'rgba(129, 140, 248, 0.15)',
    borderColor: '#818CF8',
  },
  filterChipText: {
    color: '#94A3B8',
    fontSize: 11,
  },
  filterChipTextActive: {
    color: '#818CF8',
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#161F30',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(129, 140, 248, 0.2)',
  },
  sortButtonText: {
    color: '#818CF8',
    fontSize: 11,
  },
  listContent: {
    paddingHorizontal: tokens.spacing.md,
    paddingTop: tokens.spacing.xs,
    paddingBottom: 90,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#818CF8',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: 12,
    borderRadius: 24,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    gap: 6,
  },
  fabText: {
    color: '#F8FAFC',
    fontSize: 15,
  },
});

export default TaskBoardScreen;
