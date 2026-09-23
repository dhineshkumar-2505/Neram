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
