import { getAuthUserId } from '@convex-dev/auth/server';
import { compare } from 'compare-versions';
import { paginationOptsValidator } from 'convex/server';
import { ConvexError, v } from 'convex/values';

import { internal } from './_generated/api';
import { Id, Doc } from './_generated/dataModel';
import { internalMutation, mutation, query } from './_generated/server';
import { appVersions } from './appVersions';
import { applyFreeDailyCap, getDailyPointsCap } from './challengeCompletions';

// Calculate points based on activity metrics
export function calculatePoints(steps: number, zone2Minutes: number = 0): number {
  // Example point calculation:
  // - 1 point per 1000 steps
  // - 1 point per 5 minutes in Zone 2 or above

  const stepsPoints = calculateStepsPoints(steps);
  const zone2Points = calculateZone2Points(zone2Minutes);

  return stepsPoints + zone2Points;
}

export function calculateStepsPoints(steps: number): number {
  return steps / 1000.0;
}

export function calculateZone2Points(zone2Minutes: number): number {
  return zone2Minutes / 5.0; // 1 point per 5 minutes in Zone 2
}

export function calculateMissionPoints(
  date: string,
  stepsTill11am: number,
  zone2Minutes: number,
  steps: number,
  totalFlooredPoints: number,
  dailyChallengesList: Doc<'dailyChallengesList'>[],
  missionFeatureFlagEnabled: boolean = false
): number {
  if (!missionFeatureFlagEnabled) {
    return 0;
  }

  const dayOfMonth = new Date(date).getDate();
  const challenge = dailyChallengesList.find((challenge) => challenge.day === dayOfMonth);
  if (!challenge) {
    return 0;
  }

  if (challenge.challengeType === 'steps' && challenge.target) {
    if (steps >= challenge.target) {
      return challenge.bonusPoints ?? 0;
    }
  }

  if (challenge.challengeType === 'sweat' && challenge.target) {
    if (zone2Minutes >= challenge.target) {
      return challenge.bonusPoints ?? 0;
    }
  }

  if (challenge.challengeType === 'points' && challenge.target) {
    if (totalFlooredPoints >= challenge.target) {
      return challenge.bonusPoints ?? 0;
    }
  }

  if (challenge.challengeType === 'powerboost' && challenge.target) {
    if (stepsTill11am >= challenge.target) {
      return challenge.bonusPoints ?? 0;
    }
  }

  if (challenge.challengeType === 'rest') {
    return 0;
  }

  if (challenge.challengeType === 'double') {
    return totalFlooredPoints;
  }

  return 0;
}

