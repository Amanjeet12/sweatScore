// @ts-nocheck -- Bun Convex handler fixtures.
import { describe, expect, test } from 'bun:test';

import { validateMealResult, checkMealResult, NON_MEAL_FEEDBACK } from '../convex/coachMealPolicy';
import { MEAL_SYSTEM_PROMPT } from '../convex/coachMealPrompt';
import {
  CLIENT_MEAL_UPDATE,
  MEAL_SYSTEM_PROMPT as ACTIVE_MEAL_PROMPT,
} from '../convex/coachMealPromptV2';
import { analyzeMealPhoto } from '../convex/coachMealProvider';
import {
  saveCaption,
  submitReportFeedback,
  myDraft,
  myTodayMeals,
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
const historicalExamples = [
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
const examples = [
  {
    verdict: 'Nearly there',
    feedback:
      'Lovely plate, beans and plantain is a proper classic. Keep the plantain to 3 or 4 slices and add an egg or some fish so the meal keeps you full for longer.',
  },
  {
    verdict: 'Nearly there',
    feedback:
      'Great choice, that spiced beans topping looks tasty. Keep to about 4 slices of plantain and add a palm of fish, egg or chicken to lift the protein.',
  },
  {
    verdict: 'Nearly there',
    feedback:
      'That chicken and veg combination looks tasty. Keep the rice and plantain together to about a quarter of the plate next time.',
  },
  {
    verdict: 'Room to improve',
    feedback:
      'Your goat provides protein alongside the rice and plantain. Next time reduce the combined carbs by about a quarter, keeping the same dish.',
  },
  {
    verdict: 'Nearly there',
    feedback:
      'The efo riro has greens and protein. Next time keep the swallow to about a fist, reducing this portion by about a quarter.',
  },
  {
    verdict: 'On point',
    feedback:
      'Nice balanced plate, the chicken and salad are doing their job. The rice portion looks right for you today, so enjoy it.',
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
  test('current goal wording and separate portion guidance satisfy the same safety rules', () => {
    for (const goal of ['weight loss', 'body recomp', 'improving fitness']) {
      const report = {
        verdict: 'On point',
        feedback: `Your protein and vegetables support ${goal}. The carb portion fits the guide, so keep this balance.`,
        nextMeal:
          'For your next meal, aim for one palm of protein, about a third of your plate as carbs and the rest vegetables.',
      };
      expect(checkMealResult(report)).toEqual({ ok: true, result: report });
    }
    expect(ACTIVE_MEAL_PROMPT).not.toContain('with only verdict and feedback');
    expect(
      checkMealResult({
        ...examples[0],
        nextMeal: 'For your next meal, add chicken and rice.',
      })
    ).toEqual({ ok: false, issue: 'next_meal_guidance' });
    expect(
      validateMealResult({
        ...examples[0],
        feedback: 'Your plate supports maintaining weight. Keep the same balance.',
      })
    ).toBeNull();
    expect(
      validateMealResult({
        verdict: null,
        feedback: NON_MEAL_FEEDBACK,
        nextMeal: '',
      })
    ).toEqual({ verdict: null, feedback: NON_MEAL_FEEDBACK, nextMeal: '' });
  });
  test('repair identifies the rejected field without sending rejected feedback as instructions', async () => {
    const requests = [];
    const invalid = { ...examples[0], nextMeal: 'For your next meal, add chicken and rice.' };
    const repaired = {
      ...examples[0],
      nextMeal: 'For your next meal, aim for one palm of protein and a fist of carbs.',
    };
    const result = await analyzeMealPhoto({
      imageBase64: 'photo',
      mediaType: 'image/jpeg',
      goal: 'lose',
      workoutLoggedToday: false,
      style: { tone: 'supportive', detail: 'concise' },
      config: { apiKey: 'test-key', model: 'mock-model', maxOutputTokens: 768, timeoutMs: 1000 },
      fetchImpl: async (_url, init) => {
        requests.push(JSON.parse(init.body));
        return providerResponse(requests.length === 1 ? invalid : repaired);
      },
    });
    expect(result).toMatchObject({ ok: true, result: repaired });
    expect(requests).toHaveLength(2);
    const retry = JSON.parse(requests[1].messages[0].content[1].text).note;
    expect(retry).toContain('next_meal_guidance');
    expect(retry).toContain('no named food or dish');
    expect(retry).not.toContain(invalid.nextMeal);
    expect(requests[1].messages[0].content[0]).toEqual(requests[0].messages[0].content[0]);
  });
  test('historical examples stay intact and current examples pass the client limits', () => {
    for (const example of historicalExamples)
      expect(MEAL_SYSTEM_PROMPT).toContain(example.feedback);
    for (const example of examples) expect(validateMealResult(example)).toEqual(example);
    expect(ACTIVE_MEAL_PROMPT).toContain(examples[0].feedback);
    expect(ACTIVE_MEAL_PROMPT).toContain(examples[1].feedback);
    expect(ACTIVE_MEAL_PROMPT).toContain(examples[5].feedback);
    expect(MEAL_SYSTEM_PROMPT).toContain('Bowl Depth & Layering');
    expect(MEAL_SYSTEM_PROMPT).toContain('Nigerian and other West African foods');
    expect(MEAL_SYSTEM_PROMPT).toContain('Do not call avocado olives');
    expect(MEAL_SYSTEM_PROMPT).toContain('egusi');
  });
  test('meal feedback enforces word, sentence and non-judgmental formatting limits', () => {
    const validate = (feedback) => validateMealResult({ verdict: 'Nearly there', feedback });
    const boundary = `Lovely plate. ${Array.from({ length: 43 }, () => 'protein').join(' ')}.`;
    expect(validate(boundary)).not.toBeNull();
    expect(validate(boundary.replace('Lovely plate.', 'Lovely colourful plate.'))).toBeNull();
    for (const feedback of [
      'Lovely plate, keep the portion as it is.',
      'Lovely plate. Protein is present. Keep a fist of carbs. Add greens.',
      'Lovely plate. Keep the carbs to a fist 😊.',
      'Lovely plate.\n- Keep the carbs to a fist.',
      'Lovely plate.\n1. Keep the carbs to a fist.',
      'Lovely plate. Aim to lose weight.',
      'Lovely plate. This is a clean treat.',
      'Lovely plate. Count 100 grams of carbs.',
      'Lovely plate. This food is bad and naughty.',
    ])
      expect(validate(feedback)).toBeNull();
    expect(validateMealResult({ verdict: null, feedback: NON_MEAL_FEEDBACK })).toEqual({
      verdict: null,
      feedback: NON_MEAL_FEEDBACK,
    });
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
      expect(JSON.parse(body.messages[0].content[1].text).goal).toBe(
        goal === 'unavailable' ? 'fitness' : goal
      );
      expect(body.system[0].text).toBe(ACTIVE_MEAL_PROMPT + CLIENT_MEAL_UPDATE);
    }
  });
  test('non-meal, unclear, layered bowl, stacked starch, pain and workout wording validation', () => {
    expect(validateMealResult({ verdict: null, feedback: NON_MEAL_FEEDBACK })?.verdict).toBe(null);
    expect(
      validateMealResult({
        verdict: 'Nearly there',
        feedback: 'I cannot see the food clearly. Next time aim for a quarter bowl of carbs.',
      })
    ).toBeNull();
    expect(validateMealResult({ verdict: null, feedback: 'Maybe a meal' })).toBeNull();
    expect(
      validateMealResult({ verdict: 'On point', feedback: 'Great food. Count your macros.' })
    ).toBeNull();
    expect(examples[2].feedback).toContain('rice and plantain');
    expect(examples[4].feedback).toContain('about a fist');
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
    expect(f.rows.coachMealDraftsV1[0].goal).toBe('lose');
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
  test('exhausted AI checks still allow sharing without analysis within the meal sharing limit', async () => {
    const f = fixture('alice', {
      coachMealScansV1: Array.from({ length: 3 }, (_, i) => ({
        _id: `used_scan_${i}`,
        userId: 'alice',
        day,
        status: 'ready',
        usable: true,
      })),
    });
    const draftId = await saveCaption._handler(f.ctx, {
      submissionId: 'sub',
      caption: 'Meal without another check',
    });
    const allowance = await myDraft._handler(f.ctx, { submissionId: 'sub' });
    expect(allowance.analysisLimitReached).toBe(true);
    expect(allowance.analysisChecksRemaining).toBe(0);
    await expect(
      reserveScan._handler(f.ctx, {
        userId: 'alice',
        draftId,
        requestKey: 'exhausted_scan',
      })
    ).rejects.toThrow('Three successful meal scans');
    const result = await share._handler(f.ctx, {
      draftId,
      caption: 'Meal without another check',
      skipAnalysis: true,
    });
    expect(result.pointsEarned).toBe(2);
    expect(f.rows.posts).toHaveLength(1);
    expect(f.rows.coachMealScansV1).toHaveLength(3);
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

test('plate description is separate from the caption and reaches the photo provider', async () => {
  const f = fixture();
  const id = await saveCaption._handler(f.ctx, {
    submissionId: 'sub',
    caption: 'Public meal caption',
    plateDescription: 'Beans and plantain',
  });
  const draft = f.rows.coachMealDraftsV1.find((d) => d._id === id);
  expect(draft.caption).toBe('Public meal caption');
  expect(draft.plateDescription).toBe('Beans and plantain');
  let sent;
  const outcome = await analyzeMealPhoto({
    imageBase64: 'real-photo',
    mediaType: 'image/jpeg',
    goal: 'recomp',
    plateDescription: draft.plateDescription,
    workoutLoggedToday: false,
    dailyPlan: {
      workout: { type: 'upper_body_strength', durationMinutes: 25 },
      recommendation: '25-minute upper body workout',
      meals: 'Portions and water',
    },
    style: { tone: 'warm_direct', detail: 'standard' },
    config: { apiKey: 'fake', model: 'fake', maxOutputTokens: 768, timeoutMs: 1000 },
    fetchImpl: async (_, request) => {
      sent = JSON.parse(request.body);
      return providerResponse({
        verdict: 'Nearly there',
        feedback:
          'Lovely plate with protein. For body recomp, add a palm of protein to support recovery.',
        nextMeal: 'For your next meal, aim for a palm of protein and half your plate vegetables.',
      });
    },
  });
  expect(outcome.ok).toBe(true);
  const context = JSON.parse(sent.messages[0].content[1].text);
  expect(context.plate_description).toBe('Beans and plantain');
  expect(context.daily_plan.workout.type).toBe('upper_body_strength');
  expect(sent.messages[0].content[0].source.data).toBe('real-photo');
});

test('next meal advice is portions only, and unclear photos cannot receive advice', () => {
  const plate = {
    verdict: 'On point',
    feedback:
      'Your protein and vegetables look balanced. For your weight loss goal, this portion works well.',
  };
  expect(
    validateMealResult({
      ...plate,
      nextMeal: 'For your next meal, keep protein to a palm and vegetables to half your plate.',
    })
  ).not.toBeNull();
  expect(
    validateMealResult({ ...plate, nextMeal: 'For your next meal, eat chicken and rice.' })
  ).toBeNull();
  expect(
    validateMealResult({
      verdict: null,
      feedback: NON_MEAL_FEEDBACK,
      nextMeal: 'For your next meal, add protein.',
    })
  ).toBeNull();
});

test('meal history is member-bound and excludes unshared and rejected meals', async () => {
  const f = fixture('alice', {
    dailyActivities: [
      {
        _id: 'a1',
        userId: 'alice',
        date: day,
        loggedActivityKey: 'healthy_meal',
        reviewStatus: 'approved',
        image: 'photo',
      },
      {
        _id: 'b1',
        userId: 'bob',
        date: day,
        loggedActivityKey: 'healthy_meal',
        reviewStatus: 'approved',
        image: 'bob-photo',
      },
      {
        _id: 'a2',
        userId: 'alice',
        date: day,
        loggedActivityKey: 'healthy_meal',
        reviewStatus: 'rejected',
      },
    ],
    coachMealDraftsV1: [
      {
        _id: 'd1',
        userId: 'alice',
        day,
        status: 'shared',
        activityId: 'a1',
        storageId: 'photo',
        verdict: 'Nearly there',
        feedback: 'Private plate report',
        nextMeal: 'For your next meal, add protein.',
      },
      {
        _id: 'unshared',
        userId: 'alice',
        day,
        status: 'ready',
        storageId: 'draft-photo',
        feedback: 'Not shared',
      },
    ],
  });
  f.ctx.storage = { getUrl: async (id) => `storage:${id}` };
  f.rows.coachMealScansV1.push(
    { _id: 'ready-shared', userId: 'alice', day, status: 'ready', usable: true },
    { _id: 'ready-unshared', userId: 'alice', day, status: 'ready', usable: true },
    { _id: 'failed-scan', userId: 'alice', day, status: 'failed', usable: false },
    { _id: 'other-member', userId: 'bob', day, status: 'ready', usable: true }
  );
  const result = await myTodayMeals._handler(f.ctx, {});
  expect(result.count).toBe(1);
  expect(result.scanCount).toBe(2);
  expect(result.items[0]).toMatchObject({
    activityId: 'a1',
    imageUrl: 'storage:photo',
    feedback: 'Private plate report',
  });
  expect(result.items.some((i) => i.activityId === 'b1')).toBe(false);
});

test('carb portions reject mixed fist/plate advice and a target conflicting with the plan', async () => {
  const { consistentMealPortions, planCarbTarget } = await import('../convex/coachMealPortions');
  const plan =
    'Protein at every meal, vegetables can fill half your plate, and a fist of carbs, up to a third of the plate, supports today.';
  expect(planCarbTarget(plan)).toBe('third');
  const report = {
    verdict: 'On point',
    feedback: 'Your protein supports body recomp. The carbs fit a third of your plate today.',
    nextMeal:
      'For your next meal, aim for a palm of protein, a third of your plate as carbs and the rest vegetables.',
  };
  expect(consistentMealPortions(report, plan)).toBe(true);
  expect(
    consistentMealPortions(
      { ...report, feedback: 'Your protein supports body recomp. Keep carbs to a closed fist.' },
      plan
    )
  ).toBe(false);
  expect(
    consistentMealPortions(
      { ...report, nextMeal: 'For your next meal, aim for a quarter of your plate as carbs.' },
      plan
    )
  ).toBe(false);
});

test('meal provider repairs conflicting carb advice before returning it', async () => {
  let calls = 0;
  let context;
  const result = await analyzeMealPhoto({
    imageBase64: 'photo',
    mediaType: 'image/jpeg',
    goal: 'recomp',
    workoutLoggedToday: true,
    dailyPlan: {
      workout: { type: 'upper_body_strength' },
      recommendation: 'Strength',
      meals: 'Water',
      nutritionGuidance: 'Carbs up to a third of the plate.',
    },
    verifiedActivity: {
      steps: 15000,
      activeMinutes: 40,
      workoutLoggedToday: true,
      sleepCheckInLogged: true,
      mealsLogged: 1,
      sleepReadiness: 'restful',
      workoutType: 'unknown',
    },
    style: { tone: 'warm_direct', detail: 'standard' },
    config: { apiKey: 'fake', model: 'fake', maxOutputTokens: 768, timeoutMs: 1000 },
    fetchImpl: async (_, request) => {
      calls++;
      context = JSON.parse(JSON.parse(request.body).messages[0].content[1].text);
      return providerResponse({
        verdict: 'On point',
        feedback: 'Your protein supports body recomp. The carbs fit a third of your plate.',
        nextMeal:
          calls === 1
            ? 'For your next meal, keep carbs to a fist.'
            : 'For your next meal, aim for a palm of protein, a third of your plate as carbs and the rest vegetables.',
      });
    },
  });
  expect(result.ok).toBe(true);
  expect(calls).toBe(2);
  expect(context.carb_target_from_plan).toBe('third');
  expect(context.verified_activity.steps).toBe(15000);
});

test('meal library retains the newest 15 across days independently of today count and other members', async () => {
  const saved = Array.from({ length: 20 }, (_, i) => {
    const date = new Date(`${day}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() - (20 - i));
    return {
      _id: `saved_${i}`,
      userId: 'alice',
      day: date.toISOString().slice(0, 10),
      status: 'shared',
      activityId: `activity_${i}`,
      storageId: `photo_${i}`,
      feedback: `Original feedback ${i}`,
      nextMeal: `Original next meal ${i}`,
      updatedAt: i,
    };
  });
  const f = fixture('alice', {
    coachMealDraftsV1: [
      ...saved,
      {
        _id: 'other_draft',
        userId: 'bob',
        day,
        status: 'shared',
        activityId: 'other_activity',
        storageId: 'other_photo',
      },
    ],
    dailyActivities: [
      ...saved.map((d) => ({
        _id: d.activityId,
        userId: 'alice',
        date: d.day,
        loggedActivityKey: 'healthy_meal',
        reviewStatus: 'approved',
      })),
      { _id: 'other_activity', userId: 'bob', date: day, loggedActivityKey: 'healthy_meal' },
    ],
  });
  f.ctx.storage = { getUrl: async (id) => `storage:${id}` };
  const result = await myTodayMeals._handler(f.ctx, {});
  expect(result.count).toBe(0);
  expect(result.items).toEqual([]);
  expect(result.libraryItems).toHaveLength(15);
  expect(result.libraryItems[0]).toMatchObject({
    activityId: 'activity_19',
    feedback: 'Original feedback 19',
    nextMeal: 'Original next meal 19',
  });
  expect(result.libraryItems[14].activityId).toBe('activity_5');
  expect(result.libraryItems.some((m) => m.activityId === 'other_activity')).toBe(false);

  // The next logged meal replaces the oldest library entry without changing old posts/logs.
  f.rows.coachMealDraftsV1.push({
    _id: 'new_meal',
    userId: 'alice',
    day,
    status: 'shared',
    activityId: 'new_activity',
    storageId: 'new_photo',
    updatedAt: 21,
  });
  f.rows.dailyActivities.push({
    _id: 'new_activity',
    userId: 'alice',
    date: day,
    loggedActivityKey: 'healthy_meal',
    reviewStatus: 'approved',
  });
  const next = await myTodayMeals._handler(f.ctx, {});
  expect(next.count).toBe(1);
  expect(next.libraryItems).toHaveLength(15);
  expect(next.libraryItems[0].activityId).toBe('new_activity');
  expect(next.libraryItems.some((m) => m.activityId === 'activity_5')).toBe(false);
  expect(f.rows.dailyActivities.some((a) => a._id === 'activity_5')).toBe(true);
});
