import * as React from 'react';
void React;
import { render, fireEvent } from '@testing-library/react-native';
import { MessageBubble, formatMessageTime } from '../../src/features/chat/components/MessageBubble';
import type { ChatMessage } from '../../src/features/chat/types';

describe('MessageBubble', () => {
  const baseMessage: ChatMessage = {
    id: 'msg_1',
    groupId: 'grp_123',
    senderId: 'usr_peer',
    body: 'Shall we meet at 10 AM?',
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
  };

  describe('formatMessageTime', () => {
    it('formats ISO string correctly or returns empty string on invalid date', () => {
      expect(formatMessageTime('invalid-date')).toBe('');
      const formatted = formatMessageTime('2026-09-23T14:30:00.000Z');
      expect(formatted).toBeTruthy();
    });
  });

  describe('Incoming Messages', () => {
    it('renders sender display name and message body', () => {
      const { getByText, queryByText } = render(
        <MessageBubble message={baseMessage} isCurrentUser={false} />,
      );

      expect(getByText('Alex Rivera')).toBeTruthy();
      expect(getByText('Shall we meet at 10 AM?')).toBeTruthy();
      expect(queryByText('Retry')).toBeNull();
    });

    it('falls back to username if display name is absent', () => {
      const messageWithoutDisplayName: ChatMessage = {
        ...baseMessage,
        sender: {
          userId: 'usr_peer',
          username: 'alex_r',
          displayName: '',
          avatarUrl: null,
        },
      };

      const { getByText } = render(
        <MessageBubble message={messageWithoutDisplayName} isCurrentUser={false} />,
      );

      expect(getByText('@alex_r')).toBeTruthy();
    });
  });

  describe('Outgoing Messages', () => {
    const outgoingMessage: ChatMessage = {
      ...baseMessage,
      senderId: 'usr_me',
      body: 'Yes, 10 AM works perfectly!',
    };

    it('renders outgoing bubble without sender header', () => {
      const { getByText, queryByText } = render(
        <MessageBubble message={outgoingMessage} isCurrentUser={true} />,
      );

      expect(getByText('Yes, 10 AM works perfectly!')).toBeTruthy();
      expect(queryByText('Alex Rivera')).toBeNull();
    });

    it('renders retry button when status is FAILED', () => {
      const failedMessage: ChatMessage = {
        ...outgoingMessage,
        status: 'FAILED',
      };
      const onRetry = jest.fn();

      const { getByText } = render(
        <MessageBubble
          message={failedMessage}
          isCurrentUser={true}
          onRetry={onRetry}
        />,
      );

      const retryBtn = getByText('Retry');
      expect(retryBtn).toBeTruthy();
      fireEvent.press(retryBtn);
      expect(onRetry).toHaveBeenCalledWith(failedMessage);
    });
  });

  describe('Threaded Reply Quotes', () => {
    it('renders embedded parent message quote snippet', () => {
      const replyMessage: ChatMessage = {
        ...baseMessage,
        replyTo: {
          id: 'parent_1',
          senderId: 'usr_parent',
          body: 'Do we have all tickets ready?',
          senderName: 'Priya Kumar',
        },
      };

      const { getByText } = render(
        <MessageBubble message={replyMessage} isCurrentUser={false} />,
      );

      expect(getByText('Priya Kumar')).toBeTruthy();
      expect(getByText('Do we have all tickets ready?')).toBeTruthy();
      expect(getByText('Shall we meet at 10 AM?')).toBeTruthy();
    });
  });

  describe('Interactive Actions', () => {
    it('fires onReply callback when reply button is pressed', () => {
      const onReply = jest.fn();
      const { getByLabelText } = render(
        <MessageBubble
          message={baseMessage}
          isCurrentUser={false}
          onReply={onReply}
        />,
      );

      const replyBtn = getByLabelText('Reply to Alex Rivera');
      fireEvent.press(replyBtn);
      expect(onReply).toHaveBeenCalledWith(baseMessage);
    });

    it('fires onDelete callback when delete button is pressed on own sent message', () => {
      const onDelete = jest.fn();
      const outgoingMessage: ChatMessage = {
        ...baseMessage,
        senderId: 'usr_me',
      };

      const { getByLabelText } = render(
        <MessageBubble
          message={outgoingMessage}
          isCurrentUser={true}
          onDelete={onDelete}
        />,
      );

      const deleteBtn = getByLabelText('Delete message');
      fireEvent.press(deleteBtn);
      expect(onDelete).toHaveBeenCalledWith('msg_1');
    });
  });
});
