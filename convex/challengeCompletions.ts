import { getAuthUserId } from '@convex-dev/auth/server';
import { ShardedCounter } from '@convex-dev/sharded-counter';
import { ConvexError, v } from 'convex/values';

import { components, internal } from './_generated/api';
import { Doc, Id } from './_generated/dataModel';
import { internalMutation, mutation, query, QueryCtx, MutationCtx } from './_generated/server';
import { getSafeMemberName, getSafeUserImageUrl } from './chat/userPresentation';
import { evaluateUserMilestones } from './utils/milestones';
import { getStreakEarnedDatesInRange, WEEKLY_STREAK_TARGET_DAYS } from './utils/streak';
import {
  addDaysUTC,
  addDaysToDateKey,
  DAILY_SCHEDULE_TIMEZONE,
  differenceInCalendarDays,
  formatDateInTZ,
  getDateStartTimestampInTimezone,
  getMondayInTZ,
  getNextMidnightTimestamp,
  ymdUTC,
} from './utils/timezone';

const challengeCounter = new ShardedCounter(components.shardedCounter);
const MAX_DAILY_CHALLENGE_COMPLETIONS = 3;
const FIRST_ATTEMPT_VIDEO_STORAGE_ID = 'kg27tw959tpd9gd9jcf0dey5x58dmdec' as Id<'_storage'>;

// production : kg25g2j1k7vcx2h2qq58gw9h5n89p5fp
// testing: kg2711e7c0h5kyag5avvms5was8an2wv

function getLocalDateKey(date: string): number {
  return Date.parse(`${date}T00:00:00.000Z`);
}

function getCommunityChallengeTiming(
  challenge: Doc<'challenges'>,
  now: number,
  userTimezone?: string | null
) {
  if (challenge.isCommunityChallenge !== true || !challenge.startDate || !challenge.durationDays) {
    return null;
  }

  const startAt = getDateStartTimestampInTimezone(challenge.startDate, DAILY_SCHEDULE_TIMEZONE);
  const endDate = addDaysToDateKey(challenge.startDate, challenge.durationDays);
  const endAt = getDateStartTimestampInTimezone(endDate, DAILY_SCHEDULE_TIMEZONE);
  const userStartDate = formatDateInTZ(new Date(startAt), userTimezone);
  const userToday = formatDateInTZ(new Date(now), userTimezone);
  const rawDay = differenceInCalendarDays(userStartDate, userToday) + 1;
  const status = now < startAt ? 'upcoming' : now >= endAt ? 'ended' : 'active';
  const currentDay = status === 'upcoming' ? 0 : Math.min(challenge.durationDays, rawDay);
  const millisecondsUntilStart = Math.max(0, startAt - now);

  return {
    status,
    startAt,
    endAt,
    endDate,
    currentDay,
    userToday,
    userStartDate,
    daysUntilStart: Math.max(0, Math.ceil(millisecondsUntilStart / (24 * 60 * 60 * 1000))),
    totalAvailablePoints:
      challenge.points * challenge.durationDays + (challenge.completionBankPoints ?? 0),
  } as const;
}

async function getChallengeParticipant(
  ctx: QueryCtx | MutationCtx,
  userId: Id<'users'>,
  challengeId: Id<'challenges'>
) {
  return await ctx.db
    .query('challengeParticipants')
    .withIndex('by_user_challenge', (q) => q.eq('userId', userId).eq('challengeId', challengeId))
    .unique();
}

async function getParticipantAvatars(
  ctx: QueryCtx,
  participants: Doc<'challengeParticipants'>[],
  currentUserId: Id<'users'> | null,
  limit: number
) {
  const currentParticipant = currentUserId
    ? participants.find((row) => String(row.userId) === String(currentUserId))
    : undefined;
  const ordered = [
    ...(currentParticipant ? [currentParticipant] : []),
    ...participants.filter((row) => row._id !== currentParticipant?._id),
  ].slice(0, limit);
  const avatars = [];

  for (const row of ordered) {
    const member = await ctx.db.get(row.userId);
    const name = getSafeMemberName(member);
    avatars.push({
      userId: row.userId,
      imageUrl: await getSafeUserImageUrl(ctx, member?.image),
      initial: Array.from(name)[0]?.toUpperCase() ?? '?',
    });
  }

  return avatars;
}

function getScheduledCheckInForLocalDate(
  challenges: Doc<'challenges'>[],
  localDate: string
): Doc<'challenges'> | undefined {
  const localDay = getLocalDateKey(localDate);
  const scheduledCheckIns = challenges
    .filter(
      (challenge) =>
        challenge.isPublished &&
        challenge.isDailyChallenge === true &&
        challenge.type === 'check_in' &&
        challenge.dailyStartAt !== undefined &&
        challenge.dailyEndAt !== undefined
    )
    .map((challenge) => {
      const scheduledDate = formatDateInTZ(
        new Date(challenge.dailyStartAt!),
        DAILY_SCHEDULE_TIMEZONE
      );
      const dayDifference = Math.round(
        (getLocalDateKey(scheduledDate) - localDay) / (24 * 60 * 60 * 1000)
      );

      return { challenge, dayDifference };
    });

  if (scheduledCheckIns.length === 0) {
    return undefined;
  }

  if (scheduledCheckIns.length === 1) {
    return scheduledCheckIns[0].challenge;
  }

  /*
   * The admin maintains two consecutive London-dated check-ins. They alternate
   * forever, so users whose local date is one day behind or ahead select the
   * matching item by calendar-day parity. This lets every timezone change at
   * its own midnight without duplicating the admin schedule per timezone.
   */
  const matchingParity = scheduledCheckIns.filter(
    ({ dayDifference }) => Math.abs(dayDifference) % 2 === 0
  );
  const candidates = matchingParity.length > 0 ? matchingParity : scheduledCheckIns;

  return candidates.sort(
    (a, b) =>
      Math.abs(a.dayDifference) - Math.abs(b.dayDifference) ||
      (b.challenge.dailyStartAt ?? 0) - (a.challenge.dailyStartAt ?? 0)
  )[0]?.challenge;
}

