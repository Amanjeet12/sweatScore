import { v } from 'convex/values';

import { internal } from '../_generated/api';
import { Id } from '../_generated/dataModel';
import { internalAction, internalMutation, internalQuery } from '../_generated/server';

export const _listUsersPage = internalQuery({
  args: { cursor: v.optional(v.string()) },
  handler: async (ctx, { cursor }) => {
    const page = await ctx.db
      .query('users')
      .paginate({ cursor: cursor ?? null, numItems: 100 });
    return {
      users: page.page.map((u) => u._id),
      continueCursor: page.continueCursor,
      isDone: page.isDone,
    };
  },
});

export const _listUserDates = internalQuery({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    const dates = new Set<string>();

    const activities = await ctx.db
      .query('dailyActivities')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect();
    for (const a of activities) dates.add(a.date);

    const checkIns = await ctx.db
      .query('userCheckIns')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect();
    for (const c of checkIns) dates.add(c.date);

    const completions = await ctx.db
      .query('challengeCompletions')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect();
    for (const c of completions) dates.add(c.date);

    return Array.from(dates).sort(); // chronological
  },
});

export const _backfillUser = internalMutation({
  args: { userId: v.id('users'), date: v.string() },
  handler: async (ctx, { userId, date }) => {
    await ctx.runMutation(internal.track.recompute.recomputeTrackForDate, { userId, date });
  },
});

/**
 * Per-user sub-action: processes all dates for a single user, then runs the
 * final streak recompute. Runs independently with its own 10-min budget.
 */
export const _backfillSingleUser = internalAction({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    const dates: string[] = await ctx.runQuery(internal.track.backfill._listUserDates, {
      userId,
    });
    for (const date of dates) {
      await ctx.runMutation(internal.track.backfill._backfillUser, { userId, date });
    }
    await ctx.runMutation(internal.track.recompute.recomputeStreaks, { userId });
    return { dates: dates.length };
  },
});

/**
 * Orchestrator: enqueues one sub-action per user via the scheduler and exits.
 * Sub-actions run independently — total wall-clock time is bounded by Convex's
 * internal action concurrency, not by this action's 10-min budget.
 */
export const backfillTrack = internalAction({
  args: {},
  handler: async (ctx) => {
    let nextCursor: string | undefined = undefined;
    let scheduled = 0;
    let done = false;

    while (!done) {
      const page: {
        users: Id<'users'>[];
        continueCursor: string;
        isDone: boolean;
      } = await ctx.runQuery(internal.track.backfill._listUsersPage, { cursor: nextCursor });
      for (const userId of page.users) {
        await ctx.scheduler.runAfter(0, internal.track.backfill._backfillSingleUser, { userId });
        scheduled += 1;
      }
      nextCursor = page.continueCursor;
      done = page.isDone;
    }

    return { scheduled };
  },
});
