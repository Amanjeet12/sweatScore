import type {
  CoachComputedTargets,
  CoachContextSummary,
  CoachDailyInputs,
  CoachPlanOutput,
  CoachProfileValues,
} from '../shared/progressCoach';

export const COACH_POLICY_VERSION = 1;
export const COACH_DURATION_MINUTES = {
  wide_open: 30,
  window: 20,
  squeezed: 10,
  one_minute: 1,
} as const;
export const COACH_DURATION_LEVELS = [1, 10, 20, 30] as const;
export const COACH_STEP_ROUNDING_INCREMENT = 500;
export const COACH_DEFAULT_STEP_TARGET = 5000;
export const COACH_MIN_USABLE_DAYS = 3;
export const COACH_NORMAL_STEP_INCREASE = 500;
export const COACH_LOW_READINESS_STEP_REDUCTION = 500;
export const COACH_MAX_STEP_INCREASE_RATIO = 0.1;
export const COACH_MAX_STEP_TARGET = 10000;
export const COACH_MIN_STEP_TARGET = 2000;
export const COACH_REST_HYDRATION_LITRES = 2.0;
export const COACH_REDUCED_HYDRATION_LITRES = 2.0;
export const COACH_TRAINING_HYDRATION_LITRES = 2.5;

export const COACH_PAIN_FALLBACK_COPY = {
  headline: 'Make today a rest day',
  checkInLabel: 'Rest today and focus on basic care.',
  nutritionMessage:
    'Keep meals simple, with protein and vegetables, plus one carbohydrate serving.',
  why: 'Pain or feeling unwell is a reason to pause training today, not push through it.',
  safetyNotice:
    'Take a rest day and focus on basic care. If you feel seriously unwell, have new pain, or symptoms continue, consider speaking with a qualified healthcare professional.',
} as const;

export type CoachPolicyInput = {
  profile: CoachProfileValues;
  daily: CoachDailyInputs;
  verified: CoachContextSummary;
};

export type CoachPolicyResult = {
  computedTargets: CoachComputedTargets;
  fallback: CoachPlanOutput;
};

function roundToIncrement(value: number): number {
  return Math.round(value / COACH_STEP_ROUNDING_INCREMENT) * COACH_STEP_ROUNDING_INCREMENT;
}

function reduceDurationOneLevel(duration: number): number {
  const index = COACH_DURATION_LEVELS.findIndex((level) => level >= duration);
  return index <= 0 ? COACH_DURATION_LEVELS[0] : COACH_DURATION_LEVELS[index - 1];
}

function fallbackCheckInLabel(type: CoachComputedTargets['checkIn']['type']): string {
  switch (type) {
    case 'strength':
      return 'Log a strength check-in today.';
    case 'cardio':
      return 'Log a cardio check-in today.';
    case 'core':
      return 'Log a core check-in today.';
    case 'gentle_movement':
      return 'Keep today gentle and choose comfortable movement.';
    case 'rest':
      return 'Take a rest day today.';
  }
}

export function buildDeterministicCoachFallback(
  computedTargets: CoachComputedTargets,
  verified: CoachContextSummary
): CoachPlanOutput {
  if (computedTargets.safetyState === 'pain_or_unwell') {
    return {
      headline: COACH_PAIN_FALLBACK_COPY.headline,
      checkIn: {
        type: 'rest',
        durationMinutes: 0,
        label: COACH_PAIN_FALLBACK_COPY.checkInLabel,
      },
      nutrition: {
        carbServings: 1,
        message: COACH_PAIN_FALLBACK_COPY.nutritionMessage,
      },
      steps: {},
      hydration: { litres: COACH_REST_HYDRATION_LITRES },
      why: COACH_PAIN_FALLBACK_COPY.why,
      safetyNotice: COACH_PAIN_FALLBACK_COPY.safetyNotice,
    };
  }

  const carbServings = computedTargets.nutrition.carbServings;
  return {
    headline: 'Your plan for today',
    checkIn: {
      ...computedTargets.checkIn,
      label: fallbackCheckInLabel(computedTargets.checkIn.type),
    },
    nutrition: {
      carbServings,
      message: `Have ${carbServings} carbohydrate ${carbServings === 1 ? 'serving' : 'servings'} today, with protein and vegetables at meals.`,
    },
    steps: computedTargets.steps,
    hydration: computedTargets.hydration,
    why: `This plan reflects today’s check-in and ${verified.usableDays} usable recent tracking days.`,
  };
}

