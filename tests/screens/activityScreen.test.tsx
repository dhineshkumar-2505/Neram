import * as React from 'react';
void React;
import { render, fireEvent } from '@testing-library/react-native';
import { ActivityScreen } from '../../src/navigation/screens/ActivityScreen';
import * as notificationsHook from '../../src/features/notifications/hooks/useNotifications';
import * as deepNavUtils from '../../src/features/notifications/utils/deepNavigation';
import * as authHook from '../../src/hooks/useAuth';
import type { NotificationRecord } from '../../src/features/notifications/types';
import type { MainTabScreenProps } from '../../src/navigation/types';

jest.mock('../../src/hooks/useAuth');
jest.mock('../../src/features/notifications/hooks/useNotifications');
jest.mock('../../src/features/notifications/utils/deepNavigation');

describe('ActivityScreen Component', () => {
  const mockNavigate = jest.fn();
  const mockGoBack = jest.fn();
  const mockNavigation = {
    navigate: mockNavigate,
    goBack: mockGoBack,
  } as unknown as MainTabScreenProps<'ActivityTab'>['navigation'];

  const mockRoute = {
    key: 'ActivityTab-key',
    name: 'ActivityTab' as const,
  } as unknown as MainTabScreenProps<'ActivityTab'>['route'];

  const mockRefresh = jest.fn();
  const mockLoadMore = jest.fn();
  const mockMarkAsRead = jest.fn();
  const mockMarkAllAsRead = jest.fn();

  const mockSampleNotification: NotificationRecord = {
    id: 'notif_feed_1',
    userId: 'user_1',
    type: 'FRIEND_REQUEST',
    actorId: 'user_actor',
    groupId: null,
    payload: {},
    readAt: null,
    createdAt: '2026-09-23T12:00:00.000Z',
    actor: {
      userId: 'user_actor',
      username: 'dev_alex',
      displayName: 'Alex Rivers',
      avatarUrl: null,
    },
    group: undefined,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (authHook.useAuth as jest.Mock).mockReturnValue({
      user: { id: 'user_1' },
    });
  });

  it('renders LoadingState when isLoading is true', () => {
    (notificationsHook.useNotifications as jest.Mock).mockReturnValue({
      notifications: [],
      unreadCount: 0,
      isLoading: true,
      isRefreshing: false,
      isLoadingMore: false,
      error: null,
      refresh: mockRefresh,
      loadMore: mockLoadMore,
      markAsRead: mockMarkAsRead,
      markAllAsRead: mockMarkAllAsRead,
    });

    const { getByText } = render(
      <ActivityScreen navigation={mockNavigation} route={mockRoute} />,
    );

    expect(getByText('Connecting to secure activity stream...')).toBeTruthy();
  });

  it('renders ErrorState with retry button when error is present', () => {
    (notificationsHook.useNotifications as jest.Mock).mockReturnValue({
      notifications: [],
      unreadCount: 0,
      isLoading: false,
      isRefreshing: false,
      isLoadingMore: false,
      error: 'Network connection interrupted',
      refresh: mockRefresh,
      loadMore: mockLoadMore,
      markAsRead: mockMarkAsRead,
      markAllAsRead: mockMarkAllAsRead,
    });

    const { getByText } = render(
      <ActivityScreen navigation={mockNavigation} route={mockRoute} />,
    );

    expect(getByText('Network connection interrupted')).toBeTruthy();
    const retryButton = getByText('Try Again');
    fireEvent.press(retryButton);
    expect(mockRefresh).toHaveBeenCalled();
  });

  it('renders EmptyState when notifications array is empty', () => {
    (notificationsHook.useNotifications as jest.Mock).mockReturnValue({
      notifications: [],
      unreadCount: 0,
      isLoading: false,
      isRefreshing: false,
      isLoadingMore: false,
      error: null,
      refresh: mockRefresh,
      loadMore: mockLoadMore,
      markAsRead: mockMarkAsRead,
      markAllAsRead: mockMarkAllAsRead,
    });

    const { getByText } = render(
      <ActivityScreen navigation={mockNavigation} route={mockRoute} />,
    );

    expect(getByText('All Caught Up')).toBeTruthy();
    expect(
      getByText(
        'No active alerts. Friend requests, group invitations, and space lifecycle updates will appear here in realtime.',
      ),
    ).toBeTruthy();
  });

  it('renders notifications, unread badge, and mark all button when unread notifications exist', () => {
    (notificationsHook.useNotifications as jest.Mock).mockReturnValue({
      notifications: [mockSampleNotification],
      unreadCount: 1,
      isLoading: false,
      isRefreshing: false,
      isLoadingMore: false,
      error: null,
      refresh: mockRefresh,
      loadMore: mockLoadMore,
      markAsRead: mockMarkAsRead,
      markAllAsRead: mockMarkAllAsRead,
    });

    const { getByText, getByTestId } = render(
      <ActivityScreen navigation={mockNavigation} route={mockRoute} />,
    );

    expect(getByText('Activity')).toBeTruthy();
    expect(getByTestId('unread-count-badge')).toBeTruthy();
    expect(getByText('1 new')).toBeTruthy();
    expect(getByTestId('mark-all-read-button')).toBeTruthy();

    fireEvent.press(getByTestId('mark-all-read-button'));
    expect(mockMarkAllAsRead).toHaveBeenCalledTimes(1);
  });

  it('triggers markAsRead and handleNotificationDeepNavigation when notification is pressed', () => {
    (notificationsHook.useNotifications as jest.Mock).mockReturnValue({
      notifications: [mockSampleNotification],
      unreadCount: 1,
      isLoading: false,
      isRefreshing: false,
      isLoadingMore: false,
      error: null,
      refresh: mockRefresh,
      loadMore: mockLoadMore,
      markAsRead: mockMarkAsRead,
      markAllAsRead: mockMarkAllAsRead,
    });

    const { getByTestId } = render(
      <ActivityScreen navigation={mockNavigation} route={mockRoute} />,
    );

    fireEvent.press(getByTestId('notification-card-notif_feed_1'));
    expect(mockMarkAsRead).toHaveBeenCalledWith('notif_feed_1');
    expect(deepNavUtils.handleNotificationDeepNavigation).toHaveBeenCalledWith(
      mockSampleNotification,
      mockNavigation,
    );
  });
});
