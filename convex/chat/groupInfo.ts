import { ConvexError, v } from 'convex/values';

import type { Doc, Id } from '../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../_generated/server';
import { mutation, query } from '../_generated/server';
import { requireCurrentUser, requireGroupMember } from './helpers';

const DEFAULT_GROUP_SLUG = 'sweat-sisters';
const MAX_GROUP_NAME_LENGTH = 60;
const MAX_GROUP_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_MEMBERS_PER_MUTATION = 100;

type DatabaseCtx = QueryCtx | MutationCtx;

function normalizeGroupName(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

function getMemberName(user: Doc<'users'> | null) {
  const name = user?.name?.trim();

  if (name) {
    return name;
  }

  if (user?.email) {
    return user.email.split('@')[0];
  }

  return 'Member';
}

function getAvatarColor(userId: string) {
  const colors = ['#F76B1C', '#7C3AED', '#2563EB', '#047857', '#C2410C', '#9F1239', '#D97706'];

  let hash = 0;

  for (let index = 0; index < userId.length; index += 1) {
    hash = (hash * 31 + userId.charCodeAt(index)) >>> 0;
  }

  return colors[hash % colors.length];
}

async function getActiveGroup(ctx: DatabaseCtx, groupId: Id<'chatGroups'>) {
  const group = await ctx.db.get(groupId);

  if (!group || !group.isActive) {
    throw new ConvexError('Group not found or inactive');
  }

  return group;
}

async function requireGroupManager(
  ctx: DatabaseCtx,
  groupId: Id<'chatGroups'>,
  currentUser: Doc<'users'>
) {
  const membership = await requireGroupMember(ctx, groupId, currentUser._id);

  const isAppAdmin = currentUser.isAdmin === true;

  const isGroupManager = membership.role === 'owner' || membership.role === 'admin';

  if (!isAppAdmin && !isGroupManager) {
    throw new ConvexError('Group administrator access required');
  }

  return {
    membership,
    isAppAdmin,
  };
}

async function requireGroupOwner(
  ctx: DatabaseCtx,
  groupId: Id<'chatGroups'>,
  currentUser: Doc<'users'>
) {
  const membership = await requireGroupMember(ctx, groupId, currentUser._id);

  const isAppAdmin = currentUser.isAdmin === true;

  if (!isAppAdmin && membership.role !== 'owner') {
    throw new ConvexError('Only the group owner can perform this action');
  }

  return {
    membership,
    isAppAdmin,
  };
}

async function validateGroupImage(ctx: MutationCtx, storageId: Id<'_storage'>) {
  const metadata = await ctx.db.system.get('_storage', storageId);

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

function sanitizeUnicodeString(value: unknown, fallback = '', maximumLength = 500) {
  if (typeof value !== 'string') {
    return fallback;
  }

  let sanitized = '';

  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);

    /*
     * Valid UTF-16 surrogate pair.
     */
    if (code >= 0xd800 && code <= 0xdbff) {
      const nextCode = value.charCodeAt(index + 1);

      if (nextCode >= 0xdc00 && nextCode <= 0xdfff) {
        sanitized += value[index] + value[index + 1];

        index += 1;
        continue;
      }

      /*
       * Replace an unpaired high surrogate.
       */
      sanitized += '\uFFFD';
      continue;
    }

    /*
     * Replace an unpaired low surrogate.
     */
    if (code >= 0xdc00 && code <= 0xdfff) {
      sanitized += '\uFFFD';
      continue;
    }

    /*
     * Remove unsupported control characters.
     * Keep normal tab, line feed and carriage return.
     */
    if (
      (code >= 0x00 && code <= 0x08) ||
      code === 0x0b ||
      code === 0x0c ||
      (code >= 0x0e && code <= 0x1f) ||
      code === 0x7f
    ) {
      sanitized += ' ';
      continue;
    }

    sanitized += value[index];
  }

  const normalized = sanitized.normalize('NFC').replace(/\s+/g, ' ').trim().slice(0, maximumLength);

  return normalized || fallback;
}

function getSafeMemberName(user: Doc<'users'> | null) {
  const safeName = sanitizeUnicodeString(user?.name, '', 120);

  if (safeName) {
    return safeName;
  }

  const safeEmail = sanitizeUnicodeString(user?.email, '', 320);

  if (safeEmail) {
    return safeEmail.split('@')[0] || 'Member';
  }

  return 'Member';
}

function getSafeEmail(value: unknown) {
  const email = sanitizeUnicodeString(value, '', 320);

  return email || null;
}

async function getSafeUserImageUrl(ctx: QueryCtx, imageStorageId: Id<'_storage'> | undefined) {
  if (!imageStorageId) {
    return null;
  }

  try {
    const imageUrl = await ctx.storage.getUrl(imageStorageId);

    if (!imageUrl) {
      return null;
    }

    const safeUrl = sanitizeUnicodeString(imageUrl, '', 2048);

    return safeUrl || null;
  } catch {
    /*
     * A missing or invalid image should not
     * break the complete member query.
     */
    return null;
  }
}

