import * as React from 'react';
void React;
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { ChatScreen } from '../../src/features/chat/screens/ChatScreen';
import { chatService } from '../../src/features/chat/services/chatService';
import { groupService } from '../../src/features/groups/services/groupService';
import { useAuth } from '../../src/hooks/useAuth';
import type { ChatMessage, ChatSubscriptionCallbacks } from '../../src/features/chat/types';

jest.mock('../../src/features/chat/services/chatService', () => ({
  chatService: {
    fetchMessages: jest.fn(),
    sendMessage: jest.fn(),
    softDeleteMessage: jest.fn(),
    subscribeToGroupMessages: jest.fn(),
  },
}));

jest.mock('../../src/features/chat/hooks/useChatPresence', () => ({
  useChatPresence: jest.fn().mockReturnValue({
    typingUsers: [],
    typingLabel: '',
    onlineCount: 1,
    sendTypingKeystroke: jest.fn(),
    clearTyping: jest.fn(),
  }),
  formatTypingLabel: jest.fn().mockReturnValue(''),
}));

jest.mock('../../src/features/groups/services/groupService', () => ({
  groupService: {
    fetchGroupDetails: jest.fn(),
  },
}));

jest.mock('../../src/features/groups/hooks/useGroupLifecycle', () => ({
  useGroupLifecycle: jest.fn().mockImplementation((_startsAt, _expiresAt, dbState) => ({
    isExpired: dbState === 'EXPIRED',
    isExpiring: false,
    lifecycleState: dbState || 'ACTIVE',
    remainingTime: {
      days: 0,
      hours: 23,
      minutes: 59,
      seconds: 50,
      totalRemainingSeconds: 86390,
      isExpiring: false,
      isExpired: dbState === 'EXPIRED',
      progressFraction: 0.1,
      formattedText: '23h 59m',
    },
  })),
}));

