import { getAuthUserId } from '@convex-dev/auth/server';
import { ConvexError, v } from 'convex/values';
import { api, internal } from './_generated/api';
import { Doc, Id } from './_generated/dataModel';
import {
  action,
  internalAction,
  internalMutation,
  mutation,
  query,
  MutationCtx,
  QueryCtx,
} from './_generated/server';
import {
  profileAnswers,
  weightAnswer,
  planOutput,
  planOutputV2,
  dailyAnswers,
} from './coachFoundationValidators';
import { DAILY_PLAN_PROMPT_VERSION } from './coachDailyPrompt';
import { DAILY_PLAN_V2_PROMPT_VERSION } from './coachDailyPromptV2';
import { buildDailyProviderInput, dailyPolicy, validateDailyPlanOutput } from './coachDailyPolicy';
import {
  validateDailyPlanOutputV2,
  workoutRecommendationV2,
  stepsRecommendationV2,
} from './coachDailyPolicyV2';
import type { DailyDetailsV2 } from './coachDailyPolicyV2';
import type { ValidatedPlan } from './coachDailyPolicy';
import { generateDailyPlan, providerConfig } from './coachDailyProvider';
import { generateV2WithRepair } from './coachDailyRepair';
import { assignmentLabel, assertRequestKey, DEFAULT_COACH_TONE } from '../shared/coachFoundation';
import { canRetryCurrentPlanRequest } from './coachPlanRetry';
import { formatDateInTZ } from './utils/timezone';

const CLAIM_LEASE_MS = 60_000;

async function member(ctx: MutationCtx | QueryCtx): Promise<Id<'users'>> {
  const userId = await getAuthUserId(ctx);
  if (!userId || !(await ctx.db.get(userId))) throw new ConvexError('Authentication required');
  return userId;
}

export const currentReadyPlan = query({
  args: {},
  returns: v.object({
    day: v.string(),
    revisionId: v.union(v.id('coachPlanRevisionsV1'), v.null()),
  }),
  handler: async (ctx) => {
    const userId = await member(ctx);
    const user = await ctx.db.get(userId);
    const day = formatDateInTZ(new Date(), user?.timezone);
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
      user?.isAdmin ||
      (billing?.status === 'active' && (!billing.expiresAt || billing.expiresAt > Date.now()))
    );
    return { day, revisionId: access ? (revision?._id ?? null) : null };
  },
});

// Only explicit final-question submission uses this entry point. It returns after queueing,
// allowing the paywall to open while the provider works asynchronously.
export const submitDailyAnswersAndGenerate = action({
  args: { requestKey: v.string(), body: dailyAnswers.fields.body },
  returns: v.id('coachPlanRequestsV1'),
  handler: async (ctx, { requestKey, body }): Promise<Id<'coachPlanRequestsV1'>> => {
    assertRequestKey(requestKey);
    return ctx.runMutation(api.coachFoundation.finishDailyAndReserveFirst, { requestKey, body });
  },
});

// A profile save without today's ready plan stops after persisting the new revision.
export const saveProfileAndMaybeRefresh = action({
  args: {
    answers: profileAnswers,
    weight: weightAnswer,
    observedAt: v.optional(v.number()),
    expectedVersion: v.number(),
    requestKey: v.string(),
  },
  returns: v.object({
    profileRevisionId: v.id('coachProfileRevisionsV1'),
    requestId: v.union(v.id('coachPlanRequestsV1'), v.null()),
  }),
  handler: async (
    ctx,
    args
  ): Promise<{
    profileRevisionId: Id<'coachProfileRevisionsV1'>;
    requestId: Id<'coachPlanRequestsV1'> | null;
  }> => {
    assertRequestKey(args.requestKey);
    const profileRevisionId = await ctx.runMutation(api.coachFoundation.updateProfileRevision, {
      answers: args.answers,
      weight: args.weight,
      observedAt: args.observedAt,
      expectedVersion: args.expectedVersion,
    });
    const current = await ctx.runQuery(api.coachDailyService.currentReadyPlan, {});
    const foundation = await ctx.runQuery(api.coachFoundation.getMyFoundation, {});
    if (!current.revisionId || foundation.state?.entitlement !== 'verified')
      return { profileRevisionId, requestId: null };
    const requestId = await ctx.runMutation(api.coachFoundation.reserveLaterPlan, {
      kind: 'profile_refresh',
      requestKey: args.requestKey,
    });
    await ctx.runMutation(internal.coachDailyService.enqueue, { requestId });
    return { profileRevisionId, requestId };
  },
});

