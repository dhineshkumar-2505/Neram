import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  StatusBar,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { tokens } from '../../../design';
import { useFriends } from '../hooks/useFriends';
import FriendItem from '../components/FriendItem';
import RequestItem from '../components/RequestItem';
import AddFriendSection from '../components/AddFriendSection';
import Text from '../../../components/Text';
import EmptyState from '../../../components/EmptyState';
import TimeGlyph from '../../auth/components/TimeGlyph';

export type FriendsTabMode = 'friends' | 'requests' | 'add';

export const FriendsScreen: React.FC = () => {
  const {
    friends,
    incomingRequests,
    outgoingRequests,
    isLoading,
    isRefreshing,
    error,
    refresh,
    acceptRequest,
    declineRequest,
    cancelRequest,
    unfriend,
    block,
  } = useFriends();

  const [activeTab, setActiveTab] = useState<FriendsTabMode>('friends');
  const [busyRequestId, setBusyRequestId] = useState<string | null>(null);

  const handleAccept = async (requestId: string) => {
    try {
      setBusyRequestId(requestId);
      await acceptRequest(requestId);
    } finally {
      setBusyRequestId(null);
    }
  };

  const handleDecline = async (requestId: string) => {
    try {
      setBusyRequestId(requestId);
      await declineRequest(requestId);
    } finally {
      setBusyRequestId(null);
    }
  };

  const handleCancel = async (requestId: string) => {
    try {
      setBusyRequestId(requestId);
      await cancelRequest(requestId);
    } finally {
      setBusyRequestId(null);
    }
  };

  const totalRequestsCount = incomingRequests.length;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="light-content" backgroundColor="#0B0F19" />

      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.headerTextGroup}>
          <Text style={styles.headerTitle}>Friends & Circle</Text>
          <Text style={styles.headerSubtitle}>
            Mutual friends eligible for temporary group invites
          </Text>
        </View>
        <TimeGlyph size={36} color="#818CF8" accentColor="#2DD4BF" />
      </View>

      {/* Segmented Tab Navigation */}
      <View style={styles.segmentedContainer}>
        <Pressable
          onPress={() => setActiveTab('friends')}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'friends' }}
          style={[styles.segmentBtn, activeTab === 'friends' && styles.segmentBtnActive]}
        >
          <Text
            weight={activeTab === 'friends' ? 'semibold' : 'regular'}
            style={[styles.segmentText, activeTab === 'friends' && styles.segmentTextActive]}
          >
            Friends ({friends.length})
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setActiveTab('requests')}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'requests' }}
          style={[styles.segmentBtn, activeTab === 'requests' && styles.segmentBtnActive]}
        >
          <View style={styles.requestsLabelRow}>
            <Text
              weight={activeTab === 'requests' ? 'semibold' : 'regular'}
              style={[
                styles.segmentText,
                activeTab === 'requests' && styles.segmentTextActive,
              ]}
            >
              Requests
            </Text>
            {totalRequestsCount > 0 && (
              <View style={styles.requestBadge}>
                <Text weight="bold" style={styles.requestBadgeText}>
                  {totalRequestsCount}
                </Text>
              </View>
            )}
          </View>
        </Pressable>

        <Pressable
          onPress={() => setActiveTab('add')}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'add' }}
          style={[styles.segmentBtn, activeTab === 'add' && styles.segmentBtnActive]}
        >
          <Text
            weight={activeTab === 'add' ? 'semibold' : 'regular'}
            style={[styles.segmentText, activeTab === 'add' && styles.segmentTextActive]}
          >
            Add Friend
          </Text>
        </Pressable>
      </View>

      {/* Error Banner */}
      {error && (
        <View style={styles.errorBanner} accessibilityRole="alert">
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Loading Indicator for Initial Load */}
      {isLoading && !isRefreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#818CF8" />
          <Text style={styles.loadingText}>Syncing circle...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={refresh}
              tintColor="#818CF8"
              colors={['#818CF8']}
            />
          }
        >
          {/* TAB 1: FRIENDS LIST */}
          {activeTab === 'friends' && (
            <View>
              {friends.length === 0 ? (
                <EmptyState
                  title="No mutual connections yet"
                  description="Temporary groups require two-way mutual friendships to protect group privacy. Search an exact handle to connect."
                  actionLabel="Add Your First Friend"
                  onAction={() => setActiveTab('add')}
                  style={styles.emptyState}
                />
              ) : (
                <View>
                  <Text style={styles.listHeader}>
                    {friends.length} {friends.length === 1 ? 'Connection' : 'Connections'}
                  </Text>
                  {friends.map((friend) => (
                    <FriendItem
                      key={friend.friendshipId}
                      friend={friend}
                      onUnfriend={unfriend}
                      onBlock={block}
                    />
                  ))}
                </View>
              )}
            </View>
          )}

          {/* TAB 2: REQUESTS (INCOMING & OUTGOING) */}
          {activeTab === 'requests' && (
            <View>
              {/* Incoming Section */}
              <View style={styles.sectionHeader}>
                <Text weight="bold" style={styles.sectionTitle}>
                  Incoming Requests ({incomingRequests.length})
                </Text>
              </View>

              {incomingRequests.length === 0 ? (
                <Text style={styles.emptySectionText}>No pending incoming requests.</Text>
              ) : (
                incomingRequests.map((req) => (
                  <RequestItem
                    key={req.id}
                    request={req}
                    isIncoming={true}
                    onAccept={handleAccept}
                    onDecline={handleDecline}
                    isBusy={busyRequestId === req.id}
                  />
                ))
              )}

              {/* Outgoing Section */}
              <View style={[styles.sectionHeader, { marginTop: tokens.spacing.lg }]}>
                <Text weight="bold" style={styles.sectionTitle}>
                  Sent Requests ({outgoingRequests.length})
                </Text>
              </View>

              {outgoingRequests.length === 0 ? (
                <Text style={styles.emptySectionText}>No pending sent requests.</Text>
              ) : (
                outgoingRequests.map((req) => (
                  <RequestItem
                    key={req.id}
                    request={req}
                    isIncoming={false}
                    onCancel={handleCancel}
                    isBusy={busyRequestId === req.id}
                  />
                ))
              )}
            </View>
          )}

          {/* TAB 3: ADD FRIEND (EXACT HANDLE DISCOVERY) */}
          {activeTab === 'add' && (
            <AddFriendSection onFriendAdded={() => refresh()} />
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0B0F19',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing.md,
    paddingTop: tokens.spacing.md,
    paddingBottom: tokens.spacing.sm,
  },
  headerTextGroup: {
    flex: 1,
    paddingRight: tokens.spacing.md,
  },
  headerTitle: {
    fontSize: tokens.typography.sizes.title1,
    lineHeight: tokens.typography.lineHeights.title1,
    color: '#F8FAFC',
    fontWeight: '700',
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: tokens.typography.sizes.caption,
    color: '#94A3B8',
    lineHeight: 16,
  },
  segmentedContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(30, 41, 59, 0.45)',
    borderRadius: tokens.radius.md,
    marginHorizontal: tokens.spacing.md,
    marginVertical: tokens.spacing.sm,
    padding: 3,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.1)',
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: tokens.spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.radius.sm,
  },
  segmentBtnActive: {
    backgroundColor: '#1E293B',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  segmentText: {
    fontSize: tokens.typography.sizes.footnote,
    color: '#94A3B8',
  },
  segmentTextActive: {
    color: '#F8FAFC',
  },
  requestsLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  requestBadge: {
    backgroundColor: '#6366F1',
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
    marginLeft: 4,
  },
  requestBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
  },
  errorBanner: {
    backgroundColor: 'rgba(220, 38, 38, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    marginHorizontal: tokens.spacing.md,
    padding: tokens.spacing.sm,
    borderRadius: tokens.radius.md,
    marginBottom: tokens.spacing.sm,
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: tokens.typography.sizes.footnote,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: tokens.spacing.sm,
    color: '#94A3B8',
    fontSize: tokens.typography.sizes.caption,
  },
  scrollContent: {
    paddingHorizontal: tokens.spacing.md,
    paddingBottom: tokens.spacing.xxl,
  },
  listHeader: {
    fontSize: tokens.typography.sizes.caption,
    color: '#64748B',
    marginBottom: tokens.spacing.sm,
    marginTop: tokens.spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  emptyState: {
    marginTop: tokens.spacing.xl,
  },
  sectionHeader: {
    marginBottom: tokens.spacing.xs,
    marginTop: tokens.spacing.sm,
  },
  sectionTitle: {
    fontSize: tokens.typography.sizes.callout,
    color: '#E2E8F0',
  },
  emptySectionText: {
    fontSize: tokens.typography.sizes.caption,
    color: '#64748B',
    marginVertical: tokens.spacing.sm,
    fontStyle: 'italic',
  },
});

export default FriendsScreen;
