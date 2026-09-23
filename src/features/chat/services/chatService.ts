import { supabase } from '../../../lib/supabase';
import type {
  ChatMessage,
  SendMessageInput,
  SendMessageResult,
  FetchMessagesOptions,
  FetchMessagesResult,
  ChatSubscriptionCallbacks,
  SenderProfile,
  ReplyPreview,
} from '../types';

/**
 * Shape of raw message returned by Supabase queries with joins.
 */
interface RawMessageRow {
  id: string;
  group_id: string;
  sender_id: string;
  body: string;
  reply_to_id: string | null;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
  sender?: {
    user_id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
  } | null;
  reply_to?: {
    id: string;
    sender_id: string;
    body: string;
    sender?: {
      display_name: string;
      username: string;
    } | null;
  } | null;
}

/**
 * Converts a database row with joins into a domain ChatMessage.
 */
function formatMessageRow(row: RawMessageRow): ChatMessage {
  const sender: SenderProfile | undefined = row.sender
    ? {
        userId: row.sender.user_id,
        username: row.sender.username,
        displayName: row.sender.display_name,
        avatarUrl: row.sender.avatar_url,
      }
    : undefined;

  const replyTo: ReplyPreview | null = row.reply_to
    ? {
        id: row.reply_to.id,
        senderId: row.reply_to.sender_id,
        body: row.reply_to.body,
        senderName: row.reply_to.sender?.display_name,
        senderUsername: row.reply_to.sender?.username,
      }
    : null;

  return {
    id: row.id,
    groupId: row.group_id,
    senderId: row.sender_id,
    body: row.body,
    replyToId: row.reply_to_id,
    createdAt: row.created_at,
    editedAt: row.edited_at,
    deletedAt: row.deleted_at,
    sender,
    replyTo,
    status: 'SENT',
  };
}

const MESSAGE_QUERY_SELECT = `
  id,
  group_id,
  sender_id,
  body,
  reply_to_id,
  created_at,
  edited_at,
  deleted_at,
  sender:profiles!messages_sender_id_fkey(user_id, username, display_name, avatar_url),
  reply_to:messages!messages_reply_to_id_fkey(
    id,
    sender_id,
    body,
    sender:profiles!messages_sender_id_fkey(display_name, username)
  )
`;

