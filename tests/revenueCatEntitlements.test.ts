// @ts-nocheck -- Bun test-only Convex handler fixtures.
import { describe, expect, test } from 'bun:test';

import {
  applyVerifiedSnapshot,
  chooseTrialNotifications,
  sendTrialReminder,
  expireIfDue,
  fetchVerifiedPremium,
  myPlan,
  recordWebhookEvent,
  reconcileMine,
} from '../convex/revenueCatEntitlements';
import {
  parseRevenueCatEvent,
  parseRevenueCatSubscriber,
  verifyRevenueCatSignature,
} from '../convex/revenueCatPolicy';
import { updateUserIsPremium } from '../convex/users';

const now = Date.now();
const today = new Date(now).toISOString().slice(0, 10);
const provider = (
  userId = 'member_a',
  expiry: string | null = new Date(now + 86_400_000).toISOString(),
  checkedAt = now
) => ({
  request_date_ms: checkedAt,
  subscriber: {
    original_app_user_id: userId,
    aliases: [],
    entitlements: {
      Premium: {
        expires_date: expiry,
        grace_period_expires_date: null,
        product_identifier: 'monthly',
      },
    },
  },
});

function fixture(seed: Record<string, any[]> = {}) {
  const rows = structuredClone({ users: [{ _id: 'member_a', timezone: 'UTC' }], ...seed });
  const scheduled: any[] = [];
  const writes: any[] = [];
  let next = 0;
  const db = {
    get: async (id: string) =>
      Object.values(rows)
        .flat()
        .find((row: any) => row._id === id) ?? null,
    normalizeId: (table: string, id: string) =>
      rows[table]?.some((row: any) => row._id === id) ? id : null,
    insert: async (table: string, value: any) => {
      const id = `${table}_${++next}`;
      (rows[table] ??= []).push({ _id: id, ...value });
      writes.push({ table, value });
      return id;
    },
    patch: async (id: string, value: any) => {
      const row = Object.values(rows)
        .flat()
        .find((item: any) => item._id === id);
      if (!row) throw new Error('Missing row');
      Object.assign(row, value);
      writes.push({ table: 'patch', id, value });
    },
    query: (table: string) => {
      let found = [...(rows[table] ?? [])];
      const chain: any = {
        withIndex: (_name: string, callback?: (q: any) => any) => {
          if (callback) {
            const predicates: any[] = [];
            const q: any = {
              eq: (field: string, value: any) => {
                predicates.push([field, value]);
                return q;
              },
            };
            callback(q);
            found = found.filter((row: any) =>
              predicates.every(([field, value]) => row[field] === value)
            );
          }
          return chain;
        },
        order: (direction: string) => {
          if (direction === 'desc') found.reverse();
          return chain;
        },
        first: async () => found[0] ?? null,
        unique: async () => {
          if (found.length > 1) throw new Error('Not unique');
          return found[0] ?? null;
        },
      };
      return chain;
    },
  };
  const ctx: any = {
    db,
    auth: { getUserIdentity: async () => ({ subject: 'member_a' }) },
    scheduler: {
      runAfter: async (...args: any[]) => {
        scheduled.push(args);
      },
    },
  };
  return { ctx, rows, writes, scheduled };
}

