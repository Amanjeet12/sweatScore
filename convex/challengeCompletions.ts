import { getAuthUserId } from '@convex-dev/auth/server';
import { ShardedCounter } from '@convex-dev/sharded-counter';
import { ConvexError, v } from 'convex/values';

import { components, internal } from './_generated/api';
import { Id } from './_generated/dataModel';
import { internalMutation, mutation, query, QueryCtx, MutationCtx } from './_generated/server';
import { addDaysUTC, formatDateInTZ, getMondayInTZ, ymdUTC } from './utils/timezone';
import { getStreakEarnedDatesInRange } from './utils/streak';

const challengeCounter = new ShardedCounter(components.shardedCounter);
const MAX_DAILY_CHALLENGE_COMPLETIONS = 5;
const FIRST_ATTEMPT_VIDEO_STORAGE_ID = 'kg2c6mtdj1x0rj97br01j2exhn89mqac' as Id<'_storage'>;


async function getDailyPointsEarned(
  ctx: QueryCtx | MutationCtx,
  userId: Id<'users'>,
  date: string
): Promise<number> {
  const completions = await ctx.db
    .query('challengeCompletions')
    .withIndex('by_user_date', (q) => q.eq('userId', userId).eq('date', date))
    .collect();
  const challengePoints = completions.reduce((sum, c) => sum + c.pointsEarned, 0);

  const activities = await ctx.db
    .query('dailyActivities')
    .withIndex('by_user_date', (q) => q.eq('userId', userId).eq('date', date))
    .filter((q) => q.or(q.eq(q.field('synced'), true), q.eq(q.field('reviewStatus'), 'approved')))
    .collect();
  const activityPoints = activities.reduce((sum, a) => sum + (a.displayTotalPoints ?? 0), 0);

  const checkIns = await ctx.db
    .query('userCheckIns')
    .withIndex('by_user_date', (q) => q.eq('userId', userId).eq('date', date))
    .collect();
  const checkInPoints = checkIns.reduce((sum, c) => sum + c.points, 0);

  return challengePoints + activityPoints + checkInPoints;
}

export async function getDailyPointsCap(ctx: QueryCtx | MutationCtx): Promise<number> {
  const cfg = await ctx.db
    .query('appConfig')
    .withIndex('by_key', (q) => q.eq('key', 'dailyPointsCap'))
    .unique();
  return cfg ? parseInt(cfg.value, 10) : 10;
}

type PointSource = 'challenge' | 'activity' | 'checkin';

export async function applyFreeDailyCap(
  ctx: QueryCtx | MutationCtx,
  userId: Id<'users'>,
  date: string,
  rawPoints: number,
  source: PointSource
): Promise<number> {
  const user = await ctx.db.get(userId);
  if (user?.isPremium || user?.isAdmin) return rawPoints;

  const cap = await getDailyPointsCap(ctx);

  let otherSources = 0;
  // Always count existing challenge completions: challenge inserts a new row
  // per call, so prior completions on the same day must contribute to the cap.
  // (Activity/checkin use single-row-per-day with update paths, so they
  // self-exclude below to avoid double-counting the row being replaced.)
  const completions = await ctx.db
    .query('challengeCompletions')
    .withIndex('by_user_date', (q) => q.eq('userId', userId).eq('date', date))
    .filter((q) => q.neq(q.field('removed'), true))
    .collect();
  otherSources += completions.reduce((s, c) => s + c.pointsEarned, 0);
  if (source !== 'activity') {
    const activities = await ctx.db
      .query('dailyActivities')
      .withIndex('by_user_date', (q) => q.eq('userId', userId).eq('date', date))
      .filter((q) => q.or(q.eq(q.field('synced'), true), q.eq(q.field('reviewStatus'), 'approved')))
      .collect();
    otherSources += activities.reduce((s, a) => s + (a.displayTotalPoints ?? 0), 0);
  }
  if (source !== 'checkin') {
    const checkIns = await ctx.db
      .query('userCheckIns')
      .withIndex('by_user_date', (q) => q.eq('userId', userId).eq('date', date))
      .collect();
    otherSources += checkIns.reduce((s, c) => s + c.points, 0);
  }

  return Math.max(0, Math.min(rawPoints, cap - otherSources));
}

