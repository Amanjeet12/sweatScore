import type { Id } from './_generated/dataModel';
import type { QueryCtx, MutationCtx } from './_generated/server';
import { addDaysToDateKey } from './utils/timezone';

// A morning sleep check-in refers to last night's target, not tonight's new plan.
export async function previousNightSleepTarget(
  ctx: QueryCtx | MutationCtx,
  userId: Id<'users'>,
  day: string
) {
  const plan = await ctx.db
    .query('coachPlanRevisionsV1')
    .withIndex('by_user_day_version', (q) =>
      q.eq('userId', userId).eq('day', addDaysToDateKey(day, -1))
    )
    .order('desc')
    .first();
  return plan && Number.isFinite(plan.sleepTargetHours) && plan.sleepTargetHours > 0
    ? plan.sleepTargetHours
    : 7;
}
