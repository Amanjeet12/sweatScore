import { getAuthUserId } from '@convex-dev/auth/server';
import { ConvexError, v } from 'convex/values';
import {
  mutation,
  query,
  internalMutation,
  internalQuery,
  MutationCtx,
  QueryCtx,
} from './_generated/server';
import { internal } from './_generated/api';
import { Id } from './_generated/dataModel';
import { formatDateInTZ } from './utils/timezone';
import { rewardSlotKey } from '../shared/coachFoundation';

const category = v.union(
  v.literal('workout'),
  v.literal('meals'),
  v.literal('sleep'),
  v.literal('steps')
);
const POINTS = { workout: 5, meals: 2, sleep: 4, steps: 3 } as const;
const DEFAULT_ASSIGNMENTS = [
  { category: 'workout', label: 'Log a workout', recommendation: 'Log a workout' },
  { category: 'meals', label: 'Log Your Meals', recommendation: 'Log a meal' },
  {
    category: 'sleep',
    label: 'Aim for 7 Hours Sleep',
    recommendation: '7 hours sleep',
    sleepTargetHours: 7,
  },
  {
    category: 'steps',
    label: 'Hit 10,000 Steps',
    recommendation: '10,000 steps',
    stepTarget: 10000,
  },
] as const;

async function owner(ctx: QueryCtx | MutationCtx) {
  const userId = await getAuthUserId(ctx);
  if (!userId || !(await ctx.db.get(userId))) throw new ConvexError('Authentication required');
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
  const user = await ctx.db.get(userId);
  return formatDateInTZ(new Date(), user?.timezone);
}

// A plan revision is the sole source of current guidance. Older in-flight submissions
// are read through mySubmission, never silently rebound to this latest revision.
export const myToday = query({
  args: { refresh: v.optional(v.number()) },
  handler: async (ctx) => {
    const userId = await owner(ctx);
    const day = await today(ctx, userId);
    if (!(await entitled(ctx, userId))) return { day, status: 'locked' as const, assignments: [] };
    const revision = await ctx.db
      .query('coachPlanRevisionsV1')
      .withIndex('by_user_day_version', (q) => q.eq('userId', userId).eq('day', day))
      .order('desc')
      .first();
    const [assignments, slots] = await Promise.all([
      ctx.db
        .query('coachAssignmentsV1')
        .withIndex('by_user_day', (q) => q.eq('userId', userId).eq('day', day))
        .collect(),
      ctx.db
        .query('coachRewardSlotsV1')
        .withIndex('by_user_day', (q) => q.eq('userId', userId).eq('day', day))
        .collect(),
    ]);
    return {
      day,
      status: revision ? ('ready' as const) : ('no_plan' as const),
      assignments: await Promise.all(
        assignments
          .filter((item) => item.planRevisionId === revision?._id)
          .map(async (item) => ({
            ...item,
            mandatory: item.category !== 'workout' || item.workout?.type !== 'rest',
            earnedCount: slots.filter(
              (slot) => slot.category === item.category && slot.state === 'earned'
            ).length,
            consumedCount: Math.max(
              await legacyCount(ctx, userId, day, item.category),
              slots.filter((slot) => slot.category === item.category && slot.state !== 'reserved')
                .length
            ),
            occupiedCount: slots.filter((slot) => slot.category === item.category).length,
          }))
      ),
    };
  },
});

// Fixed check-ins have their own daily assignments. They do not create a plan.
export const ensureStandaloneAssignments = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await owner(ctx);
    if (!(await entitled(ctx, userId))) throw new ConvexError('Verified entitlement required');
    const day = await today(ctx, userId);
    const revision = await ctx.db
      .query('coachPlanRevisionsV1')
      .withIndex('by_user_day_version', (q) => q.eq('userId', userId).eq('day', day))
      .order('desc')
      .first();
    if (revision) return;
    const existing = await ctx.db
      .query('coachAssignmentsV1')
      .withIndex('by_user_day', (q) => q.eq('userId', userId).eq('day', day))
      .collect();
    for (const item of DEFAULT_ASSIGNMENTS) {
      if (existing.some((row) => row.category === item.category && !row.planRevisionId)) continue;
      await ctx.db.insert('coachAssignmentsV1', {
        userId,
        day,
        ...item,
        createdAt: Date.now(),
      });
    }
  },
});

