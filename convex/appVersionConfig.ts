import { v } from 'convex/values';

import { internalMutation, query } from './_generated/server';

export const getForPlatform = query({
  args: { platform: v.union(v.literal('ios'), v.literal('android')) },
  handler: async (ctx, { platform }) => {
    return await ctx.db
      .query('appVersionConfig')
      .withIndex('by_platform', (q) => q.eq('platform', platform))
      .unique();
  },
});

export const seed = internalMutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query('appVersionConfig').collect();
    if (existing.length > 0) return;

    const now = Date.now();
    await ctx.db.insert('appVersionConfig', {
      platform: 'ios',
      latestVersion: '1.0.9',
      minVersion: '1.0.0',
      storeUrl: 'itms-apps://apps.apple.com/app/id6744372181',
      updatedAt: now,
    });
    await ctx.db.insert('appVersionConfig', {
      platform: 'android',
      latestVersion: '1.0.9',
      minVersion: '1.0.0',
      storeUrl: 'market://details?id=com.sweatscore.sweatscoreapp',
      updatedAt: now,
    });
  },
});
