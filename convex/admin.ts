import { getAuthUserId } from '@convex-dev/auth/server';
import { paginationOptsValidator } from 'convex/server';
import { ConvexError, v } from 'convex/values';

import { internal } from './_generated/api';
import { mutation, query, internalMutation } from './_generated/server';
import {
  CHALLENGE_TAGS,
  CHALLENGE_POINTS_MIN,
  CHALLENGE_POINTS_MAX,
  CHALLENGE_DURATION_MIN,
  CHALLENGE_DURATION_MAX,
} from './challenges';

export const users = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError('Unauthorized');
    }

    const user = await ctx.db.get(userId);
    if (!user?.isAdmin) {
      throw new ConvexError('Unauthorized');
    }

    const users = await ctx.db
      .query('users')
      .filter((q) => q.eq(q.field('onboarded'), true))
      .order('desc')
      .paginate(args.paginationOpts);

    const results = [];

    for (const entry of users.page) {
      if (entry) {
        const imageUrl = entry.image ? await ctx.storage.getUrl(entry.image) : null;

        results.push({
          ...entry,
          image: imageUrl,
        });
      }
    }

    return {
      ...users,
      page: results,
    };
  },
});

export const getRewardsBanner = query({
  args: {},
  handler: async (ctx) => {
    const rewardsBanner = await ctx.db.query('rewardsBannerImage').first();
    if (!rewardsBanner) {
      return null;
    }

    const imageUrl = rewardsBanner.image ? await ctx.storage.getUrl(rewardsBanner.image) : null;

    return {
      ...rewardsBanner,
      imageUrl,
    };
  },
});

export const updateRewardsBanner = mutation({
  args: {
    image: v.optional(v.id('_storage')),
    title: v.optional(v.string()),
    targetPoints: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError('Unauthorized');
    }

    const user = await ctx.db.get(userId);
    if (!user?.isAdmin) {
      throw new ConvexError('Unauthorized');
    }

    const existingRewardsBanner = await ctx.db.query('rewardsBannerImage').first();
    if (existingRewardsBanner) {
      const updates: Record<string, any> = {};
      if (args.image) updates.image = args.image;
      if (args.title !== undefined) updates.title = args.title;
      if (args.targetPoints !== undefined) updates.targetPoints = args.targetPoints;
      await ctx.db.patch(existingRewardsBanner._id, updates);
    } else {
      if (!args.image) {
        throw new ConvexError('Image is required for initial banner creation');
      }
      await ctx.db.insert('rewardsBannerImage', {
        image: args.image,
        title: args.title,
        targetPoints: args.targetPoints,
      });
    }

    return {
      success: true,
    };
  },
});

export const getCreators = query({
  args: {},
  handler: async (ctx) => {
    const creators = await ctx.db
      .query('creators')
      .withIndex('by_sort_order')
      .order('asc')
      .collect();

    const results = [];

    for (const creator of creators) {
      const posterImageUrl = creator.posterImage
        ? await ctx.storage.getUrl(creator.posterImage)
        : null;
      results.push({
        ...creator,
        posterImageUrl,
      });
    }

    return results;
  },
});

export const getCreator = query({
  args: {
    creatorId: v.id('creators'),
  },
  handler: async (ctx, args) => {
    const creator = await ctx.db.get(args.creatorId);
    if (!creator) {
      throw new ConvexError('Creator not found');
    }

    const posterImageUrl = creator.posterImage
      ? await ctx.storage.getUrl(creator.posterImage)
      : null;

    return {
      ...creator,
      posterImageUrl,
    };
  },
});

export const addCreator = mutation({
  args: {
    name: v.string(),
    posterImage: v.id('_storage'),
    description: v.string(),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError('Unauthorized');
    }

    const user = await ctx.db.get(userId);
    if (!user?.isAdmin) {
      throw new ConvexError('Unauthorized');
    }

    await ctx.db.insert('creators', {
      name: args.name,
      posterImage: args.posterImage,
      description: args.description,
      isActive: args.isActive ?? true,
      userId,
    });

    return {
      success: true,
    };
  },
});

