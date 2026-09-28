import { getAuthUserId } from '@convex-dev/auth/server';
import { ConvexError, v } from 'convex/values';
import { internal } from './_generated/api';
import { Id } from './_generated/dataModel';
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  query,
  ActionCtx,
} from './_generated/server';
import { parseRevenueCatSubscriber, VerifiedPremium } from './revenueCatPolicy';
import { formatDateInTZ } from './utils/timezone';
import { canRetryCurrentPlanRequest } from './coachPlanRetry';
import { planDetailsV2, workoutMetadata } from './coachFoundationValidators';
import { dailyPolicy } from './coachDailyPolicy';

const reason = v.union(v.literal('client'), v.literal('webhook'), v.literal('expiry'));
const verifiedSnapshot = v.object({
  appUserId: v.string(),
  active: v.boolean(),
  providerCheckedAt: v.number(),
  expiresAt: v.optional(v.number()),
  productId: v.optional(v.string()),
});

export const myStatus = query({
  args: {},
  returns: v.object({
    status: v.union(v.literal('active'), v.literal('inactive'), v.literal('pending')),
    isPro: v.boolean(),
    checkedAt: v.union(v.number(), v.null()),
  }),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { status: 'pending' as const, isPro: false, checkedAt: null };
    const user = await ctx.db.get(userId);
    if (!user) return { status: 'pending' as const, isPro: false, checkedAt: null };
    const row = await ctx.db
      .query('coachBillingEntitlementsV1')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .unique();
    const active = row?.status === 'active' && (!row.expiresAt || row.expiresAt > Date.now());
    return {
      status: row ? (active ? ('active' as const) : ('inactive' as const)) : ('pending' as const),
      // Preserve existing paid members while their first authoritative lookup is pending.
      isPro: Boolean(user.isAdmin || (row ? active : user.isPremium)),
      checkedAt: row?.checkedAt ?? null,
    };
  },
});

export const myPlan = query({
  args: { refresh: v.optional(v.number()) },
  returns: v.object({
    day: v.string(),
    requestStatus: v.union(
      v.literal('none'),
      v.literal('pending'),
      v.literal('ready'),
      v.literal('failed')
    ),
    access: v.boolean(),
    canRetry: v.boolean(),
    requestId: v.union(v.id('coachPlanRequestsV1'), v.null()),
    errorCode: v.optional(v.string()),
    policyBlock: v.optional(
      v.union(
        v.literal('full_plus_poor_readiness'),
        v.literal('recovery_plus_soreness'),
        v.literal('high_steps_threshold')
      )
    ),
    plan: v.union(
      v.null(),
      v.object({
        revisionId: v.id('coachPlanRevisionsV1'),
        promptVersion: v.string(),
        workout: workoutMetadata,
        stepTarget: v.number(),
        detailsV2: v.optional(planDetailsV2),
        output: v.object({
          headline: v.string(),
          workout: v.string(),
          steps: v.string(),
          sleep: v.string(),
          meals: v.string(),
          why: v.string(),
        }),
      })
    ),
  }),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError('Authentication required');
    const user = await ctx.db.get(userId);
    if (!user) throw new ConvexError('Member missing');
    const day = formatDateInTZ(new Date(), user.timezone);
    const request = await ctx.db
      .query('coachPlanRequestsV1')
      .withIndex('by_user_day', (q) => q.eq('userId', userId).eq('day', day))
      .order('desc')
      .first();
    const revision = await ctx.db
      .query('coachPlanRevisionsV1')
      .withIndex('by_user_day_version', (q) => q.eq('userId', userId).eq('day', day))
      .order('desc')
      .first();
    const billing = await ctx.db
      .query('coachBillingEntitlementsV1')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .unique();
    const access = Boolean(
      user.isAdmin ||
      (billing?.status === 'active' && (!billing.expiresAt || billing.expiresAt > Date.now()))
    );
    return {
      day,
      requestStatus: (request?.status ?? (revision ? 'ready' : 'none')) as
        | 'ready'
        | 'pending'
        | 'failed'
        | 'none',
      access,
      canRetry: !revision && canRetryCurrentPlanRequest(request),
      requestId: access ? (request?._id ?? null) : null,
      errorCode: access && request?.status === 'failed' ? request.errorCode : undefined,
      policyBlock:
        access && request?.status === 'failed' && request.errorCode === 'policy_unresolved'
          ? dailyPolicy(request.inputSnapshot, day).unresolved
          : undefined,
      plan:
        access && revision
          ? {
              revisionId: revision._id,
              output: revision.output,
              promptVersion: revision.promptVersion,
              workout: revision.workout,
              stepTarget: revision.stepTarget,
              detailsV2: revision.detailsV2,
            }
          : null,
    };
  },
});

