import type { Doc } from './_generated/dataModel';
import type { MutationCtx, QueryCtx } from './_generated/server';

// A deleted workout may be replaced once its original points/activity are gone.
// Keep reversals with a retained activity and meal-analysis allowances consumed.
export async function isDeletedWorkoutSlot(
  ctx: QueryCtx | MutationCtx,
  slot: Doc<'coachRewardSlotsV1'>
) {
  if (slot.category !== 'workout' || !slot.submissionId) return false;
  const proof = await ctx.db.get(slot.submissionId);
  return Boolean(
    proof &&
    proof.userId === slot.userId &&
    proof.slotKey === slot.key &&
    proof.state === 'reversed' &&
    proof.activityId &&
    !(await ctx.db.get(proof.activityId))
  );
}
