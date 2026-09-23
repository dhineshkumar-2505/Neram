import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { MAP_CONFIG } from '../config/mapConfig';
import { locationSessionService } from '../services/locationSessionService';
import type {
  InterpolatedCoordinate,
  LocationUser,
  MemberLocationRecord,
  MovementState,
} from '../types';
import { interpolateCoordinate, shouldSnapDistance } from '../utils/interpolateLocation';
import { isLocationStale } from '../utils/locationFreshness';

export interface UseRealtimeLocationsResult {
  locations: MemberLocationRecord[];
  locationsMap: Record<string, MemberLocationRecord>;
  isLoading: boolean;
  isConnected: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

interface ActiveTransition {
  from: InterpolatedCoordinate;
  to: InterpolatedCoordinate;
  startTime: number;
  durationMs: number;
}

interface RawLocationPayloadRow {
  session_id: string;
  user_id: string;
  latitude: number | string;
  longitude: number | string;
  accuracy: number | string;
  speed?: number | string | null;
  heading?: number | string | null;
  recorded_at: string;
}

/**
 * Derives instantaneous movement state from reported speed in m/s.
 */
function deriveMovementFromSpeed(speedMps?: number | null): MovementState {
  if (speedMps == null || Number.isNaN(speedMps) || speedMps < 0.8) {
    return 'STATIONARY';
  }
  if (speedMps >= 5.5) {
    return 'DRIVING';
  }
  return 'WALKING';
}

export function useRealtimeLocations(
  sessionId: string | null | undefined,
  currentUserId?: string,
): UseRealtimeLocationsResult {
  const [locationsMap, setLocationsMap] = useState<Record<string, MemberLocationRecord>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cached user profiles mapped by userId to preserve display name/avatar across payloads
  const userProfilesRef = useRef<Record<string, LocationUser>>({});
  // In-flight coordinate transitions for smooth linear spherical lerp
  const transitionsRef = useRef<Record<string, ActiveTransition>>({});
  const animFrameIdRef = useRef<number | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Stop animation loop
  const stopAnimationLoop = useCallback(() => {
    if (animFrameIdRef.current !== null) {
      cancelAnimationFrame(animFrameIdRef.current);
      animFrameIdRef.current = null;
    }
  }, []);

  // Frame tick for coordinate interpolation
  const stepInterpolation = useCallback(() => {
    const now = Date.now();
    let hasActiveTransitions = false;

    setLocationsMap((prev) => {
      let changed = false;
      const updated = { ...prev };

      for (const [userId, transition] of Object.entries(transitionsRef.current)) {
        const elapsed = now - transition.startTime;
        const progress = Math.min(1, elapsed / transition.durationMs);

        const currentCoord = interpolateCoordinate(
          transition.from,
          transition.to,
          progress,
        );

        if (updated[userId]) {
          updated[userId] = {
            ...updated[userId],
            interpolated: currentCoord,
          };
          changed = true;
        }

        if (progress >= 1) {
          delete transitionsRef.current[userId];
        } else {
          hasActiveTransitions = true;
        }
      }

      return changed ? updated : prev;
    });

    if (hasActiveTransitions) {
      animFrameIdRef.current = requestAnimationFrame(stepInterpolation);
    } else {
      animFrameIdRef.current = null;
    }
  }, []);

  const triggerInterpolation = useCallback(
    (userId: string, fromCoord: InterpolatedCoordinate, toCoord: InterpolatedCoordinate) => {
      // If jump exceeds snap threshold, immediately snap without animating
      if (shouldSnapDistance(fromCoord, toCoord)) {
        setLocationsMap((prev) => {
          if (!prev[userId]) return prev;
          return {
            ...prev,
            [userId]: {
              ...prev[userId],
              interpolated: { ...toCoord },
            },
          };
        });
        delete transitionsRef.current[userId];
        return;
      }

      transitionsRef.current[userId] = {
        from: fromCoord,
        to: toCoord,
        startTime: Date.now(),
        durationMs: MAP_CONFIG.INTERPOLATION_DURATION_MS,
      };

      if (animFrameIdRef.current === null) {
        animFrameIdRef.current = requestAnimationFrame(stepInterpolation);
      }
    },
    [stepInterpolation],
  );

  // Initial fetch and manual refresh
  const fetchLocations = useCallback(async () => {
    if (!sessionId) {
      if (isMountedRef.current) setLocationsMap({});
      return;
    }

    try {
      if (isMountedRef.current) {
        setIsLoading(true);
        setError(null);
      }

      const result = await locationSessionService.getCurrentLocations(sessionId);
      if (result.error) {
        throw new Error(result.error);
      }

      const map: Record<string, MemberLocationRecord> = {};
      const now = Date.now();

      for (const loc of result.locations) {
        if (loc.user) {
          userProfilesRef.current[loc.userId] = loc.user;
        }

        const isStale = isLocationStale(loc.recordedAt, MAP_CONFIG.STALE_THRESHOLD_MS, now);
        const movementState = deriveMovementFromSpeed(loc.speed);

        map[loc.userId] = {
          ...loc,
          movementState,
          isStale,
          isCurrentUser: loc.userId === currentUserId,
          interpolated: {
            latitude: loc.latitude,
            longitude: loc.longitude,
          },
        };
      }

      if (isMountedRef.current) {
        setLocationsMap(map);
      }
    } catch (err: unknown) {
      if (isMountedRef.current) {
        const msg = err instanceof Error ? err.message : 'Failed to fetch location records';
        setError(msg);
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [sessionId, currentUserId]);

  useEffect(() => {
    fetchLocations();
    return () => {
      stopAnimationLoop();
    };
  }, [fetchLocations, stopAnimationLoop]);

  // Periodic staleness check every 30s
  useEffect(() => {
    if (!sessionId) return;

    const intervalId = setInterval(() => {
      setLocationsMap((prev) => {
        const now = Date.now();
        let changed = false;
        const next = { ...prev };

        for (const [userId, record] of Object.entries(next)) {
          const stale = isLocationStale(record.recordedAt, MAP_CONFIG.STALE_THRESHOLD_MS, now);
          if (stale !== record.isStale) {
            next[userId] = { ...record, isStale: stale };
            changed = true;
          }
        }

        return changed ? next : prev;
      });
    }, 30000);

    return () => clearInterval(intervalId);
  }, [sessionId]);

  // Supabase Realtime subscription
  useEffect(() => {
    if (!sessionId) {
      setIsConnected(false);
      return;
    }

    const channelName = `realtime-locations-${sessionId}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'current_locations',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const oldRecord = payload.old as Partial<RawLocationPayloadRow> & { userId?: string };
            const targetUserId = oldRecord.userId || oldRecord.user_id;
            if (targetUserId) {
              setLocationsMap((prev) => {
                const next = { ...prev };
                delete next[targetUserId];
                return next;
              });
              delete transitionsRef.current[targetUserId];
            }
            return;
          }

          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const row = payload.new as RawLocationPayloadRow;
            const userId = row.user_id;
            const lat = Number(row.latitude);
            const lng = Number(row.longitude);
            const accuracy = Number(row.accuracy);
            const speed = row.speed != null ? Number(row.speed) : null;
            const heading = row.heading != null ? Number(row.heading) : null;
            const recordedAt = row.recorded_at;

            const cachedProfile = userProfilesRef.current[userId];
            const isStale = isLocationStale(recordedAt);
            const movementState = deriveMovementFromSpeed(speed);

            setLocationsMap((prev) => {
              const existing = prev[userId];
              const fromCoord: InterpolatedCoordinate = existing?.interpolated ||
                (existing ? { latitude: existing.latitude, longitude: existing.longitude } : { latitude: lat, longitude: lng });
              const toCoord: InterpolatedCoordinate = { latitude: lat, longitude: lng };

              const updatedRecord: MemberLocationRecord = {
                sessionId,
                userId,
                latitude: lat,
                longitude: lng,
                accuracy,
                speed,
                heading,
                recordedAt,
                user: existing?.user || cachedProfile,
                movementState,
                isStale,
                isCurrentUser: userId === currentUserId,
                interpolated: fromCoord,
              };

              // Schedule coordinate lerp animation
              triggerInterpolation(userId, fromCoord, toCoord);

              return {
                ...prev,
                [userId]: updatedRecord,
              };
            });
          }
        },
      )
      .subscribe((status) => {
        if (!isMountedRef.current) return;
        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
        } else if (
          status === 'CLOSED' ||
          status === 'CHANNEL_ERROR' ||
          status === 'TIMED_OUT'
        ) {
          setIsConnected(false);
        }
      });

    return () => {
      stopAnimationLoop();
      supabase.removeChannel(channel);
    };
  }, [sessionId, currentUserId, fetchLocations, triggerInterpolation, stopAnimationLoop]);

  const locations = Object.values(locationsMap);

  return {
    locations,
    locationsMap,
    isLoading,
    isConnected,
    error,
    refresh: fetchLocations,
  };
}
