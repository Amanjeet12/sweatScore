import { CoachCategory, rewardSlotKey } from './coachFoundation';

export type LegacyRewardSource = {
  table: 'dailyActivities' | 'challengeCompletions';
  id: string;
  userId: string;
  day: string;
  points: number;
  createdAt: number;
  activityKey?: string;
  challengeType?: string;
  categoryId?: string | null;
  removed?: boolean;
};
export type ExistingRewardSlot = {
  userId: string;
  key: string;
  state: string;
  legacySourceKey?: string | null;
};
export type MigrationLedgerEntry = {
  sourceKey: string;
  disposition: 'candidate' | 'already_recorded' | 'review';
  category?: CoachCategory;
  slotKey?: string;
  reason: string;
  originalPoints: number;
};

const ACTIVITY_CATEGORY: Record<string, CoachCategory | undefined> = {
  gym_workout: 'workout',
  workout: 'workout',
  healthy_meal: 'meals',
  sleep: 'sleep',
  steps: 'steps',
};

// A completion's old admin category is never silently equated with a coach
// category. Pass only specifically approved mappings into a future dry run.
export function reconcileLegacyRewards(
  sources: LegacyRewardSource[],
  existingSlots: ExistingRewardSlot[],
  approvedCategoryMapping: Record<string, CoachCategory> = {}
): MigrationLedgerEntry[] {
  const occupied = new Set(existingSlots.map((slot) => `${slot.userId}:${slot.key}`));
  const recorded = new Set(
    existingSlots.map((slot) => slot.legacySourceKey).filter((id): id is string => Boolean(id))
  );
  const ordered = [...sources].sort(
    (a, b) => a.createdAt - b.createdAt || `${a.table}:${a.id}`.localeCompare(`${b.table}:${b.id}`)
  );
  return ordered.map((source) => {
    const sourceKey = `${source.table}:${source.id}`;
    const base = { sourceKey, originalPoints: source.points };
    if (recorded.has(sourceKey))
      return { ...base, disposition: 'already_recorded', reason: 'Existing legacy source slot' };
    const category =
      source.table === 'dailyActivities'
        ? ACTIVITY_CATEGORY[source.activityKey ?? '']
        : source.challengeType === 'check_in' && source.categoryId
          ? approvedCategoryMapping[source.categoryId]
          : undefined;
    if (!category)
      return {
        ...base,
        disposition: 'review',
        reason:
          source.activityKey === 'hydration'
            ? 'Hydration is not workout proof'
            : 'Unknown or unapproved legacy category',
      };
    if (source.points <= 0)
      return {
        ...base,
        category,
        disposition: 'review',
        reason: 'No positive earned reward to migrate',
      };
    const limit = category === 'meals' ? 3 : 1;
    let chosen: string | undefined;
    for (let ordinal = 1; ordinal <= limit; ordinal++) {
      const key = `${source.userId}:${rewardSlotKey(source.day, category, ordinal)}`;
      if (!occupied.has(key)) {
        chosen = key;
        break;
      }
    }
    if (!chosen)
      return {
        ...base,
        category,
        disposition: 'review',
        reason: 'Daily category slots already consumed',
      };
    occupied.add(chosen);
    return {
      ...base,
      category,
      slotKey: chosen.slice(source.userId.length + 1),
      disposition: 'candidate',
      reason: source.removed
        ? 'Removed source; preserve consumed eligibility and review points'
        : 'Eligibility candidate only; no writes',
    };
  });
}
