// @ts-nocheck -- Offline reliability audit: no live provider or member writes.
import { expect, test } from 'bun:test';
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';

import { auditDay, auditSnapshot, auditCandidate } from './coachDailyAuditFixtures';
import { buildDailyProviderInputV3, validateDailyPlanOutputV3 } from '../convex/coachDailyPolicyV3';
import { DAILY_PLAN_V3_PROMPT_VERSION } from '../convex/coachDailyPromptV3';
import { generateDailyPlan, v3ToolSchema } from '../convex/coachDailyProvider';
import { generateV3WithRepair } from '../convex/coachDailyRepair';

const bodies = [
  ['fine'],
  ['sore_upper'],
  ['sore_lower'],
  ['sore_upper', 'sore_lower'],
  ['pain_unwell'],
  ['sore_upper', 'pain_unwell'],
  ['sore_lower', 'pain_unwell'],
  ['sore_upper', 'sore_lower', 'pain_unwell'],
];
const training = [
  ['nothing'],
  ['upper_body'],
  ['lower_body'],
  ['other'],
  ['upper_body', 'lower_body'],
  ['upper_body', 'other'],
  ['lower_body', 'other'],
  ['upper_body', 'lower_body', 'other'],
  ['cardio'],
  undefined,
];
test('input envelope remains satisfiable across 51,840 categorical/history combinations', () => {
  let checked = 0;
  const errors = [];
  for (const goal of ['lose', 'recomp', 'fitness'])
    for (const sleep of ['barely_rested', 'rested_enough', 'restful'])
      for (const energy of ['flat', 'steady', 'full'])
        for (const upFor of ['full_session', 'short_session', 'something_light', 'rest_day'])
          for (const body of bodies)
            for (const trainedYesterday of training)
              for (const history of ['new', 'normal', 'low', 'high', 'consecutive', 'sparse']) {
                const s = auditSnapshot(history);
                s.profile.goal = goal;
                s.daily = { sleep, energy, upFor, body, trainedYesterday };
                const c = buildDailyProviderInputV3(s, auditDay, []).output_constraints;
                const schema = v3ToolSchema({ output_constraints: c }).properties;
                try {
                  expect(
                    schema.steps.properties.target.minimum <= schema.steps.properties.target.maximum
                  ).toBe(true);
                  expect(schema.workout.properties.type.enum.length > 0).toBe(true);
                  const rest =
                    body.includes('pain_unwell') || body.length === 2 || upFor === 'rest_day';
                  const p = auditCandidate(s, { type: rest ? 'rest' : 'walking' });
                  const result = validateDailyPlanOutputV3(p, s, auditDay, []);
                  expect(result.workout.type).toBe(rest ? 'rest' : 'walking');
                  expect(result.stepTarget).toBe(body.includes('pain_unwell') ? 0 : 3000);
                } catch (e) {
                  errors.push({
                    goal,
                    sleep,
                    energy,
                    upFor,
                    body,
                    trainedYesterday,
                    history,
                    code: e.message,
                  });
                }
                checked++;
              }
  mkdirSync('artifacts/coach-v3-audit', { recursive: true });
  writeFileSync(
    'artifacts/coach-v3-audit/matrix.json',
    JSON.stringify(
      {
        kind: 'offline constraint satisfiability; not AI calls or personalization assessment',
        checked,
        passed: checked - errors.length,
        failed: errors.length,
        errors: errors.slice(0, 20),
      },
      null,
      2
    ) + '\n'
  );
  expect(checked).toBe(51840);
  expect(errors).toEqual([]);
});

test('normal coaching language is not mistaken for unsupported body-part recovery', () => {
  const s = auditSnapshot('normal');
  const p = auditCandidate(s, { type: 'upper_body_strength' });
  p.why = p.why.replace(
    'Protein with every meal supports recovery',
    'Protein with every meal supports recovery'
  );
  expect(() => validateDailyPlanOutputV3(p, s, auditDay, [])).not.toThrow();
  const q = auditCandidate(s);
  q.why = q.why.replace(
    'today’s easy movement helps you build a routine you can keep',
    'upper body strength supports your fitness, while sleep helps recovery'
  );
  expect(() => validateDailyPlanOutputV3(q, s, auditDay, [])).not.toThrow();
});

