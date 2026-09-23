/**
 * Neram Duration Selector Types & Utilities
 * Governs finite group lifespans: Months (0 to 12), Days (0 to 31), Hours (0 to 24).
 */

export type DurationUnit = 'hours' | 'days' | 'months';

export interface DurationValue {
  months: number;
  days: number;
  hours: number;
  totalHours: number;
}

export interface DurationLimits {
  min: number;
  max: number;
  step: number;
}

export const DURATION_LIMITS: Record<DurationUnit, DurationLimits> = {
  hours: { min: 0, max: 24, step: 1 },
  days: { min: 0, max: 31, step: 1 },
  months: { min: 0, max: 12, step: 1 },
};

export interface DurationPreset {
  id: string;
  label: string;
  archetype: string;
  duration: { months: number; days: number; hours: number };
}

export const DURATION_PRESETS: DurationPreset[] = [
  { id: '4h', label: '4 Hours', archetype: 'Outing', duration: { months: 0, days: 0, hours: 4 } },
  { id: '24h', label: '24 Hours', archetype: 'Hackathon', duration: { months: 0, days: 1, hours: 0 } },
  { id: '3d', label: '3 Days', archetype: 'Weekend', duration: { months: 0, days: 3, hours: 0 } },
  { id: '1w', label: '1 Week', archetype: 'Sprint', duration: { months: 0, days: 7, hours: 0 } },
  { id: '1m', label: '1 Month', archetype: 'Project', duration: { months: 1, days: 0, hours: 0 } },
];

/**
 * Calculates total rough hours for validation and sorting.
 */
export function durationToTotalHours(duration: { months: number; days: number; hours: number }): number {
  return duration.months * 30 * 24 + duration.days * 24 + duration.hours;
}

/**
 * Clamps a given unit value to its discrete bounds.
 */
export function clampDurationUnit(unit: DurationUnit, value: number): number {
  const limits = DURATION_LIMITS[unit];
  const rounded = Math.round(value / limits.step) * limits.step;
  return Math.max(limits.min, Math.min(limits.max, rounded));
}

/**
 * Accurately calculates the exact future expiration Date object from a startsAt baseline.
 */
export function calculateExpiryDate(
  startsAt: Date,
  duration: { months: number; days: number; hours: number },
): Date {
  const expiry = new Date(startsAt.getTime());

  if (duration.months > 0) {
    expiry.setMonth(expiry.getMonth() + duration.months);
  }
  if (duration.days > 0) {
    expiry.setDate(expiry.getDate() + duration.days);
  }
  if (duration.hours > 0) {
    expiry.setHours(expiry.getHours() + duration.hours);
  }

  // Ensure minimum 1-hour forward progress if duration evaluates to 0
  if (expiry.getTime() <= startsAt.getTime()) {
    expiry.setHours(expiry.getHours() + 1);
  }

  return expiry;
}

/**
 * Formats duration value into a concise human-readable summary (e.g. "1m 3d 4h" or "4 Hours").
 */
export function formatDurationHuman(duration: { months: number; days: number; hours: number }): string {
  const parts: string[] = [];

  if (duration.months > 0) {
    parts.push(`${duration.months} ${duration.months === 1 ? 'Month' : 'Months'}`);
  }
  if (duration.days > 0) {
    parts.push(`${duration.days} ${duration.days === 1 ? 'Day' : 'Days'}`);
  }
  if (duration.hours > 0) {
    parts.push(`${duration.hours} ${duration.hours === 1 ? 'Hour' : 'Hours'}`);
  }

  if (parts.length === 0) {
    return '1 Hour (Minimum)';
  }

  return parts.join(' ');
}

/**
 * Formats a short badge string (e.g. "1m 3d 4h" or "4h").
 */
export function formatDurationBadge(duration: { months: number; days: number; hours: number }): string {
  const parts: string[] = [];

  if (duration.months > 0) parts.push(`${duration.months}m`);
  if (duration.days > 0) parts.push(`${duration.days}d`);
  if (duration.hours > 0) parts.push(`${duration.hours}h`);

  if (parts.length === 0) return '1h';
  return parts.join(' ');
}

/**
 * 9 Database-backed Group Purpose Archetypes
 * Corresponds to public.group_purpose enum
 */