export const getMemberForReconcile = internalQuery({
  args: { userId: v.id('users') },
  returns: v.boolean(),
  handler: async (ctx, { userId }) => Boolean(await ctx.db.get(userId)),
});

export async function fetchVerifiedPremium(
  appUserId: string,
  config: { secretKey: string; now?: number; fetcher?: typeof fetch }
): Promise<VerifiedPremium> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await (config.fetcher ?? fetch)(
      `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`,
      {
        headers: { Authorization: `Bearer ${config.secretKey}`, Accept: 'application/json' },
        signal: controller.signal,
      }
    );
    if (!response.ok) throw new Error(`revenuecat_http_${response.status}`);
    return parseRevenueCatSubscriber(await response.json(), appUserId, config.now ?? Date.now());
  } finally {
    clearTimeout(timeout);
  }
}

export const reconcileMine = action({
  args: {},
  returns: v.union(v.literal('active'), v.literal('inactive'), v.literal('pending')),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError('Authentication required');
    const exists = await ctx.runQuery(internal.revenueCatEntitlements.getMemberForReconcile, {
      userId,
    });
    if (!exists) throw new ConvexError('Member missing');
    return reconcileMember(ctx, userId, 'client');
  },
});

async function reconcileMember(
  ctx: ActionCtx,
  userId: Id<'users'>,
  source: 'client' | 'webhook' | 'expiry',
  eventId?: string
): Promise<'active' | 'inactive' | 'pending'> {
  const secretKey = process.env.REVENUECAT_SECRET_API_KEY;
  if (!secretKey) return 'pending';
  try {
    const snapshot = await fetchVerifiedPremium(userId, { secretKey });
    return await ctx.runMutation(internal.revenueCatEntitlements.applyVerifiedSnapshot, {
      userId,
      snapshot,
      reason: source,
      eventId,
    });
  } catch {
    await ctx.runMutation(internal.revenueCatEntitlements.recordCheckFailure, {
      userId,
      reason: source,
      eventId,
    });
    return 'pending';
  }
}

export const reconcileFromWebhook = internalAction({
  args: { userId: v.id('users'), eventId: v.string(), attempt: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (
      !(await ctx.runQuery(internal.revenueCatEntitlements.getMemberForReconcile, {
        userId: args.userId,
      }))
    )
      return null;
    const result = await reconcileMember(ctx, args.userId, 'webhook', args.eventId);
    if (result === 'pending' && args.attempt < 4) {
      await ctx.scheduler.runAfter(
        60_000 * 2 ** args.attempt,
        internal.revenueCatEntitlements.reconcileFromWebhook,
        { ...args, attempt: args.attempt + 1 }
      );
    }
    return null;
  },
});

export const applyVerifiedSnapshot = internalMutation({
  args: {
    userId: v.id('users'),
    snapshot: verifiedSnapshot,
    reason,
    eventId: v.optional(v.string()),
  },
  returns: v.union(v.literal('active'), v.literal('inactive'), v.literal('pending')),
  handler: async (ctx, args) => {
    if (args.snapshot.appUserId !== args.userId)
      throw new ConvexError('RevenueCat identity mismatch');
    const user = await ctx.db.get(args.userId);
    if (!user) return 'pending' as const;
    const previous = await ctx.db
      .query('coachBillingEntitlementsV1')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .unique();
    const now = Date.now();
    const stale = previous && args.snapshot.providerCheckedAt < previous.providerCheckedAt;
    await ctx.db.insert('coachBillingChecksV1', {
      userId: args.userId,
      reason: args.reason,
      eventId: args.eventId,
      status: stale ? 'stale' : args.snapshot.active ? 'active' : 'inactive',
      providerCheckedAt: args.snapshot.providerCheckedAt,
      checkedAt: now,
    });
    if (stale) return previous.status;
    const active =
      args.snapshot.active && (!args.snapshot.expiresAt || args.snapshot.expiresAt > now);
    const row = {
      revenueCatAppUserId: args.userId,
      status: active ? ('active' as const) : ('inactive' as const),
      source: 'revenuecat_server' as const,
      providerCheckedAt: args.snapshot.providerCheckedAt,
      checkedAt: now,
      expiresAt: args.snapshot.expiresAt,
      productId: args.snapshot.productId,
      lastEventId: args.eventId,
      updatedAt: now,
    };
    if (previous) await ctx.db.patch(previous._id, row);
    else await ctx.db.insert('coachBillingEntitlementsV1', { userId: args.userId, ...row });
    if (user.isPremium !== active) {
      await ctx.db.patch(args.userId, { isPremium: active });
      await ctx.scheduler.runAfter(0, internal.users.syncToEnduranceZoneForUser, {
        userId: args.userId,
        level: active ? 'Basic Plus' : 'Basic',
      });
    }
    const onboarding = await ctx.db
      .query('coachOnboardingV1')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .unique();
    if (onboarding) {
      await ctx.db.patch(onboarding._id, {
        entitlement: active
          ? 'verified'
          : onboarding.entitlement === 'verified'
            ? 'expired'
            : 'unverified',
        entitlementCheckedAt: now,
        updatedAt: now,
      });
      if (active && onboarding.firstPlanRequestId) {
        const request = await ctx.db.get(onboarding.firstPlanRequestId);
        if (
          request?.status === 'ready' &&
          request.day === formatDateInTZ(new Date(), user.timezone)
        )
          await ctx.db.patch(onboarding._id, { stage: 'complete' });
      }
    }
    if (active && args.snapshot.expiresAt) {
      await ctx.scheduler.runAfter(
        Math.max(0, args.snapshot.expiresAt - now + 1),
        internal.revenueCatEntitlements.expireIfDue,
        { userId: args.userId, providerCheckedAt: args.snapshot.providerCheckedAt }
      );
    }
    return active ? ('active' as const) : ('inactive' as const);
  },
});

