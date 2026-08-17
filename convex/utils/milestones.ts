import { Id } from '../_generated/dataModel';
import { MutationCtx } from '../_generated/server';
import { getStreakEarnedDatesInRange, WEEKLY_STREAK_TARGET_DAYS } from './streak';
import { addDaysUTC, getMondayInTZ, ymdUTC } from './timezone';

export type UserMilestoneResult =
  | {
      type: 'weekly_target';
      current: number;
      target: number;
      key: string;
    }
  | {
      type: 'first_check_in';
      key: 'first';
    };

async function awardOnce(
  ctx: MutationCtx,
  userId: Id<'users'>,
  type: UserMilestoneResult['type'],
  key: string
) {
  const existing = await ctx.db
    .query('userMilestones')
    .withIndex('by_user_type_key', (q) => q.eq('userId', userId).eq('type', type).eq('key', key))
    .unique();

  if (existing) return false;

  await ctx.db.insert('userMilestones', {
    userId,
    type,
    key,
    achievedAt: Date.now(),
  });
  return true;
}

export async function evaluateUserMilestones(
  ctx: MutationCtx,
  userId: Id<'users'>,
  date: string,
  options?: { completedCheckIn?: boolean }
): Promise<UserMilestoneResult[]> {
  const user = await ctx.db.get(userId);
  const milestones: UserMilestoneResult[] = [];

  const localDate = new Date(`${date}T12:00:00.000Z`);
  const monday = getMondayInTZ(localDate, user?.timezone);
  const weekStart = ymdUTC(monday);
  const weekEnd = ymdUTC(addDaysUTC(monday, 7));
  const earnedDates = await getStreakEarnedDatesInRange(ctx, userId, weekStart, weekEnd);

  if (
    earnedDates.size >= WEEKLY_STREAK_TARGET_DAYS &&
    (await awardOnce(ctx, userId, 'weekly_target', weekStart))
  ) {
    milestones.push({
      type: 'weekly_target',
      current: Math.min(earnedDates.size, WEEKLY_STREAK_TARGET_DAYS),
      target: WEEKLY_STREAK_TARGET_DAYS,
      key: weekStart,
    });
  }

  const firstCheckInAwarded = await ctx.db
    .query('userMilestones')
    .withIndex('by_user_type_key', (q) =>
      q.eq('userId', userId).eq('type', 'first_check_in').eq('key', 'first')
    )
    .unique();

  if (options?.completedCheckIn && !firstCheckInAwarded) {
    const completions = await ctx.db
      .query('challengeCompletions')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .filter((q) => q.neq(q.field('removed'), true))
      .collect();
    const challenges = await Promise.all(completions.map((item) => ctx.db.get(item.challengeId)));
    const checkInCount = challenges.filter((challenge) => challenge?.type === 'check_in').length;

    if (checkInCount === 1 && (await awardOnce(ctx, userId, 'first_check_in', 'first'))) {
      milestones.push({ type: 'first_check_in', key: 'first' });
    }
  }

  return milestones;
}
