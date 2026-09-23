import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../../../lib/supabase';
import { eventService } from '../services/eventService';
import type {
  EventRecord,
  CreateEventInput,
  UpdateEventInput,
  EventFilterTab,
  EventMutationResult,
} from '../types';

export interface UseEventsResult {
  allEvents: EventRecord[];
  filteredEvents: EventRecord[];
  heroEvent: EventRecord | null;
  activeFilter: EventFilterTab;
  setActiveFilter: (filter: EventFilterTab) => void;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  counts: {
    all: number;
    upcoming: number;
    milestones: number;
    past: number;
  };
  refresh: () => Promise<void>;
  createEvent: (input: Omit<CreateEventInput, 'groupId'>) => Promise<EventMutationResult>;
  updateEvent: (eventId: string, input: UpdateEventInput) => Promise<EventMutationResult>;
  deleteEvent: (eventId: string) => Promise<EventMutationResult>;
}

export function useEvents(groupId: string | undefined, currentUserId?: string): UseEventsResult {
  const [allEvents, setAllEvents] = useState<EventRecord[]>([]);
  const [activeFilter, setActiveFilter] = useState<EventFilterTab>('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isMountedRef = useRef(true);

  // Load events from database
  const loadEvents = useCallback(async () => {
    if (!groupId) {
      if (isMountedRef.current) {
        setAllEvents([]);
        setIsLoading(false);
      }
      return;
    }

    try {
      const res = await eventService.fetchEvents(groupId, currentUserId);
      if (!isMountedRef.current) return;

      if (res.error) {
        setError(res.error);
      } else {
        setAllEvents(res.events);
        setError(null);
      }
    } catch (err: unknown) {
      if (!isMountedRef.current) return;
      const message = err instanceof Error ? err.message : 'Failed to load itinerary events.';
      setError(message);
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
    loadEvents();

    return () => {
      isMountedRef.current = false;
    };
  }, [loadEvents]);

  // Realtime subscription setup
  useEffect(() => {
    if (!groupId) return;

    const channelName = `group-events-${groupId}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'events',
          filter: `group_id=eq.${groupId}`,
        },
        async (payload) => {
          if (!isMountedRef.current) return;

          if (payload.eventType === 'INSERT') {
            const newEventRes = await eventService.fetchEvent(payload.new.id, currentUserId);
            if (isMountedRef.current && newEventRes.event) {
              setAllEvents((prev) => {
                if (prev.some((e) => e.id === newEventRes.event?.id)) return prev;
                const next = [...prev, newEventRes.event!];
                return next.sort(
                  (a, b) => new Date(a.targetTime).getTime() - new Date(b.targetTime).getTime(),
                );
              });
            }
          } else if (payload.eventType === 'UPDATE') {
            const updatedEventRes = await eventService.fetchEvent(payload.new.id, currentUserId);
            if (isMountedRef.current && updatedEventRes.event) {
              setAllEvents((prev) => {
                const updatedList = prev.map((e) =>
                  e.id === updatedEventRes.event?.id ? updatedEventRes.event! : e,
                );
                return updatedList.sort(
                  (a, b) => new Date(a.targetTime).getTime() - new Date(b.targetTime).getTime(),
                );
              });
            }
          } else if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as { id?: string })?.id;
            if (deletedId) {
              setAllEvents((prev) => prev.filter((e) => e.id !== deletedId));
            }
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId, currentUserId]);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadEvents();
  }, [loadEvents]);

  // Hero event calculation: earliest upcoming milestone, or earliest upcoming event
  const heroEvent = useMemo(() => {
    const now = Date.now();
    const upcomingEvents = allEvents.filter((e) => new Date(e.targetTime).getTime() > now);

    if (upcomingEvents.length === 0) {
      return null;
    }

    // Prioritize upcoming milestone
    const upcomingMilestone = upcomingEvents.find((e) => e.isMilestone);
    if (upcomingMilestone) {
      return upcomingMilestone;
    }

    // Otherwise earliest upcoming event
    return upcomingEvents[0] || null;
  }, [allEvents]);

  // Counts for tabs
  const counts = useMemo(() => {
    const now = Date.now();
    let upcoming = 0;
    let milestones = 0;
    let past = 0;

    for (const e of allEvents) {
      const isUp = new Date(e.targetTime).getTime() > now;
      if (isUp) upcoming++;
      else past++;
      if (e.isMilestone) milestones++;
    }

    return {
      all: allEvents.length,
      upcoming,
      milestones,
      past,
    };
  }, [allEvents]);

  // Filtered events
  const filteredEvents = useMemo(() => {
    const now = Date.now();
    switch (activeFilter) {
      case 'UPCOMING':
        return allEvents.filter((e) => new Date(e.targetTime).getTime() > now);
      case 'MILESTONES':
        return allEvents.filter((e) => e.isMilestone);
      case 'PAST':
        return allEvents
          .filter((e) => new Date(e.targetTime).getTime() <= now)
          .sort((a, b) => new Date(b.targetTime).getTime() - new Date(a.targetTime).getTime());
      case 'ALL':
      default:
        return allEvents;
    }
  }, [allEvents, activeFilter]);

  const createEvent = useCallback(
    async (input: Omit<CreateEventInput, 'groupId'>): Promise<EventMutationResult> => {
      if (!groupId) {
        return { success: false, error: 'Group ID is missing.' };
      }
      const res = await eventService.createEvent(
        {
          ...input,
          groupId,
        },
        currentUserId,
      );

      if (res.success && res.event && isMountedRef.current) {
        setAllEvents((prev) => {
          if (prev.some((e) => e.id === res.event?.id)) return prev;
          const next = [...prev, res.event!];
          return next.sort(
            (a, b) => new Date(a.targetTime).getTime() - new Date(b.targetTime).getTime(),
          );
        });
      }

      return res;
    },
    [groupId, currentUserId],
  );

  const updateEvent = useCallback(
    async (eventId: string, input: UpdateEventInput): Promise<EventMutationResult> => {
      const res = await eventService.updateEvent(eventId, input);

      if (res.success && res.event && isMountedRef.current) {
        setAllEvents((prev) => {
          const next = prev.map((e) => (e.id === res.event?.id ? res.event! : e));
          return next.sort(
            (a, b) => new Date(a.targetTime).getTime() - new Date(b.targetTime).getTime(),
          );
        });
      }

      return res;
    },
    [],
  );

  const deleteEvent = useCallback(
    async (eventId: string): Promise<EventMutationResult> => {
      const res = await eventService.deleteEvent(eventId);

      if (res.success && isMountedRef.current) {
        setAllEvents((prev) => prev.filter((e) => e.id !== eventId));
      }

      return res;
    },
    [],
  );

  return {
    allEvents,
    filteredEvents,
    heroEvent,
    activeFilter,
    setActiveFilter,
    isLoading,
    isRefreshing,
    error,
    counts,
    refresh,
    createEvent,
    updateEvent,
    deleteEvent,
  };
}

export default useEvents;
