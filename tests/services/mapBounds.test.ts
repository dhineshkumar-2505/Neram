import { calculateCoordinatesBounds } from '../../src/features/location/utils/mapBounds';

describe('calculateCoordinatesBounds', () => {
  it('returns null when given an empty list or only null/undefined/invalid entries', () => {
    expect(calculateCoordinatesBounds([])).toBeNull();
    expect(calculateCoordinatesBounds([null, undefined])).toBeNull();
    expect(
      calculateCoordinatesBounds([{ latitude: 200, longitude: 300 }]),
    ).toBeNull();
  });

  it('calculates bounding box correctly for multiple valid coordinates', () => {
    const coords = [
      { latitude: 12.9716, longitude: 77.5946 }, // Bangalore center
      { latitude: 12.9352, longitude: 77.6245 }, // Koramangala
      { latitude: 13.0068, longitude: 77.5813 }, // Malleshwaram
    ];

    const result = calculateCoordinatesBounds(coords);
    expect(result).not.toBeNull();
    expect(result!.minLat).toBeCloseTo(12.9352, 4);
    expect(result!.maxLat).toBeCloseTo(13.0068, 4);
    expect(result!.minLng).toBeCloseTo(77.5813, 4);
    expect(result!.maxLng).toBeCloseTo(77.6245, 4);

    // MapLibre order: [west, south, east, north] -> [minLng, minLat, maxLng, maxLat]
    expect(result!.bounds).toEqual([
      result!.minLng,
      result!.minLat,
      result!.maxLng,
      result!.maxLat,
    ]);
  });

  it('expands bounds with minimum delta margin when single coordinate is passed', () => {
    const coords = [{ latitude: 12.9716, longitude: 77.5946 }];
    const result = calculateCoordinatesBounds(coords);
    expect(result).not.toBeNull();

    // Span should be expanded to prevent zero-area box
    expect(result!.maxLat - result!.minLat).toBeGreaterThan(0.003);
    expect(result!.maxLng - result!.minLng).toBeGreaterThan(0.003);
  });
});
