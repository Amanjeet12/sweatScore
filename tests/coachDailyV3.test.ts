// @ts-nocheck -- Client scenarios and mocked provider, without real member data.
import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

import { CLIENT_PLAN_UPDATE } from '../convex/coachClientUpdate';
import { buildDailyProviderInputV3, validateDailyPlanOutputV3 } from '../convex/coachDailyPolicyV3';
import {
  DAILY_PLAN_V3_CLIENT_PROMPT,
  DAILY_PLAN_V3_PROMPT_VERSION,
  DAILY_PLAN_V3_SYSTEM_PROMPT,
} from '../convex/coachDailyPromptV3';
import { generateDailyPlan } from '../convex/coachDailyProvider';
import { generateV3WithRepair } from '../convex/coachDailyRepair';
import { finish, generateReserved } from '../convex/coachDailyService';
import { materializeAssignments } from '../convex/coachFoundation';
import { dailyMealGuidance, DAILY_PLAN_EXPLANATION_LIMITS } from '../shared/coachPlanCopy';

const day = '2026-10-08';
test('Other reaches the AI as unspecified training, while legacy cardio remains cardio', () => {
  const snapshot = state();
  snapshot.daily.trainedYesterday = ['other'];
  const input = buildDailyProviderInputV3(snapshot, day, []);
  expect(input.today.trainedYesterday).toEqual(['other']);
  expect(input.today.training_other_meaning).toContain('does not mean cardio');
  snapshot.daily.trainedYesterday = ['cardio'];
  const legacy = buildDailyProviderInputV3(snapshot, day, []);
  expect(legacy.today.trainedYesterday).toEqual(['cardio']);
  expect(legacy.today.training_other_meaning).toBeUndefined();
});
function state(goal = 'recomp') {
  return {
    profile: {
      goal,
      bodyFeeling: 'feel_good',
      routineFeeling: 'working_keep_going',
      foodRelationship: 'balanced_most_days',
      usualSleep: 'regular_restful',
      biggestChallenge: 'time',
    },
    weight: { value: 75, unit: 'kg' },
    weightHistory: [],
    daily: {
      sleep: 'rested_enough',
      energy: 'steady',
      upFor: 'full_session',
      trainedYesterday: ['nothing'],
      body: ['fine'],
    },
    health: {
      steps: [],
      workouts: [
        {
          day: '2026-10-05',
          label: 'workout',
          plannedType: 'full_body_strength',
          plannedMinutes: 30,
          source: 'activity_log',
        },
      ],
      recentDays: [],
    },
    recentPlanRevisionIds: [],
  };
}
function candidate(
  s,
  {
    type = 'full_body_strength',
    minutes = 35,
    target = 7500,
    intensity = 'moderate',
    water = 2.5,
  } = {}
) {
  const pain = s.daily.body.includes('pain_unwell');
  const rest = type === 'rest';
  const hours = s.daily.sleep === 'barely_rested' || pain ? 8 : 7;
  const goal = { recomp: 'body recomp', lose: 'weight loss', fitness: 'fitness' }[s.profile.goal];
  return {
    headline: rest ? 'Rest is part of progress.' : 'Build strength at your pace.',
    workout: {
      text: rest
        ? 'Rest and recover today.'
        : `${minutes}-minute ${type.replaceAll('_', ' ')} workout`,
      type,
      minutes: rest ? 0 : minutes,
      intensity: rest ? 'low' : intensity,
    },
    steps: { target: pain ? 0 : target },
    meals: { text: dailyMealGuidance(water), water_litres: water },
    sleep: { text: `Aim for ${hours} hours tonight.`, hours },
    why: pain
      ? 'To support your fitness goal, rest is the priority while you feel unwell, and there is no training or step target today. Gentle movement is optional only if it feels comfortable, and if pain or illness continues, speak to a doctor or healthcare professional. Protein at every meal supports recovery, vegetables can fill half your plate, and a fist of carbs, up to a third of the plate, helps keep you nourished without a complicated menu. Two litres of water fit this quiet day, and eight hours of sleep give you more time to recover. Keeping your meals and sleep steady is enough today; your usual activity can wait until you feel better.'
      : `To support your ${goal} goal, today's ${rest ? 'rest' : type.replaceAll('_', ' ')} plan fits the effort you feel ready for and helps you build a routine you can keep. A target of ${target.toLocaleString('en-US')} steps keeps daily movement manageable alongside ${rest ? 'recovery' : 'your session'} without making every part of today harder. Protein at every meal supports recovery, vegetables can fill half your plate, and a fist of carbs, ${s.profile.goal === 'lose' ? 'a quarter' : 'up to a third'} of the plate, gives you energy for your active days. Your ${water} litres of water fit this plan, while ${hours} hours of sleep tonight give you time to recharge. Keeping these small habits steady is where your next bit of progress comes from.`,
  };
}
const validate = (p, s) => validateDailyPlanOutputV3(p, s, day);
const config = { apiKey: 'fake', model: 'fake', maxOutputTokens: 2400, timeoutMs: 1000 };
const response = (output) =>
  new Response(
    JSON.stringify({ content: [{ type: 'tool_use', name: 'submit_daily_plan', input: output }] }),
    { status: 200 }
  );