export const retryFailedPlan = mutation({
  args: { failedRequestId: v.optional(v.id('coachPlanRequestsV1')), requestKey: v.string() },
  returns: v.id('coachPlanRequestsV1'),
  handler: async (ctx, args) => {
    const userId = await member(ctx);
    assertRequestKey(args.requestKey);
    const user = await ctx.db.get(userId);
    const day = formatDateInTZ(new Date(), user?.timezone);
    const latest = await ctx.db
      .query('coachPlanRequestsV1')
      .withIndex('by_user_day', (q) => q.eq('userId', userId).eq('day', day))
      .order('desc')
      .first();
    const previous = args.failedRequestId ? await ctx.db.get(args.failedRequestId) : latest;
    const occupied = await ctx.db
      .query('coachPlanRequestsV1')
      .withIndex('by_user_day_key', (q) =>
        q.eq('userId', userId).eq('day', day).eq('requestKey', args.requestKey)
      )
      .unique();
    if (occupied && occupied.kind === 'retry' && occupied.retryOfRequestId === previous?._id)
      return occupied._id;
    if (
      !previous ||
      previous.userId !== userId ||
      previous.day !== day ||
      !canRetryCurrentPlanRequest(previous)
    )
      throw new ConvexError('No retryable failed request');
    if (latest?._id !== previous._id) {
      const existingRetry = await ctx.db
        .query('coachPlanRequestsV1')
        .withIndex('by_user_day_kind', (q) =>
          q.eq('userId', userId).eq('day', day).eq('kind', 'retry')
        )
        .collect();
      const same = existingRetry.find((item) => item.retryOfRequestId === previous._id);
      if (same) return same._id;
      throw new ConvexError('A newer plan request exists');
    }
    if (occupied) throw new ConvexError('Request key already used');
    const now = Date.now();
    const requestId = await ctx.db.insert('coachPlanRequestsV1', {
      userId,
      day,
      requestKey: args.requestKey,
      kind: 'retry',
      retryOfRequestId: previous._id,
      profileRevisionId: previous.profileRevisionId,
      dailyAnswerId: previous.dailyAnswerId,
      inputSnapshot: previous.inputSnapshot,
      promptVersion: previous.promptVersion,
      toneVersion: previous.toneVersion,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
      queuedAt: now,
    });
    await ctx.scheduler.runAfter(0, internal.coachDailyService.generateReserved, { requestId });
    return requestId;
  },
});

export const enqueue = internalMutation({
  args: { requestId: v.id('coachPlanRequestsV1') },
  returns: v.boolean(),
  handler: async (ctx, { requestId }) => {
    const request = await ctx.db.get(requestId);
    if (!request || request.status !== 'pending') return false;
    const now = Date.now();
    if (request.queuedAt && now - request.queuedAt < CLAIM_LEASE_MS) return true;
    await ctx.db.patch(requestId, { queuedAt: now });
    await ctx.scheduler.runAfter(0, internal.coachDailyService.generateReserved, { requestId });
    return true;
  },
});

export const claim = internalMutation({
  args: { requestId: v.id('coachPlanRequestsV1') },
  returns: v.any(),
  handler: async (ctx, { requestId }) => {
    const request = await ctx.db.get(requestId);
    if (!request || request.status !== 'pending') return null;
    if (
      ![DAILY_PLAN_PROMPT_VERSION, DAILY_PLAN_V2_PROMPT_VERSION].includes(request.promptVersion)
    ) {
      await ctx.db.patch(requestId, {
        status: 'failed',
        errorCode: 'generation_failed',
        updatedAt: Date.now(),
      });
      return null;
    }
    const latest = await ctx.db
      .query('coachPlanRequestsV1')
      .withIndex('by_user_day', (q) => q.eq('userId', request.userId).eq('day', request.day))
      .order('desc')
      .first();
    if (latest?._id !== requestId) {
      await ctx.db.patch(requestId, {
        status: 'failed',
        errorCode: 'superseded',
        updatedAt: Date.now(),
      });
      return null;
    }
    const now = Date.now();
    if (request.dispatchedAt && now - request.dispatchedAt < CLAIM_LEASE_MS) return null;
    const generationAttempt = (request.generationAttempt ?? 0) + 1;
    await ctx.db.patch(requestId, { generationAttempt, dispatchedAt: now, updatedAt: now });
    const plans: { day: string; output: Doc<'coachPlanRevisionsV1'>['output'] }[] = [];
    for (const revisionId of request.inputSnapshot.recentPlanRevisionIds) {
      const revision = await ctx.db.get(revisionId);
      if (!revision || revision.userId !== request.userId || revision.day >= request.day) {
        await ctx.db.patch(requestId, {
          status: 'failed',
          errorCode: 'generation_failed',
          updatedAt: Date.now(),
        });
        return null;
      }
      plans.push({ day: revision.day, output: revision.output });
    }
    const setting = await ctx.db
      .query('coachToneSettingsV1')
      .withIndex('by_version', (q) => q.eq('version', request.toneVersion))
      .unique();
    if (!setting && request.toneVersion !== 1) {
      await ctx.db.patch(requestId, {
        status: 'failed',
        errorCode: 'generation_failed',
        updatedAt: Date.now(),
      });
      return null;
    }
    const selected = setting && setting.scope !== 'meal_feedback' ? setting : DEFAULT_COACH_TONE;
    return {
      requestId,
      generationAttempt,
      promptVersion: request.promptVersion,
      day: request.day,
      snapshot: request.inputSnapshot,
      recentPlans: plans,
      style: { tone: selected.tone, detail: selected.detail },
    };
  },
});

