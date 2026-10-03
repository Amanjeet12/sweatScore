import { DAILY_PLAN_COPY_LIMITS, mealPlanSummary } from '../shared/coachPlanCopy';
import { dailyPolicy, validateDailyPlanOutput, verifiedStepAverage } from './coachDailyPolicy';
import type { DailyOutput, DailySnapshot, ValidatedPlan } from './coachDailyPolicy';
import { addDaysToDateKey } from './utils/timezone';

export type DailyOutputV2 = DailyOutput & {
  workoutExamples: string[];
  workoutReason: string;
  stepsReason: string;
};
export type DailyDetailsV2 = Pick<
  DailyOutputV2,
  'workoutExamples' | 'workoutReason' | 'stepsReason'
>;

const EXAMPLES: Record<string, readonly string[]> = {
  full_body_strength: ['chair squats', 'wall push-ups', 'glute bridges'],
  upper_body_strength: ['wall push-ups', 'seated rows', 'arm circles'],
  lower_body_strength: ['chair squats', 'glute bridges', 'step-ups'],
  core: ['dead bugs', 'bird dogs', 'gentle planks'],
  jump_rope: ['easy skips', 'alternating-foot steps', 'side steps'],
  cardio: ['brisk walking', 'marching in place', 'easy cycling'],
};
const FOODS = [
  'eggs',
  'egg',
  'fish',
  'salmon',
  'tuna',
  'chicken',
  'turkey',
  'tofu',
  'tempeh',
  'yoghurt',
  'yogurt',
  'lentils',
  'beans',
  'chickpeas',
  'oats',
  'omelette',
];
const unsafe =
  /\b(?:calories|macros|grams|sets?|reps?|weights?|cheat(?:ing)?|bad food|good food)\b|—/i;
const remembered = /\b(?:you (?:logged|ate|had)|your last (?:meal|food))\b/i;
const preference =
  /\b(?:you enjoy|you like|your (?:usual|favourite|favorite|preferred) (?:meal|food))\b/i;

const FALLBACK_EXAMPLES: Record<string, string[]> = {
  full_body_strength: ['chair squats', 'wall push-ups'],
  upper_body_strength: ['wall push-ups', 'seated rows'],
  lower_body_strength: ['chair squats', 'glute bridges'],
  core: ['dead bugs', 'bird dogs'],
  jump_rope: ['easy skips', 'alternating-foot steps'],
  cardio: ['brisk walking', 'marching in place'],
};

function text(value: unknown, max: number) {
  if (typeof value !== 'string' || !value.trim() || value.length > max || unsafe.test(value))
    throw new Error('invalid_output');
  return value.trim();
}

