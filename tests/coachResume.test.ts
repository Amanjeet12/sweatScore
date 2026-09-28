// @ts-nocheck -- Bun-only Convex handler fixtures.
import { describe, expect, test } from 'bun:test';
import { resumeDecision } from '../shared/coachResume';
import { myDecision } from '../convex/coachResume';
import { myPlan } from '../convex/revenueCatEntitlements';
import { DAILY_PLAN_PROMPT_VERSION } from '../convex/coachDailyPrompt';
import {
  continueAfterHealth,
  finishCoachSetup,
  finishDailyAndReserveFirst,
  saveDailyDraft,
} from '../convex/coachFoundation';
import { updateLastActiveAt, updateOnboarded } from '../convex/users';

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
  test('new member follows bio, profile, health, setup, paywall, then daily after verification', () => {
    expect(resumeDecision({ ...base, hasBio: false }).screen).toBe('bio');
    const profileState = resumeDecision({
      ...base,
      hasProfile: false,
      profileDraft: { weight: { value: 70, unit: 'kg' }, goal: 'lose' },
    });
    expect(profileState).toMatchObject({ screen: 'profile', question: 2 });
    expect(resumeDecision({ ...base, hasHealthContinuation: false }).screen).toBe('health');
    expect(resumeDecision({ ...base, setupPending: true })).toMatchObject({ screen: 'setup' });
    expect(resumeDecision({ ...base, dailyDraft: draft })).toMatchObject({
      screen: 'paywall',
      question: 0,
    });
    expect(resumeDecision({ ...base, verifiedAccess: true, dailyDraft: draft })).toMatchObject({
      screen: 'daily',
      question: 4,
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
    ).toBe('daily');
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
    expect(resumeDecision({ ...persisted, verifiedAccess: true }).screen).toBe('daily');
  });

  test('member-local day change preserves old plan and resumes fresh daily answers', () => {
    expect(
      resumeDecision({
        ...base,
        verifiedAccess: true,
        changedDay: true,
        dailyDraft: { sleep: 'restful' },
      })
    ).toMatchObject({ screen: 'daily', question: 1, changedDay: true, requestStatus: 'none' });
    expect(
      resumeDecision({ ...base, verifiedAccess: true, changedDay: true, completedOnboarding: true })
        .screen
    ).toBe('today');
  });

  test('legacy completed-account flag routes to access-limited Today without granting billing', async () => {
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
      screen: 'today',
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

  test('health continuation and visual setup save progress without starting AI or rewards', async () => {
    const store = fixture({
      coachOnboardingV1: [
        { _id: 'state', userId: 'member_a', stage: 'health', profileRevisionId: 'profile' },
      ],
    });
    await continueAfterHealth._handler(store.ctx, { result: 'declined' });
    expect((await myDecision._handler(store.ctx, {})).screen).toBe('setup');
    await finishCoachSetup._handler(store.ctx, {});
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
    expect((await myDecision._handler(store.ctx, {})).screen).toBe('daily');
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

  test('old completion call cannot bypass answers or billing, and app activity awards no points', async () => {
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
});
