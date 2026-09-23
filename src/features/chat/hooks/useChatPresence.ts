import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { supabase } from '../../../lib/supabase';
import type {
  ChatPresenceState,
  UseChatPresenceOptions,
  UseChatPresenceResult,
} from '../types';

/**
 * Maximum duration (in ms) a peer can remain in typing state before being
 * automatically evicted as stale (e.g. abrupt network disconnect or app kill).
 */
const MAX_TYPING_AGE_MS = 5000;

/**
 * Validates untrusted realtime presence payload structure.
 */
function isValidPresence(p: unknown): p is ChatPresenceState {
  return (
    typeof p === 'object' &&
    p !== null &&
    typeof (p as ChatPresenceState).userId === 'string' &&
    (p as ChatPresenceState).userId.length > 0
  );
}

/**
 * WhatsApp-style multi-user typing status text generator.
 * Aggregates 1, 2, 3, and 4+ concurrent typers cleanly.
 */
export function formatTypingLabel(
  users: Array<{ displayName?: string; username?: string }>,
): string {
  if (!users || users.length === 0) return '';

  const names = users.map((u) => {
    const display = u.displayName?.trim();
    if (display && display.length > 0) return display;
    const user = u.username?.trim();
    if (user && user.length > 0) return `@${user}`;
    return 'Someone';
  });

  if (names.length === 1) {
    return `${names[0]} is typing...`;
  }
  if (names.length === 2) {
    return `${names[0]} and ${names[1]} are typing...`;
  }
  if (names.length === 3) {
    return `${names[0]}, ${names[1]}, and 1 other are typing...`;
  }

  const remaining = names.length - 2;
  return `${names[0]}, ${names[1]}, and ${remaining} others are typing...`;
}

/**
 * Ephemeral Realtime Chat Presence hook.
 * Manages typing indicators, multi-user aggregation, and room presence.
 * Strictly segregated from physical GPS location coordinates (Law 16).
 */
export function useChatPresence({
  groupId,
  currentUserId,
  displayName,
  username,
}: UseChatPresenceOptions): UseChatPresenceResult {
  const [typingUsers, setTypingUsers] = useState<ChatPresenceState[]>([]);
  const [onlineCount, setOnlineCount] = useState<number>(1);

  // References for debounce timer and channel management
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isCurrentlyTypingRef = useRef<boolean>(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!groupId || !currentUserId) return;

    const channelName = `group-presence-${groupId}`;
    const channel = supabase.channel(channelName, {
      config: { presence: { key: currentUserId } },
    });
    channelRef.current = channel;

    const syncPresenceState = () => {
      try {
        const state = channel.presenceState<ChatPresenceState>();
        const memberMap = new Map<string, ChatPresenceState>();

        // Safely extract and deduplicate members across presence keys
        Object.values(state).forEach((presences) => {
          if (Array.isArray(presences)) {
            for (const p of presences) {
              if (isValidPresence(p)) {
                const existing = memberMap.get(p.userId);
                // Prefer active typing state or newest entry
                if (!existing || (p.isTyping && !existing.isTyping)) {
                  memberMap.set(p.userId, p);
                }
              }
            }
          }
        });

        const allMembers = Array.from(memberMap.values());
        const now = Date.now();

        // Filter out current user and stale typers (> 5s staleness)
        const activeTypers = allMembers.filter((p) => {
          if (p.userId === currentUserId || !p.isTyping) return false;
          if (p.lastTypedAt && now - p.lastTypedAt > MAX_TYPING_AGE_MS) {
            return false;
          }
          return true;
        });

        setTypingUsers(activeTypers);
        setOnlineCount(Math.max(1, allMembers.length));
      } catch (err) {
        if (__DEV__) {
          console.warn('[useChatPresence] sync error:', err);
        }
      }
    };

    channel
      .on('presence', { event: 'sync' }, syncPresenceState)
      .on('presence', { event: 'join' }, syncPresenceState)
      .on('presence', { event: 'leave' }, syncPresenceState)
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          channel
            .track({
              userId: currentUserId,
              displayName,
              username,
              isTyping: false,
              onlineAt: new Date().toISOString(),
            })
            .catch(() => {});
        }
      });

    // Periodic stale typer eviction interval (runs every 2500ms)
    const staleInterval = setInterval(() => {
      syncPresenceState();
    }, 2500);

    // App state listener: clear typing on background; re-track on active
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState.match(/inactive|background/)) {
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = null;
        }
        isCurrentlyTypingRef.current = false;
        if (channelRef.current) {
          channelRef.current
            .track({
              userId: currentUserId,
              displayName,
              username,
              isTyping: false,
              onlineAt: new Date().toISOString(),
            })
            .catch(() => {});
        }
      } else if (nextAppState === 'active') {
        if (channelRef.current) {
          channelRef.current
            .track({
              userId: currentUserId,
              displayName,
              username,
              isTyping: false,
              onlineAt: new Date().toISOString(),
            })
            .catch(() => {});
        }
      }
    };

    const appStateSub = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      clearInterval(staleInterval);
      appStateSub.remove();
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      isCurrentlyTypingRef.current = false;
      channel.untrack().catch(() => {});
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [groupId, currentUserId, displayName, username]);

  /**
   * Broadcasts that current user started typing, with a 2-second debounce timer
   * to automatically reset when keystrokes pause.
   */
  const sendTypingKeystroke = useCallback(() => {
    if (!currentUserId || !channelRef.current) return;

    // Clear existing pending timer
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // If not already marked typing, broadcast isTyping: true with current timestamp
    if (!isCurrentlyTypingRef.current) {
      isCurrentlyTypingRef.current = true;
      channelRef.current
        .track({
          userId: currentUserId,
          displayName,
          username,
          isTyping: true,
          onlineAt: new Date().toISOString(),
          lastTypedAt: Date.now(),
        })
        .catch(() => {});
    }

    // Set 2000ms debounce timer to broadcast isTyping: false
    typingTimeoutRef.current = setTimeout(() => {
      if (isCurrentlyTypingRef.current && channelRef.current) {
        isCurrentlyTypingRef.current = false;
        channelRef.current
          .track({
            userId: currentUserId,
            displayName,
            username,
            isTyping: false,
            onlineAt: new Date().toISOString(),
          })
          .catch(() => {});
      }
    }, 2000);
  }, [currentUserId, displayName, username]);

  /**
   * Immediately clears typing state (e.g. on message send, input cleared, or navigation departure).
   */
  const clearTyping = useCallback(() => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    if (isCurrentlyTypingRef.current && channelRef.current) {
      isCurrentlyTypingRef.current = false;
      channelRef.current
        .track({
          userId: currentUserId,
          displayName,
          username,
          isTyping: false,
          onlineAt: new Date().toISOString(),
        })
        .catch(() => {});
    }
  }, [currentUserId, displayName, username]);

  const typingLabel = useMemo(() => formatTypingLabel(typingUsers), [typingUsers]);

  return {
    typingUsers,
    typingLabel,
    onlineCount,
    sendTypingKeystroke,
    clearTyping,
  };
}

export default useChatPresence;