export type GroupPurpose =
  | 'OUTING'
  | 'PROJECT'
  | 'HACKATHON'
  | 'BIRTHDAY'
  | 'TRIP'
  | 'STUDY'
  | 'SPORTS'
  | 'EVENT'
  | 'CUSTOM';

export type GroupLifecycleState =
  | 'CREATED'
  | 'ACTIVE'
  | 'EXPIRING'
  | 'EXPIRED'
  | 'ARCHIVED'
  | 'PURGED';

export type GroupRole = 'OWNER' | 'ADMIN' | 'MEMBER';

export interface GroupRecord {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  image_path: string | null;
  purpose: GroupPurpose;
  starts_at: string;
  expires_at: string;
  lifecycle_state: GroupLifecycleState;
  created_at: string;
  updated_at: string;
}

export interface GroupMemberRecord {
  group_id: string;
  user_id: string;
  role: GroupRole;
  joined_at: string;
  left_at: string | null;
}

export interface CreateGroupInput {
  name: string;
  description?: string;
  purpose: GroupPurpose;
  duration: { months: number; days: number; hours: number };
  startsAt?: Date;
  initialMemberIds?: string[];
}

export interface GroupPurposeMetadata {
  id: GroupPurpose;
  label: string;
  tagline: string;
  badge: string;
  accentColor: string;
  primaryTool: string;
  defaultDuration: { months: number; days: number; hours: number };
}

export const PURPOSE_METADATA: GroupPurposeMetadata[] = [
  {
    id: 'OUTING',
    label: 'Outing',
    tagline: 'Meetups, road trips, dining & spontaneous gatherings',
    badge: 'Live Map & ETA',
    accentColor: '#38BDF8',
    primaryTool: 'Live Route Tracking',
    defaultDuration: { months: 0, days: 0, hours: 4 },
  },
  {
    id: 'PROJECT',
    label: 'Project',
    tagline: 'Focused teamwork, deliverables & milestones',
    badge: 'Task Board',
    accentColor: '#818CF8',
    primaryTool: 'Milestone Progress',
    defaultDuration: { months: 1, days: 0, hours: 0 },
  },
  {
    id: 'HACKATHON',
    label: 'Hackathon',
    tagline: 'Intense build sprints with deadline countdowns',
    badge: 'Countdown & Tasks',
    accentColor: '#F59E0B',
    primaryTool: 'Sprint Checklist',
    defaultDuration: { months: 0, days: 1, hours: 0 },
  },
  {
    id: 'BIRTHDAY',
    label: 'Birthday',
    tagline: 'Celebrations, surprise parties & event itineraries',
    badge: 'Party Timeline',
    accentColor: '#EC4899',
    primaryTool: 'Event Moments',
    defaultDuration: { months: 0, days: 2, hours: 0 },
  },
  {
    id: 'TRIP',
    label: 'Trip',
    tagline: 'Multi-day travel, excursions & group itineraries',
    badge: 'Daily Schedule',
    accentColor: '#10B981',
    primaryTool: 'Travel Itinerary',
    defaultDuration: { months: 0, days: 7, hours: 0 },
  },
  {
    id: 'STUDY',
    label: 'Study',
    tagline: 'Exam cramming, paper reviews & study circles',
    badge: 'Focus Milestones',
    accentColor: '#6366F1',
    primaryTool: 'Resource Sharing',
    defaultDuration: { months: 0, days: 3, hours: 0 },
  },
  {
    id: 'SPORTS',
    label: 'Sports',
    tagline: 'Matches, team rosters & pitch coordination',
    badge: 'Roster & Venue',
    accentColor: '#14B8A6',
    primaryTool: 'Match Timing',
    defaultDuration: { months: 0, days: 0, hours: 6 },
  },
  {
    id: 'EVENT',
    label: 'Event',
    tagline: 'Concerts, festivals, shows & one-off gatherings',
    badge: 'Venue & Schedule',
    accentColor: '#A855F7',
    primaryTool: 'Event Moments',
    defaultDuration: { months: 0, days: 1, hours: 0 },
  },
  {
    id: 'CUSTOM',
    label: 'Custom',
    tagline: 'Tailored temporary space for your unique plan',
    badge: 'Flexible Space',
    accentColor: '#94A3B8',
    primaryTool: 'Command Modules',
    defaultDuration: { months: 0, days: 0, hours: 12 },
  },
];
