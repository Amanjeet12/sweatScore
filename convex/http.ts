import { httpRouter } from 'convex/server';
import { v } from 'convex/values';

import { internal } from './_generated/api';
import { httpAction, internalMutation, internalQuery } from './_generated/server';
import { auth } from './auth';

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
    const postId = await ctx.db.insert('posts', {
      userId: args.userId,
      createdAt: Date.now(),
      body: args.caption,
      media: args.compositeVideoStorageId,
      challengeId: args.challengeId,
      challengeCompletionId: args.challengeCompletionId,
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
    const user = await ctx.db.get(args.userId);
    if (user?.notificationEnabled) {
      await ctx.scheduler.runAfter(0, internal.pushNotification.sendPushNotification, {
        userId: [args.userId],
        notificationType: 'challengePostLive',
        options: {
          postId: args.postId,
        },
      });
    }
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
