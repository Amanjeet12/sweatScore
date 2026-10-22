import type { DailySnapshot } from './coachDailyPolicy';
import { addDaysToDateKey } from './utils/timezone';

// A log proves a workout was logged, never that the recommended workout was done.
// Only explicit member descriptions can establish its type; generic captions stay unknown.
export function describedWorkoutType(note?: string) {
  if (!note || /\b(?:not|no|didn't|did not|skip|skipped|tomorrow|plan|planned)\b/i.test(note))
    return undefined;
  if (/\bfull[- ]body\b/i.test(note)) return 'full_body_strength';
  if (/\blower[- ]body\b|\bleg (?:day|workout|session)\b/i.test(note)) return 'lower_body_strength';
  if (/\bupper[- ]body\b/i.test(note)) return 'upper_body_strength';
  if (/\bcore (?:workout|session|training)\b/i.test(note)) return 'core';
  if (/\bcardio\b/i.test(note)) return 'cardio';
  if (/\bwalking\b/i.test(note)) return 'walking';
  if (/\bmobility\b/i.test(note)) return 'mobility';
  if (/\bstretching\b/i.test(note)) return 'stretching';
  return undefined;
}

export function workoutEvidence(snapshot: DailySnapshot, day: string) {
  const yesterday = addDaysToDateKey(day, -1);
  const reported = snapshot.daily.trainedYesterday ?? [];
  return snapshot.health.workouts
    .filter(
      (row) =>
        row.source === 'activity_log' && !(row.day === yesterday && reported.includes('nothing'))
    )
    .map(({ day, label, source, memberNote }) => ({
      day,
      label,
      source,
      memberNote,
      reportedType: describedWorkoutType(memberNote),
    }));
}

export function yesterdayTrainingEvidence(snapshot: DailySnapshot, day: string): string[] {
  if (snapshot.daily.trainedYesterday?.length) return snapshot.daily.trainedYesterday;
  const yesterday = addDaysToDateKey(day, -1);
  return workoutEvidence(snapshot, day)
    .filter((row) => row.day === yesterday)
    .flatMap((row) => {
      switch (row.reportedType) {
        case 'full_body_strength':
          return ['upper_body', 'lower_body'];
        case 'upper_body_strength':
          return ['upper_body'];
        case 'lower_body_strength':
          return ['lower_body'];
        case 'core':
          return ['core'];
        case 'cardio':
          return ['cardio'];
        default:
          return ['other'];
      }
    });
}
