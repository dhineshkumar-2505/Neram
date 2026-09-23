/**
 * Neram Itinerary, Events & Countdown Engine Domain Types
 * Governs group-scoped scheduling, chronological itinerary milestones,
 * drift-free live countdown calculation, and Part 8 destination coordinates.
 */

export type EventStatus = 'UPCOMING' | 'IN_PROGRESS' | 'PAST';

export interface EventCreator {
  userId: string;
  displayName: string;
  username: string;
  avatarUrl?: string | null;
}

export interface EventLocation {
  name: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface EventRecord {
  id: string;
  groupId: string;
  creatorId: string | null;
  title: string;
  description: string | null;
  targetTime: string; // ISO 8601 UTC timestamp
  endsAt: string | null; // ISO 8601 UTC timestamp
  locationName: string | null;
  latitude: number | null;
  longitude: number | null;
  isMilestone: boolean;
  createdAt: string;
  creator?: EventCreator;
  // Aliases for compatibility
  startsAt?: string;
  locationText?: string | null;
}

export interface CreateEventInput {
  groupId: string;
  title: string;
  description?: string | null;
  targetTime: string; // ISO 8601 UTC string
  endsAt?: string | null;
  locationName?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  isMilestone?: boolean;
}

export interface UpdateEventInput {
  title?: string;
  description?: string | null;
  targetTime?: string;
  endsAt?: string | null;
  locationName?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  isMilestone?: boolean;
}

export interface EventCountdown {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalRemainingMs: number;
  isTargetReached: boolean;
  isPast: boolean;
  formattedText: string;
  shortText: string;
}

export type EventFilterTab = 'ALL' | 'UPCOMING' | 'MILESTONES' | 'PAST';

export interface EventMutationResult {
  success: boolean;
  error?: string;
  event?: EventRecord;
}

export interface FetchEventsResult {
  events: EventRecord[];
  error?: string;
}

export interface SingleEventResult {
  event: EventRecord | null;
  error?: string;
}

/**
 * Validates geographic coordinate boundaries.
 * Latitude must be between -90 and +90.
 * Longitude must be between -180 and +180.
 * Coordinates are optional; both must be provided together if either is given.
 */
export function validateEventCoordinates(
  lat?: number | null,
  lng?: number | null,
): { valid: boolean; error?: string } {
  if (lat === null || lat === undefined) {
    if (lng !== null && lng !== undefined) {
      return { valid: false, error: 'Longitude provided without latitude.' };
    }
    return { valid: true };
  }
  if (lng === null || lng === undefined) {
    return { valid: false, error: 'Latitude provided without longitude.' };
  }
  if (isNaN(lat) || lat < -90 || lat > 90) {
    return { valid: false, error: 'Latitude must be between -90.0 and +90.0 degrees.' };
  }
  if (isNaN(lng) || lng < -180 || lng > 180) {
    return { valid: false, error: 'Longitude must be between -180.0 and +180.0 degrees.' };
  }
  return { valid: true };
}

/**
 * Calculates drift-free countdown breakdown from an absolute target timestamp.
 */
export function calculateEventCountdown(
  targetTime: string | Date,
  now: Date = new Date(),
): EventCountdown {
  const targetMs = typeof targetTime === 'string' ? new Date(targetTime).getTime() : targetTime.getTime();
  const nowMs = now.getTime();

  if (isNaN(targetMs)) {
    return {
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      totalRemainingMs: 0,
      isTargetReached: true,
      isPast: true,
      formattedText: 'Invalid date',
      shortText: '--',
    };
  }

  const remainingMs = targetMs - nowMs;

  if (remainingMs <= 0) {
    return {
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      totalRemainingMs: 0,
      isTargetReached: true,
      isPast: true,
      formattedText: 'Started',
      shortText: 'Now',
    };
  }

  const totalRemainingSeconds = Math.floor(remainingMs / 1000);
  const days = Math.floor(totalRemainingSeconds / 86400);
  const hours = Math.floor((totalRemainingSeconds % 86400) / 3600);
  const minutes = Math.floor((totalRemainingSeconds % 3600) / 60);
  const seconds = totalRemainingSeconds % 60;

  const pad = (n: number) => String(n).padStart(2, '0');

  let formattedText: string;
  let shortText: string;

  if (days > 0) {
    formattedText = `${days}d ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    shortText = `${days}d ${hours}h`;
  } else if (hours > 0) {
    formattedText = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    shortText = `${hours}h ${minutes}m`;
  } else {
    formattedText = `${pad(minutes)}:${pad(seconds)}`;
    shortText = `${minutes}m ${seconds}s`;
  }

  return {
    days,
    hours,
    minutes,
    seconds,
    totalRemainingMs: remainingMs,
    isTargetReached: false,
    isPast: false,
    formattedText,
    shortText,
  };
}

/**
 * Resolves current temporal status of an event.
 */
export function getEventStatus(
  targetTime: string | Date,
  endsAt?: string | Date | null,
  now: Date = new Date(),
): EventStatus {
  const targetMs = typeof targetTime === 'string' ? new Date(targetTime).getTime() : targetTime.getTime();
  const nowMs = now.getTime();

  if (nowMs < targetMs) {
    return 'UPCOMING';
  }

  if (endsAt) {
    const endMs = typeof endsAt === 'string' ? new Date(endsAt).getTime() : endsAt.getTime();
    if (nowMs < endMs) {
      return 'IN_PROGRESS';
    }
  }

  return 'PAST';
}
