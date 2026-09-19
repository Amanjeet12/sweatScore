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
