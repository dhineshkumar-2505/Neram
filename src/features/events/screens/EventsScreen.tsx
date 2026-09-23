import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  FlatList,
  RefreshControl,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '../../../design';
import Text from '../../../components/Text';
import LoadingState from '../../../components/LoadingState';
import EmptyState from '../../../components/EmptyState';
import ErrorState from '../../../components/ErrorState';
import { useAuth } from '../../../hooks/useAuth';
import { groupService } from '../../groups/services/groupService';
import { useGroupLifecycle } from '../../groups/hooks/useGroupLifecycle';
import type { GroupDetailedRecord } from '../../groups/types';
import type { RootStackScreenProps } from '../../../navigation/types';
import type { EventRecord, EventFilterTab } from '../types';
import { useEvents } from '../hooks/useEvents';
import { UpcomingMilestoneHero } from '../components/UpcomingMilestoneHero';
import { EventCard } from '../components/EventCard';
import { CreateEventModal } from '../components/CreateEventModal';
import { EditEventModal } from '../components/EditEventModal';
import {
  CalendarIcon,
  PlusIcon,
  AlertCircleIcon,
} from '../components/EventIcons';
import { calendarExportService } from '../services/calendarExportService';

export const EventsScreen: React.FC<RootStackScreenProps<'Events'>> = ({
  route,
  navigation,
}) => {
  const insets = useSafeAreaInsets();
  const { groupId, groupName: initialGroupName } = route.params;
  const { user } = useAuth();
  const currentUserId = user?.id;

  const [group, setGroup] = useState<GroupDetailedRecord | null>(null);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventRecord | null>(null);

  useEffect(() => {
    let isCurrent = true;
    if (groupId) {
      groupService.fetchGroupDetails(groupId).then((res) => {
        if (isCurrent && res.group) {
          setGroup(res.group);
        }
      });
    }
    return () => {
      isCurrent = false;
    };
  }, [groupId]);

  const { remainingTime, isExpired } = useGroupLifecycle(
    group?.starts_at,
    group?.expires_at,
    group?.lifecycle_state || 'ACTIVE',
    groupId,
  );

  const {
    filteredEvents,
    heroEvent,
    activeFilter,
    setActiveFilter,
    isLoading,
    isRefreshing,
    error,
    counts,
    refresh,
    createEvent,
    updateEvent,
    deleteEvent,
  } = useEvents(groupId, currentUserId);

  const spaceName = group?.name || initialGroupName || 'Space';
  const remainingTimeText = isExpired
    ? 'EXPIRED'
    : typeof remainingTime === 'string'
    ? remainingTime
    : remainingTime?.formattedText || '--';

  const handleExportCalendar = async (event: EventRecord) => {
    const res = await calendarExportService.exportToDeviceCalendar(event);
    if (!res.success && res.error) {
      Alert.alert('Calendar Export', res.error, [{ text: 'OK' }]);
    }
  };

  const handleDeleteEvent = async (event: EventRecord) => {
    if (isExpired) {
      Alert.alert('Space Expired', 'Modifications are disabled for dissolved spaces.', [
        { text: 'Understood' },
      ]);
      return;
    }
    const res = await deleteEvent(event.id);
    if (!res.success && res.error) {
      Alert.alert('Delete Failed', res.error, [{ text: 'OK' }]);
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: Math.max(insets.top, 16) }]}>
      {/* Space Header */}
      <View style={styles.header}>
        <Pressable
          testID="events-back-button"
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
            Shared Itinerary
          </Text>
          <Text variant="caption" style={styles.subtitle} numberOfLines={1}>
            {spaceName}
          </Text>
        </View>

        {/* Space Lifespan Badge */}
        <View style={[styles.lifespanBadge, isExpired && styles.lifespanBadgeExpired]}>
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
          <AlertCircleIcon size={16} color="#EF4444" />
          <Text variant="caption" weight="semibold" style={styles.expiredBannerText}>
            SPACE DISSOLVED — Itinerary is archived in permanent read-only mode.
          </Text>
        </View>
      )}

      {/* Segment Tabs */}
      <View style={styles.tabsContainer}>
        {(
          [
            { tab: 'ALL' as EventFilterTab, label: 'All', count: counts.all },
            { tab: 'UPCOMING' as EventFilterTab, label: 'Upcoming', count: counts.upcoming },
            { tab: 'MILESTONES' as EventFilterTab, label: 'Milestones', count: counts.milestones },
            { tab: 'PAST' as EventFilterTab, label: 'Past', count: counts.past },
          ]
        ).map(({ tab, label, count }) => {
          const isActive = activeFilter === tab;
          return (
            <Pressable
              key={tab}
              testID={`tab-${tab.toLowerCase()}`}
              style={[styles.tabButton, isActive && styles.tabButtonActive]}
              onPress={() => setActiveFilter(tab)}
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

      {/* Main Content */}
      {isLoading ? (
        <LoadingState message="Synchronizing itinerary events..." />
      ) : error && filteredEvents.length === 0 ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : (
        <FlatList
          data={filteredEvents}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <EventCard
              event={item}
              currentUserId={currentUserId}
              isExpired={isExpired}
              onEdit={(evt) => setEditingEvent(evt)}
              onDelete={handleDeleteEvent}
              onExportCalendar={handleExportCalendar}
            />
          )}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 80 },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={refresh}
              tintColor={tokens.colors.primary.default}
            />
          }
          ListHeaderComponent={
            activeFilter === 'ALL' || activeFilter === 'UPCOMING' ? (
              <UpcomingMilestoneHero
                event={heroEvent}
                onPress={(evt) => {
                  if (!isExpired) setEditingEvent(evt);
                }}
              />
            ) : null
          }
          ListEmptyComponent={
            <EmptyState
              icon={<CalendarIcon size={48} color="#EC4899" />}
              title="No Itinerary Events"
              description={
                activeFilter === 'ALL'
                  ? 'No events or rendezvous points have been scheduled yet. Add your first milestone.'
                  : activeFilter === 'UPCOMING'
                  ? 'No upcoming events scheduled. The space itinerary is currently clear.'
                  : activeFilter === 'MILESTONES'
                  ? 'No key milestones designated for this space.'
                  : 'No past events recorded in the archive.'
              }
              actionLabel={!isExpired && activeFilter !== 'PAST' ? 'Schedule Event' : undefined}
              onAction={() => setCreateModalVisible(true)}
            />
          }
        />
      )}

      {/* Floating Action Button (FAB) */}
      {!isExpired && (
        <Pressable
          testID="create-event-fab"
          style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
          onPress={() => setCreateModalVisible(true)}
          accessibilityLabel="Schedule Event"
        >
          <PlusIcon size={22} color="#FFFFFF" />
          <Text variant="callout" weight="bold" style={styles.fabText}>
            Event
          </Text>
        </Pressable>
      )}

      {/* Create Event Modal */}
      <CreateEventModal
        visible={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
        onCreate={createEvent}
      />

      {/* Edit Event Modal */}
      <EditEventModal
        visible={Boolean(editingEvent)}
        event={editingEvent}
        onClose={() => setEditingEvent(null)}
        onUpdate={updateEvent}
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
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  backButton: {
    paddingVertical: 6,
    paddingRight: 12,
  },
  backButtonText: {
    color: tokens.colors.primary.default,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 8,
  },
  title: {
    color: tokens.colors.text.primary,
  },
  subtitle: {
    color: tokens.colors.text.tertiary,
    marginTop: 1,
  },
  lifespanBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: tokens.radius.full,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
  },
  lifespanBadgeExpired: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  lifespanText: {
    color: '#38BDF8',
    fontSize: 11,
  },
  lifespanTextExpired: {
    color: '#EF4444',
  },
  expiredBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(239, 68, 68, 0.2)',
  },
  expiredBannerText: {
    color: '#EF4444',
    flex: 1,
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    gap: 6,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: tokens.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#12141A',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  tabButtonActive: {
    backgroundColor: 'rgba(236, 72, 153, 0.15)',
    borderColor: 'rgba(236, 72, 153, 0.5)',
  },
  tabText: {
    color: tokens.colors.text.tertiary,
    fontSize: 11,
  },
  tabTextActive: {
    color: '#EC4899',
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: tokens.spacing.md,
    paddingTop: tokens.spacing.xs,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 28,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.primary.default,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: tokens.radius.full,
    gap: 8,
    shadowColor: '#EC4899',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  fabPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.96 }],
  },
  fabText: {
    color: '#FFFFFF',
  },
});

export default EventsScreen;
