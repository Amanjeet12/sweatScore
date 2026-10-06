// @ts-nocheck -- Bun Convex handler fixtures.
import { describe, expect, test } from 'bun:test';

import { validateMealResult, NON_MEAL_FEEDBACK } from '../convex/coachMealPolicy';
import { MEAL_SYSTEM_PROMPT } from '../convex/coachMealPrompt';
import { analyzeMealPhoto } from '../convex/coachMealProvider';
import {
  saveCaption,
  submitReportFeedback,
  myDraft,
  reserveScan,
  scanInput,
  claimDispatch,
  releaseScan,
  finishScan,
  share,
  retake,
  resetMyMealAnalysisCountForTesting,
} from '../convex/coachMeals';
import { getMondayInTZ, addDaysUTC, ymdUTC } from '../convex/utils/timezone';

const day = new Date().toISOString().slice(0, 10);
const examples = [
  {
    verdict: 'Room to improve',
    feedback:
      'Great protein choice and nice fresh greens. The jollof is taking up about half your plate, so next time aim for a smaller scoop about a quarter of the plate and make up the difference with more veg.',
  },
  {
    verdict: 'Nearly there',
    feedback:
      'Solid protein foundation and good veggies. The jollof is a little over a third of your plate, so next time a slightly smaller scoop and a bit more veg would get you there.',
  },
  {
    verdict: 'Nearly there',
    feedback:
      'That chicken and veg combination looks great. The rice and plantain are both carbs, and together they are taking over the plate. Next time keep them to a quarter between them, or swap to boiled plantain for a lighter side.',
  },
  {
    verdict: 'Room to improve',
    feedback:
      'That curry goat brings plenty of great protein. The rice and peas, the plantain, and the potato in the curry are all carbs, and together they make up the foundation of the meal. Next time pick one main carb, and load up the rest with cabbage or callaloo.',
  },
  {
    verdict: 'Nearly there',
    feedback:
      'The efo riro is rich with greens and quality protein. Since you trained today, the extra carbs will support your recovery, but on rest days aim to make the swallow the size of your fist.',
  },
  {
    verdict: 'On point',
    feedback:
      'Beautifully built plate. Plenty of greens, a good piece of fish, and just the right amount of rice for your goal.',
  },
];
function providerResponse(result: any) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      content: [{ type: 'tool_use', name: 'submit_meal_check', input: result }],
      usage: { input_tokens: 10, output_tokens: 20 },
    }),
  } as any;
}
function fixture(member = 'alice', extras: Record<string, any[]> = {}) {
  const rows: Record<string, any[]> = structuredClone({
    users: [
      { _id: 'alice', timezone: 'UTC' },
      { _id: 'bob', timezone: 'UTC' },
    ],
    coachBillingEntitlementsV1: [
      { _id: 'ea', userId: 'alice', status: 'active' },
      { _id: 'eb', userId: 'bob', status: 'active' },
    ],
    coachProofSubmissionsV1: [
      {
        _id: 'sub',
        userId: 'alice',
        day,
        assignmentId: 'assignment',
        planRevisionId: 'plan',
        category: 'meals',
        recommendation: 'Log a balanced meal',
        slotKey: `${day}:meals:1`,
        state: 'uploaded',
        storageId: 'photo',
        captureSource: 'live_camera',
      },
    ],
    coachAssignmentsV1: [
      {
        _id: 'assignment',
        userId: 'alice',
        day,
        category: 'meals',
        planRevisionId: 'plan',
        recommendation: 'Log a balanced meal',
      },
    ],
    coachPlanRevisionsV1: [{ _id: 'plan', userId: 'alice', day, requestId: 'req' }],
    coachPlanRequestsV1: [{ _id: 'req', userId: 'alice', profileRevisionId: 'profile' }],
    coachProfileRevisionsV1: [{ _id: 'profile', userId: 'alice', answers: { goal: 'lose' } }],
    coachRewardSlotsV1: [
      {
        _id: 'slot',
        userId: 'alice',
        day,
        category: 'meals',
        ordinal: 1,
        key: `${day}:meals:1`,
        state: 'reserved',
        submissionId: 'sub',
      },
    ],
    coachMealDraftsV1: [],
    coachMealScansV1: [],
    coachToneSettingsV1: [],
    dailyActivities: [],
    posts: [],
    coachProofEventsV1: [],
    ...extras,
  });
  let n = 0;
  const calls: string[] = [];
  const db: any = {
    get: async (id: string) =>
      Object.values(rows)
        .flat()
        .find((x) => x._id === id) ?? null,
    insert: async (table: string, value: any) => {
      const id = `${table}_${++n}`;
      (rows[table] ??= []).push({ _id: id, ...value });
      calls.push(`insert:${table}`);
      return id;
    },
    patch: async (id: string, value: any) => {
      const row = Object.values(rows)
        .flat()
        .find((x) => x._id === id);
      if (!row) throw Error(id);
      Object.assign(row, value);
      calls.push(`patch:${id}`);
    },
    query: (table: string) => {
      let found = [...(rows[table] ?? [])];
      const q: any = {
        withIndex: (_: string, cb?: any) => {
          const predicates: any[] = [];
          const ops: any = {};
          for (const op of ['eq', 'gte', 'lt'])
            ops[op] = (key: string, value: any) => {
              predicates.push([op, key, value]);
              return ops;
            };
          cb?.(ops);
          found = found.filter((row) =>
            predicates.every(([op, key, value]) =>
              op === 'eq' ? row[key] === value : op === 'gte' ? row[key] >= value : row[key] < value
            )
          );
          return q;
        },
        filter: (callback: any) => {
          const value = (term: any, row: any) => (typeof term === 'function' ? term(row) : term);
          const expressions = {
            field: (name: string) => (row: any) => row[name],
            eq: (left: any, right: any) => (row: any) => value(left, row) === value(right, row),
            neq: (left: any, right: any) => (row: any) => value(left, row) !== value(right, row),
            or:
              (...conditions: any[]) =>
              (row: any) =>
                conditions.some((condition) => condition(row)),
          };
          found = found.filter(callback(expressions));
          return q;
        },
        collect: async () => found,
        take: async (count: number) => found.slice(0, count),
        first: async () => found[0] ?? null,
        unique: async () => {
          if (found.length > 1) throw Error('not unique');
          return found[0] ?? null;
        },
        order: () => {
          found.reverse();
          return q;
        },
      };
      return q;
    },
  };
  const ctx: any = {
    db,
    auth: { getUserIdentity: async () => ({ subject: member }) },
    scheduler: { runAfter: async () => calls.push('leaderboard') },
    runMutation: async () => calls.push('track'),
  };
  return { rows, ctx, calls };
}

