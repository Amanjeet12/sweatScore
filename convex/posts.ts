import { getAuthUserId } from '@convex-dev/auth/server';
import { ShardedCounter } from '@convex-dev/sharded-counter';
import { compare } from 'compare-versions';
import { paginationOptsValidator } from 'convex/server';
import { v } from 'convex/values';

import { components, internal } from './_generated/api';
import { internalMutation, mutation, query } from './_generated/server';
import { appVersions } from './appVersions';

const BADGE_POINTS_THRESHOLD = 500;

const postCounter = new ShardedCounter(components.shardedCounter);

// Helper function to format user name (First name + first initial of surname)
function formatUserName(fullName: string | null | undefined): string {
  if (!fullName) return '';

  const nameParts = fullName.trim().split(' ');
  if (nameParts.length === 0) return '';

  const firstName = nameParts[0];
  if (nameParts.length === 1) {
    return firstName;
  }

  const surname = nameParts[nameParts.length - 1];
  return `${firstName} ${surname.charAt(0)}.`;
}

// Internal mutation to send notifications for admin posts
export const notifyUsersOfAdminPost = internalMutation({
  args: {
    postId: v.id('posts'),
    adminUserId: v.id('users'),
  },
  handler: async (ctx, args) => {
    // Get all users
    const allUsers = await ctx.db.query('users').collect();

    // Filter users who are eligible to receive notifications
    const eligibleUsers = allUsers.filter((user) => {
      if (!user.isPremium) return false;

      // Don't send to the admin who created the post
      if (user._id === args.adminUserId) return false;

      // Check if community notifications are enabled (default is true)
      const notificationsEnabled = user.notificationEnabled ?? true;
      if (!notificationsEnabled) return false;

      // Check app version
      const userAppVersion = user.appVersion;
      if (!userAppVersion) return false;

      // Compare versions - user version must be >= minVersionForCommunity (1.0.3)
      const minVersion = appVersions.minVersionForCommunity;
      return compare(userAppVersion, minVersion, '>=');
    });

    // Send notification to each eligible user individually (don't await)
    for (const user of eligibleUsers) {
      ctx.scheduler.runAfter(0, internal.pushNotification.sendPushNotification, {
        userId: [user._id],
        notificationType: 'newAdminPost',
        options: {
          postId: args.postId,
        },
      });
    }
  },
});

