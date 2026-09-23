import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import type { EventDestination } from '../types';
import { isValidCoordinate } from '../utils/geoUtils';

interface SessionDestinationFallback {
  destinationLat?: number | null;
  destinationLng?: number | null;
  destinationName?: string | null;
  title?: string | null;
}

export interface UseEventDestinationResult {
  destination: EventDestination | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to discover and track the authoritative destination coordinate for an active outing:
 * 1. Earliest upcoming milestone event with coordinates.
 * 2. Earliest upcoming event with coordinates.
 * 3. Fallback to location session's destination coordinates.
 * 4. Listens to realtime changes on events for the group.
 */
export function useEventDestination(
  groupId: string | null | undefined,
  sessionFallback?: SessionDestinationFallback | null,
): UseEventDestinationResult {
  const [destination, setDestination] = useState<EventDestination | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchDestination = useCallback(async () => {
    if (!groupId) {
      if (isMountedRef.current) setDestination(null);
      return;
    }

    try {
      if (isMountedRef.current) {
        setIsLoading(true);
        setError(null);
      }

      const now = new Date().toISOString();

      // 1. Fetch upcoming events with valid coordinates
      const { data, error: fetchErr } = await supabase
        .from('events')
        .select('id, title, location_name, latitude, longitude, is_milestone, target_time')
        .eq('group_id', groupId)
        .gte('target_time', now)
        .not('latitude', 'is', null)
        .not('longitude', 'is', null)
        .order('target_time', { ascending: true });

      if (fetchErr) {
        throw new Error(fetchErr.message);
      }

      const events = (data || []).filter(
        (ev) =>
          typeof ev.latitude === 'number' &&
          typeof ev.longitude === 'number' &&
          isValidCoordinate(ev.latitude, ev.longitude),
      );

      // Prioritize milestone events
      const milestoneEvent = events.find((ev) => Boolean(ev.is_milestone));
      if (milestoneEvent) {
        setDestination({
          id: milestoneEvent.id,
          title: milestoneEvent.title,
          latitude: Number(milestoneEvent.latitude),
          longitude: Number(milestoneEvent.longitude),
          locationName: milestoneEvent.location_name,
          isMilestone: true,
          targetTime: milestoneEvent.target_time,
          source: 'EVENT_MILESTONE',
        });
        return;
      }

      // Next prioritize earliest upcoming event with coordinates
      const nextEvent = events[0];
      if (nextEvent) {
        setDestination({
          id: nextEvent.id,
          title: nextEvent.title,
          latitude: Number(nextEvent.latitude),
          longitude: Number(nextEvent.longitude),
          locationName: nextEvent.location_name,
          isMilestone: false,
          targetTime: nextEvent.target_time,
          source: 'EVENT',
        });
        return;
      }

      // Fallback: check location session coordinates
      if (
        sessionFallback &&
        sessionFallback.destinationLat != null &&
        sessionFallback.destinationLng != null &&
        isValidCoordinate(
          sessionFallback.destinationLat,
          sessionFallback.destinationLng,
        )
      ) {
        setDestination({
          id: 'session-destination',
          title:
            sessionFallback.destinationName ||
            sessionFallback.title ||
            'Session Destination',
          latitude: Number(sessionFallback.destinationLat),
          longitude: Number(sessionFallback.destinationLng),
          locationName: sessionFallback.destinationName || null,
          isMilestone: false,
          targetTime: null,
          source: 'SESSION_DESTINATION',
        });
        return;
      }

      if (isMountedRef.current) {
        setDestination(null);
      }
    } catch (err: unknown) {
      if (isMountedRef.current) {
        const msg = err instanceof Error ? err.message : 'Failed to resolve destination';
        setError(msg);
      }
      // Fallback to session destination on query error if available
      if (
        sessionFallback &&
        sessionFallback.destinationLat != null &&
        sessionFallback.destinationLng != null &&
        isValidCoordinate(
          sessionFallback.destinationLat,
          sessionFallback.destinationLng,
        )
      ) {
        if (isMountedRef.current) {
          setDestination({
            id: 'session-destination',
            title:
              sessionFallback.destinationName ||
              sessionFallback.title ||
              'Session Destination',
            latitude: Number(sessionFallback.destinationLat),
            longitude: Number(sessionFallback.destinationLng),
            locationName: sessionFallback.destinationName || null,
            isMilestone: false,
            targetTime: null,
            source: 'SESSION_DESTINATION',
          });
        }
      } else {
        if (isMountedRef.current) {
          setDestination(null);
        }
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [
    groupId,
    sessionFallback?.destinationLat,
    sessionFallback?.destinationLng,
    sessionFallback?.destinationName,
    sessionFallback?.title,
  ]);

  useEffect(() => {
    fetchDestination();
  }, [fetchDestination]);

  // Realtime subscription to events for automatic update
  useEffect(() => {
    if (!groupId) return;

    const channelName = `realtime-destination-events-${groupId}`;
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
        () => {
          fetchDestination();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId, fetchDestination]);

  return {
    destination,
    isLoading,
    error,
    refetch: fetchDestination,
  };
}
