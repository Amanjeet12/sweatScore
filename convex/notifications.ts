import { v } from 'convex/values';

import { internal } from './_generated/api';
import { internalMutation } from './_generated/server';
import { legacySchedulerRetired } from './legacySchedulerCutover';
import { MailerLiteGroup } from './mailerlite';

export function formatDateYYYYMMDD(date: Date, timeZone?: string): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  return formatter.format(date);
}

export const sendNoActivityReminderNotification = internalMutation({
  args: {
    userId: v.id('users'),
  },
  handler: async (ctx, args): Promise<void> => {
    const user = await ctx.db.get(args.userId);
    if (!user) return;
    if (!user.onboarded) return;

    // Get user daily activities where either steps or zone2Minutes is greater than 0
    const activity = await ctx.db
      .query('dailyActivities')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .filter((q) => q.or(q.gt(q.field('steps'), 0), q.gt(q.field('zone2Minutes'), 0)))
      .first();

    if (activity) return;

    ctx.scheduler.runAfter(0, internal.mailerlite.addUserToGroup, {
      userId: user._id,
      email: user.email!,
      name: user.name!,
      groupId: MailerLiteGroup.NO_ACTIVITY,
    });
  },
});

// Compatibility endpoints drain jobs queued before the client-only push cutover.
// Their cron registrations and notification implementations have been removed.
export const processNotifications = internalMutation({ args: {}, handler: async () => {} });
export const processDailyMissionNotifications = internalMutation({
  args: {},
  handler: async () => {},
});
export const processRewardNotifications = internalMutation({ args: {}, handler: async () => {} });
export const processScheduledCheckInNotification = internalMutation({
  args: {
    challengeId: v.id('challenges'),
    expectedStartAt: v.number(),
    expectedEndAt: v.number(),
    notificationType: v.union(v.literal('dailyCheckInLive'), v.literal('dailyCheckInReminder')),
  },
  handler: async () => ({
    success: false,
    sent: 0,
    reason: legacySchedulerRetired()
      ? 'Shared check-in scheduling retired'
      : 'Notification outside client trigger list',
  }),
});
