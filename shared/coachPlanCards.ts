import type { CoachCategory } from './coachFoundation';

export function planCardRoute(category: CoachCategory) {
  return `/coach-check-in/${category}` as const;
}

export function planCardState(category: CoachCategory, _rest: boolean, consumedCount: number) {
  if (category === 'meals')
    return {
      canLog: consumedCount < 3,
      canOpen: true,
      status: consumedCount
        ? `${Math.min(consumedCount, 3)} ${consumedCount === 1 ? 'meal' : 'meals'} logged`
        : 'Log a meal',
    };
  return {
    canLog: consumedCount < 1,
    canOpen: true,
    status: consumedCount ? 'Logged today' : 'Not logged yet',
  };
}
