// @ts-nocheck -- Bun test-only runtime hooks are not part of the app's TypeScript project.
import { describe, expect, test } from 'bun:test';
import { assignmentLabel, assertDay, rewardSlotKey } from '../shared/coachFoundation';
import {
  saveProfileDraft,
  saveDailyDraft,
  finishDailyAnswers,
  reserveFirstPlan,
  reserveLaterPlan,
  reserveProof,
  materializeAssignments,
  updateProfileRevision,
  recordPlanRevision,
  beginMyTodayReanswerForTesting,
  saveMyTodayReanswerDraftForTesting,
  finishMyTodayReanswerForTesting,
} from '../convex/coachFoundation';
import { forMemberDay } from '../convex/coachLegacyInventory';

function fakeStore(seed: Record<string, any[]> = {}, user = 'member_a') {
  const rows: Record<string, any[]> = structuredClone(seed);
  const writes: { table: string; value: any }[] = [];
  let next = 1;
  const db = {
    get: async (id: string) =>
      Object.values(rows)
        .flat()
        .find((r) => r._id === id) ?? null,
    insert: async (table: string, value: any) => {
      const id = `${table}_${next++}`;
      (rows[table] ??= []).push({ _id: id, ...value });
      writes.push({ table, value });
      return id;
    },
    patch: async (id: string, value: any) => {
      const row = Object.values(rows)
        .flat()
        .find((r) => r._id === id);
      if (!row) throw new Error('Missing fixture row');
      Object.assign(row, value);
      writes.push({ table: 'patch', value });
    },
    query: (table: string) => {
      let found = [...(rows[table] ?? [])];
      const chain: any = {
        withIndex: (_name: string, callback?: (q: any) => any) => {
          if (callback) {
            const predicates: Array<[string, string, any]> = [];
            const q: any = {};
            for (const op of ['eq', 'gte', 'lt'])
              q[op] = (field: string, value: any) => {
                predicates.push([op, field, value]);
                return q;
              };
            callback(q);
            found = found.filter((row) =>
              predicates.every(([op, field, value]) =>
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
          if (found.length > 1) throw new Error('Non-unique fixture');
          return found[0] ?? null;
        },
        collect: async () => found,
      };
      return chain;
    },
  };
  const ctx = {
    db,
    auth: { getUserIdentity: async () => ({ subject: user }) },
    scheduler: {
      runAfter: () => {
        throw new Error('Scheduling is forbidden');
      },
    },
    runAction: () => {
      throw new Error('Provider calls are forbidden');
    },
  };
  return { ctx: ctx as any, rows, writes };
}

const today = new Date().toISOString().slice(0, 10);
const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
const profile = {
  goal: 'lose',
  bodyFeeling: 'feel_good',
  routineFeeling: 'working_keep_going',
  foodRelationship: 'balanced_most_days',
  usualSleep: 'regular_restful',
  biggestChallenge: 'time',
};
const daily = {
  sleep: 'rested_enough',
  energy: 'steady',
  mood: 'good',
  upFor: 'short_session',
  body: 'fine',
};

describe('coach foundation invariants', () => {
  test('development re-answer preserves an analysed meal and reserves only one new plan', async () => {
    const original = process.env.CONVEX_CLOUD_URL;
    process.env.CONVEX_CLOUD_URL = 'https://beloved-stoat-88.convex.cloud';
    try {
      const store = fakeStore({
        users: [{ _id: 'member_a', timezone: 'UTC' }],
        coachBillingEntitlementsV1: [{ _id: 'billing', userId: 'member_a', status: 'active' }],
        coachOnboardingV1: [
          {
            _id: 'state',
            userId: 'member_a',
            profileRevisionId: 'profile',
            entitlement: 'verified',
            stage: 'complete',
            dailyAnswerId: 'oldAnswers',
          },
        ],
        coachProfileRevisionsV1: [
          {
            _id: 'profile',
            userId: 'member_a',
            answers: profile,
            weightObservationId: 'weight',
          },
        ],
        coachWeightObservationsV1: [
          {
            _id: 'weight',
            userId: 'member_a',
            weight: { value: 70, unit: 'kg' },
            observedAt: Date.now(),
            source: 'member',
            version: 1,
          },
        ],
        coachDailyAnswersV1: [
          {
            _id: 'oldAnswers',
            userId: 'member_a',
            day: today,
            version: 1,
            answers: daily,
          },
        ],
        coachPlanRequestsV1: [
          {
            _id: 'oldRequest',
            userId: 'member_a',
            day: today,
            status: 'ready',
            dailyAnswerId: 'oldAnswers',
            requestKey: 'old_request',
          },
        ],
        coachPlanRevisionsV1: [
          {
            _id: 'oldPlan',
            userId: 'member_a',
            day: today,
            version: 1,
            requestId: 'oldRequest',
          },
        ],
        coachAssignmentsV1: [
          { _id: 'oldAssignment', userId: 'member_a', day: today, planRevisionId: 'oldPlan' },
        ],
        coachProofSubmissionsV1: [
          { _id: 'mealProof', userId: 'member_a', day: today, planRevisionId: 'oldPlan' },
        ],
        coachRewardSlotsV1: [
          { _id: 'mealSlot', userId: 'member_a', day: today, state: 'reserved' },
        ],
        coachMealDraftsV1: [
          {
            _id: 'analysedMeal',
            userId: 'member_a',
            day: today,
            status: 'ready',
            planRevisionId: 'oldPlan',
            caption: 'Lunch',
          },
        ],
        coachMealScansV1: [
          {
            _id: 'scan',
            userId: 'member_a',
            day: today,
            draftId: 'analysedMeal',
            status: 'ready',
            usable: true,
          },
        ],
      });
      let scheduled = 0;
      store.ctx.scheduler.runAfter = async () => {
        scheduled += 1;
      };
      const session = await beginMyTodayReanswerForTesting._handler(store.ctx, {});
      expect(session.day).toBe(today);
      await saveMyTodayReanswerDraftForTesting._handler(store.ctx, {
        sleep: 'rested_enough',
        energy: 'flat',
        mood: 'good',
        upFor: 'short_session',
      });
      const next = await finishMyTodayReanswerForTesting._handler(store.ctx, { body: 'fine' });
      expect(await finishMyTodayReanswerForTesting._handler(store.ctx, { body: 'fine' })).toBe(
        next
      );
      expect(scheduled).toBe(1);
      expect(store.rows.coachPlanRequestsV1).toHaveLength(2);
      expect(store.rows.coachPlanRevisionsV1.map((row) => row._id)).toEqual(['oldPlan']);
      expect(store.rows.coachMealDraftsV1[0].planRevisionId).toBe('oldPlan');
      expect(store.rows.coachMealScansV1[0].status).toBe('ready');
      expect(store.rows.coachRewardSlotsV1).toHaveLength(1);
      expect(store.rows.coachDailyAnswersV1).toHaveLength(2);
      expect(store.rows.coachPlanRequestsV1[1].kind).toBe('daily');
      expect(store.rows.coachPlanRequestsV1[1].dailyAnswerId).not.toBe('oldAnswers');
      expect(store.rows.coachPlanRequestsV1[1].inputSnapshot.daily.energy).toBe('flat');
    } finally {
      process.env.CONVEX_CLOUD_URL = original;
    }
  });
  test('day and category slot identity is independent of plan revision', () => {
    expect(rewardSlotKey(today, 'workout', 1)).toBe(`${today}:workout:1`);
    expect(rewardSlotKey(today, 'meals', 3)).toBe(`${today}:meals:3`);
    expect(() => rewardSlotKey(today, 'workout', 2)).toThrow();
    expect(() => assertDay('2026-02-30')).toThrow();
    expect(
      assignmentLabel(
        'Log a 20-minute lower body strength workout today.',
        'lower_body_strength',
        20
      )
    ).toBe('20-minute leg workout');
  });

  test('draft saves persist only draft state, never rewards, posts, streaks or provider jobs', async () => {
    const store = fakeStore({ users: [{ _id: 'member_a', timezone: 'UTC' }] });
    await saveProfileDraft._handler(store.ctx, { goal: 'lose' });
    expect(store.rows.coachOnboardingV1[0].profileDraft.goal).toBe('lose');
    expect(store.writes.map((w) => w.table)).toEqual(['coachOnboardingV1', 'patch']);
  });

  test('a reserved plan freezes its daily answers across duplicate submissions', async () => {
    const store = fakeStore({
      users: [{ _id: 'member_a', timezone: 'UTC' }],
      coachOnboardingV1: [
        {
          _id: 'state',
          userId: 'member_a',
          profileRevisionId: 'profile',
          healthContinuation: 'declined',
          dailyDraftDay: today,
          dailyDraft: daily,
        },
      ],
      coachPlanRequestsV1: [
        {
          _id: 'request',
          userId: 'member_a',
          day: today,
          dailyAnswerId: 'daily',
          status: 'pending',
        },
      ],
    });
    expect(await finishDailyAnswers._handler(store.ctx, {})).toBe('daily');
    await expect(saveDailyDraft._handler(store.ctx, { mood: 'low' })).rejects.toThrow(
      'Daily answers are already reserved for today'
    );
    expect(store.rows.coachOnboardingV1[0].dailyDraft).toEqual(daily);
    expect(store.writes).toHaveLength(0);
  });

  test('first-plan reservation is transactional and idempotent across request keys', async () => {
    const store = fakeStore({
      coachBillingEntitlementsV1: [{ _id: 'billing', userId: 'member_a', status: 'active' }],
      users: [{ _id: 'member_a', timezone: 'UTC' }],
      coachOnboardingV1: [
        {
          _id: 'state',
          userId: 'member_a',
          stage: 'daily',
          entitlement: 'unverified',
          healthContinuation: 'declined',
          profileRevisionId: 'profile',
          dailyAnswerId: 'daily',
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
          weight: { value: 75, unit: 'kg' },
          source: 'member',
        },
      ],
      coachDailyAnswersV1: [
        { _id: 'daily', userId: 'member_a', day: today, version: 1, answers: daily },
      ],
      coachMealDraftsV1: [
        {
          _id: 'shared_a',
          userId: 'member_a',
          day: yesterday,
          status: 'shared',
          caption: 'Eggs with toast',
          createdAt: 2,
        },
        {
          _id: 'private_a',
          userId: 'member_a',
          day: yesterday,
          status: 'draft',
          caption: 'Fish and rice',
          createdAt: 3,
        },
        {
          _id: 'shared_b',
          userId: 'member_b',
          day: yesterday,
          status: 'shared',
          caption: 'Chicken soup',
          createdAt: 4,
        },
      ],
    });
    const first = await reserveFirstPlan._handler(store.ctx, { requestKey: 'device_a_123' });
    const second = await reserveFirstPlan._handler(store.ctx, { requestKey: 'device_b_456' });
    expect(second).toBe(first);
    expect(store.rows.coachPlanRequestsV1).toHaveLength(1);
    expect(store.rows.coachPlanRequestsV1[0].inputSnapshot.daily).toEqual(daily);
    expect(store.rows.coachPlanRequestsV1[0].promptVersion).toBe('client-daily-plan-v2.1');
    expect(store.rows.coachPlanRequestsV1[0].inputSnapshot.mealHistory).toEqual([
      { day: yesterday, caption: 'Eggs with toast', source: 'shared_member_caption' },
    ]);
    expect(store.writes.map((w) => w.table)).toEqual(['coachPlanRequestsV1', 'patch']);
  });

  test('proof reservation checks owner, day, entitlement, and reuses the same slot', async () => {
    const store = fakeStore({
      users: [{ _id: 'member_a', timezone: 'UTC' }],
      coachBillingEntitlementsV1: [{ _id: 'billing', userId: 'member_a', status: 'active' }],
      coachOnboardingV1: [{ _id: 'state', userId: 'member_a', entitlement: 'verified' }],
      coachPlanRevisionsV1: [{ _id: 'revision', userId: 'member_a', day: today, version: 1 }],
      coachAssignmentsV1: [
        {
          _id: 'assignment',
          userId: 'member_a',
          day: today,
          category: 'workout',
          planRevisionId: 'revision',
          recommendation: '20-minute lower body strength workout',
          label: '20-minute leg workout',
        },
      ],
    });
    const id = await reserveProof._handler(store.ctx, {
      assignmentId: 'assignment',
      requestKey: 'device_a_123',
    });
    expect(
      await reserveProof._handler(store.ctx, {
        assignmentId: 'assignment',
        requestKey: 'device_a_123',
      })
    ).toBe(id);
    expect(store.rows.coachRewardSlotsV1).toHaveLength(1);
    expect(store.rows.coachProofSubmissionsV1[0].recommendation).toBe(
      '20-minute lower body strength workout'
    );
    expect(
      await reserveProof._handler(store.ctx, {
        assignmentId: 'assignment',
        requestKey: 'device_b_456',
      })
    ).toBe(id);
    store.rows.coachAssignmentsV1.push({
      ...store.rows.coachAssignmentsV1[0],
      _id: 'assignment_refresh',
      planRevisionId: 'revision_2',
      recommendation: '45-minute upper body strength workout',
      label: '45-minute upper body workout',
    });
    store.rows.coachPlanRevisionsV1.push({
      _id: 'revision_2',
      userId: 'member_a',
      day: today,
      version: 2,
    });
    expect(
      await reserveProof._handler(store.ctx, {
        assignmentId: 'assignment_refresh',
        requestKey: 'device_c_789',
      })
    ).toBe(id);
    expect(store.rows.coachProofSubmissionsV1[0].planRevisionId).toBe('revision');
    const other = fakeStore(store.rows, 'member_b');
    other.rows.users.push({ _id: 'member_b', timezone: 'UTC' });
    await expect(
      reserveProof._handler(other.ctx, { assignmentId: 'assignment', requestKey: 'device_b_456' })
    ).rejects.toThrow();
  });

  test('legacy hydration is not treated as workout proof; real workout is', async () => {
    const base = {
      users: [{ _id: 'member_a', timezone: 'UTC' }],
      coachBillingEntitlementsV1: [{ _id: 'billing', userId: 'member_a', status: 'active' }],
      coachOnboardingV1: [{ _id: 'state', userId: 'member_a', entitlement: 'verified' }],
      coachPlanRevisionsV1: [{ _id: 'revision', userId: 'member_a', day: today, version: 1 }],
      coachAssignmentsV1: [
        {
          _id: 'assignment',
          userId: 'member_a',
          day: today,
          category: 'workout',
          planRevisionId: 'revision',
          recommendation: '20-minute lower body strength workout',
          label: '20-minute leg workout',
        },
      ],
    };
    const hydration = fakeStore({
      ...base,
      dailyActivities: [
        { _id: 'old', userId: 'member_a', date: today, loggedActivityKey: 'hydration', points: 5 },
      ],
    });
    expect(
      await reserveProof._handler(hydration.ctx, {
        assignmentId: 'assignment',
        requestKey: 'device_a_123',
      })
    ).toBeTruthy();
    const workout = fakeStore({
      ...base,
      dailyActivities: [
        {
          _id: 'old',
          userId: 'member_a',
          date: today,
          loggedActivityKey: 'gym_workout',
          points: 5,
        },
      ],
    });
    await expect(
      reserveProof._handler(workout.ctx, { assignmentId: 'assignment', requestKey: 'device_a_123' })
    ).rejects.toThrow();
  });

  test('plan-specific assignments retain the exact revision and recommendation', async () => {
    const store = fakeStore({
      coachPlanRevisionsV1: [
        {
          _id: 'revision_2',
          userId: 'member_a',
          day: today,
          output: {
            headline: 'Ready',
            workout: 'Log a 20-minute lower body strength workout today.',
            steps: '7,000 steps',
            sleep: 'Aim for 7 hours tonight.',
            meals: 'Log your meals.',
            why: 'Today fits.',
          },
          workout: { type: 'lower_body_strength', durationMinutes: 20 },
          stepTarget: 7000,
        },
      ],
    });
    const first = await materializeAssignments._handler(store.ctx, { revisionId: 'revision_2' });
    const second = await materializeAssignments._handler(store.ctx, { revisionId: 'revision_2' });
    expect(second).toEqual(first);
    expect(store.rows.coachAssignmentsV1).toHaveLength(4);
    expect(store.rows.coachAssignmentsV1[0]).toMatchObject({
      planRevisionId: 'revision_2',
      category: 'workout',
      label: '20-minute leg workout',
      recommendation: 'Log a 20-minute lower body strength workout today.',
    });
  });

  test('a validated plan revision is immutable and reuses its request identity', async () => {
    const store = fakeStore({
      coachPlanRequestsV1: [
        {
          _id: 'request',
          userId: 'member_a',
          day: today,
          status: 'pending',
          promptVersion: 'daily-v1',
          toneVersion: 1,
          inputSnapshot: { daily, health: { steps: [], workouts: [] } },
        },
      ],
    });
    const input = {
      requestId: 'request',
      output: {
        headline: 'Good day to push a little.',
        workout: 'Log a 20-minute lower body strength workout today.',
        steps: '7,000 steps',
        sleep: 'Aim for 7 hours tonight. Keep your usual bedtime routine.',
        meals: 'Aim for 2 litres of water today. Snap each meal for an instant portion check.',
        why: 'Your energy is steady.',
      },
      workout: { type: 'lower_body_strength', durationMinutes: 20 },
      stepTarget: 7000,
    };
    await expect(
      recordPlanRevision._handler(store.ctx, { ...input, stepTarget: 5000 })
    ).rejects.toThrow();
    const first = await recordPlanRevision._handler(store.ctx, input);
    expect(await recordPlanRevision._handler(store.ctx, input)).toBe(first);
    expect(store.rows.coachPlanRevisionsV1).toHaveLength(1);
    expect(store.rows.coachPlanRevisionsV1[0]).toMatchObject({
      version: 1,
      promptVersion: 'daily-v1',
      toneVersion: 1,
      stepTarget: 7000,
    });
    expect(store.rows.coachPlanRequestsV1[0].status).toBe('ready');
  });

  test('profile version check prevents stale cross-device updates', async () => {
    const store = fakeStore({
      users: [{ _id: 'member_a' }],
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
        { _id: 'weight', userId: 'member_a', weight: { value: 75, unit: 'kg' }, observedAt: 100 },
      ],
    });
    await expect(
      updateProfileRevision._handler(store.ctx, {
        answers: { ...profile, goal: 'fitness' },
        weight: { value: 75, unit: 'kg' },
        expectedVersion: 0,
      })
    ).rejects.toThrow();
    expect(store.writes).toHaveLength(0);
  });

  test('changing a profile answer does not invent a new weight measurement', async () => {
    const store = fakeStore({
      users: [{ _id: 'member_a' }],
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
          weight: { value: 75, unit: 'kg' },
          observedAt: 100,
        },
      ],
    });
    await updateProfileRevision._handler(store.ctx, {
      answers: { ...profile, goal: 'fitness' },
      weight: { value: 75, unit: 'kg' },
      expectedVersion: 1,
    });
    expect(store.rows.coachWeightObservationsV1).toHaveLength(1);
    expect(store.rows.coachProfileRevisionsV1[1].weightObservationId).toBe('weight');
  });

  test('profile refresh uses saved daily answers once and leaves an existing plan immutable', async () => {
    const store = fakeStore({
      users: [{ _id: 'member_a', timezone: 'UTC' }],
      coachBillingEntitlementsV1: [{ _id: 'billing', userId: 'member_a', status: 'active' }],
      coachOnboardingV1: [
        {
          _id: 'state',
          userId: 'member_a',
          entitlement: 'verified',
          profileRevisionId: 'profile_2',
          dailyAnswerId: 'daily',
        },
      ],
      coachProfileRevisionsV1: [
        {
          _id: 'profile_2',
          userId: 'member_a',
          version: 2,
          answers: { ...profile, goal: 'fitness' },
          weightObservationId: 'weight',
        },
      ],
      coachWeightObservationsV1: [
        {
          _id: 'weight',
          userId: 'member_a',
          version: 1,
          weight: { value: 75, unit: 'kg' },
          observedAt: 100,
          source: 'member',
        },
      ],
      coachDailyAnswersV1: [
        { _id: 'daily', userId: 'member_a', day: today, version: 1, answers: daily },
      ],
      coachPlanRequestsV1: [
        {
          _id: 'old_request',
          userId: 'member_a',
          day: today,
          kind: 'daily',
          profileRevisionId: 'profile_1',
          dailyAnswerId: 'daily',
          status: 'ready',
        },
      ],
      coachPlanRevisionsV1: [
        {
          _id: 'old_plan',
          userId: 'member_a',
          day: today,
          version: 1,
          requestId: 'old_request',
          output: { workout: 'Original workout' },
        },
      ],
    });
    const first = await reserveLaterPlan._handler(store.ctx, {
      kind: 'profile_refresh',
      requestKey: 'refresh_12345',
    });
    const second = await reserveLaterPlan._handler(store.ctx, {
      kind: 'profile_refresh',
      requestKey: 'another_12345',
    });
    expect(second).toBe(first);
    expect(store.rows.coachPlanRequestsV1[1].inputSnapshot.daily).toEqual(daily);
    expect(store.rows.coachPlanRevisionsV1[0].output.workout).toBe('Original workout');
    expect(store.rows.coachPlanRequestsV1).toHaveLength(2);
  });

  test('legacy inventory leaves plan context unknown and keeps earned points unchanged', async () => {
    const store = fakeStore({
      challengeCompletions: [
        {
          _id: 'completion',
          userId: 'member_a',
          date: today,
          challengeId: 'challenge',
          pointsEarned: 5,
        },
      ],
      challenges: [{ _id: 'challenge', type: 'check_in' }],
      dailyActivities: [
        {
          _id: 'activity',
          userId: 'member_a',
          date: today,
          loggedActivityKey: 'hydration',
          points: 5,
          synced: false,
        },
      ],
      coachDailyPlans: [{ _id: 'old_plan', userId: 'member_a', date: today, status: 'ready' }],
    });
    const result = await forMemberDay._handler(store.ctx, { userId: 'member_a', day: today });
    expect(result.completions[0]).toMatchObject({ pointsEarned: 5, context: 'legacy_unknown' });
    expect(result.activities[0]).toMatchObject({
      points: 5,
      loggedActivityKey: 'hydration',
      context: 'legacy_unknown',
    });
    expect(result.oldPlans[0].profileVersion).toBe('unknown');
    expect(store.writes).toHaveLength(0);
  });
});
