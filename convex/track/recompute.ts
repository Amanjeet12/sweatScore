import { v } from 'convex/values';

import { Id } from '../_generated/dataModel';
import { internalMutation, MutationCtx } from '../_generated/server';
import { formatDateInTZ } from '../utils/timezone';
import {
  getDailyPointsTarget,
  getWeeklyTargetDays,
  mondayOf,
  weekDateRange,
  yearMonthOf,
  yearOf,
  yearWeekOf,
} from './helpers';

type DailyTotals = {
  steps: number;
  activeMinutes: number;
  moves: number;
  points: number;
  targetMet: boolean;
};

async function computeDailyTotals(
  ctx: MutationCtx,
  userId: Id<'users'>,
  date: string
): Promise<DailyTotals> {
  const activities = await ctx.db
    .query('dailyActivities')
    .withIndex('by_user_date', (q) => q.eq('userId', userId).eq('date', date))
    .filter((q) => q.or(q.eq(q.field('synced'), true), q.eq(q.field('reviewStatus'), 'approved')))
    .collect();

  const checkIns = await ctx.db
    .query('userCheckIns')
    .withIndex('by_user_date', (q) => q.eq('userId', userId).eq('date', date))
    .collect();

  const completions = await ctx.db
    .query('challengeCompletions')
    .withIndex('by_user_date', (q) => q.eq('userId', userId).eq('date', date))
    .filter((q) => q.neq(q.field('removed'), true))
    .collect();

  const steps = activities.reduce((s, a) => s + (a.steps ?? 0), 0);
  const activeMinutes = activities.reduce((s, a) => s + (a.zone2Minutes ?? 0), 0);
  const moves = completions.length;

  // Mirror Earn screen's monthlyLeaderboard daily contribution exactly:
  // activity.displayTotalPoints (already includes mission + free daily cap)
  // + check-in points + challenge points. Streak bonus is awarded per-week
  // and added at the weekly/monthly rollup level.
  const activityPoints = activities.reduce((s, a) => s + (a.displayTotalPoints ?? 0), 0);
  const checkInPoints = checkIns.reduce((s, c) => s + c.points, 0);
  const challengePoints = completions.reduce((s, c) => s + c.pointsEarned, 0);
  const dailyPoints = Math.floor(activityPoints + checkInPoints + challengePoints);

  const target = await getDailyPointsTarget(ctx);
  const targetMet = moves > 0 || dailyPoints >= target;
  return {
    steps: Math.floor(steps),
    activeMinutes: Math.floor(activeMinutes),
    moves,
    points: dailyPoints,
    targetMet,
  };
}

async function getStreakBonusPerWeek(ctx: MutationCtx): Promise<number> {
  const cfg = await ctx.db
    .query('appConfig')
    .withIndex('by_key', (q) => q.eq('key', 'streakBonusPoints'))
    .unique();
  return cfg ? parseInt(cfg.value, 10) : 0;
}

async function rebuildMonthlyForUser(
  ctx: MutationCtx,
  userId: Id<'users'>,
  yearMonth: string,
  streakBonusPerWeek: number,
  now: number
) {
  const monthDailyRows = await ctx.db
    .query('trackDaily')
    .withIndex('by_user_yearMonth', (q) => q.eq('userId', userId).eq('yearMonth', yearMonth))
    .collect();
  const monthWeeklyForStreak = await ctx.db
    .query('trackWeekly')
    .withIndex('by_user_yearMonthOfStart', (q) =>
      q.eq('userId', userId).eq('yearMonthOfStart', yearMonth)
    )
    .collect();
  const monthStreakBonus =
    monthWeeklyForStreak.filter((w) => w.streakWeek).length * streakBonusPerWeek;
  const points = monthDailyRows.reduce((s, r) => s + r.points, 0) + monthStreakBonus;
  const steps = monthDailyRows.reduce((s, r) => s + r.steps, 0);
  const activeMinutes = monthDailyRows.reduce((s, r) => s + r.activeMinutes, 0);
  const moves = monthDailyRows.reduce((s, r) => s + r.moves, 0);
  const year = yearMonth.slice(0, 4);

  const existing = await ctx.db
    .query('trackMonthly')
    .withIndex('by_user_yearMonth', (q) => q.eq('userId', userId).eq('yearMonth', yearMonth))
    .unique();

  if (existing) {
    await ctx.db.patch(existing._id, {
      steps,
      activeMinutes,
      moves,
      points,
      year,
      updatedAt: now,
    });
  } else if (steps > 0 || activeMinutes > 0 || moves > 0 || points > 0) {
    await ctx.db.insert('trackMonthly', {
      userId,
      yearMonth,
      year,
      steps,
      activeMinutes,
      moves,
      points,
      updatedAt: now,
    });
  }
}

