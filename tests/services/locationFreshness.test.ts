import {
  isLocationStale,
  formatLocationAge,
  formatSpeedKmh,
} from '../../src/features/location/utils/locationFreshness';

describe('locationFreshness utils', () => {
  const now = 1700000000000;

  describe('isLocationStale', () => {
    it('returns false when fix is within 5 minutes', () => {
      const fourMinutesAgo = now - 4 * 60 * 1000;
      expect(isLocationStale(fourMinutesAgo, undefined, now)).toBe(false);
    });

    it('returns true when fix is older than 5 minutes', () => {
      const sixMinutesAgo = now - 6 * 60 * 1000;
      expect(isLocationStale(sixMinutesAgo, undefined, now)).toBe(true);
    });

    it('supports ISO date string input', () => {
      const isoDate = new Date(now - 2 * 60 * 1000).toISOString();
      expect(isLocationStale(isoDate, undefined, now)).toBe(false);

      const oldIsoDate = new Date(now - 10 * 60 * 1000).toISOString();
      expect(isLocationStale(oldIsoDate, undefined, now)).toBe(true);
    });

    it('returns true for invalid or null timestamps', () => {
      expect(isLocationStale('', undefined, now)).toBe(true);
      expect(isLocationStale('invalid-date', undefined, now)).toBe(true);
      expect(isLocationStale(NaN, undefined, now)).toBe(true);
    });
  });

  describe('formatLocationAge', () => {
    it('formats less than 30 seconds as "Just now"', () => {
      expect(formatLocationAge(now - 15000, now)).toBe('Just now');
    });

    it('formats seconds between 30 and 59s', () => {
      expect(formatLocationAge(now - 45000, now)).toBe('45s ago');
    });

    it('formats minutes up to 59m', () => {
      expect(formatLocationAge(now - 5 * 60 * 1000, now)).toBe('5m ago');
      expect(formatLocationAge(now - 25 * 60 * 1000, now)).toBe('25m ago');
    });

    it('formats hours', () => {
      expect(formatLocationAge(now - 2 * 3600 * 1000, now)).toBe('2h ago');
    });

    it('returns "Unknown" for empty/invalid timestamp', () => {
      expect(formatLocationAge('', now)).toBe('Unknown');
      expect(formatLocationAge('invalid', now)).toBe('Unknown');
    });
  });

  describe('formatSpeedKmh', () => {
    it('formats valid m/s speeds to km/h correctly', () => {
      // 10 m/s = 36 km/h
      expect(formatSpeedKmh(10)).toBe('36 km/h');
      // 5.5 m/s = 19.8 -> 20 km/h
      expect(formatSpeedKmh(5.5)).toBe('20 km/h');
    });

    it('returns 0 km/h for zero, low jitter, or null/undefined speed', () => {
      expect(formatSpeedKmh(0)).toBe('0 km/h');
      expect(formatSpeedKmh(0.1)).toBe('0 km/h');
      expect(formatSpeedKmh(null)).toBe('0 km/h');
      expect(formatSpeedKmh(undefined)).toBe('0 km/h');
    });
  });
});