test('actual unsupported soreness and recovery claims remain rejected', () => {
  const s = auditSnapshot();
  for (const phrase of [
    'your upper body needs recovery',
    'give your lower body time to recover',
    'your upper body is sore',
    'let your lower body recover',
  ]) {
    const p = auditCandidate(s);
    p.why = p.why.replace('today’s easy movement helps you build a routine you can keep', phrase);
    expect(() => validateDailyPlanOutputV3(p, s, auditDay, [])).toThrow('invented_body_recovery');
  }
});

test('sleep copy cannot contradict its numeric target', () => {
  const s = auditSnapshot();
  const p = auditCandidate(s);
  p.sleep.text = 'Aim for 17 hours tonight.';
  expect(() => validateDailyPlanOutputV3(p, s, auditDay, [])).toThrow('sleep_target');
});

test('malformed nested payloads return a stable validation error', () => {
  const s = auditSnapshot();
  for (const extra of [
    { workout: [] },
    { workout: { text: 'Walk', type: null, minutes: 20, intensity: 'low' } },
    { steps: { target: Infinity } },
    { sleep: { hours: 7, text: null } },
  ]) {
    expect(() =>
      validateDailyPlanOutputV3({ ...auditCandidate(s), ...extra }, s, auditDay, [])
    ).toThrow();
  }
});

test('provider V3 diagnostics do not ask for removed V2 workoutExamples', async () => {
  const p = auditCandidate(auditSnapshot());
  delete p.sleep;
  const r = await generateDailyPlan({
    config: { apiKey: 'fake', model: 'fake', maxOutputTokens: 2400, timeoutMs: 100 },
    input: {},
    style: { tone: 'warm_direct', detail: 'standard' },
    promptVersion: DAILY_PLAN_V3_PROMPT_VERSION,
    fetchImpl: async () =>
      new Response(
        JSON.stringify({ content: [{ type: 'tool_use', name: 'submit_daily_plan', input: p }] }),
        { status: 200 }
      ),
  });
  expect(r.ok).toBe(false);
  expect(r.formatCode).toBe('missing_field');
});

test('captured fictional false-rejection candidates now pass without changing recommendations', () => {
  const cases = JSON.parse(
    readFileSync('tests/fixtures/coach-v3-fictional-regressions.json', 'utf8')
  );
  expect(cases.length).toBe(7);
  for (const row of cases) {
    const result = validateDailyPlanOutputV3(row.output, row.snapshot, row.day, []);
    expect(result.workout.type).toBe(row.output.workout.type);
    expect(result.workout.durationMinutes).toBe(row.output.workout.minutes);
  }
});

test('one repair receives all independent validator failures rather than one at a time', async () => {
  const s = auditSnapshot();
  s.daily.trainedYesterday = ['upper_body'];
  s.daily.sleep = 'barely_rested';
  const bad = auditCandidate(s, { type: 'upper_body_strength', target: 12000 });
  bad.headline = 'Rest';
  bad.sleep = { hours: 7, text: 'Aim for 7 hours tonight.' };
  bad.why = bad.why.replace('water', 'fluids');
  let count = 0;
  const r = await generateV3WithRepair({
    snapshot: s,
    day: auditDay,
    recentPlans: [],
    call: async (guidance) => {
      if (++count === 2)
        expect(guidance.validationCodes).toEqual(
          expect.arrayContaining([
            'headline_length',
            'why_missing_water',
            'upper_body_recovery',
            'poor_readiness_steps',
            'sleep_target',
          ])
        );
      return { ok: true, output: count === 1 ? bad : auditCandidate(s), latencyMs: 10 };
    },
  });
  expect(r.ok).toBe(true);
  expect(count).toBe(2);
  expect(r.latencyMs).toBe(20);
});