export const updateCreator = mutation({
  args: {
    creatorId: v.id('creators'),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    posterImage: v.optional(v.id('_storage')),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError('Unauthorized');
    }

    const user = await ctx.db.get(userId);
    if (!user?.isAdmin) {
      throw new ConvexError('Unauthorized');
    }

    const creator = await ctx.db.get(args.creatorId);
    if (!creator) {
      throw new ConvexError('Creator not found');
    }

    await ctx.db.patch(args.creatorId, {
      name: args.name ?? creator.name,
      description: args.description ?? creator.description,
      isActive: args.isActive ?? creator.isActive ?? true,
      posterImage: args.posterImage ?? creator.posterImage,
    });

    return {
      success: true,
    };
  },
});

export const deleteCreator = mutation({
  args: {
    creatorId: v.id('creators'),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError('Unauthorized');
    }

    const user = await ctx.db.get(userId);
    if (!user?.isAdmin) {
      throw new ConvexError('Unauthorized');
    }

    await ctx.db.delete(args.creatorId);

    return {
      success: true,
    };
  },
});

export const addCreatorVideo = mutation({
  args: {
    creatorId: v.id('creators'),
    title: v.string(),
    subtitle: v.string(),
    youtubeUrl: v.string(),
    order: v.number(),
    isActive: v.optional(v.boolean()),
    description: v.optional(v.string()),
    difficulty: v.optional(v.union(v.literal('easy'), v.literal('medium'), v.literal('hard'))),
    equipment: v.optional(v.string()),
    category: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError('Unauthorized');
    }

    const user = await ctx.db.get(userId);
    if (!user?.isAdmin) {
      throw new ConvexError('Unauthorized');
    }

    await ctx.db.insert('creatorVideos', {
      creatorId: args.creatorId,
      title: args.title,
      subtitle: args.subtitle,
      youtubeUrl: args.youtubeUrl,
      order: args.order,
      isActive: args.isActive ?? true,
      description: args.description,
      difficulty: args.difficulty,
      equipment: args.equipment,
      category: args.category,
    });

    return {
      success: true,
    };
  },
});

export const updateCreatorVideo = mutation({
  args: {
    creatorVideoId: v.id('creatorVideos'),
    title: v.optional(v.string()),
    subtitle: v.optional(v.string()),
    youtubeUrl: v.optional(v.string()),
    order: v.optional(v.number()),
    isActive: v.optional(v.boolean()),
    description: v.optional(v.string()),
    difficulty: v.optional(v.union(v.literal('easy'), v.literal('medium'), v.literal('hard'))),
    equipment: v.optional(v.string()),
    category: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError('Unauthorized');
    }

    const user = await ctx.db.get(userId);
    if (!user?.isAdmin) {
      throw new ConvexError('Unauthorized');
    }

    const creatorVideo = await ctx.db.get(args.creatorVideoId);
    if (!creatorVideo) {
      throw new ConvexError('Creator video not found');
    }

    await ctx.db.patch(args.creatorVideoId, {
      title: args.title ?? creatorVideo.title,
      subtitle: args.subtitle ?? creatorVideo.subtitle,
      youtubeUrl: args.youtubeUrl ?? creatorVideo.youtubeUrl,
      order: args.order ?? creatorVideo.order,
      isActive: args.isActive ?? creatorVideo.isActive,
      description: args.description ?? creatorVideo.description,
      difficulty: args.difficulty ?? creatorVideo.difficulty,
      equipment: args.equipment ?? creatorVideo.equipment,
      category: args.category ?? creatorVideo.category,
    });

    return {
      success: true,
    };
  },
});

