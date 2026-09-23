import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { SkeletonBox } from './Skeleton';
import { tokens } from '../../design';

export interface SkeletonEventProps {
  count?: number;
}

export const SkeletonEvent: React.FC<SkeletonEventProps> = ({ count = 3 }) => {
  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.container}
      testID="skeleton-event"
    >
      {/* Milestone Hero Countdown Skeleton */}
      <View style={styles.milestoneCard}>
        <View style={styles.milestoneTopRow}>
          <SkeletonBox width={85} height={20} borderRadius={tokens.radius.full} />
          <SkeletonBox width={100} height={14} borderRadius={tokens.radius.xs} />
        </View>

        <SkeletonBox width="80%" height={22} borderRadius={tokens.radius.xs} style={styles.milestoneTitle} />
        <SkeletonBox width="50%" height={14} borderRadius={tokens.radius.xs} style={styles.milestoneVenue} />

        <View style={styles.countdownBox}>
          <SkeletonBox width={160} height={32} borderRadius={tokens.radius.sm} />
        </View>
      </View>

      {/* Itinerary Events List */}
      {Array.from({ length: count }).map((_, key) => (
        <View key={key} style={styles.eventCard}>
          <View style={styles.eventRow}>
            <View style={styles.datePill}>
              <SkeletonBox width={40} height={18} borderRadius={tokens.radius.xs} />
              <SkeletonBox width={32} height={12} borderRadius={tokens.radius.xs} style={styles.dateMonth} />
            </View>

            <View style={styles.eventContent}>
              <SkeletonBox width={140} height={18} borderRadius={tokens.radius.xs} />
              <SkeletonBox width={100} height={14} borderRadius={tokens.radius.xs} style={styles.eventTime} />
              <SkeletonBox width={120} height={14} borderRadius={tokens.radius.xs} style={styles.eventLocation} />
            </View>

            <SkeletonBox width={60} height={28} borderRadius={tokens.radius.full} />
          </View>
        </View>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: tokens.spacing.md,
  },
  milestoneCard: {
    backgroundColor: '#111827',
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.border.subtle,
    padding: tokens.spacing.md,
    marginBottom: tokens.spacing.md,
  },
  milestoneTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  milestoneTitle: {
    marginBottom: 6,
  },
  milestoneVenue: {
    marginBottom: 14,
  },
  countdownBox: {
    backgroundColor: '#0F172A',
    borderRadius: tokens.radius.sm,
    padding: 12,
    alignItems: 'center',
  },
  eventCard: {
    backgroundColor: '#111827',
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.border.subtle,
    padding: 14,
    marginBottom: 12,
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  datePill: {
    backgroundColor: '#0F172A',
    borderRadius: tokens.radius.sm,
    padding: 8,
    alignItems: 'center',
    width: 54,
  },
  dateMonth: {
    marginTop: 4,
  },
  eventContent: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  eventTime: {
    marginTop: 6,
  },
  eventLocation: {
    marginTop: 4,
  },
});

export default SkeletonEvent;