test('malformed V3 nested fields report invalid_structure without V2-only field names', async () => {
  const p = auditCandidate(auditSnapshot());
  p.steps.target = '3000';
  const r = await generateDailyPlan({
    config: { apiKey: 'fake', model: 'fake', maxOutputTokens: 2400, timeoutMs: 100 },
    input: {},
    style: { tone: 'warm_direct', detail: 'standard' },
    promptVersion: DAILY_PLAN_V3_PROMPT_VERSION,
    fetchImpl: async () =>
      new Response(
        JSON.stringify({ content: [{ type: 'tool_use', name: 'submit_daily_plan', input: p }] }),
        { status: 200 }
      ),
  });
  expect(r).toMatchObject({ ok: false, code: 'invalid_output', formatCode: 'invalid_structure' });
});

test('exhausted format repair remains a provider format error, not plan validation', async () => {
  let count = 0;
  const r = await generateV3WithRepair({
    snapshot: auditSnapshot(),
    day: auditDay,
    recentPlans: [],
    call: async () => {
      count++;
      return { ok: false, code: 'invalid_output', formatCode: 'truncated', latencyMs: 10 };
    },
  });
  expect(count).toBe(3);
  expect(r).toMatchObject({ ok: false, formatCode: 'truncated', latencyMs: 30 });
});

test('provider outage after an invalid candidate retains total elapsed latency and fails closed', async () => {
  let count = 0;
  const r = await generateV3WithRepair({
    snapshot: auditSnapshot(),
    day: auditDay,
    recentPlans: [],
    call: async () =>
      ++count === 1
        ? {
            ok: true,
            output: { ...auditCandidate(auditSnapshot()), headline: 'Short' },
            latencyMs: 10,
          }
        : { ok: false, code: 'provider_timeout', latencyMs: 30 },
  });
  expect(count).toBe(3);
  expect(r).toMatchObject({ ok: false, code: 'provider_timeout', latencyMs: 320 });
});

for (const [status, code] of [
  [400, 'provider_unavailable'],
  [401, 'provider_unavailable'],
  [429, 'provider_rate_limited'],
  [500, 'provider_unavailable'],
  [503, 'provider_unavailable'],
])
  test(`provider HTTP ${status} never creates an accepted plan`, async () => {
    const r = await generateDailyPlan({
      config: { apiKey: 'fake', model: 'fake', maxOutputTokens: 2400, timeoutMs: 100 },
      input: {},
      style: { tone: 'warm_direct', detail: 'standard' },
      promptVersion: DAILY_PLAN_V3_PROMPT_VERSION,
      fetchImpl: async () => new Response('{}', { status }),
    });
    expect(r).toMatchObject({ ok: false, code });
  });

test('strict schema is supported by the production model and contains only supported constraints', async () => {
  const { strictV3ToolSchema, supportsStrictDailyTool } =
    await import('../convex/coachDailyProvider');
  expect(supportsStrictDailyTool('claude-haiku-4-5-20251001')).toBe(true);
  expect(supportsStrictDailyTool('test-model')).toBe(false);
  const s = auditSnapshot();
  s.daily.body = ['pain_unwell'];
  const schema = strictV3ToolSchema(buildDailyProviderInputV3(s, auditDay, []));
  const text = JSON.stringify(schema);
  for (const forbidden of ['minimum', 'maximum', 'multipleOf', 'maxLength'])
    expect(text).not.toContain(`"${forbidden}"`);
  expect(schema.properties.steps.properties.target.enum).toEqual([0]);
  expect(schema.properties.workout.properties.type.enum).toEqual(['rest']);
  expect(schema.properties.workout.properties.minutes.enum).toEqual([0]);
  expect(schema.properties.sleep.properties.hours.enum).toEqual([8, 8.5, 9]);
  expect(schema.properties.meals.properties.water_litres.enum).toEqual([2, 2.5, 3]);
  let body;
  await generateDailyPlan({
    config: {
      apiKey: 'fake',
      model: 'claude-haiku-4-5-20251001',
      maxOutputTokens: 2400,
      timeoutMs: 100,
    },
    input: buildDailyProviderInputV3(s, auditDay, []),
    style: { tone: 'warm_direct', detail: 'standard' },
    promptVersion: DAILY_PLAN_V3_PROMPT_VERSION,
    fetchImpl: async (_u, init) => {
      body = JSON.parse(init.body);
      return new Response('{}', { status: 503 });
    },
  });
  expect(body.tools[0].strict).toBe(true);
  expect(body.system[0].text).toContain('THE MOST IMPORTANT RULE: RESPECT HER GOAL');
});

