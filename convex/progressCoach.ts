import { getAuthUserId } from '@convex-dev/auth/server';
import { ConvexError, v } from 'convex/values';

import { internal } from './_generated/api';
import type { Doc, Id } from './_generated/dataModel';
import {
  internalMutation,
  internalQuery,
  mutation,
  MutationCtx,
  query,
  QueryCtx,
} from './_generated/server';
import { applyCoachPolicy } from './progressCoachPolicy';
import { addDaysToDateKey, formatDateInTZ } from './utils/timezone';
import type {
  CoachContextSummary,
  CoachGenerationProfile,
  CoachProfileValues,
} from '../shared/progressCoach';

const DEFAULT_TIMEZONE = 'UTC';
const MIN_STALE_PLAN_MS = 120_000;
const MAX_GENERATION_ATTEMPTS = 2;
const RECENT_TRACKING_DAYS = 7;

const goalValidator = v.union(
  v.literal('lose_weight'),
  v.literal('maintain_weight_body_recomp'),
  v.literal('improve_fitness')
);
const bodyFeelingValidator = v.union(
  v.literal('feel_good_refining'),
  v.literal('little_insecure'),
  v.literal('quite_insecure')
);
const routineFeelingValidator = v.union(
  v.literal('enjoy_it'),
  v.literal('okay_could_be_better'),
  v.literal('do_not_enjoy'),
  v.literal('no_routine_yet')
);
const foodRelationshipValidator = v.union(
  v.literal('balanced_most_days'),
  v.literal('swing_back_to_old_habits'),
  v.literal('restrict_then_overeat'),
  v.literal('do_not_think_about_it')
);
const usualSleepValidator = v.union(
  v.literal('regular_restful'),
  v.literal('okay_inconsistent'),
  v.literal('poor_often_tired')
);
const biggestStruggleValidator = v.union(
  v.literal('time'),
  v.literal('motivation'),
  v.literal('food'),
  v.literal('something_else')
);
const upcomingEventValidator = v.union(
  v.literal('birthday'),
  v.literal('holiday'),
  v.literal('wedding'),
  v.literal('other'),
  v.literal('none')
);
const lastRealProgressValidator = v.union(
  v.literal('recently'),
  v.literal('a_while_ago'),
  v.literal('cannot_remember'),
  v.literal('never')
);
const profileArgs = {
  currentWeight: v.optional(v.number()),
  weightUnit: v.optional(v.union(v.literal('lb'), v.literal('kg'))),
  goal: goalValidator,
  bodyFeeling: bodyFeelingValidator,
  routineFeeling: routineFeelingValidator,
  foodRelationship: foodRelationshipValidator,
  usualSleep: usualSleepValidator,
  biggestStruggle: biggestStruggleValidator,
  upcomingEvent: upcomingEventValidator,
  lastRealProgress: lastRealProgressValidator,
};

const dailyInputsValidator = v.object({
  sleep: v.union(
    v.literal('barely_rested'),
    v.literal('some_rest'),
    v.literal('rested'),
    v.literal('restored')
  ),
  energy: v.union(v.literal('gentle_day'), v.literal('little_to_give'), v.literal('ready_to_move')),
  mood: v.union(v.literal('low'), v.literal('okay'), v.literal('good'), v.literal('motivated')),
  availableTime: v.union(
    v.literal('wide_open'),
    v.literal('window'),
    v.literal('squeezed'),
    v.literal('one_minute')
  ),
  bodyCondition: v.union(
    v.literal('fine'),
    v.literal('sore_upper'),
    v.literal('sore_lower'),
    v.literal('pain_or_unwell')
  ),
});

const checkInTypeValidator = v.union(
  v.literal('strength'),
  v.literal('cardio'),
  v.literal('core'),
  v.literal('gentle_movement'),
  v.literal('rest')
);
const safetyStateValidator = v.union(
  v.literal('normal'),
  v.literal('reduced'),
  v.literal('pain_or_unwell')
);
const computedTargetsValidator = v.object({
  safetyState: safetyStateValidator,
  mayCallClaude: v.boolean(),
  checkIn: v.object({ type: checkInTypeValidator, durationMinutes: v.number() }),
  nutrition: v.object({
    carbServings: v.union(v.literal(1), v.literal(2)),
    proteinWithMeals: v.literal(true),
    vegetablesWithMeals: v.literal(true),
  }),
  steps: v.object({ target: v.optional(v.number()) }),
  hydration: v.object({ litres: v.number() }),
});
const contextSummaryValidator = v.object({
  usableDays: v.number(),
  averageSteps: v.optional(v.number()),
  averageActiveMinutes: v.optional(v.number()),
  activeDays: v.number(),
});
const outputValidator = v.object({
  headline: v.string(),
  checkIn: v.object({
    type: checkInTypeValidator,
    durationMinutes: v.number(),
    label: v.string(),
  }),
  nutrition: v.object({
    carbServings: v.union(v.literal(1), v.literal(2)),
    message: v.string(),
  }),
  steps: v.object({ target: v.optional(v.number()) }),
  hydration: v.object({ litres: v.number() }),
  why: v.string(),
  safetyNotice: v.optional(v.string()),
});
const errorCodeValidator = v.union(
  v.literal('provider_timeout'),
  v.literal('provider_rate_limited'),
  v.literal('provider_invalid_response'),
  v.literal('provider_unavailable'),
  v.literal('generation_failed')
);

