export type TrainingYesterday = 'lower_body' | 'upper_body' | 'cardio' | 'nothing';

export function toggleTrainingYesterday(
  current: readonly TrainingYesterday[],
  value: TrainingYesterday
): TrainingYesterday[] {
  if (current.includes(value)) return current.filter((item) => item !== value);
  if (value === 'nothing') return ['nothing'];
  return [...current.filter((item) => item !== 'nothing'), value];
}
