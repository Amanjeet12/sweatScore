import { PushNotifications } from '@convex-dev/expo-push-notifications';
import { compare } from 'compare-versions';
import { v } from 'convex/values';

import { components, internal } from './_generated/api';
import { internalMutation } from './_generated/server';
import { appVersions } from './appVersions';
import { MailerLiteGroup } from './mailerlite';

function getDaysBetweenDates(date1: Date, date2: Date): number {
  // Clone dates to avoid mutating originals
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  d1.setHours(0, 0, 0, 0);
  d2.setHours(0, 0, 0, 0);
  return Math.round((d1.getTime() - d2.getTime()) / (1000 * 60 * 60 * 24));
}

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

    ctx.scheduler.runAfter(0, internal.pushNotification.sendPushNotification, {
      userId: [user._id],
      notificationType: 'noActivityReminder',
      options: {
        userName: user.name,
      },
    });

    ctx.scheduler.runAfter(0, internal.mailerlite.addUserToGroup, {
      userId: user._id,
      email: user.email!,
      name: user.name!,
      groupId: MailerLiteGroup.NO_ACTIVITY,
    });
  },
});

export const processRewardNotifications = internalMutation({
  args: {},
  handler: async (ctx, args): Promise<void> => {
    const pushNotifications = new PushNotifications(components.pushNotifications);
    const now = new Date();
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const users = await ctx.db
      .query('users')
      .withIndex('notificationEnabled', (q) => q.eq('notificationEnabled', true))
      .collect();

    for (const user of users) {
      // Skip users without timezone or push token
      if (!user.timezone || !user.expoPushToken) continue;

      const userTime = new Date(now.toLocaleString('en-US', { timeZone: user.timezone }));
      const hour = userTime.getHours();

      if (hour !== 20) continue;

      const todayFormatted = formatDateYYYYMMDD(now, user.timezone);
      const notificationHistory = await ctx.db
        .query('notificationHistory')
        .withIndex('by_user_date_notification_type', (q) =>
          q
            .eq('userId', user._id)
            .eq('date', todayFormatted)
            .eq('notificationType', 'newRewardUnlocked')
        )
        .unique();

      if (notificationHistory) continue;

      const canClaimReward = await ctx.runQuery(internal.users.canClaimReward, {
        userId: user._id,
        yearMonth,
      });

      if (!canClaimReward) continue;

      const notificationBody =
        "Psst… don't forget to claim your reward! It resets soon. Tap to lock it in!";
      pushNotifications.sendPushNotification(ctx, {
        userId: user._id,
        notification: {
          title: 'Claim Your Reward',
          body: notificationBody,
          data: { notificationType: 'newRewardUnlocked100' },
        },
      });

      ctx.db.insert('notificationHistory', {
        userId: user._id,
        date: todayFormatted,
        notificationType: 'newRewardUnlocked',
        notificationBody,
      });
    }
  },
});

