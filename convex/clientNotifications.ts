import { v } from 'convex/values';

import { internal } from './_generated/api';
import type { Doc, Id } from './_generated/dataModel';
import { internalMutation, type MutationCtx } from './_generated/server';
import {
  addDaysToDateKey,
  DAILY_SCHEDULE_TIMEZONE,
  getDateStartTimestampInTimezone,
  formatDateInTZ,
} from './utils/timezone';
import {
  clientNotificationContents,
  localNotificationClock,
  type ClientNotificationType,
} from '../shared/clientPushNotifications';

type Options = { userName?: string; postId?: Id<'posts'>; challengeId?: Id<'challenges'> };
export async function queueClientNotification(
  ctx: MutationCtx,
  user: Doc<'users'>,
  notificationType: ClientNotificationType,
  date: string,
  options: Options = {},
  key = notificationType as string
) {
  if (!user.notificationEnabled || !user.expoPushToken) return false;
  const existing = await ctx.db
    .query('notificationHistory')
    .withIndex('by_user_date_notification_type', (q) =>
      q.eq('userId', user._id).eq('date', date).eq('notificationType', key)
    )
    .first();
  if (existing) return false;
  await ctx.db.insert('notificationHistory', {
    userId: user._id,
    date,
    notificationType: key,
    notificationBody: clientNotificationContents[notificationType].body,
  });
  await ctx.scheduler.runAfter(0, internal.pushNotification.sendPushNotification, {
    userId: [user._id],
    notificationType,
    options,
  });
  return true;
}

// Five-minute windows support half- and quarter-hour timezones, with transactional deduplication.
export const processScheduledNotifications = internalMutation({
  args: { cursor: v.optional(v.union(v.string(), v.null())), at: v.optional(v.number()) },
  handler: async (ctx, args): Promise<{ sent: number }> => {
    const now = args.at ?? Date.now();
    const users = await ctx.db
      .query('users')
      .withIndex('notificationEnabled', (q) => q.eq('notificationEnabled', true))
      .paginate({ cursor: args.cursor ?? null, numItems: 50 });
    let sent = 0;
    for (const user of users.page) {
      if (!user.onboarded || !user.timezone || !user.expoPushToken) continue;
      const clock = localNotificationClock(now, user.timezone);
      if (!clock || clock.minute >= 5 || (clock.hour !== 7 && clock.hour !== 19)) continue;
      if (clock.hour === 7) {
        if (
          clock.date.endsWith('-01') &&
          (await queueClientNotification(ctx, user, 'newMonth', clock.date))
        )
          sent++;
        const billing = await ctx.db
          .query('coachBillingEntitlementsV1')
          .withIndex('by_user', (q) => q.eq('userId', user._id))
          .unique();
        const access =
          user.isAdmin ||
          (billing?.status === 'active' && (!billing.expiresAt || billing.expiresAt > now));
        if (!access) continue;
        if (clock.weekday === 1) {
          const photo = await ctx.db
            .query('progressPhotos')
            .withIndex('by_user_week', (q) =>
              q.eq('userId', user._id).eq('weekStart', clock.weekStart)
            )
            .first();
          if (
            !photo &&
            (await queueClientNotification(ctx, user, 'weeklyProgressPhotoDue', clock.date))
          )
            sent++;
        } else {
          const plan = await ctx.db
            .query('coachPlanRevisionsV1')
            .withIndex('by_user_day_version', (q) => q.eq('userId', user._id).eq('day', clock.date))
            .order('desc')
            .first();
          const request = await ctx.db
            .query('coachPlanRequestsV1')
            .withIndex('by_user_day', (q) => q.eq('userId', user._id).eq('day', clock.date))
            .order('desc')
            .first();
          if (plan) {
            if (
              await queueClientNotification(
                ctx,
                user,
                'todayPlanReady',
                clock.date,
                {},
                'todayPlanReminder'
              )
            )
              sent++;
          } else if (!request) {
            if (
              await queueClientNotification(
                ctx,
                user,
                'todayPlanQuestions',
                clock.date,
                {},
                'todayPlanReminder'
              )
            )
              sent++;
          }
        }
      } else {
        const challenges = await ctx.db
          .query('challenges')
          .withIndex('by_published', (q) => q.eq('isPublished', true))
          .filter((q) =>
            q.and(
              q.eq(q.field('isCommunityChallenge'), true),
              q.gte(q.field('startDate'), clock.date),
              q.lt(q.field('startDate'), addDaysToDateKey(clock.tomorrow, 2))
            )
          )
          .collect();
        for (const challenge of challenges) {
          if (!challenge.startDate) continue;
          const startsAt = getDateStartTimestampInTimezone(
            challenge.startDate,
            DAILY_SCHEDULE_TIMEZONE
          );
          if (
            startsAt <= now ||
            formatDateInTZ(new Date(startsAt), user.timezone) !== clock.tomorrow
          )
            continue;
          if (
            await queueClientNotification(
              ctx,
              user,
              'challengeStartsTomorrow',
              clock.date,
              { challengeId: challenge._id },
              `challengeStartsTomorrow:${challenge._id}`
            )
          )
            sent++;
        }
      }
    }
    if (!users.isDone)
      await ctx.scheduler.runAfter(0, internal.clientNotifications.processScheduledNotifications, {
        cursor: users.continueCursor,
        at: now,
      });
    return { sent };
  },
});
