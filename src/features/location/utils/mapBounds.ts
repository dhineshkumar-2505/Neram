import type { InterpolatedCoordinate, MapBoundingBox } from '../types';
import { isValidCoordinate } from './geoUtils';

/**
 * Minimum degree delta to prevent bounds collapse when all coordinates are identical.
 * ~200 meters.
 */
const MIN_DEGREE_DELTA = 0.002;

/**
 * Computes a MapLibre-compliant bounding box [west, south, east, north]
 * enclosing all provided valid coordinates.
 */
export function calculateCoordinatesBounds(
  coordinates: (InterpolatedCoordinate | { latitude: number; longitude: number } | null | undefined)[],
): MapBoundingBox | null {
  const validCoords = coordinates.filter(
    (c): c is { latitude: number; longitude: number } =>
      c != null && isValidCoordinate(c.latitude, c.longitude),
  );

  const first = validCoords[0];
  if (!first) {
    return null;
  }

  let minLng = first.longitude;
  let maxLng = first.longitude;
  let minLat = first.latitude;
  let maxLat = first.latitude;

  for (let i = 1; i < validCoords.length; i++) {
    const item = validCoords[i];
    if (!item) continue;
    const { latitude, longitude } = item;
    if (longitude < minLng) minLng = longitude;
    if (longitude > maxLng) maxLng = longitude;
    if (latitude < minLat) minLat = latitude;
    if (latitude > maxLat) maxLat = latitude;
  }

  // If bounds collapsed to a single point or very small area, expand with margin
  if (maxLng - minLng < MIN_DEGREE_DELTA) {
    const centerLng = (minLng + maxLng) / 2;
    minLng = Math.max(-180, centerLng - MIN_DEGREE_DELTA);
    maxLng = Math.min(180, centerLng + MIN_DEGREE_DELTA);
  }

  if (maxLat - minLat < MIN_DEGREE_DELTA) {
    const centerLat = (minLat + maxLat) / 2;
    minLat = Math.max(-90, centerLat - MIN_DEGREE_DELTA);
    maxLat = Math.min(90, centerLat + MIN_DEGREE_DELTA);
  }

  return {
    minLng,
    minLat,
    maxLng,
    maxLat,
    bounds: [minLng, minLat, maxLng, maxLat],
  };
}
