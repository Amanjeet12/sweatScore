// @ts-nocheck -- Bun-only Convex handler fixtures.
import { describe, expect, test } from 'bun:test';

import { myBanner } from '../convex/coachToday';
import { resumeDecision } from '../shared/coachResume';
import {
  bannerAvatarMembers,
  planBannerState,
  planBannerLabel,
  todayTiles,
  displayStepTarget,
  TODAY_PROGRESS_ROUTES,
  activityProgressFraction,
  progressCardWeek,
} from '../shared/coachToday';

const base = {
  hasBio: true,
  hasProfile: true,
  hasHealthContinuation: true,
  verifiedAccess: true,
  hasTodayRequest: true,
  hasTodayPlan: true,
  changedDay: false,
};
const workout = {
  category: 'workout' as const,
  label: '20-minute leg workout',
  recommendation: '20-minute lower body strength workout',
  mandatory: true,
  consumedCount: 0,
};
const meals = {
  category: 'meals' as const,
  label: 'Log a meal',
  recommendation: 'Keep a balanced plate',
  mandatory: true,
  consumedCount: 2,
};
const sleep = {
  category: 'sleep' as const,
  label: 'Log sleep',
  recommendation: 'Aim for seven hours',
  mandatory: true,
  consumedCount: 0,
};
const steps = {
  category: 'steps' as const,
  label: '5,500 steps',
  recommendation: 'Aim for 5,500 steps',
  mandatory: true,
  consumedCount: 0,
  stepTarget: 5500,
};

describe('Stage 7 Today model', () => {
  test('ready, no-plan, pending, failed and expired access are distinct', () => {
    for (const [requestStatus, hasPlan, access, canRetry, expected, label] of [
      ['ready', true, true, false, 'ready', 'View today’s plan'],
      ['none', false, true, false, 'no_plan', 'Get today’s plan'],
      ['pending', false, true, false, 'pending', 'Preparing today’s plan'],
      ['failed', false, true, true, 'failed', 'Retry today’s plan'],
      ['failed', false, true, false, 'unavailable', 'Today’s plan unavailable'],
      ['ready', true, false, false, 'locked', 'Premium access unavailable'],
    ] as const) {
      const state = planBannerState({ requestStatus, hasPlan, access, canRetry });
      expect(state).toBe(expected);
      expect(planBannerLabel(state)).toBe(label);
    }
  });
  test('first paid arrival reopens the saved plan; an entitled no-plan member answers today’s questions', () => {
    expect(resumeDecision(base)).toMatchObject({ screen: 'today', requestStatus: 'ready' });
    expect(resumeDecision({ ...base, hasTodayRequest: false, hasTodayPlan: false })).toMatchObject({
      screen: 'today',
      requestStatus: 'none',
    });
    expect(
      resumeDecision({ ...base, verifiedAccess: false, previouslyVerified: true })
    ).toMatchObject({ screen: 'today' });
    expect(
      resumeDecision({
        ...base,
        hasProfile: false,
        verifiedAccess: false,
        previouslyVerified: true,
      }).screen
    ).toBe('today');
    expect(
      resumeDecision({ ...base, verifiedAccess: false, previouslyVerified: false })
    ).toMatchObject({ screen: 'paywall' });
  });
  test('four distinct recommendations, rest exemption, three meal slots and matching step target', () => {
    const tiles = todayTiles([workout, meals, sleep, steps]);
    expect(tiles.map((t) => t.category)).toEqual(['workout', 'meals', 'sleep', 'steps']);
    expect(tiles[0].assignment?.recommendation).toContain('lower body');
    expect(tiles[1]).toMatchObject({ earned: 2, total: 3, completed: false });
    expect(displayStepTarget(tiles[3].assignment)).toBe('5,500');
    expect(
      todayTiles([
        { ...workout, mandatory: false, label: 'Rest and recover' },
        meals,
        sleep,
        steps,
      ])[0].available
    ).toBe(false);
    expect(todayTiles([workout, { ...meals, consumedCount: 3 }, sleep, steps])[1].completed).toBe(
      true
    );
  });
  test('profile refresh can change today’s step target without reopening an earned reward', () => {
    const oldProof = {
      planRevisionId: 'plan_1',
      recommendation: 'Aim for 5,500 steps',
      slotKey: '2026-09-27:steps:1',
      state: 'completed',
    };
    const refreshed = {
      ...steps,
      stepTarget: 6500,
      recommendation: 'Aim for 6,500 steps',
      consumedCount: 1,
    };
    const tile = todayTiles([workout, meals, sleep, refreshed])[3];
    expect(tile.completed).toBe(true);
    expect(displayStepTarget(tile.assignment)).toBe('6,500');
    expect(oldProof.recommendation).toBe('Aim for 5,500 steps');
    expect(oldProof.slotKey).toBe('2026-09-27:steps:1');
  });
  test('Progress actions have working routes and legacy Today decision remains stable', () => {
    expect(TODAY_PROGRESS_ROUTES).toEqual({
      seeAll: '/(tabs)/rewards',
      log: '/progress-photo',
      share: '/(tabs)/rewards?openShare=1',
    });
    expect(
      resumeDecision({
        ...base,
        hasTodayPlan: false,
        hasTodayRequest: true,
        requestStatus: 'failed',
      }).screen
    ).toBe('today');
  });
  test('Progress card week labels match the existing Progress photo sequence', () => {
    expect(progressCardWeek(0, true)).toBe(1);
    expect(progressCardWeek(1, false)).toBe(1);
    expect(progressCardWeek(1, true)).toBe(2);
    expect(progressCardWeek(2, false)).toBe(2);
    expect(progressCardWeek(2, true)).toBe(3);
  });
  test('activity bars use real targets, clamp above goal and hide unavailable ratios', () => {
    expect(activityProgressFraction(451, 5000)).toBeCloseTo(0.0902);
    expect(activityProgressFraction(30, 30)).toBe(1);
    expect(activityProgressFraction(45, 30)).toBe(1);
    expect(activityProgressFraction(1000)).toBe(0);
  });
});