describe('server-verified Premium', () => {
  test('forged boolean cannot grant or revoke Premium', async () => {
    const store = fixture();
    await expect(updateUserIsPremium._handler(store.ctx, { isPremium: true })).rejects.toThrow(
      'Premium is verified by the server'
    );
    await expect(updateUserIsPremium._handler(store.ctx, { isPremium: false })).rejects.toThrow();
    expect(store.writes).toHaveLength(0);
  });

  test('server fetch binds the authenticated member ID and rejects wrong-member data', async () => {
    const urls: string[] = [];
    const fetcher = async (url: string, options: any) => {
      urls.push(url);
      expect(options.headers.Authorization).toBe('Bearer server-secret');
      return { ok: true, json: async () => provider('member_a') } as any;
    };
    expect(
      (await fetchVerifiedPremium('member_a', { secretKey: 'server-secret', now, fetcher })).active
    ).toBe(true);
    expect(urls).toEqual(['https://api.revenuecat.com/v1/subscribers/member_a']);
    expect(() => parseRevenueCatSubscriber(provider('member_b'), 'member_a', now)).toThrow(
      'revenuecat_identity_mismatch'
    );
    expect(() =>
      parseRevenueCatSubscriber({ subscriber: { entitlements: { Premium: {} } } }, 'member_a', now)
    ).toThrow();
  });

  test('trial, restore and web redemption require the same active provider entitlement', () => {
    expect(parseRevenueCatSubscriber(provider(), 'member_a', now).active).toBe(true);
    expect(
      parseRevenueCatSubscriber(
        provider('member_a', new Date(now - 1000).toISOString()),
        'member_a',
        now
      ).active
    ).toBe(false);
    const missing = provider();
    missing.subscriber.entitlements = {};
    expect(parseRevenueCatSubscriber(missing, 'member_a', now).active).toBe(false);
  });

  test('purchase pending, cancellation and provider failure do not write access', async () => {
    const store = fixture();
    store.ctx.runQuery = async () => true;
    const old = process.env.REVENUECAT_SECRET_API_KEY;
    delete process.env.REVENUECAT_SECRET_API_KEY;
    try {
      expect(await reconcileMine._handler(store.ctx, {})).toBe('pending');
      expect(store.rows.users[0].isPremium).toBeUndefined();
      expect(store.writes).toHaveLength(0);
    } finally {
      if (old) process.env.REVENUECAT_SECRET_API_KEY = old;
    }
  });

  test('duplicate and out-of-order authenticated events cannot duplicate or roll back a newer snapshot', async () => {
    const store = fixture();
    const event = {
      eventId: 'evt_1',
      eventType: 'EXPIRATION',
      eventAt: now,
      appUserIds: ['member_a', 'not_a_member'],
    };
    expect(await recordWebhookEvent._handler(store.ctx, event)).toBe(true);
    expect(await recordWebhookEvent._handler(store.ctx, event)).toBe(false);
    expect(store.rows.coachBillingEventsV1).toHaveLength(1);
    expect(store.rows.coachBillingEventsV1[0].appUserIds).toEqual([]);
    expect(store.scheduled).toHaveLength(2);
    expect(store.scheduled[1][0]).toBe(60_000);
    const active = parseRevenueCatSubscriber(
      provider('member_a', null, now + 1000),
      'member_a',
      now + 1000
    );
    await applyVerifiedSnapshot._handler(store.ctx, {
      userId: 'member_a',
      snapshot: active,
      reason: 'webhook',
    });
    const stale = parseRevenueCatSubscriber(
      provider('member_a', new Date(now - 1000).toISOString(), now),
      'member_a',
      now
    );
    expect(
      await applyVerifiedSnapshot._handler(store.ctx, {
        userId: 'member_a',
        snapshot: stale,
        reason: 'webhook',
        eventId: 'evt_1',
      })
    ).toBe('active');
    expect(store.rows.users[0].isPremium).toBe(true);
    expect(store.rows.coachBillingChecksV1.at(-1).status).toBe('stale');
    expect(store.scheduled.filter((row) => row[2]?.level === 'Basic Plus')).toHaveLength(1);
  });

  test('expiration revokes access once and a newer renewal makes old expiry job harmless', async () => {
    const store = fixture({
      users: [{ _id: 'member_a', timezone: 'UTC', isPremium: true }],
      coachBillingEntitlementsV1: [
        {
          _id: 'billing',
          userId: 'member_a',
          status: 'active',
          providerCheckedAt: now,
          expiresAt: now - 1,
        },
      ],
    });
    await expireIfDue._handler(store.ctx, { userId: 'member_a', providerCheckedAt: now });
    expect(store.rows.users[0].isPremium).toBe(false);
    expect(store.rows.coachBillingEntitlementsV1[0].status).toBe('inactive');
    await expireIfDue._handler(store.ctx, { userId: 'member_a', providerCheckedAt: now });
    expect(store.scheduled.filter((row) => row[2]?.level === 'Basic')).toHaveLength(1);
  });

  test('unpaid members see only first-plan status, never plan output', async () => {
    const store = fixture({
      coachOnboardingV1: [{ _id: 'state', userId: 'member_a', firstPlanRequestId: 'request' }],
      coachPlanRequestsV1: [{ _id: 'request', userId: 'member_a', day: today, status: 'ready' }],
      coachPlanRevisionsV1: [
        {
          _id: 'revision',
          userId: 'member_a',
          day: today,
          version: 1,
          output: {
            headline: 'Secret plan',
            workout: 'workout',
            steps: 'steps',
            sleep: 'sleep',
            meals: 'meals',
            why: 'why',
          },
        },
      ],
    });
    const unpaid = await myPlan._handler(store.ctx, {});
    expect(unpaid.requestStatus).toBe('ready');
    expect(unpaid.plan).toBeNull();
    store.rows.users[0].isPremium = true;
    expect((await myPlan._handler(store.ctx, {})).plan).toBeNull();
    store.rows.coachBillingEntitlementsV1 = [
      {
        _id: 'billing',
        userId: 'member_a',
        status: 'active',
        providerCheckedAt: now,
        checkedAt: now,
        expiresAt: now + 86_400_000,
      },
    ];
    expect((await myPlan._handler(store.ctx, {})).plan?.output.headline).toBe('Secret plan');
    store.rows.coachPlanRequestsV1.push({
      _id: 'newRequest',
      userId: 'member_a',
      day: today,
      status: 'pending',
    });
    const updating = await myPlan._handler(store.ctx, {});
    expect(updating.requestStatus).toBe('pending');
    expect(updating.plan?.output.headline).toBe('Secret plan');
  });

  test('raw-body HMAC authenticates webhook, rejects tampering and replay', async () => {
    const body = JSON.stringify({
      event: { id: 'evt_1', type: 'RENEWAL', event_timestamp_ms: now, app_user_id: 'member_a' },
    });
    const timestamp = Math.floor(now / 1000);
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode('secret'),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const signed = await crypto.subtle.sign(
      'HMAC',
      key,
      new TextEncoder().encode(`${timestamp}.${body}`)
    );
    const hex = [...new Uint8Array(signed)]
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
    const header = `t=${timestamp},v1=${hex}`;
    expect(await verifyRevenueCatSignature(body, header, 'secret', now)).toBe(true);
    expect(await verifyRevenueCatSignature(body + ' ', header, 'secret', now)).toBe(false);
    expect(await verifyRevenueCatSignature(body, header, 'secret', now + 3600_000)).toBe(false);
    expect(parseRevenueCatEvent(JSON.parse(body)).appUserIds).toEqual(['member_a']);
  });
});

