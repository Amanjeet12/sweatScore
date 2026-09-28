import { httpRouter } from 'convex/server';
import { getAuthUserId } from '@convex-dev/auth/server';
import { v } from 'convex/values';

import { internal } from './_generated/api';
import { Id } from './_generated/dataModel';
import { httpAction, internalMutation, internalQuery } from './_generated/server';
import { auth } from './auth';
import { parseRevenueCatEvent, verifyRevenueCatSignature } from './revenueCatPolicy';

export const patchCompositeVideo = internalMutation({
  args: {
    challengeCompletionId: v.id('challengeCompletions'),
    compositeVideoStorageId: v.optional(v.id('_storage')),
    thumbnailStorageId: v.optional(v.id('_storage')),
  },
  handler: async (ctx, args) => {
    const patch: Record<string, unknown> = {};
    if (args.compositeVideoStorageId) patch.compositeVideoStorageId = args.compositeVideoStorageId;
    if (args.thumbnailStorageId) patch.thumbnailStorageId = args.thumbnailStorageId;
    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(args.challengeCompletionId, patch);
    }
  },
});

export const createChallengePost = internalMutation({
  args: {
    userId: v.id('users'),
    challengeId: v.id('challenges'),
    challengeCompletionId: v.id('challengeCompletions'),
    compositeVideoStorageId: v.id('_storage'),
    caption: v.string(),
  },

  handler: async (ctx, args) => {
    const completion = await ctx.db.get(args.challengeCompletionId);

    if (!completion) {
      console.error('Challenge completion not found', {
        challengeCompletionId: args.challengeCompletionId,
      });

      return null;
    }

    // Prevent duplicate posts if Trigger.dev retries
    const existingPost = await ctx.db
      .query('posts')
      .filter((q) => q.eq(q.field('challengeCompletionId'), args.challengeCompletionId))
      .first();

    if (existingPost) {
      // Preserve retry/legacy behavior without duplicating the post or losing
      // comments and reactions when video processing finishes.
      await ctx.db.patch(existingPost._id, {
        media: args.compositeVideoStorageId,
        mediaWidth: 1080,
        mediaHeight: 960,
        mediaThumbnail: completion.thumbnailStorageId,
      });
      return existingPost._id;
    }

    const postId = await ctx.db.insert('posts', {
      userId: args.userId,
      createdAt: Date.now(),

      body: args.caption.trim() || 'Challenge completed 🔥',

      media: args.compositeVideoStorageId,

      mediaType: 'video',
      mediaWidth: 1080,
      mediaHeight: 960,
      ...(completion.thumbnailStorageId ? { mediaThumbnail: completion.thumbnailStorageId } : {}),

      challengeId: args.challengeId,
      challengeCompletionId: args.challengeCompletionId,
    });

    console.log('Challenge post created', {
      postId,
      challengeCompletionId: args.challengeCompletionId,
      attemptNumber: completion.attemptNumber,
      comparisonMode: completion.comparisonMode,
    });

    return postId;
  },
});

export const sendChallengeNotification = internalMutation({
  args: {
    userId: v.id('users'),
    postId: v.id('posts'),
  },

  handler: async (ctx, args) => {
    const post = await ctx.db.get(args.postId);

    if (!post) {
      console.error('Cannot send feed notification: post not found', {
        postId: args.postId,
      });

      return {
        success: false,
        sent: false,
        reason: 'post_not_found',
      };
    }

    /*
     * Security check:
     * The notification recipient must own the feed post.
     */
    if (post.userId !== args.userId) {
      console.error('Cannot send feed notification: post owner mismatch', {
        postId: args.postId,
        postOwnerId: post.userId,
        requestedUserId: args.userId,
      });

      return {
        success: false,
        sent: false,
        reason: 'post_owner_mismatch',
      };
    }

    /*
     * Trigger.dev may retry the merge task.
     * Do not notify the user more than once for the same post.
     */
    if (post.feedLiveNotificationSentAt) {
      return {
        success: true,
        sent: false,
        reason: 'notification_already_sent',
      };
    }

    const user = await ctx.db.get(args.userId);

    if (!user) {
      return {
        success: false,
        sent: false,
        reason: 'user_not_found',
      };
    }

    if (!user.notificationEnabled || !user.expoPushToken) {
      return {
        success: true,
        sent: false,
        reason: 'notifications_disabled',
      };
    }

    /*
     * Mark the post before scheduling.
     * The database update and scheduled notification are committed
     * together by Convex.
     */
    await ctx.db.patch(args.postId, {
      feedLiveNotificationSentAt: Date.now(),
    });

    await ctx.scheduler.runAfter(0, internal.pushNotification.sendPushNotification, {
      userId: [args.userId],
      notificationType: 'videoFeedLive',
      options: {
        postId: args.postId,
      },
    });

    return {
      success: true,
      sent: true,
      postId: args.postId,
    };
  },
});

