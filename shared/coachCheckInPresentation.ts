import type { CoachCategory } from './coachFoundation';

export function checkInPostRoute(category: CoachCategory) {
  return `/coach-check-in/post/${category}` as const;
}

export function canStartCoachLivePhoto(
  category: CoachCategory,
  mode: 'details' | 'post',
  status: string,
  assignment: { mandatory: boolean; consumedCount: number } | null | undefined,
  hasCapturedPhoto: boolean
) {
  return Boolean(
    mode === 'details' &&
    status === 'ready' &&
    assignment?.mandatory &&
    assignment.consumedCount < (category === 'meals' ? 3 : 1) &&
    !hasCapturedPhoto
  );
}

type GuideSource = {
  label?: string;
  recommendation: string;
  stepTarget?: number;
  detailsV2?: {
    workoutExamples: string[];
    workoutReason: string;
    stepsReason: string;
  };
};

/** A started proof always presents its pinned snapshot, even after a plan refresh. */
export function checkInGuide(
  category: CoachCategory,
  assignment: GuideSource,
  pinned?: GuideSource | null
) {
  const source = pinned ?? assignment;
  const details = source.detailsV2;
  const structured = Boolean(details && (category === 'workout' || category === 'steps'));
  return {
    title: source.label ?? (category === 'meals' ? 'Log a meal' : 'Today’s guidance'),
    recommendation: structured ? null : source.recommendation,
    examples: category === 'workout' ? (details?.workoutExamples ?? []) : [],
    reason:
      category === 'workout'
        ? details?.workoutReason
        : category === 'steps'
          ? details?.stepsReason
          : undefined,
    stepTarget: category === 'steps' ? source.stepTarget : undefined,
  };
}
