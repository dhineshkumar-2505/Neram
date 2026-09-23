import { useCallback, useEffect, useRef, useState } from 'react';
import { ROUTING_CONFIG } from '../config/routingConfig';
import { routingService } from '../services/routingService';
import type {
  CalculatedRoute,
  EventDestination,
  MovementState,
  RouteCoordinate,
  RoutingProfile,
} from '../types';
import { formatDurationEta, formatRoadDistance } from '../utils/formatEta';
import { calculateDistanceMeters, isValidCoordinate } from '../utils/geoUtils';

export interface UseValhallaRouteOptions {
  origin: RouteCoordinate | null | undefined;
  destination: EventDestination | null | undefined;
  movementState?: MovementState;
  sessionId?: string | null;
  isExpired?: boolean;
}

export interface UseValhallaRouteResult {
  route: CalculatedRoute | null;
  distanceMeters: number | null;
  durationSeconds: number | null;
  formattedDistance: string;
  formattedEta: string;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Resolves the appropriate Valhalla routing profile from the user's movement state.
 */
function resolveProfile(movementState?: MovementState, previousProfile: RoutingProfile = 'auto'): RoutingProfile {
  if (movementState === 'WALKING') return 'pedestrian';
  if (movementState === 'DRIVING') return 'auto';
  return previousProfile;
}

export function useValhallaRoute({
  origin,
  destination,
  movementState = 'UNKNOWN',
  sessionId,
  isExpired = false,
}: UseValhallaRouteOptions): UseValhallaRouteResult {
  const [route, setRoute] = useState<CalculatedRoute | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const routeRef = useRef<CalculatedRoute | null>(null);
  const activeProfileRef = useRef<RoutingProfile>('auto');
  const abortControllerRef = useRef<AbortController | null>(null);
  const generationRef = useRef(0);
  const isMountedRef = useRef(true);

  useEffect(() => {
    routeRef.current = route;
  }, [route]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Update target profile based on movement state
  const targetProfile = resolveProfile(movementState, activeProfileRef.current);
  if (targetProfile !== activeProfileRef.current) {
    activeProfileRef.current = targetProfile;
  }

  const computeRoute = useCallback(
    async (force: boolean = false) => {
      if (
        !origin ||
        !destination ||
        (sessionId !== undefined && !sessionId) ||
        isExpired ||
        !isValidCoordinate(origin.latitude, origin.longitude) ||
        !isValidCoordinate(destination.latitude, destination.longitude)
      ) {
        if (isMountedRef.current && routeRef.current !== null) {
          routeRef.current = null;
          setRoute(null);
        }
        return;
      }

      // Check whether recalculation is necessary
      const currentRoute = routeRef.current;
      if (!force && currentRoute) {
        const destMoved =
          calculateDistanceMeters(
            currentRoute.destination.latitude,
            currentRoute.destination.longitude,
            destination.latitude,
            destination.longitude,
          ) > 10;

        const originMoved =
          calculateDistanceMeters(
            currentRoute.origin.latitude,
            currentRoute.origin.longitude,
            origin.latitude,
            origin.longitude,
          ) >= ROUTING_CONFIG.ROUTE_MIN_DISPLACEMENT_METERS;

        const profileChanged = currentRoute.profile !== activeProfileRef.current;
        const isStale = Date.now() - currentRoute.calculatedAt >= ROUTING_CONFIG.ROUTE_STALE_DURATION_MS;

        // Skip recalculation if conditions have not changed significantly
        if (!destMoved && !originMoved && !profileChanged && !isStale) {
          return;
        }
      }

      // Abort previous in-flight request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;
      const currentGeneration = ++generationRef.current;

      try {
        if (isMountedRef.current) {
          setIsLoading(true);
          setError(null);
        }

        const result = await routingService.calculateRoute({
          origin: { latitude: origin.latitude, longitude: origin.longitude },
          destination: { latitude: destination.latitude, longitude: destination.longitude },
          profile: activeProfileRef.current,
          signal: controller.signal,
        });

        // Drop response if generation has progressed, or component unmounted, or session expired
        if (
          !isMountedRef.current ||
          currentGeneration !== generationRef.current ||
          controller.signal.aborted
        ) {
          return;
        }

        if (result.error) {
          setError(result.error);
          // If error occurs, retain previous route if still within bounds, otherwise null
        } else if (result.route) {
          setRoute(result.route);
        }
      } catch (err: unknown) {
        if (!isMountedRef.current || currentGeneration !== generationRef.current) {
          return;
        }
        const msg = err instanceof Error ? err.message : 'Failed to calculate route';
        setError(msg);
      } finally {
        if (isMountedRef.current && currentGeneration === generationRef.current) {
          setIsLoading(false);
        }
      }
    },
    [origin, destination, sessionId, isExpired],
  );

  // Trigger route computation when origin, destination, profile, or session changes
  useEffect(() => {
    if (isExpired || (sessionId !== undefined && !sessionId)) {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (routeRef.current !== null) {
        routeRef.current = null;
        setRoute(null);
      }
      return;
    }

    computeRoute();
  }, [
    origin?.latitude,
    origin?.longitude,
    destination?.id,
    destination?.latitude,
    destination?.longitude,
    movementState,
    sessionId,
    isExpired,
    computeRoute,
  ]);

  const distanceMeters = route ? route.distanceMeters : null;
  const durationSeconds = route ? route.durationSeconds : null;
  const formattedDistance = formatRoadDistance(distanceMeters);
  const formattedEta = formatDurationEta(durationSeconds);

  return {
    route,
    distanceMeters,
    durationSeconds,
    formattedDistance,
    formattedEta,
    isLoading,
    error,
    refetch: () => computeRoute(true),
  };
}
