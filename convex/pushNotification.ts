import { PushNotifications } from '@convex-dev/expo-push-notifications';
import { v } from 'convex/values';

import { components, internal } from './_generated/api';
import { internalAction, internalQuery } from './_generated/server';
import { legacySchedulerRetired, shouldSuppressPush } from './legacySchedulerCutover';
import { clientNotificationContents } from '../shared/clientPushNotifications';

export const notificationContents = {
  ...clientNotificationContents,
  newActivitySubmitted: {
    title: 'New Activity Submitted',
    body: 'Heads up: {userName} just submitted an activity that needs approval.',
  },
  newActivityApproved: {
    title: 'Activity Approved',
    body: "Your activity's approved and counting - weekly goal's in sight 👀",
  },
  newActivityRejected: {
    title: 'Activity Rejected',
    body: "We couldn't approve that activity entry. Feel free to update and send it back!",
  },
  newRewardClaimed: {
    title: 'Reward Claimed',
    body: 'Heads up: {userName} just claimed a reward!',
  },
  newRewardUnlocked500: {
    title: "You've hit 500 points 🏆",
    body: "That's this month's goal hit. Well done 🎉",
  },
  newRewardUnlocked250: {
    title: '200 points 💪',
    body: "Look at you climb. You're right in your rhythm this week.",
  },
  newRewardUnlocked100: {
    title: ' 100 points 🎉',
    body: 'Great start to the challenge. Keep it going, sis.',
  },
  newCommentPosted: {
    title: '{userName} commented on your post 💬',
    body: '{commentPreview}',
  },
  noActivityReminder: {
    title: 'SweatScore',
    body: "Need help setting up SweatScore? Check your setup so you don't miss out on points. 🔥",
  },
  challengePostLive: {
    title: 'Your duet is live! 🎬',
    body: 'Check it out in the community.',
  },

  // Add this
  dailyCheckInLive: {
    title: 'Time to check in 💬',
    body: "Show the sisters what you're doing today and keep your streak going.",
  },

  dailyCheckInReminder: {
    title: '5 hours left ⏰',
    body: "Your check-in closes soon. Tap in now to lock today's points before the window shuts.",
  },

  videoFeedLive: {
    title: 'Your video is live 🔥',
    body: 'Nice work. See it in the community 💪🏾',
  },
};

function interpolate(template: string, options: Record<string, string>) {
  return template.replace(/{(\w+)}/g, (_, key) => options[key] ?? '');
}

export const canReceivePush = internalQuery({
  args: { userId: v.id('users'), notificationType: v.string() },
  handler: async (ctx, args): Promise<boolean> => {
    const user = await ctx.db.get(args.userId);
    if (!user || !user.notificationEnabled || !user.expoPushToken) return false;
    if (
      ['newCommentPosted', 'newPostLiked'].includes(args.notificationType) &&
      user.commentNotificationEnabled === false
    )
      return false;
    return true;
  },
});

export const sendPushNotification = internalAction({
  args: {
    userId: v.array(v.id('users')),
    notificationType: v.union(
      v.literal('newActivitySubmitted'),
      v.literal('newActivityApproved'),
      v.literal('newActivityRejected'),
      v.literal('newRewardClaimed'),
      v.literal('newRewardUnlocked500'),
      v.literal('newRewardUnlocked250'),
      v.literal('newRewardUnlocked100'),
      v.literal('newCommentPosted'),
      v.literal('newAdminPost'),
      v.literal('noActivityReminder'),
      v.literal('challengePostLive'),

      v.literal('dailyCheckInLive'),
      v.literal('dailyCheckInReminder'),
      v.literal('videoFeedLive'),
      v.literal('newPostLiked'),
      v.literal('todayPlanReady'),
      v.literal('todayPlanQuestions'),
      v.literal('challengeStartsTomorrow'),
      v.literal('weeklyProgressPhotoDue'),
      v.literal('newMonth')
    ),
    options: v.optional(
      v.object({
        userName: v.optional(v.string()),
        commentPreview: v.optional(v.string()),
        date: v.optional(v.string()),
        postId: v.optional(v.id('posts')),
        challengeId: v.optional(v.id('challenges')),
      })
    ),
  },
  handler: async (ctx, args) => {
    if (shouldSuppressPush(legacySchedulerRetired(), args.notificationType)) return;
    const pushNotifications = new PushNotifications(components.pushNotifications);

    const { title, body } = notificationContents[args.notificationType];
    const interpolatedTitle = interpolate(title, args.options ?? {});
    const interpolatedBody = interpolate(body, args.options ?? {});

    for (const userId of args.userId) {
      if (
        !(await ctx.runQuery(internal.pushNotification.canReceivePush, {
          userId,
          notificationType: args.notificationType,
        }))
      )
        continue;
      await pushNotifications.sendPushNotification(ctx as any, {
        userId,
        notification: {
          title: interpolatedTitle,
          body: interpolatedBody,
          data: { notificationType: args.notificationType, ...(args.options ?? {}) },
        },
      });
    }
  },
});

export const sendMarketingPushNotification = internalAction({
  args: {
    userId: v.id('users'),
    title: v.string(),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const pushNotifications = new PushNotifications(components.pushNotifications);

    await pushNotifications.sendPushNotification(ctx as any, {
      userId: args.userId,
      notification: {
        title: args.title,
        body: args.body,
        data: { notificationType: 'marketing' },
      },
    });
  },
});
