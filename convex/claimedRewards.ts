import { getAuthUserId } from '@convex-dev/auth/server';
import { ConvexError, v } from 'convex/values';

import { internal } from './_generated/api';
import { internalAction, internalQuery, mutation, query } from './_generated/server';
import { MailerLiteGroup } from './mailerlite';

export const getUserClaimedReward = query({
  args: {
    yearMonth: v.string(), // YYYY-MM
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError('Unauthorized');
    }

    // Get the user's entry
    const userEntry = await ctx.db
      .query('claimedRewards')
      .withIndex('by_user_and_year_month', (q) =>
        q.eq('userId', userId).eq('yearMonth', args.yearMonth)
      )
      .unique();

    return userEntry;
  },
});

export const claimReward = mutation({
  args: {
    yearMonth: v.string(), // YYYY-MM
    points: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError('Unauthorized');
    }

    const user = await ctx.db.get(userId);
    if (!user) {
      throw new ConvexError('User not found');
    }

    const userEntry = await ctx.db
      .query('claimedRewards')
      .withIndex('by_user_and_year_month', (q) =>
        q.eq('userId', userId).eq('yearMonth', args.yearMonth)
      )
      .unique();

    if (userEntry) {
      throw new ConvexError('Reward already claimed');
    }

    const totalEntries = Math.floor(args.points / 100);

    await ctx.db.insert('claimedRewards', {
      userId,
      yearMonth: args.yearMonth,
      claimedPoints: args.points,
      totalEntries,
    });

    if (args.points >= 500) {
      ctx.scheduler.runAfter(0, internal.mailerlite.addUserToGroup, {
        userId: user._id,
        email: user.email!,
        name: user.name!,
        groupId: MailerLiteGroup.REACHED_500_POINTS,
      });
    } else if (args.points >= 250) {
      ctx.scheduler.runAfter(0, internal.mailerlite.addUserToGroup, {
        userId: user._id,
        email: user.email!,
        name: user.name!,
        groupId: MailerLiteGroup.REACHED_250_POINTS,
      });
    } else if (args.points >= 100) {
      ctx.scheduler.runAfter(0, internal.mailerlite.addUserToGroup, {
        userId: user._id,
        email: user.email!,
        name: user.name!,
        groupId: MailerLiteGroup.REACHED_100_POINTS,
      });
    }

    const admins = await ctx.db
      .query('users')
      .withIndex('isAdmin', (q) => q.eq('isAdmin', true))
      .collect();

    admins.forEach((admin) => {
      ctx.scheduler.runAfter(0, internal.pushNotification.sendPushNotification, {
        userId: [admin._id],
        notificationType: 'newRewardClaimed',
        options: {
          userName: user.name ?? 'User',
        },
      });
    });

    return { success: true };
  },
});

