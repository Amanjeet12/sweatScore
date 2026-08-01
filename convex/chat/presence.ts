import { ConvexError, v } from 'convex/values';

import type { Doc } from '../_generated/dataModel';
import { mutation, query } from '../_generated/server';
import { requireCurrentUser, requireGroupMember } from './helpers';

const TYPING_EXPIRES_AFTER_MS = 6000;

const AVATAR_COLORS = ['#D97706', '#9F1239', '#047857', '#7C3AED', '#2563EB', '#C2410C'];

function sanitizeString(value: unknown, fallback: string, maximumLength = 120) {
  if (typeof value !== 'string') {
    return fallback;
  }

  let safeValue = '';

  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);

    if (code >= 0xd800 && code <= 0xdbff) {
      const nextCode = value.charCodeAt(index + 1);

      if (nextCode >= 0xdc00 && nextCode <= 0xdfff) {
        safeValue += value[index] + value[index + 1];

        index += 1;
      } else {
        safeValue += '\uFFFD';
      }

      continue;
    }

    if (code >= 0xdc00 && code <= 0xdfff) {
      safeValue += '\uFFFD';
      continue;
    }

    safeValue += value[index];
  }

  const normalized = safeValue.normalize('NFC').replace(/\s+/g, ' ').trim().slice(0, maximumLength);

  return normalized || fallback;
}

function getMemberName(user: Doc<'users'> | null) {
  const name = sanitizeString(user?.name, '');

  if (name) {
    return name;
  }

  const email = sanitizeString(user?.email, '', 320);

  if (email) {
    return email.split('@')[0] || 'Member';
  }

  return 'Member';
}

function getAvatarColor(userId: string) {
  let hash = 0;

  for (let index = 0; index < userId.length; index += 1) {
    hash = (hash * 31 + userId.charCodeAt(index)) >>> 0;
  }

  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

async function requireActiveGroup(
  ctx: Parameters<typeof requireCurrentUser>[0],
  groupId: Parameters<typeof requireGroupMember>[1]
) {
  const group = await ctx.db.get(groupId);

  if (!group || !group.isActive) {
    throw new ConvexError('Group not found');
  }

  return group;
}

export const getGroupPresence = query({
  args: {
    groupId: v.id('chatGroups'),
  },

  handler: async (ctx, args) => {
    const currentUser = await requireCurrentUser(ctx);

    await requireGroupMember(ctx, args.groupId, currentUser._id);

    await requireActiveGroup(ctx, args.groupId);

    const [activeMemberships, typingDocuments] = await Promise.all([
      ctx.db
        .query('chatMembers')
        .withIndex('by_group_status', (q) => q.eq('groupId', args.groupId).eq('status', 'active'))
        .collect(),

      ctx.db
        .query('chatTyping')
        .withIndex('by_group_expires', (q) => q.eq('groupId', args.groupId))
        .collect(),
    ]);

    const memberDetails = await Promise.all(
      activeMemberships.map(async (membership) => {
        const user = await ctx.db.get(membership.userId);

        const name = getMemberName(user);

        return {
          userId: membership.userId,

          name,

          initial: sanitizeString(name.charAt(0).toUpperCase(), '?', 2),

          color: getAvatarColor(String(membership.userId)),

          lastDeliveredAt: membership.lastDeliveredAt ?? null,

          lastReadAt: membership.lastReadAt ?? null,
        };
      })
    );

    const activeMemberMap = new Map(memberDetails.map((member) => [String(member.userId), member]));

    const typingUsers = typingDocuments.flatMap((typingDocument) => {
      if (!typingDocument.isTyping || String(typingDocument.userId) === String(currentUser._id)) {
        return [];
      }

      const member = activeMemberMap.get(String(typingDocument.userId));

      if (!member) {
        return [];
      }

      return [
        {
          id: String(typingDocument.userId),

          name: member.name,

          isTyping: typingDocument.isTyping,

          updatedAt: typingDocument.updatedAt,

          expiresAt: typingDocument.expiresAt,
        },
      ];
    });

    const receiptMembers = memberDetails
      .filter((member) => String(member.userId) !== String(currentUser._id))
      .map((member) => ({
        id: String(member.userId),
        name: member.name,
        initial: member.initial,
        color: member.color,

        lastDeliveredAt: member.lastDeliveredAt,

        lastReadAt: member.lastReadAt,
      }));

    return {
      typingUsers,
      receiptMembers,
    };
  },
});

export const setTyping = mutation({
  args: {
    groupId: v.id('chatGroups'),
    isTyping: v.boolean(),
  },

  handler: async (ctx, args) => {
    const currentUser = await requireCurrentUser(ctx);

    await requireGroupMember(ctx, args.groupId, currentUser._id);

    await requireActiveGroup(ctx, args.groupId);

    const existingTyping = await ctx.db
      .query('chatTyping')
      .withIndex('by_group_user', (q) =>
        q.eq('groupId', args.groupId).eq('userId', currentUser._id)
      )
      .unique();

    if (!args.isTyping) {
      if (existingTyping) {
        await ctx.db.delete(existingTyping._id);
      }

      return true;
    }

    const now = Date.now();

    const typingData = {
      isTyping: true,
      updatedAt: now,

      expiresAt: now + TYPING_EXPIRES_AFTER_MS,
    };

    if (existingTyping) {
      await ctx.db.patch(existingTyping._id, typingData);

      return true;
    }

    await ctx.db.insert('chatTyping', {
      groupId: args.groupId,
      userId: currentUser._id,
      ...typingData,
    });

    return true;
  },
});

export const markGroupDelivered = mutation({
  args: {
    groupId: v.id('chatGroups'),
  },

  handler: async (ctx, args) => {
    const currentUser = await requireCurrentUser(ctx);

    const membership = await requireGroupMember(ctx, args.groupId, currentUser._id);

    await requireActiveGroup(ctx, args.groupId);

    const now = Date.now();

    if ((membership.lastDeliveredAt ?? 0) >= now) {
      return true;
    }

    await ctx.db.patch(membership._id, {
      lastDeliveredAt: now,
    });

    return true;
  },
});

export const markGroupRead = mutation({
  args: {
    groupId: v.id('chatGroups'),
  },

  handler: async (ctx, args) => {
    const currentUser = await requireCurrentUser(ctx);

    const membership = await requireGroupMember(ctx, args.groupId, currentUser._id);

    await requireActiveGroup(ctx, args.groupId);

    const now = Date.now();

    await ctx.db.patch(membership._id, {
      lastDeliveredAt: Math.max(membership.lastDeliveredAt ?? 0, now),

      lastReadAt: Math.max(membership.lastReadAt ?? 0, now),
    });

    return true;
  },
});