// Add or update a daily activity
export const upsertDailyActivity = internalMutation({
  args: {
    userId: v.id('users'),
    date: v.string(), // YYYY-MM-DD format
    steps: v.optional(v.number()),
    zone2Minutes: v.optional(v.number()),
    stepsTill11am: v.optional(v.number()),
    synced: v.boolean(),
    storageId: v.optional(v.id('_storage')),
  },
  returns: v.id('dailyActivities'),
  handler: async (ctx, args) => {
    // Ensure all numeric values are non-negative
    const sanitizedSteps = Math.max(0, Math.floor(args.steps ?? 0));
    const sanitizedZone2Minutes = Math.max(0, args.zone2Minutes ?? 0);
    const sanitizedStepsTill11am = Math.max(0, Math.floor(args.stepsTill11am ?? 0));

    const dailyChallengesList = await ctx.db.query('dailyChallengesList').collect();
    const user = await ctx.db.get(args.userId);
    const userAppVersion = user?.appVersion ?? '1.0.0';
    const userMissionFeatureFlagEnabled = compare(
      userAppVersion,
      appVersions.minVersionForMission,
      '>='
    );

    // Only calculate mission points if activity date is on or after user's creation date
    const userCreationDate = user?._creationTime
      ? new Date(user._creationTime).toISOString().split('T')[0]
      : '9999-12-31';
    const shouldCalculateMissionPoints = args.date >= userCreationDate;

    let activityId;

    if (args.synced) {
      // Check if activity for this date already exists
      const existingActivity = await ctx.db
        .query('dailyActivities')
        .withIndex('by_user_date_synced', (q) =>
          q.eq('userId', args.userId).eq('date', args.date).eq('synced', args.synced)
        )
        .first();

      // if (args.synced === false && existingActivity.reviewStatus === 'approved') {
      //   throw new ConvexError('Cannot update approved activity');
      // }
      // Update existing activity
      if (!existingActivity) {
        // Calculate points
        const points = calculatePoints(sanitizedSteps, sanitizedZone2Minutes);

        const stepsPoints = calculateStepsPoints(sanitizedSteps);
        const zone2Points = calculateZone2Points(sanitizedZone2Minutes);

        // Floor individual points
        const flooredStepsPoints = Math.floor(stepsPoints);
        const flooredZone2Points = Math.floor(zone2Points);
        const flooredPoints = flooredStepsPoints + flooredZone2Points;

        const missionPoints = calculateMissionPoints(
          args.date,
          sanitizedStepsTill11am,
          sanitizedZone2Minutes,
          sanitizedSteps,
          flooredPoints,
          dailyChallengesList,
          shouldCalculateMissionPoints && userMissionFeatureFlagEnabled
        );

        const displayTotalPoints = await applyFreeDailyCap(
          ctx,
          args.userId,
          args.date,
          flooredPoints + missionPoints,
          'activity'
        );

        // Create new activity
        activityId = await ctx.db.insert('dailyActivities', {
          userId: args.userId,
          date: args.date,
          steps: sanitizedSteps,
          zone2Minutes: sanitizedZone2Minutes,
          stepsTill11am: sanitizedStepsTill11am,
          missionPoints,
          points: points + missionPoints,
          displayTotalPoints,
          synced: args.synced,
          image: args.storageId,
        });
      } else {
        activityId = existingActivity._id;

        // Check if we need to update steps
        const shouldUpdateSteps =
          args.steps !== undefined && sanitizedSteps > existingActivity.steps;
        const shouldUpdateStepsTill11am =
          args.stepsTill11am !== undefined &&
          sanitizedStepsTill11am > (existingActivity.stepsTill11am ?? 0);
        // Check if we need to update zone2Minutes
        const shouldUpdateZone2 =
          args.zone2Minutes !== undefined &&
          sanitizedZone2Minutes > (existingActivity.zone2Minutes ?? 0);

        // Only update if at least one value is greater
        if (shouldUpdateSteps || shouldUpdateZone2 || shouldUpdateStepsTill11am) {
          // Use the greater values between new and existing
          const finalSteps = Math.max(sanitizedSteps, existingActivity.steps);
          const finalStepsTill11am = Math.max(
            sanitizedStepsTill11am,
            existingActivity.stepsTill11am ?? 0
          );
          const finalZone2Minutes = Math.max(
            sanitizedZone2Minutes,
            existingActivity.zone2Minutes ?? 0
          );

          // Calculate points with final values
          const points = calculatePoints(finalSteps, finalZone2Minutes);
          const flooredStepsPoints = Math.floor(calculateStepsPoints(finalSteps));
          const flooredZone2Points = Math.floor(calculateZone2Points(finalZone2Minutes));
          const flooredPoints = flooredStepsPoints + flooredZone2Points;

          const missionPoints = calculateMissionPoints(
            args.date,
            finalStepsTill11am,
            finalZone2Minutes,
            finalSteps,
            flooredPoints,
            dailyChallengesList,
            shouldCalculateMissionPoints && userMissionFeatureFlagEnabled
          );

          const displayTotalPoints = await applyFreeDailyCap(
            ctx,
            args.userId,
            args.date,
            flooredPoints + missionPoints,
            'activity'
          );

          await ctx.db.patch(existingActivity._id, {
            steps: finalSteps,
            zone2Minutes: finalZone2Minutes,
            stepsTill11am: finalStepsTill11am,
            missionPoints,
            points: points + missionPoints,
            displayTotalPoints,
            synced: args.synced,
            reviewStatus: undefined,
            image: args.storageId ?? existingActivity.image,
          });
        }
      }
    } else {
      // Calculate points
      const points = calculatePoints(sanitizedSteps, sanitizedZone2Minutes);
      const flooredStepsPoints = Math.floor(calculateStepsPoints(sanitizedSteps));
      const flooredZone2Points = Math.floor(calculateZone2Points(sanitizedZone2Minutes));
      const flooredPoints = flooredStepsPoints + flooredZone2Points;

      const missionPoints = calculateMissionPoints(
        args.date,
        sanitizedStepsTill11am,
        sanitizedZone2Minutes,
        sanitizedSteps,
        flooredPoints,
        dailyChallengesList,
        shouldCalculateMissionPoints && userMissionFeatureFlagEnabled
      );

      const displayTotalPoints = await applyFreeDailyCap(
        ctx,
        args.userId,
        args.date,
        flooredPoints + missionPoints,
        'activity'
      );

      // Create new activity
      activityId = await ctx.db.insert('dailyActivities', {
        userId: args.userId,
        date: args.date,
        steps: sanitizedSteps,
        zone2Minutes: sanitizedZone2Minutes,
        stepsTill11am: sanitizedStepsTill11am,
        missionPoints,
        points: points + missionPoints,
        displayTotalPoints,
        synced: args.synced,
        image: args.storageId,
      });
    }

    // Update the monthly leaderboard
    if (args.synced) {
      const yearMonth = args.date.substring(0, 7); // YYYY-MM
      await ctx.scheduler.runAfter(0, internal.leaderboard.updateMonthlyLeaderboard, {
        userId: args.userId,
        yearMonth,
      });
    }

    // Recompute track rollups for this user/date
    await ctx.runMutation(internal.track.recompute.recomputeTrackForDate, {
      userId: args.userId,
      date: args.date,
    });

    return activityId;
  },
});

