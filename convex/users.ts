import { getAuthUserId } from '@convex-dev/auth/server';
import { PushNotifications } from '@convex-dev/expo-push-notifications';
import { ConvexError, v } from 'convex/values';

import { components, internal } from './_generated/api';
import { applyFreeDailyCap } from './challengeCompletions';
import { Id } from './_generated/dataModel';
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from './_generated/server';
import { MailerLiteGroup } from './mailerlite';
import { EnduranceZoneUserUpsertResponse } from './services/enduranceZone';

export const current = query({
  args: {},
  handler: async (ctx) => {
    await ctx.auth.getUserIdentity();

    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const user = await ctx.db.get(userId);
    if (!user) return null;

    const imageUrl = user.image ? await ctx.storage.getUrl(user.image) : null;

    return {
      ...user,
      image: imageUrl,
    };
  },
});

export const currentUserDetails = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const user = await ctx.db.get(userId);
    if (!user) return null;

    const imageUrl = user.image ? await ctx.storage.getUrl(user.image) : null;

    return {
      ...user,
      image: imageUrl,
    };
  },
});

export const canClaimReward = internalQuery({
  args: {
    yearMonth: v.string(),
    userId: v.id('users'),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const claimedReward = await ctx.db
      .query('claimedRewards')
      .withIndex('by_user_and_year_month', (q) =>
        q.eq('userId', args.userId).eq('yearMonth', args.yearMonth)
      )
      .unique();

    const monthlyLeaderboard = await ctx.db
      .query('monthlyLeaderboard')
      .withIndex('by_user_and_year_month', (q) =>
        q.eq('userId', args.userId).eq('yearMonth', args.yearMonth)
      )
      .unique();

    return !claimedReward && (monthlyLeaderboard?.displayTotalPoints ?? 0) >= 100;
  },
});

export const getUser = query({
  args: {
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return null;

    const imageUrl = user.image ? await ctx.storage.getUrl(user.image) : null;

    return {
      ...user,
      image: imageUrl,
    };
  },
});

export const getUserInternal = internalQuery({
  args: {
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return null;

    const imageUrl = user.image ? await ctx.storage.getUrl(user.image) : null;

    return {
      ...user,
      image: imageUrl,
    };
  },
});

export const userAutoSyncEnabled = query({
  args: {},
  returns: v.boolean(),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return false;

    const user = await ctx.db.get(userId);
    if (!user) return false;

    return user.autoSyncEnabled ?? false;
  },
});

export const updateUserAutoSyncEnabled = mutation({
  args: {
    enabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError('User not found');
    }

    await ctx.db.patch(userId, {
      autoSyncEnabled: args.enabled,
    });

    return { success: true };
  },
});

export const updateUserIsPremium = mutation({
  args: {
    isPremium: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return;

    const user = await ctx.db.get(userId);
    if (!user) return;

    await ctx.db.patch(userId, {
      isPremium: args.isPremium,
    });

    if (!args.isPremium) {
      await ctx.scheduler.runAfter(0, internal.users.syncToEnduranceZoneForUser, {
        userId,
        level: 'Basic',
      });
    }

    return { success: true };
  },
});

export const userNotificationEnabled = query({
  args: {},
  returns: v.boolean(),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return false;

    const user = await ctx.db.get(userId);
    if (!user) return false;

    return user.notificationEnabled ?? user.expoPushToken !== null;
  },
});

export const userCommentNotificationEnabled = query({
  args: {},
  returns: v.boolean(),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return false;

    const user = await ctx.db.get(userId);
    if (!user) return false;

    return user.commentNotificationEnabled ?? true;
  },
});

export const updateUserCommentNotificationEnabled = mutation({
  args: {
    enabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return;

    const user = await ctx.db.get(userId);
    if (!user) return;

    await ctx.db.patch(userId, {
      commentNotificationEnabled: args.enabled,
    });

    return { success: true };
  },
});