export const completeChallenge = mutation({
  args: {
    challengeId: v.id('challenges'),
    videoStorageId: v.optional(v.id('_storage')),
    allowRepost: v.optional(v.boolean()),
    caption: v.optional(v.string()),
    // Accepted but ignored — older app builds still send this field. Kept
    // here as a back-compat shim to prevent ArgumentValidationError. Safe to
    // drop once the minimum supported app version no longer sends it.
    recordedDurationSec: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError('Unauthorized');
    }

    const challenge = await ctx.db.get(args.challengeId);
    if (!challenge) {
      throw new ConvexError('Challenge not found');
    }
    if (!challenge.isPublished) {
      throw new ConvexError('Challenge is not available');
    }

    const user = await ctx.db.get(userId);
    if (!user) {
      throw new ConvexError('User not found');
    }

    // Check end date (in user's local timezone)
    const todayStr = formatDateInTZ(new Date(), user.timezone);
    if (challenge.endDate && todayStr >= challenge.endDate) {
      throw new ConvexError('Challenge has ended');
    }

    // Check lock for non-premium, non-admin users
    if (challenge.isLocked) {
      if (!user.isPremium && !user.isAdmin) {
        throw new ConvexError('Premium required');
      }
    }

    // Check cooldown — already completed today?
    const existingCompletion = await ctx.db
      .query('challengeCompletions')
      .withIndex('by_user_challenge_date', (q) =>
        q.eq('userId', userId).eq('challengeId', args.challengeId).eq('date', todayStr)
      )
      .unique();

    if (existingCompletion) {
      throw new ConvexError('Already completed today');
    }

    const todayCompletions = await ctx.db
      .query('challengeCompletions')
      .withIndex('by_user_date', (q) => q.eq('userId', userId).eq('date', todayStr))
      .filter((q) => q.neq(q.field('removed'), true))
      .collect();

    if (todayCompletions.length >= MAX_DAILY_CHALLENGE_COMPLETIONS) {
      throw new ConvexError('Daily challenge limit reached');
    }

    // Record completion
    const repostBonus = args.allowRepost ? 3 : 0;
    const rawPoints = challenge.points + repostBonus;
    const totalPoints = await applyFreeDailyCap(ctx, userId, todayStr, rawPoints, 'challenge');

    const previousCompletions = await ctx.db
      .query('challengeCompletions')
      .withIndex('by_user_challenge_date', (q) =>
        q.eq('userId', userId).eq('challengeId', args.challengeId)
      )
      .filter((q) => q.neq(q.field('removed'), true))
      .collect();

    const sortedPreviousCompletions = previousCompletions.sort(
      (a, b) => a._creationTime - b._creationTime
    );

    const attemptNumber = sortedPreviousCompletions.length + 1;

    const day1Completion = sortedPreviousCompletions.find(
      (completion) => completion.videoStorageId
    );

    const completionId = await ctx.db.insert('challengeCompletions', {
      userId,
      challengeId: args.challengeId,
      date: todayStr,
      pointsEarned: totalPoints,
      videoStorageId: args.videoStorageId,
      allowRepost: args.allowRepost,
      caption: args.caption,
      removed: false,

      attemptNumber,
      comparisonMode: day1Completion?.videoStorageId ? 'day1_vs_current' : 'day1_baseline',

      ...(day1Completion?._id ? { day1CompletionId: day1Completion._id } : {}),

      ...(day1Completion?.videoStorageId
        ? { comparisonBaseVideoStorageId: day1Completion.videoStorageId }
        : {}),
    });

    // Increment total completion count on the challenge
    await ctx.db.patch(args.challengeId, {
      totalCompletions: (challenge.totalCompletions ?? 0) + 1,
    });

    // Increment sharded counter for today's completions
    await challengeCounter.add(ctx, `challenge:${args.challengeId}:${todayStr}`, 1);

    // Schedule leaderboard update
    const yearMonth = todayStr.substring(0, 7); // YYYY-MM
    await ctx.scheduler.runAfter(0, internal.leaderboard.updateMonthlyLeaderboard, {
      userId,
      yearMonth,
    });

    // Recompute track rollups after challenge completion
    await ctx.runMutation(internal.track.recompute.recomputeTrackForDate, {
      userId,
      date: todayStr,
    });

    // Schedule video merge via Trigger.dev — post will be created after merge completes
    if (args.videoStorageId) {
      const userVideoUrl = await ctx.storage.getUrl(args.videoStorageId);

      const day1VideoUrl = day1Completion?.videoStorageId
        ? await ctx.storage.getUrl(day1Completion.videoStorageId)
        : null;

      // Important:
      // We keep old Trigger payload names: adminVideoUrl + userVideoUrl.
      // But adminVideoUrl can now be either:
      // 1. User's Day 1 video, if available
      // 2. Instructor video, if this is the first attempt
      const firstAttemptVideoUrl =
        (await ctx.storage.getUrl(FIRST_ATTEMPT_VIDEO_STORAGE_ID)) ??
        (await ctx.storage.getUrl(challenge.instructionalVideo));

      const adminVideoUrl = day1VideoUrl ? day1VideoUrl : firstAttemptVideoUrl;

      console.log('Transformation merge check:', {
        userId,
        challengeId: args.challengeId,
        completionId,
        attemptNumber,
        day1CompletionId: day1Completion?._id,
        day1VideoStorageId: day1Completion?.videoStorageId,
        hasDay1VideoUrl: Boolean(day1VideoUrl),
        hasAdminVideoUrl: Boolean(adminVideoUrl),
        hasUserVideoUrl: Boolean(userVideoUrl),
        leftVideoType: day1VideoUrl ? 'day_1_video' : 'instructor_video',
      });

      if (!adminVideoUrl || !userVideoUrl) {
        console.log('Video merge skipped. Missing video URL.', {
          completionId,
          hasAdminVideoUrl: Boolean(adminVideoUrl),
          hasUserVideoUrl: Boolean(userVideoUrl),
        });
      } else {
        console.log('Scheduling video merge...', {
          completionId,
          attemptNumber,
          leftVideoType: day1VideoUrl ? 'day_1_video' : 'instructor_video',
        });

        await ctx.scheduler.runAfter(0, internal.triggerMerge.triggerVideoMerge, {
          // Keep old production payload names
          adminVideoUrl,
          userVideoUrl,

          challengeCompletionId: completionId,
          userId,
          caption: args.caption?.trim() || '',
          challengeId: args.challengeId,
        });
      }
    }

    return {
      success: true,
      pointsEarned: totalPoints,
      completionId,
      attemptNumber,
      isDay1Baseline: attemptNumber === 1,
    };
  },
});

