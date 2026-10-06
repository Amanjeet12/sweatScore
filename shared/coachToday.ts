import type { CoachCategory } from './coachFoundation';

export const TODAY_PROGRESS_ROUTES = {
  seeAll: '/(tabs)/rewards',
  log: '/progress-photo',
  share: '/(tabs)/rewards?openShare=1',
} as const;

export type PlanBannerState = 'locked' | 'no_plan' | 'pending' | 'ready' | 'failed' | 'unavailable';
export function planBannerState(input: {
  access: boolean;
  requestStatus: 'none' | 'pending' | 'ready' | 'failed';
  hasPlan: boolean;
  canRetry?: boolean;
}): PlanBannerState {
  if (!input.access) return 'locked';
  if (input.hasPlan) return 'ready';
  if (input.requestStatus === 'failed') return input.canRetry ? 'failed' : 'unavailable';
  if (input.requestStatus === 'pending' || input.requestStatus === 'ready') return 'pending';
  return 'no_plan';
}
export function planBannerLabel(state: PlanBannerState) {
  return {
    locked: 'Premium access unavailable',
    no_plan: 'Get today’s plan',
    pending: 'Preparing today’s plan',
    ready: 'View today’s plan',
    failed: 'Retry today’s plan',
    unavailable: 'Today’s plan unavailable',
  }[state];
}
export type TileInput = {
  category: CoachCategory;
  recommendation: string;
  label: string;
  mandatory: boolean;
  consumedCount: number;
  stepTarget?: number;
};
export const TODAY_CATEGORIES: CoachCategory[] = ['workout', 'meals', 'sleep', 'steps'];
export function todayTiles(assignments: TileInput[] | undefined) {
  return TODAY_CATEGORIES.map((category) => {
    const assignment = assignments?.find((item) => item.category === category);
    const total = category === 'meals' ? 3 : 1;
    return {
      category,
      assignment,
      earned: Math.min(assignment?.consumedCount ?? 0, total),
      total,
      checked: Boolean(assignment && assignment.consumedCount > 0),
      completed: Boolean(assignment && assignment.consumedCount >= total),
      available: Boolean(assignment && assignment.mandatory && assignment.consumedCount < total),
    };
  });
}
export function displayStepTarget(assignment: TileInput | undefined): string | null {
  return assignment?.stepTarget === undefined
    ? null
    : new Intl.NumberFormat('en-US').format(assignment.stepTarget);
}

// Match the Progress screen's photo sequence, including a week with no new
// photo. A locked current week keeps its last logged number.
export function progressCardWeek(photoCount: number, canLogCurrentWeek: boolean): number {
  return Math.max(1, photoCount + (canLogCurrentWeek ? 1 : 0));
}

export function activityProgressFraction(value: number, target?: number): number {
  if (!Number.isFinite(value) || !target || !Number.isFinite(target) || target <= 0) return 0;
  return Math.min(1, Math.max(0, value / target));
}

// Cached responses and servers running the previous banner API have photo URLs only.
export function bannerAvatarMembers(
  banner:
    | {
        memberCount: number;
        avatarUrls?: string[];
        avatarMembers?: { userId: string; name: string; imageUrl: string | null }[];
      }
    | null
    | undefined
) {
  if (!banner) return [];
  if (Array.isArray(banner.avatarMembers)) return banner.avatarMembers.slice(0, 4);
  return Array.from({ length: Math.min(4, Math.max(0, banner.memberCount)) }, (_, index) => ({
    userId: `legacy-avatar-${index}`,
    name: '',
    imageUrl: banner.avatarUrls?.[index] ?? null,
  }));
}
