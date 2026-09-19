import { ConvexError, v } from 'convex/values';

import { getUserTimezone, mondayOf, todayInTZ } from './helpers';
import { internalMutation } from '../_generated/server';

// Internal support operation: preserve an approved streak without inventing
// activity, awarding points, or changing the weekly completion records.
export const set = internalMutation({
  args: {
    userId: v.id('users'),
    adjustment: v.union(
      v.null(),
      v.object({
        weekStart: v.string(),
        weeks: v.number(),
        reason: v.string(),
      })
    ),
  },
  handler: async (ctx, { userId, adjustment }) => {
    const lifetime = await ctx.db
      .query('trackLifetime')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .unique();
    if (!lifetime) throw new ConvexError('User streak history not found');

    if (adjustment) {
      const { weekStart, weeks, reason } = adjustment;
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(weekStart) ||
        !Number.isFinite(Date.parse(weekStart)) ||
        mondayOf(weekStart) !== weekStart ||
        !Number.isSafeInteger(weeks) ||
        weeks < 1 ||
        !reason.trim()
      ) {
        throw new ConvexError('A valid Monday, positive whole weeks, and reason are required');
      }
      const currentMonday = mondayOf(todayInTZ(await getUserTimezone(ctx, userId)));
      const week = await ctx.db
        .query('trackWeekly')
        .withIndex('by_user_weekStart', (q) => q.eq('userId', userId).eq('weekStart', weekStart))
        .unique();
      if (weekStart > currentMonday || !week?.streakWeek) {
        throw new ConvexError('Adjustment must be anchored to an earned week, not a future week');
      }
    }

    const previous = lifetime.streakAdjustment ?? null;
    await ctx.db.patch(lifetime._id, {
      streakAdjustment: adjustment ? { ...adjustment, grantedAt: Date.now() } : undefined,
    });
    return { previous, adjustment };
  },
});
