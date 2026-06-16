/**
 * Returns the inclusive number of days remaining in the current month
 * (including today). Uses local device time. Always >= 1 while still
 * inside the month.
 *
 * Example: today = 2026-05-11, May has 31 days → returns 21.
 */
export function daysRemainingInMonth(now: Date = new Date()): number {
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed
  // Day 0 of next month === last day of current month
  const lastDay = new Date(year, month + 1, 0).getDate();
  const today = now.getDate();
  return lastDay - today + 1;
}

/**
 * Returns the current month name in long form, e.g. "May 2026".
 */
export function formatMonthLong(now: Date = new Date()): string {
  return now.toLocaleString('en-US', { month: 'long', year: 'numeric' });
}
