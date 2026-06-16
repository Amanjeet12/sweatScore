import { getAuthUserId } from '@convex-dev/auth/server';
import { ConvexError, v } from 'convex/values';

import { Id } from '../_generated/dataModel';
import { query, QueryCtx } from '../_generated/server';
import {
  getUserTimezone,
  todayInTZ,
  weekDateRange,
  yearMonths,
  yearMonthOf,
  yearWeekOf,
  yearOf,
  mondayOf,
} from './helpers';

type DayBucket = {
  date: string;
  steps: number;
  activeMinutes: number;
  moves: number;
  points: number;
  targetMet: boolean;
};

type WeekBucket = {
  yearWeek: string;
  weekStart: string;
  steps: number;
  activeMinutes: number;
  moves: number;
  points: number;
  daysMet: number;
  streakWeek: boolean;
};

type MonthBucket = {
  yearMonth: string;
  steps: number;
  activeMinutes: number;
  moves: number;
  points: number;
};

async function loadWeekDays(
  ctx: QueryCtx,
  userId: Id<'users'>,
  weekStart: string
): Promise<DayBucket[]> {
  const yearWeek = yearWeekOf(weekStart);
  const rows = await ctx.db
    .query('trackDaily')
    .withIndex('by_user_yearWeek', (q) => q.eq('userId', userId).eq('yearWeek', yearWeek))
    .collect();
  const byDate = new Map(rows.map((r) => [r.date, r]));
  return weekDateRange(weekStart).map((d) => {
    const r = byDate.get(d);
    return {
      date: d,
      steps: r?.steps ?? 0,
      activeMinutes: r?.activeMinutes ?? 0,
      moves: r?.moves ?? 0,
      points: r?.points ?? 0,
      targetMet: r?.targetMet ?? false,
    };
  });
}

async function loadMonthWeeks(
  ctx: QueryCtx,
  userId: Id<'users'>,
  yearMonth: string
): Promise<WeekBucket[]> {
  const rows = await ctx.db
    .query('trackWeekly')
    .withIndex('by_user_yearMonthOfStart', (q) =>
      q.eq('userId', userId).eq('yearMonthOfStart', yearMonth)
    )
    .collect();
  rows.sort((a, b) => a.weekStart.localeCompare(b.weekStart));
  return rows.map((r) => ({
    yearWeek: r.yearWeek,
    weekStart: r.weekStart,
    steps: r.steps,
    activeMinutes: r.activeMinutes,
    moves: r.moves,
    points: r.points,
    daysMet: r.daysMet,
    streakWeek: r.streakWeek,
  }));
}

async function loadYearMonths(
  ctx: QueryCtx,
  userId: Id<'users'>,
  year: string
): Promise<MonthBucket[]> {
  const rows = await ctx.db
    .query('trackMonthly')
    .withIndex('by_user_year', (q) => q.eq('userId', userId).eq('year', year))
    .collect();
  const byMonth = new Map(rows.map((r) => [r.yearMonth, r]));
  return yearMonths(year).map((ym) => {
    const r = byMonth.get(ym);
    return {
      yearMonth: ym,
      steps: r?.steps ?? 0,
      activeMinutes: r?.activeMinutes ?? 0,
      moves: r?.moves ?? 0,
      points: r?.points ?? 0,
    };
  });
}

export const getTrackOverview = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError('Unauthorized');

    const tz = await getUserTimezone(ctx, userId);
    const today = todayInTZ(tz);
    const currentYearMonth = yearMonthOf(today);
    const currentYear = yearOf(today);
    const currentWeekStart = mondayOf(today);
    const currentYearWeek = yearWeekOf(today);

    const [lifetime, days, weeks, months] = await Promise.all([
      ctx.db
        .query('trackLifetime')
        .withIndex('by_user', (q) => q.eq('userId', userId))
        .unique(),
      loadWeekDays(ctx, userId, currentWeekStart),
      loadMonthWeeks(ctx, userId, currentYearMonth),
      loadYearMonths(ctx, userId, currentYear),
    ]);

    return {
      lifetime: {
        steps: lifetime?.steps ?? 0,
        activeMinutes: lifetime?.activeMinutes ?? 0,
        moves: lifetime?.moves ?? 0,
        points: lifetime?.points ?? 0,
        longestWeeklyStreak: lifetime?.longestWeeklyStreak ?? 0,
        currentWeeklyStreak: lifetime?.currentWeeklyStreak ?? 0,
      },
      currentWeek: {
        yearWeek: currentYearWeek,
        weekStart: currentWeekStart,
        days,
      },
      currentMonth: {
        yearMonth: currentYearMonth,
        weeks,
      },
      currentYear: {
        year: currentYear,
        months,
      },
    };
  },
});

export const getTrackWeekDays = query({
  args: { weekStart: v.string() },
  handler: async (ctx, { weekStart }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError('Unauthorized');
    return loadWeekDays(ctx, userId, weekStart);
  },
});

export const getTrackMonthWeeks = query({
  args: { yearMonth: v.string() },
  handler: async (ctx, { yearMonth }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError('Unauthorized');
    return loadMonthWeeks(ctx, userId, yearMonth);
  },
});

export const getTrackYearMonths = query({
  args: { year: v.string() },
  handler: async (ctx, { year }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError('Unauthorized');
    return loadYearMonths(ctx, userId, year);
  },
});
