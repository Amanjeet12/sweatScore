import type { MealResult } from './coachMealPolicy';

function fractions(text: string) {
  return [...text.matchAll(/\b(quarter|third|half)\b|\b(1\/[234])\b/gi)].map(
    (m) =>
      ({ '1/4': 'quarter', '1/3': 'third', '1/2': 'half' })[m[0].toLowerCase()] ??
      m[0].toLowerCase()
  );
}

export function carbMeasures(text: string) {
  // Keep vegetable/protein portions out of the carb consistency check.
  const clauses = text
    .replace(/(carbs?[^,.;]{0,70}),\s*(?=(?:about |up to |around |a |one |[1-9]))/gi, '$1 ')
    .split(/[.!?;,]|\band\b/i)
    .filter((part) => /\bcarb|\bstarch|\bfist/i.test(part));
  return [
    ...new Set(
      clauses.flatMap((part) => [
        ...fractions(part),
        ...(/\bfist\b|fist-sized/i.test(part) ? ['fist'] : []),
      ])
    ),
  ];
}

export function planCarbTarget(guidance?: string) {
  const targets = [...new Set(carbMeasures(guidance ?? '').filter((target) => target !== 'fist'))];
  return targets.length === 1 ? targets[0] : undefined;
}

// Applied only to new provider output. Stored historical feedback remains readable.
export function consistentMealPortions(result: MealResult, planGuidance?: string) {
  if (result.verdict === null) return true;
  const expected = planCarbTarget(planGuidance);
  const feedback = carbMeasures(result.feedback);
  const next = carbMeasures(result.nextMeal ?? '');
  const measures = [...new Set([...feedback, ...next])];
  if (measures.length > 1) return false;
  if (expected && measures.some((measure) => measure !== expected)) return false;
  // New plan-linked advice must carry the target into the next-meal paragraph.
  if (expected && !next.includes(expected)) return false;
  return true;
}
