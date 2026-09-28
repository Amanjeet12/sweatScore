import { v } from 'convex/values';
import { internal } from './_generated/api';
import { Doc, Id } from './_generated/dataModel';
import { internalMutation, MutationCtx } from './_generated/server';

// A single Convex mutation makes this development reset atomic. If it fails,
// none of its deletes commit; if it succeeds, the fixed ledger key makes a
// repeated invocation return the original counts without deleting new data.
const TARGET = 'beloved-stoat-88' as const;
const KEY = 'all-member-coach-data-2026-09-28';
const TABLES = [
  'coachOnboardingV1',
  'coachProfileRevisionsV1',
  'coachWeightObservationsV1',
  'coachDailyAnswersV1',
  'coachPlanRequestsV1',
  'coachPlanRevisionsV1',
  'coachAssignmentsV1',
  'coachProofSubmissionsV1',
  'coachProofEventsV1',
  'coachRewardSlotsV1',
  'coachMealDraftsV1',
  'coachMealScansV1',
  'coachProfiles',
  'coachDailyPlans',
] as const;

function assertDevelopmentTarget(target: string) {
  if (target !== TARGET || process.env.COACH_DEV_CLEAR_ALLOWED !== TARGET)
    throw new Error('Development Coach cleanup is not enabled for this deployment');
}

async function coachRows(ctx: MutationCtx) {
  return {
    coachOnboardingV1: await ctx.db.query('coachOnboardingV1').collect(),
    coachProfileRevisionsV1: await ctx.db.query('coachProfileRevisionsV1').collect(),
    coachWeightObservationsV1: await ctx.db.query('coachWeightObservationsV1').collect(),
    coachDailyAnswersV1: await ctx.db.query('coachDailyAnswersV1').collect(),
    coachPlanRequestsV1: await ctx.db.query('coachPlanRequestsV1').collect(),
    coachPlanRevisionsV1: await ctx.db.query('coachPlanRevisionsV1').collect(),
    coachAssignmentsV1: await ctx.db.query('coachAssignmentsV1').collect(),
    coachProofSubmissionsV1: await ctx.db.query('coachProofSubmissionsV1').collect(),
    coachProofEventsV1: await ctx.db.query('coachProofEventsV1').collect(),
    coachRewardSlotsV1: await ctx.db.query('coachRewardSlotsV1').collect(),
    coachMealDraftsV1: await ctx.db.query('coachMealDraftsV1').collect(),
    coachMealScansV1: await ctx.db.query('coachMealScansV1').collect(),
    coachProfiles: await ctx.db.query('coachProfiles').collect(),
    coachDailyPlans: await ctx.db.query('coachDailyPlans').collect(),
  };
}

function counts(rows: Awaited<ReturnType<typeof coachRows>>): Record<string, number> {
  return Object.fromEntries(TABLES.map((table) => [table, rows[table].length]));
}