export const patchPostMedia = internalMutation({
  args: {
    postId: v.id('posts'),
    media: v.id('_storage'),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.postId, { media: args.media });
  },
});

// Find completions missing composite video — for backfill merge
export const getCompletionsNeedingMerge = internalQuery({
  args: {},
  handler: async (ctx) => {
    const completions = await ctx.db.query('challengeCompletions').collect();
    const results = [];
    for (const c of completions) {
      if (c.removed) continue;
      if (c.compositeVideoStorageId) continue;
      if (!c.videoStorageId) continue;

      const challenge = await ctx.db.get(c.challengeId);
      if (!challenge?.instructionalVideo) continue;

      const userVideoUrl = await ctx.storage.getUrl(c.videoStorageId);
      const adminVideoUrl = await ctx.storage.getUrl(challenge.instructionalVideo);
      if (!userVideoUrl || !adminVideoUrl) continue;

      // Find the associated post
      const post = await ctx.db
        .query('posts')
        .filter((q) => q.eq(q.field('challengeCompletionId'), c._id))
        .first();

      results.push({
        completionId: c._id,
        postId: post?._id ?? null,
        adminVideoUrl,
        userVideoUrl,
      });
    }
    return results;
  },
});

export const backfillPostMedia = internalMutation({
  args: {},
  handler: async (ctx) => {
    const posts = await ctx.db.query('posts').collect();
    let updated = 0;
    for (const post of posts) {
      if (!post.challengeCompletionId) continue;
      const completion = await ctx.db.get(post.challengeCompletionId);
      if (!completion?.compositeVideoStorageId) continue;
      if (post.media === completion.compositeVideoStorageId) continue;
      await ctx.db.patch(post._id, { media: completion.compositeVideoStorageId });
      updated++;
    }
    return { updated };
  },
});

// Find posts where the completion has composite video but no thumbnail
export const getPostsNeedingThumbnail = internalQuery({
  args: {},
  handler: async (ctx) => {
    const posts = await ctx.db.query('posts').collect();
    const results = [];
    for (const post of posts) {
      if (!post.challengeCompletionId) continue;
      const completion = await ctx.db.get(post.challengeCompletionId);
      if (!completion?.compositeVideoStorageId) continue;
      if (completion.thumbnailStorageId) continue;

      const compositeVideoUrl = await ctx.storage.getUrl(completion.compositeVideoStorageId);
      if (!compositeVideoUrl) continue;

      results.push({
        completionId: completion._id,
        compositeVideoUrl,
      });
    }
    return results;
  },
});

const http = httpRouter();

http.route({
  path: '/api/revenuecat-webhook',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const signingSecret = process.env.REVENUECAT_WEBHOOK_SIGNING_SECRET;
    const expectedAuthorization = process.env.REVENUECAT_WEBHOOK_AUTHORIZATION;
    if (
      !signingSecret ||
      (expectedAuthorization && request.headers.get('authorization') !== expectedAuthorization)
    )
      return new Response('Unauthorized', { status: 401 });
    const body = await request.text();
    if (
      !(await verifyRevenueCatSignature(
        body,
        request.headers.get('x-revenuecat-webhook-signature'),
        signingSecret,
        Date.now()
      ))
    )
      return new Response('Unauthorized', { status: 401 });
    let event;
    try {
      event = parseRevenueCatEvent(JSON.parse(body));
    } catch {
      return new Response('Invalid event', { status: 400 });
    }
    await ctx.runMutation(internal.revenueCatEntitlements.recordWebhookEvent, {
      eventId: event.id,
      eventType: event.type,
      eventAt: event.eventAt,
      appUserIds: event.appUserIds,
    });
    return new Response('OK', { status: 200 });
  }),
});

