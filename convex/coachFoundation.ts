import { getAuthUserId } from '@convex-dev/auth/server';
import { ConvexError, v } from 'convex/values';
import { mutation, internalMutation, query, MutationCtx, QueryCtx } from './_generated/server';
import { Doc, Id } from './_generated/dataModel';
import {
  dailyAnswers,
  profileAnswers,
  weightAnswer,
  planOutput,
  planDetailsV2,
  workoutMetadata,
  tone,
  detail,
  toneScope,
} from './coachFoundationValidators';
import {
  assertDay,
  assertRequestKey,
  assignmentLabel,
  rewardSlotKey,
  DEFAULT_COACH_TONE,
} from '../shared/coachFoundation';
import { addDaysToDateKey, formatDateInTZ } from './utils/timezone';
import { DAILY_PLAN_V2_1_PROMPT_VERSION, isV2DailyPrompt } from './coachDailyPromptV2_1';
import { validateDailyPlanOutput } from './coachDailyPolicy';
import {
  validateDailyPlanOutputV2,
  workoutRecommendationV2,
  stepsRecommendationV2,
} from './coachDailyPolicyV2';
import { internal } from './_generated/api';

const profileDraftFields = {
  weight: v.optional(weightAnswer),
  goal: v.optional(profileAnswers.fields.goal),
  bodyFeeling: v.optional(profileAnswers.fields.bodyFeeling),
  routineFeeling: v.optional(profileAnswers.fields.routineFeeling),
  foodRelationship: v.optional(profileAnswers.fields.foodRelationship),
  usualSleep: v.optional(profileAnswers.fields.usualSleep),
  biggestChallenge: v.optional(profileAnswers.fields.biggestChallenge),
};
const dailyDraftFields = {
  sleep: v.optional(dailyAnswers.fields.sleep),
  energy: v.optional(dailyAnswers.fields.energy),
  mood: v.optional(dailyAnswers.fields.mood),
  upFor: v.optional(dailyAnswers.fields.upFor),
  body: v.optional(dailyAnswers.fields.body),
};

async function member(ctx: MutationCtx | QueryCtx): Promise<Id<'users'>> {
  const id = await getAuthUserId(ctx);
  if (!id || !(await ctx.db.get(id))) throw new ConvexError('Authentication required');
  return id;
}
async function progress(ctx: MutationCtx | QueryCtx, userId: Id<'users'>) {
  return ctx.db
    .query('coachOnboardingV1')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .unique();
}
async function hasVerifiedPremium(ctx: MutationCtx | QueryCtx, userId: Id<'users'>) {
  const user = await ctx.db.get(userId);
  if (user?.isAdmin) return true;
  const billing = await ctx.db
    .query('coachBillingEntitlementsV1')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .unique();
  return billing?.status === 'active' && (!billing.expiresAt || billing.expiresAt > Date.now());
}
async function getOrCreateProgress(ctx: MutationCtx, userId: Id<'users'>) {
  const existing = await progress(ctx, userId);
  if (existing) return existing;
  const user = await ctx.db.get(userId);
  const billing = await ctx.db
    .query('coachBillingEntitlementsV1')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .unique();
  const active = billing
    ? billing.status === 'active' && (!billing.expiresAt || billing.expiresAt > Date.now())
    : Boolean(user?.isPremium);
  const now = Date.now();
  const id = await ctx.db.insert('coachOnboardingV1', {
    userId,
    stage: 'profile',
    entitlement: active || user?.isAdmin ? 'verified' : 'unverified',
    createdAt: now,
    updatedAt: now,
  });
  return (await ctx.db.get(id))!;
}
async function localDay(ctx: MutationCtx | QueryCtx, userId: Id<'users'>) {
  const user = await ctx.db.get(userId);
  return formatDateInTZ(new Date(), user?.timezone);
}
function completeProfile(draft: Doc<'coachOnboardingV1'>['profileDraft']) {
  if (
    !draft?.weight ||
    !draft.goal ||
    !draft.bodyFeeling ||
    !draft.routineFeeling ||
    !draft.foodRelationship ||
    !draft.usualSleep ||
    !draft.biggestChallenge
  ) {
    throw new ConvexError('Seven profile answers required');
  }
  if (!Number.isFinite(draft.weight.value) || draft.weight.value <= 0)
    throw new ConvexError('Invalid weight');
  return {
    goal: draft.goal,
    bodyFeeling: draft.bodyFeeling,
    routineFeeling: draft.routineFeeling,
    foodRelationship: draft.foodRelationship,
    usualSleep: draft.usualSleep,
    biggestChallenge: draft.biggestChallenge,
  };
}
function completeDaily(draft: Doc<'coachOnboardingV1'>['dailyDraft']) {
  if (!draft?.sleep || !draft.energy || !draft.mood || !draft.upFor || !draft.body) {
    throw new ConvexError('Five daily answers required');
  }
  return {
    sleep: draft.sleep,
    energy: draft.energy,
    mood: draft.mood,
    upFor: draft.upFor,
    body: draft.body,
  };
}

