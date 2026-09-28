// @ts-nocheck -- Bun test-only Convex handler fixtures.
import { describe, expect, test } from 'bun:test';
import {
  myToday,
  mySubmission,
  saveCaption,
  issueUpload,
  authorizeUpload,
  attachUploadedInternal,
  complete,
  cancel,
  reverseMine,
} from '../convex/coachCheckIns';
import { reserveProof } from '../convex/coachFoundation';
import { createPost } from '../convex/posts';
import { completeChallenge } from '../convex/challengeCompletions';
import { getStreakEarnedDatesInRange } from '../convex/utils/streak';
import { checkInPostRoute } from '../shared/coachCheckInPresentation';

const day = new Date().toISOString().slice(0, 10);
function fixture(extra: Record<string, any[]> = {}, member = 'alice') {
  const rows: Record<string, any[]> = structuredClone({
    users: [
      { _id: 'alice', timezone: 'UTC', isPremium: true },
      { _id: 'bob', timezone: 'UTC', isPremium: true },
    ],
    coachBillingEntitlementsV1: [
      { _id: 'bill_a', userId: 'alice', status: 'active' },
      { _id: 'bill_b', userId: 'bob', status: 'active' },
    ],
    coachOnboardingV1: [
      { _id: 'state_a', userId: 'alice', entitlement: 'verified' },
      { _id: 'state_b', userId: 'bob', entitlement: 'verified' },
    ],
    coachPlanRevisionsV1: [
      { _id: 'plan_a', userId: 'alice', day, version: 1 },
      { _id: 'plan_b', userId: 'bob', day, version: 1 },
    ],
    coachAssignmentsV1: [
      {
        _id: 'legs',
        userId: 'alice',
        day,
        category: 'workout',
        planRevisionId: 'plan_a',
        recommendation: '20-minute lower body strength workout',
        label: '20-minute leg workout',
        workout: { type: 'lower_body_strength', durationMinutes: 20 },
      },
      {
        _id: 'steps_a',
        userId: 'alice',
        day,
        category: 'steps',
        planRevisionId: 'plan_a',
        recommendation: 'Aim for 5,000 steps today.',
        label: '5,000 steps',
        stepTarget: 5000,
      },
      {
        _id: 'meals_a',
        userId: 'alice',
        day,
        category: 'meals',
        planRevisionId: 'plan_a',
        recommendation: 'Log meals and drink water.',
        label: 'Log a meal',
      },
      {
        _id: 'sleep_a',
        userId: 'alice',
        day,
        category: 'sleep',
        planRevisionId: 'plan_a',
        recommendation: 'Aim for 7 hours.',
        label: 'Log your sleep',
        sleepTargetHours: 7,
      },
      {
        _id: 'upper',
        userId: 'bob',
        day,
        category: 'workout',
        planRevisionId: 'plan_b',
        recommendation: '20-minute upper body strength workout',
        label: '20-minute upper body workout',
        workout: { type: 'upper_body_strength', durationMinutes: 20 },
      },
      {
        _id: 'steps_b',
        userId: 'bob',
        day,
        category: 'steps',
        planRevisionId: 'plan_b',
        recommendation: 'Aim for 7,000 steps today.',
        label: '7,000 steps',
        stepTarget: 7000,
      },
    ],
    ...extra,
  });
  const calls: string[] = [];
  let count = 0;
  const db = {
    get: async (id: string) =>
      Object.values(rows)
        .flat()
        .find((item) => item._id === id) ?? null,
    insert: async (table: string, value: any) => {
      const id = `${table}_${++count}`;
      (rows[table] ??= []).push({ _id: id, ...value });
      calls.push(`insert:${table}`);
      return id;
    },
    patch: async (id: string, value: any) => {
      const row = Object.values(rows)
        .flat()
        .find((item) => item._id === id);
      if (!row) throw Error(`missing ${id}`);
      Object.assign(row, value);
      calls.push(`patch:${id}`);
    },
    system: { get: async (id: string) => rows._storage?.find((item) => item._id === id) ?? null },
    query: (table: string) => {
      let found = [...(rows[table] ?? [])];
      const chain: any = {
        withIndex: (_: string, callback?: any) => {
          const predicates: any[] = [];
          const q: any = {};
          for (const op of ['eq', 'gte', 'lt'])
            q[op] = (key: string, value: any) => {
              predicates.push([op, key, value]);
              return q;
            };
          callback?.(q);
          found = found.filter((row) =>
            predicates.every(([op, key, value]) =>
              op === 'eq' ? row[key] === value : op === 'gte' ? row[key] >= value : row[key] < value
            )
          );
          return chain;
        },
        order: (direction: string) => {
          if (direction === 'desc') found.reverse();
          return chain;
        },
        collect: async () => found,
        first: async () => found[0] ?? null,
        unique: async () => {
          if (found.length > 1) throw Error('not unique');
          return found[0] ?? null;
        },
        filter: () => chain,
      };
      return chain;
    },
  };
  const ctx = {
    db,
    auth: { getUserIdentity: async () => ({ subject: member }) },
    storage: { generateUploadUrl: async () => 'https://upload.example.test' },
    scheduler: {
      runAfter: async () => {
        calls.push('leaderboard');
      },
    },
    runMutation: async () => {
      calls.push('track');
    },
  };
  return { ctx: ctx as any, rows, calls };
}

