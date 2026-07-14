import { v } from 'convex/values';

import { Id } from '../_generated/dataModel';
import { internalMutation, MutationCtx } from '../_generated/server';
import { formatDateInTZ } from '../utils/timezone';
import {
  getWeeklyTargetDays,
  mondayOf,
  weekDateRange,
  yearMonthOf,
  yearOf,
  yearWeekOf,
} from './helpers';

const DAILY_STEP_TARGET = 5000;
const DAILY_ACTIVE_MINUTES_TARGET = 50;
const DAILY_CHECK_IN_TARGET = 1;
const DEFAULT_STREAK_BONUS_POINTS = 10;

type DailyTotals = {
  steps: number;
  activeMinutes: number;

  // All normal challenge and daily check-in completions.
  moves: number;

  // Only physical daily check-in video completions.
  dailyCheckIns: number;

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

  /*
   * userCheckIns are created when the app is opened.
   * They can still award points, but they must not mark
   * the physical streak target as completed.
   */
  const appCheckIns = await ctx.db
    .query('userCheckIns')
    .withIndex('by_user_date', (q) => q.eq('userId', userId).eq('date', date))
    .collect();

  const completions = await ctx.db
    .query('challengeCompletions')
    .withIndex('by_user_date', (q) => q.eq('userId', userId).eq('date', date))
    .filter((q) => q.neq(q.field('removed'), true))
    .collect();

  const steps = activities.reduce((sum, activity) => sum + (activity.steps ?? 0), 0);

  const activeMinutes = activities.reduce((sum, activity) => sum + (activity.zone2Minutes ?? 0), 0);

  /*
   * Keep all challenge completions as moves.
   * A normal challenge still increases the user's
   * challenge/move statistics.
   */
  const moves = completions.length;

  /*
   * Load the challenge belonging to every completion
   * so normal challenges can be separated from physical
   * daily check-in videos.
   */
  const completedChallenges = await Promise.all(
    completions.map((completion) => ctx.db.get(completion.challengeId))
  );

  /*
   * Only challenges configured with:
   *
   * isDailyChallenge = true
   * dailyChallengeType = 'check_in'
   *
   * are counted as physical daily check-ins.
   */
  const dailyCheckIns = completions.filter((completion, index) => {
    const challenge = completedChallenges[index];

    return completion.dailyWindowStartAt !== undefined || challenge?.isDailyChallenge === true;
  }).length;

  /*
   * Point calculation remains unchanged:
   *
   * activity points
   * + app-open check-in points
   * + challenge points
   *
   * The weekly streak bonus is added later.
   */
  const activityPoints = activities.reduce(
    (sum, activity) => sum + (activity.displayTotalPoints ?? 0),
    0
  );

  const appCheckInPoints = appCheckIns.reduce((sum, checkIn) => sum + checkIn.points, 0);

  const challengePoints = completions.reduce((sum, completion) => sum + completion.pointsEarned, 0);

  const dailyPoints = Math.floor(activityPoints + appCheckInPoints + challengePoints);

  /*
   * A day counts toward the weekly streak only when
   * any one physical target is completed:
   *
   * 1. 5,000 steps
   * 2. 50 active minutes
   * 3. One physical daily check-in video
   *
   * A normal challenge does not mark targetMet.
   * Opening the app does not mark targetMet.
   */
  const stepTargetReached = steps >= DAILY_STEP_TARGET;

  const activeMinutesTargetReached = activeMinutes >= DAILY_ACTIVE_MINUTES_TARGET;

  const dailyCheckInTargetReached = dailyCheckIns >= DAILY_CHECK_IN_TARGET;

  const targetMet = stepTargetReached || activeMinutesTargetReached || dailyCheckInTargetReached;

  return {
    steps: Math.floor(steps),
    activeMinutes: Math.floor(activeMinutes),
    moves,
    dailyCheckIns,
    points: dailyPoints,
    targetMet,
  };
}