export const recomputeTrackForDate = internalMutation({
  args: {
    userId: v.id('users'),
    date: v.string(),
  },
  handler: async (ctx, { userId, date }) => {
    const yearMonth = yearMonthOf(date);
    const yearWeek = yearWeekOf(date);
    const weekStart = mondayOf(date);
    const yearMonthOfStart = yearMonthOf(weekStart);
    const year = yearOf(date);
    const now = Date.now();

    const newTotals = await computeDailyTotals(ctx, userId, date);
    const streakBonusPerWeek = await getStreakBonusPerWeek(ctx);

    // ---- Daily (absolute) ----
    const existing = await ctx.db
      .query('trackDaily')
      .withIndex('by_user_date', (q) => q.eq('userId', userId).eq('date', date))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        steps: newTotals.steps,
        activeMinutes: newTotals.activeMinutes,
        moves: newTotals.moves,
        points: newTotals.points,
        targetMet: newTotals.targetMet,
        yearMonth,
        yearWeek,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert('trackDaily', {
        userId,
        date,
        yearMonth,
        yearWeek,
        steps: newTotals.steps,
        activeMinutes: newTotals.activeMinutes,
        moves: newTotals.moves,
        points: newTotals.points,
        targetMet: newTotals.targetMet,
        updatedAt: now,
      });
    }

    // ---- Weekly (authoritative) ----
    const targetDaysGoal = getWeeklyTargetDays();
    const weekDates = weekDateRange(weekStart);
    const weekDailyRows = await ctx.db
      .query('trackDaily')
      .withIndex('by_user_yearWeek', (q) => q.eq('userId', userId).eq('yearWeek', yearWeek))
      .collect();
    const dailyByDate = new Map(weekDailyRows.map((r) => [r.date, r]));
    const daysMet = weekDates.reduce(
      (s, dt) => s + (dailyByDate.get(dt)?.targetMet ? 1 : 0),
      0
    );
    const streakWeek = daysMet >= targetDaysGoal;
    const weekSteps = weekDailyRows.reduce((s, r) => s + r.steps, 0);
    const weekActive = weekDailyRows.reduce((s, r) => s + r.activeMinutes, 0);
    const weekMoves = weekDailyRows.reduce((s, r) => s + r.moves, 0);
    const weekDailyPoints = weekDailyRows.reduce((s, r) => s + r.points, 0);
    const weekPoints = weekDailyPoints + (streakWeek ? streakBonusPerWeek : 0);

    const weeklyExisting = await ctx.db
      .query('trackWeekly')
      .withIndex('by_user_yearWeek', (q) => q.eq('userId', userId).eq('yearWeek', yearWeek))
      .unique();
    const prevStreakWeek = weeklyExisting?.streakWeek ?? false;
    const streakChanged = prevStreakWeek !== streakWeek;

    if (weeklyExisting) {
      await ctx.db.patch(weeklyExisting._id, {
        steps: weekSteps,
        activeMinutes: weekActive,
        moves: weekMoves,
        points: weekPoints,
        daysMet,
        targetDaysGoal,
        streakWeek,
        yearMonthOfStart,
        year,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert('trackWeekly', {
        userId,
        yearWeek,
        weekStart,
        yearMonthOfStart,
        year,
        steps: weekSteps,
        activeMinutes: weekActive,
        moves: weekMoves,
        points: weekPoints,
        daysMet,
        targetDaysGoal,
        streakWeek,
        updatedAt: now,
      });
    }

    // ---- Monthly (authoritative) ----
    // Always rebuild the calendar month the day belongs to. Also rebuild the
    // month of the week's Monday (yearMonthOfStart) when it differs — streak
    // bonus for that week is attributed there.
    await rebuildMonthlyForUser(ctx, userId, yearMonth, streakBonusPerWeek, now);
    if (yearMonthOfStart !== yearMonth) {
      await rebuildMonthlyForUser(ctx, userId, yearMonthOfStart, streakBonusPerWeek, now);
    }

    // ---- Lifetime (authoritative from monthly) ----
    const allMonthlies = await ctx.db
      .query('trackMonthly')
      .withIndex('by_user_yearMonth', (q) => q.eq('userId', userId))
      .collect();

    const lifetimeSteps = allMonthlies.reduce((s, r) => s + r.steps, 0);
    const lifetimeActive = allMonthlies.reduce((s, r) => s + r.activeMinutes, 0);
    const lifetimeMoves = allMonthlies.reduce((s, r) => s + r.moves, 0);
    const lifetimePoints = allMonthlies.reduce((s, r) => s + r.points, 0);

    const lifetimeExisting = await ctx.db
      .query('trackLifetime')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .unique();

    const hasActivityToday =
      newTotals.steps > 0 ||
      newTotals.activeMinutes > 0 ||
      newTotals.moves > 0 ||
      newTotals.points > 0;

    if (lifetimeExisting) {
      await ctx.db.patch(lifetimeExisting._id, {
        steps: lifetimeSteps,
        activeMinutes: lifetimeActive,
        moves: lifetimeMoves,
        points: lifetimePoints,
        firstActiveDate:
          hasActivityToday &&
          (!lifetimeExisting.firstActiveDate || date < lifetimeExisting.firstActiveDate)
            ? date
            : lifetimeExisting.firstActiveDate,
        lastActiveDate:
          hasActivityToday &&
          (!lifetimeExisting.lastActiveDate || date > lifetimeExisting.lastActiveDate)
            ? date
            : lifetimeExisting.lastActiveDate,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert('trackLifetime', {
        userId,
        steps: lifetimeSteps,
        activeMinutes: lifetimeActive,
        moves: lifetimeMoves,
        points: lifetimePoints,
        longestWeeklyStreak: streakWeek ? 1 : 0,
        currentWeeklyStreak: streakWeek ? 1 : 0,
        firstActiveDate: hasActivityToday ? date : undefined,
        lastActiveDate: hasActivityToday ? date : undefined,
        updatedAt: now,
      });
    }

    if (streakChanged) {
      await recomputeStreaksHandler(ctx, userId);
    }
  },
});

async function recomputeStreaksHandler(ctx: MutationCtx, userId: Id<'users'>) {
  const rows = await ctx.db
    .query('trackWeekly')
    .withIndex('by_user_weekStart', (q) => q.eq('userId', userId))
    .collect();
  // Ascending by weekStart (YYYY-MM-DD string-sortable).
  rows.sort((a, b) => a.weekStart.localeCompare(b.weekStart));

  // Longest: scan asc, find max run of streakWeek=true rows whose weekStart
  // is exactly 7 days after the previous run member.
  let longest = 0;
  let runLen = 0;
  let prevStart: Date | null = null;
  for (const row of rows) {
    const curStart = new Date(`${row.weekStart}T00:00:00.000Z`);
    const isAdjacent =
      prevStart !== null && curStart.getTime() - prevStart.getTime() === 7 * 86400000;
    if (row.streakWeek && (runLen === 0 || isAdjacent)) {
      runLen += 1;
    } else if (row.streakWeek) {
      runLen = 1;
    } else {
      runLen = 0;
    }
    if (runLen > longest) longest = runLen;
    prevStart = curStart;
  }

  // currentWeeklyStreak: matches Earn screen semantics
  // (see convex/challengeCompletions.ts:getUserStreaksForMonth).
  //   - If the current calendar week is in flight and not yet streakWeek=true,
  //     skip it (don't reset the streak mid-week).
  //   - Then walk back week-by-week counting consecutive streakWeek=true rows
  //     with 7-day adjacency. Break on first miss or gap.
  const user = await ctx.db.get(userId);
  const tz = user?.timezone ?? null;
  const now = new Date();
  const currentMondayStr = mondayOf(formatDateInTZ(now, tz));

  // Walk descending.
  const desc = [...rows].reverse();

  let currentStreak = 0;
  let expectedWeekStart: string | null = null;
  for (let i = 0; i < desc.length; i++) {
    const row = desc[i];
    // Allow skipping the most recent row if it's the current calendar week
    // and not yet a streakWeek (mid-week — don't penalise).
    if (i === 0 && row.weekStart === currentMondayStr && !row.streakWeek) {
      continue;
    }
    if (expectedWeekStart !== null && row.weekStart !== expectedWeekStart) break;
    if (!row.streakWeek) break;
    currentStreak += 1;
    // Next expected weekStart = 7 days earlier.
    const next = new Date(`${row.weekStart}T00:00:00.000Z`);
    next.setUTCDate(next.getUTCDate() - 7);
    expectedWeekStart = next.toISOString().slice(0, 10);
  }

  const lifetimeExisting = await ctx.db
    .query('trackLifetime')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .unique();

  if (lifetimeExisting) {
    await ctx.db.patch(lifetimeExisting._id, {
      longestWeeklyStreak: longest,
      currentWeeklyStreak: currentStreak,
      updatedAt: Date.now(),
    });
  }
}

export const recomputeStreaks = internalMutation({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    await recomputeStreaksHandler(ctx, userId);
  },
});