function getChallengeCounterKey(
  challengeId: Id<'challenges'>,
  dailyWindowStartAt: number | undefined,
  date: string
) {
  if (dailyWindowStartAt !== undefined) {
    return `challenge:${challengeId}:window:${dailyWindowStartAt}`;
  }

  return `challenge:${challengeId}:${date}`;
}

async function getDailyPointsEarned(
  ctx: QueryCtx | MutationCtx,
  userId: Id<'users'>,
  date: string
): Promise<number> {
  const completions = await ctx.db
    .query('challengeCompletions')
    .withIndex('by_user_date', (q) => q.eq('userId', userId).eq('date', date))
    .filter((q) => q.neq(q.field('removed'), true))
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

type PointSource = 'challenge' | 'activity' | 'activity_log' | 'checkin';

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
  const activities = await ctx.db
    .query('dailyActivities')
    .withIndex('by_user_date', (q) => q.eq('userId', userId).eq('date', date))
    .filter((q) => q.or(q.eq(q.field('synced'), true), q.eq(q.field('reviewStatus'), 'approved')))
    .collect();
  if (source !== 'activity') {
    otherSources += activities.reduce((s, a) => s + (a.displayTotalPoints ?? 0), 0);
  } else {
    // Health sync replaces its own daily row, but hardcoded activity logs are
    // separate awards and must still count toward the user's daily cap.
    otherSources += activities.reduce(
      (sum, activity) =>
        activity.loggedActivityKey ? sum + (activity.displayTotalPoints ?? 0) : sum,
      0
    );
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
    mediaType: v.optional(v.union(v.literal('image'), v.literal('video'))),
    checkInSubmissionType: v.optional(
      v.union(v.literal('live_video'), v.literal('uploaded_video'), v.literal('photo'))
    ),
    musicTrackId: v.optional(
      v.union(
        v.literal('audio_1'),
        v.literal('audio_2'),
        v.literal('audio_3'),
        v.literal('audio_4'),
        v.literal('audio_5')
      )
    ),
    mediaWidth: v.optional(v.number()),
    mediaHeight: v.optional(v.number()),
    allowRepost: v.optional(v.boolean()),
    caption: v.optional(v.string()),

    // Backward compatibility for older app versions.
    recordedDurationSec: v.optional(v.number()),

    thumbnailStorageId: v.optional(v.id('_storage')),
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

    const now = Date.now();
    const user = await ctx.db.get(userId);

    if (!user) {
      throw new ConvexError('User not found');
    }

    /*
     * Points, streaks and daily eligibility always follow the member's local
     * calendar date, not the London admin schedule.
     */
    const todayStr = formatDateInTZ(new Date(now), user.timezone);

    const isDailyChallenge = challenge.isDailyChallenge === true;
    const isCheckIn = challenge.type === 'check_in';
    const isCommunityChallenge = challenge.isCommunityChallenge === true;
    const isSideBySideChallenge =
      !isCheckIn && (!isCommunityChallenge || challenge.outputType === 'side_by_side');
    const communityTiming = getCommunityChallengeTiming(challenge, now, user.timezone);
    let communityChallengeDay: number | undefined;
    let communityParticipant: Doc<'challengeParticipants'> | null = null;

    if (isCommunityChallenge) {
      if (!communityTiming) {
        throw new ConvexError('Community challenge schedule is invalid');
      }
      if (communityTiming.status === 'upcoming') {
        throw new ConvexError('This challenge has not started yet');
      }
      if (communityTiming.status === 'ended') {
        throw new ConvexError('Challenge has ended');
      }

      communityParticipant = await getChallengeParticipant(ctx, userId, args.challengeId);
      if (!communityParticipant) {
        throw new ConvexError('Join this challenge before recording');
      }

      communityChallengeDay = communityTiming.currentDay;
    }

    let dailyWindowStartAt: number | undefined;

    /*
     * The rotation controls which check-in is featured, not which published
     * category a member may choose. Every check-in uses the member's local-day
     * key so a scheduled future category can remain available in the swap pool.
     */
    if (isDailyChallenge && isCheckIn) {
      dailyWindowStartAt = getLocalDateKey(todayStr);
    } else if (isDailyChallenge) {
      const dailyStartAt = challenge.dailyStartAt;
      const dailyEndAt = challenge.dailyEndAt;

      if (dailyStartAt === undefined || dailyEndAt === undefined) {
        throw new ConvexError('Daily challenge schedule is invalid');
      }

      if (now < dailyStartAt || now >= dailyEndAt) {
        throw new ConvexError('This daily challenge is not currently active');
      }

      dailyWindowStartAt = dailyStartAt;
    }

    if (!isCommunityChallenge && challenge.endDate && todayStr >= challenge.endDate) {
      throw new ConvexError('Challenge has ended');
    }

    if (!user.isPremium && !user.isAdmin) {
      throw new ConvexError('Premium required');
    }

    const mediaType: 'image' | 'video' =
      isCheckIn && args.mediaType === 'image' ? 'image' : 'video';
    const checkInSubmissionType = isCheckIn
      ? mediaType === 'image'
        ? ('photo' as const)
        : args.checkInSubmissionType === 'live_video'
          ? ('live_video' as const)
          : ('uploaded_video' as const)
      : undefined;
    const musicTrackId = !isCheckIn ? args.musicTrackId : undefined;

    if (!args.videoStorageId) {
      throw new ConvexError(isCheckIn ? 'A photo or video is required' : 'A video is required');
    }

    if (!isCheckIn && mediaType !== 'video') {
      throw new ConvexError('Challenges require a video');
    }
    /*
     * Daily challenges are checked using their
     * exact scheduled window.
     *
     * Normal challenges continue using the
     * user's local date.
     */
    let existingCompletion =
      dailyWindowStartAt !== undefined
        ? await ctx.db
            .query('challengeCompletions')
            .withIndex('by_user_challenge_window', (q) =>
              q
                .eq('userId', userId)
                .eq('challengeId', args.challengeId)
                .eq('dailyWindowStartAt', dailyWindowStartAt)
            )
            .filter((q) => q.neq(q.field('removed'), true))
            .first()
        : await ctx.db
            .query('challengeCompletions')
            .withIndex('by_user_challenge_date', (q) =>
              q.eq('userId', userId).eq('challengeId', args.challengeId).eq('date', todayStr)
            )
            .filter((q) => q.neq(q.field('removed'), true))
            .first();

    /*
     * Compatibility with completions created before local-day keys were
     * introduced, and with a different check-in selected from the swap list.
     */
    if (!existingCompletion && isCheckIn) {
      const localDayCompletions = await ctx.db
        .query('challengeCompletions')
        .withIndex('by_user_date', (q) => q.eq('userId', userId).eq('date', todayStr))
        .filter((q) => q.neq(q.field('removed'), true))
        .collect();

      for (const completion of localDayCompletions) {
        const completedChallenge = await ctx.db.get(completion.challengeId);
        if (completedChallenge?.type === 'check_in') {
          existingCompletion = completion;
          break;
        }
      }
    }

    if (existingCompletion) {
      throw new ConvexError(
        isCheckIn ? 'You already completed a check-in today' : 'Already completed today'
      );
    }

    /*
     * Keep the global daily completion limit
     * based on the user's local calendar date.
     */
    const todayCompletions = await ctx.db
      .query('challengeCompletions')
      .withIndex('by_user_date', (q) => q.eq('userId', userId).eq('date', todayStr))
      .filter((q) => q.neq(q.field('removed'), true))
      .collect();

    let completionsTowardDailyLimit = todayCompletions.length;
    if (isCommunityChallenge) {
      completionsTowardDailyLimit = 0;
      for (const completion of todayCompletions) {
        const completedChallenge = await ctx.db.get(completion.challengeId);
        if (completedChallenge?.isCommunityChallenge === true) {
          completionsTowardDailyLimit += 1;
        }
      }
    }

    if (completionsTowardDailyLimit >= MAX_DAILY_CHALLENGE_COMPLETIONS) {
      throw new ConvexError('Daily challenge limit reached');
    }

    /*
     * Check-ins must never receive the repost
     * bonus even if an older client sends
     * allowRepost=true.
     */
    const repostBonus = !isCheckIn && args.allowRepost ? 3 : 0;

    /*
     * A check-in's submission format is metadata only. Every format earns the
     * configured challenge points so recording and uploading are treated equally.
     */
    /*
     * Fetch all previous attempts for progress
     * and Day-1 comparison logic.
     */
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

    const rawDailyPoints = challenge.points + repostBonus;
    const dailyPointsEarned = await applyFreeDailyCap(
      ctx,
      userId,
      todayStr,
      rawDailyPoints,
      'challenge'
    );

    let completionBankPointsEarned = 0;
    if (
      isCommunityChallenge &&
      communityTiming &&
      communityParticipant &&
      communityChallengeDay === challenge.durationDays &&
      communityParticipant.bankEligibleAtJoin &&
      !communityParticipant.completionBankAwarded
    ) {
      const completedDays = new Set(
        sortedPreviousCompletions
          .map((completion) => completion.communityChallengeDay)
          .filter((day): day is number => typeof day === 'number')
      );
      const completedEveryEarlierDay = Array.from(
        { length: Math.max(0, (challenge.durationDays ?? 1) - 1) },
        (_, index) => index + 1
      ).every((day) => completedDays.has(day));

      if (completedEveryEarlierDay) {
        // The completion bank is an earned challenge prize, not another daily
        // activity award, so it is not reduced by the free user's daily cap.
        completionBankPointsEarned = challenge.completionBankPoints ?? 0;
      }
    }

    const totalPoints = dailyPointsEarned + completionBankPointsEarned;

    /*
     * Do not insert undefined for optional
     * fields. Include dailyWindowStartAt only
     * for scheduled daily challenges.
     */
    const completionData = {
      userId,
      challengeId: args.challengeId,
      date: todayStr,
      pointsEarned: totalPoints,

      ...(dailyWindowStartAt !== undefined
        ? {
            dailyWindowStartAt,
          }
        : {}),

      ...(communityChallengeDay !== undefined
        ? {
            communityChallengeDay,
            completionBankPointsEarned,
          }
        : {}),

      ...(args.videoStorageId
        ? {
            videoStorageId: args.videoStorageId,
            mediaType,
            ...(checkInSubmissionType ? { checkInSubmissionType } : {}),
            ...(musicTrackId ? { musicTrackId } : {}),
          }
        : {}),

      ...(args.thumbnailStorageId
        ? {
            thumbnailStorageId: args.thumbnailStorageId,
          }
        : {}),

      allowRepost: isCheckIn ? false : args.allowRepost,

      caption: args.caption,
      removed: false,
      attemptNumber,

      /*
       * Check-in videos are posted directly.
       * Normal challenges keep Day-1 and
       * transformation comparison data.
       */
      ...(!isCheckIn && (!isCommunityChallenge || challenge.outputType === 'side_by_side')
        ? {
            comparisonMode: day1Completion?.videoStorageId
              ? ('day1_vs_current' as const)
              : ('day1_baseline' as const),

            ...(day1Completion?._id
              ? {
                  day1CompletionId: day1Completion._id,
                }
              : {}),

            ...(day1Completion?.videoStorageId
              ? {
                  comparisonBaseVideoStorageId: day1Completion.videoStorageId,
                }
              : {}),
          }
        : {}),
    };

    const completionId = await ctx.db.insert('challengeCompletions', completionData);

    if (communityParticipant && completionBankPointsEarned > 0) {
      await ctx.db.patch(communityParticipant._id, {
        completionBankAwarded: true,
        completionBankAwardedAt: now,
      });
    }

    /*
     * Daily challenge counters use the exact
     * challenge window.
     *
     * Normal challenge counters continue using
     * the user's local date.
     */
    const completionCounterKey = getChallengeCounterKey(
      args.challengeId,
      dailyWindowStartAt,
      todayStr
    );

    await challengeCounter.add(ctx, completionCounterKey, 1);

    const yearMonth = todayStr.substring(0, 7);

    await ctx.scheduler.runAfter(0, internal.leaderboard.updateMonthlyLeaderboard, {
      userId,
      yearMonth,
    });

    await ctx.runMutation(internal.track.recompute.recomputeTrackForDate, {
      userId,
      date: todayStr,
    });

    /*
     * Process the user's uploaded video.
     */
    /*
     * Process the user's uploaded video.
     */
    if (args.videoStorageId) {
      // Publish the original immediately for submissions that need asynchronous
      // single-video processing. Side-by-side challenges wait until Trigger.dev
      // creates the composite so the raw recording never appears in the feed.
      const needsProcessing =
        !(isCheckIn && !musicTrackId) &&
        !(
          !isCheckIn &&
          isCommunityChallenge &&
          challenge.outputType === 'single_video' &&
          !musicTrackId
        );
      if (needsProcessing && !isSideBySideChallenge) {
        await ctx.db.insert('posts', {
          userId,
          createdAt: now,
          body: args.caption?.trim() || `${challenge.name} completed`,
          media: args.videoStorageId,
          ...(args.thumbnailStorageId ? { mediaThumbnail: args.thumbnailStorageId } : {}),
          mediaWidth: args.mediaWidth && args.mediaWidth > 0 ? args.mediaWidth : 1080,
          mediaHeight: args.mediaHeight && args.mediaHeight > 0 ? args.mediaHeight : 1350,
          mediaType,
          challengeId: args.challengeId,
          challengeCompletionId: completionId,
        });
      }
      /*
       * CHECK-IN:
       * Post the original user video directly.
       */
      if (isCheckIn && !musicTrackId) {
        const postId = await ctx.db.insert('posts', {
          userId,
          createdAt: Date.now(),

          body: args.caption?.trim() || `${challenge.name} check-in completed`,

          media: args.videoStorageId,

          ...(args.thumbnailStorageId
            ? {
                mediaThumbnail: args.thumbnailStorageId,
              }
            : {}),

          mediaWidth: args.mediaWidth && args.mediaWidth > 0 ? args.mediaWidth : 1080,
          mediaHeight: args.mediaHeight && args.mediaHeight > 0 ? args.mediaHeight : 1350,
          mediaType,

          challengeId: args.challengeId,
          challengeCompletionId: completionId,
        });

        console.log('Check-in media posted:', {
          postId,
          completionId,
          challengeId: args.challengeId,
          userId,
          dailyWindowStartAt,
        });

        await ctx.scheduler.runAfter(0, internal.http.sendChallengeNotification, {
          userId,
          postId,
        });
      } else if (!isCheckIn && isCommunityChallenge && challenge.outputType === 'single_video') {
        const userVideoUrl = await ctx.storage.getUrl(args.videoStorageId);

        if (musicTrackId && userVideoUrl) {
          // Reuse the existing single-video processor so the selected
          // challenge music is present in the final feed video.
          await ctx.scheduler.runAfter(0, internal.triggerMerge.triggerVideoMerge, {
            userVideoUrl,
            challengeCompletionId: completionId,
            userId,
            caption: args.caption?.trim() || '',
            challengeId: args.challengeId,
            musicTrackId,
            checkInMusicOnly: true,
          });
        } else {
          const postId = await ctx.db.insert('posts', {
            userId,
            createdAt: now,
            body: args.caption?.trim() || `${challenge.name} · Day ${communityChallengeDay}`,
            media: args.videoStorageId,
            ...(args.thumbnailStorageId ? { mediaThumbnail: args.thumbnailStorageId } : {}),
            mediaWidth: args.mediaWidth && args.mediaWidth > 0 ? args.mediaWidth : 1080,
            mediaHeight: args.mediaHeight && args.mediaHeight > 0 ? args.mediaHeight : 1350,
            mediaType: 'video',
            challengeId: args.challengeId,
            challengeCompletionId: completionId,
          });

          await ctx.scheduler.runAfter(0, internal.http.sendChallengeNotification, {
            userId,
            postId,
          });
        }
      } else if (!isCheckIn) {
        /*
         * NORMAL CHALLENGE:
         * Keep the Trigger.dev transformation video flow.
         */
        const userVideoUrl = await ctx.storage.getUrl(args.videoStorageId);

        const day1VideoUrl = day1Completion?.videoStorageId
          ? await ctx.storage.getUrl(day1Completion.videoStorageId)
          : null;

        const firstAttemptVideoUrl =
          (await ctx.storage.getUrl(FIRST_ATTEMPT_VIDEO_STORAGE_ID)) ??
          (challenge.instructionalVideo
            ? await ctx.storage.getUrl(challenge.instructionalVideo)
            : null);

        const adminVideoUrl = day1VideoUrl || firstAttemptVideoUrl;

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

          const leftLabel = day1VideoUrl
            ? `Day ${day1Completion?.communityChallengeDay ?? 1}`
            : undefined;
          const rightLabel = `Day ${communityChallengeDay ?? attemptNumber}`;

          await ctx.scheduler.runAfter(0, internal.triggerMerge.triggerVideoMerge, {
            adminVideoUrl,
            userVideoUrl,
            challengeCompletionId: completionId,
            userId,
            caption: args.caption?.trim() || '',
            challengeId: args.challengeId,

            ...(leftLabel
              ? {
                  leftLabel,
                }
              : {}),

            rightLabel,
            ...(musicTrackId ? { musicTrackId } : {}),
          });
        }
      } else {
        const userVideoUrl = await ctx.storage.getUrl(args.videoStorageId);
        if (userVideoUrl) {
          await ctx.scheduler.runAfter(0, internal.triggerMerge.triggerVideoMerge, {
            userVideoUrl,
            challengeCompletionId: completionId,
            userId,
            caption: args.caption?.trim() || '',
            challengeId: args.challengeId,
            musicTrackId,
            checkInMusicOnly: true,
          });
        }
      }
    }

    const milestones = await evaluateUserMilestones(ctx, userId, todayStr, {
      completedCheckIn: isCheckIn,
    });

    return {
      success: true,
      pointsEarned: totalPoints,
      dailyPointsEarned,
      completionBankPointsEarned,
      completionId,
      attemptNumber,
      isDay1Baseline: attemptNumber === 1,
      dailyWindowStartAt: dailyWindowStartAt ?? null,
      celebration: {
        type: isCheckIn ? ('check_in_complete' as const) : ('challenge_complete' as const),
        milestones,
      },
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

    const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
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
      return {
        weeklyStreaks: 0,
        currentWeekDays: 0,
        currentWeekTarget: WEEKLY_STREAK_TARGET_DAYS,
      };
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
    if (currentWeekDays >= WEEKLY_STREAK_TARGET_DAYS) weeklyStreaks++;
    let cursor = addDaysUTC(currentMonday, -7);
    for (let w = 0; w < LOOKBACK_WEEKS; w++) {
      let daysActive = 0;
      for (let i = 0; i < 7; i++) {
        if (historicalEarnedDates.has(ymdUTC(addDaysUTC(cursor, i)))) daysActive++;
      }
      if (daysActive >= WEEKLY_STREAK_TARGET_DAYS) {
        weeklyStreaks++;
        cursor = addDaysUTC(cursor, -7);
      } else {
        break;
      }
    }

    return { weeklyStreaks, currentWeekDays, currentWeekTarget: WEEKLY_STREAK_TARGET_DAYS };
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

    const challenge = await ctx.db.get(args.challengeId);
    const completions =
      challenge?.type === 'check_in'
        ? await ctx.db
            .query('challengeCompletions')
            .withIndex('by_user_date', (q) => q.eq('userId', userId).eq('date', todayStr))
            .filter((q) => q.neq(q.field('removed'), true))
            .collect()
        : await ctx.db
            .query('challengeCompletions')
            .withIndex('by_user_challenge_date', (q) =>
              q.eq('userId', userId).eq('challengeId', args.challengeId)
            )
            .filter((q) => q.neq(q.field('removed'), true))
            .collect();

    const relevantCompletions =
      challenge?.type === 'check_in'
        ? (
            await Promise.all(
              completions.map(async (completion) => ({
                completion,
                challenge: await ctx.db.get(completion.challengeId),
              }))
            )
          )
            .filter(({ challenge: completedChallenge }) => completedChallenge?.type === 'check_in')
            .map(({ completion }) => completion)
        : completions;

    if (relevantCompletions.length === 0) {
      return {
        completedToday: false,
        lastCompletedAt: null,
      };
    }

    const latestCompletion = relevantCompletions.sort(
      (a, b) => b._creationTime - a._creationTime
    )[0];

    const completedToday = relevantCompletions.some((completion) => completion.date === todayStr);

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

export const joinCommunityChallenge = mutation({
  args: { challengeId: v.id('challenges') },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError('Unauthorized');

    const [user, challenge] = await Promise.all([ctx.db.get(userId), ctx.db.get(args.challengeId)]);
    if (!user) throw new ConvexError('User not found');
    if (
      !challenge ||
      !challenge.isPublished ||
      challenge.type === 'check_in' ||
      challenge.isCommunityChallenge !== true
    ) {
      throw new ConvexError('Challenge is not available');
    }
    if (!user.isPremium && !user.isAdmin) {
      throw new ConvexError('Premium required');
    }

    const timing = getCommunityChallengeTiming(challenge, Date.now(), user.timezone);
    if (!timing) throw new ConvexError('Challenge schedule is invalid');
    if (timing.status === 'ended') throw new ConvexError('Challenge has ended');

    const existing = await getChallengeParticipant(ctx, userId, args.challengeId);
    if (existing) {
      return {
        success: true,
        participantId: existing._id,
        alreadyJoined: true,
        bankEligibleAtJoin: existing.bankEligibleAtJoin,
      };
    }

    const existingParticipations = await ctx.db
      .query('challengeParticipants')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect();
    let overlappingJoinedChallenges = 0;

    for (const participation of existingParticipations) {
      const joinedChallenge = await ctx.db.get(participation.challengeId);
      if (!joinedChallenge?.isCommunityChallenge) continue;
      const joinedTiming = getCommunityChallengeTiming(joinedChallenge, Date.now(), user.timezone);
      if (
        joinedTiming &&
        joinedTiming.startAt < timing.endAt &&
        timing.startAt < joinedTiming.endAt
      ) {
        overlappingJoinedChallenges += 1;
      }
    }

    if (overlappingJoinedChallenges >= MAX_DAILY_CHALLENGE_COMPLETIONS) {
      throw new ConvexError(
        `You can join up to ${MAX_DAILY_CHALLENGE_COMPLETIONS} overlapping challenges`
      );
    }

    const participantId = await ctx.db.insert('challengeParticipants', {
      challengeId: args.challengeId,
      userId,
      joinedAt: Date.now(),
      joinedDate: timing.userToday,
      bankEligibleAtJoin: timing.status === 'upcoming' || timing.currentDay <= 1,
      completionBankAwarded: false,
    });
    await ctx.db.patch(challenge._id, {
      participantCount: (challenge.participantCount ?? 0) + 1,
    });

    return {
      success: true,
      participantId,
      alreadyJoined: false,
      bankEligibleAtJoin: timing.status === 'upcoming' || timing.currentDay <= 1,
    };
  },
});

export const getCommunityChallenges = query({
  args: { refreshToken: v.optional(v.number()) },
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    const user = userId ? await ctx.db.get(userId) : null;
    const now = Date.now();
    const challenges = await ctx.db
      .query('challenges')
      .withIndex('by_published', (q) => q.eq('isPublished', true))
      .collect();

    const results = [];

    for (const challenge of challenges) {
      if (challenge.type === 'check_in' || challenge.isCommunityChallenge !== true) continue;

      const timing = getCommunityChallengeTiming(challenge, now, user?.timezone);
      if (!timing || timing.status === 'ended') continue;

      const recentParticipantRows = await ctx.db
        .query('challengeParticipants')
        .withIndex('by_challenge', (q) => q.eq('challengeId', challenge._id))
        .order('desc')
        .take(4);
      const participant = userId ? await getChallengeParticipant(ctx, userId, challenge._id) : null;
      const userCompletions = userId
        ? await ctx.db
            .query('challengeCompletions')
            .withIndex('by_user_challenge_date', (q) =>
              q.eq('userId', userId).eq('challengeId', challenge._id)
            )
            .filter((q) => q.neq(q.field('removed'), true))
            .collect()
        : [];
      const completedDays = new Set(
        userCompletions
          .map((completion) => completion.communityChallengeDay)
          .filter((day): day is number => typeof day === 'number')
      );
      const requiredEarlierDays = Math.max(
        0,
        Math.min(timing.currentDay - 1, challenge.durationDays!)
      );
      const hasEveryEarlierDay = Array.from(
        { length: requiredEarlierDays },
        (_, index) => index + 1
      ).every((day) => completedDays.has(day));
      const participantAvatars = await getParticipantAvatars(
        ctx,
        [
          ...(participant ? [participant] : []),
          ...recentParticipantRows.filter((row) => row._id !== participant?._id),
        ],
        userId,
        4
      );

      results.push({
        ...challenge,
        coverImageUrl: await ctx.storage.getUrl(challenge.coverImage),
        instructionalVideoUrl: challenge.instructionalVideo
          ? await ctx.storage.getUrl(challenge.instructionalVideo)
          : null,
        ...timing,
        isJoined: Boolean(participant),
        joinedAt: participant?.joinedAt ?? null,
        participantCount: challenge.participantCount ?? recentParticipantRows.length,
        participantAvatars,
        completedToday: userCompletions.some((completion) => completion.date === timing.userToday),
        completedDays: completedDays.size,
        completionBankEligible: Boolean(
          participant?.bankEligibleAtJoin &&
          !participant.completionBankAwarded &&
          hasEveryEarlierDay
        ),
        completionBankAwarded: participant?.completionBankAwarded ?? false,
      });
    }

    results.sort((a, b) => {
      if (a.status !== b.status) return a.status === 'active' ? -1 : 1;
      if (a.isJoined !== b.isJoined) return a.isJoined ? -1 : 1;
      return a.startAt - b.startAt;
    });

    const joinedActive = results.filter(
      (challenge) => challenge.isJoined && challenge.status === 'active'
    );
    const completedToday = joinedActive.filter((challenge) => challenge.completedToday).length;
    const yearMonth = formatDateInTZ(new Date(now), user?.timezone || 'Europe/London').slice(0, 7);
    const monthCompletions = userId
      ? await ctx.db
          .query('challengeCompletions')
          .withIndex('by_user_date', (q) =>
            q.eq('userId', userId).gte('date', `${yearMonth}-01`).lte('date', `${yearMonth}-31`)
          )
          .filter((q) => q.neq(q.field('removed'), true))
          .collect()
      : [];
    const monthPoints = monthCompletions.reduce(
      (sum, completion) => sum + completion.pointsEarned,
      0
    );

    return {
      challenges: results,
      summary: {
        liveCount: results.filter((challenge) => challenge.status === 'active').length,
        joinedCount: results.filter((challenge) => challenge.isJoined).length,
        notJoinedCount: results.filter((challenge) => !challenge.isJoined).length,
        completedToday,
        dueToday: joinedActive.length,
        monthPoints,
        slotsLeft: Math.max(0, MAX_DAILY_CHALLENGE_COMPLETIONS - completedToday),
        dailyLimit: MAX_DAILY_CHALLENGE_COMPLETIONS,
      },
    };
  },
});

