import * as React from 'react';
void React;
import { render, fireEvent } from '@testing-library/react-native';
import {
  NotificationCard,
  formatRelativeTime,
} from '../../src/features/notifications/components/NotificationCard';
import type { NotificationRecord } from '../../src/features/notifications/types';

describe('NotificationCard Component & Time Utilities', () => {
  describe('formatRelativeTime', () => {
    it('returns empty string on invalid date string', () => {
      expect(formatRelativeTime('not-a-date')).toBe('');
    });

    it('formats seconds within minute as Just now', () => {
      const nowIso = new Date().toISOString();
      expect(formatRelativeTime(nowIso)).toBe('Just now');
    });

    it('formats minutes ago', () => {
      const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      expect(formatRelativeTime(fiveMinsAgo)).toBe('5m ago');
    });

    it('formats hours ago', () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 3600 * 1000).toISOString();
      expect(formatRelativeTime(twoHoursAgo)).toBe('2h ago');
    });

    it('formats yesterday', () => {
      const oneDayAgo = new Date(Date.now() - 25 * 3600 * 1000).toISOString();
      expect(formatRelativeTime(oneDayAgo)).toBe('Yesterday');
    });

    it('formats days ago', () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 86400 * 1000).toISOString();
      expect(formatRelativeTime(threeDaysAgo)).toBe('3d ago');
    });
  });

  describe('NotificationCard Rendering', () => {
    const baseNotification: NotificationRecord = {
      id: 'notif_1',
      userId: 'user_me',
      type: 'FRIEND_REQUEST',
      actorId: 'user_actor',
      groupId: null,
      payload: {},
      readAt: null,
      createdAt: new Date().toISOString(),
      actor: {
        userId: 'user_actor',
        username: 'sam_dev',
        displayName: 'Sam Developer',
        avatarUrl: null,
      },
      group: undefined,
    };

    it('renders FRIEND_REQUEST with actor name and unread indicator', () => {
      const mockPress = jest.fn();
      const { getByText, getByTestId } = render(
        <NotificationCard notification={baseNotification} onPress={mockPress} />,
      );

      expect(getByText('Friend Request')).toBeTruthy();
      expect(getByText('Sam Developer sent you a mutual friend request.')).toBeTruthy();
      expect(getByTestId('unread-dot')).toBeTruthy();

      fireEvent.press(getByTestId('notification-card-notif_1'));
      expect(mockPress).toHaveBeenCalledWith(baseNotification);
    });

    it('hides unread indicator when readAt is set', () => {
      const readNotif: NotificationRecord = {
        ...baseNotification,
        id: 'notif_read',
        readAt: '2026-09-23T12:00:00.000Z',
      };
      const mockPress = jest.fn();
      const { queryByTestId } = render(
        <NotificationCard notification={readNotif} onPress={mockPress} />,
      );

      expect(queryByTestId('unread-dot')).toBeNull();
    });

    it('renders FRIEND_ACCEPTED correctly', () => {
      const notif: NotificationRecord = {
        ...baseNotification,
        id: 'notif_acc',
        type: 'FRIEND_ACCEPTED',
      };
      const { getByText } = render(
        <NotificationCard notification={notif} onPress={jest.fn()} />,
      );

      expect(getByText('Friend Connected')).toBeTruthy();
      expect(getByText('Sam Developer accepted your friend request.')).toBeTruthy();
    });

    it('renders GROUP_INVITE with group name', () => {
      const notif: NotificationRecord = {
        ...baseNotification,
        id: 'notif_inv',
        type: 'GROUP_INVITE',
        groupId: 'grp_secret',
        group: {
          id: 'grp_secret',
          name: 'Starlight Expedition',
          purpose: 'Night photo shoot',
          lifecycleState: 'ACTIVE',
        },
      };
      const { getByText } = render(
        <NotificationCard notification={notif} onPress={jest.fn()} />,
      );

      expect(getByText('Space Invitation')).toBeTruthy();
      expect(getByText('You were invited to join "Starlight Expedition".')).toBeTruthy();
    });

    it('renders GROUP_EXPIRING and GROUP_EXPIRED', () => {
      const expiringNotif: NotificationRecord = {
        ...baseNotification,
        id: 'notif_expiring',
        type: 'GROUP_EXPIRING',
        group: {
          id: 'grp_1',
          name: 'Midnight Study',
          purpose: 'Study session',
          lifecycleState: 'ACTIVE',
        },
      };
      const { getByText: getByText1 } = render(
        <NotificationCard notification={expiringNotif} onPress={jest.fn()} />,
      );
      expect(getByText1('Space Expiring Soon')).toBeTruthy();
      expect(getByText1('"Midnight Study" is approaching scheduled dissolution.')).toBeTruthy();

      const expiredNotif: NotificationRecord = {
        ...baseNotification,
        id: 'notif_expired',
        type: 'GROUP_EXPIRED',
        group: {
          id: 'grp_1',
          name: 'Midnight Study',
          purpose: 'Study session',
          lifecycleState: 'EXPIRED',
        },
      };
      const { getByText: getByText2 } = render(
        <NotificationCard notification={expiredNotif} onPress={jest.fn()} />,
      );
      expect(getByText2('Space Concluded')).toBeTruthy();
      expect(getByText2('"Midnight Study" has expired and records are archived.')).toBeTruthy();
    });

    it('renders MESSAGE_MENTION correctly', () => {
      const notif: NotificationRecord = {
        ...baseNotification,
        id: 'notif_mention',
        type: 'MESSAGE_MENTION',
        group: {
          id: 'grp_chat',
          name: 'Core Sync',
          purpose: 'Dev standup',
          lifecycleState: 'ACTIVE',
        },
      };
      const { getByText } = render(
        <NotificationCard notification={notif} onPress={jest.fn()} />,
      );

      expect(getByText('Chat Mention')).toBeTruthy();
      expect(getByText('Sam Developer mentioned you in "Core Sync".')).toBeTruthy();
    });

    it('falls back to custom payload title and body for custom notifications', () => {
      const notif: NotificationRecord = {
        ...baseNotification,
        id: 'notif_custom',
        type: 'EVENT_REMINDER',
        payload: {
          title: 'System Notice',
          body: 'Maintenance will start shortly.',
        },
      };
      const { getByText } = render(
        <NotificationCard notification={notif} onPress={jest.fn()} />,
      );

      expect(getByText('System Notice')).toBeTruthy();
      expect(getByText('Maintenance will start shortly.')).toBeTruthy();
    });
  });
});
