import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { SkeletonBox, SkeletonCircle, SkeletonText } from './Skeleton';
import { tokens } from '../../design';

export const SkeletonGroupFeed: React.FC = () => {
  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.container}
      testID="skeleton-group-feed"
    >
      {[1, 2, 3, 4].map((key) => (
        <View key={key} style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.headerInfo}>
              <SkeletonBox width={160} height={20} borderRadius={tokens.radius.xs} />
              <SkeletonBox
                width={90}
                height={12}
                borderRadius={tokens.radius.xs}
                style={styles.subtitle}
              />
            </View>
            <SkeletonBox width={72} height={24} borderRadius={tokens.radius.full} />
          </View>

          <SkeletonText lines={2} lineHeight={14} spacing={6} style={styles.description} />

          <View style={styles.cardFooter}>
            <View style={styles.avatarsRow}>
              <SkeletonCircle size={28} />
              <SkeletonCircle size={28} style={styles.avatarOverlap} />
              <SkeletonCircle size={28} style={styles.avatarOverlap} />
            </View>
            <SkeletonBox width={100} height={16} borderRadius={tokens.radius.xs} />
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
  card: {
    backgroundColor: '#111827',
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.border.subtle,
    padding: tokens.spacing.md,
    marginBottom: tokens.spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  headerInfo: {
    flex: 1,
    marginRight: 12,
  },
  subtitle: {
    marginTop: 6,
  },
  description: {
    marginBottom: 16,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.04)',
    paddingTop: 12,
  },
  avatarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarOverlap: {
    marginLeft: -8,
  },
});

export default SkeletonGroupFeed;
