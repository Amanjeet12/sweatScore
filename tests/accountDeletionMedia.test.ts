// @ts-nocheck -- Bun test types are outside the app TypeScript project.
import { expect, test } from 'bun:test';

import type { Id } from '../convex/_generated/dataModel';
import type { MutationCtx } from '../convex/_generated/server';
import { accountMediaDeleter } from '../convex/accountDeletionMedia';

function fixture(files: string[]) {
  const remaining = new Set(files);
  const deleted: string[] = [];
  const ctx = {
    db: { system: { get: async (id: string) => (remaining.has(id) ? { _id: id } : null) } },
    storage: {
      delete: async (id: string) => {
        if (!remaining.delete(id)) throw new Error(`storage id ${id} not found`);
        deleted.push(id);
      },
    },
  } as unknown as Pick<MutationCtx, 'db' | 'storage'>;
  return { ctx, deleted };
}
const photo = 'photo' as Id<'_storage'>;

test('already missing media does not abort account cleanup', async () => {
  const { ctx, deleted } = fixture([]);
  await accountMediaDeleter(ctx)(photo);
  expect(deleted).toEqual([]);
});

test('shared proof, activity, and post photo is deleted once', async () => {
  const { ctx, deleted } = fixture(['photo']);
  const deleteMedia = accountMediaDeleter(ctx);
  await deleteMedia(photo);
  await deleteMedia(photo);
  await deleteMedia(photo);
  expect(deleted).toEqual(['photo']);
});

test('unexpected storage errors still fail deletion', async () => {
  const { ctx } = fixture(['photo']);
  ctx.storage.delete = async () => {
    throw new Error('storage unavailable');
  };
  await expect(accountMediaDeleter(ctx)(photo)).rejects.toThrow('storage unavailable');
});