describe('client meal prompt and provider image contract', () => {
  test('all six supplied examples remain intact and pass the structural contract', () => {
    for (const example of examples) {
      expect(MEAL_SYSTEM_PROMPT).toContain(example.feedback);
      expect(validateMealResult(example)).toEqual(example);
    }
    expect(MEAL_SYSTEM_PROMPT).toContain('Bowl Depth & Layering');
    expect(MEAL_SYSTEM_PROMPT).toContain('Nigerian and other West African foods');
    expect(MEAL_SYSTEM_PROMPT).toContain('Do not call avocado olives');
    expect(MEAL_SYSTEM_PROMPT).toContain('egusi');
  });
  test('same actual image is sent first under each saved goal; no text-only surrogate', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    process.env.PROGRESS_COACH_MODEL = 'mock-model';
    for (const goal of ['lose', 'recomp', 'fitness', 'unavailable'] as const) {
      let body: any;
      const result = await analyzeMealPhoto({
        imageBase64: 'actual-photo-bytes',
        mediaType: 'image/jpeg',
        goal,
        workoutLoggedToday: false,
        style: { tone: 'supportive', detail: 'concise' },
        fetchImpl: async (_url, init) => {
          body = JSON.parse(init!.body as string);
          return providerResponse(examples[0]);
        },
      });
      expect(result.ok).toBe(true);
      expect(body.messages[0].content[0].source.data).toBe('actual-photo-bytes');
      expect(JSON.parse(body.messages[0].content[1].text).goal).toBe(goal);
      expect(body.system[0].text).toBe(MEAL_SYSTEM_PROMPT);
    }
  });
  test('non-meal, unclear, layered bowl, stacked starch, pain and workout wording validation', () => {
    expect(validateMealResult({ verdict: null, feedback: NON_MEAL_FEEDBACK })?.verdict).toBe(null);
    expect(
      validateMealResult({
        verdict: 'Nearly there',
        feedback: 'I cannot see the food clearly. Next time aim for a quarter bowl of carbs.',
      })?.verdict
    ).toBe('Nearly there');
    expect(validateMealResult({ verdict: null, feedback: 'Maybe a meal' })).toBeNull();
    expect(
      validateMealResult({ verdict: 'On point', feedback: 'Great food. Count your macros.' })
    ).toBeNull();
    expect(examples[2].feedback).toContain('rice and plantain');
    expect(examples[4].feedback).toContain('trained today');
  });
  test('provider timeout and invalid output retain safe errors', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    process.env.PROGRESS_COACH_MODEL = 'mock-model';
    const input = {
      imageBase64: 'photo',
      mediaType: 'image/jpeg' as const,
      goal: 'lose' as const,
      workoutLoggedToday: false,
      style: { tone: 'supportive', detail: 'concise' },
    };
    expect(
      (
        await analyzeMealPhoto({
          ...input,
          fetchImpl: async () => providerResponse({ verdict: null, feedback: 'wrong' }),
        })
      ).ok
    ).toBe(false);
  });
  test('one invalid structured response is repaired within the same analysis action', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    process.env.PROGRESS_COACH_MODEL = 'mock-model';
    let calls = 0;
    const result = await analyzeMealPhoto({
      imageBase64: 'photo',
      mediaType: 'image/jpeg',
      goal: 'lose',
      workoutLoggedToday: false,
      style: { tone: 'warm_direct', detail: 'concise' },
      fetchImpl: async () => {
        calls++;
        return providerResponse(
          calls === 1 ? { verdict: 'On point', feedback: 'Count macros.' } : examples[5]
        );
      },
    });
    expect(calls).toBe(2);
    expect(result).toMatchObject({
      ok: true,
      result: examples[5],
      inputTokens: 20,
      outputTokens: 40,
    });
  });
  test('provider timeout reports a safe code without accepting a plan or meal', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    process.env.PROGRESS_COACH_MODEL = 'mock-model';
    process.env.COACH_V1_TIMEOUT_MS = '1000';
    const result = await analyzeMealPhoto({
      imageBase64: 'photo',
      mediaType: 'image/jpeg',
      goal: 'lose',
      workoutLoggedToday: false,
      style: { tone: 'warm_direct', detail: 'concise' },
      fetchImpl: async (_url, init) =>
        new Promise((_resolve, reject) =>
          init!.signal!.addEventListener('abort', () => reject(new Error('aborted')))
        ),
    });
    expect(result).toMatchObject({ ok: false, code: 'provider_timeout' });
    delete process.env.COACH_V1_TIMEOUT_MS;
  });
});