export const getGroupInfo = query({
  args: {
    groupId: v.id('chatGroups'),
  },

  handler: async (ctx, args) => {
    const currentUser = await requireCurrentUser(ctx);

    const currentMembership = await requireGroupMember(ctx, args.groupId, currentUser._id);

    const group = await getActiveGroup(ctx, args.groupId);

    const isAppAdmin = currentUser.isAdmin === true;

    const canManageMembers =
      isAppAdmin || currentMembership.role === 'owner' || currentMembership.role === 'admin';

    const canEditGroup = canManageMembers;

    const canDeleteGroup =
      group.slug !== DEFAULT_GROUP_SLUG && (isAppAdmin || currentMembership.role === 'owner');

    const canLeaveGroup = currentMembership.role !== 'owner';

    const memberships = await ctx.db
      .query('chatMembers')
      .withIndex('by_group_status', (q) => q.eq('groupId', args.groupId).eq('status', 'active'))
      .collect();

    const members = await Promise.all(
      memberships.map(async (membership) => {
        const user = await ctx.db.get(membership.userId);

        const name = getMemberName(user);

        const isCurrentUser = String(membership.userId) === String(currentUser._id);

        const canRemove =
          canManageMembers &&
          !isCurrentUser &&
          membership.role !== 'owner' &&
          (isAppAdmin ||
            currentMembership.role === 'owner' ||
            (currentMembership.role === 'admin' && membership.role === 'member'));

        return {
          userId: membership.userId,

          name,

          email: canManageMembers ? (user?.email ?? null) : null,

          imageUrl: user?.image ? await ctx.storage.getUrl(user.image) : null,

          initial: name.charAt(0).toUpperCase() || '?',

          avatarColor: getAvatarColor(String(membership.userId)),

          role: membership.role,
          joinedAt: membership.joinedAt,
          isCurrentUser,
          canRemove,
        };
      })
    );

    const roleOrder = {
      owner: 0,
      admin: 1,
      member: 2,
    } as const;

    members.sort((first, second) => {
      const roleDifference = roleOrder[first.role] - roleOrder[second.role];

      if (roleDifference !== 0) {
        return roleDifference;
      }

      return first.name.localeCompare(second.name);
    });

    return {
      _id: group._id,
      name: group.name,
      slug: group.slug,

      imageUrl: group.imageStorageId ? await ctx.storage.getUrl(group.imageStorageId) : null,

      memberCount: members.length,
      members,

      currentUserId: currentUser._id,

      currentUserRole: currentMembership.role,

      isDefaultGroup: group.slug === DEFAULT_GROUP_SLUG,

      canEditGroup,
      canManageMembers,
      canLeaveGroup,
      canDeleteGroup,
    };
  },
});

export const listAvailableUsers = query({
  args: {
    groupId: v.id('chatGroups'),
  },

  returns: v.array(
    v.object({
      _id: v.id('users'),
      name: v.string(),

      email: v.union(v.string(), v.null()),

      imageUrl: v.union(v.string(), v.null()),

      initial: v.string(),
      avatarColor: v.string(),
    })
  ),

  handler: async (ctx, args) => {
    const currentUser = await requireCurrentUser(ctx);

    await requireGroupManager(ctx, args.groupId, currentUser);

    await getActiveGroup(ctx, args.groupId);

    const activeMemberships = await ctx.db
      .query('chatMembers')
      .withIndex('by_group_status', (queryBuilder) =>
        queryBuilder.eq('groupId', args.groupId).eq('status', 'active')
      )
      .collect();

    const activeUserIds = new Set(activeMemberships.map((membership) => String(membership.userId)));

    const users = await ctx.db.query('users').order('desc').take(300);

    const availableUsers = users.filter((user) => !activeUserIds.has(String(user._id)));

    const safeUsers = [];

    for (const user of availableUsers) {
      const name = getSafeMemberName(user);

      const imageUrl = await getSafeUserImageUrl(ctx, user.image);

      safeUsers.push({
        _id: user._id,

        name,

        email: getSafeEmail(user.email),

        imageUrl,

        initial: sanitizeUnicodeString(name.charAt(0).toUpperCase(), '?', 2),

        avatarColor: getAvatarColor(String(user._id)),
      });
    }

    return safeUsers;
  },
});

export const generateGroupImageUploadUrl = mutation({
  args: {
    groupId: v.id('chatGroups'),
  },

  handler: async (ctx, args) => {
    const currentUser = await requireCurrentUser(ctx);

    await requireGroupManager(ctx, args.groupId, currentUser);

    await getActiveGroup(ctx, args.groupId);

    return ctx.storage.generateUploadUrl();
  },
});

export const cleanupUnusedGroupImage = mutation({
  args: {
    groupId: v.id('chatGroups'),

    storageId: v.id('_storage'),
  },

  handler: async (ctx, args) => {
    const currentUser = await requireCurrentUser(ctx);

    await requireGroupManager(ctx, args.groupId, currentUser);

    const referencedGroup = await ctx.db
      .query('chatGroups')
      .filter((q) => q.eq(q.field('imageStorageId'), args.storageId))
      .first();

    if (referencedGroup) {
      return {
        deleted: false,
      };
    }

    const metadata = await ctx.db.system.get('_storage', args.storageId);

    if (metadata) {
      await ctx.storage.delete(args.storageId);
    }

    return {
      deleted: Boolean(metadata),
    };
  },
});