async function planSnapshot(
  ctx: MutationCtx,
  userId: Id<'users'>,
  day: string,
  profile: Doc<'coachProfileRevisionsV1'>,
  daily: Doc<'coachDailyAnswersV1'>
) {
  const weight = await ctx.db.get(profile.weightObservationId);
  if (!weight || weight.userId !== userId) throw new ConvexError('Weight does not match member');
  const fromDay = addDaysToDateKey(day, -7);
  const nextDay = addDaysToDateKey(day, 1);
  const [activities, weightHistory, recentPlans, lifetime, sharedMeals] = await Promise.all([
    ctx.db
      .query('dailyActivities')
      .withIndex('by_user_date', (q) => q.eq('userId', userId).gte('date', fromDay).lt('date', day))
      .collect(),
    ctx.db
      .query('coachWeightObservationsV1')
      .withIndex('by_user_version', (q) => q.eq('userId', userId))
      .collect(),
    ctx.db
      .query('coachPlanRevisionsV1')
      .withIndex('by_user_day_version', (q) =>
        q.eq('userId', userId).gte('day', fromDay).lt('day', day)
      )
      .collect(),
    ctx.db
      .query('trackLifetime')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .unique(),
    ctx.db
      .query('coachMealDraftsV1')
      .withIndex('by_user_day', (q) =>
        q.eq('userId', userId).gte('day', fromDay).lt('day', nextDay)
      )
      .collect(),
  ]);
  const stepsByDay = new Map<string, number>();
  for (const activity of activities) {
    if (activity.synced && Number.isFinite(activity.steps) && activity.steps > 0) {
      stepsByDay.set(activity.date, Math.max(stepsByDay.get(activity.date) ?? 0, activity.steps));
    }
  }
  const steps = [...stepsByDay].map(([day, count]) => ({
    day,
    count,
    source: 'health_sync' as const,
    coverage: 'sensor_observed' as const,
  }));
  const workouts: { day: string; label: string; source: 'activity_log' | 'check_in_completion' }[] =
    activities
      .filter(
        (a) =>
          (a.loggedActivityKey === 'gym_workout' || a.loggedActivityKey === 'workout') &&
          a.reviewStatus !== 'rejected'
      )
      .map((a) => ({ day: a.date, label: a.loggedActivityKey!, source: 'activity_log' as const }));
  // Legacy check-in categories are not yet reconciled to workout proof. Do not
  // count a generic/aliased check-in as completed training in provider context.
  return {
    profile: profile.answers,
    weight: weight.weight,
    weightHistory: weightHistory.map((item) => ({
      value: item.weight.value,
      unit: item.weight.unit,
      observedAt: item.observedAt,
      source: item.source,
    })),
    daily: daily.answers,
    health: {
      steps,
      workouts,
      stepAverage:
        steps.length >= 3
          ? Math.round(steps.reduce((sum, item) => sum + item.count, 0) / steps.length)
          : undefined,
      streak: lifetime?.currentWeeklyStreak,
    },
    recentPlanRevisionIds: [...new Map(recentPlans.map((item) => [item.day, item._id])).values()],
    mealHistory: sharedMeals
      .filter((item) => item.status === 'shared' && item.caption.trim())
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 3)
      .map((item) => ({
        day: item.day,
        caption: item.caption.trim().slice(0, 240),
        source: 'shared_member_caption' as const,
      })),
  };
}

// Development-only scenario testing for the signed-in member. Do not delete proof or rewards.
async function todayResetInventory(ctx: QueryCtx | MutationCtx, userId: Id<'users'>) {
  const day = await localDay(ctx, userId);
  const [requests, revisions, assignments, answers, proofs, slots, meals, scans] =
    await Promise.all([
      ctx.db
        .query('coachPlanRequestsV1')
        .withIndex('by_user_day', (q) => q.eq('userId', userId).eq('day', day))
        .take(101),
      ctx.db
        .query('coachPlanRevisionsV1')
        .withIndex('by_user_day_version', (q) => q.eq('userId', userId).eq('day', day))
        .take(101),
      ctx.db
        .query('coachAssignmentsV1')
        .withIndex('by_user_day', (q) => q.eq('userId', userId).eq('day', day))
        .take(101),
      ctx.db
        .query('coachDailyAnswersV1')
        .withIndex('by_user_day_version', (q) => q.eq('userId', userId).eq('day', day))
        .take(101),
      ctx.db
        .query('coachProofSubmissionsV1')
        .withIndex('by_user_day', (q) => q.eq('userId', userId).eq('day', day))
        .take(101),
      ctx.db
        .query('coachRewardSlotsV1')
        .withIndex('by_user_day', (q) => q.eq('userId', userId).eq('day', day))
        .take(101),
      ctx.db
        .query('coachMealDraftsV1')
        .withIndex('by_user_day', (q) => q.eq('userId', userId).eq('day', day))
        .take(101),
      ctx.db
        .query('coachMealScansV1')
        .withIndex('by_user_day', (q) => q.eq('userId', userId).eq('day', day))
        .take(101),
    ]);
  const tooMany = [requests, revisions, assignments, answers, proofs, slots, meals, scans].some(
    (rows) => rows.length > 100
  );
  const reason = tooMany
    ? 'Too many records to reset safely'
    : requests.some((item) => item.status === 'pending')
      ? 'Wait for plan generation to finish before resetting'
      : proofs.length || slots.length || meals.length || scans.length
        ? 'Today has check-in or reward records and cannot be reset safely'
        : !requests.length && !revisions.length && !assignments.length && !answers.length
          ? 'There is no plan or daily answers to reset today'
          : null;
  return { day, requests, revisions, assignments, answers, reason };
}

export const canResetMyTodayPlanForTesting = query({
  args: {},
  returns: v.object({ available: v.boolean(), reason: v.optional(v.string()) }),
  handler: async (ctx) => {
    const userId = await member(ctx);
    if (process.env.CONVEX_CLOUD_URL !== 'https://beloved-stoat-88.convex.cloud')
      return { available: false, reason: 'Available only on the development deployment.' };
    const inventory = await todayResetInventory(ctx, userId);
    return { available: !inventory.reason, reason: inventory.reason ?? undefined };
  },
});

export const resetMyTodayPlanForTesting = mutation({
  args: {},
  returns: v.object({ day: v.string(), plansDeleted: v.number() }),
  handler: async (ctx) => {
    const userId = await member(ctx);
    if (process.env.CONVEX_CLOUD_URL !== 'https://beloved-stoat-88.convex.cloud')
      throw new ConvexError('Plan reset is available only on the development deployment');
    const { day, requests, revisions, assignments, answers, reason } = await todayResetInventory(
      ctx,
      userId
    );
    if (reason) throw new ConvexError(reason);
    for (const item of assignments) await ctx.db.delete(item._id);
    for (const item of revisions) await ctx.db.delete(item._id);
    for (const item of requests) await ctx.db.delete(item._id);
    for (const item of answers) await ctx.db.delete(item._id);
    const state = await progress(ctx, userId);
    if (state)
      await ctx.db.patch(state._id, {
        stage: 'daily',
        dailyDraft: {},
        dailyDraftDay: day,
        dailyAnswerId: undefined,
        firstPlanRequestId: undefined,
        updatedAt: Date.now(),
      });
    return { day, plansDeleted: revisions.length };
  },
});

