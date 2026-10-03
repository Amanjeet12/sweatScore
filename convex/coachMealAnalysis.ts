'use node';

import { getAuthUserId } from '@convex-dev/auth/server';
import { ConvexError, v } from 'convex/values';
import { action } from './_generated/server';
import { internal } from './_generated/api';
import { Id } from './_generated/dataModel';
import { analyzeMealPhoto } from './coachMealProvider';
import { providerConfig } from './coachDailyProvider';

async function owner(ctx: any) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new ConvexError('Authentication required');
  return userId;
}
function asError(code: string): never {
  throw new ConvexError(code);
}

export const analyze = action({
  args: { draftId: v.id('coachMealDraftsV1'), requestKey: v.string() },
  handler: async (
    ctx,
    { draftId, requestKey }
  ): Promise<{ status: string; draftId: Id<'coachMealDraftsV1'>; errorCode?: string }> => {
    const userId = await owner(ctx);
    if (!/^[a-zA-Z0-9_-]{8,100}$/.test(requestKey)) asError('Invalid scan request identity');
    const scanId = await ctx.runMutation(internal.coachMeals.reserveScan, {
      userId,
      draftId,
      requestKey,
    });
    const { scan, draft, memberFeedback }: any = await ctx.runQuery(internal.coachMeals.scanInput, {
      userId,
      scanId,
    });
    if (scan.status !== 'reserved') return { status: scan.status, draftId };
    const blob = await ctx.storage.get(draft.storageId);
    const media = blob?.type;
    if (!blob || !['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(media ?? '')) {
      await ctx.runMutation(internal.coachMeals.releaseScan, { userId, scanId });
      asError('Saved photo unavailable or unsupported');
    }
    let imageBase64: string;
    try {
      imageBase64 = Buffer.from(await blob.arrayBuffer()).toString('base64');
    } catch {
      await ctx.runMutation(internal.coachMeals.releaseScan, { userId, scanId });
      asError('Saved photo could not be read. Retry analysis.');
    }
    const config = providerConfig();
    if (!config) {
      await ctx.runMutation(internal.coachMeals.releaseScan, { userId, scanId });
      asError('Meal analysis is temporarily unavailable');
    }
    const claimed = await ctx.runMutation(internal.coachMeals.claimDispatch, { userId, scanId });
    if (!claimed) return { status: 'already_dispatched' as const, draftId };
    let outcome;
    try {
      outcome = await analyzeMealPhoto({
        imageBase64,
        mediaType: media as 'image/jpeg',
        goal: draft.goal,
        memberFeedback,
        workoutLoggedToday: draft.workoutLoggedToday,
        style: { tone: draft.tone, detail: draft.detail },
        config,
      });
    } catch {
      await ctx.runMutation(internal.coachMeals.finishScan, {
        userId,
        scanId,
        errorCode: 'provider_unavailable',
        latencyMs: 0,
      });
      return { status: 'failed' as const, draftId, errorCode: 'provider_unavailable' };
    }
    const finished = await ctx.runMutation(internal.coachMeals.finishScan, {
      userId,
      scanId,
      result: outcome.ok ? outcome.result : undefined,
      errorCode: outcome.ok ? undefined : outcome.code,
      inputTokens: outcome.ok ? outcome.inputTokens : undefined,
      outputTokens: outcome.ok ? outcome.outputTokens : undefined,
      latencyMs: outcome.latencyMs,
    });
    return {
      status: outcome.ok && finished === 'ready' ? ('ready' as const) : ('failed' as const),
      draftId,
      errorCode: finished === 'unclear' ? 'unclear_image' : outcome.ok ? undefined : outcome.code,
    };
  },
});
