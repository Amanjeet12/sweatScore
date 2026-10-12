// @ts-nocheck -- Bun-only compatibility regression tests.
import { expect, test } from 'bun:test';
import { dailyQuestionsForBackend } from '../shared/coachQuestions';
import { toggleTrainingYesterday } from '../shared/coachTrainingYesterday';

test('Other activates only on a backend which accepts it', () => {
  const training = (ready) =>
    dailyQuestionsForBackend(ready).find((q) => q.key === 'trainedYesterday').options;
  expect(training(false)).toContainEqual(['cardio', 'Cardio']);
  expect(training(true)).toContainEqual(['other', 'Other']);
  expect(training(true)).not.toContainEqual(['cardio', 'Cardio']);
});

test('Other preserves multiple selections and Nothing remains exclusive', () => {
  expect(toggleTrainingYesterday(['cardio', 'lower_body'], 'other')).toEqual([
    'lower_body',
    'other',
  ]);
  expect(toggleTrainingYesterday(['other'], 'upper_body')).toEqual(['other', 'upper_body']);
  expect(toggleTrainingYesterday(['other'], 'nothing')).toEqual(['nothing']);
});