// A protected proof/meal cannot be deleted with its plan. This development-only
// path records fresh daily answers and a later revision while retaining the
// original recommendation, media, scan ledger, and stable reward slots.
export const beginMyTodayReanswerForTesting = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await member(ctx);
    if (process.env.CONVEX_CLOUD_URL !== 'https://beloved-stoat-88.convex.cloud')
      throw new ConvexError('Daily re-answer is available only on the development deployment');
    if (!(await hasVerifiedPremium(ctx, userId))) throw new ConvexError('Verified access required');
    const day = await localDay(ctx, userId);
    const state = await progress(ctx, userId);
    if (!state?.profileRevisionId) throw new ConvexError('Coach profile required');
    const latestPlan = await ctx.db
      .query('coachPlanRevisionsV1')
      .withIndex('by_user_day_version', (q) => q.eq('userId', userId).eq('day', day))
      .order('desc')
      .first();
    if (!latestPlan) throw new ConvexError('A ready plan is required to re-answer today');
    const latestRequest = await ctx.db
      .query('coachPlanRequestsV1')
      .withIndex('by_user_day', (q) => q.eq('userId', userId).eq('day', day))
      .order('desc')
      .first();
    if (latestRequest?.status === 'pending')
      throw new ConvexError('Wait for the current plan request to finish');
    if (state.testReanswerDay === day && state.testReanswerKey) {
      const existing = await ctx.db
        .query('coachPlanRequestsV1')
        .withIndex('by_user_day_key', (q) =>
          q.eq('userId', userId).eq('day', day).eq('requestKey', state.testReanswerKey!)
        )
        .unique();
      if (!existing) return { day, requestKey: state.testReanswerKey };
    }
    const requestKey = `reanswer_${day.replaceAll('-', '')}_${crypto.randomUUID().replaceAll('-', '')}`;
    await ctx.db.patch(state._id, {
      testReanswerDay: day,
      testReanswerKey: requestKey,
      testReanswerDraft: {},
      updatedAt: Date.now(),
    });
    return { day, requestKey };
  },
});

export const saveMyTodayReanswerDraftForTesting = mutation({
  args: dailyDraftFields,
  handler: async (ctx, args) => {
    const userId = await member(ctx);
    if (process.env.CONVEX_CLOUD_URL !== 'https://beloved-stoat-88.convex.cloud')
      throw new ConvexError('Daily re-answer is available only on the development deployment');
    if (!(await hasVerifiedPremium(ctx, userId))) throw new ConvexError('Verified access required');
    const state = await progress(ctx, userId);
    const day = await localDay(ctx, userId);
    if (!state?.testReanswerKey || state.testReanswerDay !== day)
      throw new ConvexError('Start a new daily re-answer first');
    const existing = await ctx.db
      .query('coachPlanRequestsV1')
      .withIndex('by_user_day_key', (q) =>
        q.eq('userId', userId).eq('day', day).eq('requestKey', state.testReanswerKey!)
      )
      .unique();
    if (existing) throw new ConvexError('These answers are already reserved');
    const fields = Object.fromEntries(
      Object.entries(args).filter(([, value]) => value !== undefined)
    );
    await ctx.db.patch(state._id, {
      testReanswerDraft: { ...state.testReanswerDraft, ...fields },
      updatedAt: Date.now(),
    });
    return { day };
  },
});

export const finishMyTodayReanswerForTesting = mutation({
  args: { body: dailyAnswers.fields.body },
  returns: v.id('coachPlanRequestsV1'),
  handler: async (ctx, { body }) => {
    const userId = await member(ctx);
    if (process.env.CONVEX_CLOUD_URL !== 'https://beloved-stoat-88.convex.cloud')
      throw new ConvexError('Daily re-answer is available only on the development deployment');
    if (!(await hasVerifiedPremium(ctx, userId))) throw new ConvexError('Verified access required');
    const state = await progress(ctx, userId);
    const day = await localDay(ctx, userId);
    if (!state?.testReanswerKey || state.testReanswerDay !== day || !state.profileRevisionId)
      throw new ConvexError('Start a new daily re-answer first');
    const existing = await ctx.db
      .query('coachPlanRequestsV1')
      .withIndex('by_user_day_key', (q) =>
        q.eq('userId', userId).eq('day', day).eq('requestKey', state.testReanswerKey!)
      )
      .unique();
    if (existing) return existing._id;
    const latestRequest = await ctx.db
      .query('coachPlanRequestsV1')
      .withIndex('by_user_day', (q) => q.eq('userId', userId).eq('day', day))
      .order('desc')
      .first();
    if (latestRequest?.status === 'pending')
      throw new ConvexError('Wait for the current plan request to finish');
    const previousPlan = await ctx.db
      .query('coachPlanRevisionsV1')
      .withIndex('by_user_day_version', (q) => q.eq('userId', userId).eq('day', day))
      .order('desc')
      .first();
    if (!previousPlan) throw new ConvexError('A ready plan is required to re-answer today');
    const answers = completeDaily({ ...state.testReanswerDraft, body });
    const previousAnswers = await ctx.db
      .get(previousPlan.requestId)
      .then((request) => (request ? ctx.db.get(request.dailyAnswerId) : null));
    if (previousAnswers && JSON.stringify(previousAnswers.answers) === JSON.stringify(answers))
      throw new ConvexError('Change at least one answer to prepare a new plan');
    const profile = await ctx.db.get(state.profileRevisionId);
    if (!profile || profile.userId !== userId) throw new ConvexError('Coach profile missing');
    const latestAnswers = await ctx.db
      .query('coachDailyAnswersV1')
      .withIndex('by_user_day_version', (q) => q.eq('userId', userId).eq('day', day))
      .order('desc')
      .first();
    const now = Date.now();
    const dailyAnswerId = await ctx.db.insert('coachDailyAnswersV1', {
      userId,
      day,
      version: (latestAnswers?.version ?? 0) + 1,
      answers,
      source: 'member',
      createdAt: now,
    });
    const daily = await ctx.db.get(dailyAnswerId);
    if (!daily) throw new ConvexError('Daily answers missing');
    const inputSnapshot = await planSnapshot(ctx, userId, day, profile, daily);
    const toneSetting = await ctx.db
      .query('coachToneSettingsV1')
      .withIndex('by_version')
      .order('desc')
      .first();
    const requestId = await ctx.db.insert('coachPlanRequestsV1', {
      userId,
      day,
      requestKey: state.testReanswerKey,
      kind: 'daily',
      profileRevisionId: profile._id,
      dailyAnswerId,
      inputSnapshot,
      promptVersion: DAILY_PLAN_V2_1_PROMPT_VERSION,
      toneVersion: toneSetting?.version ?? 1,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
      queuedAt: now,
    });
    await ctx.db.patch(state._id, { dailyAnswerId, testReanswerDraft: answers, updatedAt: now });
    await ctx.scheduler.runAfter(0, internal.coachDailyService.generateReserved, { requestId });
    return requestId;
  },
});

export const getMyFoundation = query({
  args: {},
  handler: async (ctx) => {
    const userId = await member(ctx);
    const day = await localDay(ctx, userId);
    const state = await progress(ctx, userId);
    const request = state?.firstPlanRequestId
      ? await ctx.db.get(state.firstPlanRequestId as Id<'coachPlanRequestsV1'>)
      : null;
    // Before entitlement verification, expose status and saved answers, never pre-payment plan output.
    return { day, state, firstPlanStatus: request?.status ?? null };
  },
});

