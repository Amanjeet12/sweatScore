// @ts-nocheck -- Bun test runtime hooks are outside the app TypeScript project.
import { describe, expect, test } from 'bun:test';

import {
  buildDailyProviderInput,
  dailyPolicy,
  kilograms,
  validateDailyPlanOutput,
  verifiedStepAverage,
} from '../convex/coachDailyPolicy';
import { DAILY_PLAN_SYSTEM_PROMPT, DAILY_PLAN_PROMPT_VERSION } from '../convex/coachDailyPrompt';
import { DAILY_PLAN_V2_PROMPT_VERSION } from '../convex/coachDailyPromptV2';
import { DEFAULT_OUTPUT_TOKENS, generateDailyPlan } from '../convex/coachDailyProvider';
import {
  claim,
  ratePlan,
  myPlanFeedback,
  finish,
  retryFailedPlan,
  saveProfileAndMaybeRefresh,
} from '../convex/coachDailyService';
import { canRetryFailedPlan } from '../shared/coachPlanRetry';

const day = '2026-09-26';
const yesterday = '2026-09-25';
const base = {
  profile: {
    goal: 'lose',
    bodyFeeling: 'feel_good',
    routineFeeling: 'working_keep_going',
    foodRelationship: 'balanced_most_days',
    usualSleep: 'regular_restful',
    biggestChallenge: 'time',
  },
  weight: { value: 165, unit: 'lb' },
  weightHistory: [
    { value: 165, unit: 'lb', observedAt: Date.parse('2026-09-20'), source: 'member' },
  ],
  daily: {
    sleep: 'rested_enough',
    energy: 'steady',
    mood: 'good',
    upFor: 'short_session',
    body: 'fine',
  },
  health: {
    steps: [
      { day: '2026-09-23', count: 6500, source: 'health_sync', coverage: 'sensor_observed' },
      { day: '2026-09-24', count: 6500, source: 'health_sync', coverage: 'sensor_observed' },
      { day: yesterday, count: 6500, source: 'health_sync', coverage: 'sensor_observed' },
    ],
    workouts: [],
    streak: 2,
  },
  recentPlanRevisionIds: [],
};
const meals =
  'Keep protein at the centre of every plate, and aim for 2 litres of water today. Snap each meal for an instant portion check.';
const restWorkout =
  'No workout today. Keep your streak going by logging your meals, steps and sleep.';
const mockConfig = {
  apiKey: 'test-key',
  model: 'test-model',
  maxOutputTokens: DEFAULT_OUTPUT_TOKENS,
  timeoutMs: 1000,
};

function output(overrides = {}) {
  return {
    headline: 'Good day to push a little.',
    workout: 'Log a 20-minute core workout today.',
    steps: '7,000 steps',
    sleep: 'Aim for 7 hours tonight. Keep your usual bedtime routine.',
    meals,
    why: 'Your energy is steady.',
    ...overrides,
  };
}
function snapshot(overrides = {}) {
  return structuredClone({ ...base, ...overrides });
}
function example(n) {
  const text = DAILY_PLAN_SYSTEM_PROMPT.match(
    new RegExp(`EXAMPLE ${n}[^]*?Output:\\n(\\{[^\\n]+\\})`)
  );
  if (!text) throw new Error(`Example ${n} missing`);
  return JSON.parse(text[1]);
}
function fakeResponse(value) {
  return new Response(
    JSON.stringify({
      content: [{ type: 'tool_use', name: 'submit_daily_plan', input: value }],
      usage: { input_tokens: 400, output_tokens: 300 },
    }),
    { status: 200 }
  );
}

