import { DEFAULT_COACH_TONE } from './coachFoundation';

export type ToneSelection = {
  tone: 'warm_direct' | 'calm_reassuring' | 'upbeat_encouraging';
  detail: 'concise' | 'standard';
  scope: 'daily_plan' | 'meal_feedback' | 'both';
};

export type PreviewMealSample = 'burrito_bowl' | 'chicken_flatbread';

export function previewMealSampleConfig(
  sample: PreviewMealSample,
  env: {
    COACH_PREVIEW_MEAL_BOWL_STORAGE_ID?: string;
    COACH_PREVIEW_MEAL_FLATBREAD_STORAGE_ID?: string;
    COACH_PREVIEW_MEAL_STORAGE_ID?: string;
  }
) {
  return sample === 'burrito_bowl'
    ? {
        key: sample,
        label: 'Burrito bowl',
        storageId: (
          env.COACH_PREVIEW_MEAL_BOWL_STORAGE_ID ?? env.COACH_PREVIEW_MEAL_STORAGE_ID
        )?.trim(),
      }
    : {
        key: sample,
        label: 'Chicken flatbread',
        storageId: env.COACH_PREVIEW_MEAL_FLATBREAD_STORAGE_ID?.trim(),
      };
}

export const FICTIONAL_PREVIEW_DAY = '2026-01-15';
export const FICTIONAL_DAILY_SNAPSHOT = {
  profile: {
    goal: 'fitness',
    bodyFeeling: 'feel_good',
    routineFeeling: 'starting_stopping',
    foodRelationship: 'balanced_most_days',
    usualSleep: 'okay_could_be_better',
    biggestChallenge: 'time',
  },
  weight: { value: 70, unit: 'kg' },
  weightHistory: [],
  daily: {
    sleep: 'rested_enough',
    energy: 'steady',
    mood: 'okay',
    upFor: 'rest_day',
    body: 'fine',
  },
  health: { steps: [], workouts: [], streak: undefined },
  recentPlanRevisionIds: [],
} as const;

export function effectiveTone(
  selection: ToneSelection,
  kind: 'daily_plan' | 'meal_feedback',
  prior: { tone: ToneSelection['tone']; detail: ToneSelection['detail'] } = DEFAULT_COACH_TONE
) {
  return selection.scope === 'both' || selection.scope === kind
    ? { tone: selection.tone, detail: selection.detail }
    : { tone: prior.tone, detail: prior.detail };
}

export function previewQuotaAllows(existing: number, requested: number) {
  return (
    Number.isInteger(existing) &&
    Number.isInteger(requested) &&
    requested > 0 &&
    existing + requested <= 12
  );
}
