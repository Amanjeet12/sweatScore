export const CHALLENGE_TAGS = [
  'Dance',
  'Jump Rope',
  'Legs',
  'Steps',
  'Abs',
  'Arms',
  'HIIT',
  'Full Body',
] as const;

export type ChallengeTag = (typeof CHALLENGE_TAGS)[number];

export const CHALLENGE_POINTS_MIN = 1;
export const CHALLENGE_POINTS_MAX = 50;
export const CHALLENGE_POINTS_DEFAULT = 5;
export const CHALLENGE_DURATION_MIN = 60; // 1 minute in seconds
export const CHALLENGE_DURATION_MAX = 300; // 5 minutes in seconds
export const CHALLENGE_DURATION_DEFAULT = 300;
