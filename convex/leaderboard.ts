import { getAuthUserId } from '@convex-dev/auth/server';
import { compare } from 'compare-versions';
import { paginationOptsValidator } from 'convex/server';
import { ConvexError, v } from 'convex/values';

import { internal } from './_generated/api';
import { internalMutation, query } from './_generated/server';
import { calculatePoints } from './activities';
import { appVersions } from './appVersions';
import { notificationContents } from './pushNotification';
import { getStreakEarnedDatesInRange } from './utils/streak';
import { addDaysUTC, getMondayInTZ, ymdUTC } from './utils/timezone';

// Update the monthly leaderboard for a user
export const updateMonthlyLeaderboard = internalMutation({
  args: {
    userId: v.id('users'),
    yearMonth: v.string(), // YYYY-MM
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Calculate total points for the month
    const startOfMonth = `${args.yearMonth}-01`;
    const nextMonth = new Date(args.yearMonth + '-01');
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const endOfMonth = nextMonth.toISOString().split('T')[0];

    const activities = await ctx.db
      .query('dailyActivities')
      .withIndex('by_user_date', (q) =>
        q.eq('userId', args.userId).gte('date', startOfMonth).lt('date', endOfMonth)
      )
      .filter((q) => q.or(q.eq(q.field('synced'), true), q.eq(q.field('reviewStatus'), 'approved')))
      .collect();

    const totalSteps = activities.reduce((sum, activity) => sum + activity.steps, 0);
    const totalZone2Minutes = activities.reduce(
      (sum, activity) => sum + (activity.zone2Minutes ?? 0),
      0
    );

    const activityPoints = calculatePoints(totalSteps, totalZone2Minutes);
    const totalDisplayActivityPoints = activities.reduce(
      (sum, activity) => sum + (activity.displayTotalPoints ?? 0),
      0
    );

    // Get checkin points for the month
    const checkIns = await ctx.db
      .query('userCheckIns')
      .withIndex('by_user_date', (q) =>
        q.eq('userId', args.userId).gte('date', startOfMonth).lt('date', endOfMonth)
      )
      .collect();

    const checkInPoints = checkIns.reduce((sum, checkIn) => sum + checkIn.points, 0);

    // Get challenge completion points for the month
    const challengeCompletions = await ctx.db
      .query('challengeCompletions')
      .withIndex('by_user_date', (q) =>
        q.eq('userId', args.userId).gte('date', startOfMonth).lt('date', endOfMonth)
      )
      .collect();

    const challengePoints = challengeCompletions.reduce(
      (sum, completion) => sum + completion.pointsEarned,
      0
    );

    // Calculate streak bonus points for the month
    // A streak = a Mon-Sun week where user completed challenges on 5+ distinct days
    const streakBonusConfig = await ctx.db
      .query('appConfig')
      .withIndex('by_key', (q) => q.eq('key', 'streakBonusPoints'))
      .unique();
    const streakBonusPerWeek = streakBonusConfig ? parseInt(streakBonusConfig.value, 10) : 0;

    let streakBonusPoints = 0;
    if (streakBonusPerWeek > 0) {
      // Earned-day set for the month spans Mon..Sun, so query the broadest
      // window that any week in this month could touch (one week back from
      // the first day of month covers prior-month spillover, one week forward
      // covers next-month spillover; the inner loop limits to weeks that
      // ended within the month).
      const monthRangeStart = new Date(args.yearMonth + '-01');
      monthRangeStart.setUTCDate(monthRangeStart.getUTCDate() - 7);
      const monthRangeEnd = new Date(args.yearMonth + '-01');
      monthRangeEnd.setUTCMonth(monthRangeEnd.getUTCMonth() + 1);
      monthRangeEnd.setUTCDate(monthRangeEnd.getUTCDate() + 7);
      const earnedDates = await getStreakEarnedDatesInRange(
        ctx,
        args.userId,
        monthRangeStart.toISOString().split('T')[0],
        monthRangeEnd.toISOString().split('T')[0]
      );

      // Find current week's Monday in the user's timezone so the streak rolls
      // over at the user's local midnight, not the server's UTC midnight.
      const user = await ctx.db.get(args.userId);
      const currentMonday = getMondayInTZ(new Date(), user?.timezone);

      // Find first Monday of the month. yearMonth is a calendar identifier
      // (not a moment in time), so this stays in UTC — no TZ math needed.
      const firstOfMonth = new Date(args.yearMonth + '-01T00:00:00Z');
      const firstDayOfWeek = firstOfMonth.getUTCDay();
      const firstMondayOffset =
        firstDayOfWeek === 0 ? 1 : firstDayOfWeek === 1 ? 0 : 8 - firstDayOfWeek;
      const firstMonday = addDaysUTC(firstOfMonth, firstMondayOffset);

      // Count completed streaks. Include the current (in-progress) week so the
      // bonus is awarded the moment the user hits 5 days, not on next Monday.
      let weekStart = firstMonday;
      while (ymdUTC(weekStart) <= ymdUTC(currentMonday)) {
        let daysActive = 0;
        for (let i = 0; i < 7; i++) {
          const dateStr = ymdUTC(addDaysUTC(weekStart, i));
          if (dateStr >= startOfMonth && earnedDates.has(dateStr)) daysActive++;
        }
        if (daysActive >= 5) streakBonusPoints += streakBonusPerWeek;
        weekStart = addDaysUTC(weekStart, 7);
      }
    }

    // Total points include activity points, checkin points, challenge points, and streak bonus
    const totalPoints = activityPoints + checkInPoints + challengePoints + streakBonusPoints;
    const totalDisplayPoints =
      totalDisplayActivityPoints + checkInPoints + challengePoints + streakBonusPoints;

    // Check if an entry already exists
    const existingEntry = await ctx.db
      .query('monthlyLeaderboard')
      .withIndex('by_user_and_year_month', (q) =>
        q.eq('userId', args.userId).eq('yearMonth', args.yearMonth)
      )
      .unique();

    if (existingEntry) {
      // Update existing entry
      await ctx.db.patch(existingEntry._id, {
        totalPoints,
        displayTotalPoints: totalDisplayPoints,
      });
    } else {
      // Create new entry
      await ctx.db.insert('monthlyLeaderboard', {
        userId: args.userId,
        yearMonth: args.yearMonth,
        totalPoints,
        displayTotalPoints: totalDisplayPoints,
      });
    }

    // After updating points, recalculate ranks for all users in this month
    ctx.scheduler.runAfter(0, internal.leaderboard.recalculateRanksForMonth, {
      yearMonth: args.yearMonth,
    });

    // const userEntry = await ctx.db
    //   .query('claimedRewards')
    //   .withIndex('by_user_and_year_month', (q) =>
    //     q.eq('userId', args.userId).eq('yearMonth', args.yearMonth)
    //   )
    //   .unique();

    if (totalDisplayPoints >= 200) {
      const todayFormatted = `${args.yearMonth}-01`;
      if (totalDisplayPoints >= 500) {
        const notificationHistory = await ctx.db
          .query('notificationHistory')
          .withIndex('by_user_date_notification_type', (q) =>
            q
              .eq('userId', args.userId)
              .eq('date', todayFormatted)
              .eq('notificationType', 'newRewardUnlocked500')
          )
          .unique();
        if (notificationHistory) return;
        ctx.scheduler.runAfter(0, internal.pushNotification.sendPushNotification, {
          userId: [args.userId],
          notificationType: 'newRewardUnlocked500',
          options: {},
        });
        ctx.db.insert('notificationHistory', {
          userId: args.userId,
          date: todayFormatted,
          notificationType: 'newRewardUnlocked500',
          notificationBody: notificationContents.newRewardUnlocked500.body,
        });
      } else if (totalDisplayPoints >= 200) {
        const notificationHistory = await ctx.db
          .query('notificationHistory')
          .withIndex('by_user_date_notification_type', (q) =>
            q
              .eq('userId', args.userId)
              .eq('date', todayFormatted)
              .eq('notificationType', 'newRewardUnlocked250')
          )
          .unique();
        if (notificationHistory) return;
        ctx.scheduler.runAfter(0, internal.pushNotification.sendPushNotification, {
          userId: [args.userId],
          notificationType: 'newRewardUnlocked250',
          options: {},
        });
        ctx.db.insert('notificationHistory', {
          userId: args.userId,
          date: todayFormatted,
          notificationType: 'newRewardUnlocked250',
          notificationBody: notificationContents.newRewardUnlocked250.body,
        });
      }

      // const user = await ctx.db.get(args.userId);
      // if (!user) return;

      // const userAppVersion = user?.appVersion ?? '1.0.0';
      // const userEnduranceZoneFeatureFlagEnabled = compare(
      //   userAppVersion,
      //   appVersions.minVersionForEnduranceZone,
      //   '>='
      // );
      // if (
      //   totalDisplayPoints >= 300 &&
      //   user.enduranceZoneLevel !== 'Premium' &&
      //   userEnduranceZoneFeatureFlagEnabled &&
      //   user.isPremium
      // ) {
      //   await ctx.scheduler.runAfter(0, internal.users.syncToEnduranceZoneForUser, {
      //     userId: args.userId,
      //     level: 'Premium',
      //   });
      // }
    }

    const user = await ctx.db.get(args.userId);
    if (!user) return;

    const userAppVersion = user?.appVersion ?? '1.0.0';
    const userEnduranceZoneFeatureFlagEnabled = compare(
      userAppVersion,
      appVersions.minVersionForEnduranceZone,
      '>='
    );

    if (totalDisplayPoints >= 200 && userEnduranceZoneFeatureFlagEnabled) {
      if (totalDisplayPoints >= 500) {
        if (user.enduranceZoneLevel !== 'Premium Plus' && user.isPremium) {
          await ctx.scheduler.runAfter(0, internal.users.syncToEnduranceZoneForUser, {
            userId: args.userId,
            level: 'Premium Plus',
          });
        }
      } else if (totalDisplayPoints >= 200) {
        if (
          user.enduranceZoneLevel !== 'Premium' &&
          user.enduranceZoneLevel !== 'Premium Plus' &&
          user.isPremium
        ) {
          await ctx.scheduler.runAfter(0, internal.users.syncToEnduranceZoneForUser, {
            userId: args.userId,
            level: 'Premium',
          });
        }
      }
    }
    return null;
  },
});

