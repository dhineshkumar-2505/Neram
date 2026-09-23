import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { SkeletonBox, SkeletonCircle } from './Skeleton';
import { tokens } from '../../design';

export const SkeletonOuting: React.FC = () => {
  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.container}
      testID="skeleton-outing"
    >
      {/* Outing Overview Card Skeleton */}
      <View style={styles.sessionCard}>
        <View style={styles.sessionHeader}>
          <SkeletonCircle size={40} />
          <View style={styles.sessionHeaderInfo}>
            <SkeletonBox width={160} height={18} borderRadius={tokens.radius.xs} />
            <SkeletonBox width={120} height={12} borderRadius={tokens.radius.xs} style={styles.subtitle} />
          </View>
          <SkeletonBox width={65} height={20} borderRadius={tokens.radius.full} />
        </View>
      </View>

      {/* Map Card Placeholder */}
      <View style={styles.mapCard}>
        <SkeletonBox width="100%" height={260} borderRadius={tokens.radius.md} />
      </View>

      {/* Participation / Telemetry Card Skeleton */}
      <View style={styles.telemetryCard}>
        <View style={styles.telemetryHeader}>
          <SkeletonBox width={110} height={24} borderRadius={tokens.radius.full} />
          <SkeletonBox width={130} height={20} borderRadius={tokens.radius.full} />
        </View>
        <SkeletonBox width="70%" height={14} borderRadius={tokens.radius.xs} style={styles.telemetrySub} />
      </View>

      {/* Participating Roster Header */}
      <View style={styles.rosterHeader}>
        <SkeletonBox width={160} height={16} borderRadius={tokens.radius.xs} />
      </View>

      {/* Roster Rows */}
      <View style={styles.rosterList}>
        {[1, 2, 3].map((key) => (
          <View key={key} style={styles.rosterRow}>
            <SkeletonCircle size={36} />
            <View style={styles.rosterInfo}>
              <SkeletonBox width={110} height={16} borderRadius={tokens.radius.xs} />
              <SkeletonBox width={70} height={12} borderRadius={tokens.radius.xs} style={styles.rosterSub} />
            </View>
            <SkeletonBox width={75} height={22} borderRadius={tokens.radius.full} />
          </View>
        ))}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: tokens.spacing.md,
  },
  sessionCard: {
    backgroundColor: '#111827',
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.border.subtle,
    padding: tokens.spacing.md,
    marginBottom: 12,
  },
  sessionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sessionHeaderInfo: {
    flex: 1,
    marginLeft: 12,
  },
  subtitle: {
    marginTop: 6,
  },
  mapCard: {
    marginBottom: 12,
  },
  telemetryCard: {
    backgroundColor: '#111827',
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.border.subtle,
    padding: tokens.spacing.md,
    marginBottom: tokens.spacing.md,
  },
  telemetryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  telemetrySub: {
    marginTop: 10,
  },
  rosterHeader: {
    marginBottom: 10,
  },
  rosterList: {
    backgroundColor: '#111827',
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.border.subtle,
    overflow: 'hidden',
  },
  rosterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  rosterInfo: {
    flex: 1,
    marginLeft: 12,
  },
  rosterSub: {
    marginTop: 4,
  },
});

export default SkeletonOuting;