auth.addHttpRoutes(http);

export const sendEmailEndpoint = httpAction(async (ctx, request) => {
  const authHeader = request.headers.get('Authorization');

  if (!authHeader?.startsWith('Basic ')) {
    return new Response('Unauthorized', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="Email API"' },
    });
  }

  try {
    const credentials = atob(authHeader.split(' ')[1]);
    const [username, password] = credentials.split(':');

    if (
      username !== process.env.BASIC_AUTH_USERNAME ||
      password !== process.env.BASIC_AUTH_PASSWORD
    ) {
      return new Response('Invalid credentials', { status: 401 });
    }
  } catch (error) {
    return new Response('Invalid authorization header', { status: 401 });
  }

  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  let body;
  try {
    body = await request.json();
  } catch (error) {
    return new Response('Invalid JSON', { status: 400 });
  }

  const { from, to, subject, text, html } = body;

  if (!from || !to || !Array.isArray(to) || to.length === 0 || !subject || !text || !html) {
    return new Response('Missing required fields: from, to (array), subject, text, html', {
      status: 400,
    });
  }

  try {
    const result = await ctx.runAction(internal.email.sendEmail, {
      from,
      to,
      subject,
      text,
      html,
    });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Email sending error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
});

http.route({
  path: '/api/send-email',
  method: 'POST',
  handler: sendEmailEndpoint,
});