describe('meal draft, scan and share transactions', () => {
  test('a meal can be shared without AI or a generated plan', async () => {
    const f = fixture('alice', {
      coachPlanRevisionsV1: [],
      coachAssignmentsV1: [
        {
          _id: 'assignment',
          userId: 'alice',
          day,
          category: 'meals',
          recommendation: 'Log a meal',
        },
      ],
      coachProofSubmissionsV1: [
        {
          _id: 'sub',
          userId: 'alice',
          day,
          assignmentId: 'assignment',
          category: 'meals',
          recommendation: 'Log a meal',
          slotKey: `${day}:meals:1`,
          state: 'uploaded',
          storageId: 'photo',
          captureSource: 'live_camera',
        },
      ],
    });
    const draftId = await saveCaption._handler(f.ctx, { submissionId: 'sub', caption: 'My meal' });
    expect(f.rows.coachMealDraftsV1[0].goal).toBe('unavailable');
    expect(
      await share._handler(f.ctx, { draftId, caption: 'My meal', skipAnalysis: true })
    ).toMatchObject({ pointsEarned: 2 });
  });
  test('a meal can receive private AI feedback before a plan exists', async () => {
    const f = fixture('alice', {
      coachPlanRevisionsV1: [],
      coachAssignmentsV1: [
        {
          _id: 'assignment',
          userId: 'alice',
          day,
          category: 'meals',
          recommendation: 'Log a meal',
        },
      ],
      coachProofSubmissionsV1: [
        {
          _id: 'sub',
          userId: 'alice',
          day,
          assignmentId: 'assignment',
          category: 'meals',
          recommendation: 'Log a meal',
          slotKey: `${day}:meals:1`,
          state: 'uploaded',
          storageId: 'photo',
          captureSource: 'live_camera',
        },
      ],
    });
    const draftId = await saveCaption._handler(f.ctx, { submissionId: 'sub', caption: 'My meal' });
    const scanId = await reserveScan._handler(f.ctx, {
      userId: 'alice',
      draftId,
      requestKey: 'no_plan_scan',
    });
    await claimDispatch._handler(f.ctx, { userId: 'alice', scanId });
    await finishScan._handler(f.ctx, {
      userId: 'alice',
      scanId,
      result: examples[5],
      latencyMs: 10,
    });
    expect(f.rows.coachMealDraftsV1[0].verdict).toBe('On point');
    expect(await share._handler(f.ctx, { draftId, caption: 'My meal' })).toMatchObject({
      pointsEarned: 2,
    });
  });
  test('saved context uses completed workout, not planned workout; capture and draft award nothing', async () => {
    const f = fixture();
    const id = await saveCaption._handler(f.ctx, { submissionId: 'sub', caption: 'My plate' });
    expect(f.rows.coachMealDraftsV1[0].goal).toBe('lose');
    expect(f.rows.coachMealDraftsV1[0].workoutLoggedToday).toBe(false);
    expect(f.rows.dailyActivities).toHaveLength(0);
    expect(f.rows.posts).toHaveLength(0);
    const f2 = fixture('alice', {
      dailyActivities: [
        {
          _id: 'workout',
          userId: 'alice',
          date: day,
          loggedActivityKey: 'workout',
          reviewStatus: 'approved',
        },
      ],
    });
    await saveCaption._handler(f2.ctx, { submissionId: 'sub', caption: '' });
    expect(f2.rows.coachMealDraftsV1[0].workoutLoggedToday).toBe(true);
  });
  test('meal-only tone is selected and completed workout is refreshed at scan reservation', async () => {
    const f = fixture('alice', {
      coachToneSettingsV1: [
        {
          _id: 'daily_tone',
          version: 2,
          tone: 'upbeat_encouraging',
          detail: 'standard',
          scope: 'daily_plan',
        },
        {
          _id: 'meal_tone',
          version: 1,
          tone: 'calm_reassuring',
          detail: 'concise',
          scope: 'meal_feedback',
        },
      ],
    });
    const draftId = await saveCaption._handler(f.ctx, { submissionId: 'sub', caption: '' });
    expect(f.rows.coachMealDraftsV1[0].tone).toBe('calm_reassuring');
    f.rows.dailyActivities.push({
      _id: 'completed',
      userId: 'alice',
      date: day,
      loggedActivityKey: 'gym_workout',
      reviewStatus: 'approved',
    });
    const scanId = await reserveScan._handler(f.ctx, {
      userId: 'alice',
      draftId,
      requestKey: 'scan_one',
    });
    expect(f.rows.coachMealDraftsV1[0].workoutLoggedToday).toBe(true);
    expect(f.rows.coachMealDraftsV1[0].toneVersion).toBe(1);
    f.rows.coachToneSettingsV1.push({
      _id: 'later_meal_tone',
      version: 3,
      tone: 'upbeat_encouraging',
      detail: 'standard',
      scope: 'meal_feedback',
    });
    const inFlight = await scanInput._handler(f.ctx, { userId: 'alice', scanId });
    expect(inFlight.draft.toneVersion).toBe(1);
    expect(inFlight.draft.tone).toBe('calm_reassuring');
  });
  test('member ownership and duplicate reservation; failed dispatches do not use successful scans', async () => {
    const f = fixture();
    const draftId = await saveCaption._handler(f.ctx, { submissionId: 'sub', caption: '' });
    const first = await reserveScan._handler(f.ctx, {
      userId: 'alice',
      draftId,
      requestKey: 'scan_one',
    });
    expect(
      await reserveScan._handler(f.ctx, { userId: 'alice', draftId, requestKey: 'scan_one' })
    ).toBe(first);
    await expect(
      reserveScan._handler(f.ctx, { userId: 'bob', draftId, requestKey: 'scan_bob' })
    ).rejects.toThrow();
    for (const [i, key] of ['scan_one', 'scan_two', 'scan_three'].entries()) {
      const id =
        i === 0
          ? first
          : await reserveScan._handler(f.ctx, { userId: 'alice', draftId, requestKey: key });
      expect(await claimDispatch._handler(f.ctx, { userId: 'alice', scanId: id })).toBe(true);
      await finishScan._handler(f.ctx, {
        userId: 'alice',
        scanId: id,
        errorCode: 'provider_timeout',
        latencyMs: 100,
      });
    }
    expect(f.rows.coachMealScansV1.filter((s) => s.dispatchedAt)).toHaveLength(3);
    const fourth = await reserveScan._handler(f.ctx, {
      userId: 'alice',
      draftId,
      requestKey: 'scan_four',
    });
    expect(fourth).toBeTruthy();
    await releaseScan._handler(f.ctx, { userId: 'alice', scanId: fourth });
    expect((await myDraft._handler(f.ctx, { submissionId: 'sub' })).scanCount).toBe(0);
    const unclear = await reserveScan._handler(f.ctx, {
      userId: 'alice',
      draftId,
      requestKey: 'scan_unclear',
    });
    await claimDispatch._handler(f.ctx, { userId: 'alice', scanId: unclear });
    expect(
      await finishScan._handler(f.ctx, {
        userId: 'alice',
        scanId: unclear,
        result: {
          verdict: 'Nearly there',
          feedback: 'I cannot see the food clearly enough to assess the portion.',
        },
        latencyMs: 20,
      })
    ).toBe('unclear');
    expect((await myDraft._handler(f.ctx, { submissionId: 'sub' })).scanCount).toBe(0);
    expect(f.rows.posts).toHaveLength(0);
  });
  test('timeout, network, invalid output, release and non-meal results leave the successful allowance intact', async () => {
    for (const errorCode of ['provider_timeout', 'provider_unavailable', 'invalid_output']) {
      const f = fixture();
      const draftId = await saveCaption._handler(f.ctx, { submissionId: 'sub', caption: 'Saved' });
      const scanId = await reserveScan._handler(f.ctx, {
        userId: 'alice',
        draftId,
        requestKey: `scan_${errorCode}`,
      });
      await claimDispatch._handler(f.ctx, { userId: 'alice', scanId });
      await finishScan._handler(f.ctx, { userId: 'alice', scanId, errorCode, latencyMs: 20 });
      expect((await myDraft._handler(f.ctx, { submissionId: 'sub' })).scanCount).toBe(0);
      expect(
        await reserveScan._handler(f.ctx, {
          userId: 'alice',
          draftId,
          requestKey: `retry_${errorCode}`,
        })
      ).toBeTruthy();
    }
    const f = fixture();
    const draftId = await saveCaption._handler(f.ctx, { submissionId: 'sub', caption: 'Saved' });
    const released = await reserveScan._handler(f.ctx, {
      userId: 'alice',
      draftId,
      requestKey: 'scan_released',
    });
    await releaseScan._handler(f.ctx, { userId: 'alice', scanId: released });
    expect((await myDraft._handler(f.ctx, { submissionId: 'sub' })).scanCount).toBe(0);
    const nonMeal = await reserveScan._handler(f.ctx, {
      userId: 'alice',
      draftId,
      requestKey: 'scan_nonmeal',
    });
    await claimDispatch._handler(f.ctx, { userId: 'alice', scanId: nonMeal });
    await finishScan._handler(f.ctx, {
      userId: 'alice',
      scanId: nonMeal,
      result: { verdict: null, feedback: NON_MEAL_FEEDBACK },
      latencyMs: 20,
    });
    expect((await myDraft._handler(f.ctx, { submissionId: 'sub' })).scanCount).toBe(0);
  });
  test('provider-cost throttle is distinct from the three successful meal scans', async () => {
    const f = fixture();
    const draftId = await saveCaption._handler(f.ctx, { submissionId: 'sub', caption: 'Saved' });
    for (let n = 0; n < 8; n++) {
      const scanId = await reserveScan._handler(f.ctx, {
        userId: 'alice',
        draftId,
        requestKey: `failed_${n}`,
      });
      await claimDispatch._handler(f.ctx, { userId: 'alice', scanId });
      await finishScan._handler(f.ctx, {
        userId: 'alice',
        scanId,
        errorCode: 'provider_timeout',
        latencyMs: 20,
      });
    }
    expect((await myDraft._handler(f.ctx, { submissionId: 'sub' })).scanCount).toBe(0);
    await expect(
      reserveScan._handler(f.ctx, { userId: 'alice', draftId, requestKey: 'attempt_nine' })
    ).rejects.toThrow('successful scan allowance is unchanged');
    for (const scan of f.rows.coachMealScansV1) scan.dispatchedAt = Date.now() - 3_600_001;
    expect(
      await reserveScan._handler(f.ctx, { userId: 'alice', draftId, requestKey: 'after_hour' })
    ).toBeTruthy();
  });
  test('three in-flight scans reserve the three possible successes across devices', async () => {
    const f = fixture();
    const pending: string[] = [];
    for (let ordinal = 1; ordinal <= 4; ordinal++) {
      const subId = ordinal === 1 ? 'sub' : `sub${ordinal}`;
      if (ordinal > 1)
        f.rows.coachProofSubmissionsV1.push({
          ...f.rows.coachProofSubmissionsV1[0],
          _id: subId,
          storageId: `photo${ordinal}`,
          slotKey: `${day}:meals:${ordinal}`,
        });
      const draftId = await saveCaption._handler(f.ctx, {
        submissionId: subId,
        caption: `Meal ${ordinal}`,
      });
      if (ordinal === 4) {
        await expect(
          reserveScan._handler(f.ctx, { userId: 'alice', draftId, requestKey: 'scan_fourth' })
        ).rejects.toThrow('in progress');
      } else
        pending.push(
          await reserveScan._handler(f.ctx, {
            userId: 'alice',
            draftId,
            requestKey: `scan_${ordinal}`,
          })
        );
    }
    for (const scanId of pending) {
      expect(await claimDispatch._handler(f.ctx, { userId: 'alice', scanId })).toBe(true);
      await finishScan._handler(f.ctx, {
        userId: 'alice',
        scanId,
        result: examples[5],
        latencyMs: 20,
      });
    }
    const allowance = await myDraft._handler(f.ctx, { submissionId: 'sub' });
    expect(allowance.scanCount).toBe(3);
    expect(allowance.analysisLimitReached).toBe(true);
    expect(allowance.analysisChecksRemaining).toBe(0);
  });
  test('development reset restores only today meal AI allowance', async () => {
    const original = process.env.CONVEX_CLOUD_URL;
    process.env.CONVEX_CLOUD_URL = 'https://beloved-stoat-88.convex.cloud';
    try {
      const f = fixture();
      const draftId = await saveCaption._handler(f.ctx, {
        submissionId: 'sub',
        caption: 'Saved meal',
      });
      const scanId = await reserveScan._handler(f.ctx, {
        userId: 'alice',
        draftId,
        requestKey: 'scan_reset',
      });
      expect(await claimDispatch._handler(f.ctx, { userId: 'alice', scanId })).toBe(true);
      await finishScan._handler(f.ctx, {
        userId: 'alice',
        scanId,
        result: examples[5],
        latencyMs: 20,
      });
      const before = structuredClone(f.rows);
      const result = await resetMyMealAnalysisCountForTesting._handler(f.ctx, {});
      expect(result).toEqual({ day, scansReset: 1 });
      expect(f.rows.coachMealScansV1[0].usable).toBe(false);
      expect((await myDraft._handler(f.ctx, { submissionId: 'sub' })).scanCount).toBe(0);
      expect(f.rows.coachProofSubmissionsV1).toEqual(before.coachProofSubmissionsV1);
      expect(f.rows.dailyActivities).toEqual(before.dailyActivities);
      expect(f.rows.posts).toEqual(before.posts);
    } finally {
      process.env.CONVEX_CLOUD_URL = original;
    }
  });
  test('meal AI reset is rejected outside the approved development deployment', async () => {
    const original = process.env.CONVEX_CLOUD_URL;
    process.env.CONVEX_CLOUD_URL = 'https://production.convex.cloud';
    try {
      await expect(resetMyMealAnalysisCountForTesting._handler(fixture().ctx, {})).rejects.toThrow(
        'approved development deployment'
      );
    } finally {
      process.env.CONVEX_CLOUD_URL = original;
    }
  });
  test('a stranded dispatch counts once and a late result cannot replace its retry', async () => {
    const f = fixture();
    const draftId = await saveCaption._handler(f.ctx, { submissionId: 'sub', caption: 'Saved' });
    const old = await reserveScan._handler(f.ctx, {
      userId: 'alice',
      draftId,
      requestKey: 'scan_old',
    });
    await claimDispatch._handler(f.ctx, { userId: 'alice', scanId: old });
    f.rows.coachMealScansV1[0].dispatchedAt = Date.now() - 61000;
    const retry = await reserveScan._handler(f.ctx, {
      userId: 'alice',
      draftId,
      requestKey: 'scan_retry',
    });
    expect(f.rows.coachMealScansV1[0].status).toBe('failed');
    expect(await claimDispatch._handler(f.ctx, { userId: 'alice', scanId: retry })).toBe(true);
    await finishScan._handler(f.ctx, {
      userId: 'alice',
      scanId: old,
      result: examples[0],
      latencyMs: 61000,
    });
    expect(f.rows.coachMealDraftsV1[0].status).toBe('analyzing');
    await finishScan._handler(f.ctx, {
      userId: 'alice',
      scanId: retry,
      result: examples[5],
      latencyMs: 10,
    });
    expect(f.rows.coachMealDraftsV1[0].verdict).toBe('On point');
  });
  test('successful share is one transaction and a duplicate returns the same IDs', async () => {
    const f = fixture();
    const draftId = await saveCaption._handler(f.ctx, { submissionId: 'sub', caption: 'Before' });
    const scanId = await reserveScan._handler(f.ctx, {
      userId: 'alice',
      draftId,
      requestKey: 'scan_one',
    });
    await claimDispatch._handler(f.ctx, { userId: 'alice', scanId });
    await finishScan._handler(f.ctx, {
      userId: 'alice',
      scanId,
      result: examples[0],
      latencyMs: 10,
    });
    const first = await share._handler(f.ctx, { draftId, caption: 'Final caption' });
    expect(first.pointsEarned).toBe(2);
    expect(f.rows.posts[0].body).toBe('Final caption');
    expect(f.rows.posts[0].body).not.toContain(examples[0].feedback);
    expect(f.rows.dailyActivities).toHaveLength(1);
    expect(await share._handler(f.ctx, { draftId, caption: 'Changed' })).toEqual(first);
    expect(f.rows.posts).toHaveLength(1);
    expect(f.rows.coachRewardSlotsV1[0].state).toBe('earned');
  });
  test('a meal completing the fifth streak date returns the weekly milestone only once', async () => {
    const monday = getMondayInTZ(new Date(`${day}T12:00:00Z`), 'UTC');
    const otherDays = Array.from({ length: 7 }, (_, i) => ymdUTC(addDaysUTC(monday, i)))
      .filter((date) => date !== day)
      .slice(0, 4);
    const f = fixture('alice', {
      dailyActivities: otherDays.map((date, i) => ({
        _id: `prior_${i}`,
        userId: 'alice',
        date,
        loggedActivityKey: 'workout',
        reviewStatus: 'approved',
      })),
    });
    const draftId = await saveCaption._handler(f.ctx, { submissionId: 'sub', caption: 'Meal' });
    const result = await share._handler(f.ctx, { draftId, caption: 'Meal', skipAnalysis: true });
    expect(result.milestones).toEqual([
      { type: 'weekly_target', current: 5, target: 5, key: ymdUTC(monday) },
    ]);
    expect(
      (await share._handler(f.ctx, { draftId, caption: 'Meal', skipAnalysis: true })).milestones
    ).toEqual([]);
    expect(f.rows.userMilestones).toHaveLength(1);
  });

  test('a member can share an uploaded live meal without using AI analysis', async () => {
    const f = fixture();
    const draftId = await saveCaption._handler(f.ctx, {
      submissionId: 'sub',
      caption: 'My meal today',
    });
    const shared = await share._handler(f.ctx, {
      draftId,
      caption: 'My meal today',
      skipAnalysis: true,
    });
    expect(shared.pointsEarned).toBe(2);
    expect(f.rows.coachMealScansV1).toHaveLength(0);
    expect(f.rows.posts[0].body).toBe('My meal today');
    expect(f.rows.coachMealDraftsV1[0]).toMatchObject({ status: 'shared' });
  });
  test('non-meal and failed analysis cannot share; retake retains scan history and no award', async () => {
    const f = fixture();
    const draftId = await saveCaption._handler(f.ctx, { submissionId: 'sub', caption: 'Plate' });
    const scanId = await reserveScan._handler(f.ctx, {
      userId: 'alice',
      draftId,
      requestKey: 'scan_one',
    });
    await claimDispatch._handler(f.ctx, { userId: 'alice', scanId });
    await finishScan._handler(f.ctx, {
      userId: 'alice',
      scanId,
      result: { verdict: null, feedback: NON_MEAL_FEEDBACK },
      latencyMs: 10,
    });
    await expect(share._handler(f.ctx, { draftId, caption: 'No' })).rejects.toThrow();
    await retake._handler(f.ctx, { submissionId: 'sub' });
    expect(f.rows.coachMealDraftsV1[0].status).toBe('superseded');
    expect(f.rows.coachMealScansV1[0].dispatchedAt).toBeTruthy();
    expect(f.rows.posts).toHaveLength(0);
  });
  test('three distinct shared meals use slots one through three; fourth has no slot', async () => {
    const f = fixture();
    for (let ordinal = 1; ordinal <= 3; ordinal++) {
      const subId = ordinal === 1 ? 'sub' : `sub${ordinal}`;
      const storageId = ordinal === 1 ? 'photo' : `photo${ordinal}`;
      if (ordinal > 1) {
        f.rows.coachProofSubmissionsV1.push({
          _id: subId,
          userId: 'alice',
          day,
          assignmentId: 'assignment',
          planRevisionId: 'plan',
          category: 'meals',
          recommendation: 'Log a balanced meal',
          slotKey: `${day}:meals:${ordinal}`,
          state: 'uploaded',
          storageId,
          captureSource: 'live_camera',
        });
        f.rows.coachRewardSlotsV1.push({
          _id: `slot${ordinal}`,
          userId: 'alice',
          day,
          category: 'meals',
          ordinal,
          key: `${day}:meals:${ordinal}`,
          state: 'reserved',
          submissionId: subId,
        });
      }
      const draftId = await saveCaption._handler(f.ctx, {
        submissionId: subId,
        caption: `Plate ${ordinal}`,
      });
      const scanId = await reserveScan._handler(f.ctx, {
        userId: 'alice',
        draftId,
        requestKey: `request_${ordinal}`,
      });
      await claimDispatch._handler(f.ctx, { userId: 'alice', scanId });
      await finishScan._handler(f.ctx, {
        userId: 'alice',
        scanId,
        result: examples[5],
        latencyMs: 10,
      });
      expect(
        (await share._handler(f.ctx, { draftId, caption: `Plate ${ordinal}` })).pointsEarned
      ).toBe(2);
    }
    expect(f.rows.posts).toHaveLength(3);
    expect(f.rows.dailyActivities.reduce((sum, x) => sum + x.points, 0)).toBe(6);
    const fourth = {
      ...f.rows.coachProofSubmissionsV1[0],
      _id: 'sub4',
      storageId: 'photo4',
      slotKey: `${day}:meals:4`,
      state: 'uploaded',
    };
    f.rows.coachProofSubmissionsV1.push(fourth);
    f.rows.coachRewardSlotsV1.push({
      _id: 'slot4',
      userId: 'alice',
      day,
      category: 'meals',
      ordinal: 4,
      key: fourth.slotKey,
      state: 'reserved',
      submissionId: 'sub4',
    });
    const draftId = await saveCaption._handler(f.ctx, { submissionId: 'sub4', caption: '' });
    await expect(
      reserveScan._handler(f.ctx, { userId: 'alice', draftId, requestKey: 'request_four' })
    ).rejects.toThrow();
    expect(f.rows.posts).toHaveLength(3);
  });
  test('restart retains uploaded photo, caption, result and pinned revision; another member cannot edit', async () => {
    const f = fixture();
    const draftId = await saveCaption._handler(f.ctx, {
      submissionId: 'sub',
      caption: 'Saved caption',
    });
    const scanId = await reserveScan._handler(f.ctx, {
      userId: 'alice',
      draftId,
      requestKey: 'scan_one',
    });
    await claimDispatch._handler(f.ctx, { userId: 'alice', scanId });
    await finishScan._handler(f.ctx, {
      userId: 'alice',
      scanId,
      result: examples[5],
      latencyMs: 10,
    });
    expect(f.rows.coachMealDraftsV1[0]).toMatchObject({
      storageId: 'photo',
      caption: 'Saved caption',
      planRevisionId: 'plan',
      status: 'ready',
    });
    const bob = fixture('bob', f.rows);
    await expect(
      saveCaption._handler(bob.ctx, { submissionId: 'sub', caption: 'Forgery' })
    ).rejects.toThrow();
  });
});

