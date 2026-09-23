import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { tokens } from '../../../design';
import Text from '../../../components/Text';
import {
  GroupRecord,
  GroupRemainingTime,
  GroupLifecycleState,
  PURPOSE_METADATA,
} from '../types';

export interface GroupHeroCardProps {
  group: GroupRecord;
  remainingTime: GroupRemainingTime;
  lifecycleState: GroupLifecycleState;
}

/**
 * Purpose-Specific Hero Countdown Card.
 * Satisfies UI_PLAN.md Section 6:
 * - Dynamic archetype dominance & theme accent
 * - High-precision digital countdown ticker
 * - Linear progress indicator of total group lifespan
 * - Warning states when space is nearing dissolution
 */
export const GroupHeroCard: React.FC<GroupHeroCardProps> = ({
  group,
  remainingTime,
  lifecycleState,
}) => {
  const meta = useMemo(() => {
    return (
      PURPOSE_METADATA.find((p) => p.id === group.purpose) ||
      PURPOSE_METADATA[0]!
    );
  }, [group.purpose]);

  const formattedExpiry = useMemo(() => {
    try {
      const d = new Date(group.expires_at);
      return d.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      return group.expires_at;
    }
  }, [group.expires_at]);

  const progressPercent = Math.min(
    100,
    Math.max(0, Math.round(remainingTime.progressFraction * 100)),
  );

  const isExpired = remainingTime.isExpired || lifecycleState === 'EXPIRED';
  const isExpiring = remainingTime.isExpiring && !isExpired;

  // Status color logic
  const statusColor = isExpired
    ? '#EF4444'
    : isExpiring
    ? '#F59E0B'
    : meta.accentColor;

  return (
    <View
      style={[
        styles.container,
        isExpiring && styles.containerExpiring,
        isExpired && styles.containerExpired,
      ]}
    >
      {/* Archetype & Lifecycle Header */}
      <View style={styles.headerRow}>
        <View style={styles.archetypeBadge}>
          <View style={[styles.pulseDot, { backgroundColor: statusColor }]} />
          <Text
            variant="caption"
            weight="bold"
            style={[styles.archetypeText, { color: statusColor }]}
          >
            {meta.label.toUpperCase()} • {meta.badge.toUpperCase()}
          </Text>
        </View>

        <View
          style={[
            styles.stateChip,
            isExpired && styles.stateChipExpired,
            isExpiring && styles.stateChipExpiring,
          ]}
        >
          <Text
            style={[
              styles.stateChipText,
              isExpired && styles.stateChipTextExpired,
              isExpiring && styles.stateChipTextExpiring,
            ]}
          >
            {lifecycleState}
          </Text>
        </View>
      </View>

      {/* Main Countdown Display */}
      <View style={styles.countdownSection}>
        <Text variant="caption" style={styles.countdownLabel}>
          {isExpired ? 'SPACE STATUS' : 'CLOSES IN'}
        </Text>
        <Text
          variant="display"
          weight="bold"
          style={[
            styles.countdownValue,
            isExpired && styles.countdownValueExpired,
            isExpiring && styles.countdownValueExpiring,
          ]}
        >
          {remainingTime.formattedText}
        </Text>
      </View>

      {/* Lifespan Linear Progress Bar */}
      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            {
              width: `${progressPercent}%`,
              backgroundColor: statusColor,
            },
          ]}
        />
      </View>

      {/* Footer Info Row */}
      <View style={styles.footerRow}>
        <Text variant="caption" style={styles.footerSubText}>
          {isExpired
            ? 'Data dissolved according to privacy policy'
            : `Dissolves ${formattedExpiry}`}
        </Text>
        <Text
          variant="caption"
          weight="medium"
          style={[styles.toolBadgeText, { color: statusColor }]}
        >
          {meta.primaryTool}
        </Text>
      </View>

      {/* Expiring Warning Alert */}
      {isExpiring && (
        <View style={styles.warningBanner}>
          <Text variant="caption" weight="medium" style={styles.warningText}>
            Space nearing dissolution. All media and chat will dissolve at expiry.
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#111827',
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: tokens.spacing.md,
    marginBottom: tokens.spacing.md,
  },
  containerExpiring: {
    borderColor: 'rgba(245, 158, 11, 0.4)',
    backgroundColor: 'rgba(245, 158, 11, 0.05)',
  },
  containerExpired: {
    borderColor: 'rgba(239, 68, 68, 0.4)',
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: tokens.spacing.sm,
  },
  archetypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  archetypeText: {
    fontSize: 11,
    letterSpacing: 0.8,
  },
  stateChip: {
    backgroundColor: 'rgba(79, 70, 229, 0.2)',
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: 2,
    borderRadius: tokens.radius.full,
  },
  stateChipExpiring: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
  },
  stateChipExpired: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
  },
  stateChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#818CF8',
    letterSpacing: 0.5,
  },
  stateChipTextExpiring: {
    color: '#F59E0B',
  },
  stateChipTextExpired: {
    color: '#EF4444',
  },
  countdownSection: {
    marginVertical: tokens.spacing.xs,
  },
  countdownLabel: {
    fontSize: 10,
    color: '#64748B',
    letterSpacing: 1,
    marginBottom: 2,
  },
  countdownValue: {
    color: '#F8FAFC',
    fontSize: 36,
    lineHeight: 42,
  },
  countdownValueExpiring: {
    color: '#FBBF24',
  },
  countdownValueExpired: {
    color: '#F87171',
  },
  progressTrack: {
    width: '100%',
    height: 6,
    backgroundColor: '#161F30',
    borderRadius: 3,
    overflow: 'hidden',
    marginVertical: tokens.spacing.sm,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: tokens.spacing.xs,
  },
  footerSubText: {
    color: '#94A3B8',
    fontSize: 11,
    flex: 1,
  },
  toolBadgeText: {
    fontSize: 11,
    marginLeft: tokens.spacing.xs,
  },
  warningBanner: {
    marginTop: tokens.spacing.sm,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderRadius: tokens.radius.sm,
    padding: tokens.spacing.xs,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  warningText: {
    color: '#FBBF24',
    textAlign: 'center',
    fontSize: 11,
  },
});

export default GroupHeroCard;
