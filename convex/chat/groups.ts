import { ConvexError, v } from 'convex/values';

import type { Doc } from '../_generated/dataModel';
import { mutation, query } from '../_generated/server';
import { getGroupMembership, requireCurrentUser, requireGroupMember } from './helpers';
import { getAvatarColor, getSafeMemberName, getSafeUserImageUrl } from './userPresentation';
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

    const group = await ctx.db.get(args.groupId);

    if (!group || !group.isActive) {
      throw new ConvexError('Group not found');
    }

    const membership = await getGroupMembership(ctx, group._id, currentUser._id);

    const activeMemberships = await ctx.db
      .query('chatMembers')
      .withIndex('by_group_status', (q) => q.eq('groupId', group._id).eq('status', 'active'))
      .collect();

    const isMember = membership?.status === 'active';

    return {
      ...group,

      imageUrl: group.imageStorageId ? await ctx.storage.getUrl(group.imageStorageId) : null,

      memberCount: activeMemberships.length,

      membershipStatus: membership?.status ?? 'not_joined',

      isMember,

      role: isMember ? membership.role : null,

      canJoin: !membership || membership.status === 'left',

      isRestricted: membership?.status === 'removed',
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

      if (processedGroupIds.has(groupIdString)) {
        continue;
      }

      processedGroupIds.add(groupIdString);

      const group = await ctx.db.get(membership.groupId);

      if (!group || !group.isActive) {
        continue;
      }

      /*
       * New members should not see every old
       * message as unread. Use joinedAt until
       * lastReadAt has been created.
       */
      const unreadFrom = membership.lastReadAt ?? membership.joinedAt;

      const [imageUrl, activeMembers, lastMessage, messagesAfterLastRead] = await Promise.all([
        group.imageStorageId ? ctx.storage.getUrl(group.imageStorageId) : Promise.resolve(null),

        ctx.db
          .query('chatMembers')
          .withIndex('by_group_status', (q) => q.eq('groupId', group._id).eq('status', 'active'))
          .collect(),

        group.lastMessageId ? ctx.db.get(group.lastMessageId) : Promise.resolve(null),

        ctx.db
          .query('chatMessages')
          .withIndex('by_group', (q) => q.eq('groupId', group._id).gt('_creationTime', unreadFrom))
          .collect(),
      ]);

      const unreadCount = messagesAfterLastRead.filter((message) => {
        const isOwnMessage = String(message.senderId) === String(currentUser._id);

        return !isOwnMessage && !message.deletedAt;
      }).length;

      groups.push({
        _id: group._id,

        name: group.name,

        slug: group.slug,

        imageUrl,

        memberCount: activeMembers.length,

        role: membership.role,

        lastMessage: getMessagePreview(lastMessage),

        lastMessageAt: group.lastMessageAt ?? null,

        unreadCount,

        sortAt: group.lastMessageAt ?? group._creationTime,
      });
    }

    return groups.sort((firstGroup, secondGroup) => secondGroup.sortAt - firstGroup.sortAt);
  },
});

/**
 * Returns the most relevant joined group for the dashboard without exposing
 * the full member list. Unread groups win, followed by latest activity.
 */
export const getHomeGroupPreview = query({
  args: {},

  handler: async (ctx) => {
    const currentUser = await requireCurrentUser(ctx);
    const memberships = await ctx.db
      .query('chatMembers')
      .withIndex('by_user_status', (q) => q.eq('userId', currentUser._id).eq('status', 'active'))
      .collect();

    const candidates = [];

    for (const membership of memberships) {
      const group = await ctx.db.get(membership.groupId);

      if (!group?.isActive) {
        continue;
      }

      const unreadFrom = membership.lastReadAt ?? membership.joinedAt;
      const messagesAfterLastRead = await ctx.db
        .query('chatMessages')
        .withIndex('by_group', (q) => q.eq('groupId', group._id).gt('_creationTime', unreadFrom))
        .collect();
      const unreadCount = messagesAfterLastRead.filter(
        (message) => String(message.senderId) !== String(currentUser._id) && !message.deletedAt
      ).length;

      candidates.push({
        group,
        unreadCount,
        isMember: true,
        sortAt: group.lastMessageAt ?? group._creationTime,
      });
    }

    if (candidates.length === 0) {
      const defaultGroup = await ctx.db
        .query('chatGroups')
        .withIndex('by_slug', (q) => q.eq('slug', DEFAULT_GROUP_SLUG))
        .unique();
      const fallbackGroup =
        defaultGroup?.isActive === true
          ? defaultGroup
          : (await ctx.db.query('chatGroups').order('desc').collect()).find(
              (group) => group.isActive
            );

      if (fallbackGroup) {
        candidates.push({
          group: fallbackGroup,
          unreadCount: 0,
          isMember: false,
          sortAt: fallbackGroup.lastMessageAt ?? fallbackGroup._creationTime,
        });
      }
    }

    candidates.sort((first, second) => {
      const unreadDifference = Number(second.unreadCount > 0) - Number(first.unreadCount > 0);

      if (unreadDifference !== 0) {
        return unreadDifference;
      }

      const activityDifference = second.sortAt - first.sortAt;

      if (activityDifference !== 0) {
        return activityDifference;
      }

      return String(first.group._id).localeCompare(String(second.group._id));
    });

    const selected = candidates[0];

    if (!selected) {
      return null;
    }

    const activeMemberships = await ctx.db
      .query('chatMembers')
      .withIndex('by_group_status', (q) =>
        q.eq('groupId', selected.group._id).eq('status', 'active')
      )
      .collect();
    const previewMembers = await Promise.all(
      activeMemberships.slice(0, 3).map(async (membership) => {
        const user = await ctx.db.get(membership.userId);
        const name = getSafeMemberName(user);

        return {
          userId: membership.userId,
          name,
          imageUrl: await getSafeUserImageUrl(ctx, user?.image),
          initial: Array.from(name)[0]?.toUpperCase() ?? '?',
          avatarColor: getAvatarColor(String(membership.userId)),
        };
      })
    );
    const lastMessage = selected.group.lastMessageId
      ? await ctx.db.get(selected.group.lastMessageId)
      : null;
    const sender = lastMessage ? await ctx.db.get(lastMessage.senderId) : null;
    const senderName = getSafeMemberName(sender);

    return {
      groupId: selected.group._id,
      isMember: selected.isMember,
      name: selected.group.name,
      imageUrl: await getSafeUserImageUrl(ctx, selected.group.imageStorageId),
      memberCount: activeMemberships.length,
      previewMembers,
      lastMessage: lastMessage
        ? {
            messageId: lastMessage._id,
            text: getMessagePreview(lastMessage),
            type: lastMessage.type,
            senderId: lastMessage.senderId,
            senderName,
            senderImageUrl: await getSafeUserImageUrl(ctx, sender?.image),
            senderInitial: Array.from(senderName)[0]?.toUpperCase() ?? '?',
            senderAvatarColor: getAvatarColor(String(lastMessage.senderId)),
            createdAt: lastMessage._creationTime,
          }
        : null,
      unreadCount: selected.unreadCount,
      hasUnread: selected.unreadCount > 0,
    };
  },
});

