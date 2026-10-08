import type { Infer } from 'convex/values';

import type { DailyOutput, DailySnapshot, ValidatedPlan } from './coachDailyPolicy';
import { observedSteps } from './coachDailyPolicy';
import { planOutputV3 } from './coachFoundationValidators';
import { hasBodyFeeling } from '../shared/coachBodyFeeling';
import { dailyMealGuidance, DAILY_PLAN_COPY_LIMITS } from '../shared/coachPlanCopy';
import { addDaysToDateKey } from './utils/timezone';

export type DailyOutputV3 = Infer<typeof planOutputV3>;
const TYPES = [
  'full_body_strength',
  'upper_body_strength',
  'lower_body_strength',
  'core',
  'cardio',
  'walking',
  'mobility',
  'stretching',
  'rest',
] as const;
const GOALS = {
  lose: 'Lose weight',
  recomp: 'Maintain weight (body recomp)',
  fitness: 'Improve fitness',
};
const BASE_STEPS = { lose: 8000, recomp: 7500, fitness: 6500 };
const FOOD_NAMES =
  /\b(?:eggs?|fish|chicken|rice|jollof|plantain|yam|beans|tofu|turkey|salmon|bread|pasta|potatoes|broccoli|spinach|fufu)\b/i;
const INTERNAL_COPY =
  /\b(?:verified|sensor|algorithm|your data|according to your history|no (?:data|history)|history is missing|tracking|readiness score)\b/i;
const UNSAFE_COPY =
  /\b(?:calories|grams|cheat|guilty|lazy|failed|bad food|good food|should)\b|\d\s*(?:kg|lbs?|pounds)/i;

function fail(code: string): never {
  throw new Error(code);
}
function sentenceCount(text: string) {
  return (text.match(/[.!?](?:\s|$)/g) ?? []).length;
}