export const mySubmission = query({
  args: { submissionId: v.id('coachProofSubmissionsV1') },
  handler: async (ctx, { submissionId }) => {
    const userId = await owner(ctx);
    if (!(await entitled(ctx, userId))) throw new ConvexError('Verified entitlement required');
    const submission = await ctx.db.get(submissionId);
    if (!submission || submission.userId !== userId)
      throw new ConvexError('Submission does not belong to member');
    return submission;
  },
});

export const myProofImage = query({
  args: { submissionId: v.id('coachProofSubmissionsV1') },
  handler: async (ctx, { submissionId }) => {
    const userId = await owner(ctx);
    if (!(await entitled(ctx, userId))) throw new ConvexError('Verified entitlement required');
    const submission = await ctx.db.get(submissionId);
    if (!submission || submission.userId !== userId)
      throw new ConvexError('Submission does not belong to member');
    return submission.storageId ? await ctx.storage.getUrl(submission.storageId) : null;
  },
});

export const saveCaption = mutation({
  args: { submissionId: v.id('coachProofSubmissionsV1'), caption: v.string() },
  handler: async (ctx, { submissionId, caption }) => {
    const userId = await owner(ctx);
    const submission = await ctx.db.get(submissionId);
    if (!submission || submission.userId !== userId || submission.category === 'meals')
      throw new ConvexError('Check-in does not belong to member');
    if (submission.state === 'completed') return submissionId;
    if (submission.state === 'reversed' || submission.day !== (await today(ctx, userId)))
      throw new ConvexError('Check-in is no longer editable');
    if (caption.length > 500) throw new ConvexError('Caption is too long');
    await ctx.db.patch(submissionId, { caption: caption.trim(), updatedAt: Date.now() });
    return submissionId;
  },
});

export const retakeProof = mutation({
  args: { submissionId: v.id('coachProofSubmissionsV1') },
  handler: async (ctx, { submissionId }) => {
    const userId = await owner(ctx);
    const submission = await ctx.db.get(submissionId);
    if (!submission || submission.userId !== userId || submission.category === 'meals')
      throw new ConvexError('Check-in does not belong to member');
    if (
      submission.day !== (await today(ctx, userId)) ||
      submission.state === 'completed' ||
      submission.state === 'reversed'
    )
      throw new ConvexError('Check-in cannot be retaken');
    await ctx.db.patch(submissionId, {
      state: 'reserved',
      storageId: undefined,
      captureToken: undefined,
      updatedAt: Date.now(),
    });
    return submissionId;
  },
});

export const issueUpload = mutation({
  args: {
    submissionId: v.id('coachProofSubmissionsV1'),
    mediaType: v.optional(v.union(v.literal('image'), v.literal('video'))),
  },
  handler: async (ctx, { submissionId, mediaType }) => {
    const userId = await owner(ctx);
    if (!(await entitled(ctx, userId))) throw new ConvexError('Verified entitlement required');
    const submission = await ctx.db.get(submissionId);
    if (!submission || submission.userId !== userId)
      throw new ConvexError('Submission does not belong to member');
    if (
      submission.state !== 'reserved' &&
      submission.state !== 'failed' &&
      submission.state !== 'cancelled'
    )
      throw new ConvexError('Submission is no longer awaiting proof');
    if (submission.day !== (await today(ctx, userId)))
      throw new ConvexError('Proof day has changed');
    if (mediaType === 'video' && submission.category !== 'workout')
      throw new ConvexError('Video is available only for workout proof');
    const token = crypto.randomUUID();
    await ctx.db.patch(submissionId, {
      captureToken: token,
      captureSource: 'live_camera',
      mediaType: mediaType ?? 'image',
      uploadIssuedAt: Date.now(),
      state: 'reserved',
      updatedAt: Date.now(),
    });
    return { token };
  },
});

export const authorizeUpload = internalQuery({
  args: { userId: v.id('users'), submissionId: v.id('coachProofSubmissionsV1'), token: v.string() },
  handler: async (ctx, { userId, submissionId, token }) => {
    const submission = await ctx.db.get(submissionId);
    return Boolean(
      submission &&
      submission.userId === userId &&
      submission.state === 'reserved' &&
      submission.captureToken === token &&
      submission.captureSource === 'live_camera' &&
      submission.uploadIssuedAt &&
      submission.day === (await today(ctx, userId)) &&
      (await entitled(ctx, userId))
    );
  },
});

