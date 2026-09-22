import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Screen, Text, Card, Button } from '../../components';
import { tokens } from '../../design';
import type { RootStackScreenProps } from '../types';

export const GroupDetailScreen: React.FC<RootStackScreenProps<'GroupDetail'>> = ({
  route,
  navigation,
}) => {
  const { groupId, groupName } = route.params;

  return (
    <Screen contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text variant="title1" weight="bold">
          {groupName || 'Temporary Space'}
        </Text>
        <Text variant="caption" color="secondary">
          ID: {groupId}
        </Text>
      </View>

      <Card variant="elevated" style={styles.card}>
        <Text variant="title3" weight="semibold" style={styles.cardTitle}>
          Group Shell Active
        </Text>
        <Text variant="body" color="secondary" style={styles.cardBody}>
          Dynamic purpose modules (Chat, Tasks, Files, Events, Polls, Location) will activate according to group configuration in Phases 4–7.
        </Text>
        <Button
          title="Return to Command Center"
          variant="outline"
          onPress={() => navigation.goBack()}
        />
      </Card>
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: tokens.spacing.md,
  },
  header: {
    marginBottom: tokens.spacing.lg,
  },
  card: {
    marginBottom: tokens.spacing.md,
  },
  cardTitle: {
    marginBottom: tokens.spacing.xs,
  },
  cardBody: {
    marginBottom: tokens.spacing.md,
  },
});

export default GroupDetailScreen;
