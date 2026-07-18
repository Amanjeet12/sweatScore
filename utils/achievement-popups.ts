export type AchievementPopupContent = {
  key: string;
  icon: string;
  title: string;
  highlight: string;
  body: string;
  buttonText: string;
};

export type AchievementSnapshot = {
  yearMonth: string;
  monthlyPoints?: number;
  monthlyChallengeTarget?: number;
  lifetimePoints?: number;
  currentWeeklyStreak?: number;
};

export type AchievementPopupDecision = {
  popup: AchievementPopupContent;
  consumedKeys: string[];
};

type ThresholdAchievement = AchievementPopupContent & {
  threshold: number;
};

const STREAK_MILESTONES: ThresholdAchievement[] = [
  {
    key: 'streak-10-weeks',
    threshold: 10,
    icon: '🔥',
    title: 'You’re locked in!',
    highlight: '10 week streak in the bag ✓',
    body: "You've hit 10 weeks of consistency, sis. Let the sisterhood know you showed up!",
    buttonText: 'Share Your Streak!',
  },
  {
    key: 'streak-25-weeks',
    threshold: 25,
    icon: '🔥',
    title: 'You’re locked in!',
    highlight: '25 week streak in the bag ✓',
    body: "You've hit 25 weeks of consistency, sis. Let the sisterhood know you’re killing it!",
    buttonText: 'Share Your Streak!',
  },
];

const POINT_MILESTONES: ThresholdAchievement[] = [
  {
    key: 'lifetime-points-1000',
    threshold: 1000,
    icon: '🔥',
    title: 'You’re on a roll!',
    highlight: '1,000 points earned ✓',
    body: "You've earned 1,000 lifetime points, sis. Let the sisterhood know you’re killing it!",
    buttonText: 'Share Your Milestone!',
  },
  {
    key: 'lifetime-points-5000',
    threshold: 5000,
    icon: '🔥',
    title: 'You’re on a roll!',
    highlight: '5,000 points earned ✓',
    body: "You've earned 5,000 lifetime points, sis. Let the sisterhood know you’re killing it!",
    buttonText: 'Share Your Milestone!',
  },
  {
    key: 'lifetime-points-10000',
    threshold: 10000,
    icon: '🔥',
    title: 'You’re on a roll!',
    highlight: '10,000 points earned ✓',
    body: "You've earned 10,000 lifetime points, sis. Let the sisterhood know you’re killing it!",
    buttonText: 'Share Your Milestone!',
  },
  {
    key: 'lifetime-points-25000',
    threshold: 25000,
    icon: '🔥',
    title: 'You’re on a roll!',
    highlight: '25,000 points earned ✓',
    body: "You've earned 25,000 lifetime points, sis. Let the sisterhood know you’re killing it!",
    buttonText: 'Share Your Milestone!',
  },
];

function formatAchievementNumber(value: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
}

function getThresholdDecision(
  milestones: ThresholdAchievement[],
  value: number | undefined,
  shownKeys: ReadonlySet<string>
): AchievementPopupDecision | null {
  if (value === undefined) return null;

  const reachedMilestones = milestones.filter((milestone) => value >= milestone.threshold);
  const highestReached = reachedMilestones[reachedMilestones.length - 1];

  if (!highestReached || shownKeys.has(highestReached.key)) return null;

  return {
    popup: highestReached,
    // If imported/backfilled data jumps over multiple thresholds, show only the
    // highest relevant popup instead of presenting a stack of outdated ones.
    consumedKeys: reachedMilestones.map((milestone) => milestone.key),
  };
}

/**
 * Returns at most one decision per achievement category, in display priority order.
 * The caller persists consumedKeys before displaying the associated popup.
 */
export function getAchievementPopupDecisions(
  snapshot: AchievementSnapshot,
  shownKeys: ReadonlySet<string>
): AchievementPopupDecision[] {
  const decisions: AchievementPopupDecision[] = [];

  const challengeTarget = snapshot.monthlyChallengeTarget;
  const challengeKey = `monthly-challenge-${snapshot.yearMonth}`;

  if (
    snapshot.monthlyPoints !== undefined &&
    challengeTarget !== undefined &&
    challengeTarget > 0 &&
    snapshot.monthlyPoints >= challengeTarget &&
    !shownKeys.has(challengeKey)
  ) {
    const formattedTarget = formatAchievementNumber(challengeTarget);

    decisions.push({
      popup: {
        key: challengeKey,
        icon: '🎉',
        title: 'You did that, sis!',
        highlight: 'Challenge completed ✓',
        body: `You've crushed ${formattedTarget} points of activity and completed this month’s challenge. Let the sisterhood know you did that!`,
        buttonText: 'Share Your Win!',
      },
      consumedKeys: [challengeKey],
    });
  }

  const streakDecision = getThresholdDecision(
    STREAK_MILESTONES,
    snapshot.currentWeeklyStreak,
    shownKeys
  );
  if (streakDecision) decisions.push(streakDecision);

  const pointsDecision = getThresholdDecision(POINT_MILESTONES, snapshot.lifetimePoints, shownKeys);
  if (pointsDecision) decisions.push(pointsDecision);

  return decisions;
}
