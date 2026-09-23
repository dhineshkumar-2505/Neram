import React from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  Pressable,
} from 'react-native';
import { tokens } from '../../../design';
import Text from '../../../components/Text';
import { SendIcon, LockIcon } from './ChatIcons';
import ReplyPreviewCard from './ReplyPreviewCard';
import type { ReplyPreview } from '../types';

export interface ChatInputBarProps {
  inputText: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  isExpired?: boolean;
  isSending?: boolean;
  replyTo?: ReplyPreview | null;
  onCancelReply?: () => void;
}

/**
 * Chat input controller with auto-expanding text input, reply chips,
 * and automatic read-only lock banner when the temporary space expires.
 */
export const ChatInputBar: React.FC<ChatInputBarProps> = ({
  inputText,
  onChangeText,
  onSend,
  isExpired = false,
  isSending = false,
  replyTo,
  onCancelReply,
}) => {
  // When space is expired, render persistent read-only banner
  if (isExpired) {
    return (
      <View style={styles.expiredBanner} testID="chat-expired-banner">
        <LockIcon size={18} color="#F59E0B" />
        <Text variant="caption" style={styles.expiredText}>
          This temporary space has expired. Chat history is read-only until scheduled purge.
        </Text>
      </View>
    );
  }

  const isSendDisabled = inputText.trim().length === 0 || isSending;

  return (
    <View style={styles.container} testID="chat-input-bar">
      {/* Threaded Reply Context Banner */}
      {replyTo && onCancelReply && (
        <ReplyPreviewCard replyTo={replyTo} onDismiss={onCancelReply} />
      )}

      <View style={styles.inputRow}>
        <TextInput
          style={styles.textInput}
          value={inputText}
          onChangeText={onChangeText}
          placeholder="Type an ephemeral message..."
          placeholderTextColor="#64748B"
          multiline
          maxLength={4000}
          accessibilityLabel="Message input"
          testID="chat-message-input"
        />

        <Pressable
          onPress={onSend}
          disabled={isSendDisabled}
          style={[
            styles.sendButton,
            isSendDisabled ? styles.sendButtonDisabled : styles.sendButtonActive,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Send message"
          testID="chat-send-button"
        >
          <SendIcon
            size={18}
            color={isSendDisabled ? 'rgba(255, 255, 255, 0.4)' : '#FFFFFF'}
          />
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0D111C',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    gap: tokens.spacing.sm,
  },
  textInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    backgroundColor: '#161F30',
    color: '#F8FAFC',
    borderRadius: 20,
    paddingHorizontal: tokens.spacing.md,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 15,
    lineHeight: 20,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonActive: {
    backgroundColor: '#6366F1',
  },
  sendButtonDisabled: {
    backgroundColor: 'rgba(99, 102, 241, 0.25)',
  },
  expiredBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing.sm,
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(245, 158, 11, 0.25)',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.md,
  },
  expiredText: {
    color: '#F59E0B',
    flex: 1,
    textAlign: 'center',
    lineHeight: 18,
  },
});

export default ChatInputBar;
