import type { Doc } from './_generated/dataModel';
import { addDaysToDateKey } from './utils/timezone';

export type DailySnapshot = Doc<'coachPlanRequestsV1'>['inputSnapshot'];
export type DailyOutput = Doc<'coachPlanRevisionsV1'>['output'];
export type WorkoutMetadata = Doc<'coachPlanRevisionsV1'>['workout'];

const REST_WORKOUT =
  'No workout today. Keep your streak going by logging your meals, steps and sleep.';
const HEADLINES = {
  pain: 'Rest and recover today.',
  rest: 'Rest day, and that counts.',
  light: 'Keep it light today.',
  ease: 'Ease off, but keep moving.',
  push: 'Good day to push a little.',
} as const;
const SLEEP_COPY = {
  barely_rested:
    "Aim for 7 hours tonight. You didn't sleep well last night, so start winding down earlier than usual.",
  rested_enough: 'Aim for 7 hours tonight. Keep your usual bedtime routine.',
  restful: 'Aim for 7 hours again tonight. Whatever you did last night, do it again.',
} as const;
const TYPES = {
  'full body strength': 'full_body_strength',
  'upper body strength': 'upper_body_strength',
  'lower body strength': 'lower_body_strength',
  core: 'core',
  'jump rope': 'jump_rope',
  cardio: 'cardio',
} as const;

export function kilograms(value: number, unit: 'kg' | 'lb'): number {
  return Math.round((unit === 'kg' ? value : value * 0.45359237) * 100) / 100;
}

export function observedSteps(snapshot: DailySnapshot) {
  const unique = new Map<string, number>();
  for (const row of snapshot.health.steps) {
    if (
      row.source === 'health_sync' &&
      row.coverage === 'sensor_observed' &&
      Number.isFinite(row.count) &&
      row.count > 0
    ) {
      unique.set(row.day, Math.max(unique.get(row.day) ?? 0, row.count));
    }
  }
  return [...unique]
    .map(([day, count]) => ({ day, count }))
    .sort((a, b) => a.day.localeCompare(b.day));
}

export function verifiedStepAverage(snapshot: DailySnapshot): number | undefined {
  const steps = observedSteps(snapshot);
  if (steps.length < 3) return undefined;
  return Math.round(steps.reduce((sum, row) => sum + row.count, 0) / steps.length);
}

export function consecutiveCompletedWorkoutDays(snapshot: DailySnapshot, day: string): number {
  const days = new Set(
    snapshot.health.workouts
      .filter((item) => item.source === 'activity_log')
      .map((item) => item.day)
  );
  let count = 0;
  for (let offset = 1; offset <= 7; offset++) {
    if (!days.has(addDaysToDateKey(day, -offset))) break;
    count++;
  }
  return count;
}

export type DailyPolicy = {
  headline: string;
  sleep: string;
  rest: boolean;
  recovery: boolean;
  stepAverage?: number;
  missingHistoryTarget: 5000 | 7000;
  duration: 'rest' | 'light' | 'short' | 'full' | 'recovery';
  unresolved?: 'full_plus_poor_readiness' | 'recovery_plus_soreness' | 'high_steps_threshold';
};

export function dailyPolicy(snapshot: DailySnapshot, day: string): DailyPolicy {
  const today = snapshot.daily;
  const pain = today.body === 'pain_unwell';
  const recovery = consecutiveCompletedWorkoutDays(snapshot, day) >= 3;
  const poor = today.sleep === 'barely_rested' || today.energy === 'flat';
  const sore = today.body === 'sore_upper' || today.body === 'sore_lower';
  // Completed-workout recovery takes precedence over an opposite-body soreness
  // suggestion. On a full-session request with poor readiness, use the already
  // established short-session duration instead of requiring a new threshold.
  const rest = pain || today.upFor === 'rest_day' || (recovery && sore);
  const stepAverage = verifiedStepAverage(snapshot);
  // "Well above average" has no approved numeric threshold. Observed high
  // steps alone therefore never block generation or assert recovery. The
  // verified average and its +2,000 cap still constrain the target.
  const headline = pain
    ? HEADLINES.pain
    : today.upFor === 'rest_day'
      ? HEADLINES.rest
      : rest && recovery
        ? HEADLINES.ease
        : today.upFor === 'something_light'
          ? HEADLINES.light
          : poor || recovery
            ? HEADLINES.ease
            : HEADLINES.push;
  const duration: DailyPolicy['duration'] = rest
    ? 'rest'
    : recovery
      ? 'recovery'
      : poor && today.upFor === 'full_session'
        ? 'short'
        : today.upFor === 'something_light'
          ? 'light'
          : today.upFor === 'short_session'
            ? 'short'
            : 'full';
  return {
    headline,
    sleep: SLEEP_COPY[today.sleep],
    rest,
    recovery,
    stepAverage,
    missingHistoryTarget: headline === HEADLINES.push ? 7000 : 5000,
    duration,
  };
}

