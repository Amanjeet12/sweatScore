// @ts-nocheck -- Isolated session recovery fixtures, without real credentials.
import { expect, mock, test } from 'bun:test';

let resets = 0;
let storageResets = 0;
let release;
mock.module('../store/useAuthStore', () => ({
  useAuthStore: {
    getState: () => ({
      resetSession: () => {
        resets++;
      },
    }),
  },
}));
mock.module('../utils/authSessionStorage', () => ({
  authSessionStorage: {
    reset: async () => {
      storageResets++;
      await new Promise((resolve) => {
        release = resolve;
      });
    },
  },
}));
const { clearMissingMemberSession } = await import('../utils/clearMissingMemberSession');

test('concurrent missing-member guards clear auth once and reset only after token removal', async () => {
  let authClears = 0;
  const convex = {
    clearAuth: () => {
      authClears++;
    },
  };
  const first = clearMissingMemberSession(convex);
  const second = clearMissingMemberSession(convex);
  expect(second).toBe(first);
  expect(authClears).toBe(1);
  expect(storageResets).toBe(1);
  expect(resets).toBe(0);
  release();
  await first;
  expect(resets).toBe(1);
});
