import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import {
  Screen,
  Text,
  ErrorState,
  Button,
  SkeletonGroupDetail,
  FadeInContent,
} from '../../components';
import { tokens } from '../../design';
import { useAuth } from '../../hooks/useAuth';
import {
  groupService,
  GroupDetailedRecord,
  useGroupLifecycle,
  GroupHeroCard,
  GroupMemberRoster,
  GroupModuleHub,
} from '../../features/groups';
import type { RootStackScreenProps } from '../types';

export const GroupDetailScreen: React.FC<RootStackScreenProps<'GroupDetail'>> = ({
  route,
  navigation,
}) => {
  const { groupId, groupName: initialName } = route.params;
  const { user } = useAuth();

  const [group, setGroup] = useState<GroupDetailedRecord | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const loadGroupData = useCallback(async () => {
    setError(null);
    const res = await groupService.fetchGroupDetails(groupId, user?.id);

    if (res.error || !res.group) {
      setError(res.error || 'Unable to load temporary space.');
    } else {
      setGroup(res.group);
    }
    setLoading(false);
    setRefreshing(false);
  }, [groupId, user?.id]);

  useEffect(() => {
    loadGroupData();
  }, [loadGroupData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadGroupData();
  }, [loadGroupData]);

  // Real-time lifecycle and countdown ticker hook
  const { remainingTime, lifecycleState, isExpired } = useGroupLifecycle(
    group?.starts_at,
    group?.expires_at,
    group?.lifecycle_state,
    group?.id,
  );

  if (loading) {
    return (
      <Screen>
        <SkeletonGroupDetail />
      </Screen>
    );
  }

  if (error || !group) {
    return (
      <Screen contentContainerStyle={styles.centerContainer}>
        <ErrorState
          title="Space Inaccessible"
          message={error || 'This temporary space could not be found or has been completely purged.'}
          retryLabel="Retry Connection"
          onRetry={loadGroupData}
        />
        <Button
          title="Return to Command Center"
          variant="outline"
          size="sm"
          style={styles.returnButton}
          onPress={() => navigation.goBack()}
        />
      </Screen>
    );
  }

  const spaceName = group.name || initialName || 'Temporary Space';

  return (
    <Screen scrollable={false} contentContainerStyle={styles.screenContainer}>
      <FadeInContent>
        <ScrollView
          showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#818CF8"
            colors={['#818CF8']}
          />
        }
      >
        {/* Navigation / Top Meta */}
        <View style={styles.header}>
          <Text variant="caption" style={styles.spaceIdText}>
            TEMPORARY SPACE • {group.purpose}
          </Text>
          <Text variant="title1" weight="bold" style={styles.titleText}>
            {spaceName}
          </Text>
          {group.description ? (
            <Text variant="body" style={styles.descriptionText}>
              {group.description}
            </Text>
          ) : null}
        </View>

        {/* Hero Countdown & Archetype Card */}
        <GroupHeroCard
          group={group}
          remainingTime={remainingTime}
          lifecycleState={lifecycleState}
        />

        {/* Collaborative Modules Hub */}
        <GroupModuleHub
          enabledFeatures={group.features}
          isExpired={isExpired}
          onModulePress={(moduleKey) => {
            if (moduleKey === 'CHAT') {
              navigation.navigate('Chat', {
                groupId: group.id,
                groupName: group.name,
              });
            } else if (moduleKey === 'TASKS') {
              navigation.navigate('TaskBoard', {
                groupId: group.id,
                groupName: group.name,
              });
            } else if (moduleKey === 'POLLS') {
              navigation.navigate('Polls', {
                groupId: group.id,
                groupName: group.name,
              });
            } else if (moduleKey === 'EVENTS') {
              navigation.navigate('Events', {
                groupId: group.id,
                groupName: group.name,
              });
            } else if (moduleKey === 'FILES') {
              navigation.navigate('MediaVault', {
                groupId: group.id,
                groupName: group.name,
              });
            } else if (moduleKey === 'LOCATION') {
              navigation.navigate('LocationSession', {
                groupId: group.id,
                groupName: group.name,
              });
            }
          }}
        />

        {/* Member Roster Card */}
        <GroupMemberRoster
          members={group.members}
          ownerId={group.owner_id}
          currentUserRole={group.currentUserRole}
          isExpired={isExpired}
          onInvitePress={() => navigation.navigate('MainTabs', { screen: 'FriendsTab' })}
        />

        {/* Space Departure Action */}
        <View style={styles.footerActions}>
          <Button
            title="Return to Command Center"
            variant="outline"
            onPress={() => navigation.goBack()}
          />
        </View>
      </ScrollView>
    </FadeInContent>
  </Screen>
);
};

const styles = StyleSheet.create({
  screenContainer: {
    backgroundColor: '#0B0F19',
    padding: 0,
  },
  centerContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: tokens.spacing.lg,
    backgroundColor: '#0B0F19',
  },
  scrollContent: {
    padding: tokens.spacing.md,
    paddingBottom: tokens.spacing.xxl,
  },
  header: {
    marginBottom: tokens.spacing.md,
  },
  spaceIdText: {
    color: '#818CF8',
    letterSpacing: 1,
    marginBottom: 4,
  },
  titleText: {
    color: '#F8FAFC',
    marginBottom: tokens.spacing.xxs,
  },
  descriptionText: {
    color: '#94A3B8',
    lineHeight: 20,
    marginTop: tokens.spacing.xxs,
  },
  returnButton: {
    marginTop: tokens.spacing.md,
  },
  footerActions: {
    marginTop: tokens.spacing.md,
    marginBottom: tokens.spacing.xl,
  },
});

export default GroupDetailScreen;
