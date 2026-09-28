import { v } from 'convex/values';
import { paginationOptsValidator } from 'convex/server';
import { internalQuery } from './_generated/server';
import { assertDay } from '../shared/coachFoundation';

// Read-only, scoped inventory for a later migration dry run. Never writes or infers plan ownership.
export const forMemberDay = internalQuery({
  args: { userId: v.id('users'), day: v.string() },
  handler: async (ctx, { userId, day }) => {
    assertDay(day);
    const [completions, activities, oldPlans, oldProfile, newSlots, newSubmissions] =
      await Promise.all([
        ctx.db
          .query('challengeCompletions')
          .withIndex('by_user_date', (q) => q.eq('userId', userId).eq('date', day))
          .collect(),
        ctx.db
          .query('dailyActivities')
          .withIndex('by_user_date', (q) => q.eq('userId', userId).eq('date', day))
          .collect(),
        ctx.db
          .query('coachDailyPlans')
          .withIndex('by_user_date', (q) => q.eq('userId', userId).eq('date', day))
          .collect(),
        ctx.db
          .query('coachProfiles')
          .withIndex('by_user', (q) => q.eq('userId', userId))
          .collect(),
        ctx.db
          .query('coachRewardSlotsV1')
          .withIndex('by_user_day', (q) => q.eq('userId', userId).eq('day', day))
          .collect(),
        ctx.db
          .query('coachProofSubmissionsV1')
          .withIndex('by_user_day', (q) => q.eq('userId', userId).eq('day', day))
          .collect(),
      ]);
    const challengeTypes = await Promise.all(
      completions.map(async (item) => {
        const challenge = await ctx.db.get(item.challengeId);
        return {
          id: item._id,
          challengeId: item.challengeId,
          challengeType: challenge?.type ?? 'unknown',
          dailyChallengeType: challenge?.dailyChallengeType ?? 'unknown',
          pointsEarned: item.pointsEarned,
          removed: item.removed ?? false,
          hasMedia: Boolean(item.videoStorageId),
          context: 'legacy_unknown' as const,
        };
      })
    );
    return {
      userId,
      day,
      completions: challengeTypes,
      activities: activities.map((item) => ({
        id: item._id,
        loggedActivityKey: item.loggedActivityKey ?? 'unknown',
        points: item.points,
        synced: item.synced,
        hasImage: Boolean(item.image),
        context: 'legacy_unknown' as const,
      })),
      oldPlans: oldPlans.map((item) => ({
        id: item._id,
        status: item.status,
        profileVersion: 'unknown' as const,
        context: 'legacy_unknown' as const,
      })),
      oldProfile: oldProfile.map((item) => ({
        id: item._id,
        profileVersion: item.profileVersion,
        updatedAt: item.updatedAt,
        hasWeight: item.currentWeight !== undefined,
        context: 'legacy_unknown' as const,
      })),
      newSlots: newSlots.map((item) => ({
        key: item.key,
        state: item.state,
        source: item.legacySource ?? null,
      })),
      newSubmissions: newSubmissions.map((item) => ({
        id: item._id,
        state: item.state,
        category: item.category,
        slotKey: item.slotKey,
        hasStorage: Boolean(item.storageId),
      })),
      deviceQueue: 'not_server_visible' as const,
    };
  },
});

// Stage 8 dry-run source. Page one table at a time so large activity histories
// can be resumed from a cursor. The result contains only reconciliation fields,
// never media URLs, captions, raw health context or member profile answers.
// This query deliberately cannot write slots, points, posts or a migration ledger.
export const migrationPage = internalQuery({
  args: {
    source: v.union(
      v.literal('challenges'),
      v.literal('checkInCategories'),
      v.literal('challengeCompletions'),
      v.literal('dailyActivities'),
      v.literal('coachRewardSlotsV1'),
      v.literal('coachProofSubmissionsV1'),
      v.literal('posts')
    ),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, { source, paginationOpts }) => {
    switch (source) {
      case 'challenges': {
        const page = await ctx.db.query('challenges').paginate(paginationOpts);
        return {
          ...page,
          page: page.page.map((x) => ({
            id: x._id,
            type: x.type ?? 'unknown',
            categoryId: x.checkInCategoryId ?? null,
            legacyCategoryIds: x.checkInCategoryIds ?? [],
            isDailyChallenge: x.isDailyChallenge ?? false,
            dailyStartAt: x.dailyStartAt ?? null,
            dailyEndAt: x.dailyEndAt ?? null,
            published: x.isPublished,
          })),
        };
      }
      case 'checkInCategories': {
        const page = await ctx.db.query('checkInCategories').paginate(paginationOpts);
        return {
          ...page,
          page: page.page.map((x) => ({ id: x._id, name: x.name, active: x.isActive })),
        };
      }
      case 'challengeCompletions': {
        const page = await ctx.db.query('challengeCompletions').paginate(paginationOpts);
        return {
          ...page,
          page: page.page.map((x) => ({
            id: x._id,
            userId: x.userId,
            challengeId: x.challengeId,
            day: x.date,
            points: x.pointsEarned,
            removed: x.removed ?? false,
            windowStartAt: x.dailyWindowStartAt ?? null,
            hasMedia: Boolean(x.videoStorageId),
            createdAt: x._creationTime,
          })),
        };
      }
      case 'dailyActivities': {
        const page = await ctx.db.query('dailyActivities').paginate(paginationOpts);
        return {
          ...page,
          page: page.page.map((x) => ({
            id: x._id,
            userId: x.userId,
            day: x.date,
            key: x.loggedActivityKey ?? 'unknown',
            points: x.points,
            synced: x.synced,
            status: x.reviewStatus ?? 'unknown',
            coachSubmissionId: x.coachSubmissionId ?? null,
            createdAt: x._creationTime,
          })),
        };
      }
      case 'coachRewardSlotsV1': {
        const page = await ctx.db.query('coachRewardSlotsV1').paginate(paginationOpts);
        return {
          ...page,
          page: page.page.map((x) => ({
            id: x._id,
            userId: x.userId,
            day: x.day,
            category: x.category,
            ordinal: x.ordinal,
            key: x.key,
            state: x.state,
            points: x.pointsEarned ?? 0,
            legacySource: x.legacySource ?? null,
          })),
        };
      }
      case 'coachProofSubmissionsV1': {
        const page = await ctx.db.query('coachProofSubmissionsV1').paginate(paginationOpts);
        return {
          ...page,
          page: page.page.map((x) => ({
            id: x._id,
            userId: x.userId,
            day: x.day,
            category: x.category,
            state: x.state,
            slotKey: x.slotKey,
            hasStorage: Boolean(x.storageId),
            createdAt: x.createdAt,
          })),
        };
      }
      case 'posts': {
        const page = await ctx.db.query('posts').paginate(paginationOpts);
        return {
          ...page,
          page: page.page.map((x) => ({
            id: x._id,
            userId: x.userId,
            challengeCompletionId: x.challengeCompletionId ?? null,
            activityId: x.activityId ?? null,
            hasMedia: Boolean(x.media),
            createdAt: x.createdAt,
          })),
        };
      }
    }
  },
});
