import type { MovementState, RawPositionFix } from '../types';
import { calculateDistanceMeters, isValidPositionFix } from '../utils/geoUtils';

export interface MovementEngineConfig {
  stationarySpeedMaxMetersPerSec: number; // < 0.8 m/s (~2.88 km/h)
  walkingSpeedMaxMetersPerSec: number; // < 5.5 m/s (~20 km/h)
  drivingSpeedMinMetersPerSec: number; // >= 5.5 m/s (~20 km/h)
  consecutiveDrivingObservationsRequired: number; // 2 samples
  consecutiveStationaryObservationsRequired: number; // 3 samples
  maxRollingSamples: number; // 5 samples
}

export const DEFAULT_MOVEMENT_CONFIG: MovementEngineConfig = {
  stationarySpeedMaxMetersPerSec: 0.8,
  walkingSpeedMaxMetersPerSec: 5.5,
  drivingSpeedMinMetersPerSec: 5.5,
  consecutiveDrivingObservationsRequired: 2,
  consecutiveStationaryObservationsRequired: 3,
  maxRollingSamples: 5,
};

export class MovementEngine {
  private config: MovementEngineConfig;
  private currentState: MovementState = 'UNKNOWN';
  private rollingFixes: RawPositionFix[] = [];
  private consecutiveDrivingCount = 0;
  private consecutiveStationaryCount = 0;

  constructor(config: Partial<MovementEngineConfig> = {}) {
    this.config = { ...DEFAULT_MOVEMENT_CONFIG, ...config };
  }

  /**
   * Returns current stabilized movement state.
   */
  getState(): MovementState {
    return this.currentState;
  }

  /**
   * Resets internal history and buffers.
   */
  reset(): void {
    this.currentState = 'UNKNOWN';
    this.rollingFixes = [];
    this.consecutiveDrivingCount = 0;
    this.consecutiveStationaryCount = 0;
  }

  /**
   * Ingests a new GPS fix and computes the stabilized movement state.
   */
  processFix(fix: RawPositionFix): MovementState {
    if (!isValidPositionFix(fix)) {
      return this.currentState;
    }

    const prevFix = this.rollingFixes[this.rollingFixes.length - 1];
    this.rollingFixes.push(fix);
    if (this.rollingFixes.length > this.config.maxRollingSamples) {
      this.rollingFixes.shift();
    }

    if (!prevFix) {
      // First fix: if hardware reports clear speed, use it as initial guess, else UNKNOWN
      if (typeof fix.speed === 'number' && fix.speed >= 0) {
        if (fix.speed < this.config.stationarySpeedMaxMetersPerSec) {
          this.currentState = 'STATIONARY';
        } else if (fix.speed < this.config.walkingSpeedMaxMetersPerSec) {
          this.currentState = 'WALKING';
        } else {
          this.currentState = 'DRIVING';
        }
      } else {
        this.currentState = 'STATIONARY';
      }
      return this.currentState;
    }

    // Compute delta distance and delta time
    const distanceMeters = calculateDistanceMeters(
      prevFix.latitude,
      prevFix.longitude,
      fix.latitude,
      fix.longitude,
    );
    const deltaTimeSec = Math.max(0.1, (fix.timestamp - prevFix.timestamp) / 1000);
    const derivedSpeed = distanceMeters / deltaTimeSec;

    // Determine effective speed: cross-validate hardware speed with derived speed to filter GPS glitches
    let effectiveSpeed = derivedSpeed;
    if (typeof fix.speed === 'number' && fix.speed >= 0) {
      // If hardware speed is reported, bound it by derived speed + tolerance to prevent noise spikes
      if (distanceMeters < 5 && fix.speed > this.config.walkingSpeedMaxMetersPerSec) {
        // Obvious GPS speed glitch where device jumped in reported velocity without displacement
        effectiveSpeed = derivedSpeed;
      } else {
        // Average or pick hardware speed when consistent
        effectiveSpeed = fix.speed;
      }
    }

    // Evaluate instantaneous state candidate
    let instantaneousCandidate: MovementState;
    if (effectiveSpeed < this.config.stationarySpeedMaxMetersPerSec && distanceMeters < 3) {
      instantaneousCandidate = 'STATIONARY';
    } else if (effectiveSpeed < this.config.walkingSpeedMaxMetersPerSec) {
      instantaneousCandidate = 'WALKING';
    } else {
      instantaneousCandidate = 'DRIVING';
    }

    // Apply Hysteresis & Stabilization
    if (instantaneousCandidate === 'DRIVING') {
      this.consecutiveDrivingCount += 1;
      this.consecutiveStationaryCount = 0;

      if (
        this.consecutiveDrivingCount >= this.config.consecutiveDrivingObservationsRequired ||
        distanceMeters >= 25 // Strong physical displacement confirmation
      ) {
        this.currentState = 'DRIVING';
      }
    } else if (instantaneousCandidate === 'STATIONARY') {
      this.consecutiveStationaryCount += 1;
      this.consecutiveDrivingCount = 0;

      if (
        this.consecutiveStationaryCount >= this.config.consecutiveStationaryObservationsRequired ||
        this.currentState === 'UNKNOWN'
      ) {
        this.currentState = 'STATIONARY';
      }
    } else {
      // WALKING
      this.consecutiveDrivingCount = 0;
      this.consecutiveStationaryCount = 0;
      this.currentState = 'WALKING';
    }

    return this.currentState;
  }
}

export const movementEngine = new MovementEngine();