export const getUserCompletionsForWeek = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return { days: [] };
    }

    const user = await ctx.db.get(userId);
    const tz = user?.timezone;

    const now = new Date();
    const monday = getMondayInTZ(now, tz);
    const todayStr = formatDateInTZ(now, tz);

    const weekStartStr = ymdUTC(monday);
    const weekEndStr = ymdUTC(addDaysUTC(monday, 7));

    // Per-day challenge counts (so we can keep `count` informational).
    const completions = await ctx.db
      .query('challengeCompletions')
      .withIndex('by_user_date', (q) =>
        q.eq('userId', userId).gte('date', weekStartStr).lt('date', weekEndStr)
      )
      .filter((q) => q.neq(q.field('removed'), true))
      .collect();
    const challengeCountByDate = new Map<string, number>();
    for (const c of completions) {
      challengeCountByDate.set(c.date, (challengeCountByDate.get(c.date) ?? 0) + 1);
    }

    const earnedDates = await getStreakEarnedDatesInRange(ctx, userId, weekStartStr, weekEndStr);

    const dayLabels = ['Mon', 'Tue', 'Wed', 'Thr', 'Fri', 'Sat', 'Sun'];
    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = addDaysUTC(monday, i);
      const dateStr = ymdUTC(date);
      days.push({
        date: dateStr,
        dayLabel: dayLabels[i],
        count: challengeCountByDate.get(dateStr) ?? 0,
        earned: earnedDates.has(dateStr),
        isToday: dateStr === todayStr,
      });
    }

    return { days };
  },
});

