import { ConvexError, v } from 'convex/values';
import { internalMutation } from './_generated/server';
import { previewQuotaAllows } from '../shared/coachTonePreview';
import { detail, tone, toneScope } from './coachFoundationValidators';

const kind = v.union(v.literal('daily_plan'), v.literal('meal_feedback'));

export const reserve = internalMutation({
  args: {
    adminUserId: v.id('users'),
    kinds: v.array(kind),
    savedVersion: v.number(),
    selections: v.array(v.object({ tone, detail, scope: toneScope })),
  },
  handler: async (ctx, { adminUserId, kinds, savedVersion, selections }) => {
    const admin = await ctx.db.get(adminUserId);
    if (!admin?.isAdmin) throw new ConvexError('Admin required');
    if ((kinds.length !== 2 && kinds.length !== 4) || selections.length !== 2)
      throw new ConvexError('Invalid preview request');
    const latest = await ctx.db
      .query('coachToneSettingsV1')
      .withIndex('by_version')
      .order('desc')
      .first();
    if ((latest?.version ?? 1) !== savedVersion) throw new ConvexError('Tone version changed');
    const now = Date.now();
    const recent = await ctx.db
      .query('coachTonePreviewAttemptsV1')
      .withIndex('by_admin_created', (q) =>
        q.eq('adminUserId', adminUserId).gt('createdAt', now - 60 * 60 * 1000)
      )
      .collect();
    if (
      !previewQuotaAllows(recent.filter((attempt) => !attempt.quotaExemptedAt).length, kinds.length)
    )
      throw new ConvexError('Preview limit reached. Try again in an hour.');
    const ids = [];
    for (const [index, previewKind] of kinds.entries())
      ids.push(
        await ctx.db.insert('coachTonePreviewAttemptsV1', {
          adminUserId,
          kind: previewKind,
          comparisonSide: index % 2 === 0 ? 'current' : 'selected',
          savedVersion,
          ...selections[index % 2],
          status: 'reserved',
          createdAt: now,
        })
      );
    return ids;
  },
});

export const finish = internalMutation({
  args: {
    adminUserId: v.id('users'),
    attemptId: v.id('coachTonePreviewAttemptsV1'),
    status: v.union(v.literal('ready'), v.literal('failed')),
    errorCode: v.optional(v.string()),
    inputTokens: v.optional(v.number()),
    outputTokens: v.optional(v.number()),
    latencyMs: v.number(),
  },
  handler: async (ctx, args) => {
    const admin = await ctx.db.get(args.adminUserId);
    if (!admin?.isAdmin) throw new ConvexError('Admin required');
    const attempt = await ctx.db.get(args.attemptId);
    if (!attempt || attempt.adminUserId !== args.adminUserId || attempt.status !== 'reserved')
      throw new ConvexError('Preview attempt unavailable');
    await ctx.db.patch(args.attemptId, {
      status: args.status,
      errorCode: args.errorCode,
      inputTokens: args.inputTokens,
      outputTokens: args.outputTokens,
      latencyMs: args.latencyMs,
      completedAt: Date.now(),
    });
  },
});