export const updateUserNotificationEnabled = mutation({
  args: {
    enabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError('User not found');
    }

    await ctx.db.patch(userId, {
      notificationEnabled: args.enabled,
    });

    return { success: true };
  },
});

export const updateLastActiveAt = mutation({
  args: {
    date: v.string(),
    timezone: v.optional(v.string()),
    platform: v.optional(v.string()),
    appVersion: v.optional(v.string()),
    countryCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return;

    const user = await ctx.db.get(userId);
    if (!user) return;

    await ctx.db.patch(userId, {
      lastActiveAt: Date.now(),
      timezone: args.timezone ?? user.timezone,
      platform: args.platform,
      appVersion: args.appVersion,
      countryCode: args.countryCode ?? user.countryCode,
    });

    const userCheckIn = await ctx.db
      .query('userCheckIns')
      .withIndex('by_user_date', (q) => q.eq('userId', userId).eq('date', args.date))
      .unique();

    const DAILY_CHECK_IN_POINTS = 5;

    if (!userCheckIn) {
      const cappedPoints = await applyFreeDailyCap(
        ctx,
        userId,
        args.date,
        DAILY_CHECK_IN_POINTS,
        'checkin'
      );
      await ctx.db.insert('userCheckIns', {
        userId,
        date: args.date,
        points: cappedPoints,
      });

      const yearMonth = args.date.split('-')[0] + '-' + args.date.split('-')[1];
      ctx.runMutation(internal.leaderboard.updateMonthlyLeaderboard, {
        userId,
        yearMonth,
      });

      // Recompute track rollups after check-in
      await ctx.runMutation(internal.track.recompute.recomputeTrackForDate, {
        userId,
        date: args.date,
      });
    }

    return { success: true };
  },
});

export const updateExpoPushToken = mutation({
  args: {
    expoPushToken: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return;

    const pushNotifications = new PushNotifications(components.pushNotifications);

    await ctx.db.patch(userId, {
      expoPushToken: args.expoPushToken,
      notificationEnabled: true,
    });

    await pushNotifications.recordToken(ctx, {
      userId,
      pushToken: args.expoPushToken,
    });

    return { success: true };
  },
});

export const updateOnboarded = mutation({
  args: {
    onboarded: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError('User not found');
    }

    const user = await ctx.db.get(userId);
    if (!user) {
      throw new ConvexError('User not found');
    }

    if (!user.onboarded && args.onboarded) {
      ctx.scheduler.runAfter(
        24 * 60 * 60 * 1000,
        internal.notifications.sendNoActivityReminderNotification,
        {
          userId,
        }
      );
    }

    await ctx.db.patch(userId, {
      onboarded: args.onboarded,
    });

    if (args.onboarded) {
      ctx.scheduler.runAfter(0, internal.mailerlite.addUserToGroup, {
        userId,
        email: user.email!,
        name: user.name!,
        groupId: MailerLiteGroup.WELCOME,
      });
    }

    return { success: true };
  },
});

export const update = mutation({
  args: {
    name: v.optional(v.string()),
    birthdate: v.optional(v.number()),
    storageId: v.optional(v.id('_storage')),
    activityGoal: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError('Unauthorized');
    }

    const dataToUpdate: {
      name?: string;
      image?: Id<'_storage'>;
      birthdate?: number;
      activityGoal?: string;
    } = {};

    if (args.storageId) {
      dataToUpdate.image = args.storageId;
    }

    if (args.name) {
      dataToUpdate.name = args.name;
    }

    if (args.birthdate) {
      dataToUpdate.birthdate = args.birthdate;
    }

    if (args.activityGoal) {
      dataToUpdate.activityGoal = args.activityGoal;
    }

    await ctx.db.patch(userId, dataToUpdate);

    return userId;
  },
});

// Internal mutation to save Endurance Zone data to user
export const saveEnduranceZoneData = internalMutation({
  args: {
    userId: v.id('users'),
    loginUrl: v.string(),
    identifier: v.string(),
    level: v.union(
      v.literal('Basic'),
      v.literal('Basic Plus'),
      v.literal('Premium'),
      v.literal('Premium Plus')
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      enduranceZoneLoginUrl: args.loginUrl,
      enduranceZoneIdentifier: args.identifier,
      enduranceZoneLevel: args.level,
    });
  },
});

