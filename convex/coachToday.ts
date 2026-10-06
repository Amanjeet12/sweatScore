import { getAuthUserId } from '@convex-dev/auth/server';
import { ConvexError, v } from 'convex/values';
import { mutation, MutationCtx, query } from './_generated/server';
import {
  formatDateInTZ,
  getDateStartTimestampInTimezone,
  addDaysToDateKey,
} from './utils/timezone';
import { Id } from './_generated/dataModel';

async function requireAdmin(ctx: MutationCtx) {
  const userId = await getAuthUserId(ctx);
  const user = userId ? await ctx.db.get(userId) : null;
  if (!user?.isAdmin) throw new ConvexError('Admin required');
}

export const bannerImage = query({
  args: {},
  handler: async (ctx) => {
    const setting = await ctx.db.query('coachTodayBannerImage').first();
    return setting ? await ctx.storage.getUrl(setting.image) : null;
  },
});

export const generateBannerUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return ctx.storage.generateUploadUrl();
  },
});

export const setBannerImage = mutation({
  args: { image: v.union(v.id('_storage'), v.null()) },
  handler: async (ctx, { image }) => {
    await requireAdmin(ctx);
    const existing = await ctx.db.query('coachTodayBannerImage').first();
    if (image && !(await ctx.storage.getMetadata(image))) {
      throw new ConvexError('Uploaded image was not found');
    }
    if (existing && image) await ctx.db.patch(existing._id, { image });
    else if (existing) await ctx.db.delete(existing._id);
    else if (image) await ctx.db.insert('coachTodayBannerImage', { image });
  },
});

// Banner statistics use completed records only. Members without photos use initials.
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
    const avatarMembers = await Promise.all(
      [...memberIds].slice(0, 4).map(async (id) => {
        const user = await ctx.db.get(id);
        const imageUrl = user?.image ? await ctx.storage.getUrl(user.image) : null;
        return { userId: id, name: user?.name ?? '', imageUrl };
      })
    );
    const avatarUrls = avatarMembers.flatMap((member) =>
      member.imageUrl ? [member.imageUrl] : []
    );
    return { day, nextMidnightAt, memberCount: memberIds.size, avatarUrls, avatarMembers };
  },
});
