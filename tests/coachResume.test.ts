// @ts-nocheck -- Bun-only Convex handler fixtures.
import { describe, expect, test } from 'bun:test';

import { DAILY_PLAN_PROMPT_VERSION } from '../convex/coachDailyPrompt';
import {
  continueAfterHealth,
  finishDailyAndReserveFirst,
  saveDailyDraft,
  finishProfile,
  finishCoachSetup,
  beginReturningPlanSetup,
} from '../convex/coachFoundation';
import { myDecision } from '../convex/coachResume';
import { myPlan } from '../convex/revenueCatEntitlements';
import { updateLastActiveAt, updateOnboarded } from '../convex/users';
import { resumeDecision } from '../shared/coachResume';

const day = new Date().toISOString().slice(0, 10);
const base = {
  hasBio: true,
  hasProfile: true,
  hasHealthContinuation: true,
  verifiedAccess: false,
  hasTodayRequest: false,
  hasTodayPlan: false,
  changedDay: false,
};

function fixture(seed: Record<string, any[]> = {}) {
  const rows: Record<string, any[]> = structuredClone({
    users: [{ _id: 'member_a', name: 'Sandy', birthdate: 500000000000, timezone: 'UTC' }],
    ...seed,
  });
  const writes: any[] = [];
  const scheduled: any[] = [];
  let next = 0;
  const db = {
    get: async (id: string) =>
      Object.values(rows)
        .flat()
        .find((row: any) => row._id === id) ?? null,
    insert: async (table: string, value: any) => {
      const id = `${table}_${++next}`;
      (rows[table] ??= []).push({ _id: id, ...value });
      writes.push({ table, value });
      return id;
    },
    patch: async (id: string, value: any) => {
      const row = Object.values(rows)
        .flat()
        .find((item: any) => item._id === id);
      if (!row) throw new Error('Missing fixture row');
      Object.assign(row, value);
      writes.push({ table: 'patch', value });
    },
    query: (table: string) => {
      let found = [...(rows[table] ?? [])];
      const chain: any = {
        withIndex: (_index: string, callback?: (q: any) => any) => {
          if (callback) {
            const clauses: any[] = [];
            const q: any = {};
            for (const op of ['eq', 'gte', 'lt'])
              q[op] = (field: string, value: any) => {
                clauses.push([op, field, value]);
                return q;
              };
            callback(q);
            found = found.filter((row) =>
              clauses.every(([op, field, value]) =>
                op === 'eq'
                  ? row[field] === value
                  : op === 'gte'
                    ? row[field] >= value
                    : row[field] < value
              )
            );
          }
          return chain;
        },
        order: (direction: string) => {
          if (direction === 'desc') found.reverse();
          return chain;
        },
        first: async () => found[0] ?? null,
        unique: async () => {
          if (found.length > 1) throw new Error('Not unique');
          return found[0] ?? null;
        },
        collect: async () => found,
      };
      return chain;
    },
  };
  const ctx: any = {
    db,
    auth: { getUserIdentity: async () => ({ subject: 'member_a' }) },
    scheduler: {
      runAfter: async (...args: any[]) => {
        scheduled.push(args);
      },
    },
    runMutation: async () => {
      throw new Error('Unexpected side effect');
    },
  };
  return { ctx, rows, writes, scheduled };
}

const profile = {
  goal: 'lose',
  bodyFeeling: 'feel_good',
  routineFeeling: 'working_keep_going',
  foodRelationship: 'balanced_most_days',
  usualSleep: 'regular_restful',
  biggestChallenge: 'time',
};
const draft = {
  sleep: 'rested_enough',
  energy: 'steady',
  mood: 'good',
  upFor: 'short_session',
};

