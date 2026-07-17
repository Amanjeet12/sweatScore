import { getAuthUserId } from '@convex-dev/auth/server';

import { Id } from '../_generated/dataModel';
import { query } from '../_generated/server';
import { formatDateInTZ, getMondayInTZ, ymdUTC } from '../utils/timezone';

type CompletionRow = {
  _id: Id<'challengeCompletions'>;
  challengeId: Id<'challenges'>;
  date: string;
  createdAt: number;
  pointsEarned: number;
  challengeName: string;
  coverImageUrl: string | null;
  compositeVideoUrl: string | null;
  timesCompleted: number; // This is now the row's own round number
  challengeType: ChallengeType;
};

type ChallengeType = 'challenge' | 'check_in';

export const getYourMoves = query({
  args: {},

  handler: async (ctx) => {
    const empty = {
      today: [] as CompletionRow[],
      earlierThisWeek: [] as CompletionRow[],
      earlierThisMonth: [] as CompletionRow[],
    };

    const userId = await getAuthUserId(ctx);

    if (!userId) {
      return empty;
    }

    const user = await ctx.db.get(userId);
    const tz = user?.timezone ?? null;

    const now = new Date();
    const todayStr = formatDateInTZ(now, tz);
    const mondayStr = ymdUTC(getMondayInTZ(now, tz));
    const monthStartStr = `${todayStr.slice(0, 7)}-01`;

    const rows = await ctx.db
      .query('challengeCompletions')
      .withIndex('by_user_date', (q) =>
        q.eq('userId', userId).gte('date', monthStartStr).lte('date', todayStr)
      )
      .filter((q) => q.neq(q.field('removed'), true))
      .collect();

    const allUserCompletions = await ctx.db
      .query('challengeCompletions')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .filter((q) => q.neq(q.field('removed'), true))
      .collect();

    const completionsByChallenge = new Map<string, typeof allUserCompletions>();

    for (const completion of allUserCompletions) {
      const challengeKey = String(completion.challengeId);

      const existing = completionsByChallenge.get(challengeKey) ?? [];

      existing.push(completion);

      completionsByChallenge.set(challengeKey, existing);
    }

    const roundNumberByCompletionId = new Map<string, number>();

    for (const completions of completionsByChallenge.values()) {
      completions.sort((a, b) => a._creationTime - b._creationTime);

      completions.forEach((completion, index) => {
        roundNumberByCompletionId.set(
          String(completion._id),
          completion.attemptNumber ?? index + 1
        );
      });
    }

    const challengeCache = new Map<
      string,
      {
        name: string;
        coverImage: Id<'_storage'> | null;
        type: ChallengeType;
      }
    >();

    for (const row of rows) {
      const challengeKey = String(row.challengeId);

      if (challengeCache.has(challengeKey)) {
        continue;
      }

      const challenge = await ctx.db.get(row.challengeId);

      challengeCache.set(challengeKey, {
        name: challenge?.name ?? 'Challenge',

        coverImage: challenge?.coverImage ?? null,

        type: challenge?.type === 'check_in' ? 'check_in' : 'challenge',
      });
    }

    const urlCache = new Map<string, string | null>();

    const resolveUrl = async (id: Id<'_storage'> | null | undefined): Promise<string | null> => {
      if (!id) {
        return null;
      }

      const key = String(id);

      if (urlCache.has(key)) {
        return urlCache.get(key)!;
      }

      const url = await ctx.storage.getUrl(id);

      urlCache.set(key, url);

      return url;
    };

    const hydrated: CompletionRow[] = [];

    for (const row of rows) {
      const challengeKey = String(row.challengeId);

      const challenge = challengeCache.get(challengeKey);

      if (!challenge) {
        continue;
      }

      const coverImageUrl = await resolveUrl(challenge.coverImage);

      const downloadableVideoStorageId =
        challenge.type === 'check_in' ? row.videoStorageId : row.compositeVideoStorageId;

      const compositeVideoUrl = await resolveUrl(downloadableVideoStorageId ?? null);

      hydrated.push({
        _id: row._id,
        challengeId: row.challengeId,
        date: row.date,
        createdAt: row._creationTime,
        pointsEarned: row.pointsEarned,
        challengeName: challenge.name,
        coverImageUrl,
        compositeVideoUrl,

        timesCompleted: roundNumberByCompletionId.get(String(row._id)) ?? 1,

        // Added challenge type
        challengeType: challenge.type,
      });
    }

    const today: CompletionRow[] = [];
    const earlierThisWeek: CompletionRow[] = [];
    const earlierThisMonth: CompletionRow[] = [];

    for (const row of hydrated) {
      if (row.date === todayStr) {
        today.push(row);
      } else if (row.date >= mondayStr && row.date < todayStr) {
        earlierThisWeek.push(row);
      } else if (row.date >= monthStartStr && row.date < mondayStr) {
        earlierThisMonth.push(row);
      }
    }

    const sortDesc = (a: CompletionRow, b: CompletionRow) => b.createdAt - a.createdAt;

    today.sort(sortDesc);
    earlierThisWeek.sort(sortDesc);
    earlierThisMonth.sort(sortDesc);

    return {
      today,
      earlierThisWeek,
      earlierThisMonth,
    };
  },
});