export const finish = internalMutation({
  args: {
    requestId: v.id('coachPlanRequestsV1'),
    generationAttempt: v.number(),
    result: v.union(
      v.object({
        ok: v.literal(true),
        output: v.union(planOutput, planOutputV2),
        model: v.string(),
        latencyMs: v.number(),
        inputTokens: v.optional(v.number()),
        outputTokens: v.optional(v.number()),
      }),
      v.object({
        ok: v.literal(false),
        code: v.union(
          v.literal('provider_timeout'),
          v.literal('provider_rate_limited'),
          v.literal('provider_unavailable'),
          v.literal('invalid_output'),
          v.literal('generation_failed'),
          v.literal('policy_unresolved')
        ),
        latencyMs: v.number(),
        model: v.optional(v.string()),
      })
    ),
  },
  returns: v.union(
    v.object({ status: v.literal('ignored') }),
    v.object({ status: v.literal('failed') }),
    v.object({ status: v.literal('ready'), revisionId: v.id('coachPlanRevisionsV1') })
  ),
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.requestId);
    if (
      !request ||
      request.status !== 'pending' ||
      request.generationAttempt !== args.generationAttempt
    )
      return { status: 'ignored' as const };
    const latest = await ctx.db
      .query('coachPlanRequestsV1')
      .withIndex('by_user_day', (q) => q.eq('userId', request.userId).eq('day', request.day))
      .order('desc')
      .first();
    if (latest?._id !== request._id) {
      await ctx.db.patch(request._id, {
        status: 'failed',
        errorCode: 'superseded',
        updatedAt: Date.now(),
      });
      return { status: 'ignored' as const };
    }
    const now = Date.now();
    if (!args.result.ok) {
      await ctx.db.patch(request._id, {
        status: 'failed',
        errorCode: args.result.code,
        validationStage: args.result.code === 'invalid_output' ? 'provider_format' : undefined,
        provider: args.result.model ? 'anthropic' : undefined,
        model: args.result.model,
        latencyMs: args.result.latencyMs,
        completedAt: now,
        updatedAt: now,
      });
      return { status: 'failed' as const };
    }
    let parsed: ValidatedPlan & { detailsV2?: DailyDetailsV2 };
    const recentPlans: { day: string; output: Doc<'coachPlanRevisionsV1'>['output'] }[] = [];
    for (const revisionId of request.inputSnapshot.recentPlanRevisionIds) {
      const revision = await ctx.db.get(revisionId);
      if (!revision || revision.userId !== request.userId || revision.day >= request.day) {
        await ctx.db.patch(request._id, {
          status: 'failed',
          errorCode: 'generation_failed',
          updatedAt: now,
        });
        return { status: 'failed' as const };
      }
      recentPlans.push({ day: revision.day, output: revision.output });
    }
    try {
      parsed =
        request.promptVersion === DAILY_PLAN_V2_PROMPT_VERSION
          ? validateDailyPlanOutputV2(
              args.result.output,
              request.inputSnapshot,
              request.day,
              recentPlans
            )
          : validateDailyPlanOutput(
              args.result.output,
              request.inputSnapshot,
              request.day,
              recentPlans
            );
    } catch (error) {
      await ctx.db.patch(request._id, {
        status: 'failed',
        errorCode:
          error instanceof Error && error.message === 'policy_unresolved'
            ? 'policy_unresolved'
            : 'invalid_output',
        validationStage:
          error instanceof Error && error.message === 'policy_unresolved'
            ? undefined
            : 'plan_validation',
        provider: 'anthropic',
        model: args.result.model,
        latencyMs: args.result.latencyMs,
        completedAt: now,
        updatedAt: now,
      });
      return { status: 'failed' as const };
    }
    const previous = await ctx.db
      .query('coachPlanRevisionsV1')
      .withIndex('by_user_day_version', (q) =>
        q.eq('userId', request.userId).eq('day', request.day)
      )
      .order('desc')
      .first();
    const revisionId = await ctx.db.insert('coachPlanRevisionsV1', {
      userId: request.userId,
      day: request.day,
      version: (previous?.version ?? 0) + 1,
      requestId: request._id,
      output: parsed.output,
      detailsV2: parsed.detailsV2,
      workout: parsed.workout,
      stepTarget: parsed.stepTarget,
      sleepTargetHours: 7,
      promptVersion: request.promptVersion,
      toneVersion: request.toneVersion,
      createdAt: now,
    });
    const choices = [
      {
        category: 'workout' as const,
        recommendation: parsed.detailsV2
          ? workoutRecommendationV2(parsed.output, parsed.detailsV2, parsed.workout.type === 'rest')
          : parsed.output.workout,
        label: assignmentLabel(
          parsed.output.workout,
          parsed.workout.type,
          parsed.workout.durationMinutes
        ),
        workout: parsed.workout,
      },
      { category: 'meals' as const, recommendation: parsed.output.meals, label: 'Log a meal' },
      {
        category: 'sleep' as const,
        recommendation: parsed.output.sleep,
        label: 'Log your sleep',
        sleepTargetHours: 7 as const,
      },
      {
        category: 'steps' as const,
        recommendation: parsed.detailsV2
          ? stepsRecommendationV2(parsed.output, parsed.detailsV2)
          : parsed.output.steps,
        label: `${parsed.stepTarget.toLocaleString('en-US')} steps`,
        stepTarget: parsed.stepTarget,
      },
    ];
    for (const choice of choices)
      await ctx.db.insert('coachAssignmentsV1', {
        userId: request.userId,
        day: request.day,
        planRevisionId: revisionId,
        createdAt: now,
        detailsV2: parsed.detailsV2,
        ...choice,
      });
    await ctx.db.patch(request._id, {
      status: 'ready',
      provider: 'anthropic',
      model: args.result.model,
      latencyMs: args.result.latencyMs,
      inputTokens: args.result.inputTokens,
      outputTokens: args.result.outputTokens,
      completedAt: now,
      updatedAt: now,
    });
    return { status: 'ready' as const, revisionId };
  },
});