// Sync health data for specified days
export const syncHealthData = mutation({
  args: {
    userId: v.id('users'),
    healthData: v.array(
      v.object({
        date: v.string(), // YYYY-MM-DD
        steps: v.number(),
        zone2Minutes: v.optional(v.number()),
        stepsTill11am: v.optional(v.number()),
      })
    ),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return true;

    const user = await ctx.db.get(userId);
    if (!user) return true;
    if (!user.autoSyncEnabled) return true;

    // Update each daily activity
    for (const data of args.healthData) {
      await ctx.runMutation(internal.activities.upsertDailyActivity, {
        userId: args.userId,
        date: data.date,
        steps: data.steps,
        zone2Minutes: data.zone2Minutes,
        stepsTill11am: data.stepsTill11am,
        synced: true,
      });
    }

    // Update user's last sync date
    await ctx.db.patch(args.userId, {
      lastSyncDate: Date.now(),
    });

    return true;
  },
});

export const deleteManualActivity = mutation({
  args: {
    activityId: v.id('dailyActivities'),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError('Unauthorized');
    }

    const activity = await ctx.db.get(args.activityId);
    if (!activity) {
      throw new ConvexError('Activity not found');
    }

    if (activity.userId !== userId) {
      throw new ConvexError('Unauthorized');
    }

    if (activity.synced) {
      throw new ConvexError('Cannot delete automatically synced activity');
    }

    if (activity.reviewStatus === 'approved') {
      throw new ConvexError('Cannot delete approved activity');
    }

    const yearMonth = activity.date.substring(0, 7); // YYYY-MM
    const activityDate = activity.date;
    await ctx.db.delete(args.activityId);
    await ctx.scheduler.runAfter(0, internal.leaderboard.updateMonthlyLeaderboard, {
      userId,
      yearMonth,
    });

    // Recompute track rollups after delete
    await ctx.runMutation(internal.track.recompute.recomputeTrackForDate, {
      userId,
      date: activityDate,
    });

    return true;
  },
});

// Sync health data for specified days
export const addHealthDataManually = mutation({
  args: {
    healthData: v.object({
      date: v.string(), // YYYY-MM-DD
      steps: v.optional(v.number()),
      storageId: v.optional(v.id('_storage')),
    }),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    // Update each daily activity
    const userId = await getAuthUserId(ctx);
    if (!userId) return true;

    const user = await ctx.db.get(userId);
    if (!user) return true;
    if (user.autoSyncEnabled) {
      throw new ConvexError('Cannot add manually when auto sync is enabled');
    }

    const data = args.healthData;
    await ctx.runMutation(internal.activities.upsertDailyActivity, {
      userId,
      date: data.date,
      steps: data.steps,
      storageId: data.storageId,
      synced: false,
    });

    const admins = await ctx.db
      .query('users')
      .withIndex('isAdmin', (q) => q.eq('isAdmin', true))
      .collect();

    admins.forEach((admin) => {
      ctx.scheduler.runAfter(0, internal.pushNotification.sendPushNotification, {
        userId: [admin._id],
        notificationType: 'newActivitySubmitted',
        options: {
          userName: user.name ?? 'User',
        },
      });
    });

    return true;
  },
});

// Sync health data for specified days
export const updateHealthDataManually = mutation({
  args: {
    activityId: v.id('dailyActivities'),
    healthData: v.object({
      date: v.string(), // YYYY-MM-DD
      steps: v.optional(v.number()),
      storageId: v.optional(v.id('_storage')),
    }),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    // Update each daily activity
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError('Unauthorized');
    }

    const user = await ctx.db.get(userId);
    if (!user) {
      throw new ConvexError('User not found');
    }

    const activity = await ctx.db.get(args.activityId);
    if (!activity) {
      throw new ConvexError('Activity not found');
    }

    if (activity.userId !== userId) {
      throw new ConvexError('Unauthorized');
    }

    if (activity.synced) {
      throw new ConvexError('Cannot update automatically synced activity');
    }

    if (activity.reviewStatus === 'approved') {
      throw new ConvexError('Cannot update approved activity');
    }

    const data = args.healthData;
    const points = calculatePoints(
      data.steps ?? activity.steps,
      0 // Zone 2 minutes not available for manual entries
    );
    const flooredStepsPoints = Math.floor(calculateStepsPoints(data.steps ?? activity.steps));
    const flooredZone2Points = Math.floor(calculateZone2Points(0));
    const flooredPoints = flooredStepsPoints + flooredZone2Points;

    const displayTotalPoints = await applyFreeDailyCap(
      ctx,
      activity.userId,
      activity.date,
      flooredPoints,
      'activity'
    );

    await ctx.db.patch(activity._id, {
      steps: data.steps ?? activity.steps,
      points,
      displayTotalPoints,
      synced: false,
      reviewStatus: undefined,
      image: data.storageId ?? activity.image,
    });

    // Recompute track rollups after manual update
    await ctx.runMutation(internal.track.recompute.recomputeTrackForDate, {
      userId,
      date: activity.date,
    });

    return true;
  },
});

