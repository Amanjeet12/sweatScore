import { getAuthUserId } from '@convex-dev/auth/server';
import { ConvexError, v } from 'convex/values';

import { query, mutation } from './_generated/server';
import { getUserTimezone, mondayOf, todayInTZ, yearMonthOf, yearWeekOf } from './track/helpers';

function addMonths(yearMonth: string, offset: number) {
  const [year, month] = yearMonth.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1 + offset, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(yearMonth: string) {
  const [year, month] = yearMonth.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', { month: 'short' }).format(
    new Date(Date.UTC(year, month - 1, 1))
  );
}

export const getDashboard = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError('Unauthorized');

    const timezone = await getUserTimezone(ctx, userId);
    const today = todayInTZ(timezone);
    const yearMonth = yearMonthOf(today);
    const currentWeekStart = mondayOf(today);
    const currentYear = Number(yearMonth.slice(0, 4));

    const [
      lifetime,
      monthly,
      photos,
      completions,
      banner,
      leaderboard,
      thisYear,
      lastYear,
      currentMonthDays,
      currentWeekDays,
    ] = await Promise.all([
      ctx.db
        .query('trackLifetime')
        .withIndex('by_user', (q) => q.eq('userId', userId))
        .unique(),
      ctx.db
        .query('trackMonthly')
        .withIndex('by_user_yearMonth', (q) => q.eq('userId', userId).eq('yearMonth', yearMonth))
        .unique(),
      ctx.db
        .query('progressPhotos')
        .withIndex('by_user', (q) => q.eq('userId', userId))
        .collect(),
      ctx.db
        .query('challengeCompletions')
        .withIndex('by_user', (q) => q.eq('userId', userId))
        .filter((q) => q.neq(q.field('removed'), true))
        .collect(),
      ctx.db.query('rewardsBannerImage').first(),
      ctx.db
        .query('monthlyLeaderboard')
        .withIndex('by_user_and_year_month', (q) =>
          q.eq('userId', userId).eq('yearMonth', yearMonth)
        )
        .first(),
      ctx.db
        .query('trackMonthly')
        .withIndex('by_user_year', (q) => q.eq('userId', userId).eq('year', String(currentYear)))
        .collect(),
      ctx.db
        .query('trackMonthly')
        .withIndex('by_user_year', (q) =>
          q.eq('userId', userId).eq('year', String(currentYear - 1))
        )
        .collect(),
      ctx.db
        .query('trackDaily')
        .withIndex('by_user_yearMonth', (q) => q.eq('userId', userId).eq('yearMonth', yearMonth))
        .collect(),
      ctx.db
        .query('trackDaily')
        .withIndex('by_user_yearWeek', (q) =>
          q.eq('userId', userId).eq('yearWeek', yearWeekOf(today))
        )
        .collect(),
    ]);

    const challengeCache = new Map<string, any>();
    const challengeFor = async (challengeId: (typeof completions)[number]['challengeId']) => {
      const key = String(challengeId);
      if (!challengeCache.has(key)) challengeCache.set(key, await ctx.db.get(challengeId));
      return challengeCache.get(key);
    };

    const monthCompletions = completions.filter((completion) =>
      completion.date.startsWith(yearMonth)
    );
    const completionKinds = await Promise.all(
      monthCompletions.map(async (completion) => ({
        completion,
        challenge: await challengeFor(completion.challengeId),
      }))
    );
    const completedCheckIns = completionKinds.filter(
      ({ challenge }) =>
        challenge?.type === 'check_in' || challenge?.dailyChallengeType === 'check_in'
    ).length;

    const challengeCompletionsByMonth = new Map<string, number>();
    await Promise.all(
      completions.map(async (completion) => {
        const challenge = await challengeFor(completion.challengeId);
        if (
          !challenge ||
          challenge.type === 'check_in' ||
          challenge.dailyChallengeType === 'check_in'
        )
          return;
        const month = completion.date.slice(0, 7);
        challengeCompletionsByMonth.set(month, (challengeCompletionsByMonth.get(month) ?? 0) + 1);
      })
    );

    const monthlyByKey = new Map([...lastYear, ...thisYear].map((row) => [row.yearMonth, row]));
    const trendMonths = Array.from({ length: 12 }, (_, index) =>
      addMonths(yearMonth, index - 11)
    ).map((month) => {
      const row = monthlyByKey.get(month);
      return {
        key: month,
        label: monthLabel(month),
        points: row?.points ?? 0,
        steps: row?.steps ?? 0,
        activeMinutes: row?.activeMinutes ?? 0,
        challenges: challengeCompletionsByMonth.get(month) ?? 0,
      };
    });

    const photoEntries = await Promise.all(
      photos
        .sort((a, b) => a.weekStart.localeCompare(b.weekStart))
        .map(async (photo) => ({
          _id: photo._id,
          weekStart: photo.weekStart,
          frontUrl: await ctx.storage.getUrl(photo.frontPhoto),
          sideUrl: photo.sidePhoto ? await ctx.storage.getUrl(photo.sidePhoto) : null,
        }))
    );

    const challengeCountForDates = async (dates: Set<string>) => {
      const matching = await Promise.all(
        completions
          .filter((completion) => dates.has(completion.date))
          .map(async (completion) => ({
            completion,
            challenge: await challengeFor(completion.challengeId),
          }))
      );
      return matching.filter(
        ({ challenge }) =>
          Boolean(challenge) &&
          challenge?.type !== 'check_in' &&
          challenge?.dailyChallengeType !== 'check_in'
      ).length;
    };

    const trendMonthWeeks = Array.from(
      new Set(currentMonthDays.map((row) => mondayOf(row.date)))
    ).sort();
    const monthTrend = await Promise.all(
      trendMonthWeeks.map(async (weekStart, index) => {
        const rows = currentMonthDays.filter((row) => mondayOf(row.date) === weekStart);
        const dates = new Set(rows.map((row) => row.date));
        return {
          key: weekStart,
          label: `W${index + 1}`,
          points: rows.reduce((sum, row) => sum + row.points, 0),
          steps: rows.reduce((sum, row) => sum + row.steps, 0),
          activeMinutes: rows.reduce((sum, row) => sum + row.activeMinutes, 0),
          challenges: await challengeCountForDates(dates),
        };
      })
    );
    const weekTrend = await Promise.all(
      Array.from({ length: 7 }, (_, index) => {
        const date = new Date(`${currentWeekStart}T00:00:00.000Z`);
        date.setUTCDate(date.getUTCDate() + index);
        const key = date.toISOString().slice(0, 10);
        const row = currentWeekDays.find((day) => day.date === key);
        return { key, row, label: ['M', 'T', 'W', 'T', 'F', 'S', 'S'][index] };
      }).map(async ({ key, row, label }) => ({
        key,
        label,
        points: row?.points ?? 0,
        steps: row?.steps ?? 0,
        activeMinutes: row?.activeMinutes ?? 0,
        challenges: await challengeCountForDates(new Set([key])),
      }))
    );

    return {
      currentMonth: yearMonth,
      currentWeekStart,
      canLogCurrentWeek: !photos.some((photo) => photo.weekStart === currentWeekStart),
      summary: {
        currentStreak: lifetime?.currentWeeklyStreak ?? 0,
        monthPoints: monthly?.points ?? 0,
        completedCheckIns,
      },
      photos: photoEntries,
      trend: { year: trendMonths, month: monthTrend, week: weekTrend },
      lifetime: {
        points: lifetime?.points ?? 0,
        steps: lifetime?.steps ?? 0,
        activeMinutes: lifetime?.activeMinutes ?? 0,
        challenges: lifetime?.moves ?? 0,
      },
      monthlyGoal: banner
        ? {
            title: banner.title?.trim() || 'Monthly challenge',
            targetPoints: banner.targetPoints ?? 500,
            earnedPoints: leaderboard?.displayTotalPoints ?? 0,
          }
        : null,
    };
  },
});

export const create = mutation({
  args: {
    frontPhoto: v.id('_storage'),
    sidePhoto: v.optional(v.id('_storage')),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError('Unauthorized');

    const timezone = await getUserTimezone(ctx, userId);
    const weekStart = mondayOf(todayInTZ(timezone));
    const existing = await ctx.db
      .query('progressPhotos')
      .withIndex('by_user_week', (q) => q.eq('userId', userId).eq('weekStart', weekStart))
      .unique();
    if (existing) throw new ConvexError('You have already logged this week’s progress photo.');

    return await ctx.db.insert('progressPhotos', {
      userId,
      weekStart,
      frontPhoto: args.frontPhoto,
      ...(args.sidePhoto ? { sidePhoto: args.sidePhoto } : {}),
      createdAt: Date.now(),
    });
  },
});