function getStepTarget(daily: CoachDailyInputs, verified: CoachContextSummary): number {
  if (verified.usableDays < COACH_MIN_USABLE_DAYS || verified.averageSteps === undefined) {
    return COACH_DEFAULT_STEP_TARGET;
  }

  const average = Math.max(0, verified.averageSteps);
  const roundedBaseline = roundToIncrement(average);
  let target = roundedBaseline;

  if (daily.sleep === 'barely_rested' && daily.energy === 'gentle_day') {
    target -= COACH_LOW_READINESS_STEP_REDUCTION;
  } else if (daily.sleep !== 'barely_rested' && daily.energy === 'ready_to_move') {
    target += COACH_NORMAL_STEP_INCREASE;
  }

  const tenPercentCap =
    Math.floor((average * (1 + COACH_MAX_STEP_INCREASE_RATIO)) / COACH_STEP_ROUNDING_INCREMENT) *
    COACH_STEP_ROUNDING_INCREMENT;

  target = Math.min(target, tenPercentCap, COACH_MAX_STEP_TARGET);

  if (tenPercentCap >= COACH_MIN_STEP_TARGET) {
    return Math.max(COACH_MIN_STEP_TARGET, target);
  }

  // For a very low personalized baseline, the 10-percent cap takes priority
  // over the normal floor. The cap is already rounded down to a 500-step increment.
  return Math.max(0, target);
}

export function applyCoachPolicy(input: CoachPolicyInput): CoachPolicyResult {
  const { daily, verified } = input;
  const painOrUnwell = daily.bodyCondition === 'pain_or_unwell';
  const reduced =
    !painOrUnwell &&
    (daily.sleep === 'barely_rested' ||
      daily.energy === 'gentle_day' ||
      daily.energy === 'little_to_give');

  let durationMinutes: number = COACH_DURATION_MINUTES[daily.availableTime];
  if (painOrUnwell) {
    durationMinutes = 0;
  } else if (daily.sleep === 'barely_rested' || daily.energy === 'gentle_day') {
    durationMinutes = reduceDurationOneLevel(durationMinutes);
  }

  const checkInType = painOrUnwell
    ? 'rest'
    : daily.availableTime === 'one_minute' || daily.energy === 'gentle_day'
      ? 'gentle_movement'
      : daily.bodyCondition === 'sore_upper'
        ? 'cardio'
        : daily.bodyCondition === 'sore_lower'
          ? 'core'
          : 'strength';
  const trainingDay =
    checkInType === 'strength' || checkInType === 'cardio' || checkInType === 'core';
  const safetyState = painOrUnwell ? 'pain_or_unwell' : reduced ? 'reduced' : 'normal';
  const carbServings = trainingDay ? 2 : 1;
  const hydrationLitres = painOrUnwell
    ? COACH_REST_HYDRATION_LITRES
    : reduced
      ? COACH_REDUCED_HYDRATION_LITRES
      : trainingDay
        ? COACH_TRAINING_HYDRATION_LITRES
        : COACH_REST_HYDRATION_LITRES;
  const stepTarget = painOrUnwell ? undefined : getStepTarget(daily, verified);

  const computedTargets: CoachComputedTargets = {
    safetyState,
    mayCallClaude: !painOrUnwell,
    checkIn: { type: checkInType, durationMinutes },
    nutrition: {
      carbServings,
      proteinWithMeals: true,
      vegetablesWithMeals: true,
    },
    steps: stepTarget === undefined ? {} : { target: stepTarget },
    hydration: { litres: hydrationLitres },
  };

  const fallback = buildDeterministicCoachFallback(computedTargets, verified);

  return { computedTargets, fallback };
}