export const chatService = {
  /**
   * Fetches paginated messages for a group ordered from newest to oldest.
   * Soft-deleted messages are excluded.
   */
  async fetchMessages(options: FetchMessagesOptions): Promise<FetchMessagesResult> {
    try {
      const limit = options.limit || 30;

      let query = supabase
        .from('messages')
        .select(MESSAGE_QUERY_SELECT)
        .eq('group_id', options.groupId)
        .is('deleted_at', null);

      if (options.beforeCreatedAt) {
        query = query.lt('created_at', options.beforeCreatedAt);
      }

      const { data, error } = await query
        .order('created_at', { ascending: false })
        .limit(limit + 1);

      if (error) {
        return { messages: [], hasMore: false, error: error.message };
      }

      const rawRows = (data || []) as unknown as RawMessageRow[];
      const hasMore = rawRows.length > limit;
      const slicedRows = hasMore ? rawRows.slice(0, limit) : rawRows;

      return {
        messages: slicedRows.map(formatMessageRow),
        hasMore,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch messages';
      return { messages: [], hasMore: false, error: message };
    }
  },

  /**
   * Look up a single message by ID with relational sender profile and reply details.
   */
  async fetchMessageById(messageId: string): Promise<ChatMessage | null> {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select(MESSAGE_QUERY_SELECT)
        .eq('id', messageId)
        .single();

      if (error || !data) {
        return null;
      }

      return formatMessageRow(data as unknown as RawMessageRow);
    } catch {
      return null;
    }
  },

  /**
   * Validates and dispatches a message to the group communication stream.
   * Enforces PostgreSQL check constraints (chk_message_body: 1-4000 chars)
   * and handles Row Level Security policy errors (e.g. expired group).
   */
  async sendMessage(input: SendMessageInput): Promise<SendMessageResult> {
    try {
      const trimmedBody = input.body.trim();

      if (trimmedBody.length === 0) {
        return {
          message: null,
          tempId: input.tempId,
          error: 'Message cannot be empty.',
        };
      }

      if (trimmedBody.length > 4000) {
        return {
          message: null,
          tempId: input.tempId,
          error: 'Message cannot exceed 4000 characters.',
        };
      }

      const { data, error } = await supabase
        .from('messages')
        .insert({
          group_id: input.groupId,
          sender_id: input.senderId,
          body: trimmedBody,
          reply_to_id: input.replyToId || null,
        })
        .select(MESSAGE_QUERY_SELECT)
        .single();

      if (error) {
        const errorLower = error.message.toLowerCase();
        // Check for RLS permission denied / check constraint failure
        if (
          error.code === '42501' ||
          error.code === 'PGRST116' ||
          errorLower.includes('policy') ||
          errorLower.includes('permission') ||
          errorLower.includes('violates row-level security')
        ) {
          return {
            message: null,
            tempId: input.tempId,
            error: 'Cannot send message. This temporary space may have expired or chat is disabled.',
          };
        }

        return {
          message: null,
          tempId: input.tempId,
          error: error.message,
        };
      }

      const formatted = formatMessageRow(data as unknown as RawMessageRow);
      return {
        message: formatted,
        tempId: input.tempId,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send message';
      return {
        message: null,
        tempId: input.tempId,
        error: message,
      };
    }
  },

  /**
   * Soft-deletes a message by updating deleted_at timestamp.
   * Enforces that only the sender or group admin can delete via RLS.
   */
  async softDeleteMessage(messageId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('messages')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', messageId);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete message';
      return { success: false, error: message };
    }
  },

  /**
   * Subscribes to Realtime change events on public.messages for the specified group.
   * Automatically enriches INSERT events with sender profile and returns a teardown function.
   */
  subscribeToGroupMessages(
    groupId: string,
    callbacks: ChatSubscriptionCallbacks,
  ): () => void {
    const channelName = `group-chat-${groupId}`;
    const channel = supabase.channel(channelName);

    channel
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `group_id=eq.${groupId}`,
        },
        async (payload) => {
          try {
            const rawNew = payload.new as {
              id: string;
              group_id: string;
              sender_id: string;
              body: string;
              reply_to_id: string | null;
              created_at: string;
              edited_at: string | null;
              deleted_at: string | null;
            };

            if (!rawNew || rawNew.deleted_at) {
              return;
            }

            // Hydrate sender details and relations
            const fullMessage = await chatService.fetchMessageById(rawNew.id);
            if (fullMessage) {
              callbacks.onInsert?.(fullMessage);
            } else {
              // Fallback to basic message if hydration lookup fails
              const fallbackMessage: ChatMessage = {
                id: rawNew.id,
                groupId: rawNew.group_id,
                senderId: rawNew.sender_id,
                body: rawNew.body,
                replyToId: rawNew.reply_to_id,
                createdAt: rawNew.created_at,
                editedAt: rawNew.edited_at,
                deletedAt: rawNew.deleted_at,
                status: 'SENT',
              };
              callbacks.onInsert?.(fallbackMessage);
            }
          } catch (err) {
            callbacks.onError?.(err instanceof Error ? err : new Error('Realtime insert error'));
          }
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `group_id=eq.${groupId}`,
        },
        async (payload) => {
          try {
            const rawNew = payload.new as {
              id: string;
              deleted_at: string | null;
            };

            if (!rawNew) return;

            // If message was soft-deleted, notify onDelete
            if (rawNew.deleted_at) {
              callbacks.onDelete?.(rawNew.id);
              return;
            }

            // Hydrate updated message
            const updated = await chatService.fetchMessageById(rawNew.id);
            if (updated) {
              callbacks.onUpdate?.(updated);
            }
          } catch (err) {
            callbacks.onError?.(err instanceof Error ? err : new Error('Realtime update error'));
          }
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'messages',
          filter: `group_id=eq.${groupId}`,
        },
        (payload) => {
          try {
            const rawOld = payload.old as { id: string };
            if (rawOld?.id) {
              callbacks.onDelete?.(rawOld.id);
            }
          } catch (err) {
            callbacks.onError?.(err instanceof Error ? err : new Error('Realtime delete error'));
          }
        },
      )
      .subscribe((_status, err) => {
        if (err) {
          callbacks.onError?.(err);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  },
};

export default chatService;
