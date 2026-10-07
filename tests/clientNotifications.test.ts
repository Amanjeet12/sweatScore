// @ts-nocheck -- Bun-only isolated Convex fixtures; no pushes or backend writes.
import { expect, test } from 'bun:test';

import {
  processScheduledNotifications,
  queueClientNotification,
} from '../convex/clientNotifications';
import { sendChallengeNotification } from '../convex/http';
import { updateMonthlyLeaderboard } from '../convex/leaderboard';
import { likePost, createComment, notifyUsersOfAdminPost } from '../convex/posts';
import { canReceivePush, notificationContents } from '../convex/pushNotification';
import {
  commentNotificationPreview,
  localNotificationClock,
} from '../shared/clientPushNotifications';

function fixture(extra = {}) {
  const user = {
    _id: 'member',
    onboarded: true,
    notificationEnabled: true,
    expoPushToken: 'token',
    timezone: 'Asia/Kolkata',
  };
  const rows = {
    users: [user],
    coachBillingEntitlementsV1: [{ _id: 'billing', userId: 'member', status: 'active' }],
    notificationHistory: [],
    ...extra,
  };
  const jobs = [];
  const ctx = {
    auth: { getUserIdentity: async () => ({ subject: 'actor' }) },
    runMutation: async () => {},
    db: {
      get: async (id) =>
        Object.values(rows)
          .flat()
          .find((row) => row._id === id) ?? null,
      insert: async (table, row) => {
        (rows[table] ??= []).push({ _id: `${table}_${rows[table].length}`, ...row });
      },
      patch: async (id, update) => {
        Object.assign(
          Object.values(rows)
            .flat()
            .find((row) => row._id === id),
          update
        );
      },
      query: (table) => {
        let found = rows[table] ?? [];
        const query = {
          withIndex: (_name, callback) => {
            const conditions = [];
            const builder = {};
            for (const op of ['eq', 'gte', 'lt'])
              builder[op] = (key, value) => {
                conditions.push((row) =>
                  op === 'eq'
                    ? row[key] === value
                    : op === 'gte'
                      ? row[key] >= value
                      : row[key] < value
                );
                return builder;
              };
            callback(builder);
            found = found.filter((row) => conditions.every((condition) => condition(row)));
            return query;
          },
          filter: (callback) => {
            const q = {
              field: (key) => key,
              or:
                (...conditions) =>
                (row) =>
                  conditions.some((c) => c(row)),
              eq: (key, val) => (r) => r[key] === val,
              gte: (key, val) => (r) => r[key] >= val,
              lt: (key, val) => (r) => r[key] < val,
              and:
                (...conditions) =>
                (row) =>
                  conditions.every((c) => c(row)),
            };
            found = found.filter(callback(q));
            return query;
          },
          order: () => query,
          first: async () => found[0] ?? null,
          unique: async () => found[0] ?? null,
          collect: async () => found,
          paginate: async ({ cursor, numItems }) => {
            const start = Number(cursor ?? 0);
            return {
              page: found.slice(start, start + numItems),
              isDone: found.length <= start + numItems,
              continueCursor: String(start + numItems),
            };
          },
        };
        return query;
      },
    },
    scheduler: {
      runAfter: async (_delay, _fn, args) => {
        jobs.push(args);
      },
    },
  };
  return { ctx, rows, jobs, user };
}
const run = (f, time) => processScheduledNotifications._handler(f.ctx, { at: Date.parse(time) });

test('local clocks support half-hour, quarter-hour, DST and invalid timezones', () => {
  expect(localNotificationClock(Date.parse('2026-10-07T01:30:00Z'), 'Asia/Kolkata')).toMatchObject({
    hour: 7,
    minute: 0,
    date: '2026-10-07',
  });
  expect(
    localNotificationClock(Date.parse('2026-10-07T01:15:00Z'), 'Asia/Kathmandu')
  ).toMatchObject({ hour: 7, minute: 0 });
  expect(
    localNotificationClock(Date.parse('2026-03-08T11:00:00Z'), 'America/New_York')
  ).toMatchObject({ hour: 7, date: '2026-03-08' });
  expect(localNotificationClock(Date.now(), 'invalid/timezone')).toBeNull();
});