test('preserves the supplied client prompt and routes new requests and admin preview to V3', () => {
  expect(DAILY_PLAN_V3_CLIENT_PROMPT).toContain('THE MOST IMPORTANT RULE: RESPECT HER GOAL');
  expect(DAILY_PLAN_V3_CLIENT_PROMPT).toContain('This is a starting point, not a lookup table.');
  expect(DAILY_PLAN_V3_CLIENT_PROMPT).toContain('4 to 6 short sentences, about 90 to 130 words');
  for (const file of ['convex/coachFoundation.ts', 'convex/coachTonePreviewRunner.ts'])
    expect(readFileSync(file, 'utf8')).toContain('DAILY_PLAN_V3_PROMPT_VERSION');
});

test('client case: barely rested recomp member can get 30 or 40 minute strength without invented recovery', () => {
  const s = state();
  s.daily.sleep = 'barely_rested';
  for (const minutes of [30, 35, 40])
    expect(validate(candidate(s, { minutes }), s).workout.durationMinutes).toBe(minutes);
  const invented = candidate(s);
  invented.why = invented.why.replace(
    'Protein at every meal supports recovery',
    'Your lower body can recover while you work your arms'
  );
  expect(() => validate(invented, s)).toThrow();
  expect(() => validate(candidate(s, { target: 10000 }), s)).toThrow('poor_readiness_steps');
});

test('client case: rested upbeat experienced member can get a long session instead of fixed 45 minutes', () => {
  const s = state();
  s.daily.sleep = 'restful';
  s.daily.energy = 'full';
  for (const minutes of [50, 55, 60])
    expect(validate(candidate(s, { minutes, water: 3 }), s).workout.durationMinutes).toBe(minutes);
});

test('client case: new member stays moderate, with goal-based steps and no missing-data wording', () => {
  const s = state('lose');
  s.health.workouts = [];
  expect(validate(candidate(s, { minutes: 25, target: 8000 }), s).stepTarget).toBe(8000);
  expect(() => validate(candidate(s, { minutes: 60, target: 8000 }), s)).toThrow('new_member_load');
});

test('client case: six consecutive training days allow a lighter session or rest, never another hard long session', () => {
  const s = state('lose');
  s.daily.trainedYesterday = ['cardio'];
  s.health.workouts = Array.from({ length: 6 }, (_, i) => ({
    day: `2026-10-0${7 - i}`,
    label: 'workout',
    source: 'activity_log',
  }));
  expect(
    validate(
      candidate(s, { type: 'walking', minutes: 25, intensity: 'low', target: 7000, water: 2 }),
      s
    ).workout.type
  ).toBe('walking');
  expect(validate(candidate(s, { type: 'rest', water: 2 }), s).workout.type).toBe('rest');
  expect(() => validate(candidate(s, { minutes: 60, intensity: 'high', water: 3 }), s)).toThrow(
    'recent_training_load'
  );
});

test('client case: quick session can prioritise strength for recomp', () => {
  const s = state();
  s.daily.upFor = 'short_session';
  s.daily.sleep = 'restful';
  s.daily.energy = 'full';
  expect(validate(candidate(s, { minutes: 20 }), s).workout.type).toBe('full_body_strength');
});

test('client case: low-step weight-loss member progresses gradually without repeating yesterday muscle group', () => {
  const s = state('lose');
  s.daily.upFor = 'short_session';
  s.daily.trainedYesterday = ['upper_body'];
  s.health.steps = ['05', '06', '07'].map((d) => ({
    day: `2026-10-${d}`,
    count: 3500,
    source: 'health_sync',
    coverage: 'sensor_observed',
  }));
  expect(
    validate(candidate(s, { type: 'lower_body_strength', minutes: 20, target: 4000 }), s).stepTarget
  ).toBe(4000);
  expect(() =>
    validate(candidate(s, { type: 'upper_body_strength', minutes: 20, target: 4000 }), s)
  ).toThrow('upper_body_recovery');
  expect(() => validate(candidate(s, { type: 'cardio', minutes: 20, target: 10000 }), s)).toThrow(
    'steps_progression'
  );
});

