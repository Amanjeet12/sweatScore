// Limits apply independently to each field. The explanation keeps its existing allowance.
export const DAILY_PLAN_COPY_LIMITS = {
  headline: 80,
  workout: 180,
  steps: 30,
  sleep: 180,
  meals: 140,
  why: 1200,
  workoutReason: 300,
  stepsReason: 300,
} as const;

export function dailyMealGuidance(waterLitres: number) {
  return `Log today's meals for feedback. Aim for ${waterLitres} litres of water.`;
}

// Keep the same wording for older saved plans while retaining their water target.
export function mealPlanSummary(value: string) {
  const water = value.match(/\b(\d+(?:\.\d+)?) litres? of water\b/i);
  return dailyMealGuidance(water ? Number(water[1]) : 2);
}

// Apply to saved plans too, so older AI punctuation does not leak into the UI.
export function cleanDailyPlanCopy(value: string) {
  return value
    .replace(/["“”«»]/g, '')
    .replace(/\s*[—–]\s*/g, ', ')
    .replace(/,\s*([.!?])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}