type CoachAccess = {
  userId: Id<'users'>;
  user: Doc<'users'>;
  enabled: boolean;
};

async function getCoachAccess(ctx: QueryCtx | MutationCtx): Promise<CoachAccess> {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new ConvexError('Unauthorized');

  const user = await ctx.db.get(userId);
  if (!user) throw new ConvexError('Unauthorized');

  const flag = await ctx.db
    .query('featureFlags')
    .withIndex('by_user_feature_flag', (q) =>
      q.eq('userId', userId).eq('featureFlag', 'progress_coach')
    )
    .unique();

  return { userId, user, enabled: flag?.enabled === true };
}

function requireCoachEnabled(access: CoachAccess) {
  if (!access.enabled) throw new ConvexError('Progress Coach is not available');
}

function getLocalDate(timezone?: string): string {
  const candidate = timezone || DEFAULT_TIMEZONE;
  try {
    return formatDateInTZ(new Date(), candidate);
  } catch {
    return formatDateInTZ(new Date(), DEFAULT_TIMEZONE);
  }
}

function getPromptVersion(): string {
  return process.env.PROGRESS_COACH_PROMPT_VERSION || 'progress-coach-v1';
}

function getStaleThresholdMs(): number {
  const configuredTimeout = Number(process.env.PROGRESS_COACH_TIMEOUT_MS);
  const safeTimeout =
    Number.isFinite(configuredTimeout) && configuredTimeout > 0 ? configuredTimeout : 60_000;
  return Math.max(safeTimeout * 2, MIN_STALE_PLAN_MS);
}

function profileValues(profile: Doc<'coachProfiles'>): CoachProfileValues {
  return {
    ...(profile.currentWeight === undefined ? {} : { currentWeight: profile.currentWeight }),
    ...(profile.weightUnit === undefined ? {} : { weightUnit: profile.weightUnit }),
    goal: profile.goal,
    bodyFeeling: profile.bodyFeeling,
    routineFeeling: profile.routineFeeling,
    foodRelationship: profile.foodRelationship,
    usualSleep: profile.usualSleep,
    biggestStruggle: profile.biggestStruggle,
    upcomingEvent: profile.upcomingEvent,
    lastRealProgress: profile.lastRealProgress,
  };
}

function profileForGeneration(profile: Doc<'coachProfiles'>): CoachGenerationProfile {
  return {
    goal: profile.goal,
    bodyFeeling: profile.bodyFeeling,
    routineFeeling: profile.routineFeeling,
    foodRelationship: profile.foodRelationship,
    usualSleep: profile.usualSleep,
    biggestStruggle: profile.biggestStruggle,
    lastRealProgress: profile.lastRealProgress,
  };
}

async function loadTrackingSummary(
  ctx: QueryCtx | MutationCtx,
  userId: Id<'users'>,
  today: string
): Promise<CoachContextSummary> {
  const startDate = addDaysToDateKey(today, -RECENT_TRACKING_DAYS);
  const rows = await ctx.db
    .query('trackDaily')
    .withIndex('by_user_date', (q) =>
      q.eq('userId', userId).gte('date', startDate).lt('date', today)
    )
    .collect();

  if (rows.length === 0) return { usableDays: 0, activeDays: 0 };

  return {
    usableDays: rows.length,
    averageSteps: rows.reduce((sum, row) => sum + row.steps, 0) / rows.length,
    averageActiveMinutes: rows.reduce((sum, row) => sum + row.activeMinutes, 0) / rows.length,
    activeDays: rows.filter((row) => row.steps > 0 || row.activeMinutes > 0 || row.moves > 0)
      .length,
  };
}

function clientSafePlan(plan: Doc<'coachDailyPlans'>) {
  return {
    id: plan._id,
    date: plan.date,
    status: plan.status,
    inputs: plan.inputs,
    safetyState: plan.safetyState,
    computedTargets: plan.computedTargets,
    output: plan.output,
    errorCode: plan.errorCode,
    createdAt: plan.createdAt,
    updatedAt: plan.updatedAt,
  };
}

