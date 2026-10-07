export const PROFILE_QUESTIONS = [
  { key: 'weight', title: "What's your current weight?", options: [] },
  {
    key: 'goal',
    title: "What's your goal?",
    options: [
      ['lose', 'Lose weight'],
      ['recomp', 'Body recomp'],
      ['fitness', 'Improve fitness'],
    ],
  },
  {
    key: 'bodyFeeling',
    title: 'How do you feel about your body right now?',
    options: [
      ['feel_good', 'Feel good'],
      ['little_insecure', 'A little insecure'],
      ['quite_insecure', 'Quite insecure'],
    ],
  },
  {
    key: 'routineFeeling',
    title: 'How do you feel about your current routine?',
    options: [
      ['working_keep_going', "It's working, I want to keep it going"],
      ['starting_stopping', 'I keep starting and stopping'],
      ['struggle_keep_up', 'I struggle to keep up'],
    ],
  },
  {
    key: 'foodRelationship',
    title: 'How would you describe your relationship with food?',
    options: [
      ['balanced_most_days', 'Balanced most days'],
      ['fall_off', 'I do well, then fall off'],
      ['restrict_then_overeat', 'Restrict then overeat'],
      ['do_not_think_about_it', "I don't really think about it"],
    ],
  },
  {
    key: 'usualSleep',
    title: 'How would you describe your sleep?',
    options: [
      ['regular_restful', 'Regular and restful'],
      ['okay_could_be_better', 'Okay, could be better'],
      ['needs_work', 'It needs work'],
    ],
  },
  {
    key: 'biggestChallenge',
    title: "What's your biggest challenge right now?",
    options: [
      ['time', 'Time'],
      ['motivation', 'Motivation'],
      ['food', 'Food'],
      ['something_else', 'Something else'],
    ],
  },
] as const;

export const DAILY_QUESTIONS = [
  {
    key: 'sleep',
    title: 'How did you sleep last night?',
    options: [
      ['barely_rested', 'Barely rested'],
      ['rested_enough', 'Rested enough'],
      ['restful', 'Restful & restored'],
    ],
  },
  {
    key: 'energy',
    title: "How's your energy today?",
    options: [
      ['flat', 'Flat'],
      ['steady', 'Steady'],
      ['full', 'Upbeat'],
    ],
  },
  {
    key: 'upFor',
    title: 'What are you up for today?',
    options: [
      ['full_session', 'Full session'],
      ['short_session', 'Quick session'],
      ['something_light', 'Something light'],
      ['rest_day', 'Rest day'],
    ],
  },
  {
    key: 'trainedYesterday',
    title: 'What did you train yesterday?',
    options: [
      ['lower_body', 'Lower body'],
      ['upper_body', 'Upper body'],
      ['cardio', 'Cardio'],
      ['nothing', 'Nothing'],
    ],
  },
  {
    key: 'body',
    title: "How's your body feeling?",
    options: [
      ['fine', 'Feeling fine'],
      ['sore_upper', 'Sore upper body'],
      ['sore_lower', 'Sore lower body'],
      ['pain_unwell', 'Unwell/ in pain'],
    ],
  },
] as const;