export const getCommunityChallengeDetails = query({
  args: {
    challengeId: v.id('challenges'),
    refreshToken: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const user = userId ? await ctx.db.get(userId) : null;
    const challenge = await ctx.db.get(args.challengeId);
    if (
      !challenge ||
      !challenge.isPublished ||
      challenge.type === 'check_in' ||
      challenge.isCommunityChallenge !== true
    ) {
      return null;
    }

    const timing = getCommunityChallengeTiming(challenge, Date.now(), user?.timezone);
    if (!timing) return null;

    const recentParticipantRows = await ctx.db
      .query('challengeParticipants')
      .withIndex('by_challenge', (q) => q.eq('challengeId', challenge._id))
      .order('desc')
      .take(5);
    const participant = userId ? await getChallengeParticipant(ctx, userId, challenge._id) : null;
    const userCompletions = userId
      ? await ctx.db
          .query('challengeCompletions')
          .withIndex('by_user_challenge_date', (q) =>
            q.eq('userId', userId).eq('challengeId', challenge._id)
          )
          .filter((q) => q.neq(q.field('removed'), true))
          .collect()
      : [];
    const completedDays = new Set(
      userCompletions
        .map((completion) => completion.communityChallengeDay)
        .filter((day): day is number => typeof day === 'number')
    );
    const earlierDayCount = Math.max(0, Math.min(timing.currentDay - 1, challenge.durationDays!));
    const hasEveryEarlierDay = Array.from(
      { length: earlierDayCount },
      (_, index) => index + 1
    ).every((day) => completedDays.has(day));
    const participantAvatars = await getParticipantAvatars(
      ctx,
      [
        ...(participant ? [participant] : []),
        ...recentParticipantRows.filter((row) => row._id !== participant?._id),
      ],
      userId,
      5
    );

    return {
      ...challenge,
      ...timing,
      coverImageUrl: await ctx.storage.getUrl(challenge.coverImage),
      instructionalVideoUrl: challenge.instructionalVideo
        ? await ctx.storage.getUrl(challenge.instructionalVideo)
        : null,
      isJoined: Boolean(participant),
      participantCount: challenge.participantCount ?? recentParticipantRows.length,
      participantAvatars,
      completedToday: userCompletions.some((completion) => completion.date === timing.userToday),
      completedDays: completedDays.size,
      completionBankEligible: Boolean(
        participant?.bankEligibleAtJoin && !participant.completionBankAwarded && hasEveryEarlierDay
      ),
      completionBankAwarded: participant?.completionBankAwarded ?? false,
    };
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
    const instructionalVideoUrl = challenge.instructionalVideo
      ? await ctx.storage.getUrl(challenge.instructionalVideo)
      : null;

    return {
      ...challenge,
      coverImageUrl,
      instructionalVideoUrl,
    };
  },
});

