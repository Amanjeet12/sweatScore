export const COACH_PROFILE_GOALS = [
  'lose_weight',
  'maintain_weight_body_recomp',
  'improve_fitness',
] as const;
export const COACH_BODY_FEELINGS = [
  'feel_good_refining',
  'little_insecure',
  'quite_insecure',
] as const;
export const COACH_ROUTINE_FEELINGS = [
  'enjoy_it',
  'okay_could_be_better',
  'do_not_enjoy',
  'no_routine_yet',
] as const;
export const COACH_FOOD_RELATIONSHIPS = [
  'balanced_most_days',
  'swing_back_to_old_habits',
  'restrict_then_overeat',
  'do_not_think_about_it',
] as const;
export const COACH_USUAL_SLEEP = [
  'regular_restful',
  'okay_inconsistent',
  'poor_often_tired',
] as const;
export const COACH_BIGGEST_STRUGGLES = ['time', 'motivation', 'food', 'something_else'] as const;
export const COACH_UPCOMING_EVENTS = ['birthday', 'holiday', 'wedding', 'other', 'none'] as const;
export const COACH_LAST_REAL_PROGRESS = [
  'recently',
  'a_while_ago',
  'cannot_remember',
  'never',
] as const;
export const COACH_WEIGHT_UNITS = ['lb', 'kg'] as const;

export const COACH_SLEEP_OPTIONS = ['barely_rested', 'some_rest', 'rested', 'restored'] as const;
export const COACH_ENERGY_OPTIONS = ['gentle_day', 'little_to_give', 'ready_to_move'] as const;
export const COACH_MOOD_OPTIONS = ['low', 'okay', 'good', 'motivated'] as const;
export const COACH_TIME_OPTIONS = ['wide_open', 'window', 'squeezed', 'one_minute'] as const;
export const COACH_BODY_CONDITIONS = [
  'fine',
  'sore_upper',
  'sore_lower',
  'pain_or_unwell',
] as const;

export const COACH_DAILY_QUESTIONS = [
  {
    key: 'sleep',
    title: 'How did you sleep?',
    options: [
      { value: 'barely_rested', label: 'Barely rested' },
      { value: 'some_rest', label: 'Some rest, not enough' },
      { value: 'rested', label: 'Rested enough' },
      { value: 'restored', label: 'Rested and restored' },
    ],
  },
  {
    key: 'energy',
    title: 'How is your energy today?',
    options: [
      { value: 'gentle_day', label: 'I need a gentle day' },
      { value: 'little_to_give', label: 'I have a little to give' },
      { value: 'ready_to_move', label: 'I feel ready to move' },
    ],
  },
  {
    key: 'mood',
    title: 'How is your mood?',
    options: [
      { value: 'low', label: 'Low' },
      { value: 'okay', label: 'Okay' },
      { value: 'good', label: 'Good' },
      { value: 'motivated', label: 'Motivated' },
    ],
  },
  {
    key: 'availableTime',
    title: 'How much time do you have today?',
    options: [
      { value: 'wide_open', label: 'Wide open' },
      { value: 'window', label: 'I have a window' },
      { value: 'squeezed', label: 'Squeezed' },
      { value: 'one_minute', label: 'Barely a minute' },
    ],
  },
  {
    key: 'bodyCondition',
    title: 'How does your body feel?',
    options: [
      { value: 'fine', label: 'Feeling fine' },
      { value: 'sore_upper', label: 'Sore upper body' },
      { value: 'sore_lower', label: 'Sore lower body' },
      { value: 'pain_or_unwell', label: 'In pain or feeling unwell' },
    ],
  },
] as const;

export const COACH_PROFILE_QUESTIONS = [
  {
    key: 'goal',
    title: "What's your goal?",
    options: [
      { value: 'lose_weight', label: 'Lose weight' },
      {
        value: 'maintain_weight_body_recomp',
        label: 'Maintain weight and improve body composition',
      },
      { value: 'improve_fitness', label: 'Improve fitness' },
    ],
  },
  {
    key: 'bodyFeeling',
    title: 'How do you feel about your body right now?',
    options: [
      { value: 'feel_good_refining', label: 'I feel good and want to refine things' },
      { value: 'little_insecure', label: 'A little insecure, with areas I want to work on' },
      { value: 'quite_insecure', label: 'Quite insecure and ready to change how I feel' },
    ],
  },
  {
    key: 'routineFeeling',
    title: 'How do you feel about your workout routine?',
    options: [
      { value: 'enjoy_it', label: 'I enjoy it' },
      { value: 'okay_could_be_better', label: 'It is okay, but could be better' },
      { value: 'do_not_enjoy', label: 'I do not enjoy it' },
      { value: 'no_routine_yet', label: 'I do not really have one yet' },
    ],
  },
  {
    key: 'foodRelationship',
    title: 'How would you describe your relationship with food?',
    options: [
      { value: 'balanced_most_days', label: 'Balanced most days' },
      { value: 'swing_back_to_old_habits', label: 'I do well, then swing back to old habits' },
      { value: 'restrict_then_overeat', label: 'I restrict, then end up overeating' },
      { value: 'do_not_think_about_it', label: 'I do not really think about it' },
    ],
  },
  {
    key: 'usualSleep',
    title: 'How would you describe your sleep?',
    options: [
      { value: 'regular_restful', label: 'Regular and restful' },
      { value: 'okay_inconsistent', label: 'Okay, but inconsistent' },
      { value: 'poor_often_tired', label: 'Poor, I am often tired' },
    ],
  },
  {
    key: 'biggestStruggle',
    title: 'What is your biggest struggle right now?',
    options: [
      { value: 'time', label: 'Time' },
      { value: 'motivation', label: 'Motivation' },
      { value: 'food', label: 'Food' },
      { value: 'something_else', label: 'Something else' },
    ],
  },
  {
    key: 'upcomingEvent',
    title: 'Do you have any events coming up?',
    options: [
      { value: 'birthday', label: 'Birthday' },
      { value: 'holiday', label: 'Holiday' },
      { value: 'wedding', label: 'Wedding' },
      { value: 'other', label: 'Other' },
      { value: 'none', label: 'None' },
    ],
  },
  {
    key: 'lastRealProgress',
    title: 'When did you last see real progress?',
    options: [
      { value: 'recently', label: 'Recently' },
      { value: 'a_while_ago', label: 'A while ago' },
      { value: 'cannot_remember', label: "I can't remember" },
      { value: 'never', label: 'Never' },
    ],
  },
] as const;

