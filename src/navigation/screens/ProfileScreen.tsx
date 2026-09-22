import React from 'react';
import { StyleSheet } from 'react-native';
import { Screen, Text, Card } from '../../components';
import { tokens } from '../../design';
import type { MainTabScreenProps } from '../types';

export const ProfileScreen: React.FC<MainTabScreenProps<'ProfileTab'>> = () => {
  return (
    <Screen contentContainerStyle={styles.container}>
      <Text variant="title1" weight="bold" style={styles.title}>
        Profile
      </Text>
      <Card variant="outlined">
        <Text variant="title3" weight="semibold" style={styles.cardTitle}>
          Social Identity
        </Text>
        <Text variant="body" color="secondary">
          Profile management, exact username configuration, and security settings will be activated in Phase 2.
        </Text>
      </Card>
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
  cardTitle: {
    marginBottom: tokens.spacing.xs,
  },
});

export default ProfileScreen;
