import { getAuthUserId } from '@convex-dev/auth/server';
import { ConvexError, v } from 'convex/values';
import { query } from './_generated/server';
import {
  formatDateInTZ,
  getDateStartTimestampInTimezone,
  addDaysToDateKey,
} from './utils/timezone';
import { Id } from './_generated/dataModel';

// Banner statistics use completed records only. Missing avatars remain missing;
// no seeded headshots or prototype community totals are returned.
export const myBanner = query({
  args: { refresh: v.optional(v.number()) },
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError('Authentication required');
    const member = await ctx.db.get(userId);
    if (!member) throw new ConvexError('Member missing');
    const day = formatDateInTZ(new Date(), member.timezone);
    const nextMidnightAt = getDateStartTimestampInTimezone(
      addDaysToDateKey(day, 1),
      member.timezone
    );
    const [legacy, completions, planSlots] = await Promise.all([
      ctx.db
        .query('userCheckIns')
        .withIndex('by_date', (q) => q.eq('date', day))
        .collect(),
      ctx.db
        .query('challengeCompletions')
        .withIndex('by_date', (q) => q.eq('date', day))
        .collect(),
      ctx.db
        .query('coachRewardSlotsV1')
        .withIndex('by_day', (q) => q.eq('day', day))
        .collect(),
    ]);
    const memberIds = new Set<Id<'users'>>();
    for (const item of legacy) memberIds.add(item.userId);
    for (const item of planSlots) if (item.state === 'earned') memberIds.add(item.userId);
    for (const completion of completions) {
      if (completion.removed) continue;
      const challenge = await ctx.db.get(completion.challengeId);
      if (challenge?.type === 'check_in' || challenge?.dailyChallengeType === 'check_in')
        memberIds.add(completion.userId);
    }
    const avatarUrls: string[] = [];
    for (const id of [...memberIds].slice(0, 12)) {
      const user = await ctx.db.get(id);
      if (!user?.image) continue;
      const url = await ctx.storage.getUrl(user.image);
      if (url) avatarUrls.push(url);
      if (avatarUrls.length === 4) break;
    }
    return { day, nextMidnightAt, memberCount: memberIds.size, avatarUrls };
  },
});