export const getUserActivities = query({
  args: {
    paginationOpts: paginationOptsValidator,
    userId: v.optional(v.id('users')),
  },
  returns: v.object({
    page: v.array(v.any()),
    continueCursor: v.string(),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const currentUserId = await getAuthUserId(ctx);
    if (!currentUserId) {
      return {
        page: [],
        continueCursor: '',
        isDone: true,
      };
    }

    const targetUserId = args.userId || currentUserId;

    // Get activities
    const activitiesQuery =
      args.userId && args.userId !== currentUserId
        ? ctx.db
            .query('dailyActivities')
            .withIndex('by_user_date', (q) => q.eq('userId', targetUserId))
            .filter((q) =>
              q.or(q.eq(q.field('synced'), true), q.eq(q.field('reviewStatus'), 'approved'))
            )
        : ctx.db
            .query('dailyActivities')
            .withIndex('by_user_date', (q) => q.eq('userId', targetUserId));

    const activities = await activitiesQuery.order('desc').collect();

    // Get all check-ins for this user
    const checkIns = await ctx.db
      .query('userCheckIns')
      .withIndex('by_user', (q) => q.eq('userId', targetUserId))
      .collect();

    // Create a map to track check-ins by date
    const checkInByDate = new Map<string, any>();
    for (const checkIn of checkIns) {
      checkInByDate.set(checkIn.date, checkIn);
    }

    // Resolve target user's premium status + daily cap for display clamp
    const targetUser = await ctx.db.get(targetUserId);
    const targetIsPremium = (targetUser?.isPremium ?? false) || (targetUser?.isAdmin ?? false);
    const dailyCap = await getDailyPointsCap(ctx);

    // Aggregate challenge completion points by date for this user
    const challengeCompletions = await ctx.db
      .query('challengeCompletions')
      .withIndex('by_user', (q) => q.eq('userId', targetUserId))
      .filter((q) => q.neq(q.field('removed'), true))
      .collect();
    const challengePointsByDate = new Map<string, number>();
    for (const c of challengeCompletions) {
      challengePointsByDate.set(c.date, (challengePointsByDate.get(c.date) ?? 0) + c.pointsEarned);
    }

    // Process all activities and add points breakdown
    const processedActivities: any[] = [];
    const datesWithActivities = new Set<string>();

    for (const activity of activities) {
      // Calculate individual points (without flooring yet)
      const stepsPoints = calculateStepsPoints(activity.steps ?? 0);
      const zone2Points = calculateZone2Points(activity.zone2Minutes ?? 0);

      // Check if this is the first activity for this date and if there's a check-in
      const isFirstActivityForDate = !datesWithActivities.has(activity.date);
      const checkIn = checkInByDate.get(activity.date);
      const checkInPoints = isFirstActivityForDate && checkIn ? checkIn.points : 0;

      datesWithActivities.add(activity.date);

      // Floor individual points
      const flooredStepsPoints = Math.floor(stepsPoints);
      const flooredZone2Points = Math.floor(zone2Points);
      const flooredCheckInPoints = Math.floor(checkInPoints);
      const flooredMissionPoints = Math.floor(activity.missionPoints ?? 0);
      const challengePoints = isFirstActivityForDate
        ? Math.floor(challengePointsByDate.get(activity.date) ?? 0)
        : 0;
      const recalculatedPoints =
        flooredStepsPoints + flooredZone2Points + flooredCheckInPoints + challengePoints;

      const displayTotal = targetIsPremium
        ? Math.floor(recalculatedPoints)
        : Math.min(dailyCap, Math.floor(recalculatedPoints));

      processedActivities.push({
        ...activity,
        stepsPoints: flooredStepsPoints,
        zone2Points: flooredZone2Points,
        checkInPoints: flooredCheckInPoints,
        points: recalculatedPoints,
        missionPoints: flooredMissionPoints,
        challengePoints,
        displayTotalPoints: displayTotal,
      });
    }

    // Add check-in only days (days with check-in but no activities)

    for (const [date, checkIn] of checkInByDate) {
      if (!datesWithActivities.has(date)) {
        const cp = Math.floor(challengePointsByDate.get(checkIn.date) ?? 0);
        const checkInRowTotal = Math.floor(checkIn.points) + cp;
        const checkInDisplayTotal = targetIsPremium
          ? checkInRowTotal
          : Math.min(dailyCap, checkInRowTotal);
        processedActivities.push({
          _id: `checkin_${checkIn._id}`,
          _creationTime: checkIn._creationTime,
          userId: checkIn.userId,
          date: checkIn.date,
          steps: 0,
          zone2Minutes: 0,
          points: checkInRowTotal,
          displayTotalPoints: checkInDisplayTotal,
          synced: true,
          isCheckInOnly: true,
          stepsPoints: 0,
          zone2Points: 0,
          checkInPoints: Math.floor(checkIn.points),
          missionPoints: 0,
          challengePoints: cp,
        });
      }
    }

    // Filter out activities with less than 1 point, then sort
    const combinedActivities = processedActivities
      .filter((activity) => activity.points >= 1)
      .sort((a, b) => {
        const dateCompare = b.date.localeCompare(a.date);
        if (dateCompare !== 0) return dateCompare;
        return b._creationTime - a._creationTime;
      });

    // Implement pagination manually
    const startIndex = args.paginationOpts.cursor ? parseInt(args.paginationOpts.cursor) : 0;
    const pageSize = args.paginationOpts.numItems;
    const endIndex = startIndex + pageSize;

    const page = combinedActivities.slice(startIndex, endIndex);
    const nextCursor = endIndex < combinedActivities.length ? endIndex.toString() : '';

    return {
      page,
      continueCursor: nextCursor,
      isDone: nextCursor === '',
    };
  },
});

export const getPointsForDate = query({
  args: {
    date: v.string(),
  },
  returns: v.object({
    date: v.string(),
    stepsPoints: v.number(),
    zone2Points: v.number(),
    checkInPoints: v.number(),
    totalFlooredPoints: v.number(),
    totalSteps: v.number(),
    totalStepsTill11am: v.number(),
    totalZone2Minutes: v.number(),
    missionPoints: v.number(),
    missionCompletedDaysCount: v.number(),
    missionLeftDaysCount: v.number(),
    missionTarget: v.number(),
    totalUsersCompletedMissionCount: v.optional(v.number()),
  }),
  handler: async (ctx, args) => {
    const MONTHLY_PRIZE_MISSION_COMPLETED_DAYS_THRESHOLD = 20;

    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return {
        date: args.date,
        stepsPoints: 0,
        zone2Points: 0,
        checkInPoints: 0,
        totalFlooredPoints: 0,
        totalStepsTill11am: 0,
        totalSteps: 0,
        totalZone2Minutes: 0,
        missionPoints: 0,
        missionCompletedDaysCount: 0,
        missionLeftDaysCount: 0,
        missionTarget: MONTHLY_PRIZE_MISSION_COMPLETED_DAYS_THRESHOLD,
        totalUsersCompletedMissionCount: undefined,
      };
    }

    const activities = await ctx.db
      .query('dailyActivities')
      .withIndex('by_user_date', (q) => q.eq('userId', userId).eq('date', args.date))
      .filter((q) => q.or(q.eq(q.field('synced'), true), q.eq(q.field('reviewStatus'), 'approved')))
      .collect();

    const totalSteps = activities.reduce((sum, activity) => sum + activity.steps, 0);
    const totalMissionPoints = activities.reduce(
      (sum, activity) => sum + (activity.missionPoints ?? 0),
      0
    );
    const stepsPoints = calculateStepsPoints(totalSteps);
    const totalZone2Minutes = activities.reduce(
      (sum, activity) => sum + (activity.zone2Minutes ?? 0),
      0
    );
    const zone2Points = calculateZone2Points(totalZone2Minutes);
    const totalFlooredPoints = activities.reduce(
      (sum, activity) => sum + (activity.displayTotalPoints ?? 0),
      0
    );
    const totalStepsTill11am = activities.reduce(
      (sum, activity) => sum + (activity.stepsTill11am ?? 0),
      0
    );
    const userCheckIn = await ctx.db
      .query('userCheckIns')
      .withIndex('by_user_date', (q) => q.eq('userId', userId).eq('date', args.date))
      .first();

    const checkInPoints = userCheckIn ? userCheckIn.points : 0;

    // Count days with mission points > 0 in the month
    const yearMonth = args.date.substring(0, 7); // YYYY-MM
    const monthActivities = await ctx.db
      .query('dailyActivities')
      .withIndex('by_user_date', (q) => q.eq('userId', userId))
      .filter((q) =>
        q.and(
          q.gte(q.field('date'), yearMonth + '-01'),
          q.lte(q.field('date'), yearMonth + '-31'),
          q.or(q.eq(q.field('synced'), true), q.eq(q.field('reviewStatus'), 'approved')),
          q.gt(q.field('missionPoints'), 0)
        )
      )
      .collect();

    const missionCompletedDaysCount = monthActivities.length;

    let missionLeftDaysCount =
      MONTHLY_PRIZE_MISSION_COMPLETED_DAYS_THRESHOLD - missionCompletedDaysCount;
    if (missionLeftDaysCount < 0) {
      missionLeftDaysCount = 0;
    }

    const totalUsersCompletedMissionCount = await ctx.db
      .query('dailyActivities')
      .withIndex('by_date', (q) => q.eq('date', args.date))
      .filter((q) =>
        q.and(
          q.or(q.eq(q.field('synced'), true), q.eq(q.field('reviewStatus'), 'approved')),
          q.gt(q.field('missionPoints'), 0)
        )
      )
      .collect();

    return {
      date: args.date,
      stepsPoints: Math.floor(stepsPoints),
      zone2Points: Math.floor(zone2Points),
      checkInPoints: Math.floor(checkInPoints),
      totalFlooredPoints,
      totalStepsTill11am,
      totalSteps,
      totalZone2Minutes,
      missionPoints: totalMissionPoints,
      missionCompletedDaysCount,
      missionLeftDaysCount,
      missionTarget: MONTHLY_PRIZE_MISSION_COMPLETED_DAYS_THRESHOLD,
      totalUsersCompletedMissionCount:
        totalUsersCompletedMissionCount.length > 2
          ? totalUsersCompletedMissionCount.length
          : undefined,
    };
  },
});

