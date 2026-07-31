import { ConvexError, v } from 'convex/values';

import type { Doc } from '../_generated/dataModel';
import { mutation, query } from '../_generated/server';
import { requireCurrentUser, requireGroupMember } from './helpers';

const DEFAULT_GROUP_SLUG = 'sweat-sisters';

/**
 * Generate the preview shown under a group name.
 */
function getMessagePreview(message: Doc<'chatMessages'> | null) {
  if (!message) {
    return 'No messages yet';
  }

  if (message.deletedAt) {
    return 'Message deleted';
  }

  switch (message.type) {
    case 'image':
      return '📷 Photo';

    case 'video':
      return '🎥 Video';

    case 'voice':
      return '🎤 Voice message';

    case 'file':
      return '📎 File';

    case 'link':
      return message.text?.trim() || '🔗 Link';

    case 'text':
    default:
      return message.text?.trim() || 'New message';
  }
}

/**
 * Creates the default Sweat Sisters group.
 *
 * Only an application administrator can call this mutation.
 */
export const createDefaultGroup = mutation({
  args: {},

  handler: async (ctx) => {
    const currentUser = await requireCurrentUser(ctx);

    if (currentUser.isAdmin !== true) {
      throw new ConvexError('Only an admin can create the default group');
    }

    const existingGroup = await ctx.db
      .query('chatGroups')
      .withIndex('by_slug', (q) => q.eq('slug', DEFAULT_GROUP_SLUG))
      .unique();

    if (existingGroup) {
      return existingGroup._id;
    }

    const groupId = await ctx.db.insert('chatGroups', {
      name: 'Sweat Sisters',
      slug: DEFAULT_GROUP_SLUG,
      createdBy: currentUser._id,
      isActive: true,
    });

    await ctx.db.insert('chatMembers', {
      groupId,
      userId: currentUser._id,
      role: 'owner',
      status: 'active',
      joinedAt: Date.now(),
      notificationsMuted: false,
    });

    return groupId;
  },
});

/**
 * Adds the authenticated user to the default group.
 *
 * Existing active members are not duplicated.
 * Members who previously left are reactivated.
 * Removed members cannot rejoin automatically.
 */
export const ensureDefaultMembership = mutation({
  args: {},

  handler: async (ctx) => {
    const currentUser = await requireCurrentUser(ctx);

    const group = await ctx.db
      .query('chatGroups')
      .withIndex('by_slug', (q) => q.eq('slug', DEFAULT_GROUP_SLUG))
      .unique();

    if (!group || !group.isActive) {
      throw new ConvexError('Community group is not available');
    }

    // Uncomment if group chat requires a premium subscription.
    //
    // if (currentUser.isPremium !== true) {
    //   throw new ConvexError('Premium membership required');
    // }

    const existingMembership = await ctx.db
      .query('chatMembers')
      .withIndex('by_group_user', (q) => q.eq('groupId', group._id).eq('userId', currentUser._id))
      .unique();

    if (existingMembership?.status === 'active') {
      return group._id;
    }

    if (existingMembership?.status === 'removed') {
      throw new ConvexError('You were removed from this group');
    }

    if (existingMembership?.status === 'left') {
      await ctx.db.patch(existingMembership._id, {
        status: 'active',
        joinedAt: Date.now(),
      });

      return group._id;
    }

    await ctx.db.insert('chatMembers', {
      groupId: group._id,
      userId: currentUser._id,
      role: 'member',
      status: 'active',
      joinedAt: Date.now(),
      notificationsMuted: false,
    });

    return group._id;
  },
});

/**
 * Returns the default group for an active member.
 */
export const getDefaultGroup = query({
  args: {},

  handler: async (ctx) => {
    const currentUser = await requireCurrentUser(ctx);

    const group = await ctx.db
      .query('chatGroups')
      .withIndex('by_slug', (q) => q.eq('slug', DEFAULT_GROUP_SLUG))
      .unique();

    if (!group || !group.isActive) {
      return null;
    }

    await requireGroupMember(ctx, group._id, currentUser._id);

    return {
      ...group,
      imageUrl: group.imageStorageId ? await ctx.storage.getUrl(group.imageStorageId) : null,
    };
  },
});

/**
 * Returns one group after checking that the user is an active member.
 */
export const getGroup = query({
  args: {
    groupId: v.id('chatGroups'),
  },

  handler: async (ctx, args) => {
    const currentUser = await requireCurrentUser(ctx);

    await requireGroupMember(ctx, args.groupId, currentUser._id);

    const group = await ctx.db.get(args.groupId);

    if (!group || !group.isActive) {
      throw new ConvexError('Group not found');
    }

    const memberships = await ctx.db
      .query('chatMembers')
      .withIndex('by_group_user', (q) => q.eq('groupId', group._id))
      .collect();

    return {
      ...group,
      imageUrl: group.imageStorageId ? await ctx.storage.getUrl(group.imageStorageId) : null,
      memberCount: memberships.filter((membership) => membership.status === 'active').length,
    };
  },
});

/**
 * Returns every active group in which the authenticated
 * user has an active membership.
 */
export const listMyGroups = query({
  args: {},

  handler: async (ctx) => {
    const currentUser = await requireCurrentUser(ctx);

    const memberships = await ctx.db
      .query('chatMembers')
      .withIndex('by_user_status', (q) => q.eq('userId', currentUser._id).eq('status', 'active'))
      .collect();

    const groups = [];
    const processedGroupIds = new Set<string>();

    for (const membership of memberships) {
      const groupIdString = String(membership.groupId);

      // Prevent duplicate groups if duplicate membership
      // documents accidentally exist.
      if (processedGroupIds.has(groupIdString)) {
        continue;
      }

      processedGroupIds.add(groupIdString);

      const group = await ctx.db.get(membership.groupId);

      if (!group || !group.isActive) {
        continue;
      }

      const [imageUrl, activeMembers, lastMessage] = await Promise.all([
        group.imageStorageId ? ctx.storage.getUrl(group.imageStorageId) : Promise.resolve(null),

        ctx.db
          .query('chatMembers')
          .withIndex('by_group_status', (q) => q.eq('groupId', group._id).eq('status', 'active'))
          .collect(),

        group.lastMessageId ? ctx.db.get(group.lastMessageId) : Promise.resolve(null),
      ]);

      groups.push({
        _id: group._id,
        name: group.name,
        slug: group.slug,
        imageUrl,
        memberCount: activeMembers.length,
        role: membership.role,
        lastMessage: getMessagePreview(lastMessage),
        lastMessageAt: group.lastMessageAt ?? null,
        sortAt: group.lastMessageAt ?? group._creationTime,
      });
    }

    return groups.sort((firstGroup, secondGroup) => secondGroup.sortAt - firstGroup.sortAt);
  },
});
