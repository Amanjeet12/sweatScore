export type MealVerdict = 'On point' | 'Nearly there' | 'Room to improve' | null;
export type MealResult = { verdict: MealVerdict; feedback: string };
export const NON_MEAL_FEEDBACK =
  "I couldn't see a meal in this photo. Snap your plate and I'll take a look.";

export function validateMealResult(value: unknown): MealResult | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  if (Object.keys(data).sort().join('|') !== 'feedback|verdict') return null;
  if (
    !['On point', 'Nearly there', 'Room to improve', null].includes(data.verdict as string | null)
  )
    return null;
  if (typeof data.feedback !== 'string' || !data.feedback.trim() || data.feedback.length > 600)
    return null;
  const feedback = data.feedback.trim();
  if ((feedback.match(/[.!?](?:\s|$)/g) ?? []).length > 3) return null;
  if (
    /\b(calories?|grams?|macros?|servings?|bad|junk|cheat|guilty|breakfast|lunch|dinner)\b/i.test(
      feedback
    ) ||
    feedback.includes('—')
  )
    return null;
  if (data.verdict === null && feedback !== NON_MEAL_FEEDBACK) return null;
  return { verdict: data.verdict as MealVerdict, feedback };
}
