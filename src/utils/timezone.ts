/**
 * Frontend timezone utilities for consistent time display
 */

export const DEFAULT_TIMEZONE = 'Africa/Johannesburg';

/**
 * Common timezones for venue selection
 */
export const TIMEZONE_OPTIONS = [
  { value: 'Africa/Johannesburg', label: 'South Africa (SAST)', offset: '+02:00' },
  { value: 'Africa/Lagos', label: 'West Africa (WAT)', offset: '+01:00' },
  { value: 'Africa/Cairo', label: 'Egypt (EET)', offset: '+02:00' },
  { value: 'Africa/Nairobi', label: 'East Africa (EAT)', offset: '+03:00' },
  { value: 'Europe/London', label: 'UK (GMT/BST)', offset: '+00:00' },
  { value: 'Europe/Paris', label: 'Central Europe (CET)', offset: '+01:00' },
  { value: 'America/New_York', label: 'Eastern US (EST/EDT)', offset: '-05:00' },
  { value: 'America/Los_Angeles', label: 'Pacific US (PST/PDT)', offset: '-08:00' },
  { value: 'Asia/Dubai', label: 'UAE (GST)', offset: '+04:00' },
  { value: 'Asia/Singapore', label: 'Singapore (SGT)', offset: '+08:00' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST/AEDT)', offset: '+10:00' },
] as const;

/**
 * Format a UTC timestamp for display in venue's timezone
 * @param isoTimestamp - ISO timestamp string (UTC)
 * @param venueTimezone - IANA timezone identifier (e.g., 'Africa/Johannesburg')
 * @param format - Output format type
 * @returns Formatted string in venue's local time
 */
export function formatTimeInVenueTimezone(
  isoTimestamp: string,
  venueTimezone: string = DEFAULT_TIMEZONE,
  format: 'time' | 'datetime' | 'date' | 'full' = 'datetime'
): string {
  const date = new Date(isoTimestamp);
  const options: Intl.DateTimeFormatOptions = { timeZone: venueTimezone };
  
  switch (format) {
    case 'time':
      return date.toLocaleTimeString('en-ZA', { 
        ...options, 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    case 'date':
      return date.toLocaleDateString('en-ZA', options);
    case 'full':
      return date.toLocaleString('en-ZA', {
        ...options,
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    default:
      return date.toLocaleString('en-ZA', options);
  }
}

/**
 * Get the current hour in a specific timezone
 * @param timezone - IANA timezone identifier
 * @returns Current hour (0-23) in the specified timezone
 */
export function getCurrentHourInTimezone(timezone: string = DEFAULT_TIMEZONE): number {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    hour12: false
  });
  const parts = formatter.formatToParts(now);
  const hourPart = parts.find(p => p.type === 'hour');
  return parseInt(hourPart?.value || '0', 10);
}

/**
 * Get the current day of week in a specific timezone
 * @param timezone - IANA timezone identifier
 * @returns Day of week (0 = Sunday, 6 = Saturday)
 */
export function getCurrentDayInTimezone(timezone: string = DEFAULT_TIMEZONE): number {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short'
  });
  const dayStr = formatter.format(now);
  const dayMap: Record<string, number> = {
    'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6
  };
  return dayMap[dayStr] ?? 0;
}

/**
 * Get timezone display label from IANA identifier
 * @param timezone - IANA timezone identifier
 * @returns Human-readable timezone label
 */
export function getTimezoneLabel(timezone: string): string {
  const option = TIMEZONE_OPTIONS.find(tz => tz.value === timezone);
  return option?.label || timezone;
}

/**
 * Convert a local date/time to a specific timezone's equivalent
 * Useful for displaying "what time is it there" information
 * @param localDate - Date object in local time
 * @param timezone - Target timezone
 * @returns Formatted time string in target timezone
 */
export function getTimeInTimezone(localDate: Date, timezone: string): string {
  return localDate.toLocaleTimeString('en-ZA', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit'
  });
}
