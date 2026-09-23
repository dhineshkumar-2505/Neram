/**
 * Chat Feature Domain Types.
 * Strictly aligned with PostgreSQL migrations (public.messages, public.message_attachments).
 */

export type MessageDeliveryStatus = 'PENDING' | 'SENT' | 'FAILED';

export interface SenderProfile {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface ReplyPreview {
  id: string;
  senderId: string;
  body: string;
  senderName?: string;
  senderUsername?: string;
}

export interface ChatAttachment {
  id: string;
  fileId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
}

export interface ChatMessage {
  id: string;
  groupId: string;
  senderId: string;
  body: string;
  replyToId: string | null;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
  sender?: SenderProfile;
  replyTo?: ReplyPreview | null;
  attachments?: ChatAttachment[];
  status?: MessageDeliveryStatus;
  tempId?: string;
}

export interface SendMessageInput {
  groupId: string;
  senderId: string;
  body: string;
  replyToId?: string | null;
  tempId?: string;
}

export interface SendMessageResult {
  message: ChatMessage | null;
  tempId?: string;
  error?: string;
}

export interface FetchMessagesOptions {
  groupId: string;
  limit?: number;
  beforeCreatedAt?: string;
}

export interface FetchMessagesResult {
  messages: ChatMessage[];
  hasMore: boolean;
  error?: string;
}

export interface ChatSubscriptionCallbacks {
  onInsert?: (message: ChatMessage) => void;
  onUpdate?: (message: ChatMessage) => void;
  onDelete?: (messageId: string) => void;
  onError?: (error: Error) => void;
}

export interface ChatPresenceState {
  userId: string;
  displayName: string;
  username: string;
  isTyping: boolean;
  onlineAt: string;
  lastTypedAt?: number;
}

export interface UseChatPresenceOptions {
  groupId: string;
  currentUserId: string;
  displayName: string;
  username: string;
}

export interface UseChatPresenceResult {
  typingUsers: ChatPresenceState[];
  typingLabel: string;
  onlineCount: number;
  sendTypingKeystroke: () => void;
  clearTyping: () => void;
}

