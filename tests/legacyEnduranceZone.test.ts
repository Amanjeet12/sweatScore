// @ts-nocheck -- Isolated legacy public action; no external service is contacted.
import { expect, test } from 'bun:test';

import { syncToEnduranceZone, syncToEnduranceZoneForUser } from '../convex/users';

test('legacy public sync accepts old arguments but derives the paid level from server state', async () => {
  expect(syncToEnduranceZone.isPublic).toBe(true);
  const member = {
    _id: 'member_a',
    email: 'member@example.com',
    name: 'Member Name',
    isPremium: false,
  };
  const requests = [];
  const ctx = {
    auth: { getUserIdentity: async () => ({ subject: 'member_a' }) },
    runQuery: async () => member,
    runAction: async (_fn, args) => {
      requests.push(args);
      return { LoginUrl: 'https://example.com', Identifier: 1, Action: 'updated' };
    },
    runMutation: async () => {},
  };
  expect(
    (await syncToEnduranceZone._handler(ctx, { level: 'Premium Plus', country: 'UK' })).success
  ).toBe(true);
  expect(requests[0].level).toBe('Basic');
  expect(requests[0].partnerMemberId).toBe('member_a');
  member.isPremium = true;
  await syncToEnduranceZone._handler(ctx, {});
  expect(requests[1].level).toBe('Basic Plus');
  member.enduranceZoneLevel = 'Premium Plus';
  await syncToEnduranceZone._handler(ctx, { level: 'Basic' });
  expect(requests[2].level).toBe('Premium Plus');
  ctx.auth.getUserIdentity = async () => null;
  await syncToEnduranceZone._handler(ctx, { level: 'Premium Plus' });
  expect(requests).toHaveLength(3);
});

test('emergency brake stops queued membership changes before external work', async () => {
  const original = process.env.LEGACY_PREMIUM_WRITES_PAUSED;
  process.env.LEGACY_PREMIUM_WRITES_PAUSED = 'true';
  const ctx = new Proxy(
    {},
    {
      get() {
        throw new Error('Emergency mode must stop before any work');
      },
    }
  );
  try {
    await syncToEnduranceZoneForUser._handler(ctx, { userId: 'member_a', level: 'Basic' });
  } finally {
    if (original === undefined) delete process.env.LEGACY_PREMIUM_WRITES_PAUSED;
    else process.env.LEGACY_PREMIUM_WRITES_PAUSED = original;
  }
});
