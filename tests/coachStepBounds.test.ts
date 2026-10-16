// @ts-nocheck -- Bun-only provider contract tests.
import { expect, test } from 'bun:test';
import { v3ToolSchema } from '../convex/coachDailyProvider';

test('provider step schema uses the member-specific readiness ceiling', () => {
  const schema = v3ToolSchema({ output_constraints: { steps_min: 3000, steps_max: 6250 } });
  expect(schema.properties.steps.properties.target).toEqual({
    type: 'integer',
    minimum: 3000,
    maximum: 6000,
    multipleOf: 500,
  });
});

test('unwell zero target remains consistent while incomplete input keeps default limits', () => {
  expect(
    v3ToolSchema({ output_constraints: { steps_min: 0, steps_max: 0 } }).properties.steps.properties
      .target.maximum
  ).toBe(0);
  expect(v3ToolSchema({}).properties.steps.properties.target.maximum).toBe(12000);
});

test('rest-required tool choices cannot request a training session', () => {
  const schema = v3ToolSchema({
    output_constraints: {
      steps_min: 0,
      steps_max: 0,
      workout_allowed_types: ['rest'],
      workout_max_minutes: 0,
      workout_allowed_intensity: ['low'],
    },
  });
  expect(schema.properties.workout.properties.type.enum).toEqual(['rest']);
  expect(schema.properties.workout.properties.minutes.maximum).toBe(0);
  expect(schema.properties.workout.properties.intensity.enum).toEqual(['low']);
});
