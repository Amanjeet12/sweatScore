export type MealVerdict = 'On point' | 'Nearly there' | 'Room to improve' | null;
export type MealResult = { verdict: MealVerdict; feedback: string };
export const NON_MEAL_FEEDBACK =
  "I can't see a meal clearly in this photo. Please retake the photo so I can give you feedback.";

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
  const sentences = (feedback.match(/[.!?](?:\s|$)/g) ?? []).length;
  if (sentences < 2 || sentences > 3 || feedback.split(/\s+/).length > 45) return null;
  if (/\p{Extended_Pictographic}|\p{Regional_Indicator}|\u20E3/u.test(feedback)) return null;
  if (/(?:^|\n)\s*(?:[-*•]|\d+[.)])\s/.test(feedback)) return null;
  if (
    /\b(calories?|grams?|macros?|servings?|bad|junk|cheat(?:ing)?|clean|guilty|naughty|treats?|weight|skinny|obese|overweight|breakfast|lunch|dinner)\b/i.test(
      feedback
    ) ||
    /\b(?:good food|body size|lose fat|fat loss)\b/i.test(feedback) ||
    feedback.includes('—')
  )
    return null;
  if (data.verdict === null && feedback !== NON_MEAL_FEEDBACK) return null;
  if (
    data.verdict !== null &&
    /\b(?:unclear|blurry|blurred|cannot see|can't see|unable to (?:see|assess|identify)|not (?:clear|visible)|hard to (?:see|identify)|too dark)\b/i.test(
      feedback
    )
  )
    return null;
  return { verdict: data.verdict as MealVerdict, feedback };
}