export const getUserStreaksForMonth = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return { weeklyStreaks: 0, currentWeekDays: 0, currentWeekTarget: 5 };
    }

    const user = await ctx.db.get(userId);
    const tz = user?.timezone;

    const now = new Date();
    const todayStr = formatDateInTZ(now, tz);

    const currentMonday = getMondayInTZ(now, tz);
    const weekStartStr = ymdUTC(currentMonday);
    const weekEndStr = ymdUTC(addDaysUTC(currentMonday, 7));

    const weekDates = await getStreakEarnedDatesInRange(ctx, userId, weekStartStr, weekEndStr);

    let currentWeekDays = 0;
    for (let i = 0; i < 7; i++) {
      const dateStr = ymdUTC(addDaysUTC(currentMonday, i));
      if (dateStr > todayStr) break; // Don't count future days
      if (weekDates.has(dateStr)) currentWeekDays++;
    }

    const LOOKBACK_WEEKS = 26;
    const lookbackStart = addDaysUTC(currentMonday, -LOOKBACK_WEEKS * 7);
    const lookbackStartStr = ymdUTC(lookbackStart);

    const historicalEarnedDates = await getStreakEarnedDatesInRange(
      ctx,
      userId,
      lookbackStartStr,
      weekStartStr
    );

    let weeklyStreaks = 0;
    if (currentWeekDays >= 5) weeklyStreaks++;
    let cursor = addDaysUTC(currentMonday, -7);
    for (let w = 0; w < LOOKBACK_WEEKS; w++) {
      let daysActive = 0;
      for (let i = 0; i < 7; i++) {
        if (historicalEarnedDates.has(ymdUTC(addDaysUTC(cursor, i)))) daysActive++;
      }
      if (daysActive >= 5) {
        weeklyStreaks++;
        cursor = addDaysUTC(cursor, -7);
      } else {
        break;
      }
    }

    return { weeklyStreaks, currentWeekDays, currentWeekTarget: 5 };
  },
});

export const getChallengeCooldown = query({
  args: {
    challengeId: v.id('challenges'),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    if (!userId) {
      return {
        completedToday: false,
        lastCompletedAt: null,
      };
    }

    const user = await ctx.db.get(userId);
    const todayStr = formatDateInTZ(new Date(), user?.timezone);

    const completions = await ctx.db
      .query('challengeCompletions')
      .withIndex('by_user_challenge_date', (q) =>
        q.eq('userId', userId).eq('challengeId', args.challengeId)
      )
      .filter((q) => q.neq(q.field('removed'), true))
      .collect();

    if (completions.length === 0) {
      return {
        completedToday: false,
        lastCompletedAt: null,
      };
    }

    const latestCompletion = completions.sort((a, b) => b._creationTime - a._creationTime)[0];

    const completedToday = completions.some((completion) => completion.date === todayStr);

    return {
      completedToday,
      lastCompletedAt: latestCompletion._creationTime,
    };
  },
});

export const backfillTotalCompletions = internalMutation({
  args: {},
  handler: async (ctx) => {
    const challenges = await ctx.db.query('challenges').collect();
    for (const challenge of challenges) {
      const completions = await ctx.db
        .query('challengeCompletions')
        .withIndex('by_challenge_date', (q) => q.eq('challengeId', challenge._id))
        .collect();
      await ctx.db.patch(challenge._id, { totalCompletions: completions.length });
    }
  },
});

export const getTodayCompletionCount = query({
  args: {
    challengeId: v.id('challenges'),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    let tz: string | undefined;
    if (userId) {
      const user = await ctx.db.get(userId);
      tz = user?.timezone;
    }
    const todayStr = formatDateInTZ(new Date(), tz);
    const count = await challengeCounter.count(ctx, `challenge:${args.challengeId}:${todayStr}`);
    return count;
  },
});

export const getPublishedChallenges = query({
  args: {
    tag: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    let tz: string | undefined;
    if (userId) {
      const user = await ctx.db.get(userId);
      tz = user?.timezone;
    }
    const todayStr = formatDateInTZ(new Date(), tz);

    let challengesQuery;
    if (args.tag) {
      challengesQuery = ctx.db
        .query('challenges')
        .withIndex('by_tag', (q) => q.eq('tag', args.tag!))
        .order('desc')
        .filter((q) => q.eq(q.field('isPublished'), true));
    } else {
      challengesQuery = ctx.db
        .query('challenges')
        .withIndex('by_published', (q) => q.eq('isPublished', true))
        .order('desc');
    }

    const challenges = await challengesQuery.collect();

    // Filter out expired challenges and resolve cover image URLs
    const results: any[] = [];

    for (const challenge of challenges) {
      if (challenge.endDate && todayStr >= challenge.endDate) continue;

      const coverImageUrl = await ctx.storage.getUrl(challenge.coverImage);

      let userCompletedCount = 0;

      if (userId) {
        const userCompletions = await ctx.db
          .query('challengeCompletions')
          .withIndex('by_user_challenge_date', (q) =>
            q.eq('userId', userId).eq('challengeId', challenge._id)
          )
          .collect();

        userCompletedCount = userCompletions.length;
      }

      results.push({
        ...challenge,
        coverImageUrl,
        userCompletedCount,
      });
    }

    return results;
  },
});