jest.mock('../../src/hooks/useAuth', () => ({
  useAuth: jest.fn(),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

describe('ChatScreen', () => {
  const mockNavigation = {
    goBack: jest.fn(),
    navigate: jest.fn(),
  };

  const mockRoute = {
    key: 'chat-key',
    name: 'Chat' as const,
    params: {
      groupId: 'grp_chat_1',
      groupName: 'Sprint Hackathon',
    },
  };

  const initialMockMessages: ChatMessage[] = [
    {
      id: 'msg_1',
      groupId: 'grp_chat_1',
      senderId: 'usr_peer',
      body: 'Welcome to the temporary sprint room!',
      replyToId: null,
      createdAt: '2026-09-23T10:00:00.000Z',
      editedAt: null,
      deletedAt: null,
      sender: {
        userId: 'usr_peer',
        username: 'alex_r',
        displayName: 'Alex Rivera',
        avatarUrl: null,
      },
      status: 'SENT',
    },
  ];

  let subscriptionCallbacks: ChatSubscriptionCallbacks = {};
  const mockUnsubscribe = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    subscriptionCallbacks = {};

    (useAuth as jest.Mock).mockReturnValue({
      user: {
        id: 'usr_me',
        username: 'me_dev',
        displayName: 'Lead Developer',
        avatarUrl: null,
      },
    });

    (groupService.fetchGroupDetails as jest.Mock).mockResolvedValue({
      group: {
        id: 'grp_chat_1',
        name: 'Sprint Hackathon',
        purpose: 'HACKATHON',
        lifecycle_state: 'ACTIVE',
        starts_at: '2026-09-23T09:00:00.000Z',
        expires_at: '2026-09-24T09:00:00.000Z',
      },
    });

    (chatService.fetchMessages as jest.Mock).mockResolvedValue({
      messages: initialMockMessages,
      hasMore: false,
    });

    (chatService.subscribeToGroupMessages as jest.Mock).mockImplementation(
      (_groupId, callbacks) => {
        subscriptionCallbacks = callbacks;
        return mockUnsubscribe;
      },
    );
  });

  it('renders chat header and initial message feed', async () => {
    const { getByText } = render(
      <ChatScreen
        navigation={mockNavigation as unknown as Parameters<typeof ChatScreen>[0]['navigation']}
        route={mockRoute}
      />,
    );

    await waitFor(() => {
      expect(getByText('Sprint Hackathon')).toBeTruthy();
      expect(getByText('Welcome to the temporary sprint room!')).toBeTruthy();
    });

    expect(chatService.fetchMessages).toHaveBeenCalledWith({
      groupId: 'grp_chat_1',
      limit: 30,
    });
    expect(chatService.subscribeToGroupMessages).toHaveBeenCalledWith(
      'grp_chat_1',
      expect.any(Object),
    );
  });

  it('navigates back when header back button is pressed', async () => {
    const { getByText, getByLabelText } = render(
      <ChatScreen
        navigation={mockNavigation as unknown as Parameters<typeof ChatScreen>[0]['navigation']}
        route={mockRoute}
      />,
    );

    await waitFor(() => {
      expect(getByText('Sprint Hackathon')).toBeTruthy();
    });

    const backBtn = getByLabelText('Back');
    fireEvent.press(backBtn);
    expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
  });

  it('sends message optimistically and calls chatService.sendMessage', async () => {
    const confirmedMessage: ChatMessage = {
      id: 'msg_confirmed_1',
      groupId: 'grp_chat_1',
      senderId: 'usr_me',
      body: 'I will handle the authentication flow',
      replyToId: null,
      createdAt: '2026-09-23T10:05:00.000Z',
      editedAt: null,
      deletedAt: null,
      status: 'SENT',
    };

    (chatService.sendMessage as jest.Mock).mockResolvedValueOnce({
      message: confirmedMessage,
    });

    const { getByTestId, getByLabelText, getByText } = render(
      <ChatScreen
        navigation={mockNavigation as unknown as Parameters<typeof ChatScreen>[0]['navigation']}
        route={mockRoute}
      />,
    );

    await waitFor(() => {
      expect(getByText('Welcome to the temporary sprint room!')).toBeTruthy();
    });

    const input = getByTestId('chat-message-input');
    fireEvent.changeText(input, 'I will handle the authentication flow');

    const sendBtn = getByLabelText('Send message');
    await act(async () => {
      fireEvent.press(sendBtn);
    });

    expect(chatService.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        groupId: 'grp_chat_1',
        senderId: 'usr_me',
        body: 'I will handle the authentication flow',
      }),
    );

    await waitFor(() => {
      expect(getByText('I will handle the authentication flow')).toBeTruthy();
    });
  });

  it('allows user to initiate and cancel a threaded reply', async () => {
    const { getByLabelText, getByText, queryByTestId } = render(
      <ChatScreen
        navigation={mockNavigation as unknown as Parameters<typeof ChatScreen>[0]['navigation']}
        route={mockRoute}
      />,
    );

    await waitFor(() => {
      expect(getByText('Welcome to the temporary sprint room!')).toBeTruthy();
    });

    // Press reply button on message
    const replyBtn = getByLabelText('Reply to Alex Rivera');
    fireEvent.press(replyBtn);

    // Verify reply card appears
    await waitFor(() => {
      expect(getByText('Replying to Alex Rivera')).toBeTruthy();
    });

    // Cancel reply
    const cancelReplyBtn = getByLabelText('Cancel reply');
    fireEvent.press(cancelReplyBtn);

    expect(queryByTestId('reply-preview-card')).toBeNull();
  });

  it('renders read-only lock banner when temporary space has expired', async () => {
    (groupService.fetchGroupDetails as jest.Mock).mockResolvedValueOnce({
      group: {
        id: 'grp_chat_1',
        name: 'Sprint Hackathon',
        purpose: 'HACKATHON',
        lifecycle_state: 'EXPIRED',
        starts_at: '2026-09-21T09:00:00.000Z',
        expires_at: '2026-09-22T09:00:00.000Z',
      },
    });

    const { getByTestId, queryByTestId, getByText } = render(
      <ChatScreen
        navigation={mockNavigation as unknown as Parameters<typeof ChatScreen>[0]['navigation']}
        route={mockRoute}
      />,
    );

    await waitFor(() => {
      expect(getByTestId('chat-expired-banner')).toBeTruthy();
      expect(
        getByText(
          'This temporary space has expired. Chat history is read-only until scheduled purge.',
        ),
      ).toBeTruthy();
    });

    // Verify input bar is disabled / not rendered
    expect(queryByTestId('chat-message-input')).toBeNull();
  });

  it('dynamically appends incoming Realtime messages and unsubscribes on unmount', async () => {
    const { getByText, unmount } = render(
      <ChatScreen
        navigation={mockNavigation as unknown as Parameters<typeof ChatScreen>[0]['navigation']}
        route={mockRoute}
      />,
    );

    await waitFor(() => {
      expect(getByText('Welcome to the temporary sprint room!')).toBeTruthy();
    });

    // Simulate incoming Realtime message via callback
    const incomingRealtimeMsg: ChatMessage = {
      id: 'msg_realtime_99',
      groupId: 'grp_chat_1',
      senderId: 'usr_peer',
      body: 'Just pushed the updated mockups!',
      replyToId: null,
      createdAt: '2026-09-23T10:10:00.000Z',
      editedAt: null,
      deletedAt: null,
      status: 'SENT',
    };

    act(() => {
      subscriptionCallbacks.onInsert?.(incomingRealtimeMsg);
    });

    await waitFor(() => {
      expect(getByText('Just pushed the updated mockups!')).toBeTruthy();
    });

    // Unmount and check cleanup
    unmount();
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });

  it('renders typing indicator when presence reports peer members typing', async () => {
    const { useChatPresence } = jest.requireMock('../../src/features/chat/hooks/useChatPresence');
    (useChatPresence as jest.Mock).mockReturnValueOnce({
      typingUsers: [{ userId: 'usr_peer', displayName: 'Alex Rivera' }],
      typingLabel: 'Alex Rivera is typing...',
      onlineCount: 2,
      sendTypingKeystroke: jest.fn(),
      clearTyping: jest.fn(),
    });

    const { getByTestId, getByText } = render(
      <ChatScreen
        navigation={mockNavigation as unknown as Parameters<typeof ChatScreen>[0]['navigation']}
        route={mockRoute}
      />,
    );

    await waitFor(() => {
      expect(getByTestId('typing-indicator')).toBeTruthy();
      expect(getByText('Alex Rivera is typing...')).toBeTruthy();
    });
  });
});
