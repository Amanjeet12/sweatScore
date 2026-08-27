export const LOGGED_ACTIVITIES = [
  {
    key: 'hydration',
    title: 'Morning Hydration',
    goal: 'Start the day right and work toward your 2.5-litre target.',
    proof:
      'Start the day right to hit a 2.5-litre target. Snap a photo of your morning water, lemon water, or herbal tea.',
    basePoints: 2,
    icon: 'hydration',
    captions: [
      'Start clean, finish strong 💧',
      'Morning hydration locked in 🧊',
      'H2O before the day takes over 🌊',
      'First win of the morning, done ✔️',
      'Fuelling the body right 🧘‍♀️',
      'Sip, smile, repeat ✨',
      'Cleansed and ready for the day ☀️',
      'Prioritising my health early 🫖',
      'Water first, excuses last 🚫',
      'Hydrated and motivated 🔋',
      'Giving my body what it needs 🤍',
      'Cheers to a healthy day 🥂',
      'Morning wellness ritual checked 📝',
      'Clear mind, full glass 💎',
      'Unbothered and fully hydrated 🧊',
    ],
  },
  {
    key: 'healthy_meal',
    title: 'Healthy Meal',
    goal: 'Choose a healthy breakfast, lunch, or dinner.',
    proof: 'Snap a photo of your healthy breakfast, lunch, or dinner plate.',
    basePoints: 3,
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
    title: '7-Hours Sleep',
    goal: 'Meet your seven-hour sleep target.',
    proof:
      'Snap a close-up photo of your smartwatch screen showing you met your 7-hour sleep target.',
    basePoints: 4,
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
    title: '10,000 Steps',
    goal: 'Reach your 10,000-step target.',
    proof: 'Snap a live close-up picture of your smartwatch showing 10,000 step target.',
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
