// Stage 1 contracts. Existing coach records keep their original shape and meaning.
export const COACH_CONTRACT_VERSION = 1;
export const COACH_CATEGORIES = ['workout', 'meals', 'sleep', 'steps'] as const;
export type CoachCategory = (typeof COACH_CATEGORIES)[number];
export const COACH_TONES = ['warm_direct', 'calm_reassuring', 'upbeat_encouraging'] as const;
export const COACH_DETAILS = ['concise', 'standard'] as const;
export const COACH_TONE_SCOPES = ['daily_plan', 'meal_feedback', 'both'] as const;
export const DEFAULT_COACH_TONE = {
  tone: 'warm_direct',
  detail: 'standard',
  scope: 'both',
} as const;

export const rewardSlotCount = (category: CoachCategory) => (category === 'meals' ? 3 : 1);
export const rewardSlotKey = (day: string, category: CoachCategory, ordinal: number) => {
  assertDay(day);
  if (!Number.isInteger(ordinal) || ordinal < 1 || ordinal > rewardSlotCount(category)) {
    throw new Error('Invalid category slot');
  }
  return `${day}:${category}:${ordinal}`;
};

export function assertDay(day: string): void {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(day) ||
    Number.isNaN(Date.parse(`${day}T00:00:00Z`)) ||
    new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10) !== day
  ) {
    throw new Error('Invalid app day');
  }
}

export function assertRequestKey(key: string): void {
  if (!/^[A-Za-z0-9_-]{8,100}$/.test(key)) throw new Error('Invalid request key');
}

export function assignmentLabel(
  workout: string,
  type: string,
  minutes: number | undefined
): string {
  if (type === 'rest') return 'Rest and recover';
  if (minutes === undefined || !Number.isInteger(minutes) || minutes < 1)
    throw new Error('Invalid workout duration');
  const kind =
    type === 'lower_body_strength'
      ? 'leg workout'
      : type === 'upper_body_strength'
        ? 'upper body workout'
        : `${type.replaceAll('_', ' ')} workout`;
  if (!workout.trim()) throw new Error('Missing workout recommendation');
  return `${minutes}-minute ${kind}`;
}

export type LegacyContext = {
  kind: 'legacy_unknown';
  sourceTable: 'coachDailyPlans' | 'challengeCompletions' | 'dailyActivities';
  sourceId: string;
};
export type PlanContext = { kind: 'plan_revision'; revisionId: string; recommendation: string };
export type AssignmentContext = LegacyContext | PlanContext;