export const clearAllCoachMemberData = internalMutation({
  args: { target: v.literal(TARGET) },
  handler: async (ctx, { target }) => {
    assertDevelopmentTarget(target);
    const previous = await ctx.db
      .query('coachDevCleanupRunsV1')
      .withIndex('by_key', (q) => q.eq('key', KEY))
      .unique();
    if (previous) return previous;

    const startedAt = Date.now();
    const rows = await coachRows(ctx);
    const beforeCounts = counts(rows);
    const proofIds = new Set(rows.coachProofSubmissionsV1.map((row) => String(row._id)));
    const activities = new Map<string, Doc<'dailyActivities'>>();
    const posts = new Map<string, Doc<'posts'>>();
    const affected = new Map<string, { userId: Id<'users'>; day: string }>();
    let coachPointsRemoved = 0;

    for (const proof of rows.coachProofSubmissionsV1) {
      const linked = await ctx.db
        .query('dailyActivities')
        .withIndex('by_coach_submission', (q) => q.eq('coachSubmissionId', proof._id))
        .collect();
      if (proof.activityId && !linked.some((row) => row._id === proof.activityId))
        throw new Error('Coach proof has an unverified activity link');
      for (const activity of linked) {
        if (activity.userId !== proof.userId || activity.date !== proof.day)
          throw new Error('Coach activity owner/day mismatch');
        activities.set(String(activity._id), activity);
      }
    }
    for (const draft of rows.coachMealDraftsV1) {
      if (draft.activityId && !activities.has(String(draft.activityId)))
        throw new Error('Coach meal has an unverified activity link');
      if (!proofIds.has(String(draft.submissionId)))
        throw new Error('Coach meal has no matching proof');
    }
    for (const activity of activities.values()) {
      coachPointsRemoved += activity.displayTotalPoints ?? activity.points;
      affected.set(`${activity.userId}:${activity.date}`, {
        userId: activity.userId,
        day: activity.date,
      });
      const linked = await ctx.db
        .query('posts')
        .withIndex('by_activity', (q) => q.eq('activityId', activity._id))
        .collect();
      for (const post of linked) {
        if (post.userId !== activity.userId || post.challengeCompletionId)
          throw new Error('Coach post has an ambiguous activity or challenge link');
        posts.set(String(post._id), post);
      }
    }
    for (const proof of rows.coachProofSubmissionsV1) {
      if (proof.postId && !posts.has(String(proof.postId)))
        throw new Error('Coach proof has an unverified post link');
    }
    for (const draft of rows.coachMealDraftsV1) {
      if (draft.postId && !posts.has(String(draft.postId)))
        throw new Error('Coach meal has an unverified post link');
    }
    for (const post of posts.values()) {
      const [comments, likes, reports] = await Promise.all([
        ctx.db
          .query('postComments')
          .withIndex('by_post', (q) => q.eq('postId', post._id))
          .collect(),
        ctx.db
          .query('postLikes')
          .withIndex('by_post', (q) => q.eq('postId', post._id))
          .collect(),
        ctx.db
          .query('postReports')
          .withIndex('by_post', (q) => q.eq('postId', post._id))
          .collect(),
      ]);
      if (comments.length || likes.length || reports.length)
        throw new Error('Coach post has member interactions requiring manual review');
    }

    const media = new Set<Id<'_storage'>>();
    for (const proof of rows.coachProofSubmissionsV1)
      if (proof.storageId) media.add(proof.storageId);
    for (const draft of rows.coachMealDraftsV1) media.add(draft.storageId);
    for (const storageId of media) {
      const [usingActivities, usingPosts] = await Promise.all([
        ctx.db
          .query('dailyActivities')
          .withIndex('by_image', (q) => q.eq('image', storageId))
          .collect(),
        ctx.db
          .query('posts')
          .withIndex('by_media', (q) => q.eq('media', storageId))
          .collect(),
      ]);
      if (
        usingActivities.some((row) => !activities.has(String(row._id))) ||
        usingPosts.some((row) => !posts.has(String(row._id)))
      )
        throw new Error('Coach media is also used by unrelated content');
      const progress = await ctx.db.query('progressPhotos').collect();
      if (progress.some((row) => row.frontPhoto === storageId || row.sidePhoto === storageId))
        throw new Error('Coach media is also used by progress photos');
    }

    // Validation above completes before the first mutation. Convex then commits
    // these effects and the ledger atomically.
    for (const post of posts.values()) await ctx.db.delete(post._id);
    for (const activity of activities.values()) await ctx.db.delete(activity._id);
    for (const table of TABLES) for (const row of rows[table]) await ctx.db.delete(row._id);
    for (const storageId of media) await ctx.storage.delete(storageId);
    for (const { userId, day } of affected.values()) {
      await ctx.runMutation(internal.track.recompute.recomputeTrackForDate, { userId, date: day });
      await ctx.scheduler.runAfter(0, internal.leaderboard.updateMonthlyLeaderboard, {
        userId,
        yearMonth: day.slice(0, 7),
      });
    }
    const afterCounts = counts(await coachRows(ctx));
    const completedAt = Date.now();
    const id = await ctx.db.insert('coachDevCleanupRunsV1', {
      key: KEY,
      deployment: TARGET,
      status: 'complete',
      beforeCounts,
      afterCounts,
      linkedActivitiesRemoved: activities.size,
      linkedPostsRemoved: posts.size,
      linkedMediaRemoved: media.size,
      coachPointsRemoved,
      startedAt,
      completedAt,
    });
    return (await ctx.db.get(id))!;
  },
});