test('yesterday training with today advice is distinct from claiming completion today', () => {
  const s = auditSnapshot('normal');
  s.daily.trainedYesterday = ['upper_body'];
  const p = auditCandidate(s);
  p.why = p.why.replace(
    'today’s easy movement helps you build a routine you can keep',
    'you trained upper body yesterday, so today is for easy movement'
  );
  expect(() => validateDailyPlanOutputV3(p, s, auditDay, [])).not.toThrow();
  for (const text of [
    'you completed a workout today',
    'you have logged a workout today',
    'you’ve trained today',
  ]) {
    const q = auditCandidate(s);
    q.why = q.why.replace('today’s easy movement helps you build a routine you can keep', text);
    expect(() => validateDailyPlanOutputV3(q, s, auditDay, [])).toThrow('invented_completion');
  }
});

test('goal-specific nutrition reminder preserves the V3 portion instructions', () => {
  for (const goal of ['lose', 'recomp', 'fitness']) {
    const s = auditSnapshot();
    s.profile.goal = goal;
    const c = buildDailyProviderInputV3(s, auditDay, []).output_constraints;
    expect(c.nutrition_guidance).toContain(goal === 'lose' ? 'a quarter' : 'a third');
    expect(c.nutrition_guidance).toContain('fist-sized');
    expect(c.nutrition_guidance).toContain('half the plate');
  }
});

test('repair names the exact prohibited phrases and specific foods to remove', async () => {
  const s = auditSnapshot();
  const p = auditCandidate(s);
  p.why = p.why
    .replace('small habits', 'good food habits')
    .replace('Protein with every meal', 'Protein from eggs with every meal');
  let calls = 0;
  const r = await generateV3WithRepair({
    snapshot: s,
    day: auditDay,
    recentPlans: [],
    call: async (guidance) => {
      if (++calls === 2) {
        expect(guidance.validationFeedback.prohibited_terms).toContain('good food');
        expect(guidance.validationFeedback.food_names).toContain('eggs');
        expect(guidance.validationCodes).toContain('unsafe_language');
        expect(guidance.validationCodes).toContain('food_names');
      }
      return { ok: true, output: calls === 1 ? p : auditCandidate(s), latencyMs: 10 };
    },
  });
  expect(r.ok).toBe(true);
  expect(calls).toBe(2);
});

test('supplied V3 prompt file is byte-for-byte unchanged during this audit', async () => {
  const { createHash } = await import('node:crypto');

  expect(
    createHash('sha256').update(readFileSync('convex/coachDailyPromptV3.ts')).digest('hex')
  ).toBe('d12114a7b0f71eade5233642f58938716837281fc06465874f93e615d32f430a');
});

test('one transient timeout can recover inside the original three-call budget', async () => {
  let count = 0;
  const s = auditSnapshot();
  const r = await generateV3WithRepair({
    snapshot: s,
    day: auditDay,
    recentPlans: [],
    call: async () =>
      ++count === 1
        ? { ok: false, code: 'provider_timeout', latencyMs: 30 }
        : { ok: true, output: auditCandidate(s), latencyMs: 10 },
  });
  expect(count).toBe(2);
  expect(r.ok).toBe(true);
  expect(r.latencyMs).toBe(290);
});

test('permanent provider configuration errors and rate limits never trigger internal retry', async () => {
  for (const failure of [
    { code: 'provider_unavailable', formatCode: 'provider_http_400' },
    { code: 'provider_unavailable', formatCode: 'provider_http_401' },
    { code: 'provider_rate_limited' },
  ]) {
    let count = 0;
    const r = await generateV3WithRepair({
      snapshot: auditSnapshot(),
      day: auditDay,
      recentPlans: [],
      call: async () => {
        count++;
        return { ok: false, ...failure, latencyMs: 10 };
      },
    });
    expect(r.ok).toBe(false);
    expect(count).toBe(1);
  }
});