// Recalculate all monthly leaderboards (admin function)
export const recalculateAllLeaderboards = internalMutation({
  args: {
    yearMonth: v.string(), // YYYY-MM
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Get all users
    const users = await ctx.db.query('users').collect();

    // Update leaderboard for each user
    for (const user of users) {
      await ctx.runMutation(internal.leaderboard.updateMonthlyLeaderboard, {
        userId: user._id,
        yearMonth: args.yearMonth,
      });
    }

    return null;
  },
});

export const updateMonthlyLeaderboardForAllUsers = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const today = new Date();
    const yearMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const leaderBordForTheMonth = await ctx.db
      .query('monthlyLeaderboard')
      .withIndex('by_year_month_and_points', (q) => q.eq('yearMonth', yearMonth))
      .collect();
    const users = await ctx.db
      .query('users')
      .withIndex('onboarded', (q) => q.eq('onboarded', true))
      .collect();

    const usersNotInLeaderboard = users.filter(
      (user) => !leaderBordForTheMonth.some((leaderboard) => leaderboard.userId === user._id)
    );

    for (const user of usersNotInLeaderboard) {
      await ctx.db.insert('monthlyLeaderboard', {
        userId: user._id,
        yearMonth,
        totalPoints: 0,
        displayTotalPoints: 0,
      });
    }

    // Recalculate ranks for all users in this month after adding new entries
    if (usersNotInLeaderboard.length > 0) {
      await ctx.runMutation(internal.leaderboard.recalculateRanksForMonth, {
        yearMonth,
      });
    }

    return null;
  },
});

