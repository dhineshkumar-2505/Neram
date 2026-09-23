import type {
  MovementState,
  RawPositionFix,
  TransmissionDecision,
  TransmissionPolicyConfig,
} from '../types';
import { calculateDistanceMeters, isValidPositionFix } from '../utils/geoUtils';

export const DEFAULT_TRANSMISSION_CONFIG: TransmissionPolicyConfig = {
  stationaryDistanceThresholdMeters: 25,
  walkingTimeThresholdSeconds: 30,
  walkingDistanceThresholdMeters: 15,
  drivingTimeThresholdSeconds: 10,
  drivingDistanceThresholdMeters: 50,
  maxAcceptableAccuracyMeters: 65,
  minMovementDetectionMeters: 3,
};

export class LocationTransmissionPolicy {
  private config: TransmissionPolicyConfig;

  constructor(config: Partial<TransmissionPolicyConfig> = {}) {
    this.config = { ...DEFAULT_TRANSMISSION_CONFIG, ...config };
  }

  /**
   * Deterministically evaluates whether a GPS fix warrants a network transmission to Supabase.
   */
  shouldTransmit(
    currentFix: RawPositionFix,
    lastTransmittedFix: RawPositionFix | null,
    lastTransmittedTimeMs: number | null,
    movementState: MovementState,
    customConfig?: Partial<TransmissionPolicyConfig>,
  ): TransmissionDecision {
    const activeConfig = customConfig ? { ...this.config, ...customConfig } : this.config;

    // 1. Accuracy & physical plausibility validation
    if (!isValidPositionFix(currentFix, activeConfig.maxAcceptableAccuracyMeters)) {
      return {
        shouldTransmit: false,
        reason: 'POOR_ACCURACY',
        movementState,
        distanceMovedMeters: 0,
        elapsedTimeSeconds: 0,
      };
    }

    // 2. Initial location rule: transmit baseline immediately
    if (!lastTransmittedFix || lastTransmittedTimeMs === null) {
      return {
        shouldTransmit: true,
        reason: 'INITIAL_LOCATION',
        movementState,
        distanceMovedMeters: 0,
        elapsedTimeSeconds: 0,
      };
    }

    // 3. Stale timestamp protection (older reading arrives out of order)
    if (currentFix.timestamp <= lastTransmittedTimeMs) {
      return {
        shouldTransmit: false,
        reason: 'STALE_TIMESTAMP',
        movementState,
        distanceMovedMeters: 0,
        elapsedTimeSeconds: 0,
      };
    }

    // 4. Calculate geodesic displacement & elapsed time
    const distanceMovedMeters = calculateDistanceMeters(
      lastTransmittedFix.latitude,
      lastTransmittedFix.longitude,
      currentFix.latitude,
      currentFix.longitude,
    );
    const elapsedTimeSeconds = Math.max(0, (currentFix.timestamp - lastTransmittedTimeMs) / 1000);

    // 5. GPS Jitter / duplicate suppression (insignificant movement in under 60 seconds)
    if (
      distanceMovedMeters < activeConfig.minMovementDetectionMeters &&
      elapsedTimeSeconds < 60
    ) {
      return {
        shouldTransmit: false,
        reason: 'DUPLICATE_OR_JITTER',
        movementState,
        distanceMovedMeters,
        elapsedTimeSeconds,
      };
    }

    // 6. Movement-specific adaptive policies
    switch (movementState) {
      case 'STATIONARY':
        if (distanceMovedMeters > activeConfig.stationaryDistanceThresholdMeters) {
          return {
            shouldTransmit: true,
            reason: 'STATIONARY_DISPLACEMENT_EXCEEDED',
            movementState,
            distanceMovedMeters,
            elapsedTimeSeconds,
          };
        }
        return {
          shouldTransmit: false,
          reason: 'STATIONARY_SUPPRESSED',
          movementState,
          distanceMovedMeters,
          elapsedTimeSeconds,
        };

      case 'WALKING':
        if (elapsedTimeSeconds >= activeConfig.walkingTimeThresholdSeconds) {
          return {
            shouldTransmit: true,
            reason: 'WALKING_TIME_ELAPSED',
            movementState,
            distanceMovedMeters,
            elapsedTimeSeconds,
          };
        }
        if (distanceMovedMeters >= activeConfig.walkingDistanceThresholdMeters) {
          return {
            shouldTransmit: true,
            reason: 'WALKING_DISTANCE_EXCEEDED',
            movementState,
            distanceMovedMeters,
            elapsedTimeSeconds,
          };
        }
        return {
          shouldTransmit: false,
          reason: 'WALKING_BELOW_THRESHOLDS',
          movementState,
          distanceMovedMeters,
          elapsedTimeSeconds,
        };

      case 'DRIVING':
        if (elapsedTimeSeconds >= activeConfig.drivingTimeThresholdSeconds) {
          return {
            shouldTransmit: true,
            reason: 'DRIVING_TIME_ELAPSED',
            movementState,
            distanceMovedMeters,
            elapsedTimeSeconds,
          };
        }
        if (distanceMovedMeters >= activeConfig.drivingDistanceThresholdMeters) {
          return {
            shouldTransmit: true,
            reason: 'DRIVING_DISTANCE_EXCEEDED',
            movementState,
            distanceMovedMeters,
            elapsedTimeSeconds,
          };
        }
        return {
          shouldTransmit: false,
          reason: 'DRIVING_BELOW_THRESHOLDS',
          movementState,
          distanceMovedMeters,
          elapsedTimeSeconds,
        };

      case 'UNKNOWN':
      default:
        if (elapsedTimeSeconds >= 20) {
          return {
            shouldTransmit: true,
            reason: 'UNKNOWN_TIME_ELAPSED',
            movementState,
            distanceMovedMeters,
            elapsedTimeSeconds,
          };
        }
        if (distanceMovedMeters >= 20) {
          return {
            shouldTransmit: true,
            reason: 'UNKNOWN_DISTANCE_EXCEEDED',
            movementState,
            distanceMovedMeters,
            elapsedTimeSeconds,
          };
        }
        return {
          shouldTransmit: false,
          reason: 'UNKNOWN_BELOW_THRESHOLDS',
          movementState,
          distanceMovedMeters,
          elapsedTimeSeconds,
        };
    }
  }
}

export const locationTransmissionPolicy = new LocationTransmissionPolicy();