export const deleteCreatorVideo = mutation({
  args: {
    creatorVideoId: v.id('creatorVideos'),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError('Unauthorized');
    }

    const user = await ctx.db.get(userId);
    if (!user?.isAdmin) {
      throw new ConvexError('Unauthorized');
    }

    await ctx.db.delete(args.creatorVideoId);

    return {
      success: true,
    };
  },
});

export const getCreatorVideos = query({
  args: {
    creatorId: v.id('creators'),
  },
  handler: async (ctx, args) => {
    const creatorVideos = await ctx.db
      .query('creatorVideos')
      .filter((q) => q.eq(q.field('creatorId'), args.creatorId))
      .collect();

    return creatorVideos;
  },
});

export const getCreatorVideo = query({
  args: {
    creatorVideoId: v.id('creatorVideos'),
  },
  handler: async (ctx, args) => {
    const creatorVideo = await ctx.db.get(args.creatorVideoId);
    if (!creatorVideo) {
      throw new ConvexError('Creator video not found');
    }

    return creatorVideo;
  },
});

export const sendMarketingPushNotificationToAllUsers = internalMutation({
  args: {
    title: v.string(),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const users = await ctx.db
      .query('users')
      .filter((q) => q.eq(q.field('notificationEnabled'), true))
      .collect();

    for (const user of users) {
      ctx.scheduler.runAfter(0, internal.pushNotification.sendMarketingPushNotification, {
        userId: user._id,
        title: args.title,
        body: args.body,
      });
    }
  },
});

export const reviewActivity = mutation({
  args: {
    activityId: v.id('dailyActivities'),
    reviewStatus: v.union(v.literal('approved'), v.literal('rejected')),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError('Unauthorized');
    }

    const user = await ctx.db.get(userId);
    if (!user?.isAdmin) {
      throw new ConvexError('Unauthorized');
    }

    const activity = await ctx.db.get(args.activityId);
    if (!activity) {
      throw new ConvexError('Activity not found');
    }

    const activityUser = await ctx.db.get(activity.userId);
    if (!activityUser) {
      throw new ConvexError('User not found');
    }

    await ctx.db.patch(args.activityId, {
      reviewedBy: userId,
      reviewedAt: Date.now(),
      reviewStatus: args.reviewStatus,
    });

    if (args.reviewStatus === 'approved') {
      // Update the monthly leaderboard
      const yearMonth = activity.date.substring(0, 7); // YYYY-MM
      await ctx.scheduler.runAfter(0, internal.leaderboard.updateMonthlyLeaderboard, {
        userId: activity.userId,
        yearMonth,
      });

      if (activityUser.notificationEnabled) {
        ctx.scheduler.runAfter(0, internal.pushNotification.sendPushNotification, {
          userId: [activityUser._id],
          notificationType: 'newActivityApproved',
          options: {
            userName: activityUser.name,
            date: activity.date,
          },
        });
      }
    } else {
      if (activityUser.notificationEnabled) {
        ctx.scheduler.runAfter(0, internal.pushNotification.sendPushNotification, {
          userId: [activityUser._id],
          notificationType: 'newActivityRejected',
          options: {
            userName: activityUser.name,
            date: activity.date,
          },
        });
      }
    }

    return {
      success: true,
    };
  },
});

export const pendingApprovals = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError('Unauthorized');
    }

    const user = await ctx.db.get(userId);
    if (!user?.isAdmin) {
      throw new ConvexError('Unauthorized');
    }

    const activities = await ctx.db
      .query('dailyActivities')
      .withIndex('by_review_status_synced', (q) =>
        q.eq('reviewStatus', undefined).eq('synced', false)
      )
      .order('desc')
      .paginate(args.paginationOpts);

    const results = [];

    for (const entry of activities.page) {
      const user = await ctx.db.get(entry.userId);
      if (user) {
        const userImageUrl = user.image ? await ctx.storage.getUrl(user.image) : null;
        const activityImageUrl = entry.image ? await ctx.storage.getUrl(entry.image) : null;

        results.push({
          ...entry,
          user: {
            ...user,
            image: userImageUrl,
          },
          imageUrl: activityImageUrl,
        });
      }
    }

    return {
      ...activities,
      page: results,
    };
  },
});

