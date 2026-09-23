import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { SkeletonBox, SkeletonCircle, SkeletonText } from './Skeleton';
import { tokens } from '../../design';

export const SkeletonGroupDetail: React.FC = () => {
  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.container}
      testID="skeleton-group-detail"
    >
      {/* Hero Countdown Card Skeleton */}
      <View style={styles.heroCard}>
        <View style={styles.heroTopRow}>
          <SkeletonBox width={180} height={24} borderRadius={tokens.radius.xs} />
          <SkeletonBox width={80} height={22} borderRadius={tokens.radius.full} />
        </View>

        <SkeletonText lines={2} style={styles.heroDescription} />

        <View style={styles.heroCountdownBox}>
          <SkeletonBox width={140} height={36} borderRadius={tokens.radius.sm} />
          <SkeletonBox width={100} height={14} borderRadius={tokens.radius.xs} style={styles.timerSubtext} />
        </View>

        <View style={styles.heroMetaRow}>
          <SkeletonBox width={110} height={16} borderRadius={tokens.radius.xs} />
          <SkeletonBox width={90} height={16} borderRadius={tokens.radius.xs} />
        </View>
      </View>

      {/* Action Buttons Row */}
      <View style={styles.actionButtonsRow}>
        <SkeletonBox width="48%" height={44} borderRadius={tokens.radius.full} />
        <SkeletonBox width="48%" height={44} borderRadius={tokens.radius.full} />
      </View>

      {/* Modules Section Header */}
      <View style={styles.sectionHeader}>
        <SkeletonBox width={150} height={18} borderRadius={tokens.radius.xs} />
      </View>

      {/* Modules Grid Skeletons */}
      <View style={styles.modulesGrid}>
        {[1, 2, 3, 4, 5, 6].map((key) => (
          <View key={key} style={styles.moduleCard}>
            <SkeletonCircle size={36} style={styles.moduleIcon} />
            <SkeletonBox width={90} height={16} borderRadius={tokens.radius.xs} />
            <SkeletonBox width={65} height={12} borderRadius={tokens.radius.xs} style={styles.moduleCount} />
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
  heroCard: {
    backgroundColor: '#111827',
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.border.subtle,
    padding: tokens.spacing.md,
    marginBottom: tokens.spacing.md,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  heroDescription: {
    marginBottom: 16,
  },
  heroCountdownBox: {
    backgroundColor: '#0F172A',
    borderRadius: tokens.radius.sm,
    padding: tokens.spacing.md,
    alignItems: 'center',
    marginBottom: 16,
  },
  timerSubtext: {
    marginTop: 8,
  },
  heroMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: tokens.spacing.lg,
  },
  sectionHeader: {
    marginBottom: tokens.spacing.sm,
  },
  modulesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  moduleCard: {
    width: '48%',
    backgroundColor: '#111827',
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.border.subtle,
    padding: tokens.spacing.md,
    alignItems: 'flex-start',
  },
  moduleIcon: {
    marginBottom: 10,
  },
  moduleCount: {
    marginTop: 6,
  },
});

export default SkeletonGroupDetail;