describe('Stage 4 persisted resume', () => {
  test('redeemed new Premium member completes bio, profile, health and setup independently of billing', async () => {
    const store = fixture({
      users: [{ _id: 'member_a', timezone: 'UTC', isPremium: true }],
      coachBillingEntitlementsV1: [{ _id: 'bill', userId: 'member_a', status: 'active' }],
    });
    expect(await myDecision._handler(store.ctx, {})).toMatchObject({
      screen: 'bio',
      verifiedAccess: true,
      returningMember: false,
    });
    Object.assign(store.rows.users[0], { name: 'New member', birthdate: 500000000000 });
    expect((await myDecision._handler(store.ctx, {})).screen).toBe('profile');
    await expect(beginReturningPlanSetup._handler(store.ctx, {})).rejects.toThrow(
      'Complete onboarding first'
    );
    store.rows.coachOnboardingV1 = [
      {
        _id: 'onboarding',
        userId: 'member_a',
        stage: 'profile',
        profileDraft: { weight: { value: 70, unit: 'kg' }, goal: 'lose' },
      },
    ];
    expect(await myDecision._handler(store.ctx, {})).toMatchObject({
      screen: 'profile',
      question: 2,
      verifiedAccess: true,
    });
    Object.assign(store.rows.coachOnboardingV1[0].profileDraft, {
      bodyFeeling: 'feel_good',
      routineFeeling: 'working_keep_going',
      foodRelationship: 'balanced_most_days',
      usualSleep: 'regular_restful',
      biggestChallenge: 'time',
    });
    await finishProfile._handler(store.ctx, {});
    expect(store.rows.coachOnboardingV1[0].healthContinuation).toBeUndefined();
    expect((await myDecision._handler(store.ctx, {})).screen).toBe('health');
    await continueAfterHealth._handler(store.ctx, { result: 'declined' });
    expect((await myDecision._handler(store.ctx, {})).screen).toBe('setup');
    // Reloading uses persisted setup state rather than returning to the first step.
    expect((await myDecision._handler(store.ctx, {})).screen).toBe('setup');
    await finishCoachSetup._handler(store.ctx, {});
    expect(await myDecision._handler(store.ctx, {})).toMatchObject({
      screen: 'today',
      verifiedAccess: true,
      completedOnboarding: true,
    });
    expect(store.rows.coachBillingEntitlementsV1[0].status).toBe('active');
    expect(store.rows.users[0].isPremium).toBe(true);
  });

  test('completed legacy Premium members bypass new Coach fields; new free members retain onboarding', async () => {
    const legacy = fixture({ users: [{ _id: 'member_a', onboarded: true, isPremium: true }] });
    expect(await myDecision._handler(legacy.ctx, {})).toMatchObject({
      screen: 'today',
      verifiedAccess: true,
    });
    const free = fixture();
    expect(await myDecision._handler(free.ctx, {})).toMatchObject({
      screen: 'profile',
      verifiedAccess: false,
    });
  });
  test('returning login gates purchase before missing profile fields', () => {
    const returning = { ...base, returningMember: true, hasBio: false, hasProfile: false };
    expect(resumeDecision(returning).screen).toBe('paywall');
    expect(resumeDecision({ ...returning, verifiedAccess: true }).screen).toBe('today');
  });

  test('admin without a purchase or onboarding profile goes directly to Today', async () => {
    const store = fixture({
      users: [{ _id: 'member_a', timezone: 'UTC', isAdmin: true }],
    });
    expect(await myDecision._handler(store.ctx, {})).toMatchObject({
      screen: 'today',
      verifiedAccess: true,
      returningMember: true,
    });
  });

  test('new member follows bio, profile, health, paywall, then Today after verification', () => {
    expect(resumeDecision({ ...base, hasBio: false }).screen).toBe('bio');
    const profileState = resumeDecision({
      ...base,
      hasProfile: false,
      profileDraft: { weight: { value: 70, unit: 'kg' }, goal: 'lose' },
    });
    expect(profileState).toMatchObject({ screen: 'profile', question: 2 });
    expect(resumeDecision({ ...base, hasHealthContinuation: false }).screen).toBe('health');
    expect(resumeDecision({ ...base, setupPending: true })).toMatchObject({ screen: 'paywall' });
    expect(resumeDecision({ ...base, dailyDraft: draft })).toMatchObject({
      screen: 'paywall',
      question: 0,
    });
    expect(resumeDecision({ ...base, verifiedAccess: true, dailyDraft: draft })).toMatchObject({
      screen: 'today',
      // Training yesterday is now the first unanswered daily question.
      question: 3,
    });
    expect(
      resumeDecision({ ...base, hasTodayRequest: true, requestStatus: 'pending' })
    ).toMatchObject({ screen: 'paywall', requestStatus: 'pending' });
  });

  test('denied health continues, existing entitled profile setup skips another paywall', () => {
    expect(resumeDecision({ ...base, hasHealthContinuation: true }).screen).toBe('paywall');
    expect(resumeDecision({ ...base, verifiedAccess: true, hasProfile: false }).screen).toBe(
      'profile'
    );
    expect(
      resumeDecision({ ...base, verifiedAccess: true, hasHealthContinuation: false }).screen
    ).toBe('health');
    expect(
      resumeDecision({
        ...base,
        verifiedAccess: true,
        hasTodayRequest: true,
        requestStatus: 'ready',
      }).screen
    ).toBe('today');
  });

  test('pending, ready and failed purchases all reach Today only after verified access', () => {
    for (const status of ['pending', 'ready', 'failed'] as const) {
      expect(resumeDecision({ ...base, hasTodayRequest: true, requestStatus: status }).screen).toBe(
        'paywall'
      );
      expect(
        resumeDecision({
          ...base,
          verifiedAccess: true,
          hasTodayRequest: true,
          requestStatus: status,
        })
      ).toMatchObject({ screen: 'today', requestStatus: status });
    }
  });

  test('cancellation, restart and delayed verification reuse the same purchase stage', () => {
    const persisted = { ...base };
    expect(resumeDecision(persisted).screen).toBe('paywall');
    expect(resumeDecision({ ...persisted }).screen).toBe('paywall');
    expect(resumeDecision({ ...persisted, verifiedAccess: true }).screen).toBe('today');
  });

  test('member-local day change preserves old plan and resumes fresh daily answers', () => {
    expect(
      resumeDecision({
        ...base,
        verifiedAccess: true,
        changedDay: true,
        dailyDraft: { sleep: 'restful' },
      })
    ).toMatchObject({ screen: 'today', question: 1, changedDay: true, requestStatus: 'none' });
    expect(
      resumeDecision({ ...base, verifiedAccess: true, changedDay: true, completedOnboarding: true })
        .screen
    ).toBe('today');
  });

  test('completed legacy premium member reaches Today while initial billing is absent', async () => {
    const store = fixture({
      users: [
        {
          _id: 'member_a',
          name: 'Sandy',
          birthdate: 500000000000,
          timezone: 'UTC',
          onboarded: true,
          isPremium: true,
        },
      ],
    });
    expect(await myDecision._handler(store.ctx, {})).toMatchObject({
      screen: 'today',
      verifiedAccess: true,
      returningMember: true,
    });
    expect((await myPlan._handler(store.ctx, {})).access).toBe(true);
    expect(store.writes).toHaveLength(0);
    expect(store.scheduled).toHaveLength(0);
    for (const billing of [
      { status: 'inactive' },
      { status: 'active', expiresAt: Date.now() - 1000 },
    ]) {
      store.rows.coachBillingEntitlementsV1 = [{ _id: 'billing', userId: 'member_a', ...billing }];
      expect(await myDecision._handler(store.ctx, {})).toMatchObject({
        screen: 'paywall',
        verifiedAccess: false,
      });
      expect((await myPlan._handler(store.ctx, {})).access).toBe(false);
    }
  });

  test('legacy completed-account flag routes unpaid returning members to the paywall', async () => {
    const store = fixture({
      users: [
        {
          _id: 'member_a',
          name: 'Sandy',
          birthdate: 500000000000,
          timezone: 'UTC',
          onboarded: true,
        },
      ],
    });
    expect(await myDecision._handler(store.ctx, {})).toMatchObject({
      screen: 'paywall',
      verifiedAccess: false,
      returningMember: true,
    });
    store.rows.coachOnboardingV1 = [
      {
        _id: 'state',
        userId: 'member_a',
        profileRevisionId: 'profile',
        healthContinuation: 'declined',
        dailyDraftDay: day,
        dailyDraft: draft,
      },
    ];
    expect((await myDecision._handler(store.ctx, {})).verifiedAccess).toBe(false);
    store.rows.coachPlanRequestsV1 = [{ _id: 'request', userId: 'member_a', day, status: 'ready' }];
    expect((await myDecision._handler(store.ctx, {})).verifiedAccess).toBe(false);
    store.rows.coachBillingEntitlementsV1 = [
      { _id: 'billing', userId: 'member_a', status: 'active' },
    ];
    expect((await myDecision._handler(store.ctx, {})).screen).toBe('today');
    store.rows.coachPlanRequestsV1 = [];
    expect((await myDecision._handler(store.ctx, {})).screen).toBe('today');
  });

  test('health continuation routes directly to paywall without starting AI or rewards', async () => {
    const store = fixture({
      coachOnboardingV1: [
        { _id: 'state', userId: 'member_a', stage: 'health', profileRevisionId: 'profile' },
      ],
    });
    await continueAfterHealth._handler(store.ctx, { result: 'declined' });
    expect((await myDecision._handler(store.ctx, {})).screen).toBe('paywall');
    expect(store.rows.coachOnboardingV1[0].healthContinuation).toBe('declined');
    expect(store.rows.coachPlanRequestsV1).toBeUndefined();
    expect(store.scheduled).toHaveLength(0);
    await expect(saveDailyDraft._handler(store.ctx, { sleep: 'rested_enough' })).rejects.toThrow(
      'Verified access required'
    );
    store.rows.coachBillingEntitlementsV1 = [
      { _id: 'billing', userId: 'member_a', status: 'active' },
    ];
    expect((await myDecision._handler(store.ctx, {})).screen).toBe('today');
  });

  test('an unpaid direct final answer cannot reserve or queue a first plan', async () => {
    const store = fixture({
      coachOnboardingV1: [
        {
          _id: 'state',
          userId: 'member_a',
          stage: 'paywall',
          profileRevisionId: 'profile',
          healthContinuation: 'declined',
          dailyDraftDay: day,
          dailyDraft: draft,
        },
      ],
    });
    await expect(
      finishDailyAndReserveFirst._handler(store.ctx, {
        body: 'fine',
        requestKey: 'unpaid_direct_123',
      })
    ).rejects.toThrow('Verified access required');
    expect(store.rows.coachPlanRequestsV1).toBeUndefined();
    expect(store.scheduled).toHaveLength(0);
  });

  test('paywall and Today expose retry only for a retryable failed request', async () => {
    const store = fixture({
      coachOnboardingV1: [
        {
          _id: 'state',
          userId: 'member_a',
          profileRevisionId: 'profile',
          healthContinuation: 'declined',
        },
      ],
      coachPlanRequestsV1: [
        {
          _id: 'request',
          userId: 'member_a',
          day,
          status: 'failed',
          errorCode: 'policy_unresolved',
          promptVersion: DAILY_PLAN_PROMPT_VERSION,
        },
      ],
    });
    expect(await myDecision._handler(store.ctx, {})).toMatchObject({
      screen: 'paywall',
      requestStatus: 'failed',
      canRetry: false,
    });
    expect(await myPlan._handler(store.ctx, {})).toMatchObject({
      requestStatus: 'failed',
      access: false,
      canRetry: false,
      plan: null,
    });
    store.rows.coachPlanRequestsV1[0].inputSnapshot = {
      daily: {
        sleep: 'rested_enough',
        energy: 'steady',
        upFor: 'something_light',
        body: 'sore_lower',
      },
      health: { steps: [], workouts: [] },
    };
    expect((await myDecision._handler(store.ctx, {})).canRetry).toBe(true);
    expect((await myPlan._handler(store.ctx, {})).canRetry).toBe(true);
    store.rows.coachPlanRequestsV1[0].inputSnapshot = undefined;
    store.rows.coachPlanRequestsV1[0].errorCode = 'provider_timeout';
    expect((await myDecision._handler(store.ctx, {})).canRetry).toBe(true);
    expect((await myPlan._handler(store.ctx, {})).canRetry).toBe(true);
    store.rows.coachBillingEntitlementsV1 = [
      { _id: 'billing', userId: 'member_a', status: 'active' },
    ];
    expect(await myDecision._handler(store.ctx, {})).toMatchObject({
      screen: 'today',
      canRetry: true,
    });
  });

  test('fifth answer atomically freezes one request and schedules once across duplicate calls', async () => {
    const store = fixture({
      coachOnboardingV1: [
        {
          _id: 'state',
          userId: 'member_a',
          stage: 'daily',
          profileRevisionId: 'profile',
          healthContinuation: 'declined',
          dailyDraftDay: day,
          dailyDraft: draft,
          entitlement: 'unverified',
        },
      ],
      coachProfileRevisionsV1: [
        {
          _id: 'profile',
          userId: 'member_a',
          version: 1,
          answers: profile,
          weightObservationId: 'weight',
        },
      ],
      coachWeightObservationsV1: [
        {
          _id: 'weight',
          userId: 'member_a',
          version: 1,
          weight: { value: 70, unit: 'kg' },
          source: 'member',
        },
      ],
      coachBillingEntitlementsV1: [{ _id: 'billing', userId: 'member_a', status: 'active' }],
    });
    const first = await finishDailyAndReserveFirst._handler(store.ctx, {
      body: 'fine',
      requestKey: 'first_12345678',
    });
    const duplicate = await finishDailyAndReserveFirst._handler(store.ctx, {
      body: 'fine',
      requestKey: 'device_87654321',
    });
    expect(duplicate).toBe(first);
    expect(store.rows.coachDailyAnswersV1).toHaveLength(1);
    expect(store.rows.coachPlanRequestsV1).toHaveLength(1);
    expect(store.scheduled).toHaveLength(1);
    expect(store.rows.coachPlanRequestsV1[0].inputSnapshot.daily.body).toBe('fine');
    expect(store.writes.map((item) => item.table)).not.toContain('dailyActivities');
    expect(store.writes.map((item) => item.table)).not.toContain('coachRewardSlotsV1');
  });

  test('incomplete legacy completion cannot bypass profile, and app activity awards no points', async () => {
    const store = fixture();
    await expect(updateOnboarded._handler(store.ctx, { onboarded: true })).rejects.toThrow(
      'Saved answers and verified access required'
    );
    await expect(updateOnboarded._handler(store.ctx, { onboarded: false })).rejects.toThrow();
    await updateLastActiveAt._handler(store.ctx, { date: day, timezone: 'UTC' });
    expect(store.rows.userCheckIns).toBeUndefined();
    expect(store.scheduled).toHaveLength(0);
    expect(store.writes.map((item) => item.table)).toEqual(['patch']);
  });

  test('completed legacy member can repeat completion without Coach records or side effects', async () => {
    const store = fixture({ users: [{ _id: 'member_a', onboarded: true }] });
    expect(await updateOnboarded._handler(store.ctx, { onboarded: true })).toEqual({
      success: true,
    });
    expect(store.writes).toHaveLength(0);
    expect(store.scheduled).toHaveLength(0);
  });

  test('legacy health completion works without granting Coach or paid access', async () => {
    const store = fixture({
      users: [
        {
          _id: 'member_a',
          name: 'Sandy',
          birthdate: 500000000000,
          activityGoal: 'active',
          timezone: 'UTC',
        },
      ],
    });
    expect(await updateOnboarded._handler(store.ctx, { onboarded: true })).toEqual({
      success: true,
    });
    expect(store.rows.users[0].onboarded).toBe(true);
    expect(store.rows.users[0].isPremium).toBeUndefined();
    expect(store.rows.coachBillingEntitlementsV1).toBeUndefined();
    expect(store.rows.coachOnboardingV1).toBeUndefined();
    await updateOnboarded._handler(store.ctx, { onboarded: true });
    expect(store.scheduled).toHaveLength(1);
    expect(store.writes).toHaveLength(1);
  });

  test('Coach enrollment retains strict answers and billing checks even with a legacy activity goal', async () => {
    const store = fixture({
      users: [
        {
          _id: 'member_a',
          name: 'Sandy',
          birthdate: 500000000000,
          activityGoal: 'active',
          timezone: 'UTC',
        },
      ],
      coachOnboardingV1: [{ _id: 'state', userId: 'member_a', stage: 'profile' }],
    });
    await expect(updateOnboarded._handler(store.ctx, { onboarded: true })).rejects.toThrow(
      'Saved answers and verified access required'
    );
    expect(store.writes).toHaveLength(0);
  });
});

test('verified trials go to Home without a post-paywall notification gate', () => {
  const input = {
    hasBio: true,
    hasProfile: true,
    hasHealthContinuation: true,
    verifiedAccess: true,
    hasTodayRequest: false,
    hasTodayPlan: false,
    changedDay: false,
    returningMember: true,
  };
  expect(resumeDecision({ ...input, trialNotificationPending: true }).screen).toBe('today');
  expect(resumeDecision({ ...input, trialNotificationPending: false }).screen).toBe('today');
  expect(
    resumeDecision({ ...input, verifiedAccess: false, trialNotificationPending: true }).screen
  ).toBe('paywall');
});

test('missing member with a stale auth identity returns no resume decision', async () => {
  const store = fixture({ users: [] });
  expect(await myDecision._handler(store.ctx, {})).toBeNull();
  expect(store.writes).toEqual([]);
  expect(store.scheduled).toEqual([]);
});

test('signed-out subscription returns no resume decision', async () => {
  const store = fixture();
  store.ctx.auth.getUserIdentity = async () => null;
  expect(await myDecision._handler(store.ctx, {})).toBeNull();
});