export const getManualActivity = query({
  args: {
    activityId: v.id('dailyActivities'),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError('Unauthorized');
    }

    const activity = await ctx.db.get(args.activityId);

    if (!activity) {
      return null;
    }

    const imageUrl = activity.image ? await ctx.storage.getUrl(activity.image) : null;

    return {
      ...activity,
      imageUrl,
    };
  },
});

// Get missed days that need syncing
export const getMissedDaysForSync = query({
  args: {
    userId: v.id('users'),
  },
  returns: v.array(v.string()),
  handler: async (ctx, args) => {
    const maxDaysBack = 32;
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error('User not found');
    }

    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const missedDays = [];

    // Calculate the oldest date to check (maxDaysBack days ago)
    let oldestDate = new Date();
    oldestDate.setDate(today.getDate() - maxDaysBack);

    // Also consider the first day of the current month
    const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    oldestDate = new Date(Math.max(firstOfMonth.getTime(), oldestDate.getTime()));

    // const userCreatedAt = new Date(user._creationTime);
    // oldestDate = new Date(Math.max(userCreatedAt.getTime(), oldestDate.getTime()));

    const userLastSyncDate = user.lastSyncDate ? new Date(user.lastSyncDate) : null;
    if (userLastSyncDate) {
      oldestDate = new Date(Math.max(userLastSyncDate.getTime(), oldestDate.getTime()));
    }

    // Format date to YYYY-MM-DD for comparison
    const formatDate = (date: Date) => {
      return date.toISOString().split('T')[0];
    };

    // Get only activities within our date range for efficiency
    const oldestDateStr = formatDate(oldestDate);

    const existingActivities = await ctx.db
      .query('dailyActivities')
      .withIndex('by_user_date', (q) => q.eq('userId', args.userId))
      .filter((q) => q.gte(q.field('date'), oldestDateStr))
      .collect();

    // Create a set of dates that already have activities
    const recordedDates = new Set<string>();
    for (const activity of existingActivities) {
      recordedDates.add(activity.date);
    }

    // Always include today and yesterday
    const todayStr = formatDate(today);
    const yesterdayStr = formatDate(yesterday);
    const firstOfMonthStr = formatDate(firstOfMonth);

    // Calculate last day of previous month
    // Using date with 0 as day gives us the last day of previous month
    const lastOfPreviousMonth = new Date(today.getFullYear(), today.getMonth(), 0);
    // Set time to noon to avoid timezone issues
    lastOfPreviousMonth.setHours(12, 0, 0, 0);
    const lastOfPreviousMonthStr = formatDate(lastOfPreviousMonth);

    // Always add today
    missedDays.push(todayStr);

    // Add yesterday only if it's not before the first of the month
    if (yesterdayStr >= firstOfMonthStr) {
      missedDays.push(yesterdayStr);
    }

    // Always add first of current month
    missedDays.push(firstOfMonthStr);

    // Always add last of previous month
    missedDays.push(lastOfPreviousMonthStr);

    // Check each day in the range for other missed days
    const tempDate = new Date(oldestDate);
    let loopCount = 0;
    const maxLoops = maxDaysBack + 2; // Safety limit

    while (tempDate <= yesterday && loopCount < maxLoops) {
      const dateStr = formatDate(tempDate);

      // Skip dates that are already explicitly added
      if (
        dateStr !== todayStr &&
        dateStr !== yesterdayStr &&
        dateStr !== firstOfMonthStr &&
        dateStr !== lastOfPreviousMonthStr
      ) {
        // If we don't have an activity for this date, add it to missedDays
        if (!recordedDates.has(dateStr)) {
          missedDays.push(dateStr);
        }
      }

      // Move to next day
      tempDate.setDate(tempDate.getDate() + 1);

      loopCount++;
    }

    // Sort missed days in chronological order and remove duplicates
    const uniqueMissedDays = [...new Set(missedDays)];
    uniqueMissedDays.sort();
    return uniqueMissedDays;
  },
});