export const listAvailableGroups = query({
  args: {},

  handler: async (ctx) => {
    const currentUser = await requireCurrentUser(ctx);

    const groups = (await ctx.db.query('chatGroups').order('desc').collect()).filter(
      (group) => group.isActive
    );

    const results = await Promise.all(
      groups.map(async (group) => {
        const membership = await getGroupMembership(ctx, group._id, currentUser._id);

        const isMember = membership?.status === 'active';

        const [imageUrl, activeMembers, lastMessage] = await Promise.all([
          group.imageStorageId ? ctx.storage.getUrl(group.imageStorageId) : Promise.resolve(null),

          ctx.db
            .query('chatMembers')
            .withIndex('by_group_status', (q) => q.eq('groupId', group._id).eq('status', 'active'))
            .collect(),

          group.lastMessageId ? ctx.db.get(group.lastMessageId) : Promise.resolve(null),
        ]);

        let hasUnread = false;

        /*
         * Only active members participate
         * in unread-message tracking.
         */
        if (membership?.status === 'active') {
          const unreadFrom = membership.lastReadAt ?? membership.joinedAt;

          const unreadMessage = await ctx.db
            .query('chatMessages')
            .withIndex('by_group', (q) =>
              q.eq('groupId', group._id).gt('_creationTime', unreadFrom)
            )
            .filter((q) => q.neq(q.field('senderId'), currentUser._id))
            .first();

          hasUnread = Boolean(unreadMessage);
        }

        return {
          _id: group._id,
          name: group.name,
          slug: group.slug,
          imageUrl,

          memberCount: activeMembers.length,

          lastMessage: getMessagePreview(lastMessage),

          lastMessageAt: group.lastMessageAt ?? null,

          membershipStatus: membership?.status ?? 'not_joined',

          isMember,

          canJoin: !membership || membership.status === 'left',

          isRestricted: membership?.status === 'removed',

          role: isMember ? membership.role : null,

          hasUnread,

          /*
           * Keep compatibility with the
           * badge already added to the UI.
           */
          unreadCount: hasUnread ? 1 : 0,

          sortAt: group.lastMessageAt ?? group._creationTime,
        };
      })
    );

    return results.sort((first, second) => {
      /*
       * Joined groups always appear first.
       */
      if (first.isMember !== second.isMember) {
        return first.isMember ? -1 : 1;
      }

      /*
       * Inside each section, show the group with
       * the latest activity first.
       */
      return second.sortAt - first.sortAt;
    });
  },
});

export const joinGroup = mutation({
  args: {
    groupId: v.id('chatGroups'),
  },

  handler: async (ctx, args) => {
    const currentUser = await requireCurrentUser(ctx);

    const group = await ctx.db.get(args.groupId);

    if (!group || !group.isActive) {
      throw new ConvexError('Group is not available');
    }

    const membership = await getGroupMembership(ctx, group._id, currentUser._id);

    if (membership?.status === 'removed') {
      throw new ConvexError('You were removed from this group and cannot rejoin');
    }

    if (membership?.status === 'active') {
      return {
        groupId: group._id,

        joined: false,

        alreadyMember: true,
      };
    }

    const joinedAt = Date.now();

    if (membership) {
      /*
       * A member who voluntarily left
       * can join again.
       */
      await ctx.db.patch(membership._id, {
        role: String(group.createdBy) === String(currentUser._id) ? 'owner' : 'member',

        status: 'active',

        joinedAt,

        /*
         * Old messages are visible but
         * should not appear unread.
         */
        lastReadAt: joinedAt,

        notificationsMuted: false,
      });
    } else {
      await ctx.db.insert('chatMembers', {
        groupId: group._id,

        userId: currentUser._id,

        role: String(group.createdBy) === String(currentUser._id) ? 'owner' : 'member',

        status: 'active',

        joinedAt,
        lastReadAt: joinedAt,

        notificationsMuted: false,
      });
    }

    return {
      groupId: group._id,

      joined: true,

      alreadyMember: false,
    };
  },
});
