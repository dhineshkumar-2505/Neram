import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { SkeletonBox, SkeletonCircle } from './Skeleton';
import { tokens } from '../../design';

export interface SkeletonActivityProps {
  count?: number;
}

export const SkeletonActivity: React.FC<SkeletonActivityProps> = ({ count = 5 }) => {
  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.container}
      testID="skeleton-activity"
    >
      {Array.from({ length: count }).map((_, idx) => (
        <View key={idx} style={styles.activityCard} testID="skeleton-activity-item">
          <SkeletonCircle size={40} style={styles.iconCircle} />
          <View style={styles.activityContent}>
            <View style={styles.topRow}>
              <SkeletonBox width={120} height={16} borderRadius={tokens.radius.xs} />
              <SkeletonBox width={50} height={12} borderRadius={tokens.radius.xs} />
            </View>
            <SkeletonBox width="90%" height={14} borderRadius={tokens.radius.xs} style={styles.bodyText} />
            <SkeletonBox width="60%" height={14} borderRadius={tokens.radius.xs} style={styles.bodySecondLine} />
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
  activityCard: {
    backgroundColor: '#111827',
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.border.subtle,
    padding: tokens.spacing.md,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconCircle: {
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  bodyText: {
    marginTop: 4,
  },
  bodySecondLine: {
    marginTop: 4,
  },
});

export default SkeletonActivity;