export function buildDailyProviderInputV3(
  snapshot: DailySnapshot,
  day: string,
  recentPlans: { day: string; output: DailyOutput }[]
) {
  const from = addDaysToDateKey(day, -14);
  const inWindow = (date: string) => date >= from && date < day;
  const steps = observedSteps(snapshot).filter((row) => inWindow(row.day));
  const workouts = snapshot.health.workouts.filter(
    (row) => row.source === 'activity_log' && inWindow(row.day)
  );
  const workoutDays = new Set(
    workouts
      .filter(
        (row) => !['walking', 'mobility', 'stretching', 'rest'].includes(row.plannedType ?? '')
      )
      .map((row) => row.day)
  );
  let consecutive = 0;
  for (let offset = 1; offset <= 14; offset++) {
    if (!workoutDays.has(addDaysToDateKey(day, -offset))) break;
    consecutive++;
  }
  const recentDays = (snapshot.health.recentDays ?? []).filter((row) => inWindow(row.day));
  const strengthCount = workouts.filter(
    (row) => row.day >= addDaysToDateKey(day, -7) && row.plannedType?.endsWith('_strength')
  ).length;
  const average =
    steps.length >= 3
      ? Math.round(steps.reduce((sum, row) => sum + row.count, 0) / steps.length)
      : null;
  const poor = snapshot.daily.sleep === 'barely_rested' || snapshot.daily.energy === 'flat';
  const pain = hasBodyFeeling(snapshot.daily.body, 'pain_unwell');
  const restRequired =
    pain ||
    snapshot.daily.upFor === 'rest_day' ||
    (hasBodyFeeling(snapshot.daily.body, 'sore_upper') &&
      hasBodyFeeling(snapshot.daily.body, 'sore_lower'));
  const maxMinutes = Math.min(
    workouts.length ? 90 : 35,
    poor ? 40 : 90,
    consecutive >= 5 ? 30 : 90,
    snapshot.daily.upFor === 'short_session' ? 25 : 90,
    snapshot.daily.upFor === 'something_light' ? 30 : 90
  );

  return {
    goal: GOALS[snapshot.profile.goal],
    profile: snapshot.profile,
    today: {
      day,
      ...snapshot.daily,
      energy_label: { flat: 'Flat', steady: 'Steady', full: 'Upbeat' }[snapshot.daily.energy],
    },
    recent_14_days: {
      steps,
      step_average:
        steps.length >= 3
          ? Math.round(steps.reduce((sum, row) => sum + row.count, 0) / steps.length)
          : null,
      completed_workout_check_ins: workouts,
      consecutive_training_days: consecutive,
      completed_strength_plan_check_ins_last_7_days: strengthCount,
      check_in_days: recentDays,
      // These are recorded plan intents, not inferred rest days or measured sleep.
      rest_days_planned: recentDays.filter((row) => row.restPlanned).map((row) => row.day),
      sleep_check_ins: recentDays
        .filter((row) => row.completedCategories.includes('sleep'))
        .map((row) => ({ day: row.day })),
    },
    last_5_plans: recentPlans
      .filter((row) => inWindow(row.day))
      .sort((a, b) => b.day.localeCompare(a.day))
      .slice(0, 5),
    output_constraints: {
      steps_min: 3000,
      steps_max: pain
        ? 0
        : Math.min(
            12000,
            average === null ? 12000 : Math.max(3000, Math.floor((average + 2000) / 500) * 500),
            poor ? Math.max(3000, average ?? BASE_STEPS[snapshot.profile.goal]) : 12000
          ),
      starting_steps_from_goal: BASE_STEPS[snapshot.profile.goal],
      rest_required: restRequired,
      workout_max_minutes: restRequired ? 0 : maxMinutes,
      workout_allowed_intensity:
        restRequired || consecutive >= 5 || snapshot.daily.upFor === 'something_light'
          ? ['low']
          : poor || consecutive >= 5 || !workouts.length
            ? ['low', 'moderate']
            : ['low', 'moderate', 'high'],
      sleep_min_hours: pain || snapshot.daily.sleep === 'barely_rested' ? 8 : 7,
      sleep_text_template: 'Aim for {sleep.hours} hours tonight.',
      explanation_contract:
        'Why: aim for 5 complete sentences and 105 to 115 words. In the first two sentences name her goal and explain workout/rest from readiness and recent pattern. Link steps, protein, vegetables, carbs, water and sleep to this goal and activity. Include ALL nutrient groups and water even on rest/unwell days. Do not turn Why into a brief summary.',
      why_outline: [
        'Sentence 1: Name her goal and explain the workout/rest choice from today and the real recent pattern.',
        'Sentence 2: Explain how the selected steps support the goal and fit today.',
        'Sentence 3: Include protein with every meal, half the plate vegetables, and a fist-sized carb portion (quarter of the plate for weight loss, up to a third for recomp/fitness), and why it fits today.',
        'Sentence 4: Explain why this water amount and sleep target fit her goal and today.',
        'Sentence 5: Teach one short useful lesson or gently encourage the next small step.',
      ],
      goal_priority:
        'For body recomp, a fresh member choosing a full session with fewer than two recent strength-plan check-ins benefits from moderate strength. Barely rested alone reduces the effort and length; it does not require complete rest. A full session with no training history must stay at or below workout_max_minutes. After five consecutive training days recommend easy movement or rest as recovery, never a last push before rest. Do not mention calories, calorie burn, or a deficit even for a weight loss goal.',

      steps_if_unwell: 0,
      water_min: 1.5,
      water_max: 3,
      meal_text: "Log today's meals for feedback. Aim for {x} litres of water.",
    },
    history_note:
      'An absent check-in is unknown, not a rest day. plannedType/plannedMinutes on a completed check-in describe the recommendation, not measured workout duration. Do not claim actual hours slept from a sleep photo.',
  };
}