export const updateGroupInfo = mutation({
  args: {
    groupId: v.id('chatGroups'),

    name: v.string(),

    imageStorageId: v.optional(v.id('_storage')),

    removeImage: v.boolean(),
  },

  handler: async (ctx, args) => {
    const currentUser = await requireCurrentUser(ctx);

    await requireGroupManager(ctx, args.groupId, currentUser);

    const group = await getActiveGroup(ctx, args.groupId);

    const name = normalizeGroupName(args.name);

    if (name.length < 2) {
      throw new ConvexError('Group name must contain at least 2 characters');
    }

    if (name.length > MAX_GROUP_NAME_LENGTH) {
      throw new ConvexError(`Group name cannot exceed ${MAX_GROUP_NAME_LENGTH} characters`);
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

      ...(args.imageStorageId
        ? {
            imageStorageId: args.imageStorageId,
          }
        : args.removeImage
          ? {
              imageStorageId: undefined,
            }
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

export const addMembers = mutation({
  args: {
    groupId: v.id('chatGroups'),

    memberIds: v.array(v.id('users')),
  },

  handler: async (ctx, args) => {
    const currentUser = await requireCurrentUser(ctx);

    await requireGroupManager(ctx, args.groupId, currentUser);

    await getActiveGroup(ctx, args.groupId);

    if (args.memberIds.length === 0) {
      throw new ConvexError('Select at least one member');
    }

    if (args.memberIds.length > MAX_MEMBERS_PER_MUTATION) {
      throw new ConvexError(`You can add at most ${MAX_MEMBERS_PER_MUTATION} members at once`);
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
    };
  },
});

export const removeMember = mutation({
  args: {
    groupId: v.id('chatGroups'),
    userId: v.id('users'),
  },

  handler: async (ctx, args) => {
    const currentUser = await requireCurrentUser(ctx);

    const { membership: currentMembership, isAppAdmin } = await requireGroupManager(
      ctx,
      args.groupId,
      currentUser
    );

    await getActiveGroup(ctx, args.groupId);

    if (String(args.userId) === String(currentUser._id)) {
      throw new ConvexError('Use Leave group to remove yourself');
    }

    const targetMembership = await ctx.db
      .query('chatMembers')
      .withIndex('by_group_user', (q) => q.eq('groupId', args.groupId).eq('userId', args.userId))
      .unique();

    if (!targetMembership || targetMembership.status !== 'active') {
      throw new ConvexError('The selected member is no longer active');
    }

    if (targetMembership.role === 'owner') {
      throw new ConvexError('The group owner cannot be removed');
    }

    if (!isAppAdmin && currentMembership.role === 'admin' && targetMembership.role !== 'member') {
      throw new ConvexError('Group admins can only remove regular members');
    }

    await ctx.db.patch(targetMembership._id, {
      role: 'member',
      status: 'removed',
    });

    return true;
  },
});

export const leaveGroup = mutation({
  args: {
    groupId: v.id('chatGroups'),
  },

  handler: async (ctx, args) => {
    const currentUser = await requireCurrentUser(ctx);

    const membership = await requireGroupMember(ctx, args.groupId, currentUser._id);

    await getActiveGroup(ctx, args.groupId);

    if (membership.role === 'owner') {
      throw new ConvexError('The group owner cannot leave the group');
    }

    await ctx.db.patch(membership._id, {
      status: 'left',
    });

    return true;
  },
});

export const deactivateGroup = mutation({
  args: {
    groupId: v.id('chatGroups'),
  },

  handler: async (ctx, args) => {
    const currentUser = await requireCurrentUser(ctx);

    await requireGroupOwner(ctx, args.groupId, currentUser);

    const group = await getActiveGroup(ctx, args.groupId);

    if (group.slug === DEFAULT_GROUP_SLUG) {
      throw new ConvexError('The default Sweat Sisters group cannot be deleted');
    }

    await ctx.db.patch(args.groupId, {
      isActive: false,
    });

    return true;
  },
});

export const listMentionableMembers = query({
  args: {
    groupId: v.id('chatGroups'),
  },

  handler: async (ctx, args) => {
    const currentUser = await requireCurrentUser(ctx);

    await requireGroupMember(ctx, args.groupId, currentUser._id);

    const memberships = await ctx.db
      .query('chatMembers')
      .withIndex('by_group_status', (q) => q.eq('groupId', args.groupId).eq('status', 'active'))
      .collect();

    const members = [];

    for (const membership of memberships) {
      const user = await ctx.db.get(membership.userId);

      if (!user) {
        continue;
      }

      const name = user.name?.trim() || user.email?.split('@')[0] || 'Member';

      members.push({
        userId: membership.userId,
        name,
        initial: name.charAt(0).toUpperCase() || '?',
        avatarColor: getAvatarColor(String(membership.userId)),
      });
    }

    return members.sort((first, second) => first.name.localeCompare(second.name));
  },
});
