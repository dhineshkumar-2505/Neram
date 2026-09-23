import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { tokens } from '../../../design';
import Text from '../../../components/Text';
import { CloseIcon } from './ChatIcons';
import type { ReplyPreview } from '../types';

export interface ReplyPreviewCardProps {
  replyTo: ReplyPreview;
  onDismiss: () => void;
}

/**
 * Threaded message reply preview chip shown above the input bar.
 */
export const ReplyPreviewCard: React.FC<ReplyPreviewCardProps> = ({
  replyTo,
  onDismiss,
}) => {
  const authorName =
    replyTo.senderName ||
    (replyTo.senderUsername ? `@${replyTo.senderUsername}` : 'Member');

  return (
    <View style={styles.container} testID="reply-preview-card">
      <View style={styles.accentBar} />
      <View style={styles.content}>
        <Text variant="caption" weight="semibold" style={styles.replyingTo}>
          Replying to {authorName}
        </Text>
        <Text
          variant="caption"
          style={styles.bodyPreview}
          numberOfLines={2}
          ellipsizeMode="tail"
        >
          {replyTo.body}
        </Text>
      </View>
      <Pressable
        onPress={onDismiss}
        style={styles.closeButton}
        accessibilityRole="button"
        accessibilityLabel="Cancel reply"
        hitSlop={8}
      >
        <CloseIcon size={16} color="#94A3B8" />
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161F30',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.xs,
  },
  accentBar: {
    width: 3,
    height: '100%',
    minHeight: 28,
    backgroundColor: '#818CF8',
    borderRadius: 1.5,
    marginRight: tokens.spacing.sm,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  replyingTo: {
    color: '#818CF8',
    marginBottom: 2,
  },
  bodyPreview: {
    color: '#94A3B8',
  },
  closeButton: {
    padding: tokens.spacing.xs,
    marginLeft: tokens.spacing.sm,
  },
});

export default ReplyPreviewCard;