export const upgradeUserToPremium = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    // Get previous month
    const today = new Date();
    const previousMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const yearMonth = `${previousMonth.getFullYear()}-${String(previousMonth.getMonth() + 1).padStart(2, '0')}`;

    const startOfMonth = `${yearMonth}-01`;
    const nextMonth = new Date(yearMonth + '-01');
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const endOfMonth = nextMonth.toISOString().split('T')[0];

    const allUsers = await ctx.db
      .query('users')
      .withIndex('isPremium', (q) => q.eq('isPremium', true))
      .collect();

    for (const user of allUsers) {
      // Skip users without timezone
      if (!user.timezone) continue;

      // Check if user's local time has entered the 1st of the new month
      const userLocalTime = new Date().toLocaleString('en-US', { timeZone: user.timezone });
      const userLocalDate = new Date(userLocalTime);
      if (userLocalDate.getDate() !== 1) continue;

      const activities = await ctx.db
        .query('dailyActivities')
        .withIndex('by_user_date', (q) =>
          q.eq('userId', user._id).gte('date', startOfMonth).lt('date', endOfMonth)
        )
        .filter((q) =>
          q.or(q.eq(q.field('synced'), true), q.eq(q.field('reviewStatus'), 'approved'))
        )
        .collect();

      const totalDisplayActivityPoints = activities.reduce(
        (sum, activity) => sum + (activity.displayTotalPoints ?? 0),
        0
      );

      // Get checkin points for the month
      const checkIns = await ctx.db
        .query('userCheckIns')
        .withIndex('by_user_date', (q) =>
          q.eq('userId', user._id).gte('date', startOfMonth).lt('date', endOfMonth)
        )
        .collect();

      const checkInPoints = checkIns.reduce((sum, checkIn) => sum + checkIn.points, 0);

      // Total points include both activity points and checkin points
      const totalDisplayPoints = totalDisplayActivityPoints + checkInPoints;

      const userAppVersion = user?.appVersion ?? '1.0.0';
      const userEnduranceZoneFeatureFlagEnabled = compare(
        userAppVersion,
        appVersions.minVersionForEnduranceZone,
        '>='
      );
      if (
        user.isPremium &&
        totalDisplayPoints >= 500 &&
        user.enduranceZoneLevel !== 'Premium Plus' &&
        userEnduranceZoneFeatureFlagEnabled
      ) {
        ctx.scheduler.runAfter(0, internal.users.syncToEnduranceZoneForUser, {
          userId: user._id,
          level: 'Premium Plus',
        });
      }

      if (
        user.isPremium &&
        totalDisplayPoints < 500 &&
        totalDisplayPoints >= 200 &&
        user.enduranceZoneLevel !== 'Premium' &&
        userEnduranceZoneFeatureFlagEnabled
      ) {
        ctx.scheduler.runAfter(0, internal.users.syncToEnduranceZoneForUser, {
          userId: user._id,
          level: 'Premium',
        });
      }

      if (
        user.isPremium &&
        totalDisplayPoints < 200 &&
        user.enduranceZoneLevel !== 'Basic Plus' &&
        userEnduranceZoneFeatureFlagEnabled
      ) {
        ctx.scheduler.runAfter(0, internal.users.syncToEnduranceZoneForUser, {
          userId: user._id,
          level: 'Basic Plus',
        });
      }
    }

    return null;
  },
});