test('client case: unwell means rest, no step target and professional-care guidance', () => {
  const s = state('fitness');
  s.daily.body = ['pain_unwell'];
  s.daily.sleep = 'barely_rested';
  s.daily.energy = 'flat';
  const p = candidate(s, { type: 'rest', water: 2 });
  const saved = validate(p, s);
  expect(saved.workout).toEqual({ type: 'rest' });
  expect(saved.stepTarget).toBe(0);
  expect(saved.sleepTargetHours).toBe(8);
  expect(() => validate({ ...p, steps: { target: 5000 } }, s)).toThrow('steps_range');
  expect(() =>
    validate(
      {
        ...p,
        workout: {
          text: '20-minute cardio workout',
          type: 'cardio',
          minutes: 20,
          intensity: 'low',
        },
      },
      s
    )
  ).toThrow('rest_required');
});

test('rest preference, simultaneous soreness and light days remain safe', () => {
  for (const change of [{ upFor: 'rest_day' }, { body: ['sore_upper', 'sore_lower'] }]) {
    const s = state();
    Object.assign(s.daily, change);
    expect(() => validate(candidate(s), s)).toThrow('rest_required');
  }
  const s = state();
  s.daily.upFor = 'something_light';
  expect(
    validate(candidate(s, { type: 'mobility', minutes: 20, intensity: 'low', water: 2 }), s).workout
      .type
  ).toBe('mobility');
});

test('water, sleep, explanations and repeated copy are validated independently of workout choice', () => {
  const s = state();
  const p = candidate(s);
  for (const water of [1, 3.5])
    expect(() =>
      validate({ ...p, meals: { text: dailyMealGuidance(water), water_litres: water } }, s)
    ).toThrow('water_target');
  expect(() =>
    validate({ ...p, sleep: { text: 'Aim for 8 hours tonight.', hours: 7 } }, s)
  ).toThrow('sleep_target');
  expect(() => validate({ ...p, why: 'A short explanation.' }, s)).toThrow('why_length');
  expect(() =>
    validateDailyPlanOutputV3(p, s, day, [
      { day: '2026-10-07', output: { headline: p.headline, workout: 'other', why: 'other' } },
    ])
  ).toThrow('repeated_headline');
});

test('provider sends explicit Other guidance without treating it as legacy cardio', async () => {
  const s = state();
  s.daily.trainedYesterday = ['other'];
  let body;
  await generateDailyPlan({
    config,
    input: buildDailyProviderInputV3(s, day, []),
    style: { tone: 'warm_direct', detail: 'standard' },
    promptVersion: DAILY_PLAN_V3_PROMPT_VERSION,
    fetchImpl: async (_url, init) => {
      body = JSON.parse(init.body);
      return response(candidate(s));
    },
  });
  expect(body.system[0].text).toContain('does not mean cardio');
  expect(JSON.parse(body.messages[0].content).input.today.trainedYesterday).toEqual(['other']);
});

test('provider uses the full client prompt, nested tool schema and moderate temperature', async () => {
  const s = state();
  const p = candidate(s);
  let body;
  const result = await generateDailyPlan({
    config,
    input: buildDailyProviderInputV3(s, day, []),
    style: { tone: 'warm_direct', detail: 'standard' },
    promptVersion: DAILY_PLAN_V3_PROMPT_VERSION,
    fetchImpl: async (_url, init) => {
      body = JSON.parse(init.body);
      return response(p);
    },
  });
  expect(result.ok).toBe(true);
  expect(body.system[0].text).toBe(DAILY_PLAN_V3_SYSTEM_PROMPT + CLIENT_PLAN_UPDATE);
  expect(body.temperature).toBe(0.7);
  expect(body.tools[0].input_schema.properties.workout.properties.minutes).toBeDefined();
  expect(body.messages[0].content).not.toContain('duration_minutes');
  expect(body.messages[0].content).not.toContain('weight_history');
});

