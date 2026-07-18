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
    title: "You've hit 500 points!",
    body: "Congratulations. 500 points earned 🏆. You've hit the prize pot milestone.",
  },
  newRewardUnlocked250: {
    title: "You've hit 200 points!",
    body: "200 points earned 🎉 You've hit a rewards milestone this month.",
  },
  newRewardUnlocked100: {
    title: "You've hit 100 points!",
    body: 'You can now claim your monthly reward. Tap to choose before the month ends. Only one reward can be claimed each month.',
  },
  newCommentPosted: {
    title: 'Someone commented on your post',
    body: '{userName} just commented on your post.',
  },
  newAdminPost: {
    title: 'New post by SweatScore',
    body: 'SweatScore has posted a new community post. Check it out!',
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
  newDailyChallenge: {
    title: 'New Check-In 🔥',
    body: '{challengeName} is live now. Tap to join and earn Sweat Points!',
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
      v.literal('newDailyChallenge')
    ),
    options: v.optional(
      v.object({
        userName: v.optional(v.string()),
        date: v.optional(v.string()),
        postId: v.optional(v.id('posts')),
        challengeId: v.optional(v.id('challenges')),
        challengeName: v.optional(v.string()),
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
