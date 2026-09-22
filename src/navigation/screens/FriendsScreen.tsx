import React from 'react';
import { StyleSheet } from 'react-native';
import { Screen, Text, EmptyState } from '../../components';
import { tokens } from '../../design';
import type { MainTabScreenProps } from '../types';

export const FriendsScreen: React.FC<MainTabScreenProps<'FriendsTab'>> = () => {
  return (
    <Screen contentContainerStyle={styles.container}>
      <Text variant="title1" weight="bold" style={styles.title}>
        Friends
      </Text>
      <EmptyState
        title="No Friends Added"
        description="Friendships are required before inviting or joining temporary groups. Search exact usernames in Phase 3."
        actionLabel="Exact Search (Phase 3)"
        onAction={() => {}}
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: tokens.spacing.md,
  },
  title: {
    marginBottom: tokens.spacing.md,
  },
});

export default FriendsScreen;
