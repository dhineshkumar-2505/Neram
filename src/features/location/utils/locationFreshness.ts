import { MAP_CONFIG } from '../config/mapConfig';

/**
 * Checks if a given timestamp (epoch ms or ISO string) is stale.
 * Returns true if age > thresholdMs (default 5 minutes).
 */
export function isLocationStale(
  recordedAt: string | number,
  thresholdMs: number = MAP_CONFIG.STALE_THRESHOLD_MS,
  referenceNowMs: number = Date.now(),
): boolean {
  if (!recordedAt) return true;

  const timestamp =
    typeof recordedAt === 'number'
      ? recordedAt
      : new Date(recordedAt).getTime();

  if (Number.isNaN(timestamp) || timestamp <= 0) {
    return true;
  }

  const age = referenceNowMs - timestamp;
  return age > thresholdMs;
}

/**
 * Returns formatted relative time string for location fixes.
 * Example: "Just now", "1m ago", "5m ago", "Stale (>5m)".
 */
export function formatLocationAge(
  recordedAt: string | number,
  referenceNowMs: number = Date.now(),
): string {
  if (!recordedAt) return 'Unknown';

  const timestamp =
    typeof recordedAt === 'number'
      ? recordedAt
      : new Date(recordedAt).getTime();

  if (Number.isNaN(timestamp) || timestamp <= 0) {
    return 'Unknown';
  }

  const ageMs = Math.max(0, referenceNowMs - timestamp);
  const seconds = Math.floor(ageMs / 1000);

  if (seconds < 30) {
    return 'Just now';
  }
  if (seconds < 60) {
    return `${seconds}s ago`;
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

/**
 * Formats speed from meters/second to km/h string.
 */
export function formatSpeedKmh(speedMps?: number | null): string {
  if (speedMps == null || Number.isNaN(speedMps) || speedMps < 0.2) {
    return '0 km/h';
  }

  const kmh = Math.round(speedMps * 3.6);
  return `${kmh} km/h`;
}
