import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { SkeletonBox } from './Skeleton';
import { tokens } from '../../design';

export interface SkeletonPollProps {
  count?: number;
}

export const SkeletonPoll: React.FC<SkeletonPollProps> = ({ count = 2 }) => {
  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.container}
      testID="skeleton-poll"
    >
      {Array.from({ length: count }).map((_, key) => (
        <View key={key} style={styles.pollCard}>
          <View style={styles.pollHeader}>
            <SkeletonBox width={75} height={20} borderRadius={tokens.radius.full} />
            <SkeletonBox width={100} height={14} borderRadius={tokens.radius.xs} />
          </View>

          <SkeletonBox width="85%" height={22} borderRadius={tokens.radius.xs} style={styles.question} />
          <SkeletonBox width="60%" height={14} borderRadius={tokens.radius.xs} style={styles.creator} />

          <View style={styles.optionsList}>
            {[1, 2, 3].map((optKey) => (
              <View key={optKey} style={styles.optionBox}>
                <View style={styles.optionRow}>
                  <SkeletonBox width={120} height={16} borderRadius={tokens.radius.xs} />
                  <SkeletonBox width={45} height={16} borderRadius={tokens.radius.xs} />
                </View>
                <SkeletonBox width="100%" height={8} borderRadius={tokens.radius.full} style={styles.bar} />
              </View>
            ))}
          </View>

          <View style={styles.footer}>
            <SkeletonBox width={130} height={14} borderRadius={tokens.radius.xs} />
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
  pollCard: {
    backgroundColor: '#111827',
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.border.subtle,
    padding: tokens.spacing.md,
    marginBottom: tokens.spacing.md,
  },
  pollHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  question: {
    marginBottom: 8,
  },
  creator: {
    marginBottom: 16,
  },
  optionsList: {
    gap: 10,
    marginBottom: 14,
  },
  optionBox: {
    backgroundColor: '#0F172A',
    borderRadius: tokens.radius.sm,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  bar: {
    marginTop: 2,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.04)',
    paddingTop: 10,
  },
});

export default SkeletonPoll;