// Action to sync user to Endurance Zone
export const syncToEnduranceZone = action({
  args: {
    level: v.optional(
      v.union(
        v.literal('Basic'),
        v.literal('Basic Plus'),
        v.literal('Premium'),
        v.literal('Premium Plus')
      )
    ),
    country: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return;

    const user = await ctx.runQuery(internal.users.getUserInternal, { userId });
    if (!user) return;

    if (!user.email || !user.name) return;

    let level = args.level ?? (user.isPremium ? 'Basic Plus' : 'Basic');
    const country = args.country ?? user.countryCode ?? 'UK';

    if (user.enduranceZoneLevel === 'Premium Plus') {
      level = 'Premium Plus';
    } else if (user.enduranceZoneLevel === 'Premium') {
      level = 'Premium';
    }

    // Call the internal action to upsert user to Endurance Zone
    const result: EnduranceZoneUserUpsertResponse = await ctx.runAction(
      internal.services.enduranceZone.upsertUser,
      {
        emailAddress: user.email,
        partnerMemberId: userId,
        firstName: user.name.split(' ')[0] || user.name,
        lastName: user.name.split(' ').slice(1).join(' ') || user.name,
        level,
        country,
      }
    );

    // Save the loginUrl and identifier to the user record
    await ctx.runMutation(internal.users.saveEnduranceZoneData, {
      userId,
      loginUrl: result.LoginUrl,
      identifier: result.Identifier.toString(),
      level,
    });

    return {
      success: true,
      loginUrl: result.LoginUrl,
      identifier: result.Identifier,
      action: result.Action,
    };
  },
});

// Action to sync user to Endurance Zone
export const syncToEnduranceZoneForUser = internalAction({
  args: {
    userId: v.id('users'),
    level: v.optional(
      v.union(
        v.literal('Basic'),
        v.literal('Basic Plus'),
        v.literal('Premium'),
        v.literal('Premium Plus')
      )
    ),
    country: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = args.userId;
    const user = await ctx.runQuery(internal.users.getUserInternal, { userId });
    if (!user) return;

    if (!user.email || !user.name) return;

    const level = args.level ?? (user.isPremium ? 'Basic Plus' : 'Basic');
    const country = args.country ?? user.countryCode ?? 'UK';

    // Call the internal action to upsert user to Endurance Zone
    const result: EnduranceZoneUserUpsertResponse = await ctx.runAction(
      internal.services.enduranceZone.upsertUser,
      {
        emailAddress: user.email,
        partnerMemberId: userId,
        firstName: user.name.split(' ')[0] || user.name,
        lastName: user.name.split(' ').slice(1).join(' ') || user.name,
        level,
        country,
      }
    );

    // Save the loginUrl and identifier to the user record
    await ctx.runMutation(internal.users.saveEnduranceZoneData, {
      userId,
      loginUrl: result.LoginUrl,
      identifier: result.Identifier.toString(),
      level,
    });

    return {
      success: true,
      loginUrl: result.LoginUrl,
      identifier: result.Identifier,
      action: result.Action,
    };
  },
});

