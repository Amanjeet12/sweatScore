import { getAuthUserId } from '@convex-dev/auth/server';
import { ConvexError } from 'convex/values';

import type { Id } from '../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../_generated/server';

type DatabaseCtx = QueryCtx | MutationCtx;

export async function requireCurrentUser(ctx: DatabaseCtx) {
  const userId = await getAuthUserId(ctx);

  if (!userId) {
    throw new ConvexError('Authentication required');
  }

  const user = await ctx.db.get(userId);

  if (!user) {
    throw new ConvexError('User account not found');
  }

  return user;
}

export async function requireGroupMember(
  ctx: DatabaseCtx,
  groupId: Id<'chatGroups'>,
  userId: Id<'users'>
) {
  const membership = await getGroupMembership(ctx, groupId, userId);

  if (!membership || membership.status !== 'active') {
    throw new ConvexError('You are not an active member of this group');
  }

  return membership;
}

export async function requireGroupAdmin(
  ctx: DatabaseCtx,
  groupId: Id<'chatGroups'>,
  userId: Id<'users'>
) {
  const membership = await requireGroupMember(ctx, groupId, userId);

  if (membership.role !== 'owner' && membership.role !== 'admin') {
    throw new ConvexError('Group administrator access required');
  }

  return membership;
}

export async function getGroupMembership(
  ctx: DatabaseCtx,
  groupId: Id<'chatGroups'>,
  userId: Id<'users'>
) {
  return await ctx.db
    .query('chatMembers')
    .withIndex('by_group_user', (q) => q.eq('groupId', groupId).eq('userId', userId))
    .unique();
}