describe('plan-bound check-ins', () => {
  test('each category leaves the details popup for its dedicated posting route', () => {
    expect(['workout', 'meals', 'sleep', 'steps'].map(checkInPostRoute)).toEqual([
      '/coach-check-in/post/workout',
      '/coach-check-in/post/meals',
      '/coach-check-in/post/sleep',
      '/coach-check-in/post/steps',
    ]);
  });
  test('two members see their own lower/upper workout and distinct steps, without shared strength', async () => {
    const a = fixture();
    const b = fixture({}, 'bob');
    const alice = await myToday._handler(a.ctx, {});
    const bob = await myToday._handler(b.ctx, {});
    expect(alice.assignments.find((x) => x.category === 'workout')?.label).toBe(
      '20-minute leg workout'
    );
    expect(bob.assignments.find((x) => x.category === 'workout')?.label).toBe(
      '20-minute upper body workout'
    );
    expect(alice.assignments.find((x) => x.category === 'steps')?.stepTarget).toBe(5000);
    expect(bob.assignments.find((x) => x.category === 'steps')?.stepTarget).toBe(7000);
    expect(alice.assignments.some((x) => x.userId === 'bob')).toBe(false);
  });

  test('no plan cannot offer fabricated detail; rest/pain has no mandatory workout', async () => {
    const missing = fixture({ coachPlanRevisionsV1: [] });
    expect((await myToday._handler(missing.ctx, {})).status).toBe('no_plan');
    const rest = fixture({
      coachAssignmentsV1: [
        {
          _id: 'rest',
          userId: 'alice',
          day,
          category: 'workout',
          planRevisionId: 'plan_a',
          recommendation: 'Rest today.',
          label: 'Rest and recover',
          workout: { type: 'rest' },
        },
        {
          _id: 'food',
          userId: 'alice',
          day,
          category: 'meals',
          planRevisionId: 'plan_a',
          recommendation: 'Log meals.',
          label: 'Log a meal',
        },
        {
          _id: 'sleep',
          userId: 'alice',
          day,
          category: 'sleep',
          planRevisionId: 'plan_a',
          recommendation: 'Seven hours.',
          label: 'Log sleep',
        },
        {
          _id: 'steps',
          userId: 'alice',
          day,
          category: 'steps',
          planRevisionId: 'plan_a',
          recommendation: '5,000 steps.',
          label: '5,000 steps',
        },
      ],
    });
    expect(
      (await myToday._handler(rest.ctx, {})).assignments.find((x) => x.category === 'workout')
        ?.mandatory
    ).toBe(false);
    await expect(
      reserveProof._handler(rest.ctx, { assignmentId: 'rest', requestKey: 'rest_device_1' })
    ).rejects.toThrow('Rest guidance');
    expect((await myToday._handler(rest.ctx, {})).assignments).toHaveLength(4);
  });

  test('historical workout usage is shown as consumed while hydration is not workout proof', async () => {
    const oldWorkout = fixture({
      dailyActivities: [
        { _id: 'old_gym', userId: 'alice', date: day, loggedActivityKey: 'gym_workout' },
      ],
    });
    expect(
      (await myToday._handler(oldWorkout.ctx, {})).assignments.find((x) => x.category === 'workout')
        ?.consumedCount
    ).toBe(1);
    const hydration = fixture({
      dailyActivities: [
        { _id: 'old_water', userId: 'alice', date: day, loggedActivityKey: 'hydration' },
      ],
    });
    expect(
      (await myToday._handler(hydration.ctx, {})).assignments.find((x) => x.category === 'workout')
        ?.consumedCount
    ).toBe(0);
  });

  test('refresh rejects unstarted old assignment but retains a prior in-flight proof', async () => {
    const s = fixture();
    const id = await reserveProof._handler(s.ctx, {
      assignmentId: 'legs',
      requestKey: 'capture_first_1',
    });
    s.rows.coachPlanRevisionsV1.push({ _id: 'plan_new', userId: 'alice', day, version: 2 });
    s.rows.coachAssignmentsV1.push({
      _id: 'new_legs',
      userId: 'alice',
      day,
      category: 'workout',
      planRevisionId: 'plan_new',
      recommendation: '45-minute lower body strength workout',
      label: '45-minute leg workout',
      workout: { type: 'lower_body_strength', durationMinutes: 45 },
    });
    await expect(
      reserveProof._handler(s.ctx, { assignmentId: 'steps_a', requestKey: 'old_steps_1' })
    ).rejects.toThrow('superseded');
    expect(
      await reserveProof._handler(s.ctx, { assignmentId: 'new_legs', requestKey: 'other_device_1' })
    ).toBe(id);
    expect((await mySubmission._handler(s.ctx, { submissionId: id })).recommendation).toBe(
      '20-minute lower body strength workout'
    );
  });

  test('a profile refresh changes the visible Steps target without reopening an earned slot', async () => {
    const s = fixture({
      coachProofSubmissionsV1: [
        {
          _id: 'old_steps_proof',
          userId: 'alice',
          day,
          assignmentId: 'steps_a',
          planRevisionId: 'plan_a',
          category: 'steps',
          recommendation: 'Aim for 5,000 steps today.',
          slotKey: `${day}:steps:1`,
          state: 'completed',
        },
      ],
      coachRewardSlotsV1: [
        {
          _id: 'earned_steps',
          userId: 'alice',
          day,
          category: 'steps',
          ordinal: 1,
          key: `${day}:steps:1`,
          state: 'earned',
          submissionId: 'old_steps_proof',
        },
      ],
    });
    s.rows.coachPlanRevisionsV1.push({ _id: 'plan_new', userId: 'alice', day, version: 2 });
    s.rows.coachAssignmentsV1.push({
      _id: 'steps_new',
      userId: 'alice',
      day,
      category: 'steps',
      planRevisionId: 'plan_new',
      recommendation: 'Aim for 6,500 steps today.',
      label: '6,500 steps',
      stepTarget: 6500,
    });
    const today = await myToday._handler(s.ctx, {});
    expect(today.assignments.find((item) => item.category === 'steps')).toMatchObject({
      stepTarget: 6500,
      consumedCount: 1,
    });
    expect(
      (await mySubmission._handler(s.ctx, { submissionId: 'old_steps_proof' })).recommendation
    ).toBe('Aim for 5,000 steps today.');
  });

  test('upload is owner-bound and fresh; cancellation/failure gives no points', async () => {
    const s = fixture();
    const id = await reserveProof._handler(s.ctx, {
      assignmentId: 'legs',
      requestKey: 'capture_first_1',
    });
    const { token } = await issueUpload._handler(s.ctx, { submissionId: id });
    expect(
      await authorizeUpload._handler(s.ctx, { userId: 'alice', submissionId: id, token })
    ).toBe(true);
    expect(await authorizeUpload._handler(s.ctx, { userId: 'bob', submissionId: id, token })).toBe(
      false
    );
    expect(s.rows.dailyActivities).toBeUndefined();
    s.rows._storage = [
      { _id: 'old_media', _creationTime: 1, contentType: 'image/jpeg', size: 100 },
      { _id: 'fresh_media', _creationTime: Date.now() + 1, contentType: 'image/jpeg', size: 100 },
    ];
    await expect(
      attachUploadedInternal._handler(s.ctx, {
        userId: 'alice',
        submissionId: id,
        token,
        storageId: 'old_media',
      })
    ).rejects.toThrow('fresh camera');
    await expect(
      attachUploadedInternal._handler(s.ctx, {
        userId: 'alice',
        submissionId: id,
        token: 'wrong',
        storageId: 'fresh_media',
      })
    ).rejects.toThrow('Capture session');
    await cancel._handler(s.ctx, { submissionId: id });
    expect(s.rows.dailyActivities).toBeUndefined();
    const restartedCapture = await issueUpload._handler(s.ctx, { submissionId: id });
    expect(restartedCapture.token).not.toBe(token);
    expect(
      await authorizeUpload._handler(s.ctx, { userId: 'alice', submissionId: id, token })
    ).toBe(false);
    const b = fixture({ coachProofSubmissionsV1: s.rows.coachProofSubmissionsV1 }, 'bob');
    await expect(mySubmission._handler(b.ctx, { submissionId: id })).rejects.toThrow(
      'does not belong'
    );
    await expect(issueUpload._handler(b.ctx, { submissionId: id })).rejects.toThrow(
      'does not belong'
    );
    await expect(
      attachUploadedInternal._handler(b.ctx, {
        userId: 'bob',
        submissionId: id,
        token,
        storageId: 'fresh_media',
      })
    ).rejects.toThrow('does not belong');
  });

  test('uploaded proof survives a restart and plan refresh with its original context', async () => {
    const s = fixture();
    const id = await reserveProof._handler(s.ctx, {
      assignmentId: 'legs',
      requestKey: 'device_restart_1',
    });
    const { token } = await issueUpload._handler(s.ctx, { submissionId: id });
    s.rows._storage = [
      { _id: 'fresh_media', _creationTime: Date.now() + 1, contentType: 'image/jpeg', size: 100 },
    ];
    await attachUploadedInternal._handler(s.ctx, {
      userId: 'alice',
      submissionId: id,
      token,
      storageId: 'fresh_media',
    });
    expect(s.rows.posts).toBeUndefined();
    expect(s.rows.dailyActivities).toBeUndefined();
    s.rows.coachPlanRevisionsV1.push({ _id: 'new_plan', userId: 'alice', day, version: 2 });
    const restarted = fixture(s.rows);
    const saved = await mySubmission._handler(restarted.ctx, { submissionId: id });
    expect(saved).toMatchObject({
      state: 'uploaded',
      planRevisionId: 'plan_a',
      recommendation: '20-minute lower body strength workout',
      storageId: 'fresh_media',
    });
    expect(await complete._handler(restarted.ctx, { submissionId: id })).toMatchObject({
      pointsEarned: 5,
    });
    expect(restarted.rows.dailyActivities).toHaveLength(1);
  });

  test('Sleep and Steps have their fixed points and each successful category tracks once', async () => {
    const s = fixture();
    for (const [assignmentId, points] of [
      ['sleep_a', 4],
      ['steps_a', 3],
    ] as const) {
      const id = await reserveProof._handler(s.ctx, {
        assignmentId,
        requestKey: `capture_${assignmentId}`,
      });
      const { token } = await issueUpload._handler(s.ctx, { submissionId: id });
      const mediaId = `media_${assignmentId}`;
      (s.rows._storage ??= []).push({
        _id: mediaId,
        _creationTime: Date.now() + 1,
        contentType: 'image/jpeg',
        size: 100,
      });
      await attachUploadedInternal._handler(s.ctx, {
        userId: 'alice',
        submissionId: id,
        token,
        storageId: mediaId,
      });
      expect(await complete._handler(s.ctx, { submissionId: id })).toMatchObject({
        pointsEarned: points,
      });
    }
    expect(s.rows.dailyActivities.map((x) => x.displayTotalPoints)).toEqual([4, 3]);
    expect(s.calls.filter((x) => x === 'track')).toHaveLength(2);
    expect(s.rows.coachRewardSlotsV1.map((x) => x.key)).toEqual([
      `${day}:sleep:1`,
      `${day}:steps:1`,
    ]);
    const streakDays = await getStreakEarnedDatesInRange(s.ctx, 'alice', day, '9999-12-31');
    expect([...streakDays]).toEqual([day]);
  });

  test('one completion awards once, retains context, tracks one category and reversal consumes slot', async () => {
    const s = fixture();
    const id = await reserveProof._handler(s.ctx, {
      assignmentId: 'legs',
      requestKey: 'capture_first_1',
    });
    const { token } = await issueUpload._handler(s.ctx, { submissionId: id });
    s.rows._storage = [
      { _id: 'fresh_media', _creationTime: Date.now() + 1, contentType: 'image/jpeg', size: 100 },
    ];
    await attachUploadedInternal._handler(s.ctx, {
      userId: 'alice',
      submissionId: id,
      token,
      storageId: 'fresh_media',
    });
    await saveCaption._handler(s.ctx, { submissionId: id, caption: '  My workout  ' });
    const posted = await complete._handler(s.ctx, { submissionId: id, caption: 'My workout' });
    expect(posted).toMatchObject({ pointsEarned: 5 });
    expect(
      await complete._handler(s.ctx, { submissionId: id, caption: 'Changed on retry' })
    ).toEqual(posted);
    expect(s.rows.posts).toHaveLength(1);
    expect(s.rows.posts[0].body).toBe('My workout');
    expect(s.rows.coachProofSubmissionsV1.find((x) => x._id === id).caption).toBe('My workout');
    expect(s.rows.dailyActivities).toHaveLength(1);
    expect(s.rows.dailyActivities[0].coachSubmissionId).toBe(id);
    expect(s.rows.coachProofEventsV1).toHaveLength(1);
    expect(s.calls.filter((x) => x === 'track')).toHaveLength(1);
    await reverseMine._handler(s.ctx, { submissionId: id });
    await reverseMine._handler(s.ctx, { submissionId: id });
    expect(s.rows.dailyActivities[0].displayTotalPoints).toBe(0);
    expect(s.rows.coachRewardSlotsV1[0].state).toBe('earned');
    expect(s.rows.coachProofEventsV1).toHaveLength(2);
    await expect(
      reserveProof._handler(s.ctx, { assignmentId: 'legs', requestKey: 'capture_second_1' })
    ).rejects.toThrow('limit');
  });

  test('three meal slots reserve independently but cannot award before Stage 6 analysis/share', async () => {
    const s = fixture();
    const ids = [];
    for (let n = 1; n <= 3; n++) {
      const id = await reserveProof._handler(s.ctx, {
        assignmentId: 'meals_a',
        requestKey: `meal_capture_${n}`,
      });
      ids.push(id);
      // Stage 6 will consume a meal slot only after analysis and share.
      const slot = s.rows.coachRewardSlotsV1.find((x) => x.submissionId === id);
      slot.state = 'earned';
    }
    expect(new Set(ids).size).toBe(3);
    await expect(
      reserveProof._handler(s.ctx, { assignmentId: 'meals_a', requestKey: 'meal_capture_4' })
    ).rejects.toThrow('limit');
    await expect(complete._handler(s.ctx, { submissionId: ids[0] })).rejects.toThrow(
      'photo analysis'
    );
    expect(s.rows.dailyActivities).toBeUndefined();
  });

  test('old-client category and generic check-in claims are blocked by reserved new proof', async () => {
    const s = fixture({
      challenges: [{ _id: 'old_checkin', type: 'check_in', isPublished: true, points: 5 }],
    });
    await reserveProof._handler(s.ctx, { assignmentId: 'legs', requestKey: 'capture_first_1' });
    await expect(
      createPost._handler(s.ctx, {
        body: 'legacy',
        activityKey: 'gym_workout',
        activitySubmissionType: 'take_photo',
        media: 'photo',
        mediaType: 'image',
      })
    ).rejects.toThrow('reserved or completed');
    await expect(
      completeChallenge._handler(s.ctx, { challengeId: 'old_checkin', videoStorageId: 'video' })
    ).rejects.toThrow('plan check-in');
    expect(s.rows.dailyActivities).toBeUndefined();
  });

  test('an old-client reward consumes the stable slot even if its activity is later deleted', async () => {
    const s = fixture();
    await createPost._handler(s.ctx, {
      body: 'legacy workout',
      activityKey: 'gym_workout',
      activitySubmissionType: 'take_photo',
      media: 'photo',
      mediaType: 'image',
    });
    expect(s.rows.coachRewardSlotsV1[0]).toMatchObject({
      category: 'workout',
      state: 'legacy_consumed',
      key: `${day}:workout:1`,
    });
    s.rows.dailyActivities = []; // Simulate legacy post deletion; consumed slot remains.
    await expect(
      reserveProof._handler(s.ctx, { assignmentId: 'legs', requestKey: 'after_delete_1' })
    ).rejects.toThrow('limit');
  });
});