export const getPublishedChallenge = query({
  args: {
    challengeId: v.id('challenges'),
  },
  handler: async (ctx, args) => {
    const challenge = await ctx.db.get(args.challengeId);
    if (!challenge || !challenge.isPublished) {
      return null;
    }

    const coverImageUrl = await ctx.storage.getUrl(challenge.coverImage);
    const instructionalVideoUrl = await ctx.storage.getUrl(challenge.instructionalVideo);

    return {
      ...challenge,
      coverImageUrl,
      instructionalVideoUrl,
    };
  },
});

export const getCompletionCompositeVideo = query({
  args: {
    completionId: v.id('challengeCompletions'),
  },
  handler: async (ctx, args) => {
    const completion = await ctx.db.get(args.completionId);
    if (!completion) return null;

    if (!completion.compositeVideoStorageId) return { ready: false, videoUrl: null };

    const videoUrl = await ctx.storage.getUrl(completion.compositeVideoStorageId);
    return { ready: true, videoUrl };
  },
});

export const getPointsEarnedToday = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return { earned: 0, cap: 10, isCapped: false, isPremium: false };
    }

    const user = await ctx.db.get(userId);
    const todayStr = formatDateInTZ(new Date(), user?.timezone);

    const isPremium = (user?.isPremium ?? false) || (user?.isAdmin ?? false);

    const dailyCap = await getDailyPointsCap(ctx);

    const earned = await getDailyPointsEarned(ctx, userId, todayStr);

    return {
      earned,
      cap: dailyCap,
      isCapped: !isPremium && earned >= dailyCap,
      isPremium,
    };
  },
});

export const getChallengeProgress = query({
  args: {
    challengeId: v.id('challenges'),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    if (!userId) {
      return {
        completedCount: 0,
        nextAttemptNumber: 1,
        attemptTitle: 'First time doing this duet',
        day1CompletionId: null,
        day1VideoUrl: null,
        lastVideoUrl: null,
        dailyCompletionCount: 0,
        dailyLimit: MAX_DAILY_CHALLENGE_COMPLETIONS,
        dailyLimitReached: false,
      };
    }

    const user = await ctx.db.get(userId);
    const todayStr = formatDateInTZ(new Date(), user?.timezone);

    const todayCompletions = await ctx.db
      .query('challengeCompletions')
      .withIndex('by_user_date', (q) => q.eq('userId', userId).eq('date', todayStr))
      .filter((q) => q.neq(q.field('removed'), true))
      .collect();

    const dailyCompletionCount = todayCompletions.length;

    const completions = await ctx.db
      .query('challengeCompletions')
      .withIndex('by_user_challenge_date', (q) =>
        q.eq('userId', userId).eq('challengeId', args.challengeId)
      )
      .filter((q) => q.neq(q.field('removed'), true))
      .collect();

    const sorted = completions.sort((a, b) => a._creationTime - b._creationTime);

    const day1Completion = sorted.find((completion) => completion.videoStorageId);
    const lastCompletion = [...sorted].reverse().find((completion) => completion.videoStorageId);

    const day1VideoUrl = day1Completion?.videoStorageId
      ? await ctx.storage.getUrl(day1Completion.videoStorageId)
      : null;

    const lastVideoUrl = lastCompletion?.videoStorageId
      ? await ctx.storage.getUrl(lastCompletion.videoStorageId)
      : null;

    const nextAttemptNumber = sorted.length + 1;

    return {
      completedCount: sorted.length,
      nextAttemptNumber,
      attemptTitle:
        sorted.length === 0
          ? 'First time doing this duet'
          : `Day 1 vs Attempt ${nextAttemptNumber}`,
      day1CompletionId: day1Completion?._id ?? null,
      day1VideoUrl,
      lastVideoUrl,
      dailyCompletionCount,
      dailyLimit: MAX_DAILY_CHALLENGE_COMPLETIONS,
      dailyLimitReached: dailyCompletionCount >= MAX_DAILY_CHALLENGE_COMPLETIONS,
    };
  },
});