export const getAvailableCheckIns = query({
  args: {
    openedChallengeId: v.optional(v.id('challenges')),
    // Forces time-based daily state to refresh after foregrounding the app.
    refreshToken: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const user = userId ? await ctx.db.get(userId) : null;
    const today = formatDateInTZ(new Date(), user?.timezone);
    const checkIns = (
      await ctx.db
        .query('challenges')
        .withIndex('by_published', (q) => q.eq('isPublished', true))
        .collect()
    ).filter(
      (challenge) =>
        challenge.type === 'check_in' &&
        challenge.checkInCategoryId &&
        challenge.instructionalVideo &&
        (!challenge.endDate || challenge.endDate > today)
    );

    const todayCompletions = userId
      ? await ctx.db
          .query('challengeCompletions')
          .withIndex('by_user_date', (q) => q.eq('userId', userId).eq('date', today))
          .filter((q) => q.neq(q.field('removed'), true))
          .collect()
      : [];
    let completedCheckInId: Id<'challenges'> | null = null;
    for (const completion of todayCompletions) {
      const completedChallenge = await ctx.db.get(completion.challengeId);
      if (completedChallenge?.type === 'check_in') {
        completedCheckInId = completion.challengeId;
        break;
      }
    }

    // One deterministic option per category: prefer the record the user opened,
    // otherwise use the most recently created published Check-In.
    const byCategory = new Map<string, (typeof checkIns)[number]>();
    for (const checkIn of checkIns) {
      const key = String(checkIn.checkInCategoryId);
      const existing = byCategory.get(key);
      if (
        !existing ||
        checkIn._id === args.openedChallengeId ||
        (existing._id !== args.openedChallengeId && checkIn._creationTime > existing._creationTime)
      ) {
        byCategory.set(key, checkIn);
      }
    }

    const resolved = [];
    for (const checkIn of byCategory.values()) {
      const category = await ctx.db.get(checkIn.checkInCategoryId!);
      if (!category?.isActive || !checkIn.instructionalVideo) continue;
      resolved.push({
        challengeId: checkIn._id,
        name: checkIn.name,
        categoryId: category._id,
        categoryName: category.name,
        categoryDescription: category.description,
        categoryEmoji: category.emoji,
        categoryIconUrl: category.iconStorageId
          ? await ctx.storage.getUrl(category.iconStorageId)
          : null,
        sortOrder: category.sortOrder,
        instructionalVideoUrl: await ctx.storage.getUrl(checkIn.instructionalVideo),
        videoDuration: checkIn.videoDuration,
        isLocked: checkIn.isLocked,
        points: checkIn.points,
        durationLimit: checkIn.durationLimit,
        youtubeUrl: checkIn.youtubeUrl,
        userCompletedToday: completedCheckInId !== null,
        userCompletedThisCheckIn: completedCheckInId === checkIn._id,
      });
    }
    return resolved.sort((a, b) => a.sortOrder - b.sortOrder);
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
      return {
        earned: 0,
        checkInPoints: 0,
        challengeCompleted: false,
        cap: 10,
        isCapped: false,
        isPremium: false,
      };
    }

    const user = await ctx.db.get(userId);
    const todayStr = formatDateInTZ(new Date(), user?.timezone);

    const isPremium = (user?.isPremium ?? false) || (user?.isAdmin ?? false);

    const [dailyCap, earned, completions, activities] = await Promise.all([
      getDailyPointsCap(ctx),
      getDailyPointsEarned(ctx, userId, todayStr),
      ctx.db
        .query('challengeCompletions')
        .withIndex('by_user_date', (q) => q.eq('userId', userId).eq('date', todayStr))
        .filter((q) => q.neq(q.field('removed'), true))
        .collect(),
      ctx.db
        .query('dailyActivities')
        .withIndex('by_user_date', (q) => q.eq('userId', userId).eq('date', todayStr))
        .filter((q) =>
          q.or(q.eq(q.field('synced'), true), q.eq(q.field('reviewStatus'), 'approved'))
        )
        .collect(),
    ]);
    const completedChallenges = await Promise.all(
      completions.map((completion) => ctx.db.get(completion.challengeId))
    );
    const workoutPoints = completions.reduce(
      (sum, completion, index) =>
        completedChallenges[index]?.type === 'check_in' ? sum + completion.pointsEarned : sum,
      0
    );
    const habitPoints = activities.reduce(
      (sum, activity) =>
        activity.loggedActivityKey ? sum + (activity.displayTotalPoints ?? 0) : sum,
      0
    );

    return {
      earned,
      checkInPoints: workoutPoints + habitPoints,
      challengeCompleted: completedChallenges.some(
        (challenge) => challenge !== null && challenge.type !== 'check_in'
      ),
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

    const selectedChallenge = await ctx.db.get(args.challengeId);
    let dailyCompletionCount = todayCompletions.length;

    if (selectedChallenge?.isCommunityChallenge) {
      dailyCompletionCount = 0;
      for (const completion of todayCompletions) {
        const completedChallenge = await ctx.db.get(completion.challengeId);
        if (completedChallenge?.isCommunityChallenge) dailyCompletionCount += 1;
      }
    }

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

export const getTodayDailyChallenge = query({
  args: {
    // Used by the mobile app to force the query to rerun
    // when the current daily challenge expires.
    refreshToken: v.optional(v.number()),
  },

  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    const now = Date.now();
    const user = userId ? await ctx.db.get(userId) : null;
    const todayStr = formatDateInTZ(new Date(now), user?.timezone);
    const localDayStartAt = getLocalDateKey(todayStr);
    const localDayEndAt = getNextMidnightTimestamp(new Date(now), user?.timezone);

    /*
     * The admin's two check-ins are dated and rolled in London time. Select the
     * correct alternating item for the member's own local calendar date.
     */
    const scheduledChallenges = await ctx.db
      .query('challenges')
      .withIndex('by_daily_challenge', (q) => q.eq('isDailyChallenge', true))
      .collect();

    const challenge = getScheduledCheckInForLocalDate(scheduledChallenges, todayStr);

    if (!challenge) {
      return null;
    }

    /*
     * Scheduled daily challenges must always
     * have valid start and end timestamps.
     */
    if (challenge.dailyStartAt === undefined || challenge.dailyEndAt === undefined) {
      return null;
    }

    const coverImageUrl = await ctx.storage.getUrl(challenge.coverImage);

    const instructionalVideoUrl = challenge.instructionalVideo
      ? await ctx.storage.getUrl(challenge.instructionalVideo)
      : null;

    const localDateCompletions = await ctx.db
      .query('challengeCompletions')
      .withIndex('by_date', (q) => q.eq('date', todayStr))
      .order('desc')
      .filter((q) => q.neq(q.field('removed'), true))
      .collect();
    const localDateHabitLogs = await ctx.db
      .query('dailyActivities')
      .withIndex('by_date', (q) => q.eq('date', todayStr))
      .order('desc')
      .filter((q) => q.eq(q.field('reviewStatus'), 'approved'))
      .collect();

    const challengeTypes = new Map<string, string | undefined>();
    const checkInCompletions: typeof localDateCompletions = [];

    for (const completion of localDateCompletions) {
      const challengeId = String(completion.challengeId);
      let challengeType = challengeTypes.get(challengeId);

      if (!challengeTypes.has(challengeId)) {
        challengeType = (await ctx.db.get(completion.challengeId))?.type;
        challengeTypes.set(challengeId, challengeType);
      }

      if (challengeType === 'check_in') {
        checkInCompletions.push(completion);
      }
    }

    const checkInActions = [
      ...checkInCompletions,
      ...localDateHabitLogs.filter((activity) => Boolean(activity.loggedActivityKey)),
    ].sort((first, second) => second._creationTime - first._creationTime);
    const uniqueCheckInUsers = checkInActions.filter(
      (action, index, actions) =>
        actions.findIndex((item) => String(item.userId) === String(action.userId)) === index
    );
    const actualCheckInCount = uniqueCheckInUsers.length;
    const recentCheckInUsers = await Promise.all(
      uniqueCheckInUsers.slice(0, 5).map(async (action) => {
        const user = await ctx.db.get(action.userId);
        const name = getSafeMemberName(user);

        return {
          userId: action.userId,
          imageUrl: await getSafeUserImageUrl(ctx, user?.image),
          initial: Array.from(name)[0]?.toUpperCase() ?? '?',
        };
      })
    );

    /*
     * Completing any check-in category finishes the featured card for this
     * member's local date. At her local midnight, todayStr changes and the card
     * becomes available again automatically.
     */
    const userCompletedToday = Boolean(
      userId &&
      checkInCompletions.some((completion) => String(completion.userId) === String(userId))
    );

    /*
     * Recording type is permanent and does not
     * depend on isDailyChallenge.
     *
     * challenge:
     *   uses the normal challenge description.
     *
     * check_in:
     *   uses the check-in description.
     */
    const typeDescription =
      challenge.type === 'check_in' ? challenge.checkInDescription : challenge.description;

    /*
     * shortDescription is only for the daily
     * dashboard card.
     *
     * When it is missing, use the description
     * that belongs to the challenge type.
     */
    const dashboardDescription =
      challenge.shortDescription?.trim() || typeDescription?.trim() || challenge.description;

    const secondsRemaining = Math.max(0, Math.floor((localDayEndAt - now) / 1000));

    return {
      ...challenge,

      // The mobile countdown and refresh follow this member's local midnight.
      dailyStartAt: localDayStartAt,
      dailyEndAt: localDayEndAt,
      dailyTimezone: user?.timezone ?? 'UTC',

      coverImageUrl,
      instructionalVideoUrl,

      /*
       * This is displayed by the daily challenge
       * dashboard card.
       */
      shortDescription: dashboardDescription,

      /*
       * This can be used by challenge details
       * screens without repeating type logic.
       */
      typeDescription,

      secondsRemaining,
      communityDoneToday: actualCheckInCount,
      actualCheckInCount,
      recentCheckInUsers,
      userCompletedToday,
    };
  },
});