// Recalculate ranks for all users in a given month
export const recalculateRanksForMonth = internalMutation({
  args: {
    yearMonth: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Get all entries for the month
    const allEntries = await ctx.db
      .query('monthlyLeaderboard')
      .withIndex('by_year_month_and_points', (q) => q.eq('yearMonth', args.yearMonth))
      .collect();

    // Sort entries by totalPoints (desc) and _creationTime (asc) for tiebreaker
    const sortedEntries = allEntries.sort((a, b) => {
      if ((b.displayTotalPoints ?? 0) !== (a.displayTotalPoints ?? 0)) {
        return (b.displayTotalPoints ?? 0) - (a.displayTotalPoints ?? 0);
      }

      if (b.totalPoints !== a.totalPoints) {
        return b.totalPoints - a.totalPoints;
      }
      return a._creationTime - b._creationTime;
    });

    // Update rank for each entry - all users get ranks regardless of points
    for (let i = 0; i < sortedEntries.length; i++) {
      const entry = sortedEntries[i];
      const rank = i + 1; // Everyone gets a rank from 1 to N

      await ctx.db.patch(entry._id, {
        rank,
      });
    }

    return null;
  },
});

type LeaderboardEntry = {
  userId: import('./_generated/dataModel').Id<'users'>;
  rank: number;
  displayTotalPoints: number;
  name: string;
  image: string | null;
};