describe('private meal report feedback', () => {
  test('only the owner can rate a finished report, with bounded corrections', async () => {
    const { ctx, rows } = fixture('alice', {
      coachMealDraftsV1: [
        { _id: 'report', userId: 'alice', status: 'ready', feedback: 'Nice plate.' },
        { _id: 'other', userId: 'bob', status: 'ready', feedback: 'Nice plate.' },
        { _id: 'pending', userId: 'alice', status: 'analyzing' },
      ],
    });
    await submitReportFeedback._handler(ctx, {
      draftId: 'report',
      helpful: false,
      correction: '  This was avocado.  ',
    });
    expect(rows.coachMealDraftsV1[0].memberCorrection).toBe('This was avocado.');
    await expect(
      submitReportFeedback._handler(ctx, { draftId: 'other', helpful: true })
    ).rejects.toThrow();
    await expect(
      submitReportFeedback._handler(ctx, { draftId: 'pending', helpful: true })
    ).rejects.toThrow();
    await expect(
      submitReportFeedback._handler(ctx, {
        draftId: 'report',
        helpful: false,
        correction: 'x'.repeat(501),
      })
    ).rejects.toThrow();
  });
  test('provider receives member feedback as context alongside the current image', async () => {
    let body;
    const memberFeedback = [{ helpful: false, correction: 'This was avocado.', report: 'Olives.' }];
    await analyzeMealPhoto({
      imageBase64: 'current-photo',
      mediaType: 'image/jpeg',
      goal: 'lose',
      workoutLoggedToday: false,
      style: { tone: 'supportive', detail: 'concise' },
      memberFeedback,
      fetchImpl: async (_url, init) => {
        body = JSON.parse(init.body);
        return providerResponse(examples[0]);
      },
    });
    expect(JSON.parse(body.messages[0].content[1].text).member_feedback).toEqual(memberFeedback);
    expect(body.messages[0].content[0].source.data).toBe('current-photo');
    expect(body.system.some((block) => block.text.includes('untrusted personal context'))).toBe(
      true
    );
  });
});

