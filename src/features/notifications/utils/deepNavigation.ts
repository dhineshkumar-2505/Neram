import { Alert } from 'react-native';
import type { NotificationRecord } from '../types';

export interface NavigationDispatcher {
  navigate: (screen: string, params?: Record<string, unknown>) => void;
}

/**
 * Handles deep navigation routing from notification records to app destinations.
 * Enforces fallback alerts if the referenced space or resource is no longer accessible.
 */
export function handleNotificationDeepNavigation(
  notification: NotificationRecord,
  navigation: NavigationDispatcher,
): void {
  const { type, groupId, group } = notification;

  switch (type) {
    case 'FRIEND_REQUEST':
    case 'FRIEND_ACCEPTED': {
      navigation.navigate('MainTabs', { screen: 'FriendsTab' });
      break;
    }

    case 'GROUP_INVITE':
    case 'GROUP_EXPIRING':
    case 'GROUP_EXPIRED': {
      if (!groupId) {
        Alert.alert(
          'Space Unavailable',
          'This temporary space has concluded its lifecycle or has been purged.',
          [{ text: 'Understood' }],
        );
        return;
      }

      navigation.navigate('GroupDetail', {
        groupId,
        groupName: group?.name,
      });
      break;
    }

    case 'MESSAGE_MENTION': {
      if (!groupId) {
        Alert.alert(
          'Chat Unavailable',
          'The temporary space containing this message has dissolved.',
          [{ text: 'Understood' }],
        );
        return;
      }

      navigation.navigate('Chat', {
        groupId,
        groupName: group?.name,
      });
      break;
    }

    case 'TASK_ASSIGNED':
    case 'TASK_DEADLINE': {
      if (!groupId) {
        Alert.alert(
          'Task Board Unavailable',
          'The temporary space containing this task has dissolved.',
          [{ text: 'Understood' }],
        );
        return;
      }

      navigation.navigate('TaskBoard', {
        groupId,
        groupName: group?.name,
      });
      break;
    }

    case 'EVENT_REMINDER':
    case 'MEETING_APPROACHING':
    case 'MEMBER_ARRIVED': {
      if (groupId) {
        navigation.navigate('GroupDetail', {
          groupId,
          groupName: group?.name,
        });
      } else {
        Alert.alert(
          'Notice',
          'This event is associated with a space that has been dissolved.',
          [{ text: 'Understood' }],
        );
      }
      break;
    }

    default: {
      // Fallback to Friends or Home if unhandled
      navigation.navigate('MainTabs', { screen: 'HomeTab' });
      break;
    }
  }
}