// Get the monthly leaderboard
export const getMonthlyLeaderboard = query({
  args: {
    paginationOpts: paginationOptsValidator,
    yearMonth: v.string(), // YYYY-MM
  },
  handler: async (ctx, args) => {
    // Use the rank index for efficient querying
    const leaderboardEntries = await ctx.db
      .query('monthlyLeaderboard')
      .withIndex('by_year_month_and_rank', (q) => q.eq('yearMonth', args.yearMonth))
      .order('asc')
      .paginate(args.paginationOpts);

    // Build results with user details - rank is already calculated
    const results: any[] = [];

    for (const entry of leaderboardEntries.page) {
      const user = await ctx.db.get(entry.userId);
      if (user) {
        const imageUrl = user.image ? await ctx.storage.getUrl(user.image) : null;

        results.push({
          _id: entry._id,
          userId: entry.userId,
          name: user.name ?? 'Anonymous User',
          user: {
            ...user,
            image: imageUrl,
          },
          totalPoints: entry.totalPoints,
          displayTotalPoints: entry.displayTotalPoints,
          rank: entry.rank || 0,
        });
      }
    }

    return {
      ...leaderboardEntries,
      page: results,
    };
  },
});

// Get the monthly leaderboard around a specific user's rank
export const getMonthlyLeaderboardAroundUser = query({
  args: {
    yearMonth: v.string(),
  },
  handler: async (ctx, args) => {
    const RETURN_COUNT = 10;
    const ENTRIES_BEFORE_AFTER = 10;

    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError('Unauthorized');
    }

    // First get the user's rank and points
    const userEntry = await ctx.db
      .query('monthlyLeaderboard')
      .withIndex('by_user_and_year_month', (q) =>
        q.eq('userId', userId).eq('yearMonth', args.yearMonth)
      )
      .unique();

    // Count total users in leaderboard with at least 1 point
    const totalUsers = await ctx.db
      .query('monthlyLeaderboard')
      .withIndex('by_year_month_and_points', (q) => q.eq('yearMonth', args.yearMonth))
      .collect();

    // Get warmup entries (users with less than 1 point) - fetch once and reuse
    const warmupEntriesData = await ctx.db
      .query('monthlyLeaderboard')
      .withIndex('by_year_month_display_points_total_points', (q) =>
        q.eq('yearMonth', args.yearMonth)
      )
      .filter((q) => q.lt(q.field('totalPoints'), 1))
      .order('desc')
      .take(10);

    const warmupEntries: any[] = [];
    for (const entry of warmupEntriesData) {
      const user = await ctx.db.get(entry.userId);
      if (user) {
        const imageUrl = user.image ? await ctx.storage.getUrl(user.image) : null;
        warmupEntries.push({
          userId: entry.userId,
          name: user.name ?? 'Anonymous User',
          user: {
            ...user,
            image: imageUrl,
          },
          totalPoints: entry.totalPoints,
          displayTotalPoints: entry.displayTotalPoints,
          rank: 0, // No rank for warmup entries
        });
      }
    }

    if (!userEntry || (userEntry.displayTotalPoints ?? 0) < 1) {
      return {
        entries: [],
        totalUsers: totalUsers.length,
        warmupEntries,
      };
    }

    const userRank = userEntry.rank || 0;

    // Get top RETURN_COUNT entries using rank index (much more efficient)
    const topEntries = await ctx.db
      .query('monthlyLeaderboard')
      .withIndex('by_year_month_and_rank', (q) => q.eq('yearMonth', args.yearMonth))
      .filter((q) => q.gte(q.field('totalPoints'), 1))
      .order('asc')
      .take(RETURN_COUNT);

    const results: any[] = [];
    const seenEntryIds = new Set<string>();

    // Format top RETURN_COUNT results
    for (const entry of topEntries) {
      const user = await ctx.db.get(entry.userId);
      if (user) {
        const imageUrl = user.image ? await ctx.storage.getUrl(user.image) : null;
        results.push({
          userId: entry.userId,
          name: user.name ?? 'Anonymous User',
          user: {
            ...user,
            image: imageUrl,
          },
          totalPoints: entry.totalPoints,
          displayTotalPoints: entry.displayTotalPoints ?? 0,
          rank: entry.rank || 0,
        });
        seenEntryIds.add(entry._id);
      }
    }

    // If user is in top RETURN_COUNT, we're done
    if (userRank <= RETURN_COUNT) {
      return {
        entries: results,
        totalUsers: totalUsers.length,
        warmupEntries,
      };
    }

    // User is not in top RETURN_COUNT, get entries around user's rank
    // Create a divider entry
    results.push({
      _id: 'divider',
      userId: 'divider',
      name: '...',
      user: null,
      totalPoints: 0,
      rank: 0,
      isDivider: true,
    });

    // Get entries around user's rank using rank index (much more efficient)
    const startRank = Math.max(1, userRank - ENTRIES_BEFORE_AFTER);
    const endRank = userRank + ENTRIES_BEFORE_AFTER;

    const entriesAroundUser = await ctx.db
      .query('monthlyLeaderboard')
      .withIndex('by_year_month_and_rank', (q) => q.eq('yearMonth', args.yearMonth))
      .filter((q) =>
        q.and(
          q.gte(q.field('rank'), startRank),
          q.lte(q.field('rank'), endRank),
          q.gte(q.field('totalPoints'), 1)
        )
      )
      .order('asc')
      .collect();

    // Add entries around user (if not already in top RETURN_COUNT)
    for (const entry of entriesAroundUser) {
      if (!seenEntryIds.has(entry._id)) {
        const user = await ctx.db.get(entry.userId);
        if (user) {
          const imageUrl = user.image ? await ctx.storage.getUrl(user.image) : null;
          results.push({
            userId: entry.userId,
            name: user.name ?? 'Anonymous User',
            user: {
              ...user,
              image: imageUrl,
            },
            totalPoints: entry.totalPoints,
            displayTotalPoints: entry.displayTotalPoints ?? 0,
            rank: entry.rank || 0,
          });
          seenEntryIds.add(entry._id);
        }
      }
    }

    return {
      entries: results,
      totalUsers: totalUsers.length,
      warmupEntries,
    };
  },
});