test('7am saved-plan push is sent once; previous-day plans and outside windows do not send', async () => {
  const f = fixture({ coachPlanRevisionsV1: [{ userId: 'member', day: '2026-10-07' }] });
  await run(f, '2026-10-07T01:30:00Z');
  await run(f, '2026-10-07T01:33:00Z');
  expect(f.jobs.map((job) => job.notificationType)).toEqual(['todayPlanReady']);
  const stale = fixture({ coachPlanRevisionsV1: [{ userId: 'member', day: '2026-10-06' }] });
  await run(stale, '2026-10-07T01:30:00Z');
  await run(stale, '2026-10-07T02:30:00Z');
  expect(stale.jobs.map((job) => job.notificationType)).toEqual(['todayPlanQuestions']);
  const pending = fixture({
    coachPlanRequestsV1: [{ userId: 'member', day: '2026-10-07', status: 'pending' }],
  });
  await run(pending, '2026-10-07T01:30:00Z');
  expect(pending.jobs).toEqual([]);
});

test('Monday progress replaces the plan reminder, skips already logged photos, and respects access', async () => {
  const f = fixture({ coachPlanRevisionsV1: [{ userId: 'member', day: '2026-10-12' }] });
  await run(f, '2026-10-12T01:30:00Z');
  expect(f.jobs.map((job) => job.notificationType)).toEqual(['weeklyProgressPhotoDue']);
  const logged = fixture({ progressPhotos: [{ userId: 'member', weekStart: '2026-10-12' }] });
  await run(logged, '2026-10-12T01:30:00Z');
  expect(logged.jobs).toEqual([]);
  f.rows.notificationHistory = [];
  f.rows.coachBillingEntitlementsV1[0].expiresAt = Date.parse('2026-10-11T00:00:00Z');
  f.jobs.length = 0;
  await run(f, '2026-10-12T01:30:00Z');
  expect(f.jobs).toEqual([]);
});

test('challenge reminder uses the actual London start in the member timezone and ignores drafts', async () => {
  const f = fixture({
    challenges: [
      { _id: 'future', isPublished: true, isCommunityChallenge: true, startDate: '2026-10-09' },
      {
        _id: 'already-started',
        isPublished: true,
        isCommunityChallenge: true,
        startDate: '2026-10-08',
      },
      { _id: 'draft', isPublished: false, isCommunityChallenge: true, startDate: '2026-10-09' },
    ],
  });
  f.user.timezone = 'America/New_York';
  await run(f, '2026-10-07T23:00:00Z');
  await run(f, '2026-10-07T23:03:00Z');
  expect(f.jobs).toHaveLength(1);
  expect(f.jobs[0].options.challengeId).toBe('future');
});

test('new-month notification sends once at 7am local time', async () => {
  const f = fixture({ coachBillingEntitlementsV1: [] });
  await run(f, '2026-11-01T01:30:00Z');
  await run(f, '2026-11-01T01:33:00Z');
  expect(f.jobs.map((job) => job.notificationType)).toEqual(['newMonth']);
});

test('disabled, missing-token and unfinished-onboarding members get no scheduled pushes', async () => {
  for (const change of [
    { notificationEnabled: false },
    { expoPushToken: undefined },
    { onboarded: false },
  ]) {
    const f = fixture();
    Object.assign(f.user, change);
    await run(f, '2026-11-01T01:30:00Z');
    expect(f.jobs).toEqual([]);
  }
});

test('like notifications deduplicate per actor/post and delivery rechecks preferences', async () => {
  const f = fixture();
  await queueClientNotification(f.ctx, f.user, 'newPostLiked', '2026-10-07', {}, 'like:post:actor');
  await queueClientNotification(f.ctx, f.user, 'newPostLiked', '2026-10-07', {}, 'like:post:actor');
  expect(f.jobs).toHaveLength(1);
  f.user.commentNotificationEnabled = false;
  expect(
    await canReceivePush._handler(f.ctx, { userId: 'member', notificationType: 'newPostLiked' })
  ).toBe(false);
  f.user.notificationEnabled = false;
  expect(
    await canReceivePush._handler(f.ctx, { userId: 'member', notificationType: 'newMonth' })
  ).toBe(false);
});