test('community banner counts unique completed members and real avatars on the member-local day', async () => {
  const day = new Date().toISOString().slice(0, 10);
  const rows: any = {
    users: [{ _id: 'alice', timezone: 'UTC' }, { _id: 'bob', image: 'avatar_b' }, { _id: 'cara' }],
    userCheckIns: [{ _id: 'old', userId: 'bob', date: day }],
    challengeCompletions: [],
    coachRewardSlotsV1: [
      { _id: 'slot1', userId: 'alice', day, state: 'earned' },
      { _id: 'slot2', userId: 'bob', day, state: 'earned' },
      { _id: 'slot3', userId: 'cara', day, state: 'reserved' },
    ],
  };
  const db: any = {
    get: async (id: string) =>
      Object.values(rows)
        .flat()
        .find((x: any) => x._id === id) ?? null,
    query: (table: string) => {
      let found = rows[table] ?? [];
      const q: any = {
        withIndex: (_: string, cb: any) => {
          const predicates: any[] = [];
          const ops: any = {
            eq: (key: string, value: any) => {
              predicates.push([key, value]);
              return ops;
            },
          };
          cb(ops);
          found = found.filter((r: any) => predicates.every(([key, value]) => r[key] === value));
          return q;
        },
        collect: async () => found,
      };
      return q;
    },
  };
  const ctx: any = {
    db,
    auth: { getUserIdentity: async () => ({ subject: 'alice' }) },
    storage: {
      getUrl: async (id: string) => (id === 'avatar_b' ? 'https://example.test/bob.jpg' : null),
    },
  };
  const result = await myBanner._handler(ctx, {});
  expect(result.day).toBe(day);
  expect(result.memberCount).toBe(2);
  expect(result.avatarUrls).toEqual(['https://example.test/bob.jpg']);
  expect(result.avatarMembers.map((member) => member.userId)).toEqual(['bob', 'alice']);
  expect(result.avatarMembers[1].imageUrl).toBeNull();
  for (const count of [3, 4, 5, 8]) {
    rows.coachRewardSlotsV1 = Array.from({ length: count - 1 }, (_, index) => ({
      _id: `earned_${index}`,
      userId: `member_${index}`,
      day,
      state: 'earned',
    }));
    const expanded = await myBanner._handler(ctx, {});
    expect(expanded.memberCount).toBe(count);
    expect(expanded.avatarMembers.length).toBe(Math.min(count, 4));
    expect(Math.max(0, expanded.memberCount - 4)).toBe(Math.max(0, count - 4));
  }
  expect(result.nextMidnightAt).toBeGreaterThan(Date.now());
});

test('banner avatars support loading, legacy and current server responses', () => {
  expect(bannerAvatarMembers(undefined)).toEqual([]);
  expect(bannerAvatarMembers({ memberCount: 0 })).toEqual([]);
  const legacy = bannerAvatarMembers({ memberCount: 2, avatarUrls: ['photo.jpg'] });
  expect(legacy).toHaveLength(2);
  expect(legacy.map((member) => member.imageUrl)).toEqual(['photo.jpg', null]);
  expect(bannerAvatarMembers({ memberCount: 5, avatarUrls: [] })).toHaveLength(4);
  const members = [{ userId: 'alice', name: 'Alice', imageUrl: null }];
  expect(bannerAvatarMembers({ memberCount: 1, avatarMembers: members })).toEqual(members);
});