test('strict schema stays bounded even when no member constraints are supplied', async () => {
  const { strictV3ToolSchema } = await import('../convex/coachDailyProvider');
  const schema = strictV3ToolSchema({});
  expect(schema.properties.steps.properties.target.enum.length).toBe(25);
  expect(JSON.stringify(schema).length).toBeLessThan(5000);
  expect(schema.properties.headline.pattern).toBeUndefined();
});

test('invalid Haiku candidates use Sonnet repair with the same V3 instructions and input', async () => {
  let body;
  const s = auditSnapshot();
  const p = auditCandidate(s);
  const r = await generateDailyPlan({
    config: {
      apiKey: 'fake',
      model: 'claude-haiku-4-5-20251001',
      maxOutputTokens: 2400,
      timeoutMs: 100,
    },
    input: buildDailyProviderInputV3(s, auditDay, []),
    style: { tone: 'warm_direct', detail: 'standard' },
    promptVersion: DAILY_PLAN_V3_PROMPT_VERSION,
    retryGuidance: {
      previousCandidate: { ...p, headline: 'Short' },
      validationCode: 'headline_length',
      validationCodes: ['headline_length'],
    },
    fetchImpl: async (_u, init) => {
      body = JSON.parse(init.body);
      return new Response(
        JSON.stringify({ content: [{ type: 'tool_use', name: 'submit_daily_plan', input: p }] }),
        { status: 200 }
      );
    },
  });
  expect(body.model).toBe(
    process.env.COACH_V3_REPAIR_MODEL?.trim() || 'claude-sonnet-4-5-20250929'
  );
  expect(body.tools[0].strict).toBe(true);
  expect(JSON.parse(body.messages[0].content).input).toEqual(
    buildDailyProviderInputV3(s, auditDay, [])
  );
  expect(body.system[0].text).toContain('THE MOST IMPORTANT RULE: RESPECT HER GOAL');
  expect(r.model).toBe(body.model);
  expect(r.ok).toBe(true);
});

test('copy refinement fills the V3 portion detail without changing the accepted targets', async () => {
  const s = auditSnapshot();
  const good = auditCandidate(s);
  const incomplete = { ...good, why: good.why.replace('up to a third of the plate, ', '') };
  let calls = 0;
  const r = await generateV3WithRepair({
    snapshot: s,
    day: auditDay,
    recentPlans: [],
    call: async (guidance) => {
      if (++calls === 2) expect(guidance.validationCode).toBe('why_portion_guidance');
      return { ok: true, output: calls === 1 ? incomplete : good, latencyMs: 10 };
    },
  });
  expect(calls).toBe(2);
  expect(r.ok).toBe(true);
  expect(r.output.why).toBe(good.why);
  expect(r.output.workout).toEqual(good.workout);
});

test('failed copy refinement retains only a validated current-request AI candidate', async () => {
  const s = auditSnapshot();
  const good = auditCandidate(s);
  good.why = good.why.replace('up to a third of the plate, ', '');
  for (const second of [
    { ok: false, code: 'provider_timeout', latencyMs: 10 },
    { ok: true, output: { ...auditCandidate(s), why: 'Too short.' }, latencyMs: 10 },
    { ok: true, output: auditCandidate(s, { target: 3500 }), latencyMs: 10 },
  ]) {
    let calls = 0;
    const r = await generateV3WithRepair({
      snapshot: s,
      day: auditDay,
      recentPlans: [],
      call: async () => (++calls === 1 ? { ok: true, output: good, latencyMs: 10 } : second),
    });
    expect(r.ok).toBe(true);
    expect(r.output).toEqual(good);
    expect(calls <= 3).toBe(true);
    if (!second.ok) expect(calls).toBe(2);
  }
});