/** AI chooses the recommendation. This validates safety, truth and the client output contract. */
export function validateDailyPlanOutputV3(
  value: unknown,
  snapshot: DailySnapshot,
  day: string,
  recentPlans: { day: string; output: DailyOutput }[] = []
): ValidatedPlan & { sleepTargetHours: number } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('invalid_structure');
  const data = value as DailyOutputV3;
  if (
    Object.keys(data).sort().join('|') !==
      ['headline', 'workout', 'steps', 'meals', 'sleep', 'why'].sort().join('|') ||
    !data.workout ||
    !data.steps ||
    !data.meals ||
    !data.sleep
  )
    fail('invalid_structure');
  const fields = {
    headline: data.headline,
    workout: data.workout.text,
    steps: 'Steps',
    meals: data.meals.text,
    sleep: data.sleep.text,
    why: data.why,
  };
  for (const [key, text] of Object.entries(fields)) {
    if (
      typeof text !== 'string' ||
      !text.trim() ||
      text.length > DAILY_PLAN_COPY_LIMITS[key as keyof typeof fields]
    )
      fail('invalid_copy');
    if (UNSAFE_COPY.test(text)) fail('unsafe_language');
    if (INTERNAL_COPY.test(text)) fail('internal_copy');
    if (FOOD_NAMES.test(text)) fail('food_names');
  }
  const headlineWords = data.headline.trim().split(/\s+/).length;
  if (headlineWords < 3 || headlineWords > 6) fail('headline_length');
  const whyWords = data.why.trim().split(/\s+/).length;
  // The client says about 90–130 words. Allow a small copy-length tolerance.
  if (whyWords < 80 || whyWords > 145 || sentenceCount(data.why) < 4 || sentenceCount(data.why) > 6)
    fail('why_length');
  const opening = data.why
    .split(/[.!?](?:\s|$)/)
    .slice(0, 2)
    .join(' ');
  const goalMention = {
    lose: /weight loss|los(?:e|ing) weight/i,
    recomp: /body recomp|recomposition/i,
    fitness: /improve (?:your )?fitness|fitness goal/i,
  }[snapshot.profile.goal];
  if (!goalMention.test(opening)) fail('goal_explanation');
  for (const [topic, pattern] of [
    ['protein', /protein/i],
    ['carbs', /carbs?|carbohydrates?/i],
    ['vegetables', /vegetables?/i],
    ['sleep', /sleep|restful|wind.down/i],
    ['water', /water|hydrat/i],
  ] as const) {
    if (!pattern.test(data.why)) fail(`why_missing_${topic}`);
  }
  const pain = hasBodyFeeling(snapshot.daily.body, 'pain_unwell');
  const context = buildDailyProviderInputV3(snapshot, day, recentPlans);
  const bothSore =
    hasBodyFeeling(snapshot.daily.body, 'sore_upper') &&
    hasBodyFeeling(snapshot.daily.body, 'sore_lower');
  const rest = data.workout.type === 'rest';
  const minutes = data.workout.minutes;
  if (
    !TYPES.includes(data.workout.type as (typeof TYPES)[number]) ||
    !['low', 'moderate', 'high'].includes(data.workout.intensity)
  )
    fail('workout_type');
  if (pain || bothSore || snapshot.daily.upFor === 'rest_day') {
    if (!rest) fail('rest_required');
  }
  if (rest) {
    if (
      minutes !== 0 ||
      data.workout.intensity !== 'low' ||
      (!/rest|recover/i.test(data.workout.text) &&
        !/(?:gentle|easy)[^.]{0,100}(?:optional|if you feel)/i.test(data.workout.text)) ||
      /strength|workout|interval|high[- ]intensity/i.test(data.workout.text)
    )
      fail('rest_target');
  } else {
    if (!Number.isInteger(minutes) || minutes < 5 || minutes > 90 || minutes % 5 !== 0)
      fail('workout_duration');
    const name = data.workout.type.replaceAll('_', ' ');
    if (
      !data.workout.text.toLowerCase().includes(name) ||
      !data.workout.text.includes(`${minutes}-minute`)
    )
      fail('workout_text_mismatch');
    const knownTraining = context.recent_14_days.completed_workout_check_ins.length > 0;
    if (!knownTraining && (minutes > 35 || data.workout.intensity === 'high'))
      fail('new_member_load');
    const poor = snapshot.daily.sleep === 'barely_rested' || snapshot.daily.energy === 'flat';
    if (poor && (data.workout.intensity === 'high' || minutes > 40)) fail('poor_readiness_load');
    if (
      context.recent_14_days.consecutive_training_days >= 5 &&
      (minutes > 30 || data.workout.intensity !== 'low')
    )
      fail('recent_training_load');
    if (snapshot.daily.upFor === 'short_session' && minutes > 25) fail('quick_session_duration');
    if (
      snapshot.daily.upFor === 'something_light' &&
      (minutes > 30 || data.workout.intensity !== 'low' || data.workout.type.endsWith('_strength'))
    )
      fail('light_session_load');
    const yesterday = snapshot.daily.trainedYesterday ?? [];
    if (
      (hasBodyFeeling(snapshot.daily.body, 'sore_upper') || yesterday.includes('upper_body')) &&
      ['upper_body_strength', 'full_body_strength'].includes(data.workout.type)
    )
      fail('upper_body_recovery');
    if (
      (hasBodyFeeling(snapshot.daily.body, 'sore_lower') || yesterday.includes('lower_body')) &&
      ['lower_body_strength', 'full_body_strength'].includes(data.workout.type)
    )
      fail('lower_body_recovery');
  }
  const target = data.steps.target;
  if (
    !Number.isInteger(target) ||
    (pain ? target !== 0 : target < 3000 || target > 12000 || target % 500 !== 0)
  )
    fail('steps_range');
  const average = context.recent_14_days.step_average;
  const baseline = average ?? BASE_STEPS[snapshot.profile.goal];
  if (!pain && average !== null && target > Math.max(3000, Math.ceil((average + 2000) / 500) * 500))
    fail('steps_progression');
  if (
    !pain &&
    (snapshot.daily.sleep === 'barely_rested' || snapshot.daily.energy === 'flat') &&
    target > Math.max(3000, baseline)
  )
    fail('poor_readiness_steps');
  const water = data.meals.water_litres;
  if (
    ![2, 2.5, 3].includes(water) ||
    data.meals.text !== dailyMealGuidance(water) ||
    (!rest && minutes >= 45 && water <= 2)
  )
    fail('water_target');
  const hours = data.sleep.hours;
  if (
    ![7, 7.5, 8, 8.5, 9].includes(hours) ||
    ((pain || snapshot.daily.sleep === 'barely_rested') && hours < 8) ||
    !data.sleep.text.includes(`${hours} hours`)
  )
    fail('sleep_target');
  if (pain && !/doctor|healthcare professional/i.test(data.why)) fail('unwell_guidance');
  const all = `${data.workout.text} ${data.why}`;
  if (
    context.recent_14_days.completed_strength_plan_check_ins_last_7_days >= 2 &&
    /strength (?:is|was) (?:the|a) gap|no strength (?:this week|sessions)|need to add (?:this|the strength) piece/i.test(
      data.why
    )
  )
    fail('unsupported_strength_gap');

  if (
    !context.recent_14_days.completed_workout_check_ins.length &&
    /no training (?:this|last) week|(?:have not|haven't|not) trained (?:this|last) week|no workouts? (?:this|last) week/i.test(
      data.why
    )
  )
    fail('invented_missing_history');

  const statedRun = data.why.match(/(?:trained|training)\s+(\d+)\s+days? in a row/i);
  if (statedRun && Number(statedRun[1]) !== context.recent_14_days.consecutive_training_days)
    fail('invented_training_load');
  for (const [part, trained, sore] of [
    ['lower', 'lower_body', 'sore_lower'],
    ['upper', 'upper_body', 'sore_upper'],
  ] as const) {
    if (
      !snapshot.daily.trainedYesterday?.includes(trained) &&
      !hasBodyFeeling(snapshot.daily.body, sore) &&
      new RegExp(
        `${part}[- ]body[^.!?]{0,45}(?:recover|sore)|(?:recover|sore)[^.!?]{0,45}${part}[- ]body`,
        'i'
      ).test(all)
    )
      fail('invented_body_recovery');
  }
  if (/you (?:completed|logged|trained|worked out)[^.!?]{0,35}today/i.test(all))
    fail('invented_completion');
  const last = recentPlans.find((plan) => plan.day === addDaysToDateKey(day, -1));
  if (last?.output.headline === data.headline) fail('repeated_headline');
  if (recentPlans.some((plan) => plan.output.why === data.why)) fail('repeated_explanation');
  const previousTwo = recentPlans.filter((plan) =>
    [addDaysToDateKey(day, -1), addDaysToDateKey(day, -2)].includes(plan.day)
  );
  if (
    !rest &&
    previousTwo.length === 2 &&
    previousTwo.every((plan) => plan.output.workout === data.workout.text)
  )
    fail('repeated_workout');
  return {
    output: {
      headline: data.headline,
      workout: data.workout.text,
      steps: pain
        ? 'No step target today. Rest is the priority.'
        : `${target.toLocaleString('en-US')} steps`,
      meals: data.meals.text,
      sleep: data.sleep.text,
      why: data.why,
    },
    workout: rest
      ? { type: 'rest' }
      : {
          type: data.workout.type as Exclude<(typeof TYPES)[number], 'rest'>,
          durationMinutes: minutes,
          intensity: data.workout.intensity,
        },
    stepTarget: target,
    sleepTargetHours: hours,
  };
}
