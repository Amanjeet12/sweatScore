import type { CoachCategory } from './coachFoundation';

export function planCardRoute(category: CoachCategory) {
  return `/coach-check-in/${category}` as const;
}

export function planCardState(category: CoachCategory, rest: boolean, consumedCount: number) {
  if (category === 'workout' && rest)
    return { canLog: false, canOpen: false, status: 'Rest guidance' };
  if (category === 'meals')
    return {
      canLog: consumedCount < 3,
      canOpen: true,
      status: `${Math.min(consumedCount, 3)} of 3 shared`,
    };
  return {
    canLog: consumedCount < 1,
    canOpen: true,
    status: consumedCount ? 'Logged today' : 'Not logged yet',
  };
}
