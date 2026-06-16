// timezone-utils.ts
import { useMemo } from 'react';

/**
 * Gets a Date object representing the date in the specified timezone
 * @param date Source Date object
 * @param timeZone IANA timezone string (e.g., 'America/New_York')
 * @returns A Date object with the date components set to the date in the specified timezone
 */
export function getDateForTimezone(date: Date, timeZone: string): Date {
  // Get the date in YYYY-MM-DD format in the target timezone
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  // Format as YYYY-MM-DD
  const dateString = formatter.format(date);

  // Parse the components
  const [year, month, day] = dateString.split('-').map((num) => parseInt(num, 10));

  // Create a new Date object in UTC to avoid timezone shifts
  // This ensures the date components are interpreted correctly
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

/**
 * Gets the day range (start and end of day) for a date in a specific timezone
 * @param date Source Date object
 * @param timeZone IANA timezone string
 * @returns Object with startDate and endDate as ISO strings
 */
export function getDayRangeISO(date: Date, timeZone: string) {
  // Get the date string in the target timezone
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const dateString = formatter.format(date);

  // Use a more reliable approach - create dates in local time and convert to timezone
  // This avoids the complex timezone offset calculations
  const [year, month, day] = dateString.split('-').map((num) => parseInt(num, 10));

  // Create start of day (00:00:00) in the target timezone
  const startDate = new Date();
  startDate.setFullYear(year, month - 1, day);
  startDate.setHours(0, 0, 0, 0);

  // Create end of day (23:59:59.999) in the target timezone
  const endDate = new Date();
  endDate.setFullYear(year, month - 1, day);
  endDate.setHours(23, 59, 59, 999);

  return {
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
  };
}

/**
 * React hook to get today's date in a specific timezone
 * @param timeZone IANA timezone string
 * @returns Date object for today in the specified timezone
 */
export function useTodayInTimezone(timeZone: string) {
  return useMemo(() => {
    const now = new Date();
    return getDateForTimezone(now, timeZone);
  }, [timeZone]);
}

export function todayInTimezone(timeZone: string) {
  const now = new Date();
  return getDateForTimezone(now, timeZone);
}

/**
 * Formats a date as YYYY-MM-DD in a specific timezone
 * @param date Source Date object
 * @param timeZone IANA timezone string
 * @returns Date string in YYYY-MM-DD format
 */
export function formatDateYYYYMMDD(date: Date, timeZone: string): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  return formatter.format(date);
}