export const getPinnedPost = query({
  args: {},
  returns: v.union(
    v.object({
      _id: v.id('posts'),
      userId: v.id('users'),
      createdAt: v.number(),
      body: v.string(),
      media: v.optional(v.union(v.id('_storage'), v.null())),
      mediaWidth: v.optional(v.union(v.number(), v.null())),
      mediaHeight: v.optional(v.union(v.number(), v.null())),
      mediaType: v.optional(v.string()),
      mediaThumbnailUrl: v.optional(v.string()),
      mediaUrl: v.optional(v.string()),
      challengeId: v.optional(v.id('challenges')),
      challenge: v.optional(
        v.object({
          name: v.string(),
          points: v.number(),
          instructionalVideoUrl: v.optional(v.string()),
          compositeVideoUrl: v.optional(v.string()),
          thumbnailUrl: v.optional(v.string()),
          allowRepost: v.optional(v.boolean()),
        })
      ),
      likeCount: v.number(),
      fireLikesCount: v.number(),
      clapLikesCount: v.number(),
      heartLikesCount: v.number(),
      isLiked: v.boolean(),
      isPinned: v.boolean(),
      commentCount: v.number(),
      user: v.object({
        name: v.string(),
        image: v.optional(v.id('_storage')),
        imageUrl: v.optional(v.string()),
        isAuthor: v.boolean(),
        isAdmin: v.boolean(),
        hasHit500: v.boolean(),
      }),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const pinnedPost = await ctx.db
      .query('posts')
      .withIndex('by_pinned', (q) => q.eq('isPinned', true))
      .order('desc')
      .first();
    if (!pinnedPost) return null;

    const user = await ctx.db.get(pinnedPost.userId);
    if (!user) return null;

    const isLiked = await ctx.db
      .query('postLikes')
      .withIndex('by_post_user', (q) => q.eq('postId', pinnedPost._id).eq('userId', userId))
      .unique();

    const mediaUrl = pinnedPost.media
      ? ((await ctx.storage.getUrl(pinnedPost.media)) ?? undefined)
      : undefined;

    const challenge = pinnedPost.challengeId
      ? await (async () => {
          const ch = await ctx.db.get(pinnedPost.challengeId!);
          if (!ch) return undefined;
          const instructionalVideoUrl = await ctx.storage.getUrl(ch.instructionalVideo);
          let compositeVideoUrl: string | undefined;
          let thumbnailUrl: string | undefined;
          let allowRepost = false;
          if (pinnedPost.challengeCompletionId) {
            const completion = await ctx.db.get(pinnedPost.challengeCompletionId);
            if (completion?.compositeVideoStorageId) {
              compositeVideoUrl =
                (await ctx.storage.getUrl(completion.compositeVideoStorageId)) ?? undefined;
            }
            if (completion?.thumbnailStorageId) {
              thumbnailUrl = (await ctx.storage.getUrl(completion.thumbnailStorageId)) ?? undefined;
            }
            allowRepost = completion?.allowRepost ?? false;
          }
          return {
            name: ch.name,
            points: ch.points,
            instructionalVideoUrl: instructionalVideoUrl ?? undefined,
            compositeVideoUrl,
            thumbnailUrl,
            allowRepost,
          };
        })()
      : undefined;

    return {
      _id: pinnedPost._id,
      userId: pinnedPost.userId,
      createdAt: pinnedPost.createdAt,
      body: pinnedPost.body,
      media: pinnedPost.media,
      mediaWidth: pinnedPost.mediaWidth,
      mediaHeight: pinnedPost.mediaHeight,
      mediaType: pinnedPost.mediaType,
      mediaThumbnailUrl: pinnedPost.mediaThumbnail
        ? ((await ctx.storage.getUrl(pinnedPost.mediaThumbnail)) ?? undefined)
        : undefined,
      mediaUrl,
      challengeId: pinnedPost.challengeId,
      challenge,
      isPinned: !!pinnedPost.isPinned,
      likeCount: await postCounter.count(ctx, `likes:${pinnedPost._id}`),
      fireLikesCount: await postCounter.count(ctx, `likes:${pinnedPost._id}:fire`),
      clapLikesCount: await postCounter.count(ctx, `likes:${pinnedPost._id}:clap`),
      heartLikesCount: await postCounter.count(ctx, `likes:${pinnedPost._id}:heart`),
      isLiked: !!isLiked,
      commentCount: await postCounter.count(ctx, `comments:${pinnedPost._id}`),
      user: {
        name: user.isAdmin ? 'SweatScore' : formatUserName(user.name),
        image: user.image,
        imageUrl: user.image ? ((await ctx.storage.getUrl(user.image)) ?? undefined) : undefined,
        isAuthor: user._id === userId,
        isAdmin: user.isAdmin ?? false,
        hasHit500: await (async () => {
          const ym = new Date().toISOString().slice(0, 7);
          const entry = await ctx.db
            .query('monthlyLeaderboard')
            .withIndex('by_user_and_year_month', (q) =>
              q.eq('userId', pinnedPost.userId).eq('yearMonth', ym)
            )
            .unique();
          return (entry?.displayTotalPoints ?? 0) >= BADGE_POINTS_THRESHOLD;
        })(),
      },
    };
  },
});

export const pinPost = mutation({
  args: {
    postId: v.id('posts'),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return true;

    const user = await ctx.db.get(userId);
    if (!user) return true;

    if (!user.isAdmin) return true;

    const post = await ctx.db.get(args.postId);
    if (!post) return true;

    if (post.userId !== userId) return true;

    // Unpin all existing pinned posts
    const pinnedPosts = await ctx.db
      .query('posts')
      .withIndex('by_pinned', (q) => q.eq('isPinned', true))
      .collect();

    for (const pinnedPost of pinnedPosts) {
      await ctx.db.patch(pinnedPost._id, {
        isPinned: false,
      });
    }

    // Pin the new post
    await ctx.db.patch(args.postId, {
      isPinned: true,
    });
    return true;
  },
});

export const unpinPost = mutation({
  args: {
    postId: v.id('posts'),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return true;

    const user = await ctx.db.get(userId);
    if (!user) return true;

    if (!user.isAdmin) return true;

    const post = await ctx.db.get(args.postId);
    if (!post) return true;

    await ctx.db.patch(args.postId, {
      isPinned: false,
    });
    return true;
  },
});

export const getComments = query({
  args: {
    postId: v.id('posts'),
  },
  returns: v.array(
    v.object({
      _id: v.id('postComments'),
      userId: v.id('users'),
      createdAt: v.number(),
      body: v.string(),
      user: v.object({
        name: v.string(),
        image: v.optional(v.id('_storage')),
        imageUrl: v.optional(v.string()),
        isAuthor: v.boolean(),
        isAdmin: v.boolean(),
      }),
    })
  ),
  handler: async (ctx, args) => {
    const currentUserId = await getAuthUserId(ctx);
    if (!currentUserId) return [];

    const comments = await ctx.db
      .query('postComments')
      .withIndex('by_post', (q) => q.eq('postId', args.postId))
      .collect();

    const results = [];
    for (const comment of comments) {
      const user = await ctx.db.get(comment.userId);
      const isAuthor = user?._id === currentUserId;

      // Check if user reported this comment
      const hasReported = await ctx.db
        .query('commentReports')
        .withIndex('by_comment_user', (q) =>
          q.eq('commentId', comment._id).eq('userId', currentUserId)
        )
        .unique();

      // Skip if user has reported this comment
      if (hasReported) continue;

      results.push({
        _id: comment._id,
        userId: comment.userId,
        createdAt: comment.createdAt,
        body: comment.body,
        user: {
          name: formatUserName(user?.name),
          image: user?.image,
          imageUrl: user?.image ? ((await ctx.storage.getUrl(user.image)) ?? undefined) : undefined,
          isAuthor,
          isAdmin: user?.isAdmin ?? false,
        },
      });
    }

    return results;
  },
});

export const reportComment = mutation({
  args: {
    commentId: v.id('postComments'),
    description: v.optional(v.string()),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return true;

    const comment = await ctx.db.get(args.commentId);
    if (!comment) return true;

    if (comment.userId === userId) return true;

    const existingReport = await ctx.db
      .query('commentReports')
      .withIndex('by_comment_user', (q) => q.eq('commentId', args.commentId).eq('userId', userId))
      .unique();
    if (existingReport) return true;

    await ctx.db.insert('commentReports', {
      commentId: args.commentId,
      userId,
      createdAt: Date.now(),
      description: args.description,
    });
    return true;
  },
});

export const reportPost = mutation({
  args: {
    postId: v.id('posts'),
    description: v.optional(v.string()),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return true;

    const post = await ctx.db.get(args.postId);
    if (!post) return true;

    if (post.userId === userId) return true;

    const existingReport = await ctx.db
      .query('postReports')
      .withIndex('by_post_user', (q) => q.eq('postId', args.postId).eq('userId', userId))
      .unique();
    if (existingReport) return true;

    await ctx.db.insert('postReports', {
      postId: args.postId,
      userId,
      createdAt: Date.now(),
      description: args.description,
    });
    return true;
  },
});

export const blockUser = mutation({
  args: {
    userId: v.id('users'),
    description: v.optional(v.string()),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return true;

    const user = await ctx.db.get(args.userId);
    if (!user) return true;

    const existingBlock = await ctx.db
      .query('blockedUsers')
      .withIndex('by_user_blocked_user', (q) =>
        q.eq('userId', userId).eq('blockedUserId', args.userId)
      )
      .unique();
    if (existingBlock) return true;

    await ctx.db.insert('blockedUsers', {
      userId: args.userId,
      blockedUserId: userId,
      createdAt: Date.now(),
      description: args.description,
    });
    return true;
  },
});

export const createPost = mutation({
  args: {
    body: v.string(),
    media: v.optional(v.id('_storage')),
    mediaWidth: v.optional(v.number()),
    mediaHeight: v.optional(v.number()),
    mediaType: v.optional(v.string()),
    mediaThumbnail: v.optional(v.id('_storage')),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return true;

    const user = await ctx.db.get(userId);
    if (!user) return true;

    const postId = await ctx.db.insert('posts', {
      userId,
      createdAt: Date.now(),
      body: args.body,
      media: args.media,
      mediaWidth: args.mediaWidth,
      mediaHeight: args.mediaHeight,
      mediaType: args.mediaType,
      mediaThumbnail: args.mediaThumbnail,
    });

    // Send notification to all eligible users if admin created the post
    if (user.isAdmin) {
      ctx.scheduler.runAfter(0, internal.posts.notifyUsersOfAdminPost, {
        postId,
        adminUserId: userId,
      });
    }

    return true;
  },
});

export const updatePost = mutation({
  args: {
    postId: v.id('posts'),
    body: v.optional(v.string()),
    media: v.optional(v.union(v.id('_storage'), v.null())),
    mediaWidth: v.optional(v.union(v.number(), v.null())),
    mediaHeight: v.optional(v.union(v.number(), v.null())),
    mediaType: v.optional(v.union(v.string(), v.null())),
    mediaThumbnail: v.optional(v.union(v.id('_storage'), v.null())),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return true;

    const post = await ctx.db.get(args.postId);
    if (!post) return true;

    if (post.userId !== userId) return true;

    // If media is removed, clear type and thumbnail too
    const mediaRemoved = args.media === null;

    await ctx.db.patch(args.postId, {
      body: args.body ?? post.body,
      media: args.media !== undefined ? args.media : post.media,
      mediaWidth: args.media !== undefined ? (args.mediaWidth ?? null) : post.mediaWidth,
      mediaHeight: args.media !== undefined ? (args.mediaHeight ?? null) : post.mediaHeight,
      mediaType: mediaRemoved
        ? undefined
        : args.mediaType !== undefined
          ? (args.mediaType ?? undefined)
          : post.mediaType,
      mediaThumbnail: mediaRemoved
        ? null
        : args.mediaThumbnail !== undefined
          ? args.mediaThumbnail
          : post.mediaThumbnail,
    });

    return true;
  },
});

export const deletePost = mutation({
  args: {
    postId: v.id('posts'),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return true;

    const user = await ctx.db.get(userId);
    if (!user) return true;

    const post = await ctx.db.get(args.postId);
    if (!post) return true;

    // Allow post author or admin to delete
    if (post.userId !== userId && !user.isAdmin) return true;

    const likes = await ctx.db
      .query('postLikes')
      .withIndex('by_post', (q) => q.eq('postId', args.postId))
      .collect();
    for (const like of likes) {
      await ctx.db.delete(like._id);
    }

    const comments = await ctx.db
      .query('postComments')
      .withIndex('by_post', (q) => q.eq('postId', args.postId))
      .collect();
    for (const comment of comments) {
      await ctx.db.delete(comment._id);
    }

    await postCounter.reset(ctx, `likes:${args.postId}`);
    await postCounter.reset(ctx, `likes:${args.postId}:fire`);
    await postCounter.reset(ctx, `likes:${args.postId}:clap`);
    await postCounter.reset(ctx, `likes:${args.postId}:heart`);
    await postCounter.reset(ctx, `comments:${args.postId}`);

    // Revoke points earned for the linked challenge completion. Keep the row
    // (so cooldown still applies) but zero its points and flag it removed.
    if (post.challengeCompletionId) {
      const completion = await ctx.db.get(post.challengeCompletionId);
      if (completion && completion.pointsEarned > 0) {
        await ctx.db.patch(post.challengeCompletionId, {
          pointsEarned: 0,
          removed: true,
        });
        const yearMonth = completion.date.substring(0, 7); // YYYY-MM
        await ctx.scheduler.runAfter(0, internal.leaderboard.updateMonthlyLeaderboard, {
          userId: completion.userId,
          yearMonth,
        });

        // Recompute track rollups after challenge completion soft-delete
        await ctx.runMutation(internal.track.recompute.recomputeTrackForDate, {
          userId: completion.userId,
          date: completion.date,
        });
      }
    }

    await ctx.db.delete(args.postId);
    return true;
  },
});

export const likePost = mutation({
  args: {
    postId: v.id('posts'),
    likeIcon: v.union(v.literal('heart'), v.literal('fire'), v.literal('clap')),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return true;

    const user = await ctx.db.get(userId);
    if (!user) return true;

    const existingLike = await ctx.db
      .query('postLikes')
      .withIndex('by_post_user', (q) => q.eq('postId', args.postId).eq('userId', userId))
      .unique();
    if (existingLike) return true;

    const post = await ctx.db.get(args.postId);
    if (!post) return true;

    await postCounter.inc(ctx, `likes:${args.postId}`);
    await postCounter.inc(ctx, `likes:${args.postId}:${args.likeIcon}`);
    await ctx.db.insert('postLikes', {
      postId: args.postId,
      userId,
      likeIcon: args.likeIcon,
      createdAt: Date.now(),
    });
    return true;
  },
});

export const unlikePost = mutation({
  args: {
    postId: v.id('posts'),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return true;

    const existingLike = await ctx.db
      .query('postLikes')
      .withIndex('by_post_user', (q) => q.eq('postId', args.postId).eq('userId', userId))
      .unique();
    if (!existingLike) return true;

    await postCounter.dec(ctx, `likes:${args.postId}`);
    await postCounter.dec(ctx, `likes:${args.postId}:${existingLike.likeIcon}`);
    await ctx.db.delete(existingLike._id);
    return true;
  },
});

export const createComment = mutation({
  args: {
    postId: v.id('posts'),
    body: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return true;

    const user = await ctx.db.get(userId);
    if (!user) return true;

    const post = await ctx.db.get(args.postId);
    if (!post) return true;

    await ctx.db.insert('postComments', {
      postId: args.postId,
      userId,
      createdAt: Date.now(),
      body: args.body,
    });
    await postCounter.inc(ctx, `comments:${args.postId}`);

    const postUser = await ctx.db.get(post.userId);
    if (!postUser) return true;

    if ((postUser.commentNotificationEnabled ?? true) && postUser._id !== userId) {
      ctx.scheduler.runAfter(0, internal.pushNotification.sendPushNotification, {
        userId: [postUser._id],
        notificationType: 'newCommentPosted',
        options: {
          userName: user.name ?? 'Someone',
          postId: post._id,
        },
      });
    }

    return true;
  },
});

export const updateComment = mutation({
  args: {
    commentId: v.id('postComments'),
    body: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return true;

    const comment = await ctx.db.get(args.commentId);
    if (!comment) return true;

    if (comment.userId !== userId) return true;

    await ctx.db.patch(args.commentId, {
      body: args.body,
    });

    return true;
  },
});

export const deleteComment = mutation({
  args: {
    commentId: v.id('postComments'),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return true;

    const comment = await ctx.db.get(args.commentId);
    if (!comment) return true;

    if (comment.userId !== userId) return true;

    await postCounter.dec(ctx, `comments:${comment.postId}`);
    await ctx.db.delete(args.commentId);
    return true;
  },
});

export const getLatestPosts = query({
  args: {
    paginationOpts: paginationOptsValidator,

    channel: v.optional(v.number()),
  },

  returns: v.object({
    page: v.array(
      v.object({
        _id: v.id('posts'),
        userId: v.id('users'),
        createdAt: v.number(),
        body: v.string(),

        media: v.optional(v.union(v.id('_storage'), v.null())),

        mediaWidth: v.optional(v.union(v.number(), v.null())),

        mediaHeight: v.optional(v.union(v.number(), v.null())),

        mediaType: v.optional(v.string()),

        mediaThumbnailUrl: v.optional(v.string()),

        mediaUrl: v.optional(v.string()),

        challengeId: v.optional(v.id('challenges')),

        challenge: v.optional(
          v.object({
            name: v.string(),
            points: v.number(),

            instructionalVideoUrl: v.optional(v.string()),

            compositeVideoUrl: v.optional(v.string()),

            thumbnailUrl: v.optional(v.string()),

            allowRepost: v.optional(v.boolean()),
          })
        ),

        likeCount: v.number(),
        fireLikesCount: v.number(),
        clapLikesCount: v.number(),
        heartLikesCount: v.number(),
        isLiked: v.boolean(),
        isPinned: v.boolean(),
        commentCount: v.number(),

        user: v.object({
          name: v.string(),

          image: v.optional(v.id('_storage')),

          imageUrl: v.optional(v.string()),

          isAuthor: v.boolean(),
          isAdmin: v.boolean(),
          hasHit500: v.boolean(),
        }),
      })
    ),

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

    /*
     * Keep the existing pagination behavior.
     */
    const postsPage = await ctx.db.query('posts').order('desc').paginate(args.paginationOpts);

    /*
     * Load block relationships once instead
     * of performing two block queries for
     * every post.
     */
    const [blockedByCurrentUser, usersBlockingCurrentUser] = await Promise.all([
      ctx.db
        .query('blockedUsers')
        .withIndex('by_user', (queryBuilder) => queryBuilder.eq('userId', currentUserId))
        .collect(),

      ctx.db
        .query('blockedUsers')
        .withIndex('by_blocked_user', (queryBuilder) =>
          queryBuilder.eq('blockedUserId', currentUserId)
        )
        .collect(),
    ]);

    const blockedAuthorIds = new Set(
      blockedByCurrentUser.map((block) => String(block.blockedUserId))
    );

    const blockingAuthorIds = new Set(
      usersBlockingCurrentUser.map((block) => String(block.userId))
    );

    /*
     * Remove pinned and blocked posts before
     * doing media, counter and challenge work.
     */
    const candidatePosts = postsPage.page.filter((post) => {
      if (post.isPinned) {
        return false;
      }

      const authorId = String(post.userId);

      if (blockedAuthorIds.has(authorId)) {
        return false;
      }

      if (blockingAuthorIds.has(authorId)) {
        return false;
      }

      return true;
    });

    /*
     * Report checks remain per post because
     * postReports currently has no by_user
     * index. Run them concurrently and stop
     * processing reported posts early.
     */
    const reportResults = await Promise.all(
      candidatePosts.map(async (post) => {
        const report = await ctx.db
          .query('postReports')
          .withIndex('by_post_user', (queryBuilder) =>
            queryBuilder.eq('postId', post._id).eq('userId', currentUserId)
          )
          .unique();

        return {
          post,
          reported: Boolean(report),
        };
      })
    );

    const visiblePosts = reportResults
      .filter((result) => !result.reported)
      .map((result) => result.post);

    const yearMonth = new Date().toISOString().slice(0, 7);

    /*
     * Resolve each author once. A feed page
     * often contains several posts from the
     * same user.
     */
    const uniqueAuthorIds = [
      ...new Map(visiblePosts.map((post) => [String(post.userId), post.userId])).values(),
    ];

    const authorEntries = await Promise.all(
      uniqueAuthorIds.map(async (authorId) => {
        const user = await ctx.db.get(authorId);

        if (!user) {
          return null;
        }

        const [leaderboardEntry, imageUrl] = await Promise.all([
          ctx.db
            .query('monthlyLeaderboard')
            .withIndex('by_user_and_year_month', (queryBuilder) =>
              queryBuilder.eq('userId', authorId).eq('yearMonth', yearMonth)
            )
            .unique(),

          user.image
            ? ctx.storage.getUrl(user.image).then((url) => url ?? undefined)
            : Promise.resolve(undefined),
        ]);

        return [
          String(authorId),

          {
            user,
            imageUrl,

            hasHit500: (leaderboardEntry?.displayTotalPoints ?? 0) >= BADGE_POINTS_THRESHOLD,
          },
        ] as const;
      })
    );

    const validAuthorEntries = authorEntries.filter(
      (entry): entry is NonNullable<typeof entry> => entry !== null
    );

    const authorMap = new Map(validAuthorEntries);

    const results = await Promise.all(
      visiblePosts.map(async (post) => {
        const author = authorMap.get(String(post.userId));

        if (!author) {
          return null;
        }

        /*
         * Replace five sharded-counter
         * reads plus the separate isLiked
         * query with one indexed likes
         * query.
         *
         * Replace the sharded comment
         * counter with one indexed comments
         * query.
         */
        const [likes, comments, mediaThumbnailUrl, mediaUrl] = await Promise.all([
          ctx.db
            .query('postLikes')
            .withIndex('by_post', (queryBuilder) => queryBuilder.eq('postId', post._id))
            .collect(),

          ctx.db
            .query('postComments')
            .withIndex('by_post', (queryBuilder) => queryBuilder.eq('postId', post._id))
            .collect(),

          post.mediaThumbnail
            ? ctx.storage.getUrl(post.mediaThumbnail).then((url) => url ?? undefined)
            : Promise.resolve(undefined),

          post.media
            ? ctx.storage.getUrl(post.media).then((url) => url ?? undefined)
            : Promise.resolve(undefined),
        ]);

        let fireLikesCount = 0;
        let clapLikesCount = 0;
        let heartLikesCount = 0;
        let isLiked = false;

        for (const like of likes) {
          if (like.likeIcon === 'fire') {
            fireLikesCount += 1;
          }

          if (like.likeIcon === 'clap') {
            clapLikesCount += 1;
          }

          if (like.likeIcon === 'heart') {
            heartLikesCount += 1;
          }

          if (String(like.userId) === String(currentUserId)) {
            isLiked = true;
          }
        }

        const challenge = post.challengeId
          ? await (async () => {
              const challengeDocument = await ctx.db.get(post.challengeId!);

              if (!challengeDocument) {
                return undefined;
              }

              const [instructionalVideoUrl, completion] = await Promise.all([
                ctx.storage
                  .getUrl(challengeDocument.instructionalVideo)
                  .then((url) => url ?? undefined),

                post.challengeCompletionId
                  ? ctx.db.get(post.challengeCompletionId)
                  : Promise.resolve(null),
              ]);

              const [compositeVideoUrl, thumbnailUrl] = await Promise.all([
                completion?.compositeVideoStorageId
                  ? ctx.storage
                      .getUrl(completion.compositeVideoStorageId)
                      .then((url) => url ?? undefined)
                  : Promise.resolve(undefined),

                completion?.thumbnailStorageId
                  ? ctx.storage
                      .getUrl(completion.thumbnailStorageId)
                      .then((url) => url ?? undefined)
                  : Promise.resolve(undefined),
              ]);

              return {
                name: challengeDocument.name,

                points: challengeDocument.points,

                ...(instructionalVideoUrl
                  ? {
                      instructionalVideoUrl,
                    }
                  : {}),

                ...(compositeVideoUrl
                  ? {
                      compositeVideoUrl,
                    }
                  : {}),

                ...(thumbnailUrl
                  ? {
                      thumbnailUrl,
                    }
                  : {}),

                allowRepost: completion?.allowRepost ?? false,
              };
            })()
          : undefined;

        return {
          _id: post._id,
          userId: post.userId,
          createdAt: post.createdAt,
          body: post.body,
          media: post.media,

          mediaWidth: post.mediaWidth,

          mediaHeight: post.mediaHeight,

          mediaType: post.mediaType,

          ...(mediaThumbnailUrl
            ? {
                mediaThumbnailUrl,
              }
            : {}),

          ...(mediaUrl
            ? {
                mediaUrl,
              }
            : {}),

          challengeId: post.challengeId,

          ...(challenge
            ? {
                challenge,
              }
            : {}),

          likeCount: likes.length,

          fireLikesCount,
          clapLikesCount,
          heartLikesCount,
          isLiked,

          isPinned: Boolean(post.isPinned),

          commentCount: comments.length,

          user: {
            name: author.user.isAdmin ? 'SweatScore' : formatUserName(author.user.name),

            image: author.user.image,

            ...(author.imageUrl
              ? {
                  imageUrl: author.imageUrl,
                }
              : {}),

            isAuthor: String(author.user._id) === String(currentUserId),

            isAdmin: author.user.isAdmin ?? false,

            hasHit500: author.hasHit500,
          },
        };
      })
    );

    const validResults = results.filter(
      (result): result is NonNullable<typeof result> => result !== null
    );

    return {
      page: validResults,

      continueCursor: postsPage.continueCursor,

      isDone: postsPage.isDone,
    };
  },
});

export const getSinglePost = query({
  args: {
    postId: v.id('posts'),
  },
  returns: v.union(
    v.object({
      _id: v.id('posts'),
      userId: v.id('users'),
      createdAt: v.number(),
      body: v.string(),
      media: v.optional(v.union(v.id('_storage'), v.null())),
      mediaWidth: v.optional(v.union(v.number(), v.null())),
      mediaHeight: v.optional(v.union(v.number(), v.null())),
      mediaType: v.optional(v.string()),
      mediaThumbnailUrl: v.optional(v.string()),
      mediaUrl: v.optional(v.string()),
      challengeId: v.optional(v.id('challenges')),
      challenge: v.optional(
        v.object({
          name: v.string(),
          points: v.number(),
          instructionalVideoUrl: v.optional(v.string()),
          compositeVideoUrl: v.optional(v.string()),
          thumbnailUrl: v.optional(v.string()),
          allowRepost: v.optional(v.boolean()),
        })
      ),
      likeCount: v.number(),
      fireLikesCount: v.number(),
      clapLikesCount: v.number(),
      heartLikesCount: v.number(),
      isLiked: v.boolean(),
      isPinned: v.boolean(),
      commentCount: v.number(),
      user: v.object({
        name: v.string(),
        image: v.optional(v.id('_storage')),
        imageUrl: v.optional(v.string()),
        isAuthor: v.boolean(),
        isAdmin: v.boolean(),
        hasHit500: v.boolean(),
      }),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const currentUserId = await getAuthUserId(ctx);
    if (!currentUserId) return null;

    const post = await ctx.db.get(args.postId);
    if (!post) return null;

    const user = await ctx.db.get(post.userId);
    if (!user) return null;

    const likeCount = await postCounter.count(ctx, `likes:${post._id}`);
    const fireLikesCount = await postCounter.count(ctx, `likes:${post._id}:fire`);
    const clapLikesCount = await postCounter.count(ctx, `likes:${post._id}:clap`);
    const heartLikesCount = await postCounter.count(ctx, `likes:${post._id}:heart`);
    const isLiked = await ctx.db
      .query('postLikes')
      .withIndex('by_post_user', (q) => q.eq('postId', post._id).eq('userId', currentUserId))
      .unique();
    const commentCount = await postCounter.count(ctx, `comments:${post._id}`);

    return {
      _id: post._id,
      userId: post.userId,
      createdAt: post.createdAt,
      body: post.body,
      media: post.media,
      mediaWidth: post.mediaWidth,
      mediaHeight: post.mediaHeight,
      mediaType: post.mediaType,
      mediaThumbnailUrl: post.mediaThumbnail
        ? ((await ctx.storage.getUrl(post.mediaThumbnail)) ?? undefined)
        : undefined,
      likeCount,
      fireLikesCount,
      clapLikesCount,
      heartLikesCount,
      isLiked: !!isLiked,
      isPinned: !!post.isPinned,
      commentCount,
      user: {
        name: user.isAdmin ? 'SweatScore' : formatUserName(user.name),
        image: user.image,
        imageUrl: user.image ? ((await ctx.storage.getUrl(user.image)) ?? undefined) : undefined,
        isAuthor: user._id === currentUserId,
        isAdmin: user.isAdmin ?? false,
        hasHit500: await (async () => {
          const ym = new Date().toISOString().slice(0, 7);
          const entry = await ctx.db
            .query('monthlyLeaderboard')
            .withIndex('by_user_and_year_month', (q) =>
              q.eq('userId', post.userId).eq('yearMonth', ym)
            )
            .unique();
          return (entry?.displayTotalPoints ?? 0) >= BADGE_POINTS_THRESHOLD;
        })(),
      },
      mediaUrl: post.media ? ((await ctx.storage.getUrl(post.media)) ?? undefined) : undefined,
      challengeId: post.challengeId,
      challenge: post.challengeId
        ? await (async () => {
            const challenge = await ctx.db.get(post.challengeId!);
            if (!challenge) return undefined;
            const instructionalVideoUrl = await ctx.storage.getUrl(challenge.instructionalVideo);
            let compositeVideoUrl: string | undefined;
            let thumbnailUrl: string | undefined;
            let allowRepost = false;
            if (post.challengeCompletionId) {
              const completion = await ctx.db.get(post.challengeCompletionId);
              if (completion?.compositeVideoStorageId) {
                compositeVideoUrl =
                  (await ctx.storage.getUrl(completion.compositeVideoStorageId)) ?? undefined;
              }
              if (completion?.thumbnailStorageId) {
                thumbnailUrl =
                  (await ctx.storage.getUrl(completion.thumbnailStorageId)) ?? undefined;
              }
              allowRepost = completion?.allowRepost ?? false;
            }
            return {
              name: challenge.name,
              points: challenge.points,
              instructionalVideoUrl: instructionalVideoUrl ?? undefined,
              compositeVideoUrl,
              thumbnailUrl,
              allowRepost,
            };
          })()
        : undefined,
    };
  },
});

export const getPost = query({
  args: {
    postId: v.id('posts'),
  },
  returns: v.union(
    v.object({
      _id: v.id('posts'),
      userId: v.id('users'),
      body: v.string(),
      media: v.optional(v.union(v.id('_storage'), v.null())),
      mediaWidth: v.optional(v.union(v.number(), v.null())),
      mediaHeight: v.optional(v.union(v.number(), v.null())),
      mediaType: v.optional(v.string()),
      mediaThumbnailUrl: v.optional(v.string()),
      mediaUrl: v.optional(v.string()),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const post = await ctx.db.get(args.postId);
    if (!post) return null;

    const mediaUrl = post.media ? ((await ctx.storage.getUrl(post.media)) ?? undefined) : undefined;

    return {
      _id: post._id,
      userId: post.userId,
      body: post.body,
      media: post.media,
      mediaWidth: post.mediaWidth,
      mediaHeight: post.mediaHeight,
      mediaType: post.mediaType,
      mediaThumbnailUrl: post.mediaThumbnail
        ? ((await ctx.storage.getUrl(post.mediaThumbnail)) ?? undefined)
        : undefined,
      mediaUrl,
    };
  },
});
