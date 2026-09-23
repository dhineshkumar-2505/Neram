import {
  formatDurationEta,
  formatRoadDistance,
  formatArrivalTime,
} from '../../src/features/location/utils/formatEta';

describe('formatEta', () => {
  describe('formatDurationEta', () => {
    it('returns "--" for null, undefined, NaN, or negative values', () => {
      expect(formatDurationEta(null)).toBe('--');
      expect(formatDurationEta(undefined)).toBe('--');
      expect(formatDurationEta(NaN)).toBe('--');
      expect(formatDurationEta(-10)).toBe('--');
    });

    it('returns "Arriving soon" for duration <= 45 seconds', () => {
      expect(formatDurationEta(0)).toBe('Arriving soon');
      expect(formatDurationEta(25)).toBe('Arriving soon');
      expect(formatDurationEta(45)).toBe('Arriving soon');
    });

    it('formats minutes under 1 hour', () => {
      expect(formatDurationEta(50)).toBe('1 min');
      expect(formatDurationEta(300)).toBe('5 min');
      expect(formatDurationEta(840)).toBe('14 min');
      expect(formatDurationEta(3500)).toBe('58 min');
    });

    it('formats hours and remaining minutes', () => {
      expect(formatDurationEta(3600)).toBe('1 hr');
      expect(formatDurationEta(4320)).toBe('1 hr 12 min');
      expect(formatDurationEta(7200)).toBe('2 hr');
    });
  });

  describe('formatRoadDistance', () => {
    it('returns "--" for null, undefined, NaN, or negative values', () => {
      expect(formatRoadDistance(null)).toBe('--');
      expect(formatRoadDistance(undefined)).toBe('--');
      expect(formatRoadDistance(NaN)).toBe('--');
      expect(formatRoadDistance(-5)).toBe('--');
    });

    it('formats meters under 1000m', () => {
      expect(formatRoadDistance(45)).toBe('45 m');
      expect(formatRoadDistance(350.2)).toBe('350 m');
      expect(formatRoadDistance(999)).toBe('999 m');
    });

    it('formats kilometers for >= 1000m', () => {
      expect(formatRoadDistance(1000)).toBe('1.0 km');
      expect(formatRoadDistance(2450)).toBe('2.5 km');
      expect(formatRoadDistance(12800)).toBe('12.8 km');
    });
  });

  describe('formatArrivalTime', () => {
    it('returns "--" for invalid inputs', () => {
      expect(formatArrivalTime(null)).toBe('--');
      expect(formatArrivalTime(undefined)).toBe('--');
      expect(formatArrivalTime(-1)).toBe('--');
    });

    it('calculates 12-hour clock time correctly with AM/PM', () => {
      // 2:00 PM UTC = 14:00
      const refTime = new Date('2026-09-23T14:00:00Z').getTime();
      // Add 15 minutes (900 seconds)
      const formatted = formatArrivalTime(900, refTime);
      expect(formatted).toMatch(/\d{1,2}:\d{2}\s(AM|PM)/);
    });
  });
});