export const deleteAccount = mutation({
  args: {},
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return;

    // Find user by email
    const user = await ctx.db.get(userId);
    if (!user) return;

    // Delete user's profile image from storage if exists
    if (user.image) {
      await ctx.storage.delete(user.image);
    }

    // Delete all daily activities and their images
    const dailyActivities = await ctx.db
      .query('dailyActivities')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect();

    for (const activity of dailyActivities) {
      if (activity.image) {
        await ctx.storage.delete(activity.image);
      }
      await ctx.db.delete(activity._id);
    }

    // Delete monthly leaderboard entries
    const leaderboardEntries = await ctx.db
      .query('monthlyLeaderboard')
      .withIndex('by_user_and_year_month', (q) => q.eq('userId', userId))
      .collect();

    for (const entry of leaderboardEntries) {
      await ctx.db.delete(entry._id);
    }

    // Delete user check-ins
    const checkIns = await ctx.db
      .query('userCheckIns')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect();

    for (const checkIn of checkIns) {
      await ctx.db.delete(checkIn._id);
    }

    // Delete notification history
    const notifications = await ctx.db
      .query('notificationHistory')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect();

    for (const notification of notifications) {
      await ctx.db.delete(notification._id);
    }

    // Delete claimed rewards
    const claimedRewards = await ctx.db
      .query('claimedRewards')
      .withIndex('by_user_and_year_month', (q) => q.eq('userId', userId))
      .collect();

    for (const reward of claimedRewards) {
      await ctx.db.delete(reward._id);
    }

    // Delete all posts and their associated data (likes and comments)
    const posts = await ctx.db
      .query('posts')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect();

    for (const post of posts) {
      // Delete all likes for this post
      const postLikes = await ctx.db
        .query('postLikes')
        .withIndex('by_post', (q) => q.eq('postId', post._id))
        .collect();

      for (const like of postLikes) {
        await ctx.db.delete(like._id);
      }

      // Delete all comments for this post
      const postComments = await ctx.db
        .query('postComments')
        .withIndex('by_post', (q) => q.eq('postId', post._id))
        .collect();

      for (const comment of postComments) {
        await ctx.db.delete(comment._id);
      }

      // Delete post media if exists
      if (post.media) {
        await ctx.storage.delete(post.media);
      }

      // Delete the post
      await ctx.db.delete(post._id);
    }

    // Delete all post reports made by this user
    const postReports = await ctx.db
      .query('postReports')
      .filter((q) => q.eq(q.field('userId'), userId))
      .collect();

    for (const report of postReports) {
      await ctx.db.delete(report._id);
    }

    // Delete all comment reports made by this user
    const commentReports = await ctx.db
      .query('commentReports')
      .filter((q) => q.eq(q.field('userId'), userId))
      .collect();

    for (const report of commentReports) {
      await ctx.db.delete(report._id);
    }

    // Delete all blocked users (both where user is blocker or blocked)
    const blockedUsers = await ctx.db
      .query('blockedUsers')
      .filter((q) => q.or(q.eq(q.field('userId'), userId), q.eq(q.field('blockedUserId'), userId)))
      .collect();

    for (const blockedUser of blockedUsers) {
      await ctx.db.delete(blockedUser._id);
    }

    // Delete any creators owned by this user
    const creators = await ctx.db
      .query('creators')
      .filter((q) => q.eq(q.field('userId'), userId))
      .collect();

    for (const creator of creators) {
      // Delete all videos for this creator
      const creatorVideos = await ctx.db
        .query('creatorVideos')
        .filter((q) => q.eq(q.field('creatorId'), creator._id))
        .collect();

      for (const video of creatorVideos) {
        await ctx.db.delete(video._id);
      }

      // Delete creator's poster image if exists
      if (creator.posterImage) {
        await ctx.storage.delete(creator.posterImage);
      }

      // Delete the creator
      await ctx.db.delete(creator._id);
    }

    // Delete auth sessions for this user
    const authSessions = await ctx.db
      .query('authSessions')
      .filter((q) => q.eq(q.field('userId'), userId))
      .collect();

    for (const session of authSessions) {
      await ctx.db.delete(session._id);
    }

    // Delete auth accounts for this user
    const authAccounts = await ctx.db
      .query('authAccounts')
      .filter((q) => q.eq(q.field('userId'), userId))
      .collect();

    for (const account of authAccounts) {
      await ctx.db.delete(account._id);
    }

    // Finally, delete the user
    await ctx.db.delete(userId);

    const now = new Date();
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    ctx.scheduler.runAfter(0, internal.leaderboard.recalculateRanksForMonth, {
      yearMonth,
    });

    return {
      success: true,
      deletedUserId: userId,
    };
  },
});