function fakeDb(seed = {}) {
  const rows = structuredClone(seed);
  const writes = [];
  const scheduled = [];
  let sequence = 1;
  const db = {
    get: async (id) =>
      Object.values(rows)
        .flat()
        .find((r) => r._id === id) ?? null,
    insert: async (table, value) => {
      const id = `${table}_${sequence++}`;
      (rows[table] ??= []).push({ _id: id, ...value });
      writes.push({ table, value });
      return id;
    },
    patch: async (id, value) => {
      const record = Object.values(rows)
        .flat()
        .find((r) => r._id === id);
      if (!record) throw new Error('Fixture row missing');
      Object.assign(record, value);
      writes.push({ table: 'patch', value });
    },
    query: (table) => {
      let found = [...(rows[table] ?? [])];
      const chain = {
        withIndex: (_index, callback) => {
          const predicates = [];
          const q = {};
          for (const op of ['eq', 'gte', 'lt'])
            q[op] = (field, value) => {
              predicates.push([op, field, value]);
              return q;
            };
          callback?.(q);
          found = found.filter((row) =>
            predicates.every(([op, field, value]) =>
              op === 'eq'
                ? row[field] === value
                : op === 'gte'
                  ? row[field] >= value
                  : row[field] < value
            )
          );
          return chain;
        },
        order: (dir) => {
          if (dir === 'desc') found.reverse();
          return chain;
        },
        first: async () => found[0] ?? null,
        unique: async () => found[0] ?? null,
        collect: async () => found,
        take: async (count) => found.slice(0, count),
      };
      return chain;
    },
  };
  return {
    rows,
    writes,
    scheduled,
    ctx: {
      db,
      auth: { getUserIdentity: async () => ({ subject: 'member_a' }) },
      scheduler: {
        runAfter: async (...args) => {
          scheduled.push(args);
        },
      },
    },
  };
}

