import { MAP_CONFIG } from '../config/mapConfig';
import type { InterpolatedCoordinate } from '../types';
import { calculateDistanceMeters, isValidCoordinate } from './geoUtils';

/**
 * Calculates a linearly interpolated coordinate between 'from' and 'to' at progress t in [0, 1].
 * If the distance exceeds snapDistanceMeters (default 2000m), it snaps directly to 'to'
 * to avoid panning across large jumps or artificial trajectories.
 */
export function interpolateCoordinate(
  from: InterpolatedCoordinate,
  to: InterpolatedCoordinate,
  t: number,
  snapDistanceMeters: number = MAP_CONFIG.SNAP_DISTANCE_METERS,
): InterpolatedCoordinate {
  if (!isValidCoordinate(from.latitude, from.longitude) || !isValidCoordinate(to.latitude, to.longitude)) {
    return to;
  }

  // Clamp progress t between 0 and 1
  const progress = Math.max(0, Math.min(1, t));
  if (progress === 0) return { ...from };
  if (progress === 1) return { ...to };

  const distance = calculateDistanceMeters(
    from.latitude,
    from.longitude,
    to.latitude,
    to.longitude,
  );

  // If distance exceeds snap threshold, snap immediately
  if (distance > snapDistanceMeters) {
    return { ...to };
  }

  // Handle antimeridian crossing for longitude
  let diffLng = to.longitude - from.longitude;
  if (diffLng > 180) {
    diffLng -= 360;
  } else if (diffLng < -180) {
    diffLng += 360;
  }

  const lat = from.latitude + (to.latitude - from.latitude) * progress;
  let lng = from.longitude + diffLng * progress;

  // Normalize lng back to [-180, 180]
  if (lng > 180) lng -= 360;
  if (lng < -180) lng += 360;

  return {
    latitude: Number(lat.toFixed(7)),
    longitude: Number(lng.toFixed(7)),
  };
}

/**
 * Determines whether the distance between two coordinates exceeds the snap threshold.
 */
export function shouldSnapDistance(
  from: InterpolatedCoordinate,
  to: InterpolatedCoordinate,
  snapDistanceMeters: number = MAP_CONFIG.SNAP_DISTANCE_METERS,
): boolean {
  if (!isValidCoordinate(from.latitude, from.longitude) || !isValidCoordinate(to.latitude, to.longitude)) {
    return true;
  }

  const distance = calculateDistanceMeters(
    from.latitude,
    from.longitude,
    to.latitude,
    to.longitude,
  );

  return distance > snapDistanceMeters;
}
