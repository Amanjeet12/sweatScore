import type { CoachCheckInType } from './progressCoach';

export type CoachChallengeMapping = {
  tag: 'Full Body' | 'Core' | 'Cardio' | 'Flexibility';
  actionLabel: string;
};

export type CoachChallengeCandidate = {
  _id: string;
  _creationTime: number;
  name: string;
  tag: string;
  isPublished: boolean;
  endDate?: string;
  isCommunityChallenge?: boolean;
  isDailyChallenge?: boolean;
  type?: 'challenge' | 'check_in';
};

const COACH_CHALLENGE_MAPPINGS: Partial<Record<CoachCheckInType, CoachChallengeMapping>> = {
  strength: { tag: 'Full Body', actionLabel: 'Explore full-body challenges' },
  core: { tag: 'Core', actionLabel: 'Explore core challenges' },
  cardio: { tag: 'Cardio', actionLabel: 'Explore cardio challenges' },
  gentle_movement: {
    tag: 'Flexibility',
    actionLabel: 'Explore flexibility challenges',
  },
};

export function getCoachChallengeMapping(
  checkInType: CoachCheckInType | undefined
): CoachChallengeMapping | undefined {
  return checkInType ? COACH_CHALLENGE_MAPPINGS[checkInType] : undefined;
}

export function selectCoachChallengeCandidate<T extends CoachChallengeCandidate>(
  challenges: readonly T[] | undefined,
  mapping: CoachChallengeMapping | undefined,
  currentDate: string | undefined
): T | undefined {
  if (!challenges || !mapping || !currentDate) return undefined;

  return [...challenges]
    .filter(
      (challenge) =>
        typeof challenge._id === 'string' &&
        challenge._id.length > 0 &&
        Number.isFinite(challenge._creationTime) &&
        typeof challenge.name === 'string' &&
        challenge.name.trim().length > 0 &&
        challenge.isPublished === true &&
        challenge.tag === mapping.tag &&
        challenge.type !== 'check_in' &&
        challenge.isCommunityChallenge !== true &&
        challenge.isDailyChallenge !== true &&
        (!challenge.endDate || challenge.endDate > currentDate)
    )
    .sort(
      (left, right) =>
        right._creationTime - left._creationTime ||
        String(left._id).localeCompare(String(right._id))
    )[0];
}
