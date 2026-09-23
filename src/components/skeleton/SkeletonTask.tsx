import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { SkeletonBox, SkeletonCircle } from './Skeleton';
import { tokens } from '../../design';

export interface SkeletonTaskProps {
  count?: number;
}

export const SkeletonTask: React.FC<SkeletonTaskProps> = ({ count = 4 }) => {
  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.container}
      testID="skeleton-task"
    >
      {/* Filter Tabs Skeleton */}
      <View style={styles.tabsRow}>
        <SkeletonBox width={90} height={32} borderRadius={tokens.radius.full} />
        <SkeletonBox width={85} height={32} borderRadius={tokens.radius.full} />
        <SkeletonBox width={85} height={32} borderRadius={tokens.radius.full} />
      </View>

      {/* Task Cards */}
      {Array.from({ length: count }).map((_, key) => (
        <View key={key} style={styles.taskCard}>
          <View style={styles.taskTopRow}>
            <SkeletonBox width={70} height={20} borderRadius={tokens.radius.full} />
            <SkeletonCircle size={18} />
          </View>

          <SkeletonBox width="80%" height={18} borderRadius={tokens.radius.xs} style={styles.taskTitle} />
          <SkeletonBox width="55%" height={14} borderRadius={tokens.radius.xs} style={styles.taskDesc} />

          <View style={styles.taskFooter}>
            <SkeletonBox width={100} height={16} borderRadius={tokens.radius.xs} />
            <SkeletonCircle size={26} />
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
  tabsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: tokens.spacing.md,
  },
  taskCard: {
    backgroundColor: '#111827',
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.border.subtle,
    padding: tokens.spacing.md,
    marginBottom: 12,
  },
  taskTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  taskTitle: {
    marginBottom: 6,
  },
  taskDesc: {
    marginBottom: 14,
  },
  taskFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.04)',
    paddingTop: 10,
  },
});

export default SkeletonTask;