export const getMonthlyLeaderboardHeader = query({
  args: { yearMonth: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError('Unauthorized');

    const banner = await ctx.db.query('rewardsBannerImage').order('desc').first();
    const targetPoints = banner?.targetPoints ?? 500;

    const hydrate = async (
      row: {
        userId: import('./_generated/dataModel').Id<'users'>;
        rank?: number;
        displayTotalPoints?: number;
      } | null
    ): Promise<LeaderboardEntry | null> => {
      if (!row) return null;
      const user = await ctx.db.get(row.userId);
      if (!user) return null;
      const imageUrl = user.image ? await ctx.storage.getUrl(user.image) : null;
      return {
        userId: row.userId,
        rank: row.rank ?? 0,
        displayTotalPoints: row.displayTotalPoints ?? 0,
        name: user.name ?? 'Anonymous User',
        image: imageUrl,
      };
    };

    // Top 3 by rank for the podium.
    const topRows = await ctx.db
      .query('monthlyLeaderboard')
      .withIndex('by_year_month_and_rank', (q) => q.eq('yearMonth', args.yearMonth))
      .filter((q) => q.gte(q.field('totalPoints'), 1))
      .order('asc')
      .take(3);

    const topHydrated = (await Promise.all(topRows.map((r) => hydrate(r)))).filter(
      (e): e is LeaderboardEntry => e !== null && e.rank > 0
    );
    const podium: [LeaderboardEntry | null, LeaderboardEntry | null, LeaderboardEntry | null] = [
      null,
      null,
      null,
    ];
    for (const e of topHydrated) {
      if (e.rank >= 1 && e.rank <= 3) podium[e.rank - 1] = e;
    }

    // Me row.
    const meRow = await ctx.db
      .query('monthlyLeaderboard')
      .withIndex('by_user_and_year_month', (q) =>
        q.eq('userId', userId).eq('yearMonth', args.yearMonth)
      )
      .unique();
    const me = await hydrate(meRow);

    // Counts. Cap at 5000 rows to bound the read budget.
    const allRows = await ctx.db
      .query('monthlyLeaderboard')
      .withIndex('by_year_month_and_points', (q) => q.eq('yearMonth', args.yearMonth))
      .take(5000);
    const totalUsers = allRows.filter((r) => r.totalPoints >= 1).length;
    const completedCount = allRows.filter(
      (r) => (r.displayTotalPoints ?? 0) >= targetPoints
    ).length;

    return {
      yearMonth: args.yearMonth,
      targetPoints,
      podium,
      me,
      totalUsers,
      completedCount,
    };
  },
});

export const listMonthlyLeaderboard = query({
  args: { yearMonth: v.string(), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError('Unauthorized');

    const result = await ctx.db
      .query('monthlyLeaderboard')
      .withIndex('by_year_month_and_rank', (q) => q.eq('yearMonth', args.yearMonth))
      .filter((q) => q.gte(q.field('totalPoints'), 1))
      .order('asc')
      .paginate(args.paginationOpts);

    const hydratedPage = await Promise.all(
      result.page.map(async (row) => {
        const user = await ctx.db.get(row.userId);
        if (!user) return null;
        const imageUrl = user.image ? await ctx.storage.getUrl(user.image) : null;
        return {
          userId: row.userId,
          rank: row.rank ?? 0,
          displayTotalPoints: row.displayTotalPoints ?? 0,
          name: user.name ?? 'Anonymous User',
          image: imageUrl,
        };
      })
    );

    return {
      ...result,
      page: hydratedPage.filter((e): e is NonNullable<typeof e> => e !== null && e.rank > 0),
    };
  },
});
