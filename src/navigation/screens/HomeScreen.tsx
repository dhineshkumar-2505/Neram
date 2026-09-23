import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Screen, Text, Card, Button } from '../../components';
import { tokens } from '../../design';
import { useAuth } from '../../hooks/useAuth';
import TimeGlyph from '../../features/auth/components/TimeGlyph';
import type { MainTabScreenProps } from '../types';

export const HomeScreen: React.FC<MainTabScreenProps<'HomeTab'>> = ({ navigation }) => {
  const { profile } = useAuth();
  const displayName = profile?.display_name || 'Member';

  return (
    <Screen scrollable={true} contentContainerStyle={styles.container}>
      {/* Top Header & Temporal Branding */}
      <View style={styles.header}>
        <View style={styles.headerTextGroup}>
          <Text variant="display" weight="bold" style={styles.brandTitle}>
            Nēram
          </Text>
          <Text variant="callout" style={styles.brandSubtitle}>
            Welcome back, {displayName}
          </Text>
        </View>
        <TimeGlyph size={42} color="#818CF8" accentColor="#2DD4BF" />
      </View>

      {/* Ephemeral Status Card */}
      <Card variant="outlined" style={styles.statusCard}>
        <View style={styles.statusHeader}>
          <View style={styles.liveIndicator} />
          <Text variant="footnote" weight="semibold" style={styles.statusLabel}>
            EPHEMERAL PRIVACY ACTIVE
          </Text>
        </View>
        <Text variant="title3" weight="semibold" style={styles.cardTitle}>
          Your Command Center
        </Text>
        <Text variant="body" style={styles.cardBody}>
          Temporary spaces exist only for the duration of your plans. No permanent feeds, no public logs, and zero tracking after expiry.
        </Text>
      </Card>

      {/* Quick Action Rail */}
      <Text variant="footnote" weight="semibold" style={styles.sectionHeader}>
        QUICK ACTIONS
      </Text>

      <View style={styles.actionGrid}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Manage circle and friends"
          style={styles.actionTile}
          onPress={() => navigation.navigate('FriendsTab')}
        >
          <View style={[styles.tileIconDot, { backgroundColor: '#818CF8' }]} />
          <Text variant="callout" weight="semibold" style={styles.tileTitle}>
            Friends & Circle
          </Text>
          <Text variant="caption" style={styles.tileDescription}>
            Manage mutual connections for private space invites
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Create temporary space"
          style={styles.actionTile}
          onPress={() => navigation.navigate('CreateTab')}
        >
          <View style={[styles.tileIconDot, { backgroundColor: '#2DD4BF' }]} />
          <Text variant="callout" weight="semibold" style={styles.tileTitle}>
            Create Space
          </Text>
          <Text variant="caption" style={styles.tileDescription}>
            Configure purpose, invite friends, and set duration
          </Text>
        </Pressable>
      </View>

      {/* Group Detail Navigation Inspector */}
      <Card variant="subtle" style={styles.inspectCard}>
        <Text variant="footnote" weight="semibold" style={styles.inspectTitle}>
          ARCHITECTURE VERIFICATION
        </Text>
        <Text variant="footnote" style={styles.inspectBody}>
          Verify container shell routing and deep navigation state:
        </Text>
        <Button
          title="Inspect Group Detail Shell"
          variant="outline"
          size="sm"
          onPress={() =>
            navigation.navigate('GroupDetail', {
              groupId: 'prod-readiness-audit-id',
              groupName: 'Weekend Meetup Space',
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
    backgroundColor: '#0B0F19',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: tokens.spacing.lg,
    paddingTop: tokens.spacing.xs,
  },
  headerTextGroup: {
    flex: 1,
  },
  brandTitle: {
    color: '#F8FAFC',
    fontSize: tokens.typography.sizes.display,
    lineHeight: tokens.typography.lineHeights.display,
  },
  brandSubtitle: {
    color: '#94A3B8',
    marginTop: tokens.spacing.xxs,
  },
  statusCard: {
    backgroundColor: '#111827',
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: tokens.radius.lg,
    padding: tokens.spacing.md,
    marginBottom: tokens.spacing.lg,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: tokens.spacing.sm,
    gap: tokens.spacing.xs,
  },
  liveIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2DD4BF',
  },
  statusLabel: {
    color: '#2DD4BF',
    letterSpacing: 0.8,
  },
  cardTitle: {
    color: '#F8FAFC',
    marginBottom: tokens.spacing.xs,
  },
  cardBody: {
    color: '#94A3B8',
    lineHeight: 22,
  },
  sectionHeader: {
    color: '#64748B',
    letterSpacing: 0.8,
    marginBottom: tokens.spacing.sm,
  },
  actionGrid: {
    flexDirection: 'row',
    gap: tokens.spacing.md,
    marginBottom: tokens.spacing.lg,
  },
  actionTile: {
    flex: 1,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: tokens.radius.md,
    padding: tokens.spacing.md,
  },
  tileIconDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginBottom: tokens.spacing.sm,
  },
  tileTitle: {
    color: '#F8FAFC',
    marginBottom: tokens.spacing.xxs,
  },
  tileDescription: {
    color: '#94A3B8',
    lineHeight: 16,
  },
  inspectCard: {
    backgroundColor: '#161F30',
    borderColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: tokens.radius.md,
    padding: tokens.spacing.md,
    marginBottom: tokens.spacing.xl,
  },
  inspectTitle: {
    color: '#818CF8',
    letterSpacing: 0.5,
    marginBottom: tokens.spacing.xs,
  },
  inspectBody: {
    color: '#94A3B8',
    marginBottom: tokens.spacing.md,
  },
});

export default HomeScreen;
