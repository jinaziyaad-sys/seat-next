/**
 * Timezone utilities for edge functions
 * Provides consistent timezone handling across all edge functions
 */

/**
 * Get the local hour for a given UTC time and timezone
 * @param utcTime - Date object in UTC
 * @param timezone - IANA timezone identifier (e.g., 'Africa/Johannesburg')
 * @returns Hour of day (0-23) in the specified timezone
 */
export function getVenueLocalHour(utcTime: Date, timezone: string): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    hour12: false
  });
  const parts = formatter.formatToParts(utcTime);
  const hourPart = parts.find(p => p.type === 'hour');
  return parseInt(hourPart?.value || '0', 10);
}

/**
 * Get the local day of week for a given UTC time and timezone
 * @param utcTime - Date object in UTC
 * @param timezone - IANA timezone identifier (e.g., 'Africa/Johannesburg')
 * @returns Day of week (0 = Sunday, 6 = Saturday) in the specified timezone
 */
export function getVenueLocalDayOfWeek(utcTime: Date, timezone: string): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short'
  });
  const dayStr = formatter.format(utcTime);
  const dayMap: Record<string, number> = {
    'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6
  };
  return dayMap[dayStr] ?? 0;
}

/**
 * Format a UTC timestamp for display in venue's timezone
 * @param isoTimestamp - ISO timestamp string
 * @param timezone - IANA timezone identifier
 * @param format - Output format ('time', 'date', 'datetime')
 * @returns Formatted string in venue's local time
 */
export function formatInVenueTimezone(
  isoTimestamp: string,
  timezone: string,
  format: 'time' | 'date' | 'datetime' = 'datetime'
): string {
  const date = new Date(isoTimestamp);
  
  const options: Intl.DateTimeFormatOptions = { timeZone: timezone };
  
  switch (format) {
    case 'time':
      return date.toLocaleTimeString('en-ZA', { 
        ...options, 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    case 'date':
      return date.toLocaleDateString('en-ZA', options);
    default:
      return date.toLocaleString('en-ZA', options);
  }
}

/**
 * Get the local date components for a given UTC time and timezone
 * @param utcTime - Date object in UTC
 * @param timezone - IANA timezone identifier
 * @returns Object with hour, dayOfWeek, date string
 */
export function getVenueLocalComponents(utcTime: Date, timezone: string): {
  hour: number;
  dayOfWeek: number;
  dateString: string;
} {
  return {
    hour: getVenueLocalHour(utcTime, timezone),
    dayOfWeek: getVenueLocalDayOfWeek(utcTime, timezone),
    dateString: new Intl.DateTimeFormat('en-CA', { 
      timeZone: timezone, 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit' 
    }).format(utcTime)
  };
}

export const DEFAULT_TIMEZONE = 'Africa/Johannesburg';
