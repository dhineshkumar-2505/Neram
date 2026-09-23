import React from 'react';
import { View, StyleSheet, Pressable, Alert } from 'react-native';
import { tokens } from '../../../design';
import Text from '../../../components/Text';
import {
  MilestoneFlagIcon,
  MapPinIcon,
  RouteNavigationIcon,
  ShareCalendarIcon,
  EditIcon,
  TrashIcon,
} from './EventIcons';
import type { EventRecord } from '../types';
import { useEventCountdown } from '../hooks/useEventCountdown';

export interface EventCardProps {
  event: EventRecord;
  currentUserId?: string;
  isExpired?: boolean;
  onEdit?: (event: EventRecord) => void;
  onDelete?: (event: EventRecord) => void;
  onExportCalendar?: (event: EventRecord) => void;
}

function formatEventDateTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

export const EventCard: React.FC<EventCardProps> = ({
  event,
  currentUserId,
  isExpired = false,
  onEdit,
  onDelete,
  onExportCalendar,
}) => {
  const countdown = useEventCountdown(event.targetTime);
  const isPast = countdown.isPast;
  const isMilestone = event.isMilestone;
  const isCreator = Boolean(currentUserId && event.creatorId === currentUserId);

  const hasCoordinates =
    event.latitude !== null &&
    event.longitude !== null &&
    event.latitude !== undefined &&
    event.longitude !== undefined;

  const handleEditPress = () => {
    if (isExpired) {
      Alert.alert(
        'Space Expired',
        'This space has dissolved. Events have been frozen in read-only archive mode.',
        [{ text: 'Understood' }],
      );
      return;
    }
    if (onEdit) {
      onEdit(event);
    }
  };

  const handleDeletePress = () => {
    if (isExpired) {
      Alert.alert(
        'Space Expired',
        'This space has dissolved. Events have been frozen in read-only archive mode.',
        [{ text: 'Understood' }],
      );
      return;
    }
    Alert.alert(
      'Delete Event',
      `Are you sure you want to remove "${event.title}" from the itinerary?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => onDelete && onDelete(event),
        },
      ],
    );
  };

  return (
    <View style={[styles.card, isPast && styles.cardPast]}>
      {/* Top Header Row */}
      <View style={styles.headerRow}>
        <View style={styles.badgesRow}>
          {isMilestone && (
            <View style={styles.milestoneBadge}>
              <MilestoneFlagIcon size={12} color="#EC4899" />
              <Text variant="caption" style={styles.milestoneBadgeText}>
                MILESTONE
              </Text>
            </View>
          )}

          <View style={[styles.timeBadge, isPast ? styles.timeBadgePast : styles.timeBadgeUpcoming]}>
            <Text
              variant="caption"
              style={[styles.timeBadgeText, isPast ? styles.timeBadgeTextPast : styles.timeBadgeTextUpcoming]}
            >
              {isPast ? 'COMPLETED' : countdown.shortText}
            </Text>
          </View>
        </View>

        {/* Date Time */}
        <Text variant="caption" style={styles.dateText}>
          {formatEventDateTime(event.targetTime)}
        </Text>
      </View>

      {/* Title */}
      <Text variant="title3" style={[styles.title, isPast && styles.titlePast]}>
        {event.title}
      </Text>

      {/* Description */}
      {Boolean(event.description) && (
        <Text variant="body" style={styles.description} numberOfLines={3}>
          {event.description}
        </Text>
      )}

      {/* Location / Rendezvous Details */}
      {(event.locationName || hasCoordinates) && (
        <View style={styles.metaRow}>
          {event.locationName && (
            <View style={styles.locationChip}>
              <MapPinIcon size={13} color="#38BDF8" />
              <Text variant="caption" style={styles.locationText} numberOfLines={1}>
                {event.locationName}
              </Text>
            </View>
          )}

          {hasCoordinates && (
            <View style={styles.rendezvousChip}>
              <RouteNavigationIcon size={12} color="#10B981" />
              <Text variant="caption" style={styles.rendezvousText}>
                Rendezvous Pinned
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Action Footer */}
      <View style={styles.footerRow}>
        {/* Creator Info */}
        <Text variant="caption" style={styles.creatorText}>
          {event.creator ? `By @${event.creator.username}` : 'By group member'}
        </Text>

        {/* Action Buttons */}
        <View style={styles.actionsRow}>
          {onExportCalendar && (
            <Pressable
              style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}
              onPress={() => onExportCalendar(event)}
              accessibilityLabel="Export to Calendar"
            >
              <ShareCalendarIcon size={16} color="#818CF8" />
            </Pressable>
          )}

          {!isExpired && (isCreator || onEdit) && (
            <Pressable
              style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}
              onPress={handleEditPress}
              accessibilityLabel="Edit Event"
            >
              <EditIcon size={16} color="#94A3B8" />
            </Pressable>
          )}

          {!isExpired && (isCreator || onDelete) && (
            <Pressable
              style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}
              onPress={handleDeletePress}
              accessibilityLabel="Delete Event"
            >
              <TrashIcon size={16} color="#EF4444" />
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#13151A',
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.border.subtle,
    padding: tokens.spacing.md,
    marginBottom: tokens.spacing.sm,
  },
  cardPast: {
    backgroundColor: '#0E1014',
    borderColor: 'rgba(255, 255, 255, 0.04)',
    opacity: 0.85,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: tokens.spacing.xs,
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  milestoneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(236, 72, 153, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(236, 72, 153, 0.3)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: tokens.radius.full,
    gap: 4,
  },
  milestoneBadgeText: {
    color: '#EC4899',
    fontWeight: '700',
    fontSize: 9,
    letterSpacing: 0.5,
  },
  timeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: tokens.radius.full,
  },
  timeBadgeUpcoming: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
  },
  timeBadgePast: {
    backgroundColor: 'rgba(148, 163, 184, 0.1)',
  },
  timeBadgeText: {
    fontWeight: '700',
    fontSize: 10,
  },
  timeBadgeTextUpcoming: {
    color: '#F59E0B',
  },
  timeBadgeTextPast: {
    color: tokens.colors.text.tertiary,
  },
  dateText: {
    color: tokens.colors.text.secondary,
    fontWeight: '500',
  },
  title: {
    color: tokens.colors.text.primary,
    fontWeight: '600',
    marginTop: 4,
    marginBottom: 4,
  },
  titlePast: {
    color: tokens.colors.text.secondary,
  },
  description: {
    color: tokens.colors.text.secondary,
    lineHeight: 18,
    marginBottom: tokens.spacing.xs,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginTop: tokens.spacing.xs,
    marginBottom: tokens.spacing.xs,
  },
  locationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: tokens.radius.sm,
    gap: 4,
  },
  locationText: {
    color: '#38BDF8',
    fontWeight: '500',
    maxWidth: 160,
  },
  rendezvousChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: tokens.radius.sm,
    gap: 4,
  },
  rendezvousText: {
    color: '#10B981',
    fontWeight: '600',
    fontSize: 10,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: tokens.spacing.sm,
    paddingTop: tokens.spacing.xs,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.04)',
  },
  creatorText: {
    color: tokens.colors.text.tertiary,
    fontSize: 11,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconButton: {
    padding: 6,
    borderRadius: tokens.radius.sm,
    backgroundColor: '#1A1D24',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonPressed: {
    opacity: 0.7,
  },
});

export default EventCard;
