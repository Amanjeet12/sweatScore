// @ts-nocheck -- Bun test runtime hooks are outside the app TypeScript project.
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { DAILY_PLAN_PROMPT_VERSION, DAILY_PLAN_SYSTEM_PROMPT } from '../convex/coachDailyPrompt';
import {
  DAILY_PLAN_V2_PROMPT_VERSION,
  DAILY_PLAN_V2_SYSTEM_PROMPT,
} from '../convex/coachDailyPromptV2';
import {
  buildDeterministicDailyPlanV2,
  validateDailyPlanOutputV2,
} from '../convex/coachDailyPolicyV2';
import { generateV2WithRepair } from '../convex/coachDailyRepair';
import { generateDailyPlan, V2_OUTPUT_TOKENS } from '../convex/coachDailyProvider';
import { planCardRoute, planCardState } from '../shared/coachPlanCards';

const day = '2026-09-28';
const snapshot = {
  profile: {
    goal: 'lose',
    bodyFeeling: 'feel_good',
    routineFeeling: 'working_keep_going',
    foodRelationship: 'balanced_most_days',
    usualSleep: 'regular_restful',
    biggestChallenge: 'time',
  },
  weight: { value: 165, unit: 'lb' },
  weightHistory: [],
  daily: {
    sleep: 'barely_rested',
    energy: 'steady',
    mood: 'good',
    upFor: 'something_light',
    body: 'sore_upper',
  },
  health: { steps: [], workouts: [], streak: 0 },
  recentPlanRevisionIds: [],
  mealHistory: [],
};
const output = {
  headline: 'Keep it light today.',
  workout: 'Log a 10-minute lower body strength workout today.',
  workoutExamples: ['chair squats', 'glute bridges'],
  workoutReason: 'A short leg session lets your upper body recover today.',
  steps: '5,000 steps',
  stepsReason: 'Your lighter energy today makes this target a manageable start.',
  sleep:
    "Aim for 7 hours tonight. You didn't sleep well last night, so start winding down earlier than usual.",
  meals:
    'Try eggs with vegetables toward your goal, aim for 2 litres of water today, and snap each meal for a portion check.',
  why: 'Your sore upper body can recover with lower body strength, while 5,000 steps fit your lighter day. Eggs with vegetables are one simple option toward your goal.',
};
const validate = (value = output, state = snapshot) => validateDailyPlanOutputV2(value, state, day);

