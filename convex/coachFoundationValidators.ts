import { v } from 'convex/values';

export const profileAnswers = v.object({
  goal: v.union(v.literal('lose'), v.literal('recomp'), v.literal('fitness')),
  bodyFeeling: v.union(
    v.literal('feel_good'),
    v.literal('little_insecure'),
    v.literal('quite_insecure')
  ),
  routineFeeling: v.union(
    v.literal('working_keep_going'),
    v.literal('starting_stopping'),
    v.literal('struggle_keep_up')
  ),
  foodRelationship: v.union(
    v.literal('balanced_most_days'),
    v.literal('fall_off'),
    v.literal('restrict_then_overeat'),
    v.literal('do_not_think_about_it')
  ),
  usualSleep: v.union(
    v.literal('regular_restful'),
    v.literal('okay_could_be_better'),
    v.literal('needs_work')
  ),
  biggestChallenge: v.union(
    v.literal('time'),
    v.literal('motivation'),
    v.literal('food'),
    v.literal('something_else')
  ),
});
export const weightAnswer = v.object({
  value: v.number(),
  unit: v.union(v.literal('kg'), v.literal('lb')),
});
const bodyFeeling = v.union(
  v.literal('fine'),
  v.literal('sore_upper'),
  v.literal('sore_lower'),
  v.literal('pain_unwell')
);
export const dailyAnswers = v.object({
  sleep: v.union(v.literal('barely_rested'), v.literal('rested_enough'), v.literal('restful')),
  energy: v.union(v.literal('flat'), v.literal('steady'), v.literal('full')),
  mood: v.optional(
    v.union(v.literal('low'), v.literal('okay'), v.literal('good'), v.literal('motivated'))
  ),
  trainedYesterday: v.optional(
    v.array(
      v.union(
        v.literal('lower_body'),
        v.literal('upper_body'),
        v.literal('cardio'),
        v.literal('nothing')
      )
    )
  ),
  upFor: v.union(
    v.literal('full_session'),
    v.literal('short_session'),
    v.literal('something_light'),
    v.literal('rest_day')
  ),
  body: v.union(bodyFeeling, v.array(bodyFeeling)),
});
export const planOutput = v.object({
  headline: v.string(),
  workout: v.string(),
  steps: v.string(),
  sleep: v.string(),
  meals: v.string(),
  why: v.string(),
});
export const planOutputV2 = v.object({
  ...planOutput.fields,
  workoutExamples: v.array(v.string()),
  workoutReason: v.string(),
  stepsReason: v.string(),
});
export const planDetailsV2 = v.object({
  workoutExamples: v.array(v.string()),
  workoutReason: v.string(),
  stepsReason: v.string(),
});
export const planOutputV3 = v.object({
  headline: v.string(),
  workout: v.object({
    text: v.string(),
    type: v.string(),
    minutes: v.number(),
    intensity: v.union(v.literal('low'), v.literal('moderate'), v.literal('high')),
  }),
  steps: v.object({ target: v.number() }),
  meals: v.object({ text: v.string(), water_litres: v.number() }),
  sleep: v.object({ text: v.string(), hours: v.number() }),
  why: v.string(),
});
export const workoutMetadata = v.object({
  type: v.union(
    v.literal('full_body_strength'),
    v.literal('upper_body_strength'),
    v.literal('lower_body_strength'),
    v.literal('core'),
    v.literal('jump_rope'),
    v.literal('cardio'),
    v.literal('walking'),
    v.literal('mobility'),
    v.literal('stretching'),
    v.literal('rest')
  ),
  durationMinutes: v.optional(v.number()),
  intensity: v.optional(v.union(v.literal('low'), v.literal('moderate'), v.literal('high'))),
});
export const category = v.union(
  v.literal('workout'),
  v.literal('meals'),
  v.literal('sleep'),
  v.literal('steps')
);
export const tone = v.union(
  v.literal('warm_direct'),
  v.literal('calm_reassuring'),
  v.literal('upbeat_encouraging')
);
export const detail = v.union(v.literal('concise'), v.literal('standard'));
export const toneScope = v.union(
  v.literal('daily_plan'),
  v.literal('meal_feedback'),
  v.literal('both')
);