export const exportClaimedRewardsCsv = internalAction({
  args: {
    yearMonth: v.optional(v.string()), // YYYY-MM format
  },
  handler: async (ctx, args) => {
    // Get the yearMonth to use (default to previous month if not provided)
    let yearMonth: string = args.yearMonth || '';
    if (!yearMonth) {
      const now = new Date();
      const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const month = String(previousMonth.getMonth() + 1).padStart(2, '0');
      const year = previousMonth.getFullYear();
      yearMonth = `${year}-${month}`;
    }

    // Get all claimed rewards for the specified month using a query
    const rewardsWithEmails: any[] = await ctx.runQuery(
      internal.claimedRewards.getClaimedRewardsForExport,
      {
        yearMonth,
      }
    );

    if (rewardsWithEmails.length === 0) {
      throw new ConvexError(`No claimed rewards found for ${yearMonth}`);
    }

    // Prepare CSV header
    const csvHeader = 'User ID,Email,Claimed Points,Total Entries\n';

    // Escape values for CSV (handle commas and quotes)
    const escapeCSV = (value: string | number): string => {
      const str = String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    // Build CSV content
    const csvRows = rewardsWithEmails.map((reward: any) => {
      return [
        escapeCSV(reward.userId),
        escapeCSV(reward.email),
        escapeCSV(reward.claimedPoints),
        escapeCSV(reward.totalEntries),
      ].join(',');
    });

    const csvContent = csvHeader + csvRows.join('\n');

    // Create a blob from the CSV content
    const blob = new Blob([csvContent], { type: 'text/csv' });

    // Store the blob in Convex storage
    const storageId = await ctx.storage.store(blob);

    // Get the download URL
    const url = await ctx.storage.getUrl(storageId);

    if (!url) {
      throw new ConvexError('Failed to generate download URL');
    }

    return {
      url,
      filename: `claimed-rewards-${yearMonth}.csv`,
      recordCount: rewardsWithEmails.length,
      yearMonth,
    };
  },
});

// Internal query to get claimed rewards with user emails for export
export const getClaimedRewardsForExport = internalQuery({
  args: {
    yearMonth: v.string(), // YYYY-MM format
  },
  handler: async (ctx, args) => {
    const claimedRewards = await ctx.db
      .query('claimedRewards')
      .filter((q) => q.eq(q.field('yearMonth'), args.yearMonth))
      .collect();

    // Get user emails
    const rewardsWithEmails = await Promise.all(
      claimedRewards.map(async (reward) => {
        const user = await ctx.db.get(reward.userId);
        return {
          userId: reward.userId,
          email: user?.email || 'N/A',
          claimedPoints: reward.claimedPoints,
          totalEntries: reward.totalEntries,
        };
      })
    );

    return rewardsWithEmails;
  },
});

export const exportMonthlyLeaderboardCsv = internalAction({
  args: {
    yearMonth: v.optional(v.string()), // YYYY-MM format
    minPoints: v.optional(v.number()), // Minimum points threshold
  },
  handler: async (ctx, args) => {
    // Get the yearMonth to use (default to previous month if not provided)
    let yearMonth: string = args.yearMonth || '';
    if (!yearMonth) {
      const now = new Date();
      const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const month = String(previousMonth.getMonth() + 1).padStart(2, '0');
      const year = previousMonth.getFullYear();
      yearMonth = `${year}-${month}`;
    }

    // Get minimum points threshold (default to 100)
    const minPoints = args.minPoints ?? 100;

    // Get all leaderboard entries for the specified month using a query
    const leaderboardWithEmails: any[] = await ctx.runQuery(
      internal.claimedRewards.getMonthlyLeaderboardForExport,
      {
        yearMonth,
        minPoints,
      }
    );

    if (leaderboardWithEmails.length === 0) {
      throw new ConvexError(
        `No leaderboard entries found for ${yearMonth} with minimum ${minPoints} points`
      );
    }

    // Prepare CSV header
    const csvHeader = 'User Email,User ID,Total Points\n';

    // Escape values for CSV (handle commas and quotes)
    const escapeCSV = (value: string | number): string => {
      const str = String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    // Build CSV content
    const csvRows = leaderboardWithEmails.map((entry: any) => {
      return [
        escapeCSV(entry.email),
        escapeCSV(entry.userId),
        escapeCSV(entry.displayTotalPoints ?? entry.totalPoints),
      ].join(',');
    });

    const csvContent = csvHeader + csvRows.join('\n');

    // Create a blob from the CSV content
    const blob = new Blob([csvContent], { type: 'text/csv' });

    // Store the blob in Convex storage
    const storageId = await ctx.storage.store(blob);

    // Get the download URL
    const url = await ctx.storage.getUrl(storageId);

    if (!url) {
      throw new ConvexError('Failed to generate download URL');
    }

    return {
      url,
      filename: `monthly-leaderboard-${yearMonth}.csv`,
      recordCount: leaderboardWithEmails.length,
      yearMonth,
      minPoints,
    };
  },
});

// Internal query to get monthly leaderboard with user emails for export
export const getMonthlyLeaderboardForExport = internalQuery({
  args: {
    yearMonth: v.string(), // YYYY-MM format
    minPoints: v.number(), // Minimum points threshold
  },
  handler: async (ctx, args) => {
    // Get all leaderboard entries for the specified month
    const leaderboardEntries = await ctx.db
      .query('monthlyLeaderboard')
      .filter((q) => q.eq(q.field('yearMonth'), args.yearMonth))
      .collect();

    // Filter by minimum points (using displayTotalPoints if available, otherwise totalPoints)
    const filteredEntries = leaderboardEntries.filter((entry) => {
      const points = entry.displayTotalPoints ?? entry.totalPoints;
      return points >= args.minPoints;
    });

    // Get user emails for each entry
    const entriesWithEmails = await Promise.all(
      filteredEntries.map(async (entry) => {
        const user = await ctx.db.get(entry.userId);
        return {
          userId: entry.userId,
          email: user?.email || 'N/A',
          displayTotalPoints: entry.displayTotalPoints ?? entry.totalPoints,
          totalPoints: entry.totalPoints,
        };
      })
    );

    // Sort by points (descending)
    entriesWithEmails.sort((a, b) => b.displayTotalPoints - a.displayTotalPoints);

    return entriesWithEmails;
  },
});
