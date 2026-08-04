import { ConvexError, v } from 'convex/values';

import type { Id } from '../_generated/dataModel';
import type { MutationCtx } from '../_generated/server';
import { mutation, query } from '../_generated/server';
import { requireCurrentUser } from './helpers';

const MAX_GROUP_NAME_LENGTH = 60;
const MAX_GROUP_DESCRIPTION_LENGTH = 500;
const MAX_MEMBERS_PER_MUTATION = 1000;
const MAX_GROUP_IMAGE_BYTES = 5 * 1024 * 1024;
const DEFAULT_GROUP_SLUG = 'sweat-sisters';

function normalizeGroupName(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

function makeSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function requireAppAdmin(user: { isAdmin?: boolean }) {
  if (user.isAdmin !== true) {
    throw new ConvexError('Only an app administrator can manage chat groups');
  }
}

async function validateGroupImage(ctx: MutationCtx, imageStorageId: Id<'_storage'>) {
  const metadata = await ctx.db.system.get('_storage', imageStorageId);

  if (!metadata) {
    throw new ConvexError('The selected group image no longer exists');
  }

  if (!metadata.contentType?.startsWith('image/')) {
    throw new ConvexError('Only image files can be used as a group image');
  }

  if (metadata.size > MAX_GROUP_IMAGE_BYTES) {
    throw new ConvexError('Group image cannot exceed 5 MB');
  }
}

export const listGroupsForAdmin = query({
  args: {},

  handler: async (ctx) => {
    const currentUser = await requireCurrentUser(ctx);
    requireAppAdmin(currentUser);

    const groups = (await ctx.db.query('chatGroups').order('desc').take(100)).filter(
      (group) => group.isActive
    );

    return await Promise.all(
      groups.map(async (group) => {
        const activeMembers = await ctx.db
          .query('chatMembers')
          .withIndex('by_group_status', (q) => q.eq('groupId', group._id).eq('status', 'active'))
          .collect();

        return {
          _id: group._id,
          name: group.name,
          description: group.description ?? '',
          slug: group.slug,
          isActive: group.isActive,
          memberCount: activeMembers.length,
          imageUrl: group.imageStorageId ? await ctx.storage.getUrl(group.imageStorageId) : null,
          canDelete: group.slug !== DEFAULT_GROUP_SLUG,
        };
      })
    );
  },
});

export const listUsersForAdmin = query({
  args: {
    groupId: v.optional(v.id('chatGroups')),
  },

  handler: async (ctx, args) => {
    const currentUser = await requireCurrentUser(ctx);
    requireAppAdmin(currentUser);

    const users = await ctx.db.query('users').order('desc').take(200);

    const activeMemberIds = new Set<string>();

    if (args.groupId) {
      const memberships = await ctx.db
        .query('chatMembers')
        .withIndex('by_group_status', (q) => q.eq('groupId', args.groupId!).eq('status', 'active'))
        .collect();

      for (const membership of memberships) {
        activeMemberIds.add(String(membership.userId));
      }
    }

    return users.map((user) => ({
      _id: user._id,
      name: user.name ?? 'Unnamed user',
      email: user.email ?? null,
      isMember: activeMemberIds.has(String(user._id)),
    }));
  },
});

export const generateGroupImageUploadUrl = mutation({
  args: {},

  handler: async (ctx) => {
    const currentUser = await requireCurrentUser(ctx);
    requireAppAdmin(currentUser);

    return await ctx.storage.generateUploadUrl();
  },
});

export const cleanupUnusedGroupImage = mutation({
  args: {
    storageId: v.id('_storage'),
  },

  handler: async (ctx, args) => {
    const currentUser = await requireCurrentUser(ctx);
    requireAppAdmin(currentUser);

    const referencedGroup = await ctx.db
      .query('chatGroups')
      .filter((q) => q.eq(q.field('imageStorageId'), args.storageId))
      .first();

    if (referencedGroup) {
      return { deleted: false };
    }

    const metadata = await ctx.db.system.get('_storage', args.storageId);

    if (metadata) {
      await ctx.storage.delete(args.storageId);
    }

    return { deleted: Boolean(metadata) };
  },
});

export const createGroup = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    memberIds: v.array(v.id('users')),
    imageStorageId: v.optional(v.id('_storage')),
  },

  handler: async (ctx, args) => {
    const currentUser = await requireCurrentUser(ctx);
    requireAppAdmin(currentUser);

    const name = normalizeGroupName(args.name);
    const description = args.description?.trim() ?? '';

    if (name.length < 2) {
      throw new ConvexError('Group name must contain at least 2 characters');
    }

    if (name.length > MAX_GROUP_NAME_LENGTH) {
      throw new ConvexError(`Group name cannot exceed ${MAX_GROUP_NAME_LENGTH} characters`);
    }

    if (description.length > MAX_GROUP_DESCRIPTION_LENGTH) {
      throw new ConvexError(
        `Group description cannot exceed ${MAX_GROUP_DESCRIPTION_LENGTH} characters`
      );
    }

    if (args.memberIds.length > MAX_MEMBERS_PER_MUTATION) {
      throw new ConvexError(`You can add at most ${MAX_MEMBERS_PER_MUTATION} members at once`);
    }

    if (args.imageStorageId) {
      await validateGroupImage(ctx, args.imageStorageId);
    }

    const baseSlug = makeSlug(name) || 'group';
    let slug = baseSlug;
    let suffix = 2;

    while (
      await ctx.db
        .query('chatGroups')
        .withIndex('by_slug', (q) => q.eq('slug', slug))
        .first()
    ) {
      slug = `${baseSlug}-${suffix}`;
      suffix += 1;
    }

    const groupId = await ctx.db.insert('chatGroups', {
      name,
      ...(description ? { description } : {}),
      slug,
      createdBy: currentUser._id,
      isActive: true,
      ...(args.imageStorageId ? { imageStorageId: args.imageStorageId } : {}),
    });

    const memberIds = [
      currentUser._id,
      ...args.memberIds.filter((userId) => String(userId) !== String(currentUser._id)),
    ];
    const uniqueMemberIds = [...new Set(memberIds.map(String))];
    const joinedAt = Date.now();

    for (const rawUserId of uniqueMemberIds) {
      const userId = ctx.db.normalizeId('users', rawUserId);

      if (!userId || !(await ctx.db.get(userId))) {
        throw new ConvexError('One or more selected users no longer exist');
      }

      await ctx.db.insert('chatMembers', {
        groupId,
        userId,
        role: String(userId) === String(currentUser._id) ? 'owner' : 'member',
        status: 'active',
        joinedAt,
        notificationsMuted: false,
      });
    }

    return groupId;
  },
});

