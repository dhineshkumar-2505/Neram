import { Share } from 'react-native';
import type { EventRecord } from '../types';

/**
 * Formats a JavaScript Date into iCalendar UTC timestamp: YYYYMMDDTHHmmssZ.
 */
export function formatICalUtcDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const year = date.getUTCFullYear();
  const month = pad(date.getUTCMonth() + 1);
  const day = pad(date.getUTCDate());
  const hours = pad(date.getUTCHours());
  const minutes = pad(date.getUTCMinutes());
  const seconds = pad(date.getUTCSeconds());
  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}

/**
 * Generates an RFC 5545 compliant iCalendar (.ics) string for an event.
 */
export function generateICalendarData(event: EventRecord): string {
  const startDate = new Date(event.targetTime);
  // Default end time: 1 hour after target start time if not provided
  const endDate = event.endsAt ? new Date(event.endsAt) : new Date(startDate.getTime() + 60 * 60 * 1000);

  const dtStamp = formatICalUtcDate(new Date());
  const dtStart = formatICalUtcDate(startDate);
  const dtEnd = formatICalUtcDate(endDate);

  const cleanTitle = (event.title || 'Neram Event').replace(/\r?\n/g, ' ');
  const cleanDescription = (event.description || '').replace(/\r?\n/g, '\\n');
  const cleanLocation = (event.locationName || '').replace(/\r?\n/g, ' ');

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Neram Platform//Itinerary Engine//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${event.id}@neram.app`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${cleanTitle}`,
  ];

  if (cleanDescription) {
    lines.push(`DESCRIPTION:${cleanDescription}`);
  }

  if (cleanLocation) {
    lines.push(`LOCATION:${cleanLocation}`);
  }

  if (event.latitude !== null && event.longitude !== null && event.latitude !== undefined && event.longitude !== undefined) {
    lines.push(`GEO:${event.latitude.toFixed(6)};${event.longitude.toFixed(6)}`);
  }

  lines.push('STATUS:CONFIRMED');
  lines.push('END:VEVENT');
  lines.push('END:VCALENDAR');

  return lines.join('\r\n');
}

/**
 * Builds a direct Google Calendar Web Intent URL for seamless browser scheduling.
 */
export function buildGoogleCalendarUrl(event: EventRecord): string {
  const startDate = new Date(event.targetTime);
  const endDate = event.endsAt ? new Date(event.endsAt) : new Date(startDate.getTime() + 60 * 60 * 1000);

  const dtStart = formatICalUtcDate(startDate);
  const dtEnd = formatICalUtcDate(endDate);

  const text = encodeURIComponent(event.title || 'Neram Event');
  const dates = encodeURIComponent(`${dtStart}/${dtEnd}`);
  const details = encodeURIComponent(event.description || '');
  const location = encodeURIComponent(event.locationName || '');

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${dates}&details=${details}&location=${location}`;
}

export const calendarExportService = {
  /**
   * Exports the event via device share sheet, sharing the iCalendar content and Google Calendar URL.
   */
  async exportToDeviceCalendar(event: EventRecord): Promise<{ success: boolean; method: 'SHARE' | 'URL'; error?: string }> {
    try {
      const icsData = generateICalendarData(event);
      const googleCalUrl = buildGoogleCalendarUrl(event);

      const message = [
        `Event: ${event.title}`,
        event.locationName ? `Location: ${event.locationName}` : '',
        `Date: ${new Date(event.targetTime).toLocaleString()}`,
        '',
        `Add to Calendar: ${googleCalUrl}`,
        '',
        '--- iCalendar (.ics) Data ---',
        icsData,
      ]
        .filter(Boolean)
        .join('\n');

      const result = await Share.share({
        title: `Calendar Invite: ${event.title}`,
        message,
      });

      if (result.action === Share.sharedAction) {
        return { success: true, method: 'SHARE' };
      }

      return { success: true, method: 'SHARE' };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to export calendar entry.';
      return { success: false, method: 'SHARE', error: message };
    }
  },
};
