// @ts-nocheck -- Bun-only migration dry-run fixtures.
import { expect, test } from 'bun:test';
import { reconcileLegacyRewards, LegacyRewardSource } from '../shared/coachLegacyMigration';
import {
  setCurrentDailyChallenge,
  setNextDailyChallenge,
  removeDailyChallengeSchedule,
  maintainRollingDailyCheckIns,
} from '../convex/admin';
import { processScheduledCheckInNotification } from '../convex/notifications';
import { sendPushNotification } from '../convex/pushNotification';
import { shouldSuppressPush } from '../convex/legacySchedulerCutover';

const source = (id: string, activityKey: string, createdAt = 1): LegacyRewardSource => ({
  table: 'dailyActivities',
  id,
  userId: 'member-a',
  day: '2026-09-27',
  points: 2,
  createdAt,
  activityKey,
});

test('dry-run proposes stable slots without rewriting source points or making a second reward', () => {
  const rows = [
    source('meal-2', 'healthy_meal', 2),
    source('meal-1', 'healthy_meal'),
    source('meal-3', 'healthy_meal', 3),
    source('meal-4', 'healthy_meal', 4),
  ];
  const first = reconcileLegacyRewards(rows, []);
  expect(first.map((x) => x.disposition)).toEqual([
    'candidate',
    'candidate',
    'candidate',
    'review',
  ]);
  expect(new Set(first.flatMap((x) => (x.slotKey ? [x.slotKey] : []))).size).toBe(3);
  expect(first.map((x) => x.originalPoints)).toEqual([2, 2, 2, 2]);
  expect(reconcileLegacyRewards(rows, [])).toEqual(first);
  const rerun = reconcileLegacyRewards(
    rows,
    first
      .filter((x) => x.slotKey)
      .map((x) => ({
        userId: 'member-a',
        key: x.slotKey!,
        state: 'legacy_consumed',
        legacySourceKey: x.sourceKey,
      }))
  );
  expect(rerun.filter((x) => x.disposition === 'candidate')).toHaveLength(0);
});

test('hydration and unapproved custom check-ins never become workout proof', () => {
  const custom: LegacyRewardSource = {
    table: 'challengeCompletions',
    id: 'completion',
    userId: 'member-a',
    day: '2026-09-27',
    points: 5,
    createdAt: 3,
    challengeType: 'check_in',
    categoryId: 'jump-rope',
  };
  const rows = reconcileLegacyRewards([source('water', 'hydration'), custom], []);
  expect(rows.every((x) => x.disposition === 'review')).toBe(true);
  expect(reconcileLegacyRewards([custom], [], { 'jump-rope': 'workout' })[0].slotKey).toBe(
    '2026-09-27:workout:1'
  );
});

test('existing plan slot, deleted completion and other members retain their separate context', () => {
  const old = source('workout', 'gym_workout');
  const removed: LegacyRewardSource = {
    ...old,
    table: 'challengeCompletions',
    id: 'removed',
    challengeType: 'check_in',
    categoryId: 'approved',
    removed: true,
    createdAt: 2,
  };
  const other = { ...old, id: 'other', userId: 'member-b' };
  const entries = reconcileLegacyRewards(
    [old, removed, other],
    [{ userId: 'member-a', key: '2026-09-27:workout:1', state: 'earned' }],
    { approved: 'workout' }
  );
  expect(entries.find((x) => x.sourceKey === 'dailyActivities:workout')?.disposition).toBe(
    'review'
  );
  expect(entries.find((x) => x.sourceKey === 'challengeCompletions:removed')?.reason).toContain(
    'Daily category slots'
  );
  expect(entries.find((x) => x.sourceKey === 'dailyActivities:other')?.slotKey).toBe(
    '2026-09-27:workout:1'
  );
});

test('retired direct scheduling calls and queued callbacks cannot write or notify', async () => {
  const before = process.env.LEGACY_CHECKIN_SCHEDULER_RETIRED;
  process.env.LEGACY_CHECKIN_SCHEDULER_RETIRED = 'true';
  try {
    const ctx = {
      db: {
        patch: () => {
          throw new Error('unexpected write');
        },
      },
      scheduler: {
        runAt: () => {
          throw new Error('unexpected job');
        },
      },
    } as any;
    await expect(
      setCurrentDailyChallenge._handler(ctx, { challengeId: 'old', shortDescription: 'old' })
    ).rejects.toThrow('retired');
    await expect(
      setNextDailyChallenge._handler(ctx, { challengeId: 'old', shortDescription: 'old' })
    ).rejects.toThrow('retired');
    await expect(
      removeDailyChallengeSchedule._handler(ctx, { challengeId: 'old' })
    ).rejects.toThrow('retired');
    expect(await maintainRollingDailyCheckIns._handler(ctx, {})).toEqual({ status: 'retired' });
    expect(
      await processScheduledCheckInNotification._handler(ctx, {
        challengeId: 'old',
        expectedStartAt: 1,
        expectedEndAt: 2,
        notificationType: 'dailyCheckInLive',
      })
    ).toEqual({ success: false, sent: 0, reason: 'Shared check-in scheduling retired' });
    expect(
      await sendPushNotification._handler(ctx, {
        userId: [],
        notificationType: 'dailyCheckInReminder',
      })
    ).toBeUndefined();
    expect(shouldSuppressPush(true, 'newAdminPost')).toBe(false);
    expect(shouldSuppressPush(true, 'dailyCheckInLive')).toBe(true);
  } finally {
    if (before === undefined) delete process.env.LEGACY_CHECKIN_SCHEDULER_RETIRED;
    else process.env.LEGACY_CHECKIN_SCHEDULER_RETIRED = before;
  }
});

test('retirement retains only client-list push scheduling and unrelated data jobs', () => {
  const result = Bun.spawnSync({
    cmd: [
      'bun',
      '-e',
      'import crons from "./convex/crons"; console.log(Object.keys(crons.crons).join("|"))',
    ],
    cwd: process.cwd(),
    env: { ...process.env, LEGACY_CHECKIN_SCHEDULER_RETIRED: 'true' },
  });
  expect(result.exitCode).toBe(0);
  const names = new TextDecoder().decode(result.stdout);
  expect(names).not.toContain('Maintain Rolling Daily Check-Ins');
  expect(names).not.toContain('Send Engagement Notifications');
  expect(names).toContain('Send Client Trigger Notifications');
  expect(names).not.toContain('Send Daily Mission Notifications');
  expect(names).toContain('Update Monthly Leaderboard For All Users');
  expect(names).toContain('Upgrade User To Premium');
});