export const getCoachHome = query({
  args: {},
  handler: async (ctx) => {
    const access = await getCoachAccess(ctx);
    if (!access.enabled) return { enabled: false as const, state: 'disabled' as const };

    const profile = await ctx.db
      .query('coachProfiles')
      .withIndex('by_user', (q) => q.eq('userId', access.userId))
      .unique();
    if (!profile) return { enabled: true as const, state: 'needs_profile' as const };

    const date = getLocalDate(access.user.timezone);
    const plan = await ctx.db
      .query('coachDailyPlans')
      .withIndex('by_user_date', (q) => q.eq('userId', access.userId).eq('date', date))
      .unique();

    if (!plan)
      return { enabled: true as const, state: 'ready_to_check_in' as const, localDate: date };

    const state =
      plan.status === 'pending'
        ? 'generating'
        : plan.status === 'ready'
          ? 'plan_ready'
          : plan.status;
    return {
      enabled: true as const,
      state,
      localDate: date,
      plan: { id: plan._id, status: plan.status, updatedAt: plan.updatedAt },
    };
  },
});

export const upsertCoachProfile = mutation({
  args: profileArgs,
  handler: async (ctx, args) => {
    const access = await getCoachAccess(ctx);
    requireCoachEnabled(access);

    if (
      args.currentWeight !== undefined &&
      (!Number.isFinite(args.currentWeight) || args.currentWeight <= 0)
    ) {
      throw new ConvexError('Current weight must be a positive finite number');
    }
    if (args.currentWeight === undefined && args.weightUnit !== undefined) {
      throw new ConvexError('Weight unit requires current weight');
    }
    if (args.currentWeight !== undefined && args.weightUnit === undefined) {
      throw new ConvexError('Current weight requires a weight unit');
    }

    const now = Date.now();
    const existing = await ctx.db
      .query('coachProfiles')
      .withIndex('by_user', (q) => q.eq('userId', access.userId))
      .unique();
    const values = { ...args, updatedAt: now };

    if (existing) {
      await ctx.db.patch(existing._id, {
        ...values,
        profileVersion: existing.profileVersion + 1,
      });
      return {
        profileId: existing._id,
        profileVersion: existing.profileVersion + 1,
        updatedAt: now,
      };
    }

    const profileId = await ctx.db.insert('coachProfiles', {
      userId: access.userId,
      ...values,
      profileVersion: 1,
      createdAt: now,
    });
    return { profileId, profileVersion: 1, updatedAt: now };
  },
});