export const createChallenge = mutation({
  args: {
    name: v.string(),
    description: v.string(),
    createdBy: v.string(),
    coverImage: v.id('_storage'),
    instructionalVideo: v.id('_storage'),
    videoDuration: v.optional(v.number()),
    youtubeUrl: v.optional(v.string()),
    points: v.number(),
    durationLimit: v.number(),
    tag: v.string(),
    isLocked: v.boolean(),
    endDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError('Unauthorized');
    }

    const user = await ctx.db.get(userId);
    if (!user?.isAdmin) {
      throw new ConvexError('Unauthorized');
    }

    if (!args.name.trim()) {
      throw new ConvexError('Name is required');
    }
    if (!args.description.trim()) {
      throw new ConvexError('Description is required');
    }
    if (!args.createdBy.trim()) {
      throw new ConvexError('Created by is required');
    }
    if (args.points < CHALLENGE_POINTS_MIN || args.points > CHALLENGE_POINTS_MAX) {
      throw new ConvexError(
        `Points must be between ${CHALLENGE_POINTS_MIN} and ${CHALLENGE_POINTS_MAX}`
      );
    }
    if (
      args.durationLimit < CHALLENGE_DURATION_MIN ||
      args.durationLimit > CHALLENGE_DURATION_MAX
    ) {
      throw new ConvexError(
        `Duration must be between ${CHALLENGE_DURATION_MIN} and ${CHALLENGE_DURATION_MAX} seconds`
      );
    }
    if (!CHALLENGE_TAGS.includes(args.tag as any)) {
      throw new ConvexError('Invalid tag');
    }

    const challengeId = await ctx.db.insert('challenges', {
      name: args.name.trim(),
      description: args.description.trim(),
      createdBy: args.createdBy.trim(),
      coverImage: args.coverImage,
      instructionalVideo: args.instructionalVideo,
      videoDuration: args.videoDuration,
      youtubeUrl: args.youtubeUrl?.trim() || undefined,
      points: args.points,
      durationLimit: args.durationLimit,
      tag: args.tag,
      isLocked: args.isLocked,
      endDate: args.endDate || undefined,
      isPublished: true,
      createdByUserId: userId,
    });

    return { success: true, challengeId };
  },
});

