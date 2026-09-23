import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../../lib/supabase';
import { locationSessionService } from '../services/locationSessionService';
import type {
  LocationSession,
  SessionParticipant,
  CreateSessionInput,
  LocationSessionResult,
} from '../types';

export interface UseLocationSessionResult {
  activeSession: LocationSession | null;
  participants: SessionParticipant[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  isParticipating: boolean;
  refresh: () => Promise<void>;
  startSession: (
    input: Omit<CreateSessionInput, 'groupId'>,
  ) => Promise<LocationSessionResult>;
  joinSession: () => Promise<{ success: boolean; error?: string }>;
  leaveSession: () => Promise<{ success: boolean; error?: string }>;
  endSession: () => Promise<{ success: boolean; error?: string }>;
}

export function useLocationSession(
  groupId: string | undefined,
  currentUserId?: string,
): UseLocationSessionResult {
  const [activeSession, setActiveSession] = useState<LocationSession | null>(null);
  const [participants, setParticipants] = useState<SessionParticipant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isMountedRef = useRef(true);

  const isParticipating = Boolean(
    activeSession?.isCurrentUserParticipant ||
      (currentUserId &&
        participants.some((p) => p.userId === currentUserId && p.status === 'ACTIVE')),
  );

  // Load session and participants
  const loadSessionData = useCallback(async () => {
    if (!groupId) {
      if (isMountedRef.current) {
        setActiveSession(null);
        setParticipants([]);
        setIsLoading(false);
      }
      return;
    }

    try {
      const res = await locationSessionService.getActiveSession(groupId, currentUserId);
      if (!isMountedRef.current) return;

      if (res.error) {
        setError(res.error);
        setActiveSession(null);
        setParticipants([]);
      } else {
        setError(null);
        setActiveSession(res.session);

        if (res.session) {
          const partRes = await locationSessionService.getSessionParticipants(
            res.session.id,
          );
          if (isMountedRef.current) {
            setParticipants(partRes.participants);
          }
        } else {
          setParticipants([]);
        }
      }
    } catch (err: unknown) {
      if (isMountedRef.current) {
        const message = err instanceof Error ? err.message : 'Failed to synchronize location session.';
        setError(message);
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [groupId, currentUserId]);

  useEffect(() => {
    isMountedRef.current = true;
    setIsLoading(true);
    loadSessionData();

    return () => {
      isMountedRef.current = false;
    };
  }, [loadSessionData]);

  // Realtime subscription to session and participant changes
  useEffect(() => {
    if (!groupId) return;

    const channelName = `group-location-sessions-${groupId}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'location_sessions',
          filter: `group_id=eq.${groupId}`,
        },
        () => {
          loadSessionData();
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'location_session_participants',
        },
        () => {
          loadSessionData();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId, loadSessionData]);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadSessionData();
  }, [loadSessionData]);

  const startSession = useCallback(
    async (input: Omit<CreateSessionInput, 'groupId'>): Promise<LocationSessionResult> => {
      if (!groupId || !currentUserId) {
        return { session: null, error: 'Authentication and group required.' };
      }

      const res = await locationSessionService.createSession(
        { ...input, groupId },
        currentUserId,
      );

      if (res.session) {
        await loadSessionData();
      }

      return res;
    },
    [groupId, currentUserId, loadSessionData],
  );

  const joinSession = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    if (!activeSession || !currentUserId) {
      return { success: false, error: 'No active session found to join.' };
    }

    const res = await locationSessionService.joinSession(activeSession.id, currentUserId);
    if (res.success) {
      await loadSessionData();
    }
    return res;
  }, [activeSession, currentUserId, loadSessionData]);

  const leaveSession = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    if (!activeSession || !currentUserId) {
      return { success: false, error: 'No active session found.' };
    }

    const res = await locationSessionService.leaveSession(activeSession.id, currentUserId);
    if (res.success) {
      await loadSessionData();
    }
    return res;
  }, [activeSession, currentUserId, loadSessionData]);

  const endSession = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    if (!activeSession || !currentUserId) {
      return { success: false, error: 'No active session found.' };
    }

    const res = await locationSessionService.endSession(activeSession.id, currentUserId);
    if (res.success) {
      await loadSessionData();
    }
    return res;
  }, [activeSession, currentUserId, loadSessionData]);

  return {
    activeSession,
    participants,
    isLoading,
    isRefreshing,
    error,
    isParticipating,
    refresh,
    startSession,
    joinSession,
    leaveSession,
    endSession,
  };
}