async function getStreakBonusPerWeek(ctx: MutationCtx): Promise<number> {
  const config = await ctx.db
    .query('appConfig')
    .withIndex('by_key', (q) => q.eq('key', 'streakBonusPoints'))
    .unique();

  const configuredPoints = config ? parseInt(config.value, 10) : DEFAULT_STREAK_BONUS_POINTS;

  return Number.isFinite(configuredPoints) ? configuredPoints : DEFAULT_STREAK_BONUS_POINTS;
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

  const completedStreakWeeks = monthWeeklyForStreak.filter((week) => week.streakWeek).length;

  const monthStreakBonus = completedStreakWeeks * streakBonusPerWeek;

  const points = monthDailyRows.reduce((sum, row) => sum + row.points, 0) + monthStreakBonus;

  const steps = monthDailyRows.reduce((sum, row) => sum + row.steps, 0);

  const activeMinutes = monthDailyRows.reduce((sum, row) => sum + row.activeMinutes, 0);

  const moves = monthDailyRows.reduce((sum, row) => sum + row.moves, 0);

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

    return;
  }

  const hasMonthlyData = steps > 0 || activeMinutes > 0 || moves > 0 || points > 0;

  if (!hasMonthlyData) {
    return;
  }

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

    // ----------------------------------
    // Daily rollup
    // ----------------------------------

    const existingDaily = await ctx.db
      .query('trackDaily')
      .withIndex('by_user_date', (q) => q.eq('userId', userId).eq('date', date))
      .unique();

    if (existingDaily) {
      await ctx.db.patch(existingDaily._id, {
        steps: newTotals.steps,

        activeMinutes: newTotals.activeMinutes,

        moves: newTotals.moves,

        dailyCheckIns: newTotals.dailyCheckIns,

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

        dailyCheckIns: newTotals.dailyCheckIns,

        points: newTotals.points,

        targetMet: newTotals.targetMet,

        updatedAt: now,
      });
    }

    // ----------------------------------
    // Weekly rollup
    // ----------------------------------

    const targetDaysGoal = getWeeklyTargetDays();

    const weekDates = weekDateRange(weekStart);

    const weekDailyRows = await ctx.db
      .query('trackDaily')
      .withIndex('by_user_yearWeek', (q) => q.eq('userId', userId).eq('yearWeek', yearWeek))
      .collect();

    const dailyByDate = new Map(weekDailyRows.map((row) => [row.date, row]));

    const daysMet = weekDates.reduce(
      (total, weekDate) => total + (dailyByDate.get(weekDate)?.targetMet ? 1 : 0),
      0
    );

    const streakWeek = daysMet >= targetDaysGoal;

    const weekSteps = weekDailyRows.reduce((sum, row) => sum + row.steps, 0);

    const weekActive = weekDailyRows.reduce((sum, row) => sum + row.activeMinutes, 0);

    const weekMoves = weekDailyRows.reduce((sum, row) => sum + row.moves, 0);

    const weekDailyPoints = weekDailyRows.reduce((sum, row) => sum + row.points, 0);

    const weekPoints = weekDailyPoints + (streakWeek ? streakBonusPerWeek : 0);

    const weeklyExisting = await ctx.db
      .query('trackWeekly')
      .withIndex('by_user_yearWeek', (q) => q.eq('userId', userId).eq('yearWeek', yearWeek))
      .unique();

    const previousStreakWeek = weeklyExisting?.streakWeek ?? false;

    const streakChanged = previousStreakWeek !== streakWeek;

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

    // ----------------------------------
    // Monthly rollup
    // ----------------------------------

    await rebuildMonthlyForUser(ctx, userId, yearMonth, streakBonusPerWeek, now);

    /*
     * When the week starts in a
     * different calendar month,
     * rebuild that month as well.
     */
    if (yearMonthOfStart !== yearMonth) {
      await rebuildMonthlyForUser(ctx, userId, yearMonthOfStart, streakBonusPerWeek, now);
    }

    // ----------------------------------
    // Lifetime rollup
    // ----------------------------------

    const allMonthlies = await ctx.db
      .query('trackMonthly')
      .withIndex('by_user_yearMonth', (q) => q.eq('userId', userId))
      .collect();

    const lifetimeSteps = allMonthlies.reduce((sum, row) => sum + row.steps, 0);

    const lifetimeActive = allMonthlies.reduce((sum, row) => sum + row.activeMinutes, 0);

    const lifetimeMoves = allMonthlies.reduce((sum, row) => sum + row.moves, 0);

    const lifetimePoints = allMonthlies.reduce((sum, row) => sum + row.points, 0);

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

  rows.sort((first, second) => first.weekStart.localeCompare(second.weekStart));

  // ----------------------------------
  // Longest weekly streak
  // ----------------------------------

  let longest = 0;
  let runLength = 0;
  let previousStart: Date | null = null;

  for (const row of rows) {
    const currentStart = new Date(`${row.weekStart}T00:00:00.000Z`);

    const isAdjacent =
      previousStart !== null && currentStart.getTime() - previousStart.getTime() === 7 * 86_400_000;

    if (row.streakWeek && (runLength === 0 || isAdjacent)) {
      runLength += 1;
    } else if (row.streakWeek) {
      runLength = 1;
    } else {
      runLength = 0;
    }

    if (runLength > longest) {
      longest = runLength;
    }

    previousStart = currentStart;
  }

  // ----------------------------------
  // Current weekly streak
  // ----------------------------------

  const user = await ctx.db.get(userId);

  const timezone = user?.timezone ?? null;

  const currentMonday = mondayOf(formatDateInTZ(new Date(), timezone));

  const descendingRows = [...rows].reverse();

  let currentStreak = 0;

  let expectedWeekStart: string | null = null;

  for (let index = 0; index < descendingRows.length; index += 1) {
    const row = descendingRows[index];

    /*
     * Do not reset an existing streak
     * while the current week is still
     * in progress.
     */
    if (index === 0 && row.weekStart === currentMonday && !row.streakWeek) {
      continue;
    }

    if (expectedWeekStart !== null && row.weekStart !== expectedWeekStart) {
      break;
    }

    if (!row.streakWeek) {
      break;
    }

    currentStreak += 1;

    const previousWeek = new Date(`${row.weekStart}T00:00:00.000Z`);

    previousWeek.setUTCDate(previousWeek.getUTCDate() - 7);

    expectedWeekStart = previousWeek.toISOString().slice(0, 10);
  }

  const lifetimeExisting = await ctx.db
    .query('trackLifetime')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .unique();

  if (!lifetimeExisting) {
    return;
  }

  await ctx.db.patch(lifetimeExisting._id, {
    longestWeeklyStreak: longest,

    currentWeeklyStreak: currentStreak,

    updatedAt: Date.now(),
  });
}

export const recomputeStreaks = internalMutation({
  args: {
    userId: v.id('users'),
  },

  handler: async (ctx, { userId }) => {
    await recomputeStreaksHandler(ctx, userId);
  },
});