// Only the authenticated HTTP upload handler may bind stored bytes to proof.
export const attachUploadedInternal = internalMutation({
  args: {
    userId: v.id('users'),
    submissionId: v.id('coachProofSubmissionsV1'),
    token: v.string(),
    storageId: v.id('_storage'),
  },
  handler: async (ctx, { userId, submissionId, token, storageId }) => {
    if (!(await entitled(ctx, userId))) throw new ConvexError('Verified entitlement required');
    const submission = await ctx.db.get(submissionId);
    if (!submission || submission.userId !== userId)
      throw new ConvexError('Submission does not belong to member');
    if (submission.state === 'uploaded' && submission.storageId === storageId) return submissionId;
    if (
      submission.state !== 'reserved' ||
      submission.captureToken !== token ||
      submission.captureSource !== 'live_camera' ||
      !submission.uploadIssuedAt
    )
      throw new ConvexError('Capture session does not match submission');
    if (submission.day !== (await today(ctx, userId)))
      throw new ConvexError('Proof day has changed');
    const media = await ctx.db.system.get(storageId);
    if (
      !media ||
      media._creationTime < submission.uploadIssuedAt ||
      !(submission.mediaType === 'video'
        ? submission.category === 'workout' &&
          (media.contentType === 'video/mp4' || media.contentType === 'video/quicktime')
        : media.contentType?.startsWith('image/')) ||
      media.size <= 0
    )
      throw new ConvexError('A fresh camera photo or video is required');
    const used = await ctx.db
      .query('coachProofSubmissionsV1')
      .withIndex('by_storage', (q) => q.eq('storageId', storageId))
      .first();
    if (used && used._id !== submissionId) throw new ConvexError('Proof media is already attached');
    await ctx.db.patch(submissionId, { storageId, state: 'uploaded', updatedAt: Date.now() });
    return submissionId;
  },
});

async function legacyCount(
  ctx: MutationCtx | QueryCtx,
  userId: Id<'users'>,
  day: string,
  kind: keyof typeof POINTS
) {
  const activities = await ctx.db
    .query('dailyActivities')
    .withIndex('by_user_date', (q) => q.eq('userId', userId).eq('date', day))
    .collect();
  const keys =
    kind === 'workout' ? ['workout', 'gym_workout'] : kind === 'meals' ? ['healthy_meal'] : [kind];
  const count = activities.filter(
    (item) =>
      item.loggedActivityKey && keys.includes(item.loggedActivityKey) && !item.coachSubmissionId
  ).length;
  if (kind !== 'workout') return count;
  const completions = await ctx.db
    .query('challengeCompletions')
    .withIndex('by_user_date', (q) => q.eq('userId', userId).eq('date', day))
    .collect();
  for (const completion of completions) {
    const challenge = await ctx.db.get(completion.challengeId);
    if (challenge?.type === 'check_in') return Math.max(1, count);
  }
  return count;
}

