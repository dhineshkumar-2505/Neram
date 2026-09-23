import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { tokens } from '../../../design';
import Text from '../../../components/Text';
import {
  MilestoneFlagIcon,
  ClockIcon,
  MapPinIcon,
  RouteNavigationIcon,
} from './EventIcons';
import { useEventCountdown } from '../hooks/useEventCountdown';
import type { EventRecord } from '../types';

export interface UpcomingMilestoneHeroProps {
  event: EventRecord | null;
  onPress?: (event: EventRecord) => void;
}

function formatHeroDate(dateStr: string): string {
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

export const UpcomingMilestoneHero: React.FC<UpcomingMilestoneHeroProps> = ({
  event,
  onPress,
}) => {
  const countdown = useEventCountdown(event?.targetTime);

  if (!event) {
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIconContainer}>
          <ClockIcon size={24} color={tokens.colors.text.tertiary} />
        </View>
        <View style={styles.emptyTextContainer}>
          <Text variant="callout" style={styles.emptyTitle}>
            No Upcoming Events
          </Text>
          <Text variant="caption" style={styles.emptySubtitle}>
            Itinerary is clear. Add a milestone or meeting point for the group.
          </Text>
        </View>
      </View>
    );
  }

  const isMilestone = event.isMilestone;
  const hasCoordinates =
    event.latitude !== null &&
    event.longitude !== null &&
    event.latitude !== undefined &&
    event.longitude !== undefined;

  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <Pressable
      style={({ pressed }) => [styles.container, pressed && styles.pressed]}
      onPress={() => onPress && onPress(event)}
    >
      {/* Header Tag & Date */}
      <View style={styles.headerRow}>
        <View
          style={[
            styles.badge,
            isMilestone ? styles.badgeMilestone : styles.badgeEvent,
          ]}
        >
          {isMilestone ? (
            <MilestoneFlagIcon size={12} color="#EC4899" />
          ) : (
            <ClockIcon size={12} color="#818CF8" />
          )}
          <Text
            variant="caption"
            style={[
              styles.badgeText,
              isMilestone ? styles.badgeTextMilestone : styles.badgeTextEvent,
            ]}
          >
            {isMilestone ? 'UPCOMING MILESTONE' : 'NEXT UP'}
          </Text>
        </View>

        <Text variant="caption" style={styles.targetDateText}>
          {formatHeroDate(event.targetTime)}
        </Text>
      </View>

      {/* Title */}
      <Text variant="title2" style={styles.title} numberOfLines={2}>
        {event.title}
      </Text>

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

      {/* Countdown Engine Display */}
      <View style={styles.countdownContainer}>
        {countdown.isTargetReached ? (
          <View style={styles.startedBanner}>
            <View style={styles.pulsingDot} />
            <Text variant="callout" style={styles.startedText}>
              In Progress / Target Reached
            </Text>
          </View>
        ) : (
          <View style={styles.timerRow}>
            {countdown.days > 0 && (
              <View style={styles.timerBlock}>
                <Text variant="title1" style={styles.timerValue}>
                  {countdown.days}
                </Text>
                <Text variant="caption" style={styles.timerLabel}>
                  DAYS
                </Text>
              </View>
            )}

            <View style={styles.timerBlock}>
              <Text variant="title1" style={styles.timerValue}>
                {pad(countdown.hours)}
              </Text>
              <Text variant="caption" style={styles.timerLabel}>
                HOURS
              </Text>
            </View>

            <Text variant="title1" style={styles.timerColon}>
              :
            </Text>

            <View style={styles.timerBlock}>
              <Text variant="title1" style={styles.timerValue}>
                {pad(countdown.minutes)}
              </Text>
              <Text variant="caption" style={styles.timerLabel}>
                MINS
              </Text>
            </View>

            <Text variant="title1" style={styles.timerColon}>
              :
            </Text>

            <View style={styles.timerBlock}>
              <Text variant="title1" style={styles.timerValueSec}>
                {pad(countdown.seconds)}
              </Text>
              <Text variant="caption" style={styles.timerLabelSec}>
                SECS
              </Text>
            </View>
          </View>
        )}
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#13151A',
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.colors.border.subtle,
    padding: tokens.spacing.md,
    marginBottom: tokens.spacing.md,
  },
  pressed: {
    opacity: 0.95,
    transform: [{ scale: 0.995 }],
  },
  emptyContainer: {
    backgroundColor: '#0F1115',
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.colors.border.subtle,
    padding: tokens.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: tokens.spacing.md,
  },
  emptyIconContainer: {
    width: 44,
    height: 44,
    borderRadius: tokens.radius.md,
    backgroundColor: '#171A21',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: tokens.spacing.md,
  },
  emptyTextContainer: {
    flex: 1,
  },
  emptyTitle: {
    color: tokens.colors.text.primary,
    fontWeight: '600',
  },
  emptySubtitle: {
    color: tokens.colors.text.tertiary,
    marginTop: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: tokens.spacing.sm,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: tokens.radius.full,
    gap: 4,
  },
  badgeMilestone: {
    backgroundColor: 'rgba(236, 72, 153, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(236, 72, 153, 0.3)',
  },
  badgeEvent: {
    backgroundColor: 'rgba(129, 140, 248, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(129, 140, 248, 0.3)',
  },
  badgeText: {
    fontWeight: '700',
    fontSize: 10,
    letterSpacing: 0.5,
  },
  badgeTextMilestone: {
    color: '#EC4899',
  },
  badgeTextEvent: {
    color: '#818CF8',
  },
  targetDateText: {
    color: tokens.colors.text.secondary,
    fontWeight: '500',
  },
  title: {
    color: tokens.colors.text.primary,
    fontWeight: '700',
    marginBottom: tokens.spacing.sm,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginBottom: tokens.spacing.md,
  },
  locationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 3,
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
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: tokens.radius.sm,
    gap: 4,
  },
  rendezvousText: {
    color: '#10B981',
    fontWeight: '600',
    fontSize: 11,
  },
  countdownContainer: {
    backgroundColor: '#0B0D11',
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    paddingVertical: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerBlock: {
    alignItems: 'center',
    minWidth: 44,
  },
  timerValue: {
    color: '#F8FAFC',
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  timerValueSec: {
    color: '#F59E0B',
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  timerColon: {
    color: tokens.colors.text.tertiary,
    fontWeight: '600',
    marginHorizontal: 4,
    marginBottom: 12,
  },
  timerLabel: {
    color: tokens.colors.text.tertiary,
    fontSize: 9,
    fontWeight: '700',
    marginTop: -2,
    letterSpacing: 0.5,
  },
  timerLabelSec: {
    color: '#F59E0B',
    fontSize: 9,
    fontWeight: '700',
    marginTop: -2,
    letterSpacing: 0.5,
  },
  startedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  pulsingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  startedText: {
    color: '#10B981',
    fontWeight: '600',
  },
});

export default UpcomingMilestoneHero;
