import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, Pressable, Animated } from 'react-native';
import { tokens } from '../../../design';
import Text from '../../../components/Text';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import { CheckIcon, ClockIcon, ReplyIcon, TrashIcon } from './ChatIcons';
import type { ChatMessage } from '../types';

export interface MessageBubbleProps {
  message: ChatMessage;
  isCurrentUser: boolean;
  onReply?: (message: ChatMessage) => void;
  onDelete?: (messageId: string) => void;
  onRetry?: (message: ChatMessage) => void;
}

/**
 * Formats ISO date string to localized HH:MM time.
 */
export function formatMessageTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  } catch {
    return '';
  }
}

/**
 * Ephemeral message bubble adhering to the Obsidian Dark design system.
 * Differentiates Outgoing (Indigo accent) and Incoming (Obsidian slate surface).
 */
export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isCurrentUser,
  onReply,
  onDelete,
  onRetry,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const fadeAnim = useRef(new Animated.Value(prefersReducedMotion ? 1 : 0)).current;
  const transY = useRef(new Animated.Value(prefersReducedMotion ? 0 : 6)).current;

  useEffect(() => {
    if (prefersReducedMotion) {
      fadeAnim.setValue(1);
      transY.setValue(0);
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(transY, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [prefersReducedMotion, fadeAnim, transY]);

  const timeFormatted = formatMessageTime(message.createdAt);
  const senderName =
    message.sender?.displayName ||
    (message.sender?.username ? `@${message.sender.username}` : 'Member');

  const isPending = message.status === 'PENDING';
  const isFailed = message.status === 'FAILED';

  return (
    <Animated.View
      style={[
        styles.rowContainer,
        isCurrentUser ? styles.rowOutgoing : styles.rowIncoming,
        {
          opacity: fadeAnim,
          transform: [{ translateY: transY }],
        },
      ]}
      testID={`message-bubble-${message.id}`}
    >
      <View
        style={[
          styles.bubbleContainer,
          isCurrentUser ? styles.bubbleOutgoing : styles.bubbleIncoming,
        ]}
      >
        {/* Incoming Sender Name */}
        {!isCurrentUser && (
          <Text variant="caption" weight="semibold" style={styles.senderName}>
            {senderName}
          </Text>
        )}

        {/* Embedded Reply Parent Quote */}
        {message.replyTo && (
          <View
            style={[
              styles.replyQuoteContainer,
              isCurrentUser
                ? styles.replyQuoteOutgoing
                : styles.replyQuoteIncoming,
            ]}
          >
            <View
              style={[
                styles.replyQuoteAccent,
                { backgroundColor: isCurrentUser ? '#A5B4FC' : '#818CF8' },
              ]}
            />
            <View style={styles.replyQuoteContent}>
              <Text
                variant="caption"
                weight="semibold"
                style={[
                  styles.replyQuoteAuthor,
                  { color: isCurrentUser ? '#E0E7FF' : '#818CF8' },
                ]}
                numberOfLines={1}
              >
                {message.replyTo.senderName ||
                  (message.replyTo.senderUsername
                    ? `@${message.replyTo.senderUsername}`
                    : 'Member')}
              </Text>
              <Text
                variant="caption"
                style={[
                  styles.replyQuoteBody,
                  {
                    color: isCurrentUser
                      ? 'rgba(255, 255, 255, 0.85)'
                      : '#94A3B8',
                  },
                ]}
                numberOfLines={1}
              >
                {message.replyTo.body}
              </Text>
            </View>
          </View>
        )}

        {/* Message Body Content */}
        <Text
          variant="body"
          style={[
            styles.bodyText,
            isCurrentUser ? styles.bodyOutgoing : styles.bodyIncoming,
          ]}
        >
          {message.body}
        </Text>

        {/* Footer Meta: Timestamp & Delivery Status */}
        <View style={styles.metaRow}>
          {message.editedAt && (
            <Text
              variant="caption"
              style={[
                styles.metaTime,
                isCurrentUser ? styles.metaTimeOutgoing : styles.metaTimeIncoming,
              ]}
            >
              edited •{' '}
            </Text>
          )}

          <Text
            variant="caption"
            style={[
              styles.metaTime,
              isCurrentUser ? styles.metaTimeOutgoing : styles.metaTimeIncoming,
            ]}
          >
            {timeFormatted}
          </Text>

          {isCurrentUser && (
            <View style={styles.statusIconContainer}>
              {isPending && <ClockIcon size={12} color="rgba(255, 255, 255, 0.6)" />}
              {message.status === 'SENT' && (
                <CheckIcon size={13} color="rgba(255, 255, 255, 0.85)" />
              )}
              {isFailed && (
                <Pressable
                  onPress={() => onRetry?.(message)}
                  accessibilityRole="button"
                  accessibilityLabel="Retry sending message"
                >
                  <Text variant="caption" weight="bold" style={styles.retryText}>
                    Retry
                  </Text>
                </Pressable>
              )}
            </View>
          )}
        </View>
      </View>

      {/* Quick Action Buttons */}
      <View
        style={[
          styles.actionsContainer,
          isCurrentUser ? styles.actionsOutgoing : styles.actionsIncoming,
        ]}
      >
        {onReply && (
          <Pressable
            onPress={() => onReply(message)}
            style={styles.actionButton}
            accessibilityRole="button"
            accessibilityLabel={`Reply to ${senderName}`}
            hitSlop={6}
          >
            <ReplyIcon size={16} color="#64748B" />
          </Pressable>
        )}

        {isCurrentUser && onDelete && !isPending && (
          <Pressable
            onPress={() => onDelete(message.id)}
            style={styles.actionButton}
            accessibilityRole="button"
            accessibilityLabel="Delete message"
            hitSlop={6}
          >
            <TrashIcon size={15} color="#64748B" />
          </Pressable>
        )}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  rowContainer: {
    marginVertical: 4,
    paddingHorizontal: tokens.spacing.md,
    flexDirection: 'column',
  },
  rowOutgoing: {
    alignItems: 'flex-end',
  },
  rowIncoming: {
    alignItems: 'flex-start',
  },
  bubbleContainer: {
    maxWidth: '82%',
    borderRadius: 16,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 1,
  },
  bubbleOutgoing: {
    backgroundColor: '#4F46E5', // Obsidian Deep Indigo
    borderBottomRightRadius: 4,
  },
  bubbleIncoming: {
    backgroundColor: '#161F30', // Obsidian Surface
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  senderName: {
    color: '#2DD4BF', // Obsidian Teal
    fontSize: tokens.typography.sizes.caption,
    marginBottom: 3,
  },
  bodyText: {
    fontSize: 15,
    lineHeight: 21,
  },
  bodyOutgoing: {
    color: '#FFFFFF',
  },
  bodyIncoming: {
    color: '#F8FAFC',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  metaTime: {
    fontSize: 11,
  },
  metaTimeOutgoing: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  metaTimeIncoming: {
    color: '#94A3B8',
  },
  statusIconContainer: {
    marginLeft: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  retryText: {
    color: '#FCA5A5',
    fontSize: 11,
    marginLeft: 2,
  },
  replyQuoteContainer: {
    flexDirection: 'row',
    borderRadius: 8,
    padding: 6,
    marginBottom: 6,
  },
  replyQuoteOutgoing: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  replyQuoteIncoming: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  replyQuoteAccent: {
    width: 3,
    borderRadius: 1.5,
    marginRight: 6,
  },
  replyQuoteContent: {
    flex: 1,
  },
  replyQuoteAuthor: {
    fontSize: 12,
    marginBottom: 1,
  },
  replyQuoteBody: {
    fontSize: 12,
  },
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: 8,
  },
  actionsOutgoing: {
    justifyContent: 'flex-end',
    paddingRight: 4,
  },
  actionsIncoming: {
    justifyContent: 'flex-start',
    paddingLeft: 4,
  },
  actionButton: {
    padding: 4,
  },
});

export default MessageBubble;
