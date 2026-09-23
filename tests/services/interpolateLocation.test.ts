import {
  interpolateCoordinate,
  shouldSnapDistance,
} from '../../src/features/location/utils/interpolateLocation';

describe('interpolateCoordinate', () => {
  const coordA = { latitude: 12.971598, longitude: 77.594562 };
  const coordB = { latitude: 12.972598, longitude: 77.595562 };

  it('returns start coordinate at progress 0', () => {
    const result = interpolateCoordinate(coordA, coordB, 0);
    expect(result.latitude).toBeCloseTo(coordA.latitude, 5);
    expect(result.longitude).toBeCloseTo(coordA.longitude, 5);
  });

  it('returns end coordinate at progress 1', () => {
    const result = interpolateCoordinate(coordA, coordB, 1);
    expect(result.latitude).toBeCloseTo(coordB.latitude, 5);
    expect(result.longitude).toBeCloseTo(coordB.longitude, 5);
  });

  it('interpolates midpoint at progress 0.5', () => {
    const result = interpolateCoordinate(coordA, coordB, 0.5);
    expect(result.latitude).toBeCloseTo((coordA.latitude + coordB.latitude) / 2, 5);
    expect(result.longitude).toBeCloseTo((coordA.longitude + coordB.longitude) / 2, 5);
  });

  it('snaps immediately if distance exceeds snapDistanceMeters (default 2000m)', () => {
    // Mumbai to Delhi (~1150 km)
    const mumbai = { latitude: 19.076, longitude: 72.8777 };
    const delhi = { latitude: 28.7041, longitude: 77.1025 };

    // Even at progress 0.2, it should snap directly to destination
    const result = interpolateCoordinate(mumbai, delhi, 0.2);
    expect(result.latitude).toBe(delhi.latitude);
    expect(result.longitude).toBe(delhi.longitude);
  });

  it('clamps progress < 0 to 0 and > 1 to 1', () => {
    const negResult = interpolateCoordinate(coordA, coordB, -0.5);
    expect(negResult.latitude).toBeCloseTo(coordA.latitude, 5);

    const overResult = interpolateCoordinate(coordA, coordB, 1.5);
    expect(overResult.latitude).toBeCloseTo(coordB.latitude, 5);
  });

  it('returns destination if either coordinate is invalid', () => {
    const invalid = { latitude: 150, longitude: 200 };
    const result = interpolateCoordinate(invalid, coordB, 0.5);
    expect(result).toEqual(coordB);
  });
});

describe('shouldSnapDistance', () => {
  it('returns false for small movements within 2000m', () => {
    const p1 = { latitude: 12.971598, longitude: 77.594562 };
    const p2 = { latitude: 12.972598, longitude: 77.595562 };
    expect(shouldSnapDistance(p1, p2)).toBe(false);
  });

  it('returns true for jumps larger than 2000m', () => {
    const p1 = { latitude: 12.971598, longitude: 77.594562 };
    const p2 = { latitude: 13.05, longitude: 77.65 }; // ~10km away
    expect(shouldSnapDistance(p1, p2)).toBe(true);
  });

  it('returns true if coordinates are invalid', () => {
    const p1 = { latitude: NaN, longitude: 77.594562 };
    const p2 = { latitude: 12.972598, longitude: 77.595562 };
    expect(shouldSnapDistance(p1, p2)).toBe(true);
  });
});
