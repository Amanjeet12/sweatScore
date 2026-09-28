import { getAuthUserId } from '@convex-dev/auth/server';
import { ConvexError, v } from 'convex/values';
import { query } from './_generated/server';
import { formatDateInTZ } from './utils/timezone';
import { resumeDecision } from '../shared/coachResume';
import { canRetryCurrentPlanRequest } from './coachPlanRetry';

export const myDecision = query({
  // Cache-busting refresh is client-owned; the decision still uses server time and member timezone.
  args: { refresh: v.optional(v.number()) },
  returns: v.object({
    screen: v.union(
      v.literal('bio'),
      v.literal('profile'),
      v.literal('health'),
      v.literal('daily'),
      v.literal('paywall'),
      v.literal('today')
    ),
    question: v.number(),
    day: v.string(),
    changedDay: v.boolean(),
    requestStatus: v.union(
      v.literal('none'),
      v.literal('pending'),
      v.literal('ready'),
      v.literal('failed')
    ),
    verifiedAccess: v.boolean(),
    canRetry: v.boolean(),
  }),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError('Authentication required');
    const user = await ctx.db.get(userId);
    if (!user) throw new ConvexError('Member missing');
    const day = formatDateInTZ(new Date(), user.timezone);
    const [state, billing, todayRequest, todayPlan] = await Promise.all([
      ctx.db
        .query('coachOnboardingV1')
        .withIndex('by_user', (q) => q.eq('userId', userId))
        .unique(),
      ctx.db
        .query('coachBillingEntitlementsV1')
        .withIndex('by_user', (q) => q.eq('userId', userId))
        .unique(),
      ctx.db
        .query('coachPlanRequestsV1')
        .withIndex('by_user_day', (q) => q.eq('userId', userId).eq('day', day))
        .order('desc')
        .first(),
      ctx.db
        .query('coachPlanRevisionsV1')
        .withIndex('by_user_day_version', (q) => q.eq('userId', userId).eq('day', day))
        .order('desc')
        .first(),
    ]);
    const previous = state?.firstPlanRequestId ? await ctx.db.get(state.firstPlanRequestId) : null;
    const verifiedAccess = Boolean(
      user.isAdmin ||
      (billing?.status === 'active' && (!billing.expiresAt || billing.expiresAt > Date.now()))
    );
    const decided = resumeDecision({
      hasBio: Boolean(user.name?.trim() && user.birthdate),
      hasProfile: Boolean(state?.profileRevisionId),
      hasHealthContinuation: Boolean(state?.healthContinuation),
      verifiedAccess,
      previouslyVerified: state?.entitlement === 'expired',
      profileDraft: state?.profileDraft,
      dailyDraft: state?.dailyDraftDay === day ? state.dailyDraft : undefined,
      hasTodayRequest: Boolean(todayRequest),
      hasTodayPlan: Boolean(todayPlan),
      requestStatus: todayRequest?.status,
      changedDay: Boolean(previous && previous.day !== day),
    });
    return {
      ...decided,
      day,
      verifiedAccess,
      canRetry: !todayPlan && canRetryCurrentPlanRequest(todayRequest),
    };
  },
});
