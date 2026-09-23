import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { SkeletonBox } from './Skeleton';
import { tokens } from '../../design';

export interface SkeletonFileProps {
  count?: number;
}

export const SkeletonFile: React.FC<SkeletonFileProps> = ({ count = 6 }) => {
  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.container}
      testID="skeleton-file"
    >
      {/* Upload Action Button Skeleton */}
      <SkeletonBox width="100%" height={48} borderRadius={tokens.radius.full} style={styles.uploadBtn} />

      {/* Files Grid */}
      <View style={styles.grid}>
        {Array.from({ length: count }).map((_, key) => (
          <View key={key} style={styles.fileCard}>
            <SkeletonBox width="100%" height={100} borderRadius={tokens.radius.sm} />
            <SkeletonBox width="85%" height={14} borderRadius={tokens.radius.xs} style={styles.fileName} />
            <SkeletonBox width="50%" height={12} borderRadius={tokens.radius.xs} style={styles.fileMeta} />
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
  uploadBtn: {
    marginBottom: tokens.spacing.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  fileCard: {
    width: '48%',
    backgroundColor: '#111827',
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.border.subtle,
    padding: 10,
  },
  fileName: {
    marginTop: 8,
  },
  fileMeta: {
    marginTop: 4,
  },
});

export default SkeletonFile;