// An explicit Today action opens plan setup for a returning member. This
// persists the returning-home classification through partial profile drafts;
// it does not reserve a plan, dispatch generation or award anything.
export const beginReturningPlanSetup = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await member(ctx);
    if (!(await hasVerifiedPremium(ctx, userId))) throw new ConvexError('Verified access required');
    const user = await ctx.db.get(userId);
    if (!user?.name?.trim() || !user.birthdate) throw new ConvexError('Basic profile required');
    const existing = await progress(ctx, userId);
    const earlierPlan =
      existing?.returningMember || existing?.stage === 'complete'
        ? null
        : await ctx.db
            .query('coachPlanRevisionsV1')
            .withIndex('by_user', (q) => q.eq('userId', userId))
            .first();
    // Incomplete new-member onboarding still follows its server resume path.
    if (
      existing &&
      existing.stage !== 'complete' &&
      !existing.returningMember &&
      !earlierPlan &&
      !user.onboarded
    )
      throw new ConvexError('Complete onboarding first');
    const day = await localDay(ctx, userId);
    const request = await ctx.db
      .query('coachPlanRequestsV1')
      .withIndex('by_user_day', (q) => q.eq('userId', userId).eq('day', day))
      .first();
    if (request) throw new ConvexError('Today already has a plan request');
    const state = existing ?? (await getOrCreateProgress(ctx, userId));
    if (!state.returningMember)
      await ctx.db.patch(state._id, { returningMember: true, updatedAt: Date.now() });
    return { needsProfile: !state.profileRevisionId };
  },
});

export const saveProfileDraft = mutation({
  args: profileDraftFields,
  handler: async (ctx, args) => {
    const userId = await member(ctx);
    const state = await getOrCreateProgress(ctx, userId);
    if (state.firstPlanRequestId) throw new ConvexError('First-plan answers are already reserved');
    const fields = Object.fromEntries(
      Object.entries(args).filter(([, value]) => value !== undefined)
    );
    if (args.weight && (!Number.isFinite(args.weight.value) || args.weight.value <= 0))
      throw new ConvexError('Invalid weight');
    await ctx.db.patch(state._id, {
      profileDraft: { ...state.profileDraft, ...fields },
      updatedAt: Date.now(),
    });
    return state._id;
  },
});

export const finishProfile = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await member(ctx);
    const state = await getOrCreateProgress(ctx, userId);
    const answers = completeProfile(state.profileDraft);
    if (state.firstPlanRequestId) throw new ConvexError('First-plan answers are already reserved');
    const latest = await ctx.db
      .query('coachProfileRevisionsV1')
      .withIndex('by_user_version', (q) => q.eq('userId', userId))
      .order('desc')
      .first();
    if (latest && JSON.stringify(latest.answers) === JSON.stringify(answers)) {
      const weight = await ctx.db.get(latest.weightObservationId);
      if (weight && JSON.stringify(weight.weight) === JSON.stringify(state.profileDraft!.weight)) {
        await ctx.db.patch(state._id, {
          profileRevisionId: latest._id,
          stage: (await hasVerifiedPremium(ctx, userId)) ? 'daily' : 'health',
          healthContinuation: (await hasVerifiedPremium(ctx, userId))
            ? (state.healthContinuation ?? 'unavailable')
            : state.healthContinuation,
          updatedAt: Date.now(),
        });
        return latest._id;
      }
    }
    const now = Date.now();
    const version = (latest?.version ?? 0) + 1;
    const weightId = await ctx.db.insert('coachWeightObservationsV1', {
      userId,
      version,
      weight: state.profileDraft!.weight!,
      source: 'member',
      observedAt: now,
      recordedAt: now,
    });
    const id = await ctx.db.insert('coachProfileRevisionsV1', {
      userId,
      version,
      answers,
      weightObservationId: weightId,
      source: 'member',
      createdAt: now,
    });
    const entitled = await hasVerifiedPremium(ctx, userId);
    await ctx.db.patch(state._id, {
      profileRevisionId: id,
      stage: entitled ? 'daily' : 'health',
      healthContinuation: entitled
        ? (state.healthContinuation ?? 'unavailable')
        : state.healthContinuation,
      updatedAt: now,
    });
    return id;
  },
});

export const updateProfileRevision = mutation({
  args: {
    answers: profileAnswers,
    weight: weightAnswer,
    observedAt: v.optional(v.number()),
    expectedVersion: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await member(ctx);
    if (
      !Number.isFinite(args.weight.value) ||
      args.weight.value <= 0 ||
      (args.observedAt !== undefined &&
        (!Number.isFinite(args.observedAt) || args.observedAt > Date.now()))
    ) {
      throw new ConvexError('Invalid weight observation');
    }
    const latest = await ctx.db
      .query('coachProfileRevisionsV1')
      .withIndex('by_user_version', (q) => q.eq('userId', userId))
      .order('desc')
      .first();
    if (latest && JSON.stringify(latest.answers) === JSON.stringify(args.answers)) {
      const previousWeight = await ctx.db.get(latest.weightObservationId);
      if (
        previousWeight &&
        JSON.stringify(previousWeight.weight) === JSON.stringify(args.weight) &&
        (args.observedAt === undefined || previousWeight.observedAt === args.observedAt)
      )
        return latest._id;
    }
    if ((latest?.version ?? 0) !== args.expectedVersion)
      throw new ConvexError('Profile version changed');
    const now = Date.now();
    const version = args.expectedVersion + 1;
    const previousWeight = latest ? await ctx.db.get(latest.weightObservationId) : null;
    const reuseWeight =
      previousWeight &&
      JSON.stringify(previousWeight.weight) === JSON.stringify(args.weight) &&
      args.observedAt === undefined;
    const lastObservation = await ctx.db
      .query('coachWeightObservationsV1')
      .withIndex('by_user_version', (q) => q.eq('userId', userId))
      .order('desc')
      .first();
    const weightObservationId = reuseWeight
      ? previousWeight._id
      : await ctx.db.insert('coachWeightObservationsV1', {
          userId,
          version: (lastObservation?.version ?? 0) + 1,
          weight: args.weight,
          observedAt: args.observedAt ?? now,
          recordedAt: now,
          source: 'member',
        });
    const id = await ctx.db.insert('coachProfileRevisionsV1', {
      userId,
      version,
      answers: args.answers,
      weightObservationId,
      source: 'member',
      createdAt: now,
    });
    const state = await getOrCreateProgress(ctx, userId);
    await ctx.db.patch(state._id, { profileRevisionId: id, updatedAt: now });
    return id;
  },
});

