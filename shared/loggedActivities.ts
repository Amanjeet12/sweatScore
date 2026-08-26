export const LOGGED_ACTIVITIES = [
  {
    key: 'steps',
    title: 'Log your steps',
    goal: 'Hit at least 7,000 steps today.',
    proof: 'Screenshot or photo of your step count for today.',
    basePoints: 4,
    icon: 'footprints',
    captions: [
      'Steps in, excuses out 👟',
      'Every step counts today 🚶🏽‍♀️✨',
      'Walked it like I talked it 💅🏾',
      'Little legs, big moves today 👣',
      'Got my steps in before the day got me 🙌🏾',
      'Movement is medicine, sis 💊👟',
      'This body was made to move 🔥',
      'Steps done, dopamine unlocked 😌',
      'Walking into my best self 🚶🏾‍♀️💖',
      'No car, no problem, I walk 😂👟',
      'Feet did the work today 👣✨',
      'Slow steps still count 🐢💪🏾',
      'Chasing my step goal like it owes me money 💸😅',
      'One walk closer to the goal 🎯',
      'Steps secured ✅👟',
    ],
  },
  {
    key: 'sleep',
    title: 'Log your sleep',
    goal: 'Get at least 7 hours of sleep.',
    proof: "Screenshot or photo of last night's sleep log.",
    basePoints: 5,
    icon: 'sleep',
    captions: [
      'Rested and ready, sis 😴✨',
      'Sleep is my superpower 💤💪🏾',
      'Beauty sleep, checked ✅😌',
      '7 hours deep, no regrets 🛌',
      'Recovery is part of the grind 💤🔥',
      'Slept like a queen 👑😴',
      'My body said thank you this morning 🙏🏾',
      'Rest today, rise tomorrow 🌅',
      'Good sleep, good mood, good day 😌💖',
      "Logged my Zzz's like a boss 💤",
      "Naps count too, don't @ me 😂😴",
      'Recharged and glowing ✨🔋',
      'Sleep hygiene on point tonight 🛌💫',
      'Dreams logged, goals loading 💭🎯',
      'Well rested, well blessed 🙌🏾😴',
    ],
  },
  {
    key: 'healthy_meal',
    title: 'Log a healthy meal',
    goal: 'Eat a healthy meal that fuels you.',
    proof: 'Snap a photo of your healthy plate.',
    basePoints: 3,
    icon: 'meal',
    captions: [
      'Fuelling the temple today 🍽️✨',
      'Ate good, felt good 😋💚',
      'Plate full of goodness 🥗',
      'Nourish to flourish, sis 🌱💖',
      'Healthy never tasted this good 😍🍴',
      'Feeding my future self 🥑',
      'Balanced plate, balanced life ⚖️😌',
      'Colours on my plate, glow on my face 🌈✨',
      'Meal prep queen behaviour 👑🍱',
      'Good food, good mood 🥗😊',
      'Eating like I love myself 💕🍽️',
      'Snacked smart today 🙌🏾🥕',
      'This plate said self care 🧘🏾‍♀️🍴',
      'Protein secured 💪🏾🍗',
      'Fed and unbothered 😌✨',
    ],
  },
  {
    key: 'post_workout_selfie',
    title: 'Post-workout selfie',
    goal: 'Sweaty and done? Show it off.',
    proof: 'Snap your post-workout selfie.',
    basePoints: 1,
    icon: 'selfie',
    captions: [
      'Sweaty and proud 💦😤',
      'Post workout glow hits different ✨💦',
      'Earned this glow, sis 🔥',
      'Did the thing 💪🏾✅',
      'Face said tired, heart said worth it ❤️‍🔥',
      'Sweat is just fat crying 😂💦',
      'Glowing, growing, showing up ✨',
      'That post workout high 🚀',
      "Messy hair, strong body, don't care 💁🏾‍♀️",
      'Showed up for me today 🙌🏾',
      'Red face, full heart 🥵❤️',
      'Another one in the bank 💪🏾💰',
      'Sweat now, shine later ✨💦',
      'Proof I moved today 📸🔥',
      'Tired but thriving 😮‍💨✨',
    ],
  },
  {
    key: 'workout_fit',
    title: 'Workout fit',
    goal: "Show us today's gym fit.",
    proof: 'Show off your workout outfit.',
    basePoints: 1,
    icon: 'outfit',
    captions: [
      'Fit check before the sweat 💅🏾🔥',
      'Dressed to sweat, sis 👟✨',
      'Look good, move good 💃🏾',
      "Today's drip, brought to you by discipline 😮‍💨👏🏾",
      'Matching set, matching energy 💪🏾✨',
      'Gym fit secured 🔒👗',
      'When the outfit motivates the workout 😂🔥',
      'Serving looks and reps 💁🏾‍♀️💪🏾',
      'Confidence is the best accessory ✨',
      'New fit, who dis 😎',
      'Activewear activated 🟢👟',
      'Cute fit, cuter gains 💖💪🏾',
      "Dressed for the goals I'm chasing 🎯",
      'Fit on, excuses off 🙅🏾‍♀️',
      'Outfit of the sweat day 📸🔥',
    ],
  },
  {
    key: 'progress_pic',
    title: 'Progress pic',
    goal: "Share how far you've come.",
    proof: 'Snap a picture of your body under construction.',
    basePoints: 3,
    icon: 'progress',
    captions: [
      'Look how far, sis 📈💖',
      'Progress over perfection ✨',
      'Same me, stronger me 💪🏾',
      'Little by little, then all at once 🌱',
      'Proud of this glow up 🔥',
      'Growth looks good on me ✨',
      'Not where I started, not done yet 🚀',
      'Celebrating every inch 📸💕',
      'The work is working 💪🏾✅',
      'Slow progress is still progress 🐢💖',
      'This is your sign to keep going 🙌🏾',
      'Future me is thanking present me 🙏🏾',
      'Evidence of the effort 📸🔥',
      'Blooming on my own time 🌸',
      'Consistency looks like this ✨💪🏾',
    ],
  },
] as const;

export const ACTIVITY_SUBMISSION_OPTIONS = [
  {
    mode: 'take_photo',
    label: 'Take photo',
    description: 'Use your camera',
    bonusPoints: 0,
  },
  {
    mode: 'upload_photo',
    label: 'Upload photo',
    description: 'Choose a saved photo',
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
