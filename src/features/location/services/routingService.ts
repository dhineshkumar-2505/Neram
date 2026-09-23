import { ROUTING_CONFIG } from '../config/routingConfig';
import type {
  CalculateRouteOptions,
  CalculatedRoute,
  RouteCalculationResult,
  RoutingProfile,
} from '../types';
import { isValidCoordinate } from '../utils/geoUtils';
import { decodePolyline } from '../utils/polylineDecoder';

interface ValhallaSummary {
  time?: number; // seconds
  length?: number; // kilometers
}

interface ValhallaLeg {
  shape?: string;
  summary?: ValhallaSummary;
}

interface ValhallaTrip {
  status?: number;
  status_message?: string;
  summary?: ValhallaSummary;
  legs?: ValhallaLeg[];
}

interface ValhallaResponse {
  trip?: ValhallaTrip;
  error?: string;
  error_code?: number;
}

export class RoutingService {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || ROUTING_CONFIG.VALHALLA_BASE_URL;
  }

  /**
   * Calculates a road route from origin to destination using Valhalla.
   * Includes input validation, timeout handling, retries, and polyline decoding.
   */
  async calculateRoute(options: CalculateRouteOptions): Promise<RouteCalculationResult> {
    const { origin, destination, profile = 'auto', signal } = options;

    // 1. Validate coordinates
    if (!origin || !isValidCoordinate(origin.latitude, origin.longitude)) {
      return { route: null, error: 'Invalid route origin coordinates.' };
    }

    if (!destination || !isValidCoordinate(destination.latitude, destination.longitude)) {
      return { route: null, error: 'Invalid route destination coordinates.' };
    }

    const valhallaProfile: RoutingProfile =
      profile === 'pedestrian' ? 'pedestrian' : profile === 'bicycle' ? 'bicycle' : 'auto';

    const requestPayload = {
      locations: [
        { lat: origin.latitude, lon: origin.longitude },
        { lat: destination.latitude, lon: destination.longitude },
      ],
      costing: valhallaProfile,
      directions_options: {
        units: 'kilometers',
      },
    };

    let attempts = 0;
    const maxAttempts = 1 + ROUTING_CONFIG.MAX_RETRIES;

    while (attempts < maxAttempts) {
      attempts++;
      try {
        // Build request with timeout abort
        const timeoutController = new AbortController();
        const timeoutId = setTimeout(() => {
          timeoutController.abort();
        }, ROUTING_CONFIG.REQUEST_TIMEOUT_MS);

        // Combined abort signal
        const effectiveSignal = signal
          ? anySignal([signal, timeoutController.signal])
          : timeoutController.signal;

        const response = await fetch(this.baseUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(requestPayload),
          signal: effectiveSignal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const statusText = response.statusText || `HTTP ${response.status}`;
          throw new Error(`Valhalla routing error: ${statusText}`);
        }

        const data: ValhallaResponse = await response.json();

        if (data.error || !data.trip || !data.trip.legs || data.trip.legs.length === 0) {
          const errMessage = data.error || data.trip?.status_message || 'No valid route found.';
          return { route: null, error: errMessage };
        }

        const primaryLeg = data.trip.legs[0];
        if (!primaryLeg || !primaryLeg.shape) {
          return { route: null, error: 'Malformed route geometry in response.' };
        }

        const coordinates = decodePolyline(primaryLeg.shape, 6);
        if (coordinates.length === 0) {
          return { route: null, error: 'Failed to decode route geometry.' };
        }

        const distanceMeters = Math.round((data.trip.summary?.length ?? 0) * 1000);
        const durationSeconds = Math.round(data.trip.summary?.time ?? 0);

        const route: CalculatedRoute = {
          coordinates,
          distanceMeters,
          durationSeconds,
          profile: valhallaProfile,
          origin: { ...origin },
          destination: { ...destination },
          calculatedAt: Date.now(),
          isStale: false,
        };

        return { route };
      } catch (err: unknown) {
        // If external signal was aborted, do not retry
        if (signal?.aborted) {
          return { route: null, error: 'Route request cancelled.' };
        }

        const isLastAttempt = attempts >= maxAttempts;
        if (isLastAttempt) {
          const message = err instanceof Error ? err.message : 'Route calculation failed.';
          return { route: null, error: message };
        }

        // Wait before retry
        await new Promise((resolve) => setTimeout(resolve, ROUTING_CONFIG.RETRY_DELAY_MS));
      }
    }

    return { route: null, error: 'Route calculation failed after retries.' };
  }
}

/**
 * Helper to combine multiple AbortSignals safely.
 */
function anySignal(signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController();
  for (const sig of signals) {
    if (sig.aborted) {
      controller.abort();
      return controller.signal;
    }
    sig.addEventListener('abort', () => controller.abort(), { once: true });
  }
  return controller.signal;
}

export const routingService = new RoutingService();