describe('v2 daily plan contract', () => {
  test('v1 remains intact and v2 pins lower-body and numeric steps', () => {
    expect(DAILY_PLAN_PROMPT_VERSION).toBe('client-daily-plan-v1');
    expect(DAILY_PLAN_SYSTEM_PROMPT).toContain('EXAMPLE 3 (recovery rule)');
    expect(DAILY_PLAN_V2_PROMPT_VERSION).toBe('client-daily-plan-v2');
    const plan = validate();
    expect(plan.workout).toEqual({ type: 'lower_body_strength', durationMinutes: 10 });
    expect(plan.stepTarget).toBe(5000);
    expect(plan.detailsV2.workoutExamples).toEqual(['chair squats', 'glute bridges']);
  });
  test('rejects wrong-body examples, unsupported step targets and fabricated averages', () => {
    expect(() =>
      validate({ ...output, workoutExamples: ['wall push-ups', 'chair squats'] })
    ).toThrow('invalid_output');
    expect(() => validate({ ...output, steps: '7,500 steps' })).toThrow('invalid_output');
    expect(() => validate({ ...output, stepsReason: 'Your average is 6,500 steps.' })).toThrow(
      'invalid_output'
    );
    expect(() =>
      validate({ ...output, stepsReason: 'Your recent steps and energy fit this target today.' })
    ).toThrow('invalid_output');
    expect(() =>
      validate({
        ...output,
        workoutReason: 'Your upper body can recover from yesterday’s full body session.',
      })
    ).toThrow('invalid_output');
  });
  test('natural explanation wording can pass without relaxing canonical plan rules', () => {
    expect(
      validate({
        ...output,
        workoutReason: 'This leg session gives your arms room to recover today.',
        why: 'A leg session suits your upper-body soreness; a 5,000-step target fits your light day. A meal with eggs and vegetables is a practical option.',
      }).stepTarget
    ).toBe(5000);
  });
  test('steps explanation may repeat the single saved target without inventing history', () => {
    expect(
      validate({
        ...output,
        stepsReason: 'Your lighter energy today makes 5,000 steps a manageable target.',
      }).stepTarget
    ).toBe(5000);
    expect(() =>
      validate({ ...output, stepsReason: 'Try 6,000 steps because today feels light.' })
    ).toThrow('invalid_output');
  });
  test('rest and pain cannot suggest exercise or open workout proof', () => {
    const state = {
      ...snapshot,
      daily: { ...snapshot.daily, body: 'pain_unwell', upFor: 'rest_day' },
    };
    const rest = {
      ...output,
      headline: 'Rest and recover today.',
      workout: 'No workout today. Keep your streak going by logging your meals, steps and sleep.',
      workoutExamples: [],
      workoutReason: 'Rest lets your body recover today.',
      why: 'Rest fits your pain answer; 5,000 steps are a gentle target and eggs with vegetables are a simple meal idea.',
    };
    expect(validate(rest, state).workout.type).toBe('rest');
    expect(() => validate({ ...rest, workoutExamples: ['chair squats'] }, state)).toThrow(
      'invalid_output'
    );
    expect(planCardState('workout', true, 0).canLog).toBe(false);
  });
  test('lower-body soreness yields upper-body examples while preserving the light duration', () => {
    const state = { ...snapshot, daily: { ...snapshot.daily, body: 'sore_lower' } };
    const upper = {
      ...output,
      workout: 'Log a 10-minute upper body strength workout today.',
      workoutExamples: ['wall push-ups', 'seated rows'],
      workoutReason: 'A short upper-body session lets your lower body recover today.',
      why: 'Upper body strength lets your lower body recover; 5,000 steps fit your lighter day and eggs with vegetables are a simple meal option.',
    };
    expect(validate(upper, state).workout.type).toBe('upper_body_strength');
    expect(() =>
      validate({ ...upper, workoutExamples: ['chair squats', 'step-ups'] }, state)
    ).toThrow('invalid_output');
  });
  test('prior-food claims require a recorded shared caption and never imply preference', () => {
    const claim = {
      ...output,
      meals:
        'You logged eggs before; try eggs with vegetables, aim for 2 litres of water today, and snap each meal for a portion check.',
    };
    expect(() => validate(claim)).toThrow('invalid_output');
    const state = {
      ...snapshot,
      mealHistory: [
        { day: '2026-09-27', caption: 'Eggs and toast', source: 'shared_member_caption' },
      ],
    };
    expect(validate(claim, state).output.meals).toContain('You logged eggs');
    expect(() =>
      validate(
        {
          ...claim,
          meals:
            'Your favourite food is eggs; aim for 2 litres of water and snap each meal for a portion check.',
        },
        state
      )
    ).toThrow('invalid_output');
  });
  test('provider tool is versioned; card counts reflect stable slots', async () => {
    let sent;
    const result = await generateDailyPlan({
      config: { apiKey: 'test', model: 'test', maxOutputTokens: V2_OUTPUT_TOKENS, timeoutMs: 1000 },
      input: {},
      style: { tone: 'warm_direct', detail: 'standard' },
      promptVersion: DAILY_PLAN_V2_PROMPT_VERSION,
      fetchImpl: async (_, init) => {
        sent = JSON.parse(init.body);
        return new Response(
          JSON.stringify({
            content: [{ type: 'tool_use', name: 'submit_daily_plan', input: output }],
          }),
          { status: 200 }
        );
      },
    });
    expect(result.ok).toBe(true);
    expect(sent.system).toBe(DAILY_PLAN_V2_SYSTEM_PROMPT);
    expect(sent.tools[0].input_schema.required).toContain('workoutExamples');
    await generateDailyPlan({
      config: { apiKey: 'test', model: 'test', maxOutputTokens: V2_OUTPUT_TOKENS, timeoutMs: 1000 },
      input: {},
      style: { tone: 'warm_direct', detail: 'standard' },
      promptVersion: DAILY_PLAN_V2_PROMPT_VERSION,
      retryGuidance: { previousCandidate: { ...output, why: 'Keep going.' } },
      fetchImpl: async (_, init) => {
        sent = JSON.parse(init.body);
        return new Response(
          JSON.stringify({
            content: [{ type: 'tool_use', name: 'submit_daily_plan', input: output }],
          }),
          { status: 200 }
        );
      },
    });
    expect(sent.temperature).toBe(0.2);
    expect(sent.messages[0].content).toContain('previous_candidate');
    expect(planCardState('meals', false, 2).status).toBe('2 of 3 shared');
    expect(planCardState('meals', false, 3).canLog).toBe(false);
    expect(planCardState('meals', false, 3).canOpen).toBe(true);
    expect(['workout', 'steps', 'sleep', 'meals'].map(planCardRoute)).toEqual([
      '/coach-check-in/workout',
      '/coach-check-in/steps',
      '/coach-check-in/sleep',
      '/coach-check-in/meals',
    ]);
  });
  test('opening the plan route has no generation or reward mutation', () => {
    const source = readFileSync(new URL('../app/coach-plan.tsx', import.meta.url), 'utf8');
    expect(source).toContain('api.revenueCatEntitlements.myPlan');
    expect(source).toContain('api.coachCheckIns.myToday');
    expect(source.match(/useMutation\(api\.[^)]+\)/g)).toEqual([
      'useMutation(api.coachDailyService.retryFailedPlan)',
      'useMutation(api.coachFoundation.resetMyTodayPlanForTesting)',
      'useMutation(api.coachFoundation.beginMyTodayReanswerForTesting)',
    ]);
    expect(source).not.toContain('generateDailyPlan');
    expect(source).not.toContain('completeProof');
  });
  test('saved plan uses a concise personalised dashboard without changing its actions', () => {
    const source = readFileSync(new URL('../app/coach-plan.tsx', import.meta.url), 'utf8');
    expect(source).toContain('Made for your day');
    expect(source).toContain('Today’s progress');
    expect(source).toContain('Your focus');
    expect(source).toContain('Why this fits you today');
    expect(source).toContain('numberOfLines={2}');
    expect(source).toContain("router.dismissTo({ pathname: '/(tabs)/dashboard'");
    expect(source).toContain('supportingPlanText(fullBody)');
    expect(source).toContain('setShowWhy((value) => !value)');
    expect(source).toContain('workoutYoutubeSearch(assignment?.label ?? fullBody)');
    expect(source).toContain('Search workout on YouTube');
    expect(source).not.toContain('workoutExamples.slice');
    expect(source).not.toContain('accessibilityLabel="Update your profile"');
    expect(source).not.toContain('accessibilityLabel="Back to Today"');
    expect(source).not.toContain("tint: '#EDF8F2'");
    expect(source).not.toContain("tint: '#F1EEFF'");
    expect(source).not.toContain('Why this was suggested');
  });
  test('saved pending state uses an honest, reduced-motion loading view on plan and paywall', () => {
    const plan = readFileSync(new URL('../app/coach-plan.tsx', import.meta.url), 'utf8');
    const paywall = readFileSync(
      new URL('../components/core/Paywall.tsx', import.meta.url),
      'utf8'
    );
    const loading = readFileSync(
      new URL('../components/core/dashboard/CoachPlanPreparing.tsx', import.meta.url),
      'utf8'
    );
    expect(plan).toContain("saved.requestStatus === 'pending'");
    expect(paywall).toContain("decision?.requestStatus === 'pending'");
    expect(loading).toContain('accessibilityRole="progressbar"');
    expect(loading).toContain('isReduceMotionEnabled');
    expect(loading).not.toMatch(/\d+%/);
  });
  test('an owned StoreKit subscription verifies instead of reopening checkout', () => {
    const paywall = readFileSync(
      new URL('../components/core/Paywall.tsx', import.meta.url),
      'utf8'
    );
    const provider = readFileSync(
      new URL('../components/providers/RevenueCatProvider.tsx', import.meta.url),
      'utf8'
    );
    expect(provider).toContain('hasActiveStoreSubscription');
    expect(provider).toContain('customerInfo.activeSubscriptions.length > 0');
    expect(paywall).toContain('hasActiveStoreSubscription) {');
    expect(paywall).toContain('await handleRestore()');
    expect(paywall).toContain("'Verify Premium access'");
  });
  test('one invalid provider candidate is revised inside the same logical request', async () => {
    const calls: unknown[] = [];
    const result = await generateV2WithRepair({
      snapshot,
      day,
      recentPlans: [],
      call: async (guidance) => {
        calls.push(guidance);
        return {
          ok: true,
          output: guidance ? output : { ...output, why: 'Keep going.' },
          latencyMs: 120,
          inputTokens: 10,
          outputTokens: 20,
        };
      },
    });
    expect(calls).toHaveLength(2);
    expect(calls[1]?.previousCandidate.why).toBe('Keep going.');
    expect(result).toMatchObject({ ok: true, latencyMs: 240, inputTokens: 20, outputTokens: 40 });
  });
  test('an invalid second candidate uses a validated fallback and a timeout is not retried', async () => {
    let attempts = 0;
    const invalid = await generateV2WithRepair({
      snapshot,
      day,
      recentPlans: [],
      call: async () => {
        attempts++;
        return { ok: true, output: { ...output, why: 'Keep going.' }, latencyMs: 100 };
      },
    });
    expect(invalid).toMatchObject({ ok: true, latencyMs: 200 });
    expect(() =>
      validateDailyPlanOutputV2(invalid.ok ? invalid.output : null, snapshot, day)
    ).not.toThrow();
    expect(attempts).toBe(2);
    attempts = 0;
    const timeout = await generateV2WithRepair({
      snapshot,
      day,
      recentPlans: [],
      call: async () => {
        attempts++;
        return { ok: false, code: 'provider_timeout', latencyMs: 30000 };
      },
    });
    expect(timeout).toMatchObject({ ok: false, code: 'provider_timeout' });
    expect(attempts).toBe(1);
  });

  test('deterministic recovery validates across daily answers and saved-history contexts', () => {
    const sleep = ['barely_rested', 'rested_enough', 'restful'];
    const energy = ['flat', 'steady', 'full'];
    const mood = ['low', 'okay', 'good', 'motivated'];
    const upFor = ['full_session', 'short_session', 'something_light', 'rest_day'];
    const body = ['fine', 'sore_upper', 'sore_lower', 'pain_unwell'];
    const historyContexts = [
      { health: snapshot.health, recentPlans: [] },
      {
        health: {
          ...snapshot.health,
          steps: [
            { day: '2026-09-25', count: 4200, source: 'health_sync', coverage: 'sensor_observed' },
            { day: '2026-09-26', count: 5100, source: 'health_sync', coverage: 'sensor_observed' },
            { day: '2026-09-27', count: 6000, source: 'health_sync', coverage: 'sensor_observed' },
          ],
        },
        recentPlans: [],
      },
      {
        health: snapshot.health,
        recentPlans: [
          {
            day: '2026-09-27',
            output: {
              ...output,
              workout: 'Log a 20-minute full body strength workout today.',
            },
          },
        ],
      },
      {
        health: {
          ...snapshot.health,
          workouts: ['2026-09-25', '2026-09-26', '2026-09-27'].map((workoutDay) => ({
            day: workoutDay,
            label: 'Workout',
            source: 'activity_log',
          })),
        },
        recentPlans: [],
      },
    ];
    let checked = 0;
    for (const context of historyContexts)
      for (const sleepValue of sleep)
        for (const energyValue of energy)
          for (const moodValue of mood)
            for (const upForValue of upFor)
              for (const bodyValue of body) {
                const state = {
                  ...snapshot,
                  health: context.health,
                  daily: {
                    sleep: sleepValue,
                    energy: energyValue,
                    mood: moodValue,
                    upFor: upForValue,
                    body: bodyValue,
                  },
                };
                const fallback = buildDeterministicDailyPlanV2(state, day, context.recentPlans);
                expect(() =>
                  validateDailyPlanOutputV2(fallback, state, day, context.recentPlans)
                ).not.toThrow();
                checked++;
              }
    expect(checked).toBe(2304);
  });

  test('daily questions share the image-led Coach setup design and top-only navigation', () => {
    const source = readFileSync(new URL('../app/coach-onboarding.tsx', import.meta.url), 'utf8');
    expect(source).toContain('const DAILY_COPY');
    expect(source).toContain('totalSteps={DAILY_QUESTIONS.length}');
    expect(source.match(/coach-onboarding\.jpg/g)?.length).toBe(2);
    expect(source).not.toContain('label="Previous question"');
    expect(source).toContain("'Choose one answer to continue.'");
  });
});
