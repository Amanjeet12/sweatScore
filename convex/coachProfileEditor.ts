import { getAuthUserId } from '@convex-dev/auth/server';
import { ConvexError } from 'convex/values';
import { query } from './_generated/server';

export const myProfile = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError('Authentication required');
    const profile = await ctx.db
      .query('coachProfileRevisionsV1')
      .withIndex('by_user_version', (q) => q.eq('userId', userId))
      .order('desc')
      .first();
    if (!profile) return null;
    const weight = await ctx.db.get(profile.weightObservationId);
    if (!weight || weight.userId !== userId) throw new ConvexError('Saved weight unavailable');
    return { version: profile.version, answers: profile.answers, weight: weight.weight };
  },
});
