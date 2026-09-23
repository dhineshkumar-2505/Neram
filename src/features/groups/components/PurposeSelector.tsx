import React from 'react';
import { View, StyleSheet, Pressable, ScrollView } from 'react-native';
import * as Haptics from 'expo-haptics';
import { tokens } from '../../../design';
import Text from '../../../components/Text';
import { GroupPurpose, PURPOSE_METADATA, GroupPurposeMetadata } from '../types';

export interface PurposeSelectorProps {
  selectedPurpose: GroupPurpose;
  onSelectPurpose: (purpose: GroupPurpose) => void;
  disabled?: boolean;
}

/**
 * Purpose / Activity Archetype Selector for Temporary Groups.
 * Configures the group's hero orientation and module layout:
 * - Outing: Live Map & ETA
 * - Project: Task Board & Milestones
 * - Hackathon: Deadline Countdown & Tasks
 * - Trip: Travel Itinerary & Daily Schedule
 * - Birthday: Party Timeline
 * - Study: Focus Milestones & Resources
 * - Sports: Roster & Venue Coordination
 * - Event: Schedule & Moments
 * - Custom: Tailored Flexible Space
 */
export const PurposeSelector: React.FC<PurposeSelectorProps> = ({
  selectedPurpose,
  onSelectPurpose,
  disabled = false,
}) => {
  const handleSelect = (purposeMeta: GroupPurposeMetadata) => {
    if (disabled || purposeMeta.id === selectedPurpose) return;

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    } catch {
      // Graceful fallback
    }

    onSelectPurpose(purposeMeta.id);
  };

  return (
    <View style={styles.container}>
      <Text variant="caption" weight="semibold" style={styles.sectionTitle}>
        PURPOSE & LAYOUT ARCHETYPE
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollList}
      >
        {PURPOSE_METADATA.map((item) => {
          const isSelected = item.id === selectedPurpose;

          return (
            <Pressable
              key={item.id}
              onPress={() => handleSelect(item)}
              disabled={disabled}
              accessibilityRole="radio"
              accessibilityLabel={`${item.label} Archetype: ${item.tagline}`}
              accessibilityState={{ selected: isSelected }}
              style={[
                styles.card,
                isSelected && {
                  borderColor: item.accentColor,
                  backgroundColor: 'rgba(30, 41, 59, 0.7)',
                },
                disabled && styles.cardDisabled,
              ]}
            >
              {/* Badge & Dot */}
              <View style={styles.cardHeader}>
                <View
                  style={[
                    styles.accentDot,
                    { backgroundColor: item.accentColor },
                    isSelected && styles.accentDotActive,
                  ]}
                />
                <View
                  style={[
                    styles.badgeContainer,
                    isSelected && { backgroundColor: `${item.accentColor}20` },
                  ]}
                >
                  <Text
                    style={[
                      styles.badgeText,
                      isSelected && { color: item.accentColor },
                    ]}
                  >
                    {item.badge}
                  </Text>
                </View>
              </View>

              {/* Title & Tagline */}
              <Text
                variant="callout"
                weight={isSelected ? 'bold' : 'semibold'}
                style={[styles.cardTitle, isSelected && styles.cardTitleActive]}
              >
                {item.label}
              </Text>
              <Text
                variant="caption"
                style={styles.cardTagline}
                numberOfLines={2}
              >
                {item.tagline}
              </Text>

              {/* Primary Tool Indicator */}
              <View style={styles.toolFooter}>
                <Text variant="caption" style={styles.toolLabel}>
                  Dominant tool:{' '}
                </Text>
                <Text
                  variant="caption"
                  weight="medium"
                  style={[styles.toolValue, isSelected && { color: item.accentColor }]}
                >
                  {item.primaryTool}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
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
  scrollList: {
    paddingHorizontal: tokens.spacing.xs,
    paddingVertical: tokens.spacing.xxs,
    gap: tokens.spacing.sm,
  },
  card: {
    width: 200,
    backgroundColor: '#111827',
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: tokens.spacing.md,
    justifyContent: 'space-between',
  },
  cardDisabled: {
    opacity: 0.5,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: tokens.spacing.xs,
  },
  accentDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    opacity: 0.7,
  },
  accentDotActive: {
    opacity: 1,
  },
  badgeContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: tokens.spacing.xs,
    paddingVertical: 2,
    borderRadius: tokens.radius.full,
  },
  badgeText: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '600',
  },
  cardTitle: {
    color: '#E2E8F0',
    marginBottom: 2,
  },
  cardTitleActive: {
    color: '#F8FAFC',
  },
  cardTagline: {
    color: '#64748B',
    lineHeight: 16,
    marginBottom: tokens.spacing.sm,
  },
  toolFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    paddingTop: tokens.spacing.xs,
  },
  toolLabel: {
    fontSize: 10,
    color: '#64748B',
  },
  toolValue: {
    fontSize: 10,
    color: '#94A3B8',
  },
});

export default PurposeSelector;