test('scan context excludes other members feedback and limits history', async () => {
  const { ctx } = fixture('alice', {
    coachMealDraftsV1: [
      { _id: 'current', userId: 'alice' },
      ...Array.from({ length: 10 }, (_, i) => ({
        _id: `a${i}`,
        userId: 'alice',
        feedback: `report${i}`,
        memberHelpful: false,
        memberFeedbackAt: i,
      })),
      { _id: 'private', userId: 'bob', feedback: 'private report', memberHelpful: true },
    ],
    coachMealScansV1: [{ _id: 'scan', userId: 'alice', draftId: 'current' }],
  });
  const result = await scanInput._handler(ctx, { userId: 'alice', scanId: 'scan' });
  expect(result.memberFeedback).toHaveLength(8);
  expect(result.memberFeedback[0].report).toBe('report9');
  expect(result.memberFeedback.some((item) => item.report === 'private report')).toBe(false);
});

test('retake A then analyze and share B never revives A or exposes private correction', async () => {
  const f = fixture();
  const draftA = await saveCaption._handler(f.ctx, { submissionId: 'sub', caption: 'A' });
  const scanA = await reserveScan._handler(f.ctx, {
    userId: 'alice',
    draftId: draftA,
    requestKey: 'scan_photo_a',
  });
  await claimDispatch._handler(f.ctx, { userId: 'alice', scanId: scanA });
  await finishScan._handler(f.ctx, {
    userId: 'alice',
    scanId: scanA,
    result: examples[0],
    latencyMs: 10,
  });
  await retake._handler(f.ctx, { submissionId: 'sub' });
  await f.ctx.db.patch('sub', { state: 'uploaded', storageId: 'photo-B' });
  const draftB = await saveCaption._handler(f.ctx, { submissionId: 'sub', caption: 'Public B' });
  expect(draftB).not.toBe(draftA);
  const scanB = await reserveScan._handler(f.ctx, {
    userId: 'alice',
    draftId: draftB,
    requestKey: 'scan_photo_b',
  });
  await claimDispatch._handler(f.ctx, { userId: 'alice', scanId: scanB });
  expect(
    await finishScan._handler(f.ctx, {
      userId: 'alice',
      scanId: scanA,
      result: examples[5],
      latencyMs: 99,
    })
  ).toBe('ignored');
  const before = await myDraft._handler(f.ctx, { submissionId: 'sub' });
  expect(before.draft._id).toBe(draftB);
  expect(before.draft.feedback).toBeUndefined();
  await finishScan._handler(f.ctx, {
    userId: 'alice',
    scanId: scanB,
    result: examples[5],
    latencyMs: 10,
  });
  await share._handler(f.ctx, { draftId: draftB, caption: 'Public B' });
  await submitReportFeedback._handler(f.ctx, {
    draftId: draftB,
    helpful: false,
    correction: 'PRIVATE CORRECTION',
  });
  expect(f.rows.posts).toHaveLength(1);
  expect(f.rows.posts[0].media).toBe('photo-B');
  expect(f.rows.posts[0].body).toBe('Public B');
  expect(JSON.stringify(f.rows.posts)).not.toContain('PRIVATE CORRECTION');
  expect(JSON.stringify(f.rows.dailyActivities)).not.toContain('PRIVATE CORRECTION');
  const stored = f.rows.coachMealDraftsV1.find((d) => d._id === draftB);
  const firstFeedbackAt = stored.memberFeedbackAt;
  stored.memberFeedbackAt = firstFeedbackAt - 1000;
  await submitReportFeedback._handler(f.ctx, {
    draftId: draftB,
    helpful: false,
    correction: '  PRIVATE CORRECTION  ',
  });
  expect(stored.memberFeedbackAt).toBe(firstFeedbackAt - 1000); // no repeated write on retry
});

test('a dispatched result cannot attach to media that no longer matches its draft', async () => {
  const f = fixture();
  const draftId = await saveCaption._handler(f.ctx, { submissionId: 'sub', caption: 'A' });
  const scanId = await reserveScan._handler(f.ctx, {
    userId: 'alice',
    draftId,
    requestKey: 'scan_old_photo',
  });
  await claimDispatch._handler(f.ctx, { userId: 'alice', scanId });
  // Simulate an obsolete provider response crossing a media transition.
  await f.ctx.db.patch('sub', { storageId: 'photo-B' });
  expect(
    await finishScan._handler(f.ctx, {
      userId: 'alice',
      scanId,
      result: examples[0],
      latencyMs: 10,
    })
  ).toBe('ignored');
  expect(f.rows.coachMealDraftsV1[0].feedback).toBeUndefined();
});
