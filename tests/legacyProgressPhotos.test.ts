// @ts-nocheck -- Isolated Convex handlers; no deployment or storage operations.
import { expect, test } from 'bun:test';

import { create } from '../convex/progressPhotos';

test('legacy front-only submission stays valid and new two-view submission still saves both', async () => {
  const args = JSON.parse(create.exportArgs());
  expect(args.value.sidePhoto.optional).toBe(true);
  const inserted = [];
  const ctx = {
    auth: { getUserIdentity: async () => ({ subject: 'member_a' }) },
    db: {
      get: async () => ({ _id: 'member_a', timezone: 'UTC', isPremium: true }),
      query: () => ({ withIndex: () => ({ unique: async () => null }) }),
      insert: async (_table, row) => {
        inserted.push(row);
        return 'photo';
      },
    },
  };
  await create._handler(ctx, { frontPhoto: 'front' });
  await create._handler(ctx, { frontPhoto: 'front', sidePhoto: 'side' });
  expect(inserted[0].sidePhoto).toBeUndefined();
  expect(inserted[1].sidePhoto).toBe('side');
  ctx.db.get = async () => ({ _id: 'member_a', timezone: 'UTC', isPremium: false });
  await expect(create._handler(ctx, { frontPhoto: 'front' })).rejects.toThrow('Premium required');
  expect(inserted).toHaveLength(2);
});