export const continueAfterHealth = mutation({
  args: {
    result: v.union(v.literal('connected'), v.literal('declined'), v.literal('unavailable')),
  },
  handler: async (ctx, { result }) => {
    const userId = await member(ctx);
    const state = await getOrCreateProgress(ctx, userId);
    if (!state.profileRevisionId) throw new ConvexError('Complete profile first');
    if (state.healthContinuation && state.stage !== 'health') return state._id;
    if (state.firstPlanRequestId) return state._id;
    await ctx.db.patch(state._id, {
      healthContinuation: result,
      stage: 'setup',
      updatedAt: Date.now(),
    });
    return state._id;
  },
});

// The profile loading screen marks only the end of setup. It never reserves a plan.
export const finishCoachSetup = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await member(ctx);
    const state = await getOrCreateProgress(ctx, userId);
    if (!state.profileRevisionId || !state.healthContinuation)
      throw new ConvexError('Profile and health continuation required');
    if (state.stage === 'setup')
      await ctx.db.patch(state._id, {
        stage: (await hasVerifiedPremium(ctx, userId)) ? 'daily' : 'paywall',
        updatedAt: Date.now(),
      });
    return state._id;
  },
});

export const saveDailyDraft = mutation({
  args: dailyDraftFields,
  handler: async (ctx, args) => {
    const userId = await member(ctx);
    const state = await getOrCreateProgress(ctx, userId);
    const verified = await hasVerifiedPremium(ctx, userId);
    const healthContinuation = state.healthContinuation ?? (verified ? 'unavailable' : undefined);
    if (!state.profileRevisionId || !healthContinuation)
      throw new ConvexError('Profile and health continuation required');
    const day = await localDay(ctx, userId);
    assertDay(day);
    const reserved = await ctx.db
      .query('coachPlanRequestsV1')
      .withIndex('by_user_day', (q) => q.eq('userId', userId).eq('day', day))
      .first();
    if (reserved) throw new ConvexError('Daily answers are already reserved for today');
    if (!verified) throw new ConvexError('Verified access required for daily questions');
    const fields = Object.fromEntries(
      Object.entries(args).filter(([, value]) => value !== undefined)
    );
    const draft = state.dailyDraftDay === day ? state.dailyDraft : undefined;
    await ctx.db.patch(state._id, {
      dailyDraft: { ...draft, ...fields },
      dailyDraftDay: day,
      healthContinuation,
      updatedAt: Date.now(),
    });
    return { day };
  },
});

export const finishDailyAnswers = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await member(ctx);
    const state = await getOrCreateProgress(ctx, userId);
    const day = await localDay(ctx, userId);
    if (state.dailyDraftDay !== day || !state.profileRevisionId || !state.healthContinuation)
      throw new ConvexError('Fresh daily answers required');
    const reserved = await ctx.db
      .query('coachPlanRequestsV1')
      .withIndex('by_user_day', (q) => q.eq('userId', userId).eq('day', day))
      .first();
    if (reserved) return reserved.dailyAnswerId;
    if (!(await hasVerifiedPremium(ctx, userId)))
      throw new ConvexError('Verified access required for daily questions');
    const answers = completeDaily(state.dailyDraft);
    const latest = await ctx.db
      .query('coachDailyAnswersV1')
      .withIndex('by_user_day_version', (q) => q.eq('userId', userId).eq('day', day))
      .order('desc')
      .first();
    if (latest && JSON.stringify(latest.answers) === JSON.stringify(answers)) {
      await ctx.db.patch(state._id, { dailyAnswerId: latest._id, updatedAt: Date.now() });
      return latest._id;
    }
    const id = await ctx.db.insert('coachDailyAnswersV1', {
      userId,
      day,
      version: (latest?.version ?? 0) + 1,
      answers,
      source: 'member',
      createdAt: Date.now(),
    });
    await ctx.db.patch(state._id, { dailyAnswerId: id, updatedAt: Date.now() });
    return id;
  },
});

// The fifth answer, immutable answer row, plan reservation and scheduled job commit
// together. Payment verification precedes this transaction; navigation shows the saved request.
export const finishDailyAndReserveFirst = mutation({
  args: { body: dailyAnswers.fields.body, requestKey: v.string() },
  returns: v.id('coachPlanRequestsV1'),
  handler: async (ctx, args) => {
    const userId = await member(ctx);
    assertRequestKey(args.requestKey);
    const state = await getOrCreateProgress(ctx, userId);
    const day = await localDay(ctx, userId);
    const existing = await ctx.db
      .query('coachPlanRequestsV1')
      .withIndex('by_user_day', (q) => q.eq('userId', userId).eq('day', day))
      .order('desc')
      .first();
    if (existing) return existing._id;
    if (!(await hasVerifiedPremium(ctx, userId)))
      throw new ConvexError('Verified access required for daily questions');
    const healthContinuation =
      state.healthContinuation ??
      ((await hasVerifiedPremium(ctx, userId)) ? 'unavailable' : undefined);
    if (!state.profileRevisionId || !healthContinuation || state.dailyDraftDay !== day)
      throw new ConvexError('Profile, health continuation and fresh daily answers required');
    const answers = completeDaily({ ...state.dailyDraft, body: args.body });
    const profile = await ctx.db.get(state.profileRevisionId);
    if (!profile || profile.userId !== userId)
      throw new ConvexError('Profile does not match member');
    const latest = await ctx.db
      .query('coachDailyAnswersV1')
      .withIndex('by_user_day_version', (q) => q.eq('userId', userId).eq('day', day))
      .order('desc')
      .first();
    const now = Date.now();
    const dailyAnswerId =
      latest && JSON.stringify(latest.answers) === JSON.stringify(answers)
        ? latest._id
        : await ctx.db.insert('coachDailyAnswersV1', {
            userId,
            day,
            version: (latest?.version ?? 0) + 1,
            answers,
            source: 'member',
            createdAt: now,
          });
    const daily = await ctx.db.get(dailyAnswerId);
    if (!daily) throw new ConvexError('Daily answers missing');
    const inputSnapshot = await planSnapshot(ctx, userId, day, profile, daily);
    const toneSetting = await ctx.db
      .query('coachToneSettingsV1')
      .withIndex('by_version')
      .order('desc')
      .first();
    const requestId = await ctx.db.insert('coachPlanRequestsV1', {
      userId,
      day,
      requestKey: args.requestKey,
      kind: 'first',
      profileRevisionId: profile._id,
      dailyAnswerId,
      inputSnapshot,
      promptVersion: DAILY_PLAN_V2_1_PROMPT_VERSION,
      toneVersion: toneSetting?.version ?? 1,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
      queuedAt: now,
    });
    await ctx.db.patch(state._id, {
      dailyDraft: answers,
      dailyAnswerId,
      firstPlanRequestId: requestId,
      healthContinuation,
      // A returning member stays in the completed-member route while the
      // current-day request prepares. New-member onboarding remains 'daily'.
      stage: state.stage === 'complete' ? 'complete' : 'daily',
      updatedAt: now,
    });
    await ctx.scheduler.runAfter(0, internal.coachDailyService.generateReserved, { requestId });
    return requestId;
  },
});

