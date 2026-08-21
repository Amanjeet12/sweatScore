'use node';

import { v } from 'convex/values';

import { internalAction } from './_generated/server';

export const triggerVideoMerge = internalAction({
  args: {
    adminVideoUrl: v.optional(v.string()),
    userVideoUrl: v.string(),

    challengeCompletionId: v.id('challengeCompletions'),

    userId: v.id('users'),
    caption: v.string(),
    challengeId: v.id('challenges'),

    leftLabel: v.optional(v.string()),
    rightLabel: v.optional(v.string()),
    musicTrackId: v.optional(
      v.union(
        v.literal('audio_1'),
        v.literal('audio_2'),
        v.literal('audio_3'),
        v.literal('audio_4'),
        v.literal('audio_5')
      )
    ),
    checkInMusicOnly: v.optional(v.boolean()),
  },

  handler: async (_ctx, args) => {
    const triggerSecretKey = process.env.TRIGGER_SECRET_KEY;

    const triggerSecret = process.env.TRIGGER_SECRET;

    const convexSiteUrl = process.env.CONVEX_SITE_URL;

    if (!triggerSecretKey || !triggerSecret || !convexSiteUrl) {
      console.error('Missing TRIGGER_SECRET_KEY, TRIGGER_SECRET, or CONVEX_SITE_URL env vars');

      return;
    }

    const response = await fetch('https://api.trigger.dev/api/v1/tasks/merge-videos/trigger', {
      method: 'POST',

      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${triggerSecretKey}`,
      },

      body: JSON.stringify({
        payload: {
          ...(args.adminVideoUrl ? { adminVideoUrl: args.adminVideoUrl } : {}),

          userVideoUrl: args.userVideoUrl,

          challengeCompletionId: args.challengeCompletionId,

          userId: args.userId,
          caption: args.caption,
          challengeId: args.challengeId,

          ...(args.leftLabel
            ? {
                leftLabel: args.leftLabel,
              }
            : {}),

          ...(args.rightLabel
            ? {
                rightLabel: args.rightLabel,
              }
            : {}),

          ...(args.musicTrackId ? { musicTrackId: args.musicTrackId } : {}),
          ...(args.checkInMusicOnly ? { checkInMusicOnly: true } : {}),

          convexSiteUrl,
          triggerSecret,
        },
      }),
    });

    if (!response.ok) {
      console.error('Failed to trigger merge task:', await response.text());

      return;
    }

    console.log('Merge task triggered successfully');
  },
});
