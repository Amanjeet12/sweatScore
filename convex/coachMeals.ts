import { getAuthUserId } from '@convex-dev/auth/server';
import { ConvexError, v } from 'convex/values';
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
  MutationCtx,
  QueryCtx,
} from './_generated/server';
import { internal } from './_generated/api';
import { Doc, Id } from './_generated/dataModel';
import { formatDateInTZ } from './utils/timezone';
import { MEAL_PROMPT_VERSION } from './coachMealPrompt';
import { rewardSlotKey, DEFAULT_COACH_TONE } from '../shared/coachFoundation';

async function owner(ctx: QueryCtx | MutationCtx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new ConvexError('Authentication required');
  return userId;
}
async function entitled(ctx: QueryCtx | MutationCtx, userId: Id<'users'>) {
  const user = await ctx.db.get(userId);
  if (user?.isAdmin) return true;
  const billing = await ctx.db
    .query('coachBillingEntitlementsV1')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .unique();
  return billing?.status === 'active' && (!billing.expiresAt || billing.expiresAt > Date.now());
}
async function today(ctx: QueryCtx | MutationCtx, userId: Id<'users'>) {
  return formatDateInTZ(new Date(), (await ctx.db.get(userId))?.timezone);
}
function asError(code: string): never {
  throw new ConvexError(code);
}
const RESERVATION_MS = 120_000;
const DISPATCH_MS = 60_000;
// Provider-cost throttle is separate from the three successful scans shown to members.
const MAX_DISPATCHES_PER_HOUR = 8;
const UNCLEAR_IMAGE =
  /\b(?:unclear|blurry|blurred|cannot see|can't see|unable to (?:see|assess|identify)|not (?:clear|visible)|hard to (?:see|identify)|too dark)\b/i;

async function usableScanCount(ctx: QueryCtx | MutationCtx, scans: Doc<'coachMealScansV1'>[]) {
  let count = 0;
  for (const scan of scans) {
    if (scan.status !== 'ready' || scan.usable === false) continue;
    if (scan.usable === true) {
      count++;
      continue;
    }
    // Historical ready rows predate the explicit usable flag.
    const draft = await ctx.db.get(scan.draftId);
    if (draft?.verdict) count++;
  }
  return count;
}

async function scanAllowance(ctx: QueryCtx | MutationCtx, scans: Doc<'coachMealScansV1'>[]) {
  const now = Date.now();
  const used = await usableScanCount(ctx, scans);
  const inProgress = scans.filter(
    (scan) =>
      (scan.status === 'reserved' && now - scan.reservedAt < RESERVATION_MS) ||
      (scan.status === 'dispatched' && now - (scan.dispatchedAt ?? now) < DISPATCH_MS)
  ).length;
  return {
    used,
    inProgress,
    remaining: Math.max(0, 3 - used - inProgress),
    limitReached: used + inProgress >= 3,
  };
}

export const myDraft = query({
  args: { submissionId: v.id('coachProofSubmissionsV1'), refresh: v.optional(v.number()) },
  handler: async (ctx, { submissionId }) => {
    const userId = await owner(ctx);
    if (!(await entitled(ctx, userId))) asError('Verified entitlement required');
    const submission = await ctx.db.get(submissionId);
    if (!submission || submission.userId !== userId || submission.category !== 'meals')
      asError('Meal proof does not belong to member');
    const drafts = await ctx.db
      .query('coachMealDraftsV1')
      .withIndex('by_submission', (q) => q.eq('submissionId', submissionId))
      .collect();
    const draft =
      drafts
        .filter((d) => d.storageId === submission?.storageId)
        .sort((a, b) => b.createdAt - a.createdAt)[0] ?? null;
    const scans = await ctx.db
      .query('coachMealScansV1')
      .withIndex('by_user_day', (q) => q.eq('userId', userId).eq('day', submission!.day))
      .collect();
    const activities = await ctx.db
      .query('dailyActivities')
      .withIndex('by_user_date', (q) => q.eq('userId', userId).eq('date', submission!.day))
      .collect();
    const allowance = await scanAllowance(ctx, scans);
    return {
      draft,
      scanCount: allowance.used,
      analysisChecksInProgress: allowance.inProgress,
      analysisChecksRemaining: allowance.remaining,
      analysisLimitReached: allowance.limitReached,
      canRetryAnalysis:
        draft?.status === 'analyzing' && draft.scanId
          ? scans.some(
              (s) =>
                s._id === draft.scanId &&
                ((s.status === 'reserved' && Date.now() - s.reservedAt >= RESERVATION_MS) ||
                  (s.status === 'dispatched' && Date.now() - (s.dispatchedAt ?? 0) >= DISPATCH_MS))
            )
          : false,
      shareCount: activities.filter(
        (a) => a.loggedActivityKey === 'healthy_meal' && a.reviewStatus !== 'rejected'
      ).length,
      storageId: submission?.storageId ?? null,
    };
  },
});

export const resetMyMealAnalysisCountForTesting = mutation({
  args: {},
  handler: async (ctx) => {
    if (process.env.CONVEX_CLOUD_URL !== 'https://beloved-stoat-88.convex.cloud')
      asError('This testing tool is available only in the approved development deployment');
    const userId = await owner(ctx);
    const day = await today(ctx, userId);
    const scans = await ctx.db
      .query('coachMealScansV1')
      .withIndex('by_user_day', (q) => q.eq('userId', userId).eq('day', day))
      .collect();
    const now = Date.now();
    for (const scan of scans) {
      if (scan.status === 'reserved')
        await ctx.db.patch(scan._id, {
          status: 'released',
          usable: false,
          errorCode: 'testing_reset',
          finishedAt: now,
        });
      else if (scan.status === 'dispatched')
        await ctx.db.patch(scan._id, {
          status: 'failed',
          usable: false,
          errorCode: 'testing_reset',
          finishedAt: now,
        });
      else if (scan.status === 'ready' && scan.usable !== false)
        await ctx.db.patch(scan._id, { usable: false });

      const draft = await ctx.db.get(scan.draftId);
      if (draft?.status === 'analyzing' && draft.scanId === scan._id)
        await ctx.db.patch(draft._id, {
          status: 'failed',
          errorCode: 'testing_reset',
          updatedAt: now,
        });
    }
    return { day, scansReset: scans.length };
  },
});

export const saveCaption = mutation({
  args: { submissionId: v.id('coachProofSubmissionsV1'), caption: v.string() },
  handler: async (ctx, { submissionId, caption }) => {
    const userId = await owner(ctx);
    if (!(await entitled(ctx, userId))) asError('Verified entitlement required');
    const submission = await ctx.db.get(submissionId);
    if (
      !submission ||
      submission.userId !== userId ||
      submission.category !== 'meals' ||
      submission.state !== 'uploaded' ||
      !submission.storageId ||
      submission.captureSource !== 'live_camera'
    )
      asError('Uploaded live meal photo required');
    if (submission.day !== (await today(ctx, userId))) asError('Meal day has changed');
    if (caption.length > 500) asError('Caption is too long');
    const drafts = await ctx.db
      .query('coachMealDraftsV1')
      .withIndex('by_submission', (q) => q.eq('submissionId', submissionId))
      .collect();
    const existing = drafts.find((d) => d.storageId === submission.storageId);
    if (existing) {
      if (existing.status === 'shared') return existing._id;
      await ctx.db.patch(existing._id, { caption: caption.trim(), updatedAt: Date.now() });
      return existing._id;
    }
    const revision = submission.planRevisionId ? await ctx.db.get(submission.planRevisionId) : null;
    const request = revision ? await ctx.db.get(revision.requestId) : null;
    const profile = request ? await ctx.db.get(request.profileRevisionId) : null;
    const goal = profile?.answers.goal ?? 'unavailable';
    const activities = await ctx.db
      .query('dailyActivities')
      .withIndex('by_user_date', (q) => q.eq('userId', userId).eq('date', submission.day))
      .collect();
    const workoutLoggedToday = activities.some(
      (a) =>
        (a.loggedActivityKey === 'workout' || a.loggedActivityKey === 'gym_workout') &&
        a.reviewStatus === 'approved'
    );
    const tones = await ctx.db
      .query('coachToneSettingsV1')
      .withIndex('by_version')
      .order('desc')
      .collect();
    const tone = tones.find(
      (setting) => setting.scope === 'meal_feedback' || setting.scope === 'both'
    );
    const now = Date.now();
    return await ctx.db.insert('coachMealDraftsV1', {
      userId,
      day: submission.day,
      submissionId,
      assignmentId: submission.assignmentId,
      planRevisionId: submission.planRevisionId,
      recommendation: submission.recommendation,
      storageId: submission.storageId,
      caption: caption.trim(),
      goal,
      workoutLoggedToday,
      promptVersion: MEAL_PROMPT_VERSION,
      toneVersion: tone?.version ?? 1,
      tone: tone?.tone ?? DEFAULT_COACH_TONE.tone,
      detail: tone?.detail ?? DEFAULT_COACH_TONE.detail,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const retake = mutation({
  args: { submissionId: v.id('coachProofSubmissionsV1') },
  handler: async (ctx, { submissionId }) => {
    const userId = await owner(ctx);
    const submission = await ctx.db.get(submissionId);
    if (
      !submission ||
      submission.userId !== userId ||
      submission.category !== 'meals' ||
      submission.state !== 'uploaded'
    )
      asError('Meal proof cannot be retaken');
    if (submission.day !== (await today(ctx, userId))) asError('Meal day has changed');
    const drafts = await ctx.db
      .query('coachMealDraftsV1')
      .withIndex('by_submission', (q) => q.eq('submissionId', submissionId))
      .collect();
    if (drafts.some((d) => d.status === 'shared' || d.status === 'analyzing'))
      asError('Meal is being analysed or already shared');
    for (const draft of drafts) {
      const scans = await ctx.db
        .query('coachMealScansV1')
        .withIndex('by_user_day', (q) => q.eq('userId', userId).eq('day', submission!.day))
        .collect();
      for (const scan of scans.filter((s) => s.draftId === draft._id && s.status === 'reserved'))
        await ctx.db.patch(scan._id, { status: 'released', finishedAt: Date.now() });
    }
    for (const draft of drafts)
      if (draft.storageId === submission!.storageId)
        await ctx.db.patch(draft._id, { status: 'superseded', updatedAt: Date.now() });
    await ctx.db.patch(submissionId, {
      state: 'reserved',
      storageId: undefined,
      captureToken: undefined,
      updatedAt: Date.now(),
    });
    return submissionId;
  },
});

export const reserveScan = internalMutation({
  args: { userId: v.id('users'), draftId: v.id('coachMealDraftsV1'), requestKey: v.string() },
  handler: async (ctx, { userId, draftId, requestKey }) => {
    if (!(await entitled(ctx, userId))) asError('Verified entitlement required');
    const draft = await ctx.db.get(draftId);
    if (
      !draft ||
      draft.userId !== userId ||
      draft.day !== (await today(ctx, userId)) ||
      draft.status === 'shared' ||
      draft.status === 'superseded'
    )
      asError('Meal draft unavailable');
    const submission = await ctx.db.get(draft.submissionId);
    if (
      !submission ||
      submission.userId !== userId ||
      submission.storageId !== draft.storageId ||
      submission.state !== 'uploaded'
    )
      asError('Meal image changed');
    const same = await ctx.db
      .query('coachMealScansV1')
      .withIndex('by_user_day_key', (q) =>
        q.eq('userId', userId).eq('day', draft.day).eq('requestKey', requestKey)
      )
      .unique();
    if (same) {
      if (same.draftId !== draftId) asError('Scan request belongs to another photo');
      return same._id;
    }
    if (draft.status === 'ready') asError('This photo has already been analysed');
    if (draft.status === 'analyzing') {
      const prior = draft.scanId ? await ctx.db.get(draft.scanId) : null;
      if (
        prior &&
        ((prior.status === 'reserved' && Date.now() - prior.reservedAt < RESERVATION_MS) ||
          (prior.status === 'dispatched' && Date.now() - (prior.dispatchedAt ?? 0) < DISPATCH_MS))
      )
        asError('This photo is already being analysed');
      // A stranded provider call releases the member-facing allowance.
      if (prior?.status === 'dispatched')
        await ctx.db.patch(prior._id, {
          status: 'failed',
          errorCode: 'provider_timeout',
          finishedAt: Date.now(),
        });
      if (prior?.status === 'reserved')
        await ctx.db.patch(prior._id, { status: 'released', finishedAt: Date.now() });
      await ctx.db.patch(draftId, {
        status: 'failed',
        errorCode: 'provider_timeout',
        updatedAt: Date.now(),
      });
    }
    const scans = await ctx.db
      .query('coachMealScansV1')
      .withIndex('by_user_day', (q) => q.eq('userId', userId).eq('day', draft.day))
      .collect();
    const now = Date.now();
    for (const scan of scans) {
      if (scan.status === 'reserved' && now - scan.reservedAt >= RESERVATION_MS)
        await ctx.db.patch(scan._id, { status: 'released', finishedAt: now });
      if (scan.status === 'dispatched' && now - (scan.dispatchedAt ?? now) >= DISPATCH_MS) {
        await ctx.db.patch(scan._id, {
          status: 'failed',
          errorCode: 'provider_timeout',
          finishedAt: now,
        });
        const stranded = await ctx.db.get(scan.draftId);
        if (stranded?.status === 'analyzing' && stranded.scanId === scan._id)
          await ctx.db.patch(stranded._id, {
            status: 'failed',
            errorCode: 'provider_timeout',
            updatedAt: now,
          });
      }
    }
    if (
      scans.some(
        (s) =>
          s.draftId === draftId && s.status === 'reserved' && now - s.reservedAt < RESERVATION_MS
      )
    )
      asError('This photo already has a pending scan');
    const successful = await usableScanCount(ctx, scans);
    if (
      scans.filter((s) => s.dispatchedAt && now - s.dispatchedAt < 3_600_000).length >=
      MAX_DISPATCHES_PER_HOUR
    )
      asError(
        'Meal analysis is temporarily paused after repeated attempts. Your successful scan allowance is unchanged; try again later.'
      );
    const pending = scans.filter(
      (s) =>
        (s.status === 'reserved' && now - s.reservedAt < RESERVATION_MS) ||
        (s.status === 'dispatched' && now - (s.dispatchedAt ?? now) < DISPATCH_MS)
    ).length;
    if (successful + pending >= 3)
      asError('Three successful meal scans are used or currently in progress');
    const activities = await ctx.db
      .query('dailyActivities')
      .withIndex('by_user_date', (q) => q.eq('userId', userId).eq('date', draft.day))
      .collect();
    const workoutLoggedToday = activities.some(
      (a) =>
        (a.loggedActivityKey === 'workout' || a.loggedActivityKey === 'gym_workout') &&
        a.reviewStatus === 'approved'
    );
    const tones = await ctx.db
      .query('coachToneSettingsV1')
      .withIndex('by_version')
      .order('desc')
      .collect();
    const tone = tones.find(
      (setting) => setting.scope === 'meal_feedback' || setting.scope === 'both'
    );
    await ctx.db.patch(draftId, {
      workoutLoggedToday,
      toneVersion: tone?.version ?? 1,
      tone: tone?.tone ?? DEFAULT_COACH_TONE.tone,
      detail: tone?.detail ?? DEFAULT_COACH_TONE.detail,
      updatedAt: Date.now(),
    });
    const id = await ctx.db.insert('coachMealScansV1', {
      userId,
      day: draft.day,
      draftId,
      requestKey,
      status: 'reserved',
      reservedAt: Date.now(),
    });
    return id;
  },
});
export const scanInput = internalQuery({
  args: { userId: v.id('users'), scanId: v.id('coachMealScansV1') },
  handler: async (ctx, { userId, scanId }) => {
    const scan = await ctx.db.get(scanId);
    if (!scan || scan.userId !== userId) asError('Scan does not belong to member');
    const draft = await ctx.db.get(scan.draftId);
    if (!draft || draft.userId !== userId) asError('Draft does not belong to member');
    const recentDrafts = await ctx.db
      .query('coachMealDraftsV1')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .order('desc')
      .take(50);
    const memberFeedback = recentDrafts
      .filter((item) => item.memberHelpful !== undefined)
      .sort((a, b) => (b.memberFeedbackAt ?? 0) - (a.memberFeedbackAt ?? 0))
      .slice(0, 8)
      .map((item) => ({
        report: item.feedback,
        verdict: item.verdict,
        helpful: item.memberHelpful,
        correction: item.memberCorrection,
      }));
    return { scan, draft, memberFeedback };
  },
});
export const claimDispatch = internalMutation({
  args: { userId: v.id('users'), scanId: v.id('coachMealScansV1') },
  handler: async (ctx, { userId, scanId }) => {
    const scan = await ctx.db.get(scanId);
    if (!scan || scan.userId !== userId) asError('Scan does not belong to member');
    if (scan.status !== 'reserved') return false;
    if (Date.now() - scan.reservedAt >= RESERVATION_MS) asError('Scan reservation expired');
    const all = await ctx.db
      .query('coachMealScansV1')
      .withIndex('by_user_day', (q) => q.eq('userId', userId).eq('day', scan.day))
      .collect();
    const successful = await usableScanCount(ctx, all);
    if (
      all.filter((s) => s.dispatchedAt && Date.now() - s.dispatchedAt < 3_600_000).length >=
      MAX_DISPATCHES_PER_HOUR
    )
      asError(
        'Meal analysis is temporarily paused after repeated attempts. Your successful scan allowance is unchanged; try again later.'
      );
    const otherPending = all.filter(
      (s) =>
        s._id !== scanId &&
        ((s.status === 'reserved' && Date.now() - s.reservedAt < RESERVATION_MS) ||
          (s.status === 'dispatched' && Date.now() - (s.dispatchedAt ?? 0) < DISPATCH_MS))
    ).length;
    if (successful + otherPending >= 3)
      asError('Three successful meal scans are used or currently in progress');
    const draft = await ctx.db.get(scan.draftId);
    const submission = draft ? await ctx.db.get(draft.submissionId) : null;
    if (
      !draft ||
      !submission ||
      draft.userId !== userId ||
      submission.storageId !== draft.storageId ||
      draft.status === 'superseded' ||
      (draft.status === 'analyzing' && draft.scanId !== scanId)
    )
      asError('Meal photo changed');
    const now = Date.now();
    await ctx.db.patch(scanId, { status: 'dispatched', dispatchedAt: now });
    await ctx.db.patch(draft._id, { status: 'analyzing', scanId, updatedAt: now });
    return true;
  },
});
export const finishScan = internalMutation({
  args: {
    userId: v.id('users'),
    scanId: v.id('coachMealScansV1'),
    result: v.optional(
      v.object({
        verdict: v.union(
          v.literal('On point'),
          v.literal('Nearly there'),
          v.literal('Room to improve'),
          v.null()
        ),
        feedback: v.string(),
      })
    ),
    errorCode: v.optional(v.string()),
    inputTokens: v.optional(v.number()),
    outputTokens: v.optional(v.number()),
    latencyMs: v.number(),
  },
  handler: async (ctx, args) => {
    const scan = await ctx.db.get(args.scanId);
    if (!scan || scan.userId !== args.userId || scan.status !== 'dispatched') return 'ignored';
    const draft = await ctx.db.get(scan.draftId);
    if (!draft || draft.userId !== args.userId || draft.scanId !== scan._id) return 'ignored';
    const now = Date.now();
    const unclear = Boolean(args.result?.verdict && UNCLEAR_IMAGE.test(args.result.feedback));
    const usable = Boolean(args.result?.verdict) && !unclear;
    await ctx.db.patch(scan._id, {
      status: args.result && !unclear ? 'ready' : 'failed',
      usable,
      finishedAt: now,
      errorCode: unclear ? 'unclear_image' : args.errorCode,
    });
    await ctx.db.patch(draft._id, {
      status: args.result && !unclear ? 'ready' : 'failed',
      verdict: args.result?.verdict,
      feedback: args.result?.feedback,
      errorCode: unclear ? 'unclear_image' : args.errorCode,
      inputTokens: args.inputTokens,
      outputTokens: args.outputTokens,
      latencyMs: args.latencyMs,
      updatedAt: now,
    });
    return unclear ? 'unclear' : args.result ? 'ready' : 'failed';
  },
});
export const releaseScan = internalMutation({
  args: { userId: v.id('users'), scanId: v.id('coachMealScansV1') },
  handler: async (ctx, { userId, scanId }) => {
    const scan = await ctx.db.get(scanId);
    if (scan?.userId === userId && scan.status === 'reserved')
      await ctx.db.patch(scanId, { status: 'released', finishedAt: Date.now() });
  },
});

export const share = mutation({
  args: {
    draftId: v.id('coachMealDraftsV1'),
    caption: v.string(),
    skipAnalysis: v.optional(v.boolean()),
  },
  handler: async (ctx, { draftId, caption, skipAnalysis }) => {
    const userId = await owner(ctx);
    const draft = await ctx.db.get(draftId);
    if (!draft || draft.userId !== userId) asError('Meal draft does not belong to member');
    if (draft.status === 'shared' && draft.postId && draft.activityId)
      return { postId: draft.postId, activityId: draft.activityId, pointsEarned: 2 };
    if (!(await entitled(ctx, userId))) asError('Verified entitlement required');
    if (draft.day !== (await today(ctx, userId))) asError('Meal day has changed');
    const analysed = draft.status === 'ready' && Boolean(draft.verdict && draft.feedback);
    if (!analysed && !skipAnalysis) asError('Meal analysis is not ready');
    if (skipAnalysis && !['draft', 'failed', 'ready'].includes(draft.status))
      asError('Wait for the current meal analysis before sharing');
    if (caption.length > 500) asError('Caption is too long');
    const submission = await ctx.db.get(draft.submissionId);
    const assignment = submission ? await ctx.db.get(submission.assignmentId) : null;
    const revision = submission?.planRevisionId
      ? await ctx.db.get(submission.planRevisionId)
      : null;
    if (
      !submission ||
      !assignment ||
      submission.userId !== userId ||
      assignment.userId !== userId ||
      (submission.planRevisionId && (!revision || revision.userId !== userId)) ||
      submission.state !== 'uploaded' ||
      submission.category !== 'meals' ||
      submission.storageId !== draft.storageId ||
      submission.captureSource !== 'live_camera' ||
      draft.assignmentId !== submission.assignmentId ||
      draft.planRevisionId !== submission.planRevisionId ||
      draft.recommendation !== submission.recommendation ||
      assignment.planRevisionId !== submission.planRevisionId ||
      assignment.recommendation !== submission.recommendation ||
      assignment.day !== draft.day
    )
      asError('Pinned meal proof context changed');
    const scan = draft.scanId ? await ctx.db.get(draft.scanId) : null;
    if (analysed && (!scan || scan.userId !== userId || scan.status !== 'ready'))
      asError('Verified meal scan required');
    const slot = await ctx.db
      .query('coachRewardSlotsV1')
      .withIndex('by_user_key', (q) => q.eq('userId', userId).eq('key', submission.slotKey))
      .unique();
    if (
      !slot ||
      slot.submissionId !== submission._id ||
      slot.state !== 'reserved' ||
      slot.category !== 'meals' ||
      slot.ordinal > 3 ||
      submission.slotKey !== rewardSlotKey(draft.day, 'meals', slot.ordinal)
    )
      asError('Meal reward slot unavailable');
    const activities = await ctx.db
      .query('dailyActivities')
      .withIndex('by_user_date', (q) => q.eq('userId', userId).eq('date', draft.day))
      .collect();
    if (
      activities.filter(
        (a) => a.loggedActivityKey === 'healthy_meal' && a.reviewStatus !== 'rejected'
      ).length >= 3
    )
      asError('Three meals already shared today');
    const now = Date.now();
    const activityId = await ctx.db.insert('dailyActivities', {
      userId,
      date: draft.day,
      steps: 0,
      zone2Minutes: 0,
      points: 2,
      displayTotalPoints: 2,
      missionPoints: 0,
      synced: false,
      reviewStatus: 'approved',
      loggedActivityKey: 'healthy_meal',
      activitySubmissionType: 'take_photo',
      image: draft.storageId,
      coachSubmissionId: submission._id,
    });
    const postId = await ctx.db.insert('posts', {
      userId,
      createdAt: now,
      body: caption.trim(),
      media: draft.storageId,
      mediaType: 'image',
      activityId,
    });
    await ctx.db.patch(slot._id, { state: 'earned', pointsEarned: 2 });
    await ctx.db.patch(submission._id, {
      state: 'completed',
      activityId,
      completedAt: now,
      updatedAt: now,
    });
    await ctx.db.patch(draftId, {
      status: 'shared',
      caption: caption.trim(),
      activityId,
      postId,
      updatedAt: now,
    });
    await ctx.db.insert('coachProofEventsV1', {
      userId,
      submissionId: submission._id,
      day: draft.day,
      action: 'completed',
      points: 2,
      activityId,
      at: now,
    });
    await ctx.scheduler.runAfter(0, internal.leaderboard.updateMonthlyLeaderboard, {
      userId,
      yearMonth: draft.day.slice(0, 7),
    });
    await ctx.runMutation(internal.track.recompute.recomputeTrackForDate, {
      userId,
      date: draft.day,
    });
    return { postId, activityId, pointsEarned: 2 };
  },
});

export const submitReportFeedback = mutation({
  args: {
    draftId: v.id('coachMealDraftsV1'),
    helpful: v.boolean(),
    correction: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await owner(ctx);
    const draft = await ctx.db.get(args.draftId);
    if (!draft || draft.userId !== userId) asError('Meal report not found');
    if (!draft.feedback || !['ready', 'shared'].includes(draft.status))
      asError('Meal report is not ready');
    const correction = args.correction?.trim() ?? '';
    if (correction.length > 500) asError('Please keep feedback to 500 characters');
    await ctx.db.patch(draft._id, {
      memberHelpful: args.helpful,
      memberCorrection: correction,
      memberFeedbackAt: Date.now(),
    });
  },
});
