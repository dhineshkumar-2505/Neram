import {
  LocationTransmissionPolicy,
} from '../../src/features/location/services/locationTransmissionPolicy';
import type { RawPositionFix } from '../../src/features/location/types';

describe('LocationTransmissionPolicy', () => {
  let policy: LocationTransmissionPolicy;

  beforeEach(() => {
    policy = new LocationTransmissionPolicy();
  });

  const baseLat = 40.7128;
  const baseLon = -74.006;
  const baseTime = Date.now() - 60000;

  const baselineFix: RawPositionFix = {
    latitude: baseLat,
    longitude: baseLon,
    accuracy: 10,
    speed: 0,
    timestamp: baseTime,
  };

  it('transmits initial location immediately when no previous transmission exists', () => {
    const currentFix: RawPositionFix = {
      latitude: baseLat,
      longitude: baseLon,
      accuracy: 12,
      speed: 0,
      timestamp: baseTime,
    };

    const decision = policy.shouldTransmit(currentFix, null, null, 'STATIONARY');

    expect(decision.shouldTransmit).toBe(true);
    expect(decision.reason).toBe('INITIAL_LOCATION');
  });

  it('rejects coordinates with unacceptable accuracy (> 65m)', () => {
    const poorAccuracyFix: RawPositionFix = {
      latitude: baseLat,
      longitude: baseLon,
      accuracy: 75,
      speed: 0,
      timestamp: baseTime + 10000,
    };

    const decision = policy.shouldTransmit(poorAccuracyFix, baselineFix, baseTime, 'WALKING');

    expect(decision.shouldTransmit).toBe(false);
    expect(decision.reason).toBe('POOR_ACCURACY');
  });

  it('rejects stale timestamp where current fix is older than or equal to last transmission', () => {
    const staleFix: RawPositionFix = {
      latitude: baseLat + 0.001,
      longitude: baseLon,
      accuracy: 10,
      speed: 1.5,
      timestamp: baseTime - 1000,
    };

    const decision = policy.shouldTransmit(staleFix, baselineFix, baseTime, 'WALKING');

    expect(decision.shouldTransmit).toBe(false);
    expect(decision.reason).toBe('STALE_TIMESTAMP');
  });

  it('suppresses duplicate or negligible jitter (< 3m within 60s)', () => {
    // 0.00001 deg lat is ~1.1 meters
    const jitterFix: RawPositionFix = {
      latitude: baseLat + 0.00001,
      longitude: baseLon,
      accuracy: 8,
      speed: 0,
      timestamp: baseTime + 15000,
    };

    const decision = policy.shouldTransmit(jitterFix, baselineFix, baseTime, 'STATIONARY');

    expect(decision.shouldTransmit).toBe(false);
    expect(decision.reason).toBe('DUPLICATE_OR_JITTER');
  });

  describe('STATIONARY policy', () => {
    it('suppresses transmission when displacement is <= 25m', () => {
      // 0.0001 deg lat is ~11.1 meters
      const moved11mFix: RawPositionFix = {
        latitude: baseLat + 0.0001,
        longitude: baseLon,
        accuracy: 10,
        speed: 0,
        timestamp: baseTime + 30000,
      };

      const decision = policy.shouldTransmit(moved11mFix, baselineFix, baseTime, 'STATIONARY');

      expect(decision.shouldTransmit).toBe(false);
      expect(decision.reason).toBe('STATIONARY_SUPPRESSED');
    });

    it('transmits when displacement exceeds 25m', () => {
      // 0.00025 deg lat is ~27.7 meters
      const moved28mFix: RawPositionFix = {
        latitude: baseLat + 0.00025,
        longitude: baseLon,
        accuracy: 10,
        speed: 0.5,
        timestamp: baseTime + 30000,
      };

      const decision = policy.shouldTransmit(moved28mFix, baselineFix, baseTime, 'STATIONARY');

      expect(decision.shouldTransmit).toBe(true);
      expect(decision.reason).toBe('STATIONARY_DISPLACEMENT_EXCEEDED');
      expect(decision.distanceMovedMeters).toBeGreaterThan(25);
    });
  });

  describe('WALKING policy', () => {
    it('suppresses transmission if both elapsed time < 30s and displacement < 15m', () => {
      // 0.00008 deg lat is ~8.9 meters, elapsed 15 seconds
      const walkingFix: RawPositionFix = {
        latitude: baseLat + 0.00008,
        longitude: baseLon,
        accuracy: 10,
        speed: 1.2,
        timestamp: baseTime + 15000,
      };

      const decision = policy.shouldTransmit(walkingFix, baselineFix, baseTime, 'WALKING');

      expect(decision.shouldTransmit).toBe(false);
      expect(decision.reason).toBe('WALKING_BELOW_THRESHOLDS');
    });

    it('transmits when elapsed time reaches 30s regardless of displacement', () => {
      // 0.00005 deg lat is ~5.5 meters, elapsed 31 seconds
      const timeElapsedFix: RawPositionFix = {
        latitude: baseLat + 0.00005,
        longitude: baseLon,
        accuracy: 10,
        speed: 1.1,
        timestamp: baseTime + 31000,
      };

      const decision = policy.shouldTransmit(timeElapsedFix, baselineFix, baseTime, 'WALKING');

      expect(decision.shouldTransmit).toBe(true);
      expect(decision.reason).toBe('WALKING_TIME_ELAPSED');
    });

    it('transmits when displacement reaches 15m before 30s has elapsed', () => {
      // 0.00016 deg lat is ~17.8 meters, elapsed 12 seconds
      const distanceExceededFix: RawPositionFix = {
        latitude: baseLat + 0.00016,
        longitude: baseLon,
        accuracy: 10,
        speed: 1.5,
        timestamp: baseTime + 12000,
      };

      const decision = policy.shouldTransmit(distanceExceededFix, baselineFix, baseTime, 'WALKING');

      expect(decision.shouldTransmit).toBe(true);
      expect(decision.reason).toBe('WALKING_DISTANCE_EXCEEDED');
    });
  });

  describe('DRIVING policy', () => {
    it('suppresses transmission if both elapsed time < 10s and displacement < 50m', () => {
      // 0.0002 deg lat is ~22.2 meters, elapsed 4 seconds
      const drivingFix: RawPositionFix = {
        latitude: baseLat + 0.0002,
        longitude: baseLon,
        accuracy: 10,
        speed: 8.0,
        timestamp: baseTime + 4000,
      };

      const decision = policy.shouldTransmit(drivingFix, baselineFix, baseTime, 'DRIVING');

      expect(decision.shouldTransmit).toBe(false);
      expect(decision.reason).toBe('DRIVING_BELOW_THRESHOLDS');
    });

    it('transmits when elapsed time reaches 10s', () => {
      // 0.0002 deg lat is ~22.2 meters, elapsed 11 seconds
      const timeElapsedFix: RawPositionFix = {
        latitude: baseLat + 0.0002,
        longitude: baseLon,
        accuracy: 10,
        speed: 10.0,
        timestamp: baseTime + 11000,
      };

      const decision = policy.shouldTransmit(timeElapsedFix, baselineFix, baseTime, 'DRIVING');

      expect(decision.shouldTransmit).toBe(true);
      expect(decision.reason).toBe('DRIVING_TIME_ELAPSED');
    });

    it('transmits when displacement reaches 50m before 10s has elapsed', () => {
      // 0.0005 deg lat is ~55.5 meters, elapsed 5 seconds
      const distanceExceededFix: RawPositionFix = {
        latitude: baseLat + 0.0005,
        longitude: baseLon,
        accuracy: 10,
        speed: 12.0,
        timestamp: baseTime + 5000,
      };

      const decision = policy.shouldTransmit(distanceExceededFix, baselineFix, baseTime, 'DRIVING');

      expect(decision.shouldTransmit).toBe(true);
      expect(decision.reason).toBe('DRIVING_DISTANCE_EXCEEDED');
    });
  });
});
