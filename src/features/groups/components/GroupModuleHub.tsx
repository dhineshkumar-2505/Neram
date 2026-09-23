import React from 'react';
import { View, StyleSheet, Pressable, Alert } from 'react-native';
import { tokens } from '../../../design';
import Text from '../../../components/Text';

export interface GroupModuleItem {
  key: string;
  name: string;
  description: string;
  accentColor: string;
}

export const ALL_GROUP_MODULES: GroupModuleItem[] = [
  {
    key: 'CHAT',
    name: 'Ephemeral Chat',
    description: 'Instant messages, media & threaded replies',
    accentColor: '#818CF8',
  },
  {
    key: 'TASKS',
    name: 'Task Board',
    description: 'Milestones, assignments & sprint checklist',
    accentColor: '#F59E0B',
  },
  {
    key: 'LOCATION',
    name: 'Live Map & ETA',
    description: 'Real-time rendezvous routing & arrival status',
    accentColor: '#38BDF8',
  },
  {
    key: 'EVENTS',
    name: 'Itinerary & Events',
    description: 'Timeline milestones & venue coordination',
    accentColor: '#EC4899',
  },
  {
    key: 'POLLS',
    name: 'Instant Polls',
    description: 'Rapid group decisions & quorum votes',
    accentColor: '#6366F1',
  },
  {
    key: 'FILES',
    name: 'Media Vault',
    description: 'Private documents, tickets & shared files',
    accentColor: '#10B981',
  },
];

export interface GroupModuleHubProps {
  enabledFeatures: Array<{ feature_key: string; enabled_at: string }>;
  isExpired?: boolean;
  onModulePress?: (moduleKey: string) => void;
}

/**
 * Dynamic Collaborative Modules Hub.
 * Activates purpose-specific tools enabled for the space.
 */
export const GroupModuleHub: React.FC<GroupModuleHubProps> = ({
  enabledFeatures,
  isExpired = false,
  onModulePress,
}) => {
  const enabledKeys = new Set(
    enabledFeatures.map((f) => f.feature_key.toUpperCase()),
  );

  const handlePress = (item: GroupModuleItem) => {
    if (onModulePress) {
      onModulePress(item.key);
      return;
    }

    Alert.alert(
      item.name,
      isExpired
        ? 'This temporary space is expired. All records are archived and read-only.'
        : `${item.description}\n\nActivating full realtime synchronization in subsequent milestone phases.`,
      [{ text: 'Understood' }],
    );
  };

  return (
    <View style={styles.container}>
      <Text variant="caption" weight="semibold" style={styles.sectionTitle}>
        COLLABORATIVE MODULES
      </Text>

      <View style={styles.grid}>
        {ALL_GROUP_MODULES.map((item) => {
          const isEnabled = enabledKeys.size === 0 || enabledKeys.has(item.key);

          if (!isEnabled) return null;

          return (
            <Pressable
              key={item.key}
              onPress={() => handlePress(item)}
              accessibilityRole="button"
              accessibilityLabel={`${item.name}: ${item.description}`}
              style={({ pressed }) => [
                styles.tile,
                pressed && styles.tilePressed,
              ]}
            >
              <View style={styles.tileHeader}>
                <View
                  style={[styles.statusDot, { backgroundColor: item.accentColor }]}
                />
                <Text variant="caption" style={styles.statusTag}>
                  {isExpired ? 'ARCHIVE' : 'ACTIVE'}
                </Text>
              </View>

              <Text variant="callout" weight="semibold" style={styles.tileTitle}>
                {item.name}
              </Text>
              <Text variant="caption" style={styles.tileDescription} numberOfLines={2}>
                {item.description}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginBottom: tokens.spacing.md,
  },
  sectionTitle: {
    color: '#64748B',
    letterSpacing: 0.8,
    marginBottom: tokens.spacing.xs,
    paddingHorizontal: tokens.spacing.xs,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing.sm,
  },
  tile: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: '#111827',
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    padding: tokens.spacing.md,
    minHeight: 110,
    justifyContent: 'space-between',
  },
  tilePressed: {
    backgroundColor: '#1E293B',
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  tileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: tokens.spacing.xs,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusTag: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  tileTitle: {
    color: '#F8FAFC',
    marginBottom: 2,
  },
  tileDescription: {
    color: '#64748B',
    lineHeight: 16,
  },
});

export default GroupModuleHub;