export type ValidatedPlan = { output: DailyOutput; workout: WorkoutMetadata; stepTarget: number };
export function validateDailyPlanOutput(
  value: unknown,
  snapshot: DailySnapshot,
  day: string,
  recentPlans: { day: string; output: DailyOutput }[] = []
): ValidatedPlan {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('invalid_output');
  const record = value as Record<string, unknown>;
  const keys = ['headline', 'workout', 'steps', 'sleep', 'meals', 'why'];
  if (Object.keys(record).sort().join('|') !== [...keys].sort().join('|'))
    throw new Error('invalid_output');
  const maxLength = { headline: 80, workout: 180, steps: 30, sleep: 180, meals: 500, why: 1200 };
  for (const key of keys) {
    if (
      typeof record[key] !== 'string' ||
      !(record[key] as string).trim() ||
      (record[key] as string).length > maxLength[key as keyof typeof maxLength] ||
      (record[key] as string).includes('—')
    )
      throw new Error('invalid_output');
  }
  const output = record as DailyOutput;
  const policy = dailyPolicy(snapshot, day);
  if (policy.unresolved) throw new Error('policy_unresolved');
  if (output.headline !== policy.headline || output.sleep !== policy.sleep)
    throw new Error('invalid_output');
  const steps = output.steps.match(/^([1-9]\d{0,2}(?:,\d{3})*) steps$/);
  if (!steps) throw new Error('invalid_output');
  const stepTarget = Number(steps[1].replaceAll(',', ''));
  if (stepTarget <= 0 || stepTarget % 500 !== 0) throw new Error('invalid_output');
  if (policy.stepAverage === undefined) {
    if (stepTarget !== policy.missingHistoryTarget || /averag/i.test(output.why))
      throw new Error('invalid_output');
  } else if (stepTarget > policy.stepAverage + 2000) throw new Error('invalid_output');
  const statedAverage = output.why.match(/averag(?:e|ing)(?: of| is)?\s+([\d,]+)\s+steps/i);
  if (statedAverage && Number(statedAverage[1].replaceAll(',', '')) !== policy.stepAverage)
    throw new Error('invalid_output');
  if (/(?:lost|gained|down|up)\s+[\d,.]+\s*(?:kg|lb|pounds|kilos)/i.test(output.why))
    throw new Error('invalid_output');
  const statedWorkoutRun = output.why.match(/train(?:ed|ing)\s+(\d+)\s+days? in a row/i);
  if (
    statedWorkoutRun &&
    Number(statedWorkoutRun[1]) !== consecutiveCompletedWorkoutDays(snapshot, day)
  )
    throw new Error('invalid_output');
  let workout: WorkoutMetadata;
  if (policy.rest || (policy.recovery && output.workout === REST_WORKOUT)) {
    if (output.workout !== REST_WORKOUT) throw new Error('invalid_output');
    workout = { type: 'rest' };
  } else {
    const match = output.workout.match(
      /^Log a (\d+)-minute (full body strength|upper body strength|lower body strength|core|jump rope|cardio) workout today\.$/
    );
    if (!match) throw new Error('invalid_output');
    const durationMinutes = Number(match[1]);
    const type = TYPES[match[2] as keyof typeof TYPES];
    if (
      (policy.duration === 'light' && durationMinutes !== 10) ||
      (policy.duration === 'short' && durationMinutes !== 20) ||
      (policy.duration === 'full' && durationMinutes < 45) ||
      (policy.duration === 'recovery' && durationMinutes > 20)
    )
      throw new Error('invalid_output');
    if (
      (snapshot.daily.body === 'sore_lower' && type !== 'upper_body_strength') ||
      (snapshot.daily.body === 'sore_upper' && type !== 'lower_body_strength')
    )
      throw new Error('invalid_output');
    if (policy.headline === HEADLINES.push && snapshot.daily.body === 'fine') {
      const last = recentPlans.find((plan) => plan.day === addDaysToDateKey(day, -1));
      const lastType = last?.output.workout.match(
        /\b(full body strength|upper body strength|lower body strength|core|jump rope|cardio) workout today\./
      )?.[1];
      if (lastType && lastType === match[2]) throw new Error('invalid_output');
      const suggestedStrength = recentPlans.filter((plan) =>
        /\b(full body|upper body|lower body) strength workout today\./.test(plan.output.workout)
      ).length;
      if (recentPlans.length >= 5 && suggestedStrength < 2 && !type.endsWith('_strength'))
        throw new Error('invalid_output');
    }
    workout = { type, durationMinutes };
  }
  if (
    !/\b\d(?:\.\d)? litres? of water\b/i.test(output.meals) ||
    /\b(calories|grams|macros|carb servings?)\b/i.test(output.meals) ||
    /\b(you trained today|you completed[^.!?]{0,50}today|you logged a workout today)\b/i.test(
      output.why
    )
  ) {
    throw new Error('invalid_output');
  }
  return { output, workout, stepTarget };
}

