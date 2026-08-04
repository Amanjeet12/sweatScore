import { PushNotifications } from '@convex-dev/expo-push-notifications';
import { compare } from 'compare-versions';
import { v } from 'convex/values';

import { components, internal } from './_generated/api';
import { internalMutation } from './_generated/server';
import { appVersions } from './appVersions';
import { MailerLiteGroup } from './mailerlite';
import { Id } from './_generated/dataModel';

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

  handler: async (ctx): Promise<void> => {
    const pushNotifications = new PushNotifications(components.pushNotifications);

    const now = new Date();

    const users = await ctx.db
      .query('users')
      .withIndex('notificationEnabled', (q) => q.eq('notificationEnabled', true))
      .collect();

    for (const user of users) {
      /*
       * Skip users who cannot receive notifications.
       */
      if (!user.timezone || !user.expoPushToken) {
        continue;
      }

      /*
       * Determine the current hour in the user's timezone.
       */
      const userTime = new Date(
        now.toLocaleString('en-US', {
          timeZone: user.timezone,
        })
      );

      const hour = userTime.getHours();

      /*
       * This legacy notification flow only runs
       * at 8:00 AM or 10:00 PM in the user's timezone.
       */
      if (hour !== 8 && hour !== 22) {
        continue;
      }

      /*
       * Users on the newer mission-enabled app version
       * are handled by the newer notification flow.
       */
      const userAppVersion = user.appVersion ?? '1.0.0';

      const userMissionFeatureFlagEnabled = compare(
        userAppVersion,
        appVersions.minVersionForMission,
        '>='
      );

      if (userMissionFeatureFlagEnabled) {
        continue;
      }

      const todayFormatted = formatDateYYYYMMDD(now, user.timezone);

      /*
       * Prevent multiple engagement notifications
       * from being sent to the same user on the same day.
       *
       * Use first() instead of unique() because there may
       * already be multiple notification-history records
       * for the same user and date.
       */
      const notificationHistory = await ctx.db
        .query('notificationHistory')
        .withIndex('by_user_date', (q) => q.eq('userId', user._id).eq('date', todayFormatted))
        .first();

      if (notificationHistory) {
        continue;
      }

      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);

      const yesterdayFormatted = formatDateYYYYMMDD(yesterday, user.timezone);

      /*
       * Use the user's local date for the leaderboard month.
       */
      const yearMonth = todayFormatted.slice(0, 7);

      let notificationBody: string | null = null;

      const firstName = user.name?.trim().split(/\s+/)[0] || 'Sis';

      const lastActiveAt = user.lastActiveAt ? new Date(user.lastActiveAt) : null;

      if (!lastActiveAt) {
        continue;
      }

      const daysLastActive = getDaysBetweenDates(now, lastActiveAt);

      /*
       * Compare formatted dates in the user's timezone.
       * Using toDateString() here could produce incorrect
       * results when the server and user have different
       * timezones.
       */
      const lastActiveDateFormatted = formatDateYYYYMMDD(lastActiveAt, user.timezone);

      const openedAppToday = lastActiveDateFormatted === todayFormatted;

      if (openedAppToday) {
        /*
         * Do not send the opened-app notification at 8 AM.
         */
        if (hour === 8) {
          continue;
        }

        const userOnStreak = await ctx.db
          .query('userCheckIns')
          .withIndex('by_user_date', (q) => q.eq('userId', user._id).eq('date', yesterdayFormatted))
          .first();

        if (userOnStreak) {
          const tenDaysAgo = new Date(now);
          tenDaysAgo.setDate(now.getDate() - 10);

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

          const checkedInDates = new Set(checkIns.map((checkIn) => checkIn.date));

          if (!checkedInDates.has(yesterdayFormatted)) {
            continue;
          }

          /*
           * Yesterday is the first day of the streak.
           */
          let streak = 1;
          const currentDate = new Date(yesterday);

          while (currentDate > tenDaysAgo) {
            currentDate.setDate(currentDate.getDate() - 1);

            const dateStr = formatDateYYYYMMDD(currentDate, user.timezone);

            if (checkedInDates.has(dateStr)) {
              streak += 1;
            } else {
              break;
            }
          }

          if (streak === 3) {
            notificationBody =
              `${streak} days in a row. ` + `you're on a streak 🔥 Keep showing up your way.`;
          } else if (streak === 5) {
            notificationBody =
              `Consistency is a flex — and you're on a ` +
              `${streak} day streak 🔥 Keep showing up your way.`;
          }
        } else {
          const userEntry = await ctx.db
            .query('monthlyLeaderboard')
            .withIndex('by_user_and_year_month', (q) =>
              q.eq('userId', user._id).eq('yearMonth', yearMonth)
            )
            .unique();

          if (userEntry?.displayTotalPoints && userEntry.displayTotalPoints > 1) {
            notificationBody =
              `You're on ${userEntry.displayTotalPoints} ` +
              `Sweat Points so far 💜 Let's see what you ` +
              `can finish the month with.`;
          }
        }
      } else {
        /*
         * When the user has not opened the app today,
         * only send this flow at 8 AM.
         */
        if (hour === 22) {
          continue;
        }

        if (daysLastActive === 1) {
          /*
           * Check whether this user has already completed
           * today's check-in.
           *
           * If the record exists, do not send the
           * "check in before today ends" reminder.
           */
          const userCompletedCheckInToday = await ctx.db
            .query('userCheckIns')
            .withIndex('by_user_date', (q) => q.eq('userId', user._id).eq('date', todayFormatted))
            .first();

          if (userCompletedCheckInToday) {
            continue;
          }

          /*
           * Count how many users have checked in today.
           * This count is only used in the reminder copy.
           */
          const totalCheckIns = await ctx.db
            .query('userCheckIns')
            .withIndex('by_date', (q) => q.eq('date', todayFormatted))
            .collect();

          const totalCheckInsCount = totalCheckIns.length;

          if (totalCheckInsCount > 0) {
            notificationBody =
              `${totalCheckInsCount} Sweat Sisters already ` +
              `checked in today. Don't miss your point — ` +
              `check in before today ends!`;
          } else {
            notificationBody =
              `${firstName}! Be the first Sweat Sister to ` +
              `check in today. Don't miss your point — ` +
              `check in before today ends!`;
          }
        } else if (daysLastActive >= 3 && daysLastActive < 10) {
          notificationBody =
            `We miss your name popping up ${firstName} 👀 ` +
            `Last log was ${daysLastActive} days ago — just sayin.`;
        } else if (daysLastActive > 10) {
          notificationBody =
            `Still on our minds ${firstName} 💭 ` +
            `Let's call it a reset and start fresh tomorrow?`;
        }
      }

      if (!notificationBody) {
        continue;
      }

      await pushNotifications.sendPushNotification(ctx, {
        userId: user._id,

        notification: {
          title: 'SweatScore',
          body: notificationBody,

          data: {
            notificationType: 'engagementNotification',
          },
        },
      });

      await ctx.db.insert('notificationHistory', {
        userId: user._id,
        date: todayFormatted,
        notificationType: 'engagementNotification',
        notificationBody,
      });
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

export const processScheduledCheckInNotification = internalMutation({
  args: {
    challengeId: v.id('challenges'),
    expectedStartAt: v.number(),
    expectedEndAt: v.number(),

    notificationType: v.union(v.literal('dailyCheckInLive'), v.literal('dailyCheckInReminder')),
  },

  handler: async (ctx, args) => {
    const challenge = await ctx.db.get(args.challengeId);

    if (!challenge) {
      return {
        success: false,
        sent: 0,
        reason: 'Challenge not found',
      };
    }

    /*
     * Only check-in challenges should send these
     * two notifications.
     */
    if (challenge.type !== 'check_in') {
      return {
        success: false,
        sent: 0,
        reason: 'Challenge is not a check-in',
      };
    }

    const now = Date.now();

    /*
     * Check that the scheduled challenge has not been
     * removed, replaced or rescheduled.
     */
    const isStillActive =
      challenge.isPublished === true &&
      challenge.isDailyChallenge === true &&
      challenge.dailyStartAt === args.expectedStartAt &&
      challenge.dailyEndAt === args.expectedEndAt &&
      args.expectedStartAt <= now &&
      args.expectedEndAt > now;

    if (!isStillActive) {
      return {
        success: false,
        sent: 0,
        reason: 'Check-in is no longer active',
      };
    }

    /*
     * Prevent duplicate notifications when the same
     * challenge is scheduled more than once.
     */
    const dispatchKey = [
      'checkInNotification',
      args.notificationType,
      challenge._id,
      args.expectedStartAt,
      args.expectedEndAt,
    ].join(':');

    const existingDispatch = await ctx.db
      .query('appConfig')
      .withIndex('by_key', (q) => q.eq('key', dispatchKey))
      .unique();

    if (existingDispatch) {
      return {
        success: true,
        sent: 0,
        reason: 'Notification already sent',
      };
    }

    const users = await ctx.db
      .query('users')
      .withIndex('notificationEnabled', (q) => q.eq('notificationEnabled', true))
      .collect();

    const recipientIds: Id<'users'>[] = [];

    for (const user of users) {
      if (user.onboarded !== true || !user.expoPushToken) {
        continue;
      }

      /*
       * The live notification should go to every eligible user.
       *
       * The reminder should only go to users who have not
       * completed this exact daily check-in window.
       */
      if (args.notificationType === 'dailyCheckInReminder') {
        const existingCompletion = await ctx.db
          .query('challengeCompletions')
          .withIndex('by_user_challenge_window', (q) =>
            q
              .eq('userId', user._id)
              .eq('challengeId', challenge._id)
              .eq('dailyWindowStartAt', args.expectedStartAt)
          )
          .filter((q) => q.neq(q.field('removed'), true))
          .first();

        if (existingCompletion) {
          continue;
        }
      }

      recipientIds.push(user._id);
    }
    /*
     * Save before scheduling the push batches so duplicate
     * scheduled jobs cannot send the notification twice.
     */
    await ctx.db.insert('appConfig', {
      key: dispatchKey,
      value: String(now),
    });

    const batchSize = 100;

    for (let index = 0; index < recipientIds.length; index += batchSize) {
      const userBatch = recipientIds.slice(index, index + batchSize);

      await ctx.scheduler.runAfter(0, internal.pushNotification.sendPushNotification, {
        userId: userBatch,
        notificationType: args.notificationType,
        options: {
          challengeId: challenge._id,
        },
      });
    }

    return {
      success: true,
      sent: recipientIds.length,
    };
  },
});
