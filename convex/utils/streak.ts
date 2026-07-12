import { Id } from '../_generated/dataModel';
import {
  MutationCtx,
  QueryCtx,
} from '../_generated/server';

const DAILY_STEP_TARGET = 5000;
const DAILY_ACTIVE_MINUTES_TARGET = 50;

/**
 * Returns dates where the user completed at least one
 * physical daily streak target:
 *
 * 1. Reached 5,000 steps.
 * 2. Reached 50 active minutes.
 * 3. Completed a physical Daily Check-in video.
 *
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
      q
        .eq('userId', userId)
        .gte('date', startStr)
        .lt('date', endStr)
    )
    .filter((q) =>
      q.or(
        q.eq(q.field('synced'), true),
        q.eq(
          q.field('reviewStatus'),
          'approved'
        )
      )
    )
    .collect();

  const completions = await ctx.db
    .query('challengeCompletions')
    .withIndex('by_user_date', (q) =>
      q
        .eq('userId', userId)
        .gte('date', startStr)
        .lt('date', endStr)
    )
    .filter((q) =>
      q.neq(
        q.field('removed'),
        true
      )
    )
    .collect();

  const earnedDates =
    new Set<string>();

  /*
   * A user may have multiple activity rows
   * for the same date, so combine them first.
   */
  const activityTotalsByDate =
    new Map<
      string,
      {
        steps: number;
        activeMinutes: number;
      }
    >();

  for (const activity of activities) {
    const current =
      activityTotalsByDate.get(
        activity.date
      ) ?? {
        steps: 0,
        activeMinutes: 0,
      };

    current.steps +=
      activity.steps ?? 0;

    current.activeMinutes +=
      activity.zone2Minutes ?? 0;

    activityTotalsByDate.set(
      activity.date,
      current
    );
  }

  /*
   * Mark a date when the steps target or
   * active-minutes target is reached.
   */
  for (const [
    date,
    totals,
  ] of activityTotalsByDate) {
    const stepTargetReached =
      totals.steps >=
      DAILY_STEP_TARGET;

    const activeMinutesTargetReached =
      totals.activeMinutes >=
      DAILY_ACTIVE_MINUTES_TARGET;

    if (
      stepTargetReached ||
      activeMinutesTargetReached
    ) {
      earnedDates.add(date);
    }
  }

  /*
   * Load each completed challenge so that
   * normal challenges can be separated from
   * physical Daily Check-in videos.
   */
  const completedChallenges =
    await Promise.all(
      completions.map(
        (completion) =>
          ctx.db.get(
            completion.challengeId
          )
      )
    );

  completions.forEach(
    (completion, index) => {
      const challenge =
        completedChallenges[index];

      const isPhysicalDailyCheckIn =
        challenge?.isDailyChallenge ===
          true &&
        challenge.dailyChallengeType ===
          'check_in';

      if (isPhysicalDailyCheckIn) {
        earnedDates.add(
          completion.date
        );
      }
    }
  );

  return earnedDates;
}