describe('daily-plan source and policy', () => {
  test('verbatim version includes all three client examples', () => {
    expect(DAILY_PLAN_PROMPT_VERSION).toBe('client-daily-plan-v1');
    expect(DAILY_PLAN_SYSTEM_PROMPT).toContain('EXAMPLE 1');
    expect(DAILY_PLAN_SYSTEM_PROMPT).toContain('EXAMPLE 2');
    expect(DAILY_PLAN_SYSTEM_PROMPT).toContain('EXAMPLE 3 (recovery rule)');
    expect(DAILY_PLAN_SYSTEM_PROMPT).toContain('Return JSON only, no other text:');
  });

  test('mocked provider preserves complete prompt, six-field schema and sufficient output budget', async () => {
    let sent;
    const result = await generateDailyPlan({
      config: mockConfig,
      input: buildDailyProviderInput(base, day, []),
      style: { tone: 'warm_direct', detail: 'standard' },
      fetchImpl: async (_url, options) => {
        sent = JSON.parse(options.body);
        return fakeResponse(example(1));
      },
    });
    expect(result.ok).toBe(true);
    expect(sent.system).toBe(DAILY_PLAN_SYSTEM_PROMPT);
    expect(sent.max_tokens).toBeGreaterThanOrEqual(1600);
    expect(sent.tools[0].input_schema.required).toEqual([
      'headline',
      'workout',
      'steps',
      'sleep',
      'meals',
      'why',
    ]);
    expect(result.output).toEqual(example(1));
    expect(result.outputTokens).toBe(300);
  });

  test('one structured tool result is accepted beside harmless text, but extra tools are rejected', async () => {
    const valid = example(1);
    const response = (content: unknown[]) =>
      new Response(JSON.stringify({ content, usage: { input_tokens: 400, output_tokens: 300 } }), {
        status: 200,
      });
    const textAndTool = await generateDailyPlan({
      config: mockConfig,
      input: {},
      style: { tone: 'warm_direct', detail: 'standard' },
      fetchImpl: async () =>
        response([
          { type: 'text', text: 'Plan follows.' },
          { type: 'tool_use', name: 'submit_daily_plan', input: valid },
        ]),
    });
    expect(textAndTool.ok).toBe(true);
    const twoTools = await generateDailyPlan({
      config: mockConfig,
      input: {},
      style: { tone: 'warm_direct', detail: 'standard' },
      fetchImpl: async () =>
        response([
          { type: 'tool_use', name: 'submit_daily_plan', input: valid },
          { type: 'tool_use', name: 'other', input: valid },
        ]),
    });
    expect(twoTools).toMatchObject({ ok: false, code: 'invalid_output' });
  });

  test('the three supplied example outputs pass a mocked provider and matching frozen context', async () => {
    const one = snapshot({
      daily: { ...base.daily, sleep: 'barely_rested', energy: 'flat' },
      health: {
        ...base.health,
        workouts: [{ day: '2026-09-24', label: 'strength', source: 'activity_log' }],
      },
    });
    const two = snapshot({
      daily: {
        ...base.daily,
        sleep: 'restful',
        energy: 'full',
        upFor: 'full_session',
        body: 'sore_lower',
      },
    });
    const three = snapshot({
      profile: { ...base.profile, goal: 'recomp' },
      daily: { ...base.daily, sleep: 'restful', energy: 'full', upFor: 'full_session' },
      health: {
        steps: base.health.steps.map((s) => ({ ...s, count: 9000 })),
        workouts: ['2026-09-25', '2026-09-24', '2026-09-23', '2026-09-22'].map((day) => ({
          day,
          label: 'workout',
          source: 'activity_log',
        })),
      },
    });
    for (const [number, context, expectedType] of [
      [1, one, 'core'],
      [2, two, 'upper_body_strength'],
      [3, three, 'core'],
    ]) {
      const result = await generateDailyPlan({
        config: mockConfig,
        input: buildDailyProviderInput(context, day, []),
        style: { tone: 'warm_direct', detail: 'standard' },
        fetchImpl: async () => fakeResponse(example(number)),
      });
      expect(result.ok).toBe(true);
      expect(validateDailyPlanOutput(result.output, context, day).workout.type).toBe(expectedType);
    }
    expect(dailyPolicy(three, day).recovery).toBe(true);
  });

  test('pain, rest, light, upper and lower soreness are enforced', () => {
    const pain = snapshot({ daily: { ...base.daily, body: 'pain_unwell', upFor: 'full_session' } });
    expect(
      validateDailyPlanOutput(
        output({ headline: 'Rest and recover today.', workout: restWorkout }),
        pain,
        day
      ).workout.type
    ).toBe('rest');
    const rest = snapshot({ daily: { ...base.daily, upFor: 'rest_day' } });
    expect(
      validateDailyPlanOutput(
        output({ headline: 'Rest day, and that counts.', workout: restWorkout }),
        rest,
        day
      ).workout.type
    ).toBe('rest');
    const light = snapshot({ daily: { ...base.daily, upFor: 'something_light' } });
    expect(
      validateDailyPlanOutput(
        output({
          headline: 'Keep it light today.',
          workout: 'Log a 10-minute core workout today.',
        }),
        light,
        day
      ).workout.durationMinutes
    ).toBe(10);
    const upper = snapshot({ daily: { ...base.daily, body: 'sore_upper' } });
    expect(
      validateDailyPlanOutput(
        output({ workout: 'Log a 20-minute lower body strength workout today.' }),
        upper,
        day
      ).workout.type
    ).toBe('lower_body_strength');
    const lower = snapshot({ daily: { ...base.daily, body: 'sore_lower' } });
    expect(() =>
      validateDailyPlanOutput(
        output({ workout: 'Log a 20-minute lower body strength workout today.' }),
        lower,
        day
      )
    ).toThrow();
  });

  test('sensor coverage gates average, missing-history targets and weight conversion', () => {
    const unknown = snapshot({
      health: { steps: [{ day: yesterday, count: 9000 }], workouts: [] },
    });
    expect(verifiedStepAverage(unknown)).toBeUndefined();
    expect(() => validateDailyPlanOutput(output({ steps: '7,500 steps' }), unknown, day)).toThrow();
    expect(validateDailyPlanOutput(output(), unknown, day).stepTarget).toBe(7000);
    const easier = snapshot({
      daily: { ...base.daily, sleep: 'barely_rested' },
      health: unknown.health,
    });
    expect(
      validateDailyPlanOutput(
        output({
          headline: 'Ease off, but keep moving.',
          sleep:
            "Aim for 7 hours tonight. You didn't sleep well last night, so start winding down earlier than usual.",
          steps: '5,000 steps',
        }),
        easier,
        day
      ).stepTarget
    ).toBe(5000);
    expect(kilograms(165, 'lb')).toBe(74.84);
    const input = buildDailyProviderInput(unknown, day, []);
    expect(input.activity.step_average).toBeNull();
    expect(input.output_constraints.steps).toBe('7,000 steps');
    expect(input.output_constraints.mention_step_average).toBe(false);
    expect(buildDailyProviderInput(easier, day, []).output_constraints.steps).toBe('5,000 steps');
    expect(input.profile.weight_history[0].kg).toBe(74.84);
  });

  test('500-step rounding and 2,000-above-average cap reject invalid targets', () => {
    expect(validateDailyPlanOutput(output({ steps: '8,000 steps' }), base, day).stepTarget).toBe(
      8000
    );
    expect(() => validateDailyPlanOutput(output({ steps: '8,600 steps' }), base, day)).toThrow();
    expect(() => validateDailyPlanOutput(output({ steps: '9,000 steps' }), base, day)).toThrow();
    expect(() => validateDailyPlanOutput(output({ steps: '7000 steps' }), base, day)).toThrow();
  });

  test('recent plans guide strength frequency without calling suggestions completed workouts', () => {
    const recent = ['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', yesterday].map(
      (date) => ({
        day: date,
        output: output({ workout: 'Log a 20-minute cardio workout today.' }),
      })
    );
    expect(() =>
      validateDailyPlanOutput(
        output({ workout: 'Log a 20-minute core workout today.' }),
        base,
        day,
        recent
      )
    ).toThrow();
    expect(
      validateDailyPlanOutput(
        output({ workout: 'Log a 20-minute full body strength workout today.' }),
        base,
        day,
        recent
      ).workout.type
    ).toBe('full_body_strength');
    const yesterdayCore = [
      { day: yesterday, output: output({ workout: 'Log a 20-minute core workout today.' }) },
    ];
    expect(() => validateDailyPlanOutput(output(), base, day, yesterdayCore)).toThrow();
    expect(buildDailyProviderInput(base, day, yesterdayCore).activity.workouts_logged).toEqual([]);
  });

  test('light intent and soreness obey both explicit rules without an invented priority', () => {
    for (const [body, type] of [
      ['sore_upper', 'lower body strength'],
      ['sore_lower', 'upper body strength'],
    ]) {
      const input = snapshot({ daily: { ...base.daily, upFor: 'something_light', body } });
      expect(dailyPolicy(input, day).unresolved).toBeUndefined();
      const providerInput = buildDailyProviderInput(input, day, []);
      expect(providerInput.output_constraints).toMatchObject({
        headline: 'Keep it light today.',
        workout: `Log a 10-minute ${type} workout today.`,
        steps: null,
        duration_minutes: 10,
      });
      expect(
        validateDailyPlanOutput(
          output({
            headline: 'Keep it light today.',
            workout: `Log a 10-minute ${type} workout today.`,
          }),
          input,
          day
        ).workout.durationMinutes
      ).toBe(10);
    }
  });

  test('approved conservative readiness precedence does not block generation', () => {
    expect(
      dailyPolicy(
        snapshot({ daily: { ...base.daily, upFor: 'full_session', energy: 'flat' } }),
        day
      ).unresolved
    ).toBeUndefined();
    const highSteps = snapshot({
      health: {
        steps: [
          { day: '2026-09-22', count: 3000, source: 'health_sync', coverage: 'sensor_observed' },
          ...base.health.steps.map((row) => ({ ...row, count: 10000 })),
        ],
        workouts: [],
      },
    });
    expect(dailyPolicy(highSteps, day).unresolved).toBeUndefined();
  });
});

