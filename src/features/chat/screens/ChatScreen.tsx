import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '../../../design';
import Text from '../../../components/Text';
import { useAuth } from '../../../hooks/useAuth';
import { useGroupLifecycle } from '../../groups/hooks/useGroupLifecycle';
import { groupService } from '../../groups/services/groupService';
import type { GroupDetailedRecord } from '../../groups/types';
import { chatService } from '../services/chatService';
import type { ChatMessage, ReplyPreview } from '../types';
import MessageBubble from '../components/MessageBubble';
import ChatInputBar from '../components/ChatInputBar';
import TypingIndicator from '../components/TypingIndicator';
import { useChatPresence } from '../hooks/useChatPresence';
import type { RootStackScreenProps } from '../../../navigation/types';

export type ChatScreenProps = RootStackScreenProps<'Chat'>;

/**
 * Ephemeral Realtime Chat Screen.
 * Implements virtualized inverted message feed, optimistic dispatch,
 * threaded reply previews, and automatic expiration lockouts.
 */
export const ChatScreen: React.FC<ChatScreenProps> = ({ route, navigation }) => {
  const { groupId, groupName: initialGroupName } = route.params;
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();
  const currentUserId = user?.id || '';

  const [group, setGroup] = useState<GroupDetailedRecord | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [replyTo, setReplyTo] = useState<ReplyPreview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Group lifecycle tracking
  const { isExpired, remainingTime } = useGroupLifecycle(
    group?.starts_at,
    group?.expires_at,
    group?.lifecycle_state || 'ACTIVE',
    groupId,
  );

  // Ephemeral Realtime Presence & Multi-User Typing state
  const { typingLabel, sendTypingKeystroke, clearTyping } = useChatPresence({
    groupId,
    currentUserId,
    displayName: profile?.display_name || user?.email || 'Member',
    username: profile?.username || 'member',
  });

  // Fetch initial group details
  useEffect(() => {
    let isCurrent = true;
    groupService.fetchGroupDetails(groupId).then((res) => {
      if (isCurrent && res.group) {
        setGroup(res.group);
      }
    });
    return () => {
      isCurrent = false;
    };
  }, [groupId]);

  // Initial messages load
  const loadInitialMessages = useCallback(async () => {
    setIsLoading(true);
    const result = await chatService.fetchMessages({ groupId, limit: 30 });
    if (result.error) {
      setErrorBanner(result.error);
    } else {
      setMessages(result.messages);
      setHasMore(result.hasMore);
    }
    setIsLoading(false);
  }, [groupId]);

  useEffect(() => {
    loadInitialMessages();
  }, [loadInitialMessages]);

  // Realtime message subscription
  useEffect(() => {
    const unsubscribe = chatService.subscribeToGroupMessages(groupId, {
      onInsert: (newMessage) => {
        setMessages((prev) => {
          // If message is already present (e.g. from optimistic update), replace it
          const existingIdx = prev.findIndex(
            (m) =>
              m.id === newMessage.id ||
              (m.tempId && newMessage.tempId && m.tempId === newMessage.tempId),
          );
          if (existingIdx >= 0) {
            const next = [...prev];
            next[existingIdx] = newMessage;
            return next;
          }
          // Inverted list: index 0 is the newest message at bottom
          return [newMessage, ...prev];
        });
      },
      onUpdate: (updatedMessage) => {
        setMessages((prev) =>
          prev.map((m) => (m.id === updatedMessage.id ? updatedMessage : m)),
        );
      },
      onDelete: (messageId) => {
        setMessages((prev) => prev.filter((m) => m.id !== messageId));
      },
      onError: (err) => {
        if (__DEV__) {
          console.warn('[ChatScreen] Realtime subscription error:', err.message);
        }
      },
    });

    return () => {
      unsubscribe();
    };
  }, [groupId]);

  // Cursor-based pagination for older messages
  const handleLoadMore = async () => {
    if (isLoadingMore || !hasMore || messages.length === 0) return;

    setIsLoadingMore(true);
    const oldestMessage = messages[messages.length - 1];
    if (!oldestMessage) {
      setIsLoadingMore(false);
      return;
    }

    const result = await chatService.fetchMessages({
      groupId,
      limit: 30,
      beforeCreatedAt: oldestMessage.createdAt,
    });

    if (!result.error) {
      setMessages((prev) => [...prev, ...result.messages]);
      setHasMore(result.hasMore);
    }
    setIsLoadingMore(false);
  };

  // Optimistic message dispatch
  const handleSend = async () => {
    const trimmed = inputText.trim();
    if (trimmed.length === 0 || isSending) return;

    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const optimisticMessage: ChatMessage = {
      id: tempId,
      tempId,
      groupId,
      senderId: currentUserId,
      body: trimmed,
      replyToId: replyTo?.id || null,
      replyTo,
      createdAt: new Date().toISOString(),
      editedAt: null,
      deletedAt: null,
      sender: user
        ? {
            userId: user.id,
            username: profile?.username || 'member',
            displayName: profile?.display_name || 'Member',
            avatarUrl: profile?.avatar_path || null,
          }
        : undefined,
      status: 'PENDING',
    };

    // Optimistically update list
    setMessages((prev) => [optimisticMessage, ...prev]);
    setInputText('');
    const currentReplyTo = replyTo;
    setReplyTo(null);
    setIsSending(true);
    setErrorBanner(null);
    clearTyping();

    const result = await chatService.sendMessage({
      groupId,
      senderId: currentUserId,
      body: trimmed,
      replyToId: currentReplyTo?.id || null,
      tempId,
    });

    setIsSending(false);

    if (result.error || !result.message) {
      setErrorBanner(result.error || 'Failed to deliver message.');
      // Mark as failed
      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempId ? { ...m, status: 'FAILED' } : m,
        ),
      );
    } else {
      // Replace optimistic message with confirmed server row
      const confirmedMessage = result.message;
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? confirmedMessage : m)),
      );
    }
  };

  const handleInitiateReply = (message: ChatMessage) => {
    setReplyTo({
      id: message.id,
      senderId: message.senderId,
      body: message.body,
      senderName: message.sender?.displayName,
      senderUsername: message.sender?.username,
    });
  };

  const handleDeleteMessage = async (messageId: string) => {
    // Optimistically remove from list
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
    await chatService.softDeleteMessage(messageId);
  };

  const displayName = group?.name || initialGroupName || 'Ephemeral Chat';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Obsidian Header Bar */}
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={8}
        >
          <Text variant="title2" style={styles.backText}>
            ‹
          </Text>
        </Pressable>

        <View style={styles.headerTitleContainer}>
          <Text variant="body" weight="bold" style={styles.headerTitle} numberOfLines={1}>
            {displayName}
          </Text>
          <Text variant="caption" style={styles.headerSubtitle}>
            {isExpired
              ? 'EXPIRED • ARCHIVED'
              : `${remainingTime.formattedText} remaining`}
          </Text>
        </View>

        <View style={styles.headerRightSpacer} />
      </View>

      {/* Non-blocking Error Banner */}
      {errorBanner && (
        <View style={styles.errorBanner}>
          <Text variant="caption" style={styles.errorText}>
            {errorBanner}
          </Text>
        </View>
      )}

      {/* Virtualized Message Stream with Keyboard Avoidance */}
      <KeyboardAvoidingView
        style={styles.flexFill}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#818CF8" />
            <Text variant="caption" style={styles.loadingText}>
              Connecting to secure stream...
            </Text>
          </View>
        ) : (
          <FlatList
            data={messages}
            keyExtractor={(item) => item.tempId || item.id}
            renderItem={({ item }) => (
              <MessageBubble
                message={item}
                isCurrentUser={item.senderId === currentUserId}
                onReply={handleInitiateReply}
                onDelete={handleDeleteMessage}
                onRetry={() => {
                  setInputText(item.body);
                  setMessages((prev) => prev.filter((m) => m.id !== item.id));
                }}
              />
            )}
            inverted
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.3}
            ListFooterComponent={
              isLoadingMore ? (
                <View style={styles.footerLoader}>
                  <ActivityIndicator size="small" color="#818CF8" />
                </View>
              ) : null
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text variant="body" weight="semibold" style={styles.emptyTitle}>
                  No messages yet
                </Text>
                <Text variant="caption" style={styles.emptySubtitle}>
                  This is an ephemeral space. All communication dissolves automatically on group
                  expiration.
                </Text>
              </View>
            }
            contentContainerStyle={styles.listContent}
          />
        )}

        {/* Realtime Typing Indicator */}
        <TypingIndicator typingLabel={typingLabel} />

        {/* Input Bar or Expiration Lock Banner */}
        <ChatInputBar
          inputText={inputText}
          onChangeText={(text) => {
            setInputText(text);
            if (text.trim().length === 0) {
              clearTyping();
            } else {
              sendTypingKeystroke();
            }
          }}
          onSend={handleSend}
          isExpired={isExpired}
          isSending={isSending}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
        />
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0F19',
  },
  flexFill: {
    flex: 1,
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.md,
    backgroundColor: '#111827',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  backButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: tokens.spacing.xs,
  },
  backText: {
    color: '#818CF8',
    fontSize: 32,
    lineHeight: 32,
    marginTop: -2,
  },
  headerTitleContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#F8FAFC',
    fontSize: 16,
  },
  headerSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
  },
  headerRightSpacer: {
    width: 36,
  },
  errorBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(239, 68, 68, 0.3)',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.xs,
  },
  errorText: {
    color: '#FCA5A5',
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#94A3B8',
    marginTop: tokens.spacing.sm,
  },
  listContent: {
    paddingVertical: tokens.spacing.sm,
  },
  footerLoader: {
    paddingVertical: tokens.spacing.md,
    alignItems: 'center',
  },
  emptyContainer: {
    padding: tokens.spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ scaleY: -1 }], // Invert for inverted FlatList
  },
  emptyTitle: {
    color: '#F8FAFC',
    marginBottom: tokens.spacing.xs,
    textAlign: 'center',
  },
  emptySubtitle: {
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
  },
});

export default ChatScreen;
