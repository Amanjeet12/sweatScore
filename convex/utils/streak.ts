import { Id } from '../_generated/dataModel';
import { QueryCtx, MutationCtx } from '../_generated/server';

export const STREAK_POINTS_THRESHOLD = 10;

/**
 * Returns the set of YYYY-MM-DD date strings within [startStr, endStr) where
 * the user "earned" a streak — i.e. completed at least one (non-removed)
 * challenge that day OR accumulated >= STREAK_POINTS_THRESHOLD daily display
 * points (challenge points + synced/approved activity displayTotalPoints +
 * check-in points).
 *
 * Inclusive of startStr, exclusive of endStr (matches range query semantics
 * already used elsewhere in this codebase).
 */
export async function getStreakEarnedDatesInRange(
  ctx: QueryCtx | MutationCtx,
  userId: Id<'users'>,
  startStr: string,
  endStr: string
): Promise<Set<string>> {
  const completions = await ctx.db
    .query('challengeCompletions')
    .withIndex('by_user_date', (q) =>
      q.eq('userId', userId).gte('date', startStr).lt('date', endStr)
    )
    .filter((q) => q.neq(q.field('removed'), true))
    .collect();

  const activities = await ctx.db
    .query('dailyActivities')
    .withIndex('by_user_date', (q) =>
      q.eq('userId', userId).gte('date', startStr).lt('date', endStr)
    )
    .filter((q) =>
      q.or(q.eq(q.field('synced'), true), q.eq(q.field('reviewStatus'), 'approved'))
    )
    .collect();

  const checkIns = await ctx.db
    .query('userCheckIns')
    .withIndex('by_user_date', (q) =>
      q.eq('userId', userId).gte('date', startStr).lt('date', endStr)
    )
    .collect();

  const challengeDates = new Set<string>();
  const pointsByDate = new Map<string, number>();

  const add = (date: string, pts: number) => {
    pointsByDate.set(date, (pointsByDate.get(date) ?? 0) + pts);
  };

  for (const c of completions) {
    challengeDates.add(c.date);
    add(c.date, c.pointsEarned);
  }
  for (const a of activities) {
    add(a.date, a.displayTotalPoints ?? 0);
  }
  for (const ci of checkIns) {
    add(ci.date, ci.points);
  }

  const earned = new Set<string>(challengeDates);
  for (const [date, pts] of pointsByDate) {
    if (pts >= STREAK_POINTS_THRESHOLD) earned.add(date);
  }
  return earned;
}