export const expireIfDue = internalMutation({
  args: { userId: v.id('users'), providerCheckedAt: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query('coachBillingEntitlementsV1')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .unique();
    if (
      !row ||
      row.providerCheckedAt !== args.providerCheckedAt ||
      row.status !== 'active' ||
      !row.expiresAt ||
      row.expiresAt > Date.now()
    )
      return null;
    await ctx.db.patch(row._id, { status: 'inactive', updatedAt: Date.now() });
    const user = await ctx.db.get(args.userId);
    if (user?.isPremium) {
      await ctx.db.patch(args.userId, { isPremium: false });
      await ctx.scheduler.runAfter(0, internal.users.syncToEnduranceZoneForUser, {
        userId: args.userId,
        level: 'Basic',
      });
    }
    const onboarding = await ctx.db
      .query('coachOnboardingV1')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .unique();
    if (onboarding)
      await ctx.db.patch(onboarding._id, {
        entitlement: 'expired',
        entitlementCheckedAt: Date.now(),
        updatedAt: Date.now(),
      });
    await ctx.db.insert('coachBillingChecksV1', {
      userId: args.userId,
      reason: 'expiry',
      status: 'inactive',
      providerCheckedAt: row.providerCheckedAt,
      checkedAt: Date.now(),
    });
    await ctx.scheduler.runAfter(0, internal.revenueCatEntitlements.reconcileFromWebhook, {
      userId: args.userId,
      eventId: 'scheduled-expiry',
      attempt: 0,
    });
    return null;
  },
});

export const recordCheckFailure = internalMutation({
  args: { userId: v.id('users'), reason, eventId: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (await ctx.db.get(args.userId))
      await ctx.db.insert('coachBillingChecksV1', {
        ...args,
        status: 'error',
        checkedAt: Date.now(),
      });
    return null;
  },
});

export const recordWebhookEvent = internalMutation({
  args: {
    eventId: v.string(),
    eventType: v.string(),
    eventAt: v.number(),
    appUserIds: v.array(v.string()),
  },
  returns: v.boolean(),
  handler: async (ctx, event) => {
    const existing = await ctx.db
      .query('coachBillingEventsV1')
      .withIndex('by_event_id', (q) => q.eq('eventId', event.eventId))
      .unique();
    if (existing) return false;
    await ctx.db.insert('coachBillingEventsV1', {
      ...event,
      appUserIds: [],
      receivedAt: Date.now(),
      status: event.appUserIds.length ? 'queued' : 'ignored',
    });
    for (const candidate of event.appUserIds) {
      // Only exact Convex user IDs are accepted; aliases belonging to another account
      // cannot be submitted by a client to claim that account's entitlement.
      const normalized = ctx.db.normalizeId('users', candidate);
      const user = normalized ? await ctx.db.get(normalized) : null;
      if (user)
        await ctx.scheduler.runAfter(0, internal.revenueCatEntitlements.reconcileFromWebhook, {
          userId: user._id,
          eventId: event.eventId,
          attempt: 0,
        });
      if (user)
        await ctx.scheduler.runAfter(60_000, internal.revenueCatEntitlements.reconcileFromWebhook, {
          userId: user._id,
          eventId: event.eventId,
          attempt: 4,
        });
    }
    return true;
  },
});
