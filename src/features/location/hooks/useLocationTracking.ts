import { useState, useEffect } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { locationEngine } from '../services/locationEngine';
import type { LocationTrackingState } from '../types';

export function useLocationTracking(
  groupId: string | undefined,
  sessionId: string | undefined,
  isParticipating: boolean,
  isExpired = false,
): LocationTrackingState {
  const { user } = useAuth();
  const currentUserId = user?.id;

  const [state, setState] = useState<LocationTrackingState>(() =>
    locationEngine.getState(),
  );

  // Subscribe to engine state broadcasts
  useEffect(() => {
    const unsubscribe = locationEngine.subscribe(setState);
    return () => {
      unsubscribe();
    };
  }, []);

  // Manage start/stop tracking based on active session, participation, and expiration
  useEffect(() => {
    let isCurrent = true;

    if (
      isParticipating &&
      sessionId &&
      groupId &&
      currentUserId &&
      !isExpired
    ) {
      locationEngine.startTracking(sessionId, groupId, currentUserId).then((res) => {
        if (isCurrent && !res.success && res.error) {
          // Error captured by engine state and broadcast to listeners
        }
      });
    } else {
      locationEngine.stopTracking();
    }

    return () => {
      isCurrent = false;
      locationEngine.stopTracking();
    };
  }, [isParticipating, sessionId, groupId, currentUserId, isExpired]);

  // Handle group expiration signal
  useEffect(() => {
    if (isExpired && groupId) {
      locationEngine.onGroupExpired(groupId);
    }
  }, [isExpired, groupId]);

  return state;
}

export default useLocationTracking;
