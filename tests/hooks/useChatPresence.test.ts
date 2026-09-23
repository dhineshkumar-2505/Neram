import { renderHook, act } from '@testing-library/react-native';
import { useChatPresence, formatTypingLabel } from '../../src/features/chat/hooks/useChatPresence';
import { supabase } from '../../src/lib/supabase';
import type { ChatPresenceState } from '../../src/features/chat/types';

jest.mock('../../src/lib/supabase', () => ({
  supabase: {
    channel: jest.fn(),
    removeChannel: jest.fn(),
  },
}));

describe('useChatPresence & formatTypingLabel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('formatTypingLabel pure helper', () => {
    it('returns empty string when no typers exist', () => {
      expect(formatTypingLabel([])).toBe('');
    });

    it('formats single typer correctly', () => {
      expect(formatTypingLabel([{ displayName: 'Alex' }])).toBe('Alex is typing...');
    });

    it('formats two typers correctly (WhatsApp style)', () => {
      expect(
        formatTypingLabel([{ displayName: 'Alex' }, { displayName: 'Priya' }]),
      ).toBe('Alex and Priya are typing...');
    });

    it('formats three typers correctly (WhatsApp style)', () => {
      expect(
        formatTypingLabel([
          { displayName: 'Alex' },
          { displayName: 'Priya' },
          { displayName: 'David' },
        ]),
      ).toBe('Alex, Priya, and 1 other are typing...');
    });

    it('formats four typers correctly', () => {
      expect(
        formatTypingLabel([
          { displayName: 'Alex' },
          { displayName: 'Priya' },
          { displayName: 'David' },
          { displayName: 'Elena' },
        ]),
      ).toBe('Alex, Priya, and 2 others are typing...');
    });

    it('falls back to username or Someone if displayName is missing', () => {
      expect(formatTypingLabel([{ username: 'coder_42' }])).toBe('@coder_42 is typing...');
      expect(formatTypingLabel([{}])).toBe('Someone is typing...');
    });
  });

  describe('useChatPresence Hook', () => {
    let mockPresenceState: Record<string, ChatPresenceState[]> = {};
    const registeredHandlers: Record<string, (payload: unknown) => void> = {};

    const mockChannel = {
      on: jest.fn().mockImplementation((_event, filter, handler) => {
        registeredHandlers[filter.event] = handler;
        return mockChannel;
      }),
      subscribe: jest.fn().mockImplementation((callback) => {
        callback('SUBSCRIBED');
        return mockChannel;
      }),
      track: jest.fn().mockResolvedValue('ok'),
      untrack: jest.fn().mockResolvedValue('ok'),
      presenceState: jest.fn().mockImplementation(() => mockPresenceState),
    };

    beforeEach(() => {
      mockPresenceState = {};
      (supabase.channel as jest.Mock).mockReturnValue(mockChannel);
    });

    it('subscribes to presence channel and tracks initial online presence', () => {
      const { result } = renderHook(() =>
        useChatPresence({
          groupId: 'grp_test',
          currentUserId: 'usr_me',
          displayName: 'Current User',
          username: 'me_dev',
        }),
      );

      expect(supabase.channel).toHaveBeenCalledWith('group-presence-grp_test', {
        config: { presence: { key: 'usr_me' } },
      });
      expect(mockChannel.subscribe).toHaveBeenCalled();
      expect(mockChannel.track).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'usr_me',
          displayName: 'Current User',
          username: 'me_dev',
          isTyping: false,
        }),
      );
      expect(result.current.typingUsers).toEqual([]);
      expect(result.current.typingLabel).toBe('');
    });

    it('filters out current user from typingUsers and aggregates other typers', () => {
      const { result } = renderHook(() =>
        useChatPresence({
          groupId: 'grp_test',
          currentUserId: 'usr_me',
          displayName: 'Current User',
          username: 'me_dev',
        }),
      );

      // Simulate presence sync with current user and peer user typing
      mockPresenceState = {
        usr_me: [
          {
            userId: 'usr_me',
            displayName: 'Current User',
            username: 'me_dev',
            isTyping: true,
            onlineAt: '2026-09-23T10:00:00Z',
          },
        ],
        usr_peer_1: [
          {
            userId: 'usr_peer_1',
            displayName: 'Alex',
            username: 'alex_r',
            isTyping: true,
            onlineAt: '2026-09-23T10:00:00Z',
          },
        ],
      };

      act(() => {
        registeredHandlers['sync']?.({});
      });

      // Local user must not see themselves typing
      expect(result.current.typingUsers).toHaveLength(1);
      expect(result.current.typingUsers[0]?.userId).toBe('usr_peer_1');
      expect(result.current.typingLabel).toBe('Alex is typing...');
      expect(result.current.onlineCount).toBe(2);
    });

    it('broadcasts typing on keystroke and reverts after 2000ms debounce timer', () => {
      const { result } = renderHook(() =>
        useChatPresence({
          groupId: 'grp_test',
          currentUserId: 'usr_me',
          displayName: 'Current User',
          username: 'me_dev',
        }),
      );

      expect(mockChannel.track).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'usr_me',
          isTyping: false,
        }),
      );
      mockChannel.track.mockClear();

      // Keystroke fired
      act(() => {
        result.current.sendTypingKeystroke();
      });

      expect(mockChannel.track).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'usr_me',
          isTyping: true,
        }),
      );

      // Advance time by 1999ms (should not revert yet)
      act(() => {
        jest.advanceTimersByTime(1999);
      });

      expect(mockChannel.track).not.toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'usr_me',
          isTyping: false,
        }),
      );

      // Advance time to 2000ms
      act(() => {
        jest.advanceTimersByTime(1);
      });

      expect(mockChannel.track).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'usr_me',
          isTyping: false,
        }),
      );
    });

    it('clears typing immediately when clearTyping is called', () => {
      const { result } = renderHook(() =>
        useChatPresence({
          groupId: 'grp_test',
          currentUserId: 'usr_me',
          displayName: 'Current User',
          username: 'me_dev',
        }),
      );

      mockChannel.track.mockClear();

      act(() => {
        result.current.sendTypingKeystroke();
      });

      expect(mockChannel.track).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'usr_me',
          isTyping: true,
        }),
      );

      // Immediately clear typing (e.g. on message send)
      act(() => {
        result.current.clearTyping();
      });

      expect(mockChannel.track).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'usr_me',
          isTyping: false,
        }),
      );
    });

    it('untracks and removes channel on unmount', () => {
      const { unmount } = renderHook(() =>
        useChatPresence({
          groupId: 'grp_test',
          currentUserId: 'usr_me',
          displayName: 'Current User',
          username: 'me_dev',
        }),
      );

      unmount();

      expect(mockChannel.untrack).toHaveBeenCalled();
      expect(supabase.removeChannel).toHaveBeenCalledWith(mockChannel);
    });
  });
});
