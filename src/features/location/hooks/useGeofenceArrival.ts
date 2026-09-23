import { useEffect, useRef, useState } from 'react';
import { ROUTING_CONFIG } from '../config/routingConfig';
import { locationEngine } from '../services/locationEngine';
import { locationSessionService } from '../services/locationSessionService';
import type { EventDestination, RawPositionFix } from '../types';
import { calculateDistanceMeters, isValidCoordinate } from '../utils/geoUtils';

export interface UseGeofenceArrivalOptions {
  currentFix: RawPositionFix | { latitude: number; longitude: number; accuracy?: number | null } | null | undefined;
  destination: EventDestination | null | undefined;
  sessionId?: string | null;
  userId?: string | null;
  isParticipating?: boolean;
  isExpired?: boolean;
  onArrived?: () => void;
}

export interface UseGeofenceArrivalResult {
  hasArrived: boolean;
  distanceToDestinationMeters: number | null;
}

export function useGeofenceArrival({
  currentFix,
  destination,
  sessionId,
  userId,
  isParticipating = false,
  isExpired = false,
  onArrived,
}: UseGeofenceArrivalOptions): UseGeofenceArrivalResult {
  const [hasArrived, setHasArrived] = useState(false);
  const [distanceToDestinationMeters, setDistanceToDestinationMeters] = useState<number | null>(null);

  const isTransitioningRef = useRef(false);
  const hasTriggeredRef = useRef(false);

  useEffect(() => {
    // Reset arrival state if session or user changes
    hasTriggeredRef.current = false;
    isTransitioningRef.current = false;
    setHasArrived(false);
    setDistanceToDestinationMeters(null);
  }, [sessionId, userId]);

  useEffect(() => {
    if (
      !isParticipating ||
      !sessionId ||
      !userId ||
      isExpired ||
      hasTriggeredRef.current ||
      isTransitioningRef.current ||
      !currentFix ||
      !destination ||
      !isValidCoordinate(currentFix.latitude, currentFix.longitude) ||
      !isValidCoordinate(destination.latitude, destination.longitude)
    ) {
      return;
    }

    // Accuracy gate: poor GPS accuracy (> 65m) must not trigger premature false arrival
    if (
      currentFix.accuracy != null &&
      Number.isFinite(currentFix.accuracy) &&
      currentFix.accuracy > ROUTING_CONFIG.GEOFENCE_MAX_ACCURACY_METERS
    ) {
      return;
    }

    // Straight-line physical geodesic distance (Haversine)
    const physicalDistance = calculateDistanceMeters(
      currentFix.latitude,
      currentFix.longitude,
      destination.latitude,
      destination.longitude,
    );

    setDistanceToDestinationMeters(Math.round(physicalDistance));

    // 50-meter geofence arrival detection
    if (physicalDistance <= ROUTING_CONFIG.GEOFENCE_RADIUS_METERS) {
      hasTriggeredRef.current = true;
      isTransitioningRef.current = true;
      setHasArrived(true);

      // 1. Authoritative server update: marks participant 'ARRIVED' and deletes fix
      locationSessionService
        .markParticipantArrived(sessionId, userId)
        .catch(() => {
          // Gracefully handle network errors; DB trigger will enforce on reconnect
        })
        .finally(() => {
          isTransitioningRef.current = false;
        });

      // 2. Shut down hardware GPS watcher immediately (privacy preservation)
      locationEngine.stopTracking();

      // 3. Callback notification
      onArrived?.();
    }
  }, [
    currentFix,
    destination,
    sessionId,
    userId,
    isParticipating,
    isExpired,
    onArrived,
  ]);

  return {
    hasArrived,
    distanceToDestinationMeters,
  };
}
