import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { tokens } from '../../../design';
import Text from '../../../components/Text';
import {
  FriendRequestIcon,
  FriendAcceptedIcon,
  GroupInviteIcon,
  ExpiringClockIcon,
  ExpiredLockIcon,
  MessageMentionIcon,
} from './NotificationIcons';
import type { NotificationRecord } from '../types';

export interface NotificationCardProps {
  notification: NotificationRecord;
  onPress: (notification: NotificationRecord) => void;
  onDelete?: (notificationId: string) => void;
}

/**
 * Formats ISO timestamp to human-friendly relative duration.
 */
export function formatRelativeTime(isoString: string): string {
  try {
    const timestamp = new Date(isoString).getTime();
    if (isNaN(timestamp)) return '';
    const diffSeconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));

    if (diffSeconds < 60) return 'Just now';
    if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
    if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`;
    if (diffSeconds < 172800) return 'Yesterday';
    return `${Math.floor(diffSeconds / 86400)}d ago`;
  } catch {
    return '';
  }
}

/**
 * Obsidian Dark styled notification item card.
 */
export const NotificationCard: React.FC<NotificationCardProps> = ({
  notification,
  onPress,
}) => {
  const isUnread = !notification.readAt;
  const timeText = formatRelativeTime(notification.createdAt);

  const actorName =
    notification.actor?.displayName ||
    (notification.actor?.username ? `@${notification.actor.username}` : 'A member');

  const groupName =
    notification.group?.name ||
    (notification.payload?.group_name as string) ||
    'Temporary Space';

  let title = 'Activity Notice';
  let body = 'You have a new update in your spaces.';
  let iconComponent = <GroupInviteIcon size={20} color="#818CF8" />;

  switch (notification.type) {
    case 'FRIEND_REQUEST':
      title = 'Friend Request';
      body = `${actorName} sent you a mutual friend request.`;
      iconComponent = <FriendRequestIcon size={20} color="#2DD4BF" />;
      break;

    case 'FRIEND_ACCEPTED':
      title = 'Friend Connected';
      body = `${actorName} accepted your friend request.`;
      iconComponent = <FriendAcceptedIcon size={20} color="#818CF8" />;
      break;

    case 'GROUP_INVITE':
      title = 'Space Invitation';
      body = `You were invited to join "${groupName}".`;
      iconComponent = <GroupInviteIcon size={20} color="#818CF8" />;
      break;

    case 'GROUP_EXPIRING':
      title = 'Space Expiring Soon';
      body = `"${groupName}" is approaching scheduled dissolution.`;
      iconComponent = <ExpiringClockIcon size={20} color="#F59E0B" />;
      break;

    case 'GROUP_EXPIRED':
      title = 'Space Concluded';
      body = `"${groupName}" has expired and records are archived.`;
      iconComponent = <ExpiredLockIcon size={20} color="#EF4444" />;
      break;

    case 'MESSAGE_MENTION':
      title = 'Chat Mention';
      body = `${actorName} mentioned you in "${groupName}".`;
      iconComponent = <MessageMentionIcon size={20} color="#38BDF8" />;
      break;

    default:
      title = (notification.payload?.title as string) || 'System Notice';
      body =
        (notification.payload?.body as string) ||
        'An event occurred in one of your active temporary spaces.';
      iconComponent = <GroupInviteIcon size={20} color="#818CF8" />;
      break;
  }

  return (
    <Pressable
      onPress={() => onPress(notification)}
      style={[
        styles.cardContainer,
        isUnread ? styles.cardUnread : styles.cardRead,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${title}: ${body}`}
      testID={`notification-card-${notification.id}`}
    >
      <View style={styles.iconWrapper}>{iconComponent}</View>

      <View style={styles.contentWrapper}>
        <View style={styles.headerRow}>
          <Text
            variant="caption"
            weight="bold"
            style={[styles.titleText, isUnread && styles.titleUnread]}
            numberOfLines={1}
          >
            {title}
          </Text>
          <Text variant="caption" style={styles.timeText}>
            {timeText}
          </Text>
        </View>

        <Text variant="body" style={styles.bodyText} numberOfLines={2}>
          {body}
        </Text>
      </View>

      {/* Unread Indicator Dot */}
      {isUnread && <View style={styles.unreadDot} testID="unread-dot" />}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: tokens.spacing.md,
    borderRadius: 14,
    marginBottom: tokens.spacing.sm,
    borderWidth: 1,
  },
  cardUnread: {
    backgroundColor: 'rgba(129, 140, 248, 0.06)',
    borderColor: 'rgba(129, 140, 248, 0.25)',
  },
  cardRead: {
    backgroundColor: '#111827',
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  iconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#161F30',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: tokens.spacing.md,
  },
  contentWrapper: {
    flex: 1,
    justifyContent: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  titleText: {
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  titleUnread: {
    color: '#818CF8',
  },
  timeText: {
    color: '#64748B',
    fontSize: 11,
  },
  bodyText: {
    color: '#F8FAFC',
    fontSize: 14,
    lineHeight: 19,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2DD4BF',
    marginLeft: tokens.spacing.sm,
  },
});

export default NotificationCard;