export const generateReserved = internalAction({
  args: { requestId: v.id('coachPlanRequestsV1') },
  returns: v.object({
    status: v.union(v.literal('ready'), v.literal('failed'), v.literal('ignored')),
  }),
  handler: async (ctx, { requestId }): Promise<{ status: 'ready' | 'failed' | 'ignored' }> => {
    const claimed = await ctx.runMutation(internal.coachDailyService.claim, { requestId });
    if (!claimed) return { status: 'ignored' };
    const policy = dailyPolicy(claimed.snapshot, claimed.day);
    if (policy.unresolved) {
      const outcome = await ctx.runMutation(internal.coachDailyService.finish, {
        requestId,
        generationAttempt: claimed.generationAttempt,
        result: { ok: false, code: 'policy_unresolved', latencyMs: 0 },
      });
      return { status: outcome.status };
    }
    const config = providerConfig(claimed.promptVersion);
    const input = {
      ...buildDailyProviderInput(claimed.snapshot, claimed.day, claimed.recentPlans),
      ...(claimed.promptVersion === DAILY_PLAN_V2_PROMPT_VERSION
        ? { recorded_meals: claimed.snapshot.mealHistory ?? [] }
        : {}),
    };
    const call = (retryGuidance?: {
      previousCandidate?:
        | import('./coachDailyPolicy').DailyOutput
        | import('./coachDailyPolicyV2').DailyOutputV2;
    }) =>
      generateDailyPlan({
        config,
        input,
        style: claimed.style,
        promptVersion: claimed.promptVersion,
        retryGuidance,
      });
    const result =
      claimed.promptVersion === DAILY_PLAN_V2_PROMPT_VERSION
        ? await generateV2WithRepair({
            call,
            snapshot: claimed.snapshot,
            day: claimed.day,
            recentPlans: claimed.recentPlans,
          })
        : await call();
    const outcome = await ctx.runMutation(internal.coachDailyService.finish, {
      requestId,
      generationAttempt: claimed.generationAttempt,
      result: result.ok
        ? {
            ok: true,
            output: result.output,
            model: config!.model,
            latencyMs: result.latencyMs,
            inputTokens: result.inputTokens,
            outputTokens: result.outputTokens,
          }
        : { ok: false, code: result.code, latencyMs: result.latencyMs, model: config?.model },
    });
    return { status: outcome.status };
  },
});
