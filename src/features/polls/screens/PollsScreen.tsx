import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  FlatList,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '../../../design';
import Text from '../../../components/Text';
import { ErrorState, EmptyState } from '../../../components';
import { SkeletonPoll, FadeInContent } from '../../../components/skeleton';
import { useAuth } from '../../../hooks/useAuth';
import type { GroupDetailedRecord } from '../../groups/types';
import { groupService } from '../../groups/services/groupService';
import { useGroupLifecycle } from '../../groups/hooks/useGroupLifecycle';
import { usePolls } from '../hooks/usePolls';
import { PollCard } from '../components/PollCard';
import { CreatePollModal } from '../components/CreatePollModal';
import { PlusIcon, LockIcon, PollIcon } from '../components/PollIcons';
import type { PollFilterTab, PollSortOption } from '../types';
import type { RootStackScreenProps } from '../../../navigation/types';

export const PollsScreen: React.FC<RootStackScreenProps<'Polls'>> = ({
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
    polls,
    counts,
    isLoading,
    isRefreshing,
    error,
    filterTab,
    sortOption,
    setFilterTab,
    setSortOption,
    refresh,
    createPoll,
    vote,
    closePoll,
    deletePoll,
  } = usePolls({
    groupId,
    currentUserId,
    isExpired,
  });

  const spaceName = group?.name || initialGroupName || 'Space';
  const remainingTimeText = isExpired
    ? 'EXPIRED'
    : typeof remainingTime === 'string'
    ? remainingTime
    : remainingTime?.formattedText || '--';

  return (
    <View style={[styles.screen, { paddingTop: Math.max(insets.top, 16) }]}>
      {/* Space Header */}
      <View style={styles.header}>
        <Pressable
          testID="polls-back-button"
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          hitSlop={8}
        >
          <Text variant="body" weight="medium" style={styles.backButtonText}>
            Back
          </Text>
        </Pressable>

        <View style={styles.headerCenter}>
          <Text variant="title3" weight="bold" style={styles.title} numberOfLines={1}>
            Consensus Polls
          </Text>
          <Text variant="caption" style={styles.subtitle} numberOfLines={1}>
            {spaceName}
          </Text>
        </View>

        {/* Lifespan badge */}
        <View style={[styles.lifespanBadge, isExpired && styles.lifespanBadgeExpired]}>
          {isExpired && <LockIcon size={12} color="#EF4444" />}
          <Text
            variant="caption"
            weight="bold"
            style={[styles.lifespanText, isExpired && styles.lifespanTextExpired]}
          >
            {remainingTimeText}
          </Text>
        </View>
      </View>

      {/* Read-Only Expiration Banner */}
      {isExpired && (
        <View style={styles.expiredBanner}>
          <LockIcon size={16} color="#EF4444" />
          <Text variant="caption" weight="semibold" style={styles.expiredBannerText}>
            SPACE DISSOLVED — Consensus polling is locked in permanent read-only archive.
          </Text>
        </View>
      )}

      {/* Segment Tabs */}
      <View style={styles.tabsContainer}>
        {(['ALL', 'ACTIVE', 'CLOSED'] as PollFilterTab[]).map((tab) => {
          const isActive = filterTab === tab;
          const count =
            tab === 'ALL' ? counts.all : tab === 'ACTIVE' ? counts.active : counts.closed;
          const label = tab === 'ALL' ? 'All' : tab === 'ACTIVE' ? 'Active' : 'Closed';

          return (
            <Pressable
              key={tab}
              testID={`tab-${tab.toLowerCase()}`}
              style={[styles.tabButton, isActive && styles.tabButtonActive]}
              onPress={() => setFilterTab(tab)}
            >
              <Text
                variant="caption"
                weight={isActive ? 'bold' : 'medium'}
                style={[styles.tabText, isActive && styles.tabTextActive]}
              >
                {label} ({count})
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Sort Bar */}
      <View style={styles.sortBar}>
        <Text variant="caption" style={styles.sortLabel}>
          SORT BY
        </Text>
        <View style={styles.sortPills}>
          {(['NEWEST', 'MOST_VOTES'] as PollSortOption[]).map((option) => {
            const isSelected = sortOption === option;
            const label = option === 'NEWEST' ? 'Newest' : 'Most Votes';
            return (
              <Pressable
                key={option}
                style={[styles.sortPill, isSelected && styles.sortPillActive]}
                onPress={() => setSortOption(option)}
              >
                <Text
                  variant="caption"
                  weight={isSelected ? 'bold' : 'regular'}
                  style={[styles.sortPillText, isSelected && styles.sortPillTextActive]}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Main Content */}
      {isLoading ? (
        <SkeletonPoll count={3} />
      ) : error && polls.length === 0 ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : polls.length === 0 ? (
        <EmptyState
          icon={<PollIcon size={48} color="#6366F1" />}
          title="No Consensus Polls"
          description={
            filterTab === 'ALL'
              ? 'No polls have been created yet. Launch a poll to help your group make clear decisions.'
              : filterTab === 'ACTIVE'
              ? 'No active polls right now. All polls have either closed or reached their deadline.'
              : 'No closed polls yet.'
          }
        />
      ) : (
        <FadeInContent style={{ flex: 1 }}>
          <FlatList
            testID="polls-list"
            data={polls}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <PollCard
                poll={item}
                currentUserId={currentUserId}
                isExpired={isExpired}
                onVote={(pollId, optionId) => vote(pollId, optionId)}
                onClosePoll={(pollId) => closePoll(pollId)}
                onDeletePoll={(pollId) => deletePoll(pollId)}
              />
            )}
            contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 90 }]}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={refresh}
                tintColor="#6366F1"
                colors={['#6366F1']}
              />
            }
          />
        </FadeInContent>
      )}

      {/* Floating Action Button (FAB) */}
      {!isExpired && (
        <Pressable
          testID="create-poll-fab"
          style={[styles.fab, { bottom: Math.max(insets.bottom, 20) + 16 }]}
          onPress={() => setModalVisible(true)}
        >
          <PlusIcon size={24} color="#FFFFFF" />
          <Text variant="body" weight="bold" style={styles.fabText}>
            New Poll
          </Text>
        </Pressable>
      )}

      {/* Create Poll Modal */}
      <CreatePollModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onCreate={async (input) => {
          const res = await createPoll(input);
          return { success: Boolean(res.poll), error: res.error };
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing.md,
    paddingBottom: tokens.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.border.subtle,
  },
  backButton: {
    paddingVertical: 6,
    paddingRight: 12,
  },
  backButtonText: {
    color: tokens.colors.primary.default,
    fontSize: 14,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  title: {
    color: tokens.colors.text.primary,
    fontSize: 17,
  },
  subtitle: {
    color: tokens.colors.text.secondary,
    fontSize: 11,
  },
  lifespanBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: tokens.radius.full,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  lifespanBadgeExpired: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  lifespanText: {
    color: '#818CF8',
    fontSize: 11,
  },
  lifespanTextExpired: {
    color: '#EF4444',
  },
  expiredBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(239, 68, 68, 0.25)',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: 10,
  },
  expiredBannerText: {
    color: '#F87171',
    flex: 1,
    fontSize: 11,
    lineHeight: 16,
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    gap: 8,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: tokens.radius.sm,
    backgroundColor: tokens.colors.surface,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: tokens.colors.border.subtle,
  },
  tabButtonActive: {
    backgroundColor: tokens.colors.primary.default,
    borderColor: tokens.colors.primary.default,
  },
  tabText: {
    color: tokens.colors.text.secondary,
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  sortBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing.md,
    paddingBottom: tokens.spacing.xs,
  },
  sortLabel: {
    color: tokens.colors.text.secondary,
    fontSize: 10,
    letterSpacing: 0.5,
  },
  sortPills: {
    flexDirection: 'row',
    gap: 6,
  },
  sortPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: tokens.radius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  sortPillActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
  },
  sortPillText: {
    color: tokens.colors.text.secondary,
    fontSize: 10,
  },
  sortPillTextActive: {
    color: '#A5B4FC',
  },
  listContent: {
    padding: tokens.spacing.md,
  },
  fab: {
    position: 'absolute',
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: tokens.colors.primary.default,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: tokens.radius.full,
    elevation: 6,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  fabText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
});