test('comment uses the first line and all updated event copy is present', () => {
  expect(commentNotificationPreview('Lovely work!\nSecond line')).toBe('Lovely work!');
  expect(commentNotificationPreview('x'.repeat(300))).toHaveLength(180);
  expect(notificationContents.newCommentPosted.body).toBe('{commentPreview}');
  expect(notificationContents.videoFeedLive.title).toBe('Your video is live 🔥');
  expect(notificationContents.newRewardUnlocked500.title).toBe("You've hit 500 points 🏆");
});

test('actual comment and like triggers send preview and actor names, without self notifications', async () => {
  const f = fixture({ posts: [{ _id: 'post', userId: 'member' }] });
  f.rows.users.push({ _id: 'actor', name: 'Ada' });
  await createComment._handler(f.ctx, { postId: 'post', body: 'Great work!\nMore text' });
  expect(f.jobs[0]).toMatchObject({
    notificationType: 'newCommentPosted',
    options: { userName: 'Ada', commentPreview: 'Great work!', postId: 'post' },
  });
  await likePost._handler(f.ctx, { postId: 'post', likeIcon: 'heart' });
  await likePost._handler(f.ctx, { postId: 'post', likeIcon: 'heart' });
  expect(f.jobs.filter((job) => job.notificationType === 'newPostLiked')).toHaveLength(1);
  f.rows.posts[0].userId = 'actor';
  f.jobs.length = 0;
  await createComment._handler(f.ctx, { postId: 'post', body: 'Own comment' });
  expect(f.jobs).toEqual([]);
});

test('video-live webhook retries do not send twice', async () => {
  const f = fixture({ posts: [{ _id: 'post', userId: 'member' }] });
  await sendChallengeNotification._handler(f.ctx, { userId: 'member', postId: 'post' });
  await sendChallengeNotification._handler(f.ctx, { userId: 'member', postId: 'post' });
  expect(f.jobs).toHaveLength(1);
  expect(f.jobs[0]).toMatchObject({
    notificationType: 'videoFeedLive',
    options: { postId: 'post' },
  });
});

test('admin post skips its author', async () => {
  const f = fixture({ posts: [{ _id: 'post', userId: 'actor' }] });
  Object.assign(f.user, { isPremium: true, appVersion: '1.0.20' });
  f.rows.users.push({ ...f.user, _id: 'actor', isAdmin: true });
  await notifyUsersOfAdminPost._handler(f.ctx, { adminUserId: 'actor', postId: 'post' });
  await notifyUsersOfAdminPost._handler(f.ctx, { adminUserId: 'actor', postId: 'post' });
  expect(f.jobs).toHaveLength(1);
  expect(f.jobs[0]).toMatchObject({ userId: ['member'], notificationType: 'newAdminPost' });
});

test('monthly 500-point award sends once, even after recomputation and retry', async () => {
  const f = fixture({
    dailyActivities: [
      {
        _id: 'activity',
        userId: 'member',
        date: '2026-10-07',
        synced: true,
        steps: 0,
        zone2Minutes: 0,
        displayTotalPoints: 500,
      },
    ],
  });
  await updateMonthlyLeaderboard._handler(f.ctx, { userId: 'member', yearMonth: '2026-10' });
  await updateMonthlyLeaderboard._handler(f.ctx, { userId: 'member', yearMonth: '2026-10' });
  expect(f.jobs.filter((job) => job.notificationType === 'newRewardUnlocked500')).toHaveLength(1);
});

test('scheduled recipients paginate without losing the original local-time window', async () => {
  const f = fixture({ coachBillingEntitlementsV1: [] });
  f.rows.users = Array.from({ length: 51 }, (_, i) => ({
    ...f.user,
    _id: `member-${i}`,
    timezone: 'UTC',
  }));
  const at = Date.parse('2026-11-01T07:00:00Z');
  await processScheduledNotifications._handler(f.ctx, { at });
  const next = f.jobs.find((job) => job.cursor);
  expect(next).toMatchObject({ cursor: '50', at });
  await processScheduledNotifications._handler(f.ctx, next);
  expect(f.jobs.filter((job) => job.notificationType === 'newMonth')).toHaveLength(51);
});
