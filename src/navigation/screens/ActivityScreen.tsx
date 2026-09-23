import React, { useCallback } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  RefreshControl,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { Screen, Text, EmptyState, ErrorState } from '../../components';
import { SkeletonActivity, FadeInContent } from '../../components/skeleton';
import { tokens } from '../../design';
import { useAuth } from '../../hooks/useAuth';
import {
  useNotifications,
  NotificationCard,
  CheckAllIcon,
  handleNotificationDeepNavigation,
} from '../../features/notifications';
import type { NotificationRecord } from '../../features/notifications';
import type { MainTabScreenProps } from '../types';

export const ActivityScreen: React.FC<MainTabScreenProps<'ActivityTab'>> = ({
  navigation,
}) => {
  const { user } = useAuth();
  const userId = user?.id;

  const {
    notifications,
    unreadCount,
    isLoading,
    isRefreshing,
    isLoadingMore,
    error,
    refresh,
    loadMore,
    markAsRead,
    markAllAsRead,
  } = useNotifications(userId);

  const handlePressNotification = useCallback(
    (notification: NotificationRecord) => {
      markAsRead(notification.id);
      handleNotificationDeepNavigation(notification, navigation);
    },
    [markAsRead, navigation],
  );

  return (
    <Screen contentContainerStyle={styles.screenContainer}>
      {/* Top Header Bar */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text variant="title1" weight="bold" style={styles.title}>
            Activity
          </Text>
          {unreadCount > 0 && (
            <View style={styles.badge} testID="unread-count-badge">
              <Text variant="caption" weight="bold" style={styles.badgeText}>
                {unreadCount} new
              </Text>
            </View>
          )}
        </View>

        {unreadCount > 0 && (
          <Pressable
            onPress={markAllAsRead}
            style={styles.markAllButton}
            accessibilityRole="button"
            accessibilityLabel="Mark all notifications as read"
            testID="mark-all-read-button"
            hitSlop={8}
          >
            <CheckAllIcon size={16} color="#818CF8" />
            <Text variant="caption" weight="semibold" style={styles.markAllText}>
              Mark all as read
            </Text>
          </Pressable>
        )}
      </View>

      {/* Main Content Area */}
      {isLoading ? (
        <SkeletonActivity count={5} />
      ) : error ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : (
        <FadeInContent style={{ flex: 1 }}>
          <FlatList
            data={notifications}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <NotificationCard
                notification={item}
                onPress={handlePressNotification}
              />
            )}
            onEndReached={loadMore}
            onEndReachedThreshold={0.3}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={refresh}
                tintColor="#818CF8"
                colors={['#818CF8']}
              />
            }
            ListFooterComponent={
              isLoadingMore ? (
                <View style={styles.footerLoader}>
                  <ActivityIndicator size="small" color="#818CF8" />
                </View>
              ) : null
            }
            ListEmptyComponent={
              <EmptyState
                title="All Caught Up"
                description="No active alerts. Friend requests, group invitations, and space lifecycle updates will appear here in realtime."
              />
            }
            contentContainerStyle={styles.listContent}
          />
        </FadeInContent>
      )}
    </Screen>
  );
};

const styles = StyleSheet.create({
  screenContainer: {
    padding: tokens.spacing.md,
    backgroundColor: '#0B0F19',
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tokens.spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
  },
  title: {
    color: '#F8FAFC',
  },
  badge: {
    backgroundColor: 'rgba(129, 140, 248, 0.15)',
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(129, 140, 248, 0.3)',
  },
  badgeText: {
    color: '#818CF8',
    fontSize: 11,
  },
  markAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#161F30',
  },
  markAllText: {
    color: '#818CF8',
    fontSize: 12,
  },
  listContent: {
    paddingBottom: tokens.spacing.xxl,
    flexGrow: 1,
  },
  footerLoader: {
    paddingVertical: tokens.spacing.md,
    alignItems: 'center',
  },
});

export default ActivityScreen;
