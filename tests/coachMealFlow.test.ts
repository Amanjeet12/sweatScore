// @ts-nocheck -- Bun asynchronous flow fixtures.
import { expect, test } from 'bun:test';

import {
  createCheckInOperationGuard,
  mealReportMatchesPhoto,
  reconcileCapture,
  shareMealWithFeedback,
} from '../shared/coachMealFlow';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

test('delayed recovery and discarded capture A cannot replace accepted B', async () => {
  const operations = createCheckInOperationGuard();
  const recovery = operations.snapshot();
  const delayed = deferred<string>();
  let photo = 'A';
  const restore = delayed.promise.then((oldPhoto) => {
    if (operations.isCurrent(recovery)) photo = oldPhoto;
  });
  const captureA = operations.begin()!;
  expect(operations.begin()).toBeNull(); // repeated tap before a render
  operations.invalidate(); // cancellation/unmount discards in-flight capture
  const captureB = operations.begin()!;
  photo = 'B';
  operations.end(captureA); // old completion cannot unlock B's operation
  expect(operations.begin()).toBeNull();
  delayed.resolve('A');
  await restore;
  expect(photo).toBe('B');
  expect(operations.isCurrent(captureA)).toBe(false);
  operations.end(captureB);
  expect(operations.begin()).not.toBeNull();
});

test('an old report is hidden until the accepted image identity matches', () => {
  const reportA = { storageId: 'A', draft: { storageId: 'A' } };
  expect(mealReportMatchesPhoto(undefined, reportA)).toBe(false);
  expect(mealReportMatchesPhoto('B', reportA)).toBe(false);
  expect(mealReportMatchesPhoto('B', { storageId: 'B', draft: { storageId: 'A' } })).toBe(false);
  expect(mealReportMatchesPhoto('B', { storageId: 'B', draft: { storageId: 'B' } })).toBe(true);
});

test('reopening after a successful retake cannot recover the deleted photo or feedback', () => {
  const saved = {
    storageId: 'A',
    uri: 'file-A',
    captureId: 'capture-A',
    mealFeedback: { helpful: false, correction: 'feedback for A' },
  };
  expect(reconcileCapture(saved, undefined)).toMatchObject({
    storageId: undefined,
    uri: undefined,
    captureId: undefined,
    mealFeedback: undefined,
  });
  expect(reconcileCapture(saved, 'B').uri).toBeUndefined();
  expect(reconcileCapture(saved, 'A')).toEqual(saved);
  // Upload succeeded but its response was lost: the accepted local bytes are still B.
  expect(reconcileCapture({ uri: 'file-B' }, 'B')).toMatchObject({ uri: 'file-B', storageId: 'B' });
});

test('public share and private feedback stay separate; partial success retries feedback only', async () => {
  const feedback = { helpful: false, correction: 'This was avocado.' };
  let posts = 0;
  let submissions = 0;
  let posted: { postId: string } | undefined;
  const options = {
    share: async () => {
      posts++;
      return { postId: 'meal-B' };
    },
    onPosted: (result: { postId: string }) => {
      posted = result;
    },
    feedback,
    submitFeedback: async (value: typeof feedback) => {
      submissions++;
      expect(value).toEqual(feedback);
      if (submissions === 1) throw new Error('offline');
    },
  };
  await expect(shareMealWithFeedback(options)).rejects.toThrow('offline');
  expect(posted).toEqual({ postId: 'meal-B' });
  expect(feedback.correction).toBe('This was avocado.');
  await shareMealWithFeedback({ ...options, posted });
  expect(posts).toBe(1);
  expect(submissions).toBe(2);
});

test('share without entered feedback skips private submission; a failed post never submits feedback', async () => {
  let feedbackCalls = 0;
  let persisted = false;
  const base = {
    share: async () => 'post-B',
    onPosted: () => {
      persisted = true;
    },
    submitFeedback: async () => {
      feedbackCalls++;
    },
  };
  expect(await shareMealWithFeedback(base)).toBe('post-B');
  expect(await shareMealWithFeedback({ ...base, feedback: { correction: '' } })).toBe('post-B');
  expect(feedbackCalls).toBe(0);
  persisted = false;
  await expect(
    shareMealWithFeedback({
      ...base,
      feedback: { helpful: true, correction: 'Good report' },
      share: async () => {
        throw new Error('post failed');
      },
    })
  ).rejects.toThrow('post failed');
  expect(persisted).toBe(false);
  expect(feedbackCalls).toBe(0);
});
