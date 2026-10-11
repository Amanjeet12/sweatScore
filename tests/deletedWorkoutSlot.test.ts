// @ts-nocheck -- Bun-only backend regression tests.
import { expect, test } from 'bun:test';

import { isDeletedWorkoutSlot } from '../convex/deletedWorkoutSlot';

const slot = { category: 'workout', userId: 'member', submissionId: 'proof', key: 'slot' };
const proof = { userId: 'member', slotKey: 'slot', state: 'reversed', activityId: 'activity' };
const context = (savedProof = proof, activity = null) => ({
  db: { get: async (id) => (id === 'proof' ? savedProof : activity) },
});

test('a deleted workout releases its consumed slot for replacement', async () => {
  expect(await isDeletedWorkoutSlot(context(), slot)).toBe(true);
});

test('active, retained, unrelated and meal completions keep their allowance', async () => {
  expect(await isDeletedWorkoutSlot(context({ ...proof, state: 'completed' }), slot)).toBe(false);
  expect(await isDeletedWorkoutSlot(context(proof, {}), slot)).toBe(false);
  expect(await isDeletedWorkoutSlot(context({ ...proof, userId: 'other' }), slot)).toBe(false);
  expect(await isDeletedWorkoutSlot(context({ ...proof, slotKey: 'other' }), slot)).toBe(false);
  expect(await isDeletedWorkoutSlot(context(), { ...slot, category: 'meals' })).toBe(false);
  expect(await isDeletedWorkoutSlot(context(null), slot)).toBe(false);
});
