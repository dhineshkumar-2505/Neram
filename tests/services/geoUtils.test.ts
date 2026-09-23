import {
  calculateDistanceMeters,
  isValidCoordinate,
  isValidPositionFix,
} from '../../src/features/location/utils/geoUtils';
import type { RawPositionFix } from '../../src/features/location/types';

describe('geoUtils', () => {
  describe('isValidCoordinate', () => {
    it('returns true for valid coordinates', () => {
      expect(isValidCoordinate(0, 0)).toBe(true);
      expect(isValidCoordinate(90, 180)).toBe(true);
      expect(isValidCoordinate(-90, -180)).toBe(true);
      expect(isValidCoordinate(40.7128, -74.006)).toBe(true);
    });

    it('returns false for out-of-bounds coordinates', () => {
      expect(isValidCoordinate(91, 0)).toBe(false);
      expect(isValidCoordinate(-91, 0)).toBe(false);
      expect(isValidCoordinate(0, 181)).toBe(false);
      expect(isValidCoordinate(0, -181)).toBe(false);
    });

    it('returns false for non-finite values and NaN', () => {
      expect(isValidCoordinate(NaN, 0)).toBe(false);
      expect(isValidCoordinate(0, NaN)).toBe(false);
      expect(isValidCoordinate(Infinity, 0)).toBe(false);
      expect(isValidCoordinate(0, -Infinity)).toBe(false);
    });
  });

  describe('calculateDistanceMeters', () => {
    it('returns 0 when coordinates are identical', () => {
      expect(calculateDistanceMeters(40.7128, -74.006, 40.7128, -74.006)).toBe(0);
    });

    it('returns NaN if coordinates are invalid', () => {
      expect(calculateDistanceMeters(100, 0, 40, -74)).toBeNaN();
      expect(calculateDistanceMeters(0, 0, NaN, 0)).toBeNaN();
    });

    it('calculates accurate distance between known landmarks', () => {
      // Statue of Liberty (40.6892, -74.0445) to Empire State Building (40.7484, -73.9857)
      // Distance is ~8,270m
      const distance = calculateDistanceMeters(40.6892, -74.0445, 40.7484, -73.9857);
      expect(distance).toBeGreaterThan(8200);
      expect(distance).toBeLessThan(8400);
    });

    it('measures sub-100 meter displacements with high precision', () => {
      // 1 degree latitude is approx 111,139 meters. 0.0001 deg is approx 11.1 meters
      const lat1 = 40.7128;
      const lon1 = -74.006;
      const lat2 = 40.7128 + 0.0002; // ~22.2 meters north
      const lon2 = -74.006;

      const d = calculateDistanceMeters(lat1, lon1, lat2, lon2);
      expect(d).toBeGreaterThan(20);
      expect(d).toBeLessThan(25);
    });
  });

  describe('isValidPositionFix', () => {
    const validFix: RawPositionFix = {
      latitude: 40.7128,
      longitude: -74.006,
      accuracy: 10,
      timestamp: Date.now() - 5000,
    };

    it('returns true for a fresh fix with good accuracy', () => {
      expect(isValidPositionFix(validFix)).toBe(true);
    });

    it('rejects fix with accuracy exceeding threshold (e.g. > 65m)', () => {
      const poorAccuracyFix: RawPositionFix = {
        ...validFix,
        accuracy: 75,
      };
      expect(isValidPositionFix(poorAccuracyFix, 65)).toBe(false);
    });

    it('rejects fix with negative accuracy', () => {
      const negativeAcc: RawPositionFix = {
        ...validFix,
        accuracy: -1,
      };
      expect(isValidPositionFix(negativeAcc)).toBe(false);
    });

    it('rejects stale fix older than 120 seconds', () => {
      const staleFix: RawPositionFix = {
        ...validFix,
        timestamp: Date.now() - 130000,
      };
      expect(isValidPositionFix(staleFix)).toBe(false);
    });
  });
});
