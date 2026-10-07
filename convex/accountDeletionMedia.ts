import type { Id } from './_generated/dataModel';
import type { MutationCtx } from './_generated/server';

// A photo can be referenced by a proof, activity, and post, or already be gone.
export function accountMediaDeleter(ctx: Pick<MutationCtx, 'db' | 'storage'>) {
  const handled = new Set<Id<'_storage'>>();
  return async (storageId: Id<'_storage'>) => {
    if (handled.has(storageId)) return;
    const file = await ctx.db.system.get(storageId);
    if (file) await ctx.storage.delete(storageId);
    handled.add(storageId);
  };
}