export type CoachProfileGoal = (typeof COACH_PROFILE_GOALS)[number];
export type CoachBodyFeeling = (typeof COACH_BODY_FEELINGS)[number];
export type CoachRoutineFeeling = (typeof COACH_ROUTINE_FEELINGS)[number];
export type CoachFoodRelationship = (typeof COACH_FOOD_RELATIONSHIPS)[number];
export type CoachUsualSleep = (typeof COACH_USUAL_SLEEP)[number];
export type CoachBiggestStruggle = (typeof COACH_BIGGEST_STRUGGLES)[number];
export type CoachUpcomingEvent = (typeof COACH_UPCOMING_EVENTS)[number];
export type CoachLastRealProgress = (typeof COACH_LAST_REAL_PROGRESS)[number];
export type CoachWeightUnit = (typeof COACH_WEIGHT_UNITS)[number];

export type CoachDailyInputs = {
  sleep: (typeof COACH_SLEEP_OPTIONS)[number];
  energy: (typeof COACH_ENERGY_OPTIONS)[number];
  mood: (typeof COACH_MOOD_OPTIONS)[number];
  availableTime: (typeof COACH_TIME_OPTIONS)[number];
  bodyCondition: (typeof COACH_BODY_CONDITIONS)[number];
};

export type CoachCheckInType = 'strength' | 'cardio' | 'core' | 'gentle_movement' | 'rest';
export const COACH_CHECK_IN_LABELS: Record<CoachCheckInType, string> = {
  strength: 'Strength',
  cardio: 'Cardio',
  core: 'Core',
  gentle_movement: 'Gentle movement',
  rest: 'Rest',
};
export type CoachSafetyState = 'normal' | 'reduced' | 'pain_or_unwell';
export type CoachPlanStatus = 'pending' | 'ready' | 'fallback' | 'failed';

export type CoachProfileValues = {
  currentWeight?: number;
  weightUnit?: CoachWeightUnit;
  goal: CoachProfileGoal;
  bodyFeeling: CoachBodyFeeling;
  routineFeeling: CoachRoutineFeeling;
  foodRelationship: CoachFoodRelationship;
  usualSleep: CoachUsualSleep;
  biggestStruggle: CoachBiggestStruggle;
  upcomingEvent: CoachUpcomingEvent;
  lastRealProgress: CoachLastRealProgress;
};

export type CoachGenerationProfile = {
  goal: CoachProfileGoal;
  bodyFeeling: CoachBodyFeeling;
  routineFeeling: CoachRoutineFeeling;
  foodRelationship: CoachFoodRelationship;
  usualSleep: CoachUsualSleep;
  biggestStruggle: CoachBiggestStruggle;
  lastRealProgress: CoachLastRealProgress;
};

export type CoachContextSummary = {
  usableDays: number;
  averageSteps?: number;
  averageActiveMinutes?: number;
  activeDays: number;
};

export type CoachComputedTargets = {
  safetyState: CoachSafetyState;
  mayCallClaude: boolean;
  checkIn: {
    type: CoachCheckInType;
    durationMinutes: number;
  };
  nutrition: {
    carbServings: 1 | 2;
    proteinWithMeals: true;
    vegetablesWithMeals: true;
  };
  steps: { target?: number };
  hydration: { litres: number };
};

export type CoachPlanOutput = {
  headline: string;
  checkIn: {
    type: CoachCheckInType;
    durationMinutes: number;
    label: string;
  };
  nutrition: {
    carbServings: 1 | 2;
    message: string;
  };
  steps: { target?: number };
  hydration: { litres: number };
  why: string;
  safetyNotice?: string;
};

export type CoachGeneratedCopy = {
  headline: string;
  checkInLabel: string;
  nutritionMessage: string;
  why: string;
};
