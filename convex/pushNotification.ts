import { PushNotifications } from '@convex-dev/expo-push-notifications';
import { v } from 'convex/values';

import { components } from './_generated/api';
import { internalAction } from './_generated/server';

export const notificationContents = {
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
    title: 'Challenge complete 🏆',
    body: "500 points earned! You finished this month's challenge. Take your flowers and keep earning. 🎉",
  },
  newRewardUnlocked250: {
    title: "200 points 💪",
    body: "Look at you climb. You're right in your rhythm this week.",
  },
  newRewardUnlocked100: {
    title: " 100 points 🎉",
    body: 'Great start to the challenge. Keep it going, sis.',
  },
  newCommentPosted: {
    title: ' New comment 💬',
    body: '{userName} commented on your post. Tap to see the sisterhood love',
  },
  newAdminPost: {
    title: 'Community update 📣',
    body: `There's a fresh post in the community. Tap to see what's new.`,
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
    title: "Today's move is here 👟",
    body: "Your check-in is live. Show the sisters what you're doing today and keep your streak going.",
  },

  dailyCheckInReminder: {
    title: '5 hours left ⏰',
    body: "Your check-in closes soon. Tap in now to lock today's points before the window shuts.",
  },

  videoFeedLive: {
    title: 'Your video is live 🎥',
    body: 'Your video just dropped on the feed. 🙌🏾',
  },
};

function interpolate(template: string, options: Record<string, string>) {
  return template.replace(/{(\w+)}/g, (_, key) => options[key] ?? '');
}

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
      v.literal('videoFeedLive')
    ),
    options: v.optional(
      v.object({
        userName: v.optional(v.string()),
        date: v.optional(v.string()),
        postId: v.optional(v.id('posts')),
        challengeId: v.optional(v.id('challenges')),
      })
    ),
  },
  handler: async (ctx, args) => {
    const pushNotifications = new PushNotifications(components.pushNotifications);

    const { title, body } = notificationContents[args.notificationType];
    const interpolatedTitle = interpolate(title, args.options ?? {});
    const interpolatedBody = interpolate(body, args.options ?? {});

    for (const userId of args.userId) {
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