export const processNotifications = internalMutation({
  args: {},
  handler: async (ctx, args): Promise<void> => {
    const pushNotifications = new PushNotifications(components.pushNotifications);
    const now = new Date();

    const users = await ctx.db
      .query('users')
      .withIndex('notificationEnabled', (q) => q.eq('notificationEnabled', true))
      .collect();

    for (const user of users) {
      // Skip users without timezone or push token
      if (!user.timezone || !user.expoPushToken) continue;

      // Check if it's 10pm or 8am in the user's timezone
      const userTime = new Date(now.toLocaleString('en-US', { timeZone: user.timezone }));
      const hour = userTime.getHours();

      // Only send notification if it's 10pm (22:00) or 8am (8:00) in user's timezone
      if (hour !== 22 && hour !== 8) continue;

      const userAppVersion = user.appVersion ?? '1.0.0';
      const userMissionFeatureFlagEnabled = compare(
        userAppVersion,
        appVersions.minVersionForMission,
        '>='
      );

      if (userMissionFeatureFlagEnabled) continue;

      const today = now;
      const todayFormatted = formatDateYYYYMMDD(today, user.timezone);

      const notificationHistory = await ctx.db
        .query('notificationHistory')
        .withIndex('by_user_date', (q) => q.eq('userId', user._id).eq('date', todayFormatted))
        .unique();

      if (notificationHistory) continue;

      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      const month = String(today.getMonth() + 1).padStart(2, '0');
      const yearMonth = `${today.getFullYear()}-${month}`;
      const yesterdayFormatted = formatDateYYYYMMDD(yesterday, user.timezone);
      let notificationBody: string | null = null;
      const firstName = user.name?.split(' ')[0];
      const lastActiveAt = user.lastActiveAt ? new Date(user.lastActiveAt) : null;
      if (!lastActiveAt) continue;

      const daysLastActive = getDaysBetweenDates(today, lastActiveAt);
      const openedAppToday = lastActiveAt.toDateString() === today.toDateString();

      if (openedAppToday) {
        if (hour === 8) continue;

        const userOnStreak = await ctx.db
          .query('userCheckIns')
          .withIndex('by_user_date', (q) => q.eq('userId', user._id).eq('date', yesterdayFormatted))
          .unique();
        if (userOnStreak) {
          const tenDaysAgo = new Date(today);
          tenDaysAgo.setDate(today.getDate() - 10);
          const tenDaysAgoFormatted = formatDateYYYYMMDD(tenDaysAgo, user.timezone);

          const checkIns = await ctx.db
            .query('userCheckIns')
            .withIndex('by_user_date', (q) =>
              q
                .eq('userId', user._id)
                .gte('date', tenDaysAgoFormatted)
                .lte('date', yesterdayFormatted)
            )
            .collect();

          if (checkIns.length === 0) {
            continue;
          }

          const hasCheckedInYesterday = checkIns.some(
            (checkIn) => checkIn.date === yesterdayFormatted
          );
          if (!hasCheckedInYesterday) {
            continue;
          }

          let streak = 1; // Start with 1 for yesterday
          const currentDate = new Date(yesterday);

          while (currentDate > tenDaysAgo) {
            currentDate.setDate(currentDate.getDate() - 1);
            const dateStr = formatDateYYYYMMDD(currentDate, user.timezone);
            const hasCheckedIn = checkIns.some((checkIn) => checkIn.date === dateStr);

            if (hasCheckedIn) {
              streak++;
            } else {
              break;
            }
          }

          if (streak === 3) {
            notificationBody = `${streak} days in a row. you're on a streak 🔥 Keep showing up your way.`;
          } else if (streak === 5) {
            notificationBody = `Consistency is a flex — and you're on a ${streak} day streak 🔥 Keep showing up your way.`;
          }
        } else {
          const userEntry = await ctx.db
            .query('monthlyLeaderboard')
            .withIndex('by_user_and_year_month', (q) =>
              q.eq('userId', user._id).eq('yearMonth', yearMonth)
            )
            .unique();

          if (userEntry && userEntry.displayTotalPoints && userEntry.displayTotalPoints > 1) {
            notificationBody = `You're on ${userEntry.displayTotalPoints} Sweat Points so far 💜 Let's see what you can finish the month with.`;
          }
        }
      } else {
        if (hour === 22) continue;

        if (daysLastActive === 1) {
          const totalCheckIns = await ctx.db
            .query('userCheckIns')
            .withIndex('by_date', (q) => q.eq('date', todayFormatted))
            .collect();
          const totalCheckInsCount = totalCheckIns.length;
          if (totalCheckInsCount > 0) {
            notificationBody = `${totalCheckInsCount} Sweat Sisters already checked in today. Don't miss your point — check in before today ends!`;
          } else {
            notificationBody = `${firstName}! Be the first Sweat Sister to check in today. Don't miss your point — check in before today ends!`;
          }
        } else if (daysLastActive >= 3 && daysLastActive < 10) {
          notificationBody = `We miss your name popping up ${firstName} 👀 Last log was ${daysLastActive} days ago — just sayin.`;
        } else if (daysLastActive > 10) {
          notificationBody = `Still on our minds ${firstName} 💭 Let's call it a reset and start fresh tomorrow?`;
        }
      }

      if (notificationBody) {
        pushNotifications.sendPushNotification(ctx, {
          userId: user._id,
          notification: {
            title: 'SweatScore',
            body: notificationBody,
            data: { notificationType: 'engagementNotification' },
          },
        });

        ctx.db.insert('notificationHistory', {
          userId: user._id,
          date: todayFormatted,
          notificationType: 'engagementNotification',
          notificationBody,
        });
      }
    }
  },
});

export const processDailyMissionNotifications = internalMutation({
  args: {},
  handler: async (ctx, args): Promise<void> => {
    const pushNotifications = new PushNotifications(components.pushNotifications);
    const now = new Date();

    const users = await ctx.db
      .query('users')
      .withIndex('notificationEnabled', (q) => q.eq('notificationEnabled', true))
      .collect();

    for (const user of users) {
      // Skip users without timezone or push token
      if (!user.timezone || !user.expoPushToken) continue;

      // Check if it's 10pm or 8am in the user's timezone
      const userTime = new Date(now.toLocaleString('en-US', { timeZone: user.timezone }));
      const hour = userTime.getHours();

      // Only send notification if it's 8am (8:00) in user's timezone
      if (hour !== 8) continue;

      const userAppVersion = user.appVersion ?? '1.0.0';
      const userMissionFeatureFlagEnabled = compare(
        userAppVersion,
        appVersions.minVersionForMission,
        '>='
      );

      if (!userMissionFeatureFlagEnabled) continue;

      const today = now;
      const todayFormatted = formatDateYYYYMMDD(today, user.timezone);
      const parsedDate = new Date(todayFormatted);
      const dayOfMonth = parsedDate.getDate();

      const notificationHistory = await ctx.db
        .query('notificationHistory')
        .withIndex('by_user_date', (q) => q.eq('userId', user._id).eq('date', todayFormatted))
        .unique();

      if (notificationHistory) continue;

      const challenge = await ctx.db
        .query('dailyChallengesList')
        .filter((q) => q.eq(q.field('day'), dayOfMonth))
        .first();

      if (!challenge) continue;
      if (challenge.challengeType === 'rest') continue;

      const notificationBody = challenge.pushCopy;

      if (notificationBody) {
        pushNotifications.sendPushNotification(ctx, {
          userId: user._id,
          notification: {
            title: 'SweatScore',
            body: notificationBody,
            data: { notificationType: 'dailyMissionNotification' },
          },
        });

        ctx.db.insert('notificationHistory', {
          userId: user._id,
          date: todayFormatted,
          notificationType: 'dailyMissionNotification',
          notificationBody,
        });
      }
    }
  },
});