export const updateChallenge = mutation({
  args: {
    challengeId: v.id('challenges'),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    createdBy: v.optional(v.string()),
    coverImage: v.optional(v.id('_storage')),
    oldCoverImage: v.optional(v.id('_storage')),
    instructionalVideo: v.optional(v.id('_storage')),
    oldInstructionalVideo: v.optional(v.id('_storage')),
    videoDuration: v.optional(v.number()),
    youtubeUrl: v.optional(v.string()),
    points: v.optional(v.number()),
    durationLimit: v.optional(v.number()),
    tag: v.optional(v.string()),
    isLocked: v.optional(v.boolean()),
    endDate: v.optional(v.string()),
    removeEndDate: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError('Unauthorized');
    }

    const user = await ctx.db.get(userId);
    if (!user?.isAdmin) {
      throw new ConvexError('Unauthorized');
    }

    const challenge = await ctx.db.get(args.challengeId);
    if (!challenge) {
      throw new ConvexError('Challenge not found');
    }

    if (
      args.points !== undefined &&
      (args.points < CHALLENGE_POINTS_MIN || args.points > CHALLENGE_POINTS_MAX)
    ) {
      throw new ConvexError(
        `Points must be between ${CHALLENGE_POINTS_MIN} and ${CHALLENGE_POINTS_MAX}`
      );
    }
    if (
      args.durationLimit !== undefined &&
      (args.durationLimit < CHALLENGE_DURATION_MIN || args.durationLimit > CHALLENGE_DURATION_MAX)
    ) {
      throw new ConvexError(
        `Duration must be between ${CHALLENGE_DURATION_MIN} and ${CHALLENGE_DURATION_MAX} seconds`
      );
    }
    if (args.tag !== undefined && !CHALLENGE_TAGS.includes(args.tag as any)) {
      throw new ConvexError('Invalid tag');
    }

    // Clean up old media if replaced
    if (args.coverImage && args.oldCoverImage) {
      await ctx.storage.delete(args.oldCoverImage);
    }
    if (args.instructionalVideo && args.oldInstructionalVideo) {
      await ctx.storage.delete(args.oldInstructionalVideo);
    }

    await ctx.db.patch(args.challengeId, {
      name: args.name?.trim() ?? challenge.name,
      description: args.description?.trim() ?? challenge.description,
      createdBy: args.createdBy?.trim() ?? challenge.createdBy,
      coverImage: args.coverImage ?? challenge.coverImage,
      instructionalVideo: args.instructionalVideo ?? challenge.instructionalVideo,
      videoDuration: args.videoDuration ?? challenge.videoDuration,
      youtubeUrl: args.youtubeUrl?.trim() ?? challenge.youtubeUrl,
      points: args.points ?? challenge.points,
      durationLimit: args.durationLimit ?? challenge.durationLimit,
      tag: args.tag ?? challenge.tag,
      isLocked: args.isLocked ?? challenge.isLocked,
      endDate: args.removeEndDate ? undefined : (args.endDate ?? challenge.endDate),
    });

    return { success: true, challengeId: args.challengeId };
  },
});

export const publishChallenge = mutation({
  args: {
    challengeId: v.id('challenges'),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError('Unauthorized');
    }

    const user = await ctx.db.get(userId);
    if (!user?.isAdmin) {
      throw new ConvexError('Unauthorized');
    }

    const challenge = await ctx.db.get(args.challengeId);
    if (!challenge) {
      throw new ConvexError('Challenge not found');
    }

    await ctx.db.patch(args.challengeId, { isPublished: true });

    return { success: true };
  },
});

export const unpublishChallenge = mutation({
  args: {
    challengeId: v.id('challenges'),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError('Unauthorized');
    }

    const user = await ctx.db.get(userId);
    if (!user?.isAdmin) {
      throw new ConvexError('Unauthorized');
    }

    const challenge = await ctx.db.get(args.challengeId);
    if (!challenge) {
      throw new ConvexError('Challenge not found');
    }

    await ctx.db.patch(args.challengeId, { isPublished: false });

    return { success: true };
  },
});

export const deleteChallenge = mutation({
  args: {
    challengeId: v.id('challenges'),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError('Unauthorized');
    }

    const user = await ctx.db.get(userId);
    if (!user?.isAdmin) {
      throw new ConvexError('Unauthorized');
    }

    const challenge = await ctx.db.get(args.challengeId);
    if (!challenge) {
      throw new ConvexError('Challenge not found');
    }

    // Clean up storage files
    await ctx.storage.delete(challenge.coverImage);
    await ctx.storage.delete(challenge.instructionalVideo);

    await ctx.db.delete(args.challengeId);

    return { success: true };
  },
});

export const listChallenges = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError('Unauthorized');
    }

    const user = await ctx.db.get(userId);
    if (!user?.isAdmin) {
      throw new ConvexError('Unauthorized');
    }

    const challenges = await ctx.db.query('challenges').order('desc').paginate(args.paginationOpts);

    const results = [];

    for (const challenge of challenges.page) {
      const coverImageUrl = await ctx.storage.getUrl(challenge.coverImage);
      results.push({
        ...challenge,
        coverImageUrl,
      });
    }

    return {
      ...challenges,
      page: results,
    };
  },
});

