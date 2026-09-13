export const LOGGED_ACTIVITIES = [
  {
    key: 'gym_workout',
    title: 'Gym',
    detailTitle: 'Gym Workout',
    goal: 'Snap a photo at the gym to prove you showed up.',
    proof: 'Snap a photo at the gym to prove you showed up.',
    basePoints: 4,
    icon: 'gym',
    captions: [
      'Gym workout complete 💪',
      'Showed up and put the work in 🔥',
      'Another session in the books ✅',
      'Stronger with every workout 🏋️‍♀️',
      'No excuses, just progress ✨',
      'Today’s gym session is done 🙌',
      'Consistency looks good on me 👑',
      'Put in the work and earned the glow 💦',
      'One workout closer to my goals 🎯',
      'Training complete. Feeling strong 💪',
    ],
  },
  {
    key: 'healthy_meal',
    title: 'Meal',
    detailTitle: 'Healthy Meal',
    goal: 'Choose a healthy breakfast, lunch, or dinner.',
    proof: 'Snap a photo of your healthy breakfast, lunch, or dinner plate.',
    basePoints: 2,
    icon: 'meal',
    captions: [
      'Fuelling the temple today 🥗✨',
      'Ate good, felt good 🥑',
      'Plate full of goodness 🥬',
      'Nourish to flourish, sis 🌱',
      'Healthy never tasted this good 🍓🥞',
      'Feeding my future self ☀️',
      'Balanced plate, balanced life ⚖️🍏',
      'Colours on my plate, glow on my face 🥕✨',
      'Meal prep queen behaviour 👑',
      'Good food, good mood 😋❤️',
      'Eating like I love myself 🍳✨',
      'Snacked smart today 🙌🍏',
      'This plate said self care 🧘‍♀️🍽️',
      'Protein secured 🍗💪',
      'Fed and unbothered ✨🥗',
    ],
  },
  {
    key: 'sleep',
    title: 'Sleep',
    detailTitle: '7 Hours Sleep',
    goal: 'Meet your seven-hour sleep target.',
    proof:
      'Snap a close-up photo of your smartwatch screen showing you met your 7-hour sleep target.',
    basePoints: 3,
    icon: 'sleep',
    captions: [
      'Sleep target met. Recovery mode completed 🔋',
      'Prioritising rest because muscles grow in bed 🛌✨',
      '7+ hours secured. Ready to conquer the day ☀️',
      "The ultimate health hack: a good night's sleep 🧠💤",
      'Rested, recovered, and unbothered 🧘‍♀️',
      'Put data to my rest. My body thanked me today ✔️',
      'Sleep is my favorite workout component 😴💪',
      'Logged the hours, recharged the mind 🌌',
      "Deep sleep achieved. Let's get to work 🚀",
      'Shifting from fat-loss mode to recovery mode 🔄',
      'Woke up with a full battery today 🔋⚡',
      '7 hours of beauty sleep locked in 👑',
      'No alarms, just solid sleep data 📈',
      "Consistency starts with a good night's rest 🌙",
      'Chasing goals requires catching quality Zzzs 💤',
    ],
  },
  {
    key: 'steps',
    title: 'Steps',
    detailTitle: '8,000 Steps',
    goal: 'Reach your 8,000-step target.',
    proof: 'Snap a live close-up picture of your smartwatch showing your 8,000-step target.',
    basePoints: 5,
    icon: 'footprints',
    captions: [
      'Steps in, excuses out 👟',
      'Every step counts today 🏃‍♀️✨',
      'Walked it like I talked it 🗣️',
      'Little legs, big moves today 🦵',
      'Got my steps in before the day got me 🙌',
      'Movement is medicine, sis 💊',
      'This body was made to move 🏃‍♀️',
      'Steps done, dopamine unlocked 😉',
      'Walking into my best self 🚶‍♀️❤️',
      'No car, no problem, I walk 🚗❌',
      'Feet did the work today 👣💪',
      'Slow steps still count 🐢',
      'Chasing my step goal like it owes me money 💸😂',
      'One walk closer to the goal 🎯',
      'Steps secured 📑✔️',
    ],
  },
] as const;

const LEGACY_HYDRATION_ACTIVITY = {
  key: 'hydration',
  title: 'Morning Hydration',
  detailTitle: 'Morning Hydration',
  goal: 'Start the day right and work toward your 2.5-litre target.',
  proof: 'Snap a photo of your morning water, lemon water, or herbal tea.',
  basePoints: 2,
  icon: 'hydration',
  captions: ['Morning hydration locked in 💧'],
} as const;

export const ACTIVITY_SUBMISSION_OPTIONS = [
  {
    mode: 'take_photo',
    label: 'Take live photo',
    description: 'Use the in-app camera',
    bonusPoints: 0,
  },
] as const;

export type LoggedActivityKey = (typeof LOGGED_ACTIVITIES)[number]['key'];
export type ActivitySubmissionMode = (typeof ACTIVITY_SUBMISSION_OPTIONS)[number]['mode'];

export function getLoggedActivity(key: string | undefined) {
  if (key === LEGACY_HYDRATION_ACTIVITY.key) return LEGACY_HYDRATION_ACTIVITY;
  return LOGGED_ACTIVITIES.find((activity) => activity.key === key);
}

export function getActivitySubmissionOption(mode: string | undefined) {
  return ACTIVITY_SUBMISSION_OPTIONS.find((option) => option.mode === mode);
}

export function getLoggedActivityPoints(activityKey: string, submissionMode: string) {
  const activity = getLoggedActivity(activityKey);
  const submission = getActivitySubmissionOption(submissionMode);

  if (!activity || !submission) return null;

  return activity.basePoints;
}

export function getRandomActivityCaption(activityKey: string, previousCaption?: string) {
  const activity = getLoggedActivity(activityKey);
  if (!activity) return '';

  const alternatives = activity.captions.filter((caption) => caption !== previousCaption);
  const captions = alternatives.length > 0 ? alternatives : activity.captions;
  return captions[Math.floor(Math.random() * captions.length)];
}
