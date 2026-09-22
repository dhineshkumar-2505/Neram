import React from 'react';
import { StyleSheet } from 'react-native';
import { Screen, Text, Card } from '../../components';
import { tokens } from '../../design';
import type { MainTabScreenProps } from '../types';

export const CreateScreen: React.FC<MainTabScreenProps<'CreateTab'>> = () => {
  return (
    <Screen contentContainerStyle={styles.container}>
      <Text variant="title1" weight="bold" style={styles.title}>
        Create Space
      </Text>
      <Card variant="subtle">
        <Text variant="title3" weight="semibold" style={styles.cardTitle}>
          Temporary Group Creator
        </Text>
        <Text variant="body" color="secondary">
          Purpose selector and precision circular duration dial will be activated in Phase 4.
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

export default CreateScreen;