export function buildDailyProviderInput(
  snapshot: DailySnapshot,
  day: string,
  recentPlans: { day: string; output: DailyOutput }[]
) {
  const steps = observedSteps(snapshot);
  const average = verifiedStepAverage(snapshot);
  const policy = dailyPolicy(snapshot, day);
  const sorenessWorkoutType =
    snapshot.daily.body === 'sore_lower'
      ? 'upper body strength'
      : snapshot.daily.body === 'sore_upper'
        ? 'lower body strength'
        : null;
  const requiredWorkout = policy.rest
    ? REST_WORKOUT
    : policy.duration === 'light' && sorenessWorkoutType
      ? `Log a 10-minute ${sorenessWorkoutType} workout today.`
      : null;
  const weightHistory = snapshot.weightHistory
    .filter((item) => item.observedAt !== undefined)
    .map((item) => ({
      date: new Date(item.observedAt!).toISOString().slice(0, 10),
      value: item.value,
      unit: item.unit,
      kg: kilograms(item.value, item.unit),
      source: item.source,
    }));
  return {
    profile: { ...snapshot.profile, weight_history: weightHistory },
    today: {
      day,
      sleep: snapshot.daily.sleep,
      energy: snapshot.daily.energy,
      mood: snapshot.daily.mood,
      up_for: snapshot.daily.upFor,
      body: snapshot.daily.body,
    },
    activity: {
      steps,
      step_average: average ?? null,
      usable_step_days: steps.length,
      workouts_logged: snapshot.health.workouts.filter((item) => item.source === 'activity_log'),
      completed_workout_days_in_a_row: consecutiveCompletedWorkoutDays(snapshot, day),
      weekly_streak: snapshot.health.streak ?? null,
    },
    recent_plans: recentPlans.map((plan) => ({ day: plan.day, ...plan.output })),
    // Derived from the unchanged client prompt. These exact constraints help the
    // provider satisfy rules that the validator will enforce on its six fields.
    output_constraints: {
      headline: policy.headline,
      sleep: policy.sleep,
      workout: requiredWorkout,
      workout_type: sorenessWorkoutType,
      duration_minutes: policy.duration === 'light' ? 10 : policy.duration === 'short' ? 20 : null,
      recovery_max_duration_minutes: policy.duration === 'recovery' ? 20 : null,
      steps:
        average === undefined
          ? `${policy.missingHistoryTarget.toLocaleString('en-US')} steps`
          : null,
      max_steps: average === undefined ? null : average + 2000,
      mention_step_average: average !== undefined,
      include_water_target: true,
      include_meal_log_prompt: false,
    },
  };
}
