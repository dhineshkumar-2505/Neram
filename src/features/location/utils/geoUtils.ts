import type { RawPositionFix } from '../types';

/**
 * Mean Earth radius in meters (WGS-84 spherical model).
 */
export const EARTH_RADIUS_METERS = 6371000;

/**
 * Validates whether latitude and longitude are within standard geographical boundaries.
 * Latitude must be in [-90, 90], Longitude in [-180, 180].
 */
export function isValidCoordinate(latitude: number, longitude: number): boolean {
  if (
    typeof latitude !== 'number' ||
    typeof longitude !== 'number' ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    return false;
  }

  return latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
}

/**
 * Calculates geodesic distance between two coordinate pairs using the Haversine formula.
 * Returns distance in meters.
 */
export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  if (!isValidCoordinate(lat1, lon1) || !isValidCoordinate(lat2, lon2)) {
    return NaN;
  }

  if (lat1 === lat2 && lon1 === lon2) {
    return 0;
  }

  const toRad = (degrees: number) => (degrees * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const radLat1 = toRad(lat1);
  const radLat2 = toRad(lat2);

  const sinHalfDLat = Math.sin(dLat / 2);
  const sinHalfDLon = Math.sin(dLon / 2);

  const a =
    sinHalfDLat * sinHalfDLat +
    Math.cos(radLat1) * Math.cos(radLat2) * sinHalfDLon * sinHalfDLon;

  // Clamp 'a' to [0, 1] to guard against floating-point inaccuracies
  const clampedA = Math.max(0, Math.min(1, a));
  const c = 2 * Math.atan2(Math.sqrt(clampedA), Math.sqrt(1 - clampedA));

  return EARTH_RADIUS_METERS * c;
}

/**
 * Validates a raw GPS fix against physical plausibility, accuracy thresholds, and timestamp sanity.
 * Coordinates with accuracy worse than maxAcceptableAccuracy (default 65m) are rejected.
 */
export function isValidPositionFix(
  fix: RawPositionFix,
  maxAcceptableAccuracy = 65,
): boolean {
  if (!fix) return false;

  if (!isValidCoordinate(fix.latitude, fix.longitude)) {
    return false;
  }

  if (
    typeof fix.accuracy !== 'number' ||
    !Number.isFinite(fix.accuracy) ||
    fix.accuracy < 0 ||
    fix.accuracy > maxAcceptableAccuracy
  ) {
    return false;
  }

  if (
    typeof fix.timestamp !== 'number' ||
    !Number.isFinite(fix.timestamp) ||
    fix.timestamp <= 0
  ) {
    return false;
  }

  // Reject fixes older than 120 seconds or unreasonably in the future (> 30s clock drift)
  const now = Date.now();
  const ageMs = now - fix.timestamp;
  if (ageMs > 120000 || ageMs < -30000) {
    return false;
  }

  return true;
}
