import { PushNotifications } from '@convex-dev/expo-push-notifications';
import { v } from 'convex/values';

import { components, internal } from './_generated/api';
import { internalAction, internalQuery } from './_generated/server';
import {
  clientNotificationContents,
  isClientNotificationType,
} from '../shared/clientPushNotifications';

export const notificationContents = clientNotificationContents;

function interpolate(template: string, options: Record<string, string>) {
  return template.replace(/{(\w+)}/g, (_, key) => options[key] ?? '');
}

export const canReceivePush = internalQuery({
  args: { userId: v.id('users'), notificationType: v.string() },
  handler: async (ctx, args): Promise<boolean> => {
    if (!isClientNotificationType(args.notificationType)) return false;
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
    // Keep legacy argument types so already queued jobs drain safely without a push.
    if (!isClientNotificationType(args.notificationType)) return;
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
  // Compatibility endpoint for old scheduled jobs; marketing is outside the client list.
  handler: async () => {},
});
