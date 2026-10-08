// @ts-nocheck -- Isolated sender fixtures; no real pushes or accounts.
import { expect, mock, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import {
  clientNotificationContents,
  isClientNotificationType,
} from '../shared/clientPushNotifications';
let deliveries = [];
mock.module('@convex-dev/expo-push-notifications', () => ({
  PushNotifications: class {
    async sendPushNotification(_ctx, payload) {
      deliveries.push(payload);
    }
  },
}));
const { sendPushNotification, sendMarketingPushNotification, canReceivePush } =
  await import('../convex/pushNotification');
const {
  processNotifications,
  processDailyMissionNotifications,
  processRewardNotifications,
  processScheduledCheckInNotification,
} = await import('../convex/notifications');
const { sendTrialReminder } = await import('../convex/revenueCatEntitlements');
const { sendChatMessagePush, queueChatMessagePush, queueChatReactionPush } =
  await import('../convex/chat/notifications');
const legacy = [
  'newActivitySubmitted',
  'newActivityApproved',
  'newActivityRejected',
  'newRewardClaimed',
  'newRewardUnlocked250',
  'newRewardUnlocked100',
  'noActivityReminder',
  'challengePostLive',
  'dailyCheckInLive',
  'dailyCheckInReminder',
  'marketing',
  'trialReminder',
  'newChatMessage',
  'engagementNotification',
  'dailyMissionNotification',
];
const untouched = new Proxy(
  {},
  {
    get() {
      throw Error('Legacy notification must return before any database or network operation');
    },
  }
);

test('allowlist contains only the nine client triggers and approved questions reminder', () => {
  expect(Object.keys(clientNotificationContents).sort()).toEqual(
    [
      'videoFeedLive',
      'newCommentPosted',
      'newPostLiked',
      'newAdminPost',
      'todayPlanReady',
      'todayPlanQuestions',
      'challengeStartsTomorrow',
      'weeklyProgressPhotoDue',
      'newRewardUnlocked500',
      'newMonth',
    ].sort()
  );
  for (const type of legacy) expect(isClientNotificationType(type)).toBe(false);
  expect(isClientNotificationType('toString')).toBe(false);
});

test('queued legacy central-sender jobs are suppressed before any lookup or delivery', async () => {
  for (const type of legacy) {
    await sendPushNotification._handler(untouched, { userId: ['member'], notificationType: type });
    expect(
      await canReceivePush._handler(untouched, { userId: 'member', notificationType: type })
    ).toBe(false);
  }
  expect(deliveries).toHaveLength(0);
});

test('all approved types still deliver and recheck the current member preference', async () => {
  deliveries = [];
  let checks = 0;
  for (const type of Object.keys(clientNotificationContents))
    await sendPushNotification._handler(
      {
        runQuery: async () => {
          checks++;
          return true;
        },
      },
      {
        userId: ['member'],
        notificationType: type,
        options: { userName: 'Sandy', commentPreview: 'Nice work' },
      }
    );
  expect(checks).toBe(10);
  expect(deliveries).toHaveLength(10);
  expect(deliveries.map((row) => row.notification.data.notificationType).sort()).toEqual(
    Object.keys(clientNotificationContents).sort()
  );
  const before = deliveries.length;
  await sendPushNotification._handler(
    { runQuery: async () => false },
    { userId: ['member'], notificationType: 'todayPlanReady' }
  );
  expect(deliveries).toHaveLength(before);
});

test('old mission, engagement, reward, trial, marketing and shared-check-in endpoints do not dispatch', async () => {
  deliveries = [];
  for (const fn of [
    processNotifications,
    processDailyMissionNotifications,
    processRewardNotifications,
  ])
    await fn._handler(untouched, {});
  await sendTrialReminder._handler(untouched, { userId: 'member', expiresAt: 1 });
  await sendMarketingPushNotification._handler(untouched, {
    userId: 'member',
    title: 'Old campaign',
    body: 'Old body',
  });
  expect(
    (
      await processScheduledCheckInNotification._handler(untouched, {
        challengeId: 'challenge',
        expectedStartAt: 1,
        expectedEndAt: 2,
        notificationType: 'dailyCheckInLive',
      })
    ).sent
  ).toBe(0);
  expect(deliveries).toHaveLength(0);
});

test('queued chat events and direct chat sender do not dispatch', async () => {
  expect(await queueChatMessagePush._handler(untouched, {})).toEqual({ queued: 0 });
  expect(await queueChatReactionPush._handler(untouched, {})).toEqual({ queued: 0 });
  expect(await sendChatMessagePush._handler(untouched, {})).toEqual({ sent: 0 });
});

test('legacy push crons and producer references have been removed', () => {
  const crons = readFileSync('convex/crons.ts', 'utf8');
  expect(crons).toContain('Send Client Trigger Notifications');
  for (const name of [
    'Send Engagement Notifications',
    'Send Daily Mission Notifications',
    'Send Reward Notifications',
  ])
    expect(crons).not.toContain(name);
  for (const file of [
    'convex/activities.ts',
    'convex/claimedRewards.ts',
    'convex/admin.ts',
    'convex/revenueCatEntitlements.ts',
    'convex/chat/messages.ts',
  ]) {
    const text = readFileSync(file, 'utf8');
    for (const type of [
      'newActivitySubmitted',
      'newActivityApproved',
      'newActivityRejected',
      'newRewardClaimed',
      'dailyCheckInLive',
      'dailyCheckInReminder',
    ])
      expect(text).not.toContain(`notificationType: '${type}'`);
  }
});
