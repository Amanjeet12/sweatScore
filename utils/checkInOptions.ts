export type CheckInOptionKey =
  | 'workout'
  | 'steps'
  | 'gym_visit'
  | 'stretch'
  | 'hydration'
  | 'healthy_meal'
  | 'fresh_air';

export type CheckInOption = {
  key: CheckInOptionKey;
  label: string;
  emoji: string;
  description: string;
};

export const CHECK_IN_OPTIONS: CheckInOption[] = [
  {
    key: 'workout',
    label: 'Workout',
    emoji: '🏋️',
    description:
      'Film yourself doing your workout today, whether that is strength, cardio, or your own session at home.',
  },
  {
    key: 'steps',
    label: 'Steps',
    emoji: '👟',
    description:
      'Film yourself getting your steps in, either out on a walk or on the treadmill. Show us you moving and keeping active today.',
  },
  {
    key: 'gym_visit',
    label: 'Gym',
    emoji: '📍',
    description:
      'Film yourself at the gym while you train. Capture a set so we can see you putting the work in.',
  },
  {
    key: 'stretch',
    label: 'Stretch',
    emoji: '🧘',
    description:
      'Film yourself doing your stretches or mobility work. Hold the stretch for at least 20 seconds.',
  },
  {
    key: 'hydration',
    label: 'Hydration',
    emoji: '💧',
    description:
      'Film yourself drinking your water or refilling your bottle. Show us you staying on top of your hydration today.',
  },
  {
    key: 'healthy_meal',
    label: 'Healthy Meal',
    emoji: '🥗',
    description:
      'Film your meal or your meal prep for today. Give us a look at the good food fuelling you.',
  },
  {
    key: 'fresh_air',
    label: 'Outdoor Walk',
    emoji: '☀️',
    description:
      'Film yourself getting outside in the sunshine today. Show us you soaking up some vitamin D and fresh air.',
  },
];

export function isCheckInOptionKey(value: unknown): value is CheckInOptionKey {
  return CHECK_IN_OPTIONS.some((option) => option.key === value);
}

export function getCheckInOption(key: CheckInOptionKey) {
  return CHECK_IN_OPTIONS.find((option) => option.key === key)!;
}
