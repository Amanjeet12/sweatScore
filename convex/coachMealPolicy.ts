export type MealVerdict = 'On point' | 'Nearly there' | 'Room to improve' | null;
export type MealResult = { verdict: MealVerdict; feedback: string; nextMeal?: string };
export const NON_MEAL_FEEDBACK =
  "I can't see a meal clearly in this photo. Please retake the photo so I can give you feedback.";

export type MealValidationIssue =
  | 'response_object'
  | 'response_fields'
  | 'verdict_label'
  | 'feedback_length'
  | 'feedback_sentences_or_words'
  | 'feedback_emoji'
  | 'feedback_list'
  | 'feedback_prohibited_wording'
  | 'unclear_feedback'
  | 'unclear_verdict'
  | 'next_meal_length'
  | 'unclear_next_meal'
  | 'next_meal_guidance';

export type MealValidation =
  | { ok: true; result: MealResult }
  | { ok: false; issue: MealValidationIssue };

// Only fixed codes leave this validator; rejected member-specific text is never logged.
export function checkMealResult(value: unknown): MealValidation {
  const fail = (issue: MealValidationIssue): MealValidation => ({ ok: false, issue });
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail('response_object');
  const data = value as Record<string, unknown>;
  if (
    Object.keys(data)
      .filter((k) => k !== 'nextMeal')
      .sort()
      .join('|') !== 'feedback|verdict'
  )
    return fail('response_fields');
  if (
    !['On point', 'Nearly there', 'Room to improve', null].includes(data.verdict as string | null)
  )
    return fail('verdict_label');
  if (typeof data.feedback !== 'string' || !data.feedback.trim() || data.feedback.length > 600)
    return fail('feedback_length');
  const feedback = data.feedback.trim();
  const sentences = (feedback.match(/[.!?](?:\s|$)/g) ?? []).length;
  if (sentences < 2 || sentences > 3 || feedback.split(/\s+/).length > 45)
    return fail('feedback_sentences_or_words');
  if (/\p{Extended_Pictographic}|\p{Regional_Indicator}|\u20E3/u.test(feedback))
    return fail('feedback_emoji');
  if (/(?:^|\n)\s*(?:[-*•]|\d+[.)])\s/.test(feedback)) return fail('feedback_list');
  if (
    /\b(calories?|grams?|macros?|servings?|bad|junk|cheat(?:ing)?|clean|guilty|naughty|treats?|weight|skinny|obese|overweight|breakfast|lunch|dinner)\b/i.test(
      feedback.replace(/\bweight loss(?: goal)?\b/gi, 'goal')
    ) ||
    /\b(?:good food|body size|lose fat|fat loss)\b/i.test(feedback) ||
    feedback.includes('—')
  )
    return fail('feedback_prohibited_wording');
  if (data.verdict === null && feedback !== NON_MEAL_FEEDBACK) return fail('unclear_feedback');
  if (
    data.verdict !== null &&
    /\b(?:unclear|blurry|blurred|cannot see|can't see|unable to (?:see|assess|identify)|not (?:clear|visible)|hard to (?:see|identify)|too dark)\b/i.test(
      feedback.replace(/\bweight loss(?: goal)?\b/gi, 'goal')
    )
  )
    return fail('unclear_verdict');
  if (data.nextMeal !== undefined) {
    if (
      typeof data.nextMeal !== 'string' ||
      data.nextMeal.length > 500 ||
      data.nextMeal.trim().split(/\s+/).length > 60
    )
      return fail('next_meal_length');
    if (data.verdict === null && data.nextMeal !== '') return fail('unclear_next_meal');
    if (
      data.verdict !== null &&
      (!/^For your next meal\b/i.test(data.nextMeal) ||
        /\b(?:rice|chicken|fish|eggs?|plantain|beans|yam|tofu|jollof|bread|pasta|turkey|salmon|steak|beef|goat|fufu|eba|amala|oats|potatoes|broccoli|spinach|cabbage|kale|calories?|grams?|macros?|junk|cheat|guilty|medical|diabetes)\b/i.test(
          data.nextMeal
        ) ||
        /\p{Extended_Pictographic}|—/u.test(data.nextMeal))
    )
      return fail('next_meal_guidance');
  }
  return {
    ok: true,
    result: {
      verdict: data.verdict as MealVerdict,
      feedback,
      ...(typeof data.nextMeal === 'string' ? { nextMeal: data.nextMeal.trim() } : {}),
    },
  };
}

// Keep the existing result-or-null contract for callers and stored legacy reports.
export function validateMealResult(value: unknown): MealResult | null {
  const checked = checkMealResult(value);
  return checked.ok ? checked.result : null;
}