// Get a user's position in the leaderboard
export const getUserLeaderboardPosition = query({
  args: {
    yearMonth: v.string(), // YYYY-MM
  },
  returns: v.object({
    rank: v.number(),
    totalPoints: v.number(),
    totalUsers: v.number(),
    displayTotalPoints: v.optional(v.number()),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return {
        rank: 0,
        totalPoints: 0,
        totalUsers: 0,
        displayTotalPoints: 0,
      };
    }

    // Get the user's entry
    const userEntry = await ctx.db
      .query('monthlyLeaderboard')
      .withIndex('by_user_and_year_month', (q) =>
        q.eq('userId', userId).eq('yearMonth', args.yearMonth)
      )
      .unique();

    if (!userEntry || userEntry.totalPoints < 1) {
      return {
        rank: 0,
        totalPoints: 0,
        totalUsers: 0,
        displayTotalPoints: 0,
      };
    }

    // Count total users in leaderboard (only users with at least 1 point)
    const totalUsers = await ctx.db
      .query('monthlyLeaderboard')
      .withIndex('by_year_month_and_points', (q) => q.eq('yearMonth', args.yearMonth))
      .filter((q) => q.gte(q.field('totalPoints'), 1))
      .collect();

    return {
      rank: userEntry.rank || 0, // Use pre-calculated rank
      totalPoints: userEntry.totalPoints,
      totalUsers: totalUsers.length,
      displayTotalPoints: userEntry.displayTotalPoints,
    };
  },
});

