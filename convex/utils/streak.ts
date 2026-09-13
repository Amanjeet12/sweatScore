import { Id } from '../_generated/dataModel';
import { MutationCtx, QueryCtx } from '../_generated/server';

export const WEEKLY_STREAK_TARGET_DAYS = 5;

/**
 * Returns dates where the user completed at least one
 * active daily streak action:
 *
 * 1. Completed a Quick Log.
 * 2. Completed a physical Daily Check-in video.
 *
 * Passively synced steps and active minutes do not protect the streak.
 * Normal challenge completions do not count.
 * Opening the app does not count.
 *
 * startStr is inclusive.
 * endStr is exclusive.
 */
export async function getStreakEarnedDatesInRange(
  ctx: QueryCtx | MutationCtx,
  userId: Id<'users'>,
  startStr: string,
  endStr: string
): Promise<Set<string>> {
  const activities = await ctx.db
    .query('dailyActivities')
    .withIndex('by_user_date', (q) =>
      q.eq('userId', userId).gte('date', startStr).lt('date', endStr)
    )
    .filter((q) => q.or(q.eq(q.field('synced'), true), q.eq(q.field('reviewStatus'), 'approved')))
    .collect();

  const completions = await ctx.db
    .query('challengeCompletions')
    .withIndex('by_user_date', (q) =>
      q.eq('userId', userId).gte('date', startStr).lt('date', endStr)
    )
    .filter((q) => q.neq(q.field('removed'), true))
    .collect();

  const earnedDates = new Set<string>();

  for (const activity of activities) {
    if (activity.loggedActivityKey) earnedDates.add(activity.date);
  }

  /*
   * Load each completed challenge so that
   * normal challenges can be separated from
   * physical Daily Check-in videos.
   */
  const completedChallenges = await Promise.all(
    completions.map((completion) => ctx.db.get(completion.challengeId))
  );

  completions.forEach((completion, index) => {
    const challenge = completedChallenges[index];

    const isPhysicalCheckIn = challenge?.type === 'check_in';

    if (isPhysicalCheckIn) {
      earnedDates.add(completion.date);
    }
  });

  return earnedDates;
}