export const startTodayPlan = mutation({
  args: { inputs: dailyInputsValidator },
  handler: async (ctx, { inputs }) => {
    const access = await getCoachAccess(ctx);
    requireCoachEnabled(access);

    const profile = await ctx.db
      .query('coachProfiles')
      .withIndex('by_user', (q) => q.eq('userId', access.userId))
      .unique();
    if (!profile) throw new ConvexError('Complete the Progress Coach profile first');

    const date = getLocalDate(access.user.timezone);
    const now = Date.now();
    const existing = await ctx.db
      .query('coachDailyPlans')
      .withIndex('by_user_date', (q) => q.eq('userId', access.userId).eq('date', date))
      .unique();

    if (existing) {
      if (
        existing.status === 'ready' ||
        existing.status === 'fallback' ||
        existing.status === 'failed'
      ) {
        return { planId: existing._id, date, status: existing.status, reused: true };
      }
      if (now - existing.startedAt < getStaleThresholdMs()) {
        return { planId: existing._id, date, status: existing.status, reused: true };
      }

      const contextSummary = await loadTrackingSummary(ctx, access.userId, date);
      const policy = applyCoachPolicy({
        profile: profileValues(profile),
        daily: existing.inputs,
        verified: contextSummary,
      });
      const generationAttempt = existing.generationAttempt + 1;

      if (existing.attemptCount >= MAX_GENERATION_ATTEMPTS) {
        await ctx.db.patch(existing._id, {
          status: 'fallback',
          safetyState: policy.computedTargets.safetyState,
          computedTargets: policy.computedTargets,
          contextSummary,
          output: policy.fallback,
          completedAt: now,
          generationAttempt,
          updatedAt: now,
          errorCode: 'generation_failed',
        });
        return {
          planId: existing._id,
          date,
          status: 'fallback' as const,
          reused: true,
        };
      }

      const terminalFallback = policy.computedTargets.mayCallClaude === false;
      await ctx.db.patch(existing._id, {
        status: terminalFallback ? 'fallback' : 'pending',
        safetyState: policy.computedTargets.safetyState,
        computedTargets: policy.computedTargets,
        contextSummary,
        ...(terminalFallback ? { output: policy.fallback, completedAt: now } : {}),
        promptVersion: getPromptVersion(),
        generationAttempt,
        attemptCount: existing.attemptCount + 1,
        startedAt: now,
        updatedAt: now,
        errorCode: undefined,
      });
      if (!terminalFallback) {
        await ctx.scheduler.runAfter(0, internal.progressCoachActions.generateCoachPlan, {
          planId: existing._id,
          generationAttempt,
        });
      }
      return {
        planId: existing._id,
        date,
        status: terminalFallback ? ('fallback' as const) : ('pending' as const),
        reused: true,
      };
    }

    const contextSummary = await loadTrackingSummary(ctx, access.userId, date);
    const policy = applyCoachPolicy({
      profile: profileValues(profile),
      daily: inputs,
      verified: contextSummary,
    });
    const terminalFallback = policy.computedTargets.mayCallClaude === false;

    const planId = await ctx.db.insert('coachDailyPlans', {
      userId: access.userId,
      date,
      inputs,
      status: terminalFallback ? 'fallback' : 'pending',
      safetyState: policy.computedTargets.safetyState,
      computedTargets: policy.computedTargets,
      contextSummary,
      ...(terminalFallback ? { output: policy.fallback, completedAt: now } : {}),
      promptVersion: getPromptVersion(),
      generationAttempt: 1,
      attemptCount: 1,
      startedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    if (!terminalFallback) {
      await ctx.scheduler.runAfter(0, internal.progressCoachActions.generateCoachPlan, {
        planId,
        generationAttempt: 1,
      });
    }

    return {
      planId,
      date,
      status: terminalFallback ? ('fallback' as const) : ('pending' as const),
      reused: false,
    };
  },
});

export const getTodayPlan = query({
  args: {},
  handler: async (ctx) => {
    const access = await getCoachAccess(ctx);
    requireCoachEnabled(access);
    const date = getLocalDate(access.user.timezone);
    const plan = await ctx.db
      .query('coachDailyPlans')
      .withIndex('by_user_date', (q) => q.eq('userId', access.userId).eq('date', date))
      .unique();
    return plan ? clientSafePlan(plan) : null;
  },
});

export const loadCoachContext = internalQuery({
  args: { planId: v.id('coachDailyPlans'), generationAttempt: v.number() },
  handler: async (ctx, args) => {
    const plan = await ctx.db.get(args.planId);
    if (!plan || plan.status !== 'pending' || plan.generationAttempt !== args.generationAttempt) {
      throw new ConvexError('Coach generation is no longer current');
    }
    const profile = await ctx.db
      .query('coachProfiles')
      .withIndex('by_user', (q) => q.eq('userId', plan.userId))
      .unique();
    if (!profile) throw new ConvexError('Coach profile not found');
    if (!plan.computedTargets || !plan.contextSummary) {
      throw new ConvexError('Coach submission snapshot is incomplete');
    }

    return {
      planId: plan._id,
      generationAttempt: plan.generationAttempt,
      date: plan.date,
      inputs: plan.inputs,
      profile: profileForGeneration(profile),
      computedTargets: plan.computedTargets,
      contextSummary: plan.contextSummary,
    };
  },
});

export const saveCoachPlan = internalMutation({
  args: {
    planId: v.id('coachDailyPlans'),
    generationAttempt: v.number(),
    status: v.union(v.literal('ready'), v.literal('fallback'), v.literal('failed')),
    safetyState: safetyStateValidator,
    computedTargets: v.optional(computedTargetsValidator),
    contextSummary: v.optional(contextSummaryValidator),
    output: v.optional(outputValidator),
    provider: v.optional(v.literal('anthropic')),
    model: v.optional(v.string()),
    completedAt: v.optional(v.number()),
    latencyMs: v.optional(v.number()),
    inputTokens: v.optional(v.number()),
    outputTokens: v.optional(v.number()),
    errorCode: v.optional(errorCodeValidator),
  },
  handler: async (ctx, args) => {
    const plan = await ctx.db.get(args.planId);
    if (!plan || plan.status !== 'pending' || plan.generationAttempt !== args.generationAttempt) {
      return { saved: false as const };
    }

    if (
      (args.status === 'ready' || args.status === 'fallback') &&
      (!args.computedTargets ||
        !args.contextSummary ||
        !args.output ||
        args.completedAt === undefined)
    ) {
      throw new ConvexError(
        'A completed coach plan requires targets, context, output, and completedAt'
      );
    }
    for (const tokenCount of [args.inputTokens, args.outputTokens]) {
      if (
        tokenCount !== undefined &&
        (!Number.isFinite(tokenCount) || !Number.isInteger(tokenCount) || tokenCount < 0)
      ) {
        throw new ConvexError('Coach token usage must be a non-negative integer');
      }
    }

    const { planId: _planId, generationAttempt: _attempt, ...patch } = args;
    await ctx.db.patch(plan._id, { ...patch, updatedAt: Date.now() });
    return { saved: true as const };
  },
});