test('provider repair receives measured explanation counts and explicit rest constraints', async () => {
  const s = state();
  let body;
  await generateDailyPlan({
    config,
    input: buildDailyProviderInputV3(s, day, []),
    style: { tone: 'warm_direct', detail: 'standard' },
    promptVersion: DAILY_PLAN_V3_PROMPT_VERSION,
    retryGuidance: {
      previousCandidate: { ...candidate(s), headline: 'Rest', why: 'Too short.' },
      validationCode: 'why_length',
    },
    fetchImpl: async (_url, init) => {
      body = JSON.parse(init.body);
      return response(candidate(s));
    },
  });
  const message = JSON.parse(body.messages[0].content);
  expect(message.headline_length_feedback.word_count).toBe(1);
  const headlinePattern = new RegExp(body.tools[0].input_schema.properties.headline.pattern);
  expect(headlinePattern.test('Keep today gently active')).toBe(true);
  expect(headlinePattern.test('Rest')).toBe(false);
  expect(headlinePattern.test('One two three four five six seven')).toBe(false);
  expect(message.why_length_feedback.word_count).toBe(2);
  expect(message.why_length_feedback.sentence_count).toBe(1);
  expect(message.rest_target_rule).toContain('workout.minutes must be 0');
  expect(message.rest_target_rule).toContain('workout.intensity must be low');
});

test('provider repairs an invalid candidate once and never saves the fixed V2 fallback', async () => {
  const s = state();
  let calls = 0;
  const result = await generateV3WithRepair({
    snapshot: s,
    day,
    recentPlans: [],
    call: async (guidance) => {
      calls++;
      if (guidance) expect(guidance.validationCode).toBe('why_length');
      return {
        ok: true,
        output: calls === 1 ? { ...candidate(s), why: 'Too short.' } : candidate(s),
        latencyMs: 10,
      };
    },
  });
  expect(result.ok).toBe(true);
  expect(calls).toBe(2);
  const failed = await generateV3WithRepair({
    snapshot: s,
    day,
    recentPlans: [],
    call: async () => ({ ok: true, output: { ...candidate(s), why: 'Too short.' }, latencyMs: 10 }),
  });
  expect(failed).toMatchObject({
    ok: false,
    code: 'invalid_output',
    formatCode: 'plan_validation:why_length',
  });
});

test('history includes only the past 14 days and last five plans; keeps planned and completed evidence distinct', () => {
  const s = state();
  s.health.workouts.push({ day: '2026-09-01', label: 'outside', source: 'activity_log' });
  s.health.recentDays = [
    {
      day: '2026-10-06',
      checkedIn: true,
      completedCategories: ['sleep'],
      restPlanned: true,
      planCompleted: false,
    },
  ];
  const plans = Array.from({ length: 8 }, (_, i) => ({
    day: `2026-10-0${7 - i}`,
    output: { headline: `Plan ${i}` },
  }));
  const input = buildDailyProviderInputV3(s, day, plans);
  expect(input.last_5_plans).toHaveLength(5);
  expect(input.recent_14_days.completed_workout_check_ins).toHaveLength(1);
  expect(input.recent_14_days.completed_workout_check_ins[0].plannedMinutes).toBeUndefined();
  expect(input.recent_14_days.completed_workout_check_ins[0].plannedType).toBeUndefined();
  expect(input.recent_14_days.completed_strength_plan_check_ins_last_7_days).toBe(0);
  expect(input.recent_14_days.sleep_check_ins).toEqual([{ day: '2026-10-06' }]);
  expect(input.recent_14_days.rest_days_planned).toEqual(['2026-10-06']);
});

function savedStore(snapshot) {
  const rows = {
    coachPlanRequestsV1: [
      {
        _id: 'request',
        userId: 'member',
        day,
        status: 'pending',
        generationAttempt: 1,
        inputSnapshot: snapshot,
        promptVersion: DAILY_PLAN_V3_PROMPT_VERSION,
        toneVersion: 1,
      },
    ],
    coachPlanRevisionsV1: [],
    coachAssignmentsV1: [],
  };
  const ctx = {
    db: {
      get: async (id) =>
        Object.values(rows)
          .flat()
          .find((row) => row._id === id) ?? null,
      patch: async (id, value) =>
        Object.assign(
          Object.values(rows)
            .flat()
            .find((row) => row._id === id),
          value
        ),
      insert: async (table, value) => {
        const _id = `${table}_${rows[table].length}`;
        rows[table].push({ _id, ...value });
        return _id;
      },
      query: (table) => {
        let list = [...(rows[table] ?? [])];
        const chain = {
          withIndex: (_name, cb) => {
            const clauses = [];
            const q = {
              eq: (field, value) => {
                clauses.push([field, value]);
                return q;
              },
            };
            cb(q);
            list = list.filter((row) => clauses.every(([field, value]) => row[field] === value));
            return chain;
          },
          order: () => chain,
          first: async () => list[0] ?? null,
          unique: async () => list[0] ?? null,
        };
        return chain;
      },
    },
  };
  return { rows, ctx };
}
test('saves AI-selected workout and sleep metadata without rewriting copy or touching points', async () => {
  const s = state();
  s.daily.sleep = 'barely_rested';
  const p = candidate(s, { minutes: 40 });
  const store = savedStore(s);
  expect(
    await finish._handler(store.ctx, {
      requestId: 'request',
      generationAttempt: 1,
      result: { ok: true, output: p, model: 'fake', latencyMs: 10 },
    })
  ).toMatchObject({ status: 'ready' });
  expect(store.rows.coachPlanRevisionsV1[0]).toMatchObject({
    sleepTargetHours: 8,
    stepTarget: 7500,
    workout: { type: 'full_body_strength', durationMinutes: 40, intensity: 'moderate' },
    output: { why: p.why },
  });
  expect(
    store.rows.coachAssignmentsV1.find((row) => row.category === 'sleep').sleepTargetHours
  ).toBe(8);
  expect(store.rows.coachAssignmentsV1).toHaveLength(4);
  // Re-materialization also retains the selected sleep target.
  await materializeAssignments._handler(store.ctx, {
    revisionId: store.rows.coachPlanRevisionsV1[0]._id,
  });
  expect(store.rows.coachAssignmentsV1).toHaveLength(4);
  expect(Object.keys(store.rows)).toEqual([
    'coachPlanRequestsV1',
    'coachPlanRevisionsV1',
    'coachAssignmentsV1',
  ]);
});

