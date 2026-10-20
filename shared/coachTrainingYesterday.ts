export type TrainingYesterday =
  | 'lower_body'
  | 'upper_body'
  | 'cardio'
  | 'core'
  | 'other'
  | 'nothing';

export const OTHER_TRAINING_MEANING =
  'Other means training occurred yesterday but its type, intensity and duration are unspecified. It does not mean cardio or no training. Do not invent training details; use readiness, soreness and verified history for today’s plan. Legacy cardio answers still mean cardio.';

export function toggleTrainingYesterday(
  current: readonly TrainingYesterday[],
  value: TrainingYesterday
): TrainingYesterday[] {
  if (current.includes(value)) return current.filter((item) => item !== value);
  if (value === 'nothing') return ['nothing'];
  return [
    ...current.filter((item) => item !== 'nothing' && !(value === 'other' && item === 'cardio')),
    value,
  ];
}
