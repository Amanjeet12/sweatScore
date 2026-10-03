// Limits apply independently to each field. The explanation keeps its existing allowance.
export const DAILY_PLAN_COPY_LIMITS = {
  headline: 80,
  workout: 180,
  steps: 30,
  sleep: 180,
  meals: 100,
  why: 1200,
  workoutReason: 300,
  stepsReason: 300,
} as const;

// Also clean saved plans generated before meal logging reminders were removed.
export function mealPlanSummary(value: string) {
  return value
    .replace(
      /(?:[,;]\s*(?:and\s+)?|\s+and\s+|[.!?]\s*|^)(?:snap|log|photograph|take a photo of)\b[^.!?]*\bmeals?\b[^.!?]*[.!?]?/gi,
      '.'
    )
    .trim();
}
