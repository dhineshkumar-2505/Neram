import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Screen, Text, Card, Button } from '../../components';
import { tokens } from '../../design';
import type { MainTabScreenProps } from '../types';

export const HomeScreen: React.FC<MainTabScreenProps<'HomeTab'>> = ({ navigation }) => {
  return (
    <Screen scrollable={true} contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text variant="display" weight="bold">
          Neram
        </Text>
        <Text variant="callout" color="secondary">
          Purpose-driven temporary spaces
        </Text>
      </View>

      <Card variant="outlined" style={styles.card}>
        <Text variant="title3" weight="semibold" style={styles.cardTitle}>
          Technical Foundation Active
        </Text>
        <Text variant="body" color="secondary" style={styles.cardBody}>
          The application architecture, design tokens, and navigation foundation are ready.
        </Text>
        <Button
          title="Inspect Group Navigation"
          variant="primary"
          size="md"
          onPress={() =>
            navigation.navigate('GroupDetail', {
              groupId: 'sample-group-foundation-id',
              groupName: 'Sample Group Space',
            })
          }
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

export default HomeScreen;