describe('request lifecycle', () => {
  test('invalid provider output and timeout are truthful failures', async () => {
    const invalid = await generateDailyPlan({
      config: mockConfig,
      input: {},
      style: { tone: 'warm_direct', detail: 'standard' },
      fetchImpl: async () => fakeResponse({ headline: 'Only one field' }),
    });
    expect(invalid).toMatchObject({ ok: false, code: 'invalid_output' });
    const timeout = await generateDailyPlan({
      config: { ...mockConfig, timeoutMs: 10 },
      input: {},
      style: { tone: 'warm_direct', detail: 'standard' },
      fetchImpl: async (_url, options) =>
        new Promise((_resolve, reject) =>
          options.signal.addEventListener('abort', () => reject(new Error('aborted')))
        ),
    });
    expect(timeout).toMatchObject({ ok: false, code: 'provider_timeout' });
  });

  test('a newer request blocks a late older provider response', async () => {
    const store = fakeDb({
      coachPlanRequestsV1: [
        {
          _id: 'older',
          userId: 'member_a',
          day,
          status: 'pending',
          generationAttempt: 1,
          inputSnapshot: base,
        },
        {
          _id: 'newer',
          userId: 'member_a',
          day,
          status: 'pending',
          generationAttempt: 1,
          inputSnapshot: base,
        },
      ],
    });
    const result = await finish._handler(store.ctx, {
      requestId: 'older',
      generationAttempt: 1,
      result: { ok: true, output: output(), model: 'test-model', latencyMs: 100 },
    });
    expect(result.status).toBe('ignored');
    expect(store.rows.coachPlanRevisionsV1).toBeUndefined();
    expect(store.rows.coachPlanRequestsV1[0].errorCode).toBe('superseded');
  });

  test('invalid coaching copy persists failure without a successful revision or assignment', async () => {
    const store = fakeDb({
      coachPlanRequestsV1: [
        {
          _id: 'request',
          userId: 'member_a',
          day,
          status: 'pending',
          generationAttempt: 1,
          inputSnapshot: base,
        },
      ],
    });
    const result = await finish._handler(store.ctx, {
      requestId: 'request',
      generationAttempt: 1,
      result: {
        ok: true,
        output: output({ headline: 'Made up headline.' }),
        model: 'test-model',
        latencyMs: 100,
      },
    });
    expect(result.status).toBe('failed');
    expect(store.rows.coachPlanRequestsV1[0].errorCode).toBe('invalid_output');
    expect(store.rows.coachPlanRequestsV1[0].validationStage).toBe('plan_validation');
    expect(store.rows.coachPlanRevisionsV1).toBeUndefined();
    expect(store.rows.coachAssignmentsV1).toBeUndefined();
  });

  test('a malformed provider tool result records a safe format stage', async () => {
    const store = fakeDb({
      coachPlanRequestsV1: [
        {
          _id: 'request',
          userId: 'member_a',
          day,
          status: 'pending',
          generationAttempt: 1,
          inputSnapshot: base,
        },
      ],
    });
    await finish._handler(store.ctx, {
      requestId: 'request',
      generationAttempt: 1,
      result: { ok: false, code: 'invalid_output', model: 'test-model', latencyMs: 100 },
    });
    expect(store.rows.coachPlanRequestsV1[0]).toMatchObject({
      status: 'failed',
      errorCode: 'invalid_output',
      validationStage: 'provider_format',
    });
    expect(store.rows.coachPlanRevisionsV1).toBeUndefined();
  });

  test('valid result atomically saves one revision and four plan-specific assignments', async () => {
    const store = fakeDb({
      coachPlanRequestsV1: [
        {
          _id: 'request',
          userId: 'member_a',
          day,
          status: 'pending',
          generationAttempt: 1,
          inputSnapshot: base,
          promptVersion: DAILY_PLAN_PROMPT_VERSION,
          toneVersion: 1,
        },
      ],
    });
    const result = await finish._handler(store.ctx, {
      requestId: 'request',
      generationAttempt: 1,
      result: {
        ok: true,
        output: output({ workout: 'Log a 20-minute lower body strength workout today.' }),
        model: 'test-model',
        latencyMs: 120,
        inputTokens: 400,
        outputTokens: 300,
      },
    });
    expect(result.status).toBe('ready');
    expect(store.rows.coachPlanRevisionsV1).toHaveLength(1);
    expect(store.rows.coachAssignmentsV1).toHaveLength(4);
    expect(store.rows.coachAssignmentsV1[0]).toMatchObject({
      label: '20-minute leg workout',
      recommendation: 'Log a 20-minute lower body strength workout today.',
      planRevisionId: result.revisionId,
    });
    expect(store.rows.coachPlanRequestsV1[0]).toMatchObject({
      status: 'ready',
      inputTokens: 400,
      outputTokens: 300,
    });
    expect(store.rows.dailyActivities).toBeUndefined();
    expect(store.rows.posts).toBeUndefined();
    expect(
      (
        await finish._handler(store.ctx, {
          requestId: 'request',
          generationAttempt: 1,
          result: { ok: true, output: output(), model: 'test-model', latencyMs: 200 },
        })
      ).status
    ).toBe('ignored');
    expect(store.rows.coachPlanRevisionsV1).toHaveLength(1);
  });

  test('v2 finish saves flexible wording beside canonical proof metadata without points', async () => {
    const store = fakeDb({
      coachPlanRequestsV1: [
        {
          _id: 'request_v2',
          userId: 'member_a',
          day,
          status: 'pending',
          generationAttempt: 1,
          inputSnapshot: base,
          promptVersion: DAILY_PLAN_V2_PROMPT_VERSION,
          toneVersion: 1,
        },
      ],
    });
    const generated = {
      ...output({
        meals: "Log today's meals for feedback. Aim for 2 litres of water.",
        why: 'A short core workout fits steady energy; 7,000 steps fit your observed walking and balanced protein, carbs and vegetables support your goal.',
      }),
      workoutExamples: ['dead bugs', 'bird dogs'],
      workoutReason: 'A short core session fits your steady energy today.',
      stepsReason:
        'Your observed 6,500 steps average and steady energy make this target manageable today.',
    };
    const result = await finish._handler(store.ctx, {
      requestId: 'request_v2',
      generationAttempt: 1,
      result: { ok: true, output: generated, model: 'test-model', latencyMs: 100 },
    });
    expect(result.status).toBe('ready');
    expect(store.rows.coachPlanRevisionsV1[0].output.workout).toBe(generated.workout);
    expect(store.rows.coachPlanRevisionsV1[0].detailsV2.workoutExamples).toEqual([
      'dead bugs',
      'bird dogs',
    ]);
    expect(store.rows.coachPlanRevisionsV1[0].stepTarget).toBe(7000);
    expect(store.rows.coachAssignmentsV1.find((a) => a.category === 'steps')).toMatchObject({
      stepTarget: 7000,
      label: '7,000 steps',
    });
    expect(
      store.rows.coachAssignmentsV1.find((a) => a.category === 'workout').recommendation
    ).toContain('dead bugs');
    expect(store.rows.dailyActivities).toBeUndefined();
    expect(store.rows.coachRewardSlotsV1).toBeUndefined();
  });

  test('an expired generation attempt cannot overwrite its newer attempt', async () => {
    const store = fakeDb({
      coachPlanRequestsV1: [
        {
          _id: 'request',
          userId: 'member_a',
          day,
          status: 'pending',
          generationAttempt: 2,
          inputSnapshot: base,
        },
      ],
    });
    expect(
      (
        await finish._handler(store.ctx, {
          requestId: 'request',
          generationAttempt: 1,
          result: { ok: true, output: output(), model: 'test-model', latencyMs: 100 },
        })
      ).status
    ).toBe('ignored');
    expect(store.rows.coachPlanRevisionsV1).toBeUndefined();
  });

  test('claim is idempotent and uses the saved tone version', async () => {
    const store = fakeDb({
      coachPlanRequestsV1: [
        {
          _id: 'request',
          userId: 'member_a',
          day,
          status: 'pending',
          promptVersion: DAILY_PLAN_PROMPT_VERSION,
          toneVersion: 2,
          inputSnapshot: base,
        },
      ],
      coachToneSettingsV1: [
        { _id: 'tone', version: 2, tone: 'calm_reassuring', detail: 'concise', scope: 'both' },
        {
          _id: 'later_tone',
          version: 3,
          tone: 'upbeat_encouraging',
          detail: 'standard',
          scope: 'both',
        },
      ],
    });
    const first = await claim._handler(store.ctx, { requestId: 'request' });
    expect(first.style).toEqual({ tone: 'calm_reassuring', detail: 'concise' });
    expect(await claim._handler(store.ctx, { requestId: 'request' })).toBeNull();
  });

  test('deliberate retry keeps frozen inputs and duplicate retries reuse one row', async () => {
    const store = fakeDb({
      users: [{ _id: 'member_a', timezone: 'UTC', isAdmin: true }],
      coachPlanRequestsV1: [
        {
          _id: 'failed',
          userId: 'member_a',
          day: new Date().toISOString().slice(0, 10),
          status: 'failed',
          errorCode: 'provider_timeout',
          profileRevisionId: 'profile',
          dailyAnswerId: 'daily',
          inputSnapshot: base,
          promptVersion: DAILY_PLAN_PROMPT_VERSION,
          toneVersion: 1,
        },
      ],
    });
    const first = await retryFailedPlan._handler(store.ctx, {
      failedRequestId: 'failed',
      requestKey: 'retry_key_123',
    });
    const second = await retryFailedPlan._handler(store.ctx, {
      failedRequestId: 'failed',
      requestKey: 'retry_key_456',
    });
    expect(second).toBe(first);
    expect(store.rows.coachPlanRequestsV1).toHaveLength(2);
    expect(store.rows.coachPlanRequestsV1[1].inputSnapshot).toEqual(base);
    expect(store.scheduled).toHaveLength(1);
  });

  test('only current-policy provider failures can offer retry', async () => {
    const failed = {
      status: 'failed' as const,
      errorCode: 'provider_timeout',
      promptVersion: DAILY_PLAN_PROMPT_VERSION,
    };
    expect(canRetryFailedPlan(failed, DAILY_PLAN_PROMPT_VERSION)).toBe(true);
    expect(
      canRetryFailedPlan({ ...failed, errorCode: 'policy_unresolved' }, DAILY_PLAN_PROMPT_VERSION)
    ).toBe(false);
    expect(
      canRetryFailedPlan({ ...failed, errorCode: 'superseded' }, DAILY_PLAN_PROMPT_VERSION)
    ).toBe(false);
    expect(
      canRetryFailedPlan({ ...failed, promptVersion: 'old-prompt' }, DAILY_PLAN_PROMPT_VERSION)
    ).toBe(false);
    expect(canRetryFailedPlan({ ...failed, status: 'pending' }, DAILY_PLAN_PROMPT_VERSION)).toBe(
      false
    );
    expect(canRetryFailedPlan(null, DAILY_PLAN_PROMPT_VERSION)).toBe(false);

    const store = fakeDb({
      users: [{ _id: 'member_a', timezone: 'UTC', isAdmin: true }],
      coachPlanRequestsV1: [
        {
          _id: 'blocked',
          userId: 'member_a',
          day: new Date().toISOString().slice(0, 10),
          ...failed,
          errorCode: 'policy_unresolved',
        },
      ],
    });
    expect(
      retryFailedPlan._handler(store.ctx, { requestKey: 'retry_blocked_123' })
    ).rejects.toThrow('No retryable failed request');
    expect(store.rows.coachPlanRequestsV1).toHaveLength(1);
    expect(store.scheduled).toHaveLength(0);
  });

  test('a formerly policy-blocked light and sore request retries its frozen answers once', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const original = snapshot({
      daily: { ...base.daily, upFor: 'something_light', body: 'sore_lower' },
    });
    const store = fakeDb({
      users: [{ _id: 'member_a', timezone: 'UTC', isAdmin: true }],
      coachPlanRequestsV1: [
        {
          _id: 'blocked',
          userId: 'member_a',
          day: today,
          requestKey: 'first_saved',
          kind: 'first',
          status: 'failed',
          errorCode: 'policy_unresolved',
          promptVersion: DAILY_PLAN_PROMPT_VERSION,
          inputSnapshot: original,
          profileRevisionId: 'profile',
          dailyAnswerId: 'daily',
          toneVersion: 1,
        },
      ],
    });
    const first = await retryFailedPlan._handler(store.ctx, {
      failedRequestId: 'blocked',
      requestKey: 'retry_resolved_123',
    });
    const again = await retryFailedPlan._handler(store.ctx, {
      failedRequestId: 'blocked',
      requestKey: 'retry_resolved_456',
    });
    expect(again).toBe(first);
    expect(store.rows.coachPlanRequestsV1).toHaveLength(2);
    expect(store.rows.coachPlanRequestsV1[1].inputSnapshot).toEqual(original);
    expect(store.scheduled).toHaveLength(1);
  });

  test('profile save with no current-day plan never queues generation', async () => {
    const calls = [];
    const ctx = {
      runMutation: async (ref, args) => {
        calls.push(['mutation', args]);
        return 'profile_2';
      },
      runQuery: async () => ({ day, revisionId: null }),
    };
    const result = await saveProfileAndMaybeRefresh._handler(ctx, {
      answers: base.profile,
      weight: base.weight,
      expectedVersion: 1,
      requestKey: 'refresh_12345',
    });
    expect(result).toEqual({ profileRevisionId: 'profile_2', requestId: null });
    expect(calls).toHaveLength(1);
  });

  test('profile save with a ready current-day plan queues one refresh request', async () => {
    const calls = [];
    let queryCount = 0;
    const ctx = {
      runMutation: async (_ref, args) => {
        calls.push(args);
        return calls.length === 1 ? 'profile_2' : calls.length === 2 ? 'refresh_request' : true;
      },
      runQuery: async (_ref) =>
        ++queryCount === 1
          ? { day, revisionId: 'old_revision' }
          : { state: { entitlement: 'verified' } },
    };
    const result = await saveProfileAndMaybeRefresh._handler(ctx, {
      answers: base.profile,
      weight: base.weight,
      expectedVersion: 1,
      requestKey: 'refresh_12345',
    });
    expect(result).toEqual({ profileRevisionId: 'profile_2', requestId: 'refresh_request' });
    expect(calls).toHaveLength(3);
    expect(calls[1]).toMatchObject({ kind: 'profile_refresh', requestKey: 'refresh_12345' });
  });
});

test('plan ratings are member-owned and later generation receives saved feedback', async () => {
  const store = fakeDb({
    users: [{ _id: 'member_a' }],
    coachPlanRevisionsV1: [
      { _id: 'mine', userId: 'member_a', day: yesterday, output: output() },
      { _id: 'other', userId: 'member_b', day: yesterday, output: output() },
    ],
    coachPlanRequestsV1: [
      {
        _id: 'request',
        userId: 'member_a',
        day,
        status: 'pending',
        promptVersion: DAILY_PLAN_PROMPT_VERSION,
        toneVersion: 1,
        inputSnapshot: base,
      },
    ],
  });
  await ratePlan._handler(store.ctx, { revisionId: 'mine', helpful: false });
  expect(await myPlanFeedback._handler(store.ctx, { revisionId: 'mine' })).toBe(false);
  await expect(
    ratePlan._handler(store.ctx, { revisionId: 'other', helpful: true })
  ).rejects.toThrow();
  const claimed = await claim._handler(store.ctx, { requestId: 'request' });
  expect(claimed.feedback).toEqual([{ day: yesterday, helpful: false, plan: output() }]);
  expect(store.rows.coachPlanRevisionsV1[1].helpful).toBeUndefined();
});