export const updateGroup = mutation({
  args: {
    groupId: v.id('chatGroups'),
    name: v.string(),
    description: v.optional(v.string()),
    imageStorageId: v.optional(v.id('_storage')),
    removeImage: v.boolean(),
  },

  handler: async (ctx, args) => {
    const currentUser = await requireCurrentUser(ctx);
    requireAppAdmin(currentUser);

    const group = await ctx.db.get(args.groupId);

    if (!group || !group.isActive) {
      throw new ConvexError('Group not found or inactive');
    }

    const name = normalizeGroupName(args.name);
    const description = args.description?.trim() ?? '';

    if (name.length < 2) {
      throw new ConvexError('Group name must contain at least 2 characters');
    }

    if (name.length > MAX_GROUP_NAME_LENGTH) {
      throw new ConvexError(`Group name cannot exceed ${MAX_GROUP_NAME_LENGTH} characters`);
    }

    if (description.length > MAX_GROUP_DESCRIPTION_LENGTH) {
      throw new ConvexError(
        `Group description cannot exceed ${MAX_GROUP_DESCRIPTION_LENGTH} characters`
      );
    }

    if (args.imageStorageId && args.removeImage) {
      throw new ConvexError('A new image and image removal cannot be requested together');
    }

    if (args.imageStorageId) {
      await validateGroupImage(ctx, args.imageStorageId);
    }

    const previousImageStorageId = group.imageStorageId;

    await ctx.db.patch(args.groupId, {
      name,
      description: description || undefined,
      ...(args.imageStorageId
        ? { imageStorageId: args.imageStorageId }
        : args.removeImage
          ? { imageStorageId: undefined }
          : {}),
    });

    const imageWasReplaced =
      Boolean(args.imageStorageId) &&
      String(args.imageStorageId) !== String(previousImageStorageId);

    if (previousImageStorageId && (args.removeImage || imageWasReplaced)) {
      await ctx.storage.delete(previousImageStorageId);
    }

    return args.groupId;
  },
});

export const deleteGroup = mutation({
  args: {
    groupId: v.id('chatGroups'),
  },

  handler: async (ctx, args) => {
    const currentUser = await requireCurrentUser(ctx);
    requireAppAdmin(currentUser);

    const group = await ctx.db.get(args.groupId);

    if (!group || !group.isActive) {
      throw new ConvexError('Group not found or already deleted');
    }

    if (group.slug === DEFAULT_GROUP_SLUG) {
      throw new ConvexError('The default Sweat Sisters group cannot be deleted');
    }

    // Soft delete keeps the message history recoverable and immediately blocks
    // new access anywhere that checks chatGroups.isActive.
    await ctx.db.patch(args.groupId, {
      isActive: false,
    });

    return {
      groupId: args.groupId,
      name: group.name,
    };
  },
});

export const addMembers = mutation({
  args: {
    groupId: v.id('chatGroups'),
    memberIds: v.array(v.id('users')),
  },

  handler: async (ctx, args) => {
    const currentUser = await requireCurrentUser(ctx);
    requireAppAdmin(currentUser);

    if (args.memberIds.length === 0) {
      throw new ConvexError('Select at least one member');
    }

    if (args.memberIds.length > MAX_MEMBERS_PER_MUTATION) {
      throw new ConvexError(`You can add at most ${MAX_MEMBERS_PER_MUTATION} members at once`);
    }

    const group = await ctx.db.get(args.groupId);

    if (!group || !group.isActive) {
      throw new ConvexError('Group not found or inactive');
    }

    const uniqueMemberIds = [...new Set(args.memberIds.map(String))];
    let added = 0;
    let reactivated = 0;
    let skipped = 0;

    for (const rawUserId of uniqueMemberIds) {
      const userId = ctx.db.normalizeId('users', rawUserId);

      if (!userId || !(await ctx.db.get(userId))) {
        throw new ConvexError('One or more selected users no longer exist');
      }

      const existingMembership = await ctx.db
        .query('chatMembers')
        .withIndex('by_group_user', (q) => q.eq('groupId', args.groupId).eq('userId', userId))
        .unique();

      if (existingMembership?.status === 'active') {
        skipped += 1;
        continue;
      }

      if (existingMembership) {
        await ctx.db.patch(existingMembership._id, {
          role: 'member',
          status: 'active',
          joinedAt: Date.now(),
        });
        reactivated += 1;
        continue;
      }

      await ctx.db.insert('chatMembers', {
        groupId: args.groupId,
        userId,
        role: 'member',
        status: 'active',
        joinedAt: Date.now(),
        notificationsMuted: false,
      });
      added += 1;
    }

    return {
      added,
      reactivated,
      skipped,
      totalSelected: uniqueMemberIds.length,
    };
  },
});
