/**
 * Utility functions for formatting route duration and road distances.
 * Guarantees zero emojis and clean, rounded human-friendly typography.
 */

/**
 * Formats duration in seconds into a clean ETA string.
 * Examples: "Arriving soon", "1 min", "14 min", "1 hr 12 min", "2 hr".
 */
export function formatDurationEta(durationSeconds?: number | null): string {
  if (durationSeconds == null || Number.isNaN(durationSeconds) || durationSeconds < 0) {
    return '--';
  }

  const roundedSeconds = Math.round(durationSeconds);

  if (roundedSeconds <= 45) {
    return 'Arriving soon';
  }

  const minutes = Math.round(roundedSeconds / 60);

  if (minutes < 60) {
    return `${Math.max(1, minutes)} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (remainingMinutes === 0) {
    return `${hours} hr`;
  }

  return `${hours} hr ${remainingMinutes} min`;
}

/**
 * Formats road distance in meters into a readable metric string.
 * Examples: "350 m", "1.2 km", "14.5 km".
 */
export function formatRoadDistance(distanceMeters?: number | null): string {
  if (distanceMeters == null || Number.isNaN(distanceMeters) || distanceMeters < 0) {
    return '--';
  }

  if (distanceMeters < 1000) {
    return `${Math.round(distanceMeters)} m`;
  }

  const km = distanceMeters / 1000;
  return `${km.toFixed(1)} km`;
}

/**
 * Calculates and formats estimated clock arrival time (e.g. "3:45 PM").
 */
export function formatArrivalTime(
  durationSeconds?: number | null,
  referenceNowMs: number = Date.now(),
): string {
  if (durationSeconds == null || Number.isNaN(durationSeconds) || durationSeconds < 0) {
    return '--';
  }

  const arrivalDate = new Date(referenceNowMs + durationSeconds * 1000);
  let hours = arrivalDate.getHours();
  const minutes = arrivalDate.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';

  hours = hours % 12;
  hours = hours ? hours : 12; // 0 hour is 12 AM

  const minutesFormatted = minutes < 10 ? `0${minutes}` : `${minutes}`;
  return `${hours}:${minutesFormatted} ${ampm}`;
}
