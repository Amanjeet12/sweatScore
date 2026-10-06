export type BodyFeeling = 'fine' | 'sore_upper' | 'sore_lower' | 'pain_unwell';
export type BodyAnswer = BodyFeeling | readonly BodyFeeling[];

/** Read legacy single answers and new selections without changing stored history. */
export function bodySelections(answer?: BodyAnswer | null): BodyFeeling[] {
  return answer == null ? [] : typeof answer === 'string' ? [answer] : [...new Set(answer)];
}

export function hasBodyFeeling(answer: BodyAnswer, value: BodyFeeling): boolean {
  return bodySelections(answer).includes(value);
}

export function toggleBodyFeeling(
  answer: BodyAnswer | undefined,
  value: BodyFeeling
): BodyFeeling[] {
  const current = bodySelections(answer);
  if (current.includes(value)) return current.filter((item) => item !== value);
  if (value === 'fine') return ['fine'];
  return [...current.filter((item) => item !== 'fine'), value];
}

export function isUnanswered(value: unknown): boolean {
  return value === undefined || (Array.isArray(value) && value.length === 0);
}