export function validateDailyPlanOutputV2(
  value: unknown,
  snapshot: DailySnapshot,
  day: string,
  recentPlans: { day: string; output: DailyOutput }[] = []
): ValidatedPlan & { detailsV2: DailyDetailsV2 } {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('invalid_output');
  const data = value as Record<string, unknown>;
  const keys = [
    'headline',
    'workout',
    'workoutExamples',
    'workoutReason',
    'steps',
    'stepsReason',
    'sleep',
    'meals',
    'why',
  ];
  if (Object.keys(data).sort().join('|') !== keys.sort().join('|'))
    throw new Error('invalid_output');
  const { workoutExamples, workoutReason, stepsReason, ...six } = data;
  for (const [key, max] of Object.entries(DAILY_PLAN_COPY_LIMITS)) {
    if (
      typeof (value as Record<string, unknown>)[key] !== 'string' ||
      ((value as Record<string, unknown>)[key] as string).length > max
    )
      throw new Error('invalid_output');
  }
  if (mealPlanSummary(six.meals as string) !== (six.meals as string).trim()) throw new Error('invalid_output');
  const base = validateDailyPlanOutput(six, snapshot, day, recentPlans);
  if (!Array.isArray(workoutExamples) || workoutExamples.some((item) => typeof item !== 'string'))
    throw new Error('invalid_output');
  const examples = (workoutExamples as string[]).map((item) => item.trim().toLowerCase());
  const workoutExplanation = text(workoutReason, 300);
  const stepExplanation = text(stepsReason, 300);
  const historyClaim =
    /\b(?:you (?:completed|logged|trained|worked out)[^.!?]{0,45}yesterday|yesterday[^.!?]{0,45}you (?:completed|logged|trained|worked out)|yesterday['’]s (?:full[- ]body|upper[- ]body|lower[- ]body|leg|strength|cardio|light|hard)?\s*(?:session|workout|training|work))\b/i.test(
      `${workoutExplanation} ${base.output.why}`
    );
  if (
    historyClaim &&
    !snapshot.health.workouts.some(
      (item) => item.source === 'activity_log' && item.day === addDaysToDateKey(day, -1)
    )
  )
    throw new Error('invalid_output');
  if (base.workout.type === 'rest') {
    if (
      examples.length ||
      !/rest|recover/i.test(workoutExplanation) ||
      /\b(?:try|exercise|workout)\b/i.test(workoutExplanation)
    )
      throw new Error('invalid_output');
  } else {
    const allowed = EXAMPLES[base.workout.type];
    if (
      examples.length < 2 ||
      examples.length > 3 ||
      new Set(examples).size !== examples.length ||
      examples.some((item) => !allowed.includes(item))
    )
      throw new Error('invalid_output');
    if (
      snapshot.daily.body === 'sore_upper' &&
      (!/(?:upper[- ]body|arms?)/i.test(workoutExplanation) ||
        !/recover|rest|avoid/i.test(workoutExplanation))
    )
      throw new Error('invalid_output');
    if (
      snapshot.daily.body === 'sore_lower' &&
      (!/(?:legs?|lower[- ]body)/i.test(workoutExplanation) ||
        !/recover|rest|avoid/i.test(workoutExplanation))
    )
      throw new Error('invalid_output');
  }
  const avg = verifiedStepAverage(snapshot);
  // A count of observed days or a duration is not a second step target.
  const stepNumbers = [...stepExplanation.matchAll(/\b(\d[\d,]*)\s+steps?\b/gi)].map((match) =>
    Number(match[1].replaceAll(',', ''))
  );
  // The explanation may repeat the single canonical target. When an observed
  // average exists it may cite that too; neither is a second target.
  if (stepNumbers.some((number) => number !== base.stepTarget && number !== avg))
    throw new Error('invalid_output');
  if (avg === undefined) {
    if (
      /\baverage|averaging\b/i.test(`${stepExplanation} ${base.output.why}`) ||
      /\b(?:your recent steps|your observed steps|your usual steps|your step history)\b/i.test(
        `${stepExplanation} ${base.output.why}`
      ) ||
      !/\b(today|sleep|energy|sore|pain|rest|light|ready)\b/i.test(stepExplanation)
    )
      throw new Error('invalid_output');
  } else if (!/recent steps|observed steps|usual steps|walking|average/i.test(stepExplanation)) {
    throw new Error('invalid_output');
  }
  const targetNumber = base.stepTarget.toLocaleString('en-US');
  if (!base.output.why.includes(targetNumber) && !base.output.why.includes(String(base.stepTarget)))
    throw new Error('invalid_output');
  const workoutMention: Record<string, RegExp> = {
    rest: /rest|recover/i,
    lower_body_strength: /lower[- ]body|legs?/i,
    upper_body_strength: /upper[- ]body|arms?/i,
    full_body_strength: /full[- ]body|strength/i,
    core: /core/i,
    jump_rope: /jump|rope|skip/i,
    cardio: /cardio|walking|cycling|march/i,
  };
  if (!workoutMention[base.workout.type].test(base.output.why)) throw new Error('invalid_output');
  const mealFood = FOODS.find((food) => new RegExp(`\\b${food}\\b`, 'i').test(base.output.meals));
  const priorFoodClaim = remembered.test(`${base.output.meals} ${base.output.why}`);
  const claimedFoods = FOODS.filter((food) =>
    new RegExp(
      `\\b(?:you (?:logged|ate|had)|your last (?:meal|food))\\b[^.!?]{0,60}\\b${food}\\b`,
      'i'
    ).test(`${base.output.meals} ${base.output.why}`)
  );
  const captionSupportsFood = (snapshot.mealHistory ?? []).some(
    (item) =>
      item.source === 'shared_member_caption' &&
      new RegExp(`\\b${mealFood}\\b`, 'i').test(item.caption)
  );
  if (
    !mealFood ||
    !/meal|food|eggs?|fish|salmon|tuna|chicken|tofu|beans|lentils|yogurt|yoghurt|chickpeas|oats|omelette/i.test(
      base.output.why
    ) ||
    /protein at the centre of every plate/i.test(base.output.meals) ||
    preference.test(`${base.output.meals} ${base.output.why}`) ||
    (priorFoodClaim &&
      (!captionSupportsFood ||
        !claimedFoods.length ||
        claimedFoods.some(
          (food) =>
            !(snapshot.mealHistory ?? []).some(
              (item) =>
                item.source === 'shared_member_caption' &&
                new RegExp(`\\b${food}\\b`, 'i').test(item.caption)
            )
        )))
  )
    throw new Error('invalid_output');
  if (
    snapshot.daily.body === 'pain_unwell' &&
    /\b(?:exercise|squats|push-ups|planks)\b/i.test(`${workoutExplanation} ${base.output.why}`)
  )
    throw new Error('invalid_output');
  return {
    ...base,
    detailsV2: {
      workoutExamples: examples,
      workoutReason: workoutExplanation,
      stepsReason: stepExplanation,
    },
  };
}

export function workoutRecommendationV2(
  output: DailyOutput,
  details: DailyDetailsV2,
  rest: boolean
) {
  if (rest) return output.workout;
  return `${output.workout} Try ${details.workoutExamples.join(', ')}. ${details.workoutReason}`;
}
export function stepsRecommendationV2(output: DailyOutput, details: DailyDetailsV2) {
  return `${output.steps}. ${details.stepsReason}`;
}

/** Safe local copy used only after both provider candidates fail validation. */
export function buildDeterministicDailyPlanV2(
  snapshot: DailySnapshot,
  day: string,
  recentPlans: { day: string; output: DailyOutput }[] = []
): DailyOutputV2 {
  const policy = dailyPolicy(snapshot, day);
  if (policy.unresolved) throw new Error('policy_unresolved');
  const average = verifiedStepAverage(snapshot);
  const stepTarget =
    average === undefined
      ? policy.missingHistoryTarget
      : Math.max(500, Math.floor((average + 2000) / 500) * 500);
  const steps = `${stepTarget.toLocaleString('en-US')} steps`;
  const rest = policy.rest;
  let type =
    snapshot.daily.body === 'sore_upper'
      ? 'lower_body_strength'
      : snapshot.daily.body === 'sore_lower'
        ? 'upper_body_strength'
        : 'full_body_strength';
  const yesterday = recentPlans.find((plan) => plan.day === addDaysToDateKey(day, -1));
  if (
    !rest &&
    snapshot.daily.body === 'fine' &&
    yesterday?.output.workout.includes('full body strength')
  )
    type = 'upper_body_strength';
  const duration =
    policy.duration === 'light'
      ? 10
      : policy.duration === 'short' || policy.duration === 'recovery'
        ? 20
        : 45;
  const workoutNames: Record<string, string> = {
    full_body_strength: 'full body strength',
    upper_body_strength: 'upper body strength',
    lower_body_strength: 'lower body strength',
  };
  const workout = rest
    ? 'No workout today. Keep your streak going by logging your meals, steps and sleep.'
    : `Log a ${duration}-minute ${workoutNames[type]} workout today.`;
  const workoutReason = rest
    ? 'Rest gives your body time to recover today.'
    : snapshot.daily.body === 'sore_upper'
      ? 'A lower-body session lets your upper body recover today.'
      : snapshot.daily.body === 'sore_lower'
        ? 'An upper-body session lets your lower body recover today.'
        : 'This session fits your energy and readiness today.';
  const stepsReason =
    average === undefined
      ? 'This target fits today’s sleep and energy without assuming a step history.'
      : 'Your recent step average and today’s readiness make this a practical target.';
  const meals = 'Try eggs with vegetables and aim for 2 litres of water today.';
  const workoutSummary = rest
    ? 'Rest supports recovery'
    : type === 'lower_body_strength'
      ? 'Lower-body strength supports recovery for your upper body'
      : type === 'upper_body_strength'
        ? 'Upper-body strength supports recovery for your lower body'
        : 'Full-body strength fits your readiness';
  return {
    headline: policy.headline,
    workout,
    workoutExamples: rest ? [] : FALLBACK_EXAMPLES[type],
    workoutReason,
    steps,
    stepsReason,
    sleep: policy.sleep,
    meals,
    why: `${workoutSummary}, while ${steps} fit today’s answers. Eggs with vegetables offer a simple meal option.`,
  };
}
