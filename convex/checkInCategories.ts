import { getAuthUserId } from '@convex-dev/auth/server';
import { ConvexError, v } from 'convex/values';

import { mutation, query } from './_generated/server';

async function requireAdmin(ctx: any) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new ConvexError('Unauthorized');
  const user = await ctx.db.get(userId);
  if (!user?.isAdmin) throw new ConvexError('Unauthorized');
  return userId;
}

export const listActive = query({
  args: {},
  handler: async (ctx) => {
    const categories = await ctx.db
      .query('checkInCategories')
      .withIndex('by_active_sort_order', (q) => q.eq('isActive', true))
      .collect();
    return categories.sort((a, b) => a.sortOrder - b.sortOrder);
  },
});

export const listForAdmin = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const categories = (await ctx.db.query('checkInCategories').collect()).sort(
      (a, b) => a.sortOrder - b.sortOrder
    );
    return await Promise.all(
      categories.map(async (category) => ({
        ...category,
        iconUrl: category.iconStorageId ? await ctx.storage.getUrl(category.iconStorageId) : null,
      }))
    );
  },
});

export const getForAdmin = query({
  args: { categoryId: v.id('checkInCategories') },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const category = await ctx.db.get(args.categoryId);
    if (!category) return null;
    return {
      ...category,
      iconUrl: category.iconStorageId ? await ctx.storage.getUrl(category.iconStorageId) : null,
    };
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    description: v.string(),
    emoji: v.optional(v.string()),
    iconStorageId: v.optional(v.id('_storage')),
    sortOrder: v.number(),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await requireAdmin(ctx);
    if (!args.name.trim() || !args.description.trim())
      throw new ConvexError('Name and description are required');
    const now = Date.now();
    return await ctx.db.insert('checkInCategories', {
      ...args,
      name: args.name.trim(),
      description: args.description.trim(),
      emoji: args.emoji?.trim() || undefined,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    categoryId: v.id('checkInCategories'),
    name: v.string(),
    description: v.string(),
    emoji: v.optional(v.string()),
    iconStorageId: v.optional(v.id('_storage')),
    sortOrder: v.number(),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const existing = await ctx.db.get(args.categoryId);
    if (!existing) throw new ConvexError('Category not found');
    if (!args.name.trim() || !args.description.trim())
      throw new ConvexError('Name and description are required');
    const { categoryId, ...updates } = args;
    await ctx.db.patch(categoryId, {
      ...updates,
      name: args.name.trim(),
      description: args.description.trim(),
      emoji: args.emoji?.trim() || undefined,
      updatedAt: Date.now(),
    });
    if (args.iconStorageId && args.iconStorageId !== existing.iconStorageId) {
      if (existing.iconStorageId) await ctx.storage.delete(existing.iconStorageId);
    }
  },
});

export const remove = mutation({
  args: { categoryId: v.id('checkInCategories') },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const category = await ctx.db.get(args.categoryId);
    if (!category) throw new ConvexError('Category not found');
    const challenges = await ctx.db.query('challenges').collect();
    if (
      challenges.some(
        (challenge) =>
          challenge.checkInCategoryId === args.categoryId ||
          challenge.checkInCategoryIds?.includes(args.categoryId)
      )
    ) {
      throw new ConvexError(
        'Category is currently used by a challenge. Remove it from those challenges before deleting it.'
      );
    }
    if (category.iconStorageId) await ctx.storage.delete(category.iconStorageId);
    await ctx.db.delete(args.categoryId);
  },
});