// Meals are deliberately excluded. Stage 6 must atomically analyze, share and
// award their slots; uploading a meal photo here only prepares that future flow.
export const complete = mutation({
  args: { submissionId: v.id('coachProofSubmissionsV1'), caption: v.optional(v.string()) },
  handler: async (ctx, { submissionId, caption }) => {
    const userId = await owner(ctx);
    const submission = await ctx.db.get(submissionId);
    if (!submission || submission.userId !== userId)
      throw new ConvexError('Submission does not belong to member');
    if (submission.state === 'completed')
      return {
        pointsEarned: POINTS[submission.category],
        activityId: submission.activityId,
        postId: submission.postId,
      };
    if (submission.category === 'meals')
      throw new ConvexError('Meal sharing requires photo analysis');
    if (
      submission.state !== 'uploaded' ||
      !submission.storageId ||
      submission.captureSource !== 'live_camera'
    )
      throw new ConvexError('Uploaded live proof required');
    if (submission.day !== (await today(ctx, userId)))
      throw new ConvexError('Proof day has changed');
    if (!(await entitled(ctx, userId))) throw new ConvexError('Verified entitlement required');
    if ((caption ?? submission.caption ?? '').length > 500)
      throw new ConvexError('Caption is too long');
    const assignment = await ctx.db.get(submission.assignmentId);
    const revision = submission.planRevisionId ? await ctx.db.get(submission.planRevisionId) : null;
    if (
      !assignment ||
      assignment.userId !== userId ||
      (submission.planRevisionId && (!revision || revision.userId !== userId)) ||
      assignment.planRevisionId !== submission.planRevisionId ||
      assignment.day !== submission.day ||
      assignment.category !== submission.category ||
      assignment.recommendation !== submission.recommendation ||
      (submission.category === 'workout' && assignment.workout?.type === 'rest')
    )
      throw new ConvexError('Saved proof context is invalid');
    const slot = await ctx.db
      .query('coachRewardSlotsV1')
      .withIndex('by_user_key', (q) => q.eq('userId', userId).eq('key', submission.slotKey))
      .unique();
    if (
      !slot ||
      slot.submissionId !== submissionId ||
      slot.state !== 'reserved' ||
      submission.slotKey !== rewardSlotKey(submission.day, submission.category, slot.ordinal)
    )
      throw new ConvexError('Reward slot is no longer available');
    if (await legacyCount(ctx, userId, submission.day, submission.category))
      throw new ConvexError('Legacy activity already consumed this category');
    const points = POINTS[submission.category];
    const now = Date.now();
    const activityId = await ctx.db.insert('dailyActivities', {
      userId,
      date: submission.day,
      steps: 0,
      zone2Minutes: 0,
      points,
      displayTotalPoints: points,
      missionPoints: 0,
      synced: false,
      reviewStatus: 'approved',
      loggedActivityKey: submission.category === 'workout' ? 'workout' : submission.category,
      activitySubmissionType: submission.mediaType === 'video' ? 'record_video' : 'take_photo',
      image: submission.mediaType === 'video' ? undefined : submission.storageId,
      coachSubmissionId: submissionId,
    });
    const postId = await ctx.db.insert('posts', {
      userId,
      createdAt: now,
      body: (caption ?? submission.caption ?? '').trim(),
      media: submission.storageId,
      mediaType: submission.mediaType === 'video' ? 'video' : 'image',
      activityId,
    });
    await ctx.db.patch(submissionId, {
      state: 'completed',
      activityId,
      postId,
      caption: (caption ?? submission.caption ?? '').trim(),
      completedAt: now,
      updatedAt: now,
    });
    await ctx.db.patch(slot._id, { state: 'earned', pointsEarned: points });
    await ctx.db.insert('coachProofEventsV1', {
      userId,
      submissionId,
      day: submission.day,
      action: 'completed',
      points,
      activityId,
      at: now,
    });
    await ctx.scheduler.runAfter(0, internal.leaderboard.updateMonthlyLeaderboard, {
      userId,
      yearMonth: submission.day.slice(0, 7),
    });
    await ctx.runMutation(internal.track.recompute.recomputeTrackForDate, {
      userId,
      date: submission.day,
    });
    return { pointsEarned: points, activityId, postId };
  },
});

export const cancel = mutation({
  args: { submissionId: v.id('coachProofSubmissionsV1') },
  handler: async (ctx, { submissionId }) => {
    const userId = await owner(ctx);
    const submission = await ctx.db.get(submissionId);
    if (!submission || submission.userId !== userId)
      throw new ConvexError('Submission does not belong to member');
    if (submission.state === 'completed' || submission.state === 'reversed')
      throw new ConvexError('Completed proof cannot be cancelled');
    await ctx.db.patch(submissionId, { state: 'cancelled', updatedAt: Date.now() });
    // The slot remains reserved. Reopening capture reuses this pinned context.
    return submissionId;
  },
});

export const reverseMine = mutation({
  args: { submissionId: v.id('coachProofSubmissionsV1') },
  handler: async (ctx, { submissionId }) => {
    const userId = await owner(ctx);
    const submission = await ctx.db.get(submissionId);
    if (!submission || submission.userId !== userId)
      throw new ConvexError('Submission does not belong to member');
    if (submission.state === 'reversed') return submissionId;
    if (submission.state !== 'completed' || !submission.activityId)
      throw new ConvexError('No completion to reverse');
    const activity = await ctx.db.get(submission.activityId);
    if (!activity || activity.coachSubmissionId !== submissionId || activity.userId !== userId)
      throw new ConvexError('Completion activity does not match proof');
    const now = Date.now();
    await ctx.db.patch(activity._id, {
      points: 0,
      displayTotalPoints: 0,
      reviewStatus: 'rejected',
    });
    await ctx.db.patch(submissionId, { state: 'reversed', reversedAt: now, updatedAt: now });
    await ctx.db.insert('coachProofEventsV1', {
      userId,
      submissionId,
      day: submission.day,
      action: 'reversed',
      points: -POINTS[submission.category],
      activityId: activity._id,
      at: now,
    });
    await ctx.scheduler.runAfter(0, internal.leaderboard.updateMonthlyLeaderboard, {
      userId,
      yearMonth: submission.day.slice(0, 7),
    });
    await ctx.runMutation(internal.track.recompute.recomputeTrackForDate, {
      userId,
      date: submission.day,
    });
    return submissionId;
  },
});