export const getChallenge = query({
  args: {
    challengeId: v.id('challenges'),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError('Unauthorized');
    }

    const user = await ctx.db.get(userId);
    if (!user?.isAdmin) {
      throw new ConvexError('Unauthorized');
    }

    const challenge = await ctx.db.get(args.challengeId);
    if (!challenge) {
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

export const setAppConfig = mutation({
  args: {
    key: v.string(),
    value: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError('Unauthorized');
    }

    const user = await ctx.db.get(userId);
    if (!user?.isAdmin) {
      throw new ConvexError('Unauthorized');
    }

    const existing = await ctx.db
      .query('appConfig')
      .withIndex('by_key', (q) => q.eq('key', args.key))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { value: args.value });
    } else {
      await ctx.db.insert('appConfig', { key: args.key, value: args.value });
    }

    return { success: true };
  },
});

export const getAppConfig = query({
  args: {
    key: v.string(),
  },
  handler: async (ctx, args) => {
    const config = await ctx.db
      .query('appConfig')
      .withIndex('by_key', (q) => q.eq('key', args.key))
      .unique();

    return config?.value ?? null;
  },
});

export const deleteUser = internalMutation({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    // Find user by email
    const user = await ctx.db
      .query('users')
      .withIndex('email', (q) => q.eq('email', args.email))
      .first();

    if (!user) {
      throw new ConvexError('User not found');
    }

    const userId = user._id;

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

    return {
      success: true,
      deletedUserId: userId,
      deletedEmail: args.email,
    };
  },
});

export const setTodayDailyChallenge = mutation({
  args: {
    challengeId: v.id('challenges'),
    shortDescription: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    if (!userId) {
      throw new ConvexError('Unauthorized');
    }

    const user = await ctx.db.get(userId);

    if (!user?.isAdmin) {
      throw new ConvexError('Unauthorized');
    }

    const challenge = await ctx.db.get(args.challengeId);

    if (!challenge) {
      throw new ConvexError('Challenge not found');
    }

    if (!challenge.isPublished) {
      throw new ConvexError('Only published challenges can be set as daily challenge');
    }

    if (!args.shortDescription.trim()) {
      throw new ConvexError('Short description is required');
    }

    const now = Date.now();
    const endAt = now + 24 * 60 * 60 * 1000;

    // Turn off every old daily challenge first
    const existingDailyChallenges = await ctx.db
      .query('challenges')
      .withIndex('by_daily_challenge', (q) => q.eq('isDailyChallenge', true))
      .collect();

    for (const item of existingDailyChallenges) {
      await ctx.db.patch(item._id, {
        isDailyChallenge: false,
        dailyStartAt: undefined,
        dailyEndAt: undefined,
        shortDescription: undefined,
      });
    }

    // Turn on only this selected challenge
    await ctx.db.patch(args.challengeId, {
      isDailyChallenge: true,
      dailyStartAt: now,
      dailyEndAt: endAt,
      shortDescription: args.shortDescription.trim(),
    });

    return {
      success: true,
      challengeId: args.challengeId,
      startsAt: now,
      endsAt: endAt,
    };
  },
});


export const closeTodayDailyChallenge = mutation({
  args: {
    challengeId: v.id('challenges'),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    if (!userId) {
      throw new ConvexError('Unauthorized');
    }

    const user = await ctx.db.get(userId);

    if (!user?.isAdmin) {
      throw new ConvexError('Unauthorized');
    }

    const challenge = await ctx.db.get(args.challengeId);

    if (!challenge) {
      throw new ConvexError('Challenge not found');
    }

    await ctx.db.patch(args.challengeId, {
      isDailyChallenge: false,
      dailyStartAt: undefined,
      dailyEndAt: undefined,
      shortDescription: undefined,
    });

    return {
      success: true,
      challengeId: args.challengeId,
    };
  },
});