test('saves zero steps on an unwell day with no workout target or YouTube search metadata', async () => {
  const s = state('fitness');
  s.daily.body = ['pain_unwell'];
  const store = savedStore(s);
  const p = candidate(s, { type: 'rest', water: 2 });
  expect(
    await finish._handler(store.ctx, {
      requestId: 'request',
      generationAttempt: 1,
      result: { ok: true, output: p, model: 'fake', latencyMs: 10 },
    })
  ).toMatchObject({ status: 'ready' });
  expect(store.rows.coachPlanRevisionsV1[0]).toMatchObject({
    stepTarget: 0,
    workout: { type: 'rest' },
  });
  expect(store.rows.coachAssignmentsV1.find((row) => row.category === 'steps').label).toBe(
    'No step target today'
  );
});

test('reserved V3 action calls the new prompt and persists the AI result through finish', async () => {
  const s = state();
  const p = candidate(s);
  const store = savedStore(s);
  const priorFetch = globalThis.fetch;
  const priorKey = process.env.ANTHROPIC_API_KEY;
  const priorModel = process.env.PROGRESS_COACH_MODEL;
  process.env.ANTHROPIC_API_KEY = 'fake';
  process.env.PROGRESS_COACH_MODEL = 'fake';
  let body;
  let mutations = 0;
  globalThis.fetch = async (_url, init) => {
    body = JSON.parse(init.body);
    return response(p);
  };
  try {
    const outcome = await generateReserved._handler(
      {
        runMutation: async (_ref, args) => {
          mutations++;
          if (mutations === 1)
            return {
              snapshot: s,
              day,
              recentPlans: [],
              feedback: [],
              style: { tone: 'warm_direct', detail: 'standard' },
              promptVersion: DAILY_PLAN_V3_PROMPT_VERSION,
              generationAttempt: 1,
            };
          return finish._handler(store.ctx, args);
        },
      },
      { requestId: 'request' }
    );
    expect(outcome.status).toBe('ready');
    expect(body.system[0].text).toBe(DAILY_PLAN_V3_SYSTEM_PROMPT + CLIENT_PLAN_UPDATE);
    expect(body.temperature).toBe(0.7);
    const input = JSON.parse(body.messages[0].content).input;
    expect(input).toHaveProperty('recent_14_days');
    expect(input.output_constraints).not.toHaveProperty('headline');
    expect(input.output_constraints).not.toHaveProperty('duration_minutes');
    expect(store.rows.coachPlanRevisionsV1[0].output.workout).toBe(p.workout.text);
  } finally {
    globalThis.fetch = priorFetch;
    if (priorKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = priorKey;
    if (priorModel === undefined) delete process.env.PROGRESS_COACH_MODEL;
    else process.env.PROGRESS_COACH_MODEL = priorModel;
  }
});

test('two distinct validation failures can be revised while retaining total latency', async () => {
  const s = state();
  let calls = 0;
  const result = await generateV3WithRepair({
    snapshot: s,
    day,
    recentPlans: [],
    call: async (guidance) => {
      calls++;
      if (calls === 2) expect(guidance.validationCode).toBe('why_length');
      if (calls === 3) expect(guidance.validationCode).toBe('water_target');
      const p = candidate(s);
      return {
        ok: true,
        output:
          calls === 1
            ? { ...p, why: 'Too short.' }
            : calls === 2
              ? { ...p, meals: { text: dailyMealGuidance(4), water_litres: 4 } }
              : p,
        latencyMs: 10,
        inputTokens: 20,
        outputTokens: 30,
      };
    },
  });
  expect(result).toMatchObject({ ok: true, latencyMs: 30, inputTokens: 60, outputTokens: 90 });
  expect(calls).toBe(3);
});

test('calorie language and invented empty training history are rejected', () => {
  const s = state('lose');
  s.health.workouts = [];
  const p = candidate(s, { minutes: 25, target: 8000 });
  expect(() =>
    validate({ ...p, why: p.why.replace('supports recovery', 'burns calories') }, s)
  ).toThrow('unsafe_language');
  expect(() =>
    validate(
      {
        ...p,
        why: p.why.replace('fits the effort you feel ready for', 'fits no training this week'),
      },
      s
    )
  ).toThrow('invented_missing_history');
});

test('approximate explanation length and optional gentle rest wording do not discard safe plans', () => {
  const s = state();
  const p = candidate(s);
  const extended = {
    ...p,
    why: p.why.replace(
      'Keeping these small habits steady',
      'Keeping these small habits steady day after day at a comfortable pace while you gradually build more confidence in the routine'
    ),
  };
  expect(extended.why.split(/\s+/).length).toBeLessThanOrEqual(145);
  expect(validate(extended, s).workout.type).toBe('full_body_strength');
  const unwell = state('fitness');
  unwell.daily.body = ['pain_unwell'];
  const rest = candidate(unwell, { type: 'rest', water: 2 });
  expect(
    validate(
      {
        ...rest,
        workout: {
          ...rest.workout,
          text: 'Gentle stretching or a short easy walk if you feel up to it.',
        },
      },
      unwell
    ).workout
  ).toEqual({ type: 'rest' });
});

test('recovery restrictions reach the provider choices for every body/yesterday combination', () => {
  for (const body of [
    ['fine'],
    ['sore_upper'],
    ['sore_lower'],
    ['sore_upper', 'sore_lower'],
    ['pain_unwell'],
  ]) {
    for (const trainedYesterday of [
      ['nothing'],
      ['upper_body'],
      ['lower_body'],
      ['upper_body', 'lower_body'],
      ['other'],
    ]) {
      const s = state();
      s.daily.body = body;
      s.daily.trainedYesterday = trainedYesterday;
      const c = buildDailyProviderInputV3(s, day, []).output_constraints;
      const upper = body.includes('sore_upper') || trainedYesterday.includes('upper_body');
      const lower = body.includes('sore_lower') || trainedYesterday.includes('lower_body');
      expect(c.body_parts_with_recovery_evidence).toEqual([
        ...(upper ? ['upper'] : []),
        ...(lower ? ['lower'] : []),
      ]);
      if (upper) {
        expect(c.workout_allowed_types).not.toContain('upper_body_strength');
        expect(c.workout_allowed_types).not.toContain('full_body_strength');
      }
      if (lower) {
        expect(c.workout_allowed_types).not.toContain('lower_body_strength');
        expect(c.workout_allowed_types).not.toContain('full_body_strength');
      }
      if (c.rest_required) expect(c.workout_allowed_types).toEqual(['rest']);
      expect(c.workout_allowed_types).toContain('rest');
    }
  }
});

test('repaired V3 generation lowers randomness and explains both recovery failure codes', async () => {
  const s = state();
  s.daily.trainedYesterday = ['upper_body'];
  let body;
  await generateDailyPlan({
    config,
    input: buildDailyProviderInputV3(s, day, []),
    style: { tone: 'friendly', detail: 'balanced' },
    promptVersion: DAILY_PLAN_V3_PROMPT_VERSION,
    retryGuidance: { previousCandidate: candidate(s), validationCode: 'upper_body_recovery' },
    fetchImpl: async (_url, init) => {
      body = JSON.parse(init.body);
      return response(candidate(s, { type: 'lower_body_strength' }));
    },
  });
  expect(body.temperature).toBe(0.2);
  const types = body.tools[0].input_schema.properties.workout.properties.type.enum;
  expect(types).not.toContain('upper_body_strength');
  expect(types).not.toContain('full_body_strength');
  expect(types).toContain('lower_body_strength');
  const message = JSON.parse(body.messages[0].content);
  expect(message.body_recovery_rule).toContain('invented_body_recovery');
  expect(message.body_recovery_rule).toContain('Rewrite Workout AND Why together');
});

test('workout label comes from validated metadata rather than exact AI spelling', () => {
  const s = state();
  for (const text of [
    '35 minute full-body strength session',
    'Full body strength for 35 minutes',
    '30-minute cardio workout',
  ]) {
    const p = candidate(s);
    p.workout.text = text;
    const result = validate(p, s);
    expect(result.output.workout).toBe('35-minute full body strength workout');
    expect(result.workout.type).toBe('full_body_strength');
    expect(result.workout.durationMinutes).toBe(35);
  }
});

test('label formatting cannot bypass load, recovery, unsafe copy or workout variety rules', () => {
  const s = state();
  const p = candidate(s);
  p.workout.text = 'An easy session';
  expect(() => validate({ ...p, workout: { ...p.workout, minutes: 33 } }, s)).toThrow(
    'workout_duration'
  );
  const recovering = state();
  recovering.daily.trainedYesterday = ['upper_body'];
  expect(() => validate(p, recovering)).toThrow('upper_body_recovery');
  expect(() =>
    validate({ ...p, workout: { ...p.workout, text: 'Burn calories today' } }, s)
  ).toThrow('unsafe_language');
  expect(() =>
    validateDailyPlanOutputV3(p, s, day, [
      { day: '2026-10-07', output: { workout: '35-minute full body strength workout' } },
      { day: '2026-10-06', output: { workout: '35-minute full body strength workout' } },
    ])
  ).toThrow('repeated_workout');
});

test('new explanations persist separately while legacy V3 remains readable', () => {
  const snapshot = state();
  const output = candidate(snapshot);
  expect(validate(output, snapshot).detailsV2).toBeUndefined();
  output.explanations = {
    sleep: 'For body recomp, seven hours of sleep supports recovery after your activity.',
    workout:
      'For body recomp, this 35-minute full body session builds strength at a manageable effort.',
    steps: 'For body recomp, 7,500 steps adds steady movement alongside your strength session.',
    meals:
      'For body recomp, protein at every meal, half the plate vegetables, a fist of carbs and 2.5 litres of water support recovery.',
  };
  const plan = validate(output, snapshot);
  expect(plan.detailsV2?.workoutReason).toBe(output.explanations.workout);
  expect(plan.detailsV2?.sleepReason).toBe(output.explanations.sleep);
  expect(plan.detailsV2?.mealsReason).toBe(output.explanations.meals);
  expect(plan.detailsV2?.stepsReason).toBe(output.explanations.steps);
  output.explanations.sleep = 'Count calories before sleep.';
  expect(() => validate(output, snapshot)).toThrow();
});

test('explanation length failures name the field and repair preserves the plan targets', async () => {
  const snapshot = state();
  const valid = candidate(snapshot);
  valid.explanations = {
    sleep: 'Rest supports your goal.',
    workout: 'Movement supports your goal.',
    steps: 'Daily movement supports your goal.',
    meals: 'Balanced portions and water support your goal.',
  };
  for (const key of ['workout', 'steps', 'sleep', 'meals']) {
    const limit = DAILY_PLAN_EXPLANATION_LIMITS[key];
    const boundary = structuredClone(valid);
    boundary.explanations[key] = 'a'.repeat(limit);
    expect(() => validate(boundary, snapshot)).not.toThrow();
    boundary.explanations[key] += 'a';
    // The structural guard rejects entries above 800 before copy validation.
    expect(() => validate(boundary, snapshot)).toThrow(
      limit === 800 ? 'invalid_structure' : `invalid_copy:${key}Reason`
    );
  }
  const invalid = structuredClone(valid);
  invalid.explanations.workout = 'a'.repeat(301);
  const guidance = [];
  const result = await generateV3WithRepair({
    snapshot,
    day,
    recentPlans: [],
    call: async (retry) => {
      guidance.push(retry);
      return { ok: true, output: retry ? valid : invalid, latencyMs: 1 };
    },
  });
  expect(result.ok).toBe(true);
  expect(guidance[1].validationCode).toBe('invalid_copy:workoutReason');
  expect(result.output.workout).toEqual(valid.workout);
});

test('provider tool and instructions use the same explanation limits as validation', async () => {
  const snapshot = state();
  let body;
  await generateDailyPlan({
    config,
    input: buildDailyProviderInputV3(snapshot, day, []),
    style: { tone: 'warm_direct', detail: 'standard' },
    promptVersion: DAILY_PLAN_V3_PROMPT_VERSION,
    retryGuidance: {
      previousCandidate: candidate(snapshot),
      validationCode: 'invalid_copy:workoutReason',
    },
    fetchImpl: async (_url, init) => {
      body = JSON.parse(init.body);
      return response(candidate(snapshot));
    },
  });
  const message = JSON.parse(body.messages[0].content);
  for (const key of ['workout', 'steps', 'sleep', 'meals']) {
    const limit = DAILY_PLAN_EXPLANATION_LIMITS[key];
    expect(body.tools[0].input_schema.properties.explanations.properties[key].maxLength).toBe(
      limit
    );
    expect(message.explanation_character_limits[key]).toBe(limit);
  }
  expect(message.copy_validation_rule).toContain('workoutReason means explanations.workout');
  expect(message.validation_failure).toBe('invalid_copy:workoutReason');
});

test('week boundaries use Monday and coach choice retains broad safe options', () => {
  const snapshot = state();
  snapshot.daily.upFor = 'coach_decide';
  snapshot.daily.trainedYesterday = ['nothing'];
  const monday = buildDailyProviderInputV3(snapshot, '2026-10-19', []);
  expect(monday.calendar_week.starts_on).toBe('2026-10-19');
  const sunday = buildDailyProviderInputV3(snapshot, '2026-10-18', []);
  expect(sunday.calendar_week.starts_on).toBe('2026-10-12');
  expect(monday.output_constraints.workout_allowed_types).toContain('full_body_strength');
  expect(monday.output_constraints.workout_allowed_types).toContain('mobility');
  snapshot.daily.trainedYesterday = ['core'];
  expect(
    buildDailyProviderInputV3(snapshot, day, []).output_constraints.workout_allowed_types
  ).not.toContain('core');
});

test('core yesterday is respected by the output validator as well as the provider bounds', () => {
  const snapshot = state();
  snapshot.daily.trainedYesterday = ['core'];
  expect(() => validate(candidate(snapshot, { type: 'core', minutes: 25 }), snapshot)).toThrow(
    'core_recovery'
  );
});

test('Nothing overrides a suggested core session and conflicting yesterday log', () => {
  const s = state();
  s.health.workouts = [
    {
      day: '2026-10-07',
      label: 'workout',
      source: 'activity_log',
      plannedType: 'core',
      plannedMinutes: 30,
    },
  ];
  const input = buildDailyProviderInputV3(s, day, [
    {
      day: '2026-10-07',
      output: { workout: '30-minute core workout', why: "After yesterday's core session" },
    },
  ]);
  expect(input.recent_14_days.completed_workout_check_ins).toEqual([]);
  expect(input.last_5_plans[0].completed).toBe('unknown');
  expect(input.last_5_plans[0].output).toBeUndefined();
  const p = candidate(s);
  p.why = p.why.replace(
    "today's full body strength plan",
    "after yesterday's core session, today's full body strength plan"
  );
  expect(() => validate(p, s)).toThrow('invented_yesterday_training');
});

test('logged lower body description overrides the suggested upper body workout', () => {
  const s = state();
  delete s.daily.trainedYesterday;
  s.health.workouts = [
    {
      day: '2026-10-07',
      label: 'workout',
      source: 'activity_log',
      memberNote: 'Finished my lower body workout today',
      plannedType: 'upper_body_strength',
      plannedMinutes: 60,
    },
  ];
  const input = buildDailyProviderInputV3(s, day, []);
  expect(input.today.trainedYesterday).toEqual(['lower_body']);
  expect(input.output_constraints.workout_allowed_types).not.toContain('lower_body_strength');
  expect(input.output_constraints.workout_allowed_types).toContain('upper_body_strength');
  expect(input.recent_14_days.completed_workout_check_ins[0].plannedType).toBeUndefined();
  expect(() => validate(candidate(s, { type: 'lower_body_strength' }), s)).toThrow(
    'lower_body_recovery'
  );
  s.daily.trainedYesterday = ['upper_body'];
  expect(buildDailyProviderInputV3(s, day, []).today.trainedYesterday).toEqual(['upper_body']);
});

test('coach choice uses observed 15000 steps rather than an 8000 step suggestion', () => {
  const s = state();
  s.daily.upFor = 'coach_decide';
  s.health.steps = ['2026-10-04', '2026-10-05', '2026-10-06'].map((day) => ({
    day,
    count: 15000,
    source: 'health_sync',
    coverage: 'sensor_observed',
  }));
  const input = buildDailyProviderInputV3(s, day, [
    { day: '2026-10-07', output: { steps: '8000 steps', workout: 'Core' } },
  ]);
  expect(input.recent_14_days.step_average).toBe(15000);
});
