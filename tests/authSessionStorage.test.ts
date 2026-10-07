// @ts-nocheck -- Bun-only token-storage fixtures; no real credentials or accounts.
import { expect, test } from 'bun:test';

import { createAuthSessionStorage } from '../shared/authSessionStorage';
import { useAuthStore } from '../store/useAuthStore';

const namespace = 'https://test.convex.cloud';
const jwt = '__convexAuthJWT_httpstestconvexcloud';
const refresh = '__convexAuthRefreshToken_httpstestconvexcloud';
function fixture() {
  const rows = new Map([
    [jwt, 'old-jwt'],
    [refresh, 'old-refresh'],
    ['other-preference', 'keep'],
  ]);
  const base = {
    getItem: async (key) => rows.get(key) ?? null,
    setItem: async (key, value) => {
      rows.set(key, value);
    },
    removeItem: async (key) => {
      rows.delete(key);
    },
  };
  return { rows, base, controller: createAuthSessionStorage(base, namespace) };
}

test('reset removes stored access and refresh tokens while preserving unrelated preferences', async () => {
  const { rows, controller } = fixture();
  await controller.reset();
  expect(rows.has(jwt)).toBe(false);
  expect(rows.has(refresh)).toBe(false);
  expect(rows.get('other-preference')).toBe('keep');
  expect(await controller.storage().getItem(jwt)).toBeNull();
});

test('late operations from the old auth provider cannot restore tokens or clear a new login', async () => {
  const { rows, controller } = fixture();
  const old = controller.storage();
  await controller.reset();
  const fresh = controller.storage();
  await fresh.setItem(jwt, 'new-jwt');
  await fresh.setItem(refresh, 'new-refresh');
  await old.setItem(jwt, 'stale-jwt');
  await old.removeItem(refresh);
  expect(await old.getItem(jwt)).toBeNull();
  expect(rows.get(jwt)).toBe('new-jwt');
  expect(rows.get(refresh)).toBe('new-refresh');
});

test('an in-flight token write is removed before reset finishes', async () => {
  const { base, rows } = fixture();
  let release;
  let started;
  const began = new Promise((resolve) => {
    started = resolve;
  });
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  base.setItem = async (key, value) => {
    started();
    await gate;
    rows.set(key, value);
  };
  const controller = createAuthSessionStorage(base, namespace);
  const old = controller.storage();
  const write = old.setItem(jwt, 'late-old-token');
  await began;
  const reset = controller.reset();
  release();
  await Promise.all([write, reset]);
  expect(rows.has(jwt)).toBe(false);
});

test('a storage removal error cannot rehydrate the deleted session in the current app', async () => {
  const { base } = fixture();
  base.removeItem = async () => {
    throw new Error('storage unavailable');
  };
  const controller = createAuthSessionStorage(base, namespace);
  await expect(controller.reset()).rejects.toThrow('storage unavailable');
  expect(await controller.storage().getItem(jwt)).toBeNull();
});

test('resetting the app auth state clears the member and remounts the auth provider', () => {
  const before = useAuthStore.getState().sessionVersion;
  useAuthStore.getState().setCurrentUser({ _id: 'deleted-member' });
  useAuthStore.getState().resetSession();
  expect(useAuthStore.getState().currentUser).toBeNull();
  expect(useAuthStore.getState().sessionRedirect).toBe(true);
  useAuthStore.getState().finishSessionRedirect();
  expect(useAuthStore.getState().sessionRedirect).toBe(false);
  expect(useAuthStore.getState().sessionVersion).toBe(before + 1);
});
