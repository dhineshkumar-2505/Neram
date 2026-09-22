import React from 'react';
import { StyleSheet } from 'react-native';
import { Screen, Text, EmptyState } from '../../components';
import { tokens } from '../../design';
import type { MainTabScreenProps } from '../types';

export const ActivityScreen: React.FC<MainTabScreenProps<'ActivityTab'>> = () => {
  return (
    <Screen contentContainerStyle={styles.container}>
      <Text variant="title1" weight="bold" style={styles.title}>
        Activity
      </Text>
      <EmptyState
        title="No Recent Activity"
        description="Notifications and event reminders for active temporary spaces will appear here in Phase 5."
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

export default ActivityScreen;
