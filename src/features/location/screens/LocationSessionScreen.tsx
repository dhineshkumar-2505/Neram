import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  RefreshControl,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '../../../design';
import Text from '../../../components/Text';
import LoadingState from '../../../components/LoadingState';
import EmptyState from '../../../components/EmptyState';
import ErrorState from '../../../components/ErrorState';
import { useAuth } from '../../../hooks/useAuth';
import { groupService } from '../../groups/services/groupService';
import { useGroupLifecycle } from '../../groups/hooks/useGroupLifecycle';
import type { GroupDetailedRecord } from '../../groups/types';
import type { RootStackScreenProps } from '../../../navigation/types';
import { useLocationSession } from '../hooks/useLocationSession';
import { useLocationTracking } from '../hooks/useLocationTracking';
import { LocationOptInModal } from '../components/LocationOptInModal';
import { CreateSessionModal } from '../components/CreateSessionModal';
import {
  CompassIcon,
  RendezvousPinIcon,
  UserLocationIcon,
  LockIcon,
  LeaveIcon,
  WalkingIcon,
  CarIcon,
  ActivityPulseIcon,
  BatterySavingIcon,
} from '../components/LocationIcons';

export const LocationSessionScreen: React.FC<RootStackScreenProps<'LocationSession'>> = ({
  route,
  navigation,
}) => {
  const insets = useSafeAreaInsets();
  const { groupId, groupName: initialGroupName } = route.params;
  const { user } = useAuth();
  const currentUserId = user?.id;

  const [group, setGroup] = useState<GroupDetailedRecord | null>(null);
  const [optInModalVisible, setOptInModalVisible] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);

  useEffect(() => {
    let isCurrent = true;
    if (groupId) {
      groupService.fetchGroupDetails(groupId).then((res) => {
        if (isCurrent && res.group) {
          setGroup(res.group);
        }
      });
    }
    return () => {
      isCurrent = false;
    };
  }, [groupId]);

  const { remainingTime, isExpired } = useGroupLifecycle(
    group?.starts_at,
    group?.expires_at,
    group?.lifecycle_state || 'ACTIVE',
    groupId,
  );

  const {
    activeSession,
    participants,
    isLoading,
    isRefreshing,
    error,
    isParticipating,
    refresh,
    startSession,
    joinSession,
    leaveSession,
    endSession,
  } = useLocationSession(groupId, currentUserId);

  const trackingState = useLocationTracking(
    groupId,
    activeSession?.id,
    isParticipating,
    isExpired,
  );

  const spaceName = group?.name || initialGroupName || 'Space';
  const remainingTimeText = isExpired
    ? 'EXPIRED'
    : typeof remainingTime === 'string'
    ? remainingTime
    : remainingTime?.formattedText || '--';

  const isCreatorOrAdmin = Boolean(
    activeSession &&
      currentUserId &&
      (activeSession.createdBy === currentUserId ||
        group?.owner_id === currentUserId ||
        group?.currentUserRole === 'OWNER' ||
        group?.currentUserRole === 'ADMIN'),
  );

  const handleLeaveSharing = () => {
    Alert.alert(
      'Leave Location Sharing',
      'Are you sure you want to stop sharing your location? Your current coordinates will be permanently deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            const res = await leaveSession();
            if (!res.success && res.error) {
              Alert.alert('Leave Error', res.error, [{ text: 'OK' }]);
            }
          },
        },
      ],
    );
  };

  const handleEndSession = () => {
    Alert.alert(
      'End Outing Session',
      'Are you sure you want to conclude this rendezvous outing? All active location sharing for this space will be terminated and all coordinates purged.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End Session',
          style: 'destructive',
          onPress: async () => {
            const res = await endSession();
            if (!res.success && res.error) {
              Alert.alert('End Error', res.error, [{ text: 'OK' }]);
            }
          },
        },
      ],
    );
  };

  return (
    <View style={[styles.screen, { paddingTop: Math.max(insets.top, 16) }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          testID="location-back-button"
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          hitSlop={8}
        >
          <Text variant="body" weight="medium" style={styles.backButtonText}>
            Back
          </Text>
        </Pressable>

        <View style={styles.headerCenter}>
          <Text variant="title3" weight="bold" style={styles.title} numberOfLines={1}>
            Live Outing & ETA
          </Text>
          <Text variant="caption" style={styles.subtitle} numberOfLines={1}>
            {spaceName}
          </Text>
        </View>

        {/* Space Lifespan Badge */}
        <View style={[styles.lifespanBadge, isExpired && styles.lifespanBadgeExpired]}>
          <Text
            variant="caption"
            weight="bold"
            style={[styles.lifespanText, isExpired && styles.lifespanTextExpired]}
          >
            {remainingTimeText}
          </Text>
        </View>
      </View>

      {/* Read-Only Expiration Banner */}
      {isExpired && (
        <View style={styles.expiredBanner}>
          <LockIcon size={16} color="#EF4444" />
          <Text variant="caption" weight="semibold" style={styles.expiredBannerText}>
            SPACE DISSOLVED — Outing coordination and location sharing are permanently terminated.
          </Text>
        </View>
      )}

      {/* Main Content Area */}
      {isLoading ? (
        <LoadingState message="Synchronizing outing rendezvous..." />
      ) : error && !activeSession ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + 40 },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={refresh}
              tintColor="#38BDF8"
            />
          }
        >
          {!activeSession ? (
            /* State A: No Active Outing Session */
            <EmptyState
              icon={<CompassIcon size={52} color="#38BDF8" />}
              title="No Active Outing Session"
              description="Start a shared rendezvous session to coordinate member arrivals and live ETAs."
              actionLabel={!isExpired ? 'Start Outing Session' : undefined}
              onAction={() => setCreateModalVisible(true)}
            />
          ) : (
            /* State B: Active Outing Session */
            <View style={styles.sessionContainer}>
              {/* Outing Overview Card */}
              <View style={styles.sessionCard}>
                <View style={styles.sessionCardHeader}>
                  <View style={styles.destinationIconCircle}>
                    <RendezvousPinIcon size={24} color="#38BDF8" />
                  </View>
                  <View style={styles.sessionHeaderInfo}>
                    <Text variant="callout" weight="bold" style={styles.sessionTitle}>
                      {activeSession.title}
                    </Text>
                    <Text variant="caption" style={styles.destinationText}>
                      {activeSession.destinationName ||
                        `Coordinates: ${activeSession.destinationLat.toFixed(4)}, ${activeSession.destinationLng.toFixed(4)}`}
                    </Text>
                  </View>
                  <View style={styles.statusBadge}>
                    <Text variant="caption" weight="bold" style={styles.statusBadgeText}>
                      {activeSession.status}
                    </Text>
                  </View>
                </View>

                {activeSession.creator && (
                  <View style={styles.metaRow}>
                    <Text variant="caption" style={styles.metaText}>
                      Organized by @{activeSession.creator.username}
                    </Text>
                  </View>
                )}
              </View>

              {/* Participation Status / Actions Card */}
              {!isExpired && (
                <View style={styles.participationCard}>
                  {isParticipating ? (
                    <>
                      <View style={styles.participatingBanner}>
                      <View style={styles.participatingTextRow}>
                        <UserLocationIcon size={20} color="#10B981" />
                        <Text variant="callout" weight="semibold" style={styles.participatingText}>
                          You are sharing location in this outing
                        </Text>
                      </View>
                      <Pressable
                        testID="leave-sharing-button"
                        style={({ pressed }) => [
                          styles.leaveButton,
                          pressed && styles.buttonPressed,
                        ]}
                        onPress={handleLeaveSharing}
                        accessibilityLabel="Leave Location Sharing"
                      >
                        <LeaveIcon size={16} color="#EF4444" />
                        <Text variant="caption" weight="bold" style={styles.leaveButtonText}>
                          Stop Sharing
                        </Text>
                      </Pressable>
                    </View>

                    {/* Live Movement State & Adaptive Telemetry Card */}
                    <View style={styles.telemetryCard}>
                      <View style={styles.telemetryHeader}>
                        <View style={styles.movementBadge}>
                          {trackingState.movementState === 'DRIVING' ? (
                            <CarIcon size={16} color="#38BDF8" />
                          ) : trackingState.movementState === 'WALKING' ? (
                            <WalkingIcon size={16} color="#10B981" />
                          ) : trackingState.movementState === 'STATIONARY' ? (
                            <CompassIcon size={16} color="#F59E0B" />
                          ) : (
                            <ActivityPulseIcon size={16} color="#94A3B8" />
                          )}
                          <Text variant="caption" weight="bold" style={styles.movementText}>
                            {trackingState.movementState}
                          </Text>
                        </View>

                        <View style={styles.batteryBadge}>
                          <BatterySavingIcon size={14} color="#10B981" />
                          <Text variant="caption" style={styles.batteryBadgeText}>
                            Adaptive Battery Filter
                          </Text>
                        </View>
                      </View>

                      <View style={styles.telemetryInfoRow}>
                        <Text variant="caption" style={styles.telemetrySubtext}>
                          {trackingState.movementState === 'STATIONARY'
                            ? 'Transmissions suppressed until movement > 25m'
                            : trackingState.movementState === 'WALKING'
                            ? 'Transmitting every 30s or 15m displacement'
                            : trackingState.movementState === 'DRIVING'
                            ? 'Transmitting every 10s or 50m displacement'
                            : 'Analyzing movement telemetry...'}
                        </Text>
                        <Text variant="caption" weight="medium" style={styles.syncCountText}>
                          {trackingState.transmissionCount}{' '}
                          {trackingState.transmissionCount === 1 ? 'sync' : 'syncs'}
                        </Text>
                      </View>
                    </View>
                  </>
                  ) : (
                    <View style={styles.joinPromptContainer}>
                      <Text variant="body" weight="medium" style={styles.joinPromptTitle}>
                        Join Rendezvous Outing
                      </Text>
                      <Text variant="caption" style={styles.joinPromptDescription}>
                        Share your live location with group members while coordinating this meetup.
                      </Text>
                      <Pressable
                        testID="join-outing-button"
                        style={({ pressed }) => [
                          styles.joinButton,
                          pressed && styles.buttonPressed,
                        ]}
                        onPress={() => setOptInModalVisible(true)}
                        accessibilityLabel="Join Outing and Share Location"
                      >
                        <Text variant="callout" weight="bold" style={styles.joinButtonText}>
                          Join Outing & Share Location
                        </Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              )}

              {/* Participating Members Roster */}
              <View style={styles.rosterSection}>
                <Text variant="caption" weight="semibold" style={styles.rosterTitle}>
                  PARTICIPATING MEMBERS ({participants.length})
                </Text>

                {participants.length === 0 ? (
                  <View style={styles.emptyRoster}>
                    <Text variant="caption" style={styles.emptyRosterText}>
                      No members are currently sharing location.
                    </Text>
                  </View>
                ) : (
                  <View style={styles.participantsList}>
                    {participants.map((p) => {
                      const isSelf = currentUserId && p.userId === currentUserId;
                      return (
                        <View key={p.id} style={styles.participantRow}>
                          <View style={styles.avatarPlaceholder}>
                            <Text variant="caption" weight="bold" style={styles.avatarInitial}>
                              {p.user?.displayName?.charAt(0) || p.user?.username?.charAt(0) || 'U'}
                            </Text>
                          </View>

                          <View style={styles.participantInfo}>
                            <Text variant="callout" weight="medium" style={styles.participantName}>
                              {p.user?.displayName || 'Member'}
                              {isSelf ? ' (You)' : ''}
                            </Text>
                            <Text variant="caption" style={styles.participantUsername}>
                              @{p.user?.username || 'user'}
                            </Text>
                          </View>

                          <View style={styles.liveIndicatorBadge}>
                            <View style={styles.liveDot} />
                            <Text variant="caption" weight="semibold" style={styles.liveIndicatorText}>
                              Sharing Live
                            </Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>

              {/* Creator / Admin Session Termination Action */}
              {!isExpired && isCreatorOrAdmin && (
                <View style={styles.adminControlsContainer}>
                  <Pressable
                    testID="end-session-button"
                    style={({ pressed }) => [
                      styles.endSessionButton,
                      pressed && styles.buttonPressed,
                    ]}
                    onPress={handleEndSession}
                    accessibilityLabel="End Outing Session"
                  >
                    <Text variant="callout" weight="bold" style={styles.endSessionButtonText}>
                      End Outing Session
                    </Text>
                  </Pressable>
                </View>
              )}
            </View>
          )}
        </ScrollView>
      )}

      {/* Educational Opt-In Modal */}
      <LocationOptInModal
        visible={optInModalVisible}
        onClose={() => setOptInModalVisible(false)}
        onConsentGranted={async () => {
          const res = await joinSession();
          if (!res.success && res.error) {
            Alert.alert('Join Error', res.error, [{ text: 'OK' }]);
          }
        }}
      />

      {/* Start Session Modal */}
      <CreateSessionModal
        visible={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
        onCreate={startSession}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing.md,
    paddingBottom: tokens.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  backButton: {
    paddingVertical: 6,
    paddingRight: 12,
  },
  backButtonText: {
    color: tokens.colors.primary.default,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 8,
  },
  title: {
    color: tokens.colors.text.primary,
  },
  subtitle: {
    color: tokens.colors.text.tertiary,
    marginTop: 1,
  },
  lifespanBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: tokens.radius.full,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
  },
  lifespanBadgeExpired: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  lifespanText: {
    color: '#38BDF8',
    fontSize: 11,
  },
  lifespanTextExpired: {
    color: '#EF4444',
  },
  expiredBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(239, 68, 68, 0.2)',
  },
  expiredBannerText: {
    color: '#EF4444',
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: tokens.spacing.md,
    paddingTop: tokens.spacing.md,
  },
  sessionContainer: {
    gap: 16,
  },
  sessionCard: {
    backgroundColor: '#13151A',
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.border.subtle,
    padding: tokens.spacing.md,
  },
  sessionCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  destinationIconCircle: {
    width: 44,
    height: 44,
    borderRadius: tokens.radius.md,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionHeaderInfo: {
    flex: 1,
  },
  sessionTitle: {
    color: tokens.colors.text.primary,
    marginBottom: 2,
  },
  destinationText: {
    color: tokens.colors.text.secondary,
  },
  statusBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: tokens.radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  statusBadgeText: {
    color: '#38BDF8',
    fontSize: 10,
    textTransform: 'uppercase',
  },
  metaRow: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  metaText: {
    color: tokens.colors.text.tertiary,
    fontSize: 11,
  },
  participationCard: {
    backgroundColor: '#13151A',
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.border.subtle,
    padding: tokens.spacing.md,
  },
  participatingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  participatingTextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginRight: 8,
  },
  participatingText: {
    color: '#10B981',
    flex: 1,
  },
  leaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: tokens.radius.full,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
  },
  leaveButtonText: {
    color: '#EF4444',
  },
  telemetryCard: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  telemetryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  movementBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: tokens.radius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  movementText: {
    color: tokens.colors.text.primary,
    fontSize: 10,
    letterSpacing: 0.5,
  },
  batteryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: tokens.radius.xs,
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  batteryBadgeText: {
    color: '#10B981',
    fontSize: 10,
  },
  telemetryInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  telemetrySubtext: {
    color: tokens.colors.text.tertiary,
    fontSize: 11,
    flex: 1,
    marginRight: 8,
  },
  syncCountText: {
    color: tokens.colors.text.secondary,
    fontSize: 11,
  },
  joinPromptContainer: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  joinPromptTitle: {
    color: tokens.colors.text.primary,
    marginBottom: 4,
  },
  joinPromptDescription: {
    color: tokens.colors.text.secondary,
    textAlign: 'center',
    marginBottom: tokens.spacing.md,
  },
  joinButton: {
    width: '100%',
    backgroundColor: '#38BDF8',
    borderRadius: tokens.radius.full,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  joinButtonText: {
    color: '#0B0F19',
  },
  rosterSection: {
    marginTop: 4,
  },
  rosterTitle: {
    color: tokens.colors.text.tertiary,
    fontSize: 11,
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  emptyRoster: {
    backgroundColor: '#13151A',
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.border.subtle,
    padding: tokens.spacing.lg,
    alignItems: 'center',
  },
  emptyRosterText: {
    color: tokens.colors.text.tertiary,
  },
  participantsList: {
    backgroundColor: '#13151A',
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.border.subtle,
    overflow: 'hidden',
  },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: tokens.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  avatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: tokens.radius.full,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  avatarInitial: {
    color: '#38BDF8',
  },
  participantInfo: {
    flex: 1,
  },
  participantName: {
    color: tokens.colors.text.primary,
  },
  participantUsername: {
    color: tokens.colors.text.tertiary,
  },
  liveIndicatorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: tokens.radius.full,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  liveIndicatorText: {
    color: '#10B981',
    fontSize: 10,
  },
  adminControlsContainer: {
    marginTop: 8,
    marginBottom: 16,
  },
  endSessionButton: {
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderRadius: tokens.radius.full,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  endSessionButtonText: {
    color: '#EF4444',
  },
  buttonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
});

export default LocationSessionScreen;