export const reserveFirstPlan = mutation({
  args: { requestKey: v.string() },
  handler: async (ctx, args) => {
    const userId = await member(ctx);
    assertRequestKey(args.requestKey);
    const state = await getOrCreateProgress(ctx, userId);
    const day = await localDay(ctx, userId);
    const existing = await ctx.db
      .query('coachPlanRequestsV1')
      .withIndex('by_user_day_kind', (q) =>
        q.eq('userId', userId).eq('day', day).eq('kind', 'first')
      )
      .first();
    if (existing) return existing._id;
    if (!(await hasVerifiedPremium(ctx, userId)))
      throw new ConvexError('Verified access required for plan preparation');
    const occupiedKey = await ctx.db
      .query('coachPlanRequestsV1')
      .withIndex('by_user_day_key', (q) =>
        q.eq('userId', userId).eq('day', day).eq('requestKey', args.requestKey)
      )
      .unique();
    if (occupiedKey) throw new ConvexError('Request key already used for another plan');
    if (!state.profileRevisionId || !state.dailyAnswerId || !state.healthContinuation)
      throw new ConvexError('Questionnaire incomplete');
    const profile = (await ctx.db.get(
      state.profileRevisionId as Id<'coachProfileRevisionsV1'>
    )) as Doc<'coachProfileRevisionsV1'> | null;
    const daily = (await ctx.db.get(
      state.dailyAnswerId as Id<'coachDailyAnswersV1'>
    )) as Doc<'coachDailyAnswersV1'> | null;
    if (
      !profile ||
      !daily ||
      profile.userId !== userId ||
      daily.userId !== userId ||
      daily.day !== day
    )
      throw new ConvexError('Questionnaire does not match member/day');
    const inputSnapshot = await planSnapshot(ctx, userId, day, profile, daily);
    const toneSetting = await ctx.db
      .query('coachToneSettingsV1')
      .withIndex('by_version')
      .order('desc')
      .first();
    const now = Date.now();
    const id = await ctx.db.insert('coachPlanRequestsV1', {
      userId,
      day,
      requestKey: args.requestKey,
      kind: 'first',
      profileRevisionId: profile._id,
      dailyAnswerId: daily._id,
      inputSnapshot,
      promptVersion: DAILY_PLAN_V2_1_PROMPT_VERSION,
      toneVersion: toneSetting?.version ?? 1,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.patch(state._id, { firstPlanRequestId: id, stage: 'daily', updatedAt: now });
    return id;
  },
});

export const reserveLaterPlan = mutation({
  args: { requestKey: v.string(), kind: v.union(v.literal('daily'), v.literal('profile_refresh')) },
  handler: async (ctx, args) => {
    const userId = await member(ctx);
    assertRequestKey(args.requestKey);
    const day = await localDay(ctx, userId);
    const existingKey = await ctx.db
      .query('coachPlanRequestsV1')
      .withIndex('by_user_day_key', (q) =>
        q.eq('userId', userId).eq('day', day).eq('requestKey', args.requestKey)
      )
      .unique();
    if (existingKey) {
      if (existingKey.kind !== args.kind)
        throw new ConvexError('Request key already used for another plan');
      const state = await progress(ctx, userId);
      if (
        (args.kind === 'profile_refresh' &&
          existingKey.profileRevisionId !== state?.profileRevisionId) ||
        (args.kind === 'daily' && existingKey.dailyAnswerId !== state?.dailyAnswerId)
      )
        throw new ConvexError('Request key belongs to earlier answers');
      return existingKey._id;
    }
    const state = await progress(ctx, userId);
    if (
      !state?.profileRevisionId ||
      !state.dailyAnswerId ||
      state.entitlement !== 'verified' ||
      !(await hasVerifiedPremium(ctx, userId))
    )
      throw new ConvexError('Verified member and current answers required');
    const profile = await ctx.db.get(state.profileRevisionId);
    const daily = await ctx.db.get(state.dailyAnswerId);
    if (
      !profile ||
      !daily ||
      profile.userId !== userId ||
      daily.userId !== userId ||
      daily.day !== day
    )
      throw new ConvexError('Answers do not match member/day');
    const requests = await ctx.db
      .query('coachPlanRequestsV1')
      .withIndex('by_user_day_kind', (q) =>
        q.eq('userId', userId).eq('day', day).eq('kind', args.kind)
      )
      .collect();
    const sameInput = requests.find((r) =>
      args.kind === 'profile_refresh'
        ? r.profileRevisionId === profile._id
        : r.dailyAnswerId === daily._id
    );
    if (sameInput) return sameInput._id;
    const todayPlan = await ctx.db
      .query('coachPlanRevisionsV1')
      .withIndex('by_user_day_version', (q) => q.eq('userId', userId).eq('day', day))
      .order('desc')
      .first();
    if (args.kind === 'profile_refresh') {
      if (!todayPlan) throw new ConvexError('No current-day plan to refresh');
      const previous = await ctx.db.get(todayPlan.requestId);
      if (previous?.profileRevisionId === profile._id) return todayPlan.requestId;
    } else if (todayPlan) {
      return todayPlan.requestId;
    }
    const inputSnapshot = await planSnapshot(ctx, userId, day, profile, daily);
    const toneSetting = await ctx.db
      .query('coachToneSettingsV1')
      .withIndex('by_version')
      .order('desc')
      .first();
    const now = Date.now();
    return ctx.db.insert('coachPlanRequestsV1', {
      userId,
      day,
      requestKey: args.requestKey,
      kind: args.kind,
      profileRevisionId: profile._id,
      dailyAnswerId: daily._id,
      inputSnapshot,
      promptVersion: DAILY_PLAN_V2_1_PROMPT_VERSION,
      toneVersion: toneSetting?.version ?? 1,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const recordPlanFailure = internalMutation({
  args: {
    requestId: v.id('coachPlanRequestsV1'),
    code: v.union(
      v.literal('provider_timeout'),
      v.literal('provider_unavailable'),
      v.literal('invalid_output'),
      v.literal('generation_failed')
    ),
  },
  handler: async (ctx, { requestId, code }) => {
    const request = await ctx.db.get(requestId);
    if (!request) throw new ConvexError('Request missing');
    if (request.status === 'ready') throw new ConvexError('Ready plan cannot fail');
    if (request.status === 'failed') return requestId;
    await ctx.db.patch(requestId, { status: 'failed', errorCode: code, updatedAt: Date.now() });
    return requestId;
  },
});

// Only trusted generation/payment services may invoke these later. No provider or billing calls here.
export const recordPlanRevision = internalMutation({
  args: {
    requestId: v.id('coachPlanRequestsV1'),
    output: planOutput,
    detailsV2: v.optional(planDetailsV2),
    workout: workoutMetadata,
    stepTarget: v.number(),
  },
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.requestId);
    if (!request) throw new ConvexError('Request missing');
    const existing = await ctx.db
      .query('coachPlanRevisionsV1')
      .withIndex('by_request', (q) => q.eq('requestId', args.requestId))
      .unique();
    if (existing) return existing._id;
    if (request.status !== 'pending') throw new ConvexError('Request is not pending');
    const latestRequest = await ctx.db
      .query('coachPlanRequestsV1')
      .withIndex('by_user_day', (q) => q.eq('userId', request.userId).eq('day', request.day))
      .order('desc')
      .first();
    if (latestRequest?._id !== request._id || request.dispatchedAt)
      throw new ConvexError('Stale or claimed request');
    // This internal writer predates the named client prompt. Keep its legacy
    // request versions compatible; new v2 requests require v2 details.
    const checked = isV2DailyPrompt(request.promptVersion)
      ? validateDailyPlanOutputV2(
          { ...args.output, ...args.detailsV2 },
          request.inputSnapshot,
          request.day
        )
      : validateDailyPlanOutput(args.output, request.inputSnapshot, request.day);
    if (
      checked.stepTarget !== args.stepTarget ||
      JSON.stringify(checked.workout) !== JSON.stringify(args.workout)
    )
      throw new ConvexError('Plan metadata does not match validated output');
    if (!Number.isInteger(args.stepTarget) || args.stepTarget <= 0 || args.stepTarget % 500 !== 0)
      throw new ConvexError('Invalid step target');
    if (
      args.workout.type === 'rest'
        ? args.workout.durationMinutes !== undefined
        : !Number.isInteger(args.workout.durationMinutes) || args.workout.durationMinutes! < 1
    )
      throw new ConvexError('Invalid workout metadata');
    for (const value of Object.values(args.output))
      if (!value.trim()) throw new ConvexError('Incomplete plan');
    const stepText = args.output.steps.match(/^([\d,]+) steps$/);
    if (!stepText || Number(stepText[1].replaceAll(',', '')) !== args.stepTarget)
      throw new ConvexError('Step target does not match recommendation');
    if (args.workout.type === 'rest') {
      if (
        args.output.workout !==
        'No workout today. Keep your streak going by logging your meals, steps and sleep.'
      )
        throw new ConvexError('Rest recommendation does not match metadata');
    } else {
      const expectedType = args.workout.type.replaceAll('_', ' ');
      if (
        !args.output.workout.toLowerCase().includes(expectedType) ||
        !args.output.workout.includes(`${args.workout.durationMinutes}-minute`)
      )
        throw new ConvexError('Workout recommendation does not match metadata');
    }
    const latest = await ctx.db
      .query('coachPlanRevisionsV1')
      .withIndex('by_user_day_version', (q) =>
        q.eq('userId', request.userId).eq('day', request.day)
      )
      .order('desc')
      .first();
    const now = Date.now();
    const id = await ctx.db.insert('coachPlanRevisionsV1', {
      userId: request.userId,
      day: request.day,
      version: (latest?.version ?? 0) + 1,
      requestId: args.requestId,
      output: args.output,
      detailsV2: isV2DailyPrompt(request.promptVersion) ? args.detailsV2 : undefined,
      workout: args.workout,
      stepTarget: args.stepTarget,
      sleepTargetHours: 7,
      promptVersion: request.promptVersion,
      toneVersion: request.toneVersion,
      createdAt: now,
    });
    await ctx.db.patch(request._id, { status: 'ready', updatedAt: now });
    return id;
  },
});

export const recordEntitlementCheck = internalMutation({
  args: { userId: v.id('users'), verified: v.boolean(), checkedAt: v.number() },
  handler: async (ctx, args) => {
    const state = await progress(ctx, args.userId);
    if (!state) throw new ConvexError('Onboarding missing');
    if (!Number.isFinite(args.checkedAt)) throw new ConvexError('Invalid verification time');
    await ctx.db.patch(state._id, {
      entitlement: args.verified ? 'verified' : 'unverified',
      entitlementCheckedAt: args.checkedAt,
      updatedAt: Date.now(),
    });
    return state._id;
  },
});

export const reconcileReadyOnboarding = internalMutation({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    const state = await progress(ctx, userId);
    if (!state || state.entitlement !== 'verified' || !state.firstPlanRequestId) return false;
    const request = await ctx.db.get(state.firstPlanRequestId as Id<'coachPlanRequestsV1'>);
    if (!request || request.status !== 'ready' || request.day !== (await localDay(ctx, userId)))
      return false;
    await ctx.db.patch(state._id, { stage: 'complete', updatedAt: Date.now() });
    return true;
  },
});

export const materializeAssignments = internalMutation({
  args: { revisionId: v.id('coachPlanRevisionsV1') },
  handler: async (ctx, { revisionId }) => {
    const revision = await ctx.db.get(revisionId);
    if (!revision) throw new ConvexError('Plan revision missing');
    const choices = [
      {
        category: 'workout' as const,
        recommendation: revision.detailsV2
          ? workoutRecommendationV2(
              revision.output,
              revision.detailsV2,
              revision.workout.type === 'rest'
            )
          : revision.output.workout,
        label: assignmentLabel(
          revision.output.workout,
          revision.workout.type,
          revision.workout.durationMinutes
        ),
        workout: revision.workout,
      },
      { category: 'meals' as const, recommendation: revision.output.meals, label: 'Log a meal' },
      {
        category: 'sleep' as const,
        recommendation: revision.output.sleep,
        label: 'Log your sleep',
        sleepTargetHours: 7 as const,
      },
      {
        category: 'steps' as const,
        recommendation: revision.detailsV2
          ? stepsRecommendationV2(revision.output, revision.detailsV2)
          : revision.output.steps,
        label: `${revision.stepTarget.toLocaleString('en-US')} steps`,
        stepTarget: revision.stepTarget,
      },
    ];
    const ids = [];
    for (const choice of choices) {
      const existing = await ctx.db
        .query('coachAssignmentsV1')
        .withIndex('by_user_day_category_revision', (q) =>
          q
            .eq('userId', revision.userId)
            .eq('day', revision.day)
            .eq('category', choice.category)
            .eq('planRevisionId', revisionId)
        )
        .unique();
      ids.push(
        existing?._id ??
          (await ctx.db.insert('coachAssignmentsV1', {
            userId: revision.userId,
            day: revision.day,
            planRevisionId: revisionId,
            createdAt: Date.now(),
            detailsV2: revision.detailsV2,
            ...choice,
          }))
      );
    }
    return ids;
  },
});

export const reserveProof = mutation({
  args: { assignmentId: v.id('coachAssignmentsV1'), requestKey: v.string() },
  handler: async (ctx, args) => {
    const userId = await member(ctx);
    assertRequestKey(args.requestKey);
    const assignment = await ctx.db.get(args.assignmentId);
    if (!assignment || assignment.userId !== userId)
      throw new ConvexError('Assignment does not belong to member');
    if (assignment.day !== (await localDay(ctx, userId)))
      throw new ConvexError('Assignment is not for today');
    const state = await progress(ctx, userId);
    if (state?.entitlement !== 'verified' || !(await hasVerifiedPremium(ctx, userId)))
      throw new ConvexError('Verified entitlement required');
    const sameRequest = await ctx.db
      .query('coachProofSubmissionsV1')
      .withIndex('by_user_day_key', (q) =>
        q.eq('userId', userId).eq('day', assignment.day).eq('requestKey', args.requestKey)
      )
      .unique();
    if (sameRequest) {
      if (sameRequest.assignmentId !== args.assignmentId)
        throw new ConvexError('Request key already belongs to another assignment');
      return sameRequest._id;
    }
    const revision = await ctx.db.get(assignment.planRevisionId);
    if (!revision || revision.userId !== userId || revision.day !== assignment.day)
      throw new ConvexError('Assignment plan does not match member/day');
    if (assignment.category === 'workout' && assignment.workout?.type === 'rest')
      throw new ConvexError('Rest guidance has no mandatory workout proof');
    const latestRevision = await ctx.db
      .query('coachPlanRevisionsV1')
      .withIndex('by_user_day_version', (q) => q.eq('userId', userId).eq('day', assignment.day))
      .order('desc')
      .first();
    if (latestRevision?._id !== assignment.planRevisionId)
      throw new ConvexError('This plan assignment was superseded before capture');
    // Conservative compatibility guard. Historical check-ins and logs may already have earned points.
    const legacyActivities = await ctx.db
      .query('dailyActivities')
      .withIndex('by_user_date', (q) => q.eq('userId', userId).eq('date', assignment.day))
      .collect();
    const legacyCompletions =
      assignment.category === 'workout'
        ? await ctx.db
            .query('challengeCompletions')
            .withIndex('by_user_date', (q) => q.eq('userId', userId).eq('date', assignment.day))
            .collect()
        : [];
    const hasLegacyWorkout =
      legacyActivities.some(
        (a) =>
          !a.coachSubmissionId &&
          (a.loggedActivityKey === 'gym_workout' || a.loggedActivityKey === 'workout')
      ) ||
      (await Promise.all(legacyCompletions.map((c) => ctx.db.get(c.challengeId)))).some(
        (challenge) =>
          challenge?.type === 'check_in' || challenge?.dailyChallengeType === 'check_in'
      );
    const legacyCount =
      assignment.category === 'workout'
        ? Number(hasLegacyWorkout)
        : legacyActivities.filter(
            (a) =>
              !a.coachSubmissionId &&
              a.loggedActivityKey ===
                (assignment.category === 'meals' ? 'healthy_meal' : assignment.category)
          ).length;
    if (legacyCount >= (assignment.category === 'meals' ? 3 : 1))
      throw new ConvexError('Legacy activity already consumed this category');
    const max = assignment.category === 'meals' ? 3 : 1;
    for (let ordinal = legacyCount + 1; ordinal <= max; ordinal++) {
      const key = rewardSlotKey(assignment.day, assignment.category, ordinal);
      const slot = await ctx.db
        .query('coachRewardSlotsV1')
        .withIndex('by_user_key', (q) => q.eq('userId', userId).eq('key', key))
        .unique();
      if (slot) {
        if (slot.state === 'reserved' && slot.submissionId) return slot.submissionId;
        continue;
      }
      const now = Date.now();
      const id = await ctx.db.insert('coachProofSubmissionsV1', {
        userId,
        day: assignment.day,
        requestKey: args.requestKey,
        assignmentId: assignment._id,
        planRevisionId: assignment.planRevisionId,
        category: assignment.category,
        recommendation: assignment.recommendation,
        label: assignment.label,
        slotKey: key,
        state: 'reserved',
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert('coachRewardSlotsV1', {
        userId,
        day: assignment.day,
        category: assignment.category,
        ordinal,
        key,
        state: 'reserved',
        submissionId: id,
        createdAt: now,
      });
      return id;
    }
    throw new ConvexError('Daily category limit reached');
  },
});

export const getToneContract = query({
  args: {},
  handler: async (ctx) => {
    const userId = await member(ctx);
    const user = await ctx.db.get(userId);
    if (!user?.isAdmin) throw new ConvexError('Admin required');
    const current = await ctx.db
      .query('coachToneSettingsV1')
      .withIndex('by_version')
      .order('desc')
      .first();
    return current ?? { version: 1, ...DEFAULT_COACH_TONE, action: 'restore' as const };
  },
});

export const getToneHistory = query({
  args: {},
  handler: async (ctx) => {
    const userId = await member(ctx);
    const user = await ctx.db.get(userId);
    if (!user?.isAdmin) throw new ConvexError('Admin required');
    return ctx.db.query('coachToneSettingsV1').withIndex('by_version').order('desc').collect();
  },
});

export const saveToneContract = mutation({
  args: {
    expectedVersion: v.number(),
    tone,
    detail,
    scope: toneScope,
    action: v.union(v.literal('save'), v.literal('restore')),
  },
  handler: async (ctx, args) => {
    const userId = await member(ctx);
    const user = await ctx.db.get(userId);
    if (!user?.isAdmin) throw new ConvexError('Admin required');
    const current = await ctx.db
      .query('coachToneSettingsV1')
      .withIndex('by_version')
      .order('desc')
      .first();
    const version = current?.version ?? 1;
    if (args.expectedVersion !== version) throw new ConvexError('Tone version changed');
    if (args.action === 'save' && args.scope !== 'both')
      throw new ConvexError('New tone settings must apply to both');
    const settings = args.action === 'restore' ? DEFAULT_COACH_TONE : args;
    return ctx.db.insert('coachToneSettingsV1', {
      version: version + 1,
      tone: settings.tone,
      detail: settings.detail,
      scope: settings.scope,
      action: args.action,
      adminUserId: userId,
      actorStatus: 'active_admin',
      createdAt: Date.now(),
    });
  },
});