describe('trial reminders', () => {
  const expiresAt = Date.now() + 7 * 86_400_000;
  const billing = {
    _id: 'billing',
    userId: 'member_a',
    status: 'active',
    isTrial: true,
    expiresAt,
  };
  test('verified subscription period distinguishes trials from paid plans', () => {
    const payload = provider();
    payload.subscriber.subscriptions = { monthly: { period_type: 'trial' } };
    expect(parseRevenueCatSubscriber(payload, 'member_a', now).isTrial).toBe(true);
    payload.subscriber.subscriptions.monthly.period_type = 'normal';
    expect(parseRevenueCatSubscriber(payload, 'member_a', now).isTrial).toBe(false);
  });
  test('opt-in queues once at expiry minus two days; skip queues nothing', async () => {
    const store = fixture({
      users: [{ _id: 'member_a', expoPushToken: 'ExponentPushToken[test]' }],
      coachBillingEntitlementsV1: [billing],
    });
    const before = Date.now();
    await chooseTrialNotifications._handler(store.ctx, { enabled: true });
    const after = Date.now();
    expect(store.scheduled).toHaveLength(1);
    const delay = store.scheduled[0][0];
    expect(delay).toBeGreaterThanOrEqual(expiresAt - after - 2 * 86_400_000);
    expect(delay).toBeLessThanOrEqual(expiresAt - before - 2 * 86_400_000);
    await chooseTrialNotifications._handler(store.ctx, { enabled: true });
    expect(store.scheduled).toHaveLength(1);
    await chooseTrialNotifications._handler(store.ctx, { enabled: false });
    expect(store.rows.coachBillingEntitlementsV1[0].trialNotificationChoice).toBe('skipped');
    await sendTrialReminder._handler(store.ctx, { userId: 'member_a', expiresAt });
    expect(store.rows.coachBillingEntitlementsV1[0].trialReminderSentFor).toBeUndefined();
    const skipped = fixture({ coachBillingEntitlementsV1: [billing] });
    await chooseTrialNotifications._handler(skipped.ctx, { enabled: false });
    expect(skipped.scheduled).toHaveLength(0);
  });
  test('no device token cannot opt in; renewed and expired trials ignore stale reminders', async () => {
    const store = fixture({ coachBillingEntitlementsV1: [billing] });
    await expect(chooseTrialNotifications._handler(store.ctx, { enabled: true })).rejects.toThrow();
    expect(store.scheduled).toHaveLength(0);
    await sendTrialReminder._handler(store.ctx, { userId: 'member_a', expiresAt: expiresAt - 1 });
    expect(store.rows.coachBillingEntitlementsV1[0].trialReminderSentFor).toBeUndefined();
  });
});

test('post-activity notification choice works for members without a trial', async () => {
  const store = fixture({ users: [{ _id: 'member_a', expoPushToken: 'ExponentPushToken[test]' }] });
  await chooseTrialNotifications._handler(store.ctx, { enabled: true });
  expect(store.rows.users[0].notificationPromptChoice).toBe('enabled');
  expect(store.scheduled).toHaveLength(0);
  await chooseTrialNotifications._handler(store.ctx, { enabled: false });
  expect(store.rows.users[0].notificationPromptChoice).toBe('skipped');
});
