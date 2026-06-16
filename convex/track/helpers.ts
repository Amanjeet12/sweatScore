import { QueryCtx, MutationCtx } from '../_generated/server';
import { Id } from '../_generated/dataModel';
import { formatDateInTZ, addDaysUTC, ymdUTC, DEFAULT_TZ } from '../utils/timezone';

/**
 * Resolve a user's timezone with safe fallback.
 */
export async function getUserTimezone(
  ctx: QueryCtx | MutationCtx,
  userId: Id<'users'>
): Promise<string> {
  const user = await ctx.db.get(userId);
  return user?.timezone || DEFAULT_TZ;
}

/**
 * Convert a YYYY-MM-DD string (already in user-local tz) to a Date at UTC midnight.
 */
export function parseYmdToUTC(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/**
 * Return ISO year-week key (YYYY-WNN) for a given user-local YYYY-MM-DD.
 * Week starts Monday (matches getMondayInTZ).
 *
 * ISO 8601 week rule: the week containing the year's first Thursday is week 1.
 * The "year" portion in YYYY-WNN may differ from the calendar year for the
 * first/last few days of January/December.
 */
export function yearWeekOf(ymd: string): string {
  const d = parseYmdToUTC(ymd);
  // ISO: Thursday in current week decides the year.
  const day = d.getUTCDay() || 7; // 1..7 with Mon=1
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const isoYear = d.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${isoYear}-W${String(weekNum).padStart(2, '0')}`;
}

/**
 * Year-month key YYYY-MM for a given YYYY-MM-DD.
 */
export function yearMonthOf(ymd: string): string {
  return ymd.slice(0, 7);
}

/**
 * Year key YYYY for a given YYYY-MM-DD.
 */
export function yearOf(ymd: string): string {
  return ymd.slice(0, 4);
}

/**
 * Monday-start week-start YYYY-MM-DD for a given YYYY-MM-DD.
 */
export function mondayOf(ymd: string): string {
  const d = parseYmdToUTC(ymd);
  const dow = d.getUTCDay();
  const offset = dow === 0 ? -6 : 1 - dow;
  d.setUTCDate(d.getUTCDate() + offset);
  return ymdUTC(d);
}

/**
 * Today in the user's timezone.
 */
export function todayInTZ(timezone: string): string {
  return formatDateInTZ(new Date(), timezone);
}

/**
 * Read the daily target (points required for `targetMet` flag) from appConfig,
 * defaulting to 10 (the existing dailyPointsCap default).
 */
export async function getDailyPointsTarget(ctx: QueryCtx | MutationCtx): Promise<number> {
  const cfg = await ctx.db
    .query('appConfig')
    .withIndex('by_key', (q) => q.eq('key', 'dailyPointsTarget'))
    .unique();
  if (cfg) return parseInt(cfg.value, 10);
  const fallback = await ctx.db
    .query('appConfig')
    .withIndex('by_key', (q) => q.eq('key', 'dailyPointsCap'))
    .unique();
  return fallback ? parseInt(fallback.value, 10) : 10;
}

/**
 * Compute the user's weekly target days. Mirrors existing logic in
 * convex/challengeCompletions.ts:getUserStreaksForMonth — for now this is a
 * fixed 5 days/week. Centralised here so future changes are one-edit.
 */
export function getWeeklyTargetDays(): number {
  return 5;
}

/**
 * Range of YYYY-MM-DD strings between weekStart and weekStart+6 inclusive.
 */
export function weekDateRange(weekStart: string): string[] {
  const start = parseYmdToUTC(weekStart);
  return Array.from({ length: 7 }, (_, i) => ymdUTC(addDaysUTC(start, i)));
}

/**
 * Build all 12 yearMonth keys for a given year.
 */
export function yearMonths(year: string): string[] {
  return Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
}