// Internal mutation to recalculate and update points for all daily activities
export const recalculateAllActivityPoints = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Get all daily activities
    const activities = await ctx.db.query('dailyActivities').collect();

    let updatedCount = 0;
    const affectedMonths = new Set<string>();

    for (const activity of activities) {
      // Recalculate points using existing values
      const newPoints = calculatePoints(activity.steps, activity.zone2Minutes ?? 0);
      const flooredStepsPoints = Math.floor(calculateStepsPoints(activity.steps));
      const flooredZone2Points = Math.floor(calculateZone2Points(activity.zone2Minutes ?? 0));
      const displayTotalPoints = flooredStepsPoints + flooredZone2Points;

      // Update only the points
      await ctx.db.patch(activity._id, {
        points: newPoints,
        displayTotalPoints,
      });

      updatedCount++;

      // Track affected months for leaderboard updates
      const yearMonth = activity.date.substring(0, 7);
      affectedMonths.add(`${activity.userId}|${yearMonth}`);
      // }
    }

    // Schedule leaderboard updates for all affected user-month combinations
    for (const userMonth of affectedMonths) {
      const [userId, yearMonth] = userMonth.split('|');
      await ctx.scheduler.runAfter(0, internal.leaderboard.updateMonthlyLeaderboard, {
        userId: userId as Id<'users'>,
        yearMonth,
      });
    }

    return {
      totalActivities: activities.length,
      updatedActivities: updatedCount,
      affectedUserMonths: affectedMonths.size,
    };
  },
});