// The photo is stored by this authenticated handler and immediately bound to
// the same member's reserved proof. A generic upload storage ID cannot be
// submitted to a public check-in mutation.
const coachProofUploadEndpoint = httpAction(async (ctx, request) => {
  const userId = await getAuthUserId(ctx);
  if (!userId) return new Response('Unauthorized', { status: 401 });
  const submissionId = request.headers.get(
    'X-Coach-Submission'
  ) as Id<'coachProofSubmissionsV1'> | null;
  const token = request.headers.get('X-Coach-Capture-Token');
  if (!submissionId || !token) return new Response('Proof session unavailable', { status: 403 });
  let authorized = false;
  try {
    authorized = await ctx.runQuery(internal.coachCheckIns.authorizeUpload, {
      userId,
      submissionId,
      token,
    });
  } catch {
    /* Invalid or stale submission IDs are not disclosed. */
  }
  if (!authorized) return new Response('Proof session unavailable', { status: 403 });
  if (request.headers.get('Content-Type')?.split(';')[0] !== 'image/jpeg')
    return new Response('JPEG photo required', { status: 415 });
  if (Number(request.headers.get('Content-Length') ?? 0) > 12_000_000)
    return new Response('Invalid photo size', { status: 413 });
  const blob = await request.blob();
  if (blob.size < 100 || blob.size > 12_000_000)
    return new Response('Invalid photo size', { status: 413 });
  const signature = new Uint8Array(await blob.slice(0, 3).arrayBuffer());
  if (signature[0] !== 0xff || signature[1] !== 0xd8 || signature[2] !== 0xff)
    return new Response('Invalid photo format', { status: 415 });
  const storageId = await ctx.storage.store(blob);
  try {
    await ctx.runMutation(internal.coachCheckIns.attachUploadedInternal, {
      userId,
      submissionId,
      token,
      storageId,
    });
  } catch {
    await ctx.storage.delete(storageId);
    return new Response('Proof session changed; retry upload', { status: 409 });
  }
  return new Response(JSON.stringify({ storageId }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});

http.route({ path: '/api/coach-proof-upload', method: 'POST', handler: coachProofUploadEndpoint });

// Generate upload URL for Trigger.dev video merge
const generateUploadUrlEndpoint = httpAction(async (ctx, request) => {
  const authHeader = request.headers.get('Authorization');
  if (authHeader !== `Bearer ${process.env.TRIGGER_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const uploadUrl = await ctx.storage.generateUploadUrl();
  return new Response(JSON.stringify({ uploadUrl }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});

http.route({
  path: '/api/generate-upload-url',
  method: 'POST',
  handler: generateUploadUrlEndpoint,
});

// Patch composite video on completion record — called by Trigger.dev
const patchCompositeEndpoint = httpAction(async (ctx, request) => {
  const authHeader = request.headers.get('Authorization');
  if (authHeader !== `Bearer ${process.env.TRIGGER_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { challengeCompletionId, compositeVideoStorageId, thumbnailStorageId } =
    await request.json();

  await ctx.runMutation(internal.http.patchCompositeVideo, {
    challengeCompletionId,
    ...(compositeVideoStorageId ? { compositeVideoStorageId } : {}),
    ...(thumbnailStorageId ? { thumbnailStorageId } : {}),
  });

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});

http.route({
  path: '/api/patch-composite',
  method: 'POST',
  handler: patchCompositeEndpoint,
});

const createChallengePostEndpoint = httpAction(async (ctx, request) => {
  const authHeader = request.headers.get('Authorization');

  if (authHeader !== `Bearer ${process.env.TRIGGER_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { userId, challengeId, challengeCompletionId, compositeVideoStorageId, caption } =
    await request.json();

  const postId = await ctx.runMutation(internal.http.createChallengePost, {
    userId,
    challengeId,
    challengeCompletionId,
    compositeVideoStorageId,
    caption,
  });

  if (!postId) {
    return new Response(
      JSON.stringify({
        success: true,
        skipped: true,
        reason: 'day_1_video_not_posted',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  return new Response(JSON.stringify({ success: true, postId }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});

http.route({
  path: '/api/create-challenge-post',
  method: 'POST',
  handler: createChallengePostEndpoint,
});

const sendChallengeNotificationEndpoint = httpAction(async (ctx, request) => {
  const authHeader = request.headers.get('Authorization');

  if (authHeader !== `Bearer ${process.env.TRIGGER_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { userId, postId } = await request.json();

  if (!postId) {
    return new Response(
      JSON.stringify({
        success: true,
        skipped: true,
        reason: 'no_post_created',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  await ctx.runMutation(internal.http.sendChallengeNotification, {
    userId,
    postId,
  });

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});

http.route({
  path: '/api/send-challenge-notification',
  method: 'POST',
  handler: sendChallengeNotificationEndpoint,
});

// List completions needing merge — for backfill
const completionsNeedingMergeEndpoint = httpAction(async (ctx, request) => {
  const authHeader = request.headers.get('Authorization');
  if (authHeader !== `Bearer ${process.env.TRIGGER_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const completions = await ctx.runQuery(internal.http.getCompletionsNeedingMerge, {});

  return new Response(JSON.stringify({ completions }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});

http.route({
  path: '/api/completions-needing-merge',
  method: 'GET',
  handler: completionsNeedingMergeEndpoint,
});

// Patch post media — called by backfill after merge
const patchPostMediaEndpoint = httpAction(async (ctx, request) => {
  const authHeader = request.headers.get('Authorization');
  if (authHeader !== `Bearer ${process.env.TRIGGER_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { postId, media } = await request.json();
  await ctx.runMutation(internal.http.patchPostMedia, { postId, media });

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});

http.route({
  path: '/api/patch-post-media',
  method: 'POST',
  handler: patchPostMediaEndpoint,
});

// List posts needing thumbnail — for backfill
const postsNeedingThumbnailEndpoint = httpAction(async (ctx, request) => {
  const authHeader = request.headers.get('Authorization');
  if (authHeader !== `Bearer ${process.env.TRIGGER_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const completions = await ctx.runQuery(internal.http.getPostsNeedingThumbnail, {});

  return new Response(JSON.stringify({ completions }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});

http.route({
  path: '/api/completions-needing-thumbnail',
  method: 'GET',
  handler: postsNeedingThumbnailEndpoint,
});

export default http;
