import type { Doc, Id } from '../_generated/dataModel';
import type { QueryCtx } from '../_generated/server';

const AVATAR_COLORS = ['#F76B1C', '#7C3AED', '#2563EB', '#047857', '#C2410C', '#9F1239', '#D97706'];

export function getAvatarColor(userId: string) {
  let hash = 0;

  for (let index = 0; index < userId.length; index += 1) {
    hash = (hash * 31 + userId.charCodeAt(index)) >>> 0;
  }

  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

export function getSafeMemberName(user: Doc<'users'> | null) {
  const name = user?.name?.normalize('NFC').trim();

  if (name) {
    return name;
  }

  const email = user?.email?.normalize('NFC').trim();

  return email?.split('@')[0] || 'Member';
}

export async function getSafeUserImageUrl(
  ctx: QueryCtx,
  imageStorageId: Id<'_storage'> | undefined
) {
  if (!imageStorageId) {
    return null;
  }

  try {
    return (await ctx.storage.getUrl(imageStorageId)) ?? null;
  } catch {
    return null;
  }
}
