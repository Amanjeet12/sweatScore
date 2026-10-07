// @ts-nocheck -- Isolated redirect lifecycle fixtures; no live navigator or account.
import { expect, mock, test } from 'bun:test';

let pending = false;
let auth = { isLoading: false, isAuthenticated: false };
let effects = [];
let waiting = [];
let replaces = 0;
let finishes = 0;
const navigation = { isReady: () => true };
const state = {
  get sessionRedirect() {
    return pending;
  },
  finishSessionRedirect: () => {
    pending = false;
    finishes++;
  },
};
const useAuthStore = (selector) => selector(state);
useAuthStore.getState = () => state;
mock.module('../store/useAuthStore', () => ({ useAuthStore }));
mock.module('convex/react', () => ({ useConvexAuth: () => auth }));
mock.module('react', () => ({ useEffect: (callback) => effects.push(callback) }));
// Deliberately omit useRootNavigationState: the redirect must not subscribe during render.
mock.module('expo-router', () => ({
  useNavigationContainerRef: () => navigation,
  router: {
    replace: (path) => {
      expect(pending).toBe(false);
      expect(path).toBe('/(auth)/email');
      replaces++;
    },
  },
}));
mock.module('../shared/navigationReady', () => ({
  runWhenNavigationReady: (_navigation, action) => {
    const job = { action, cancelled: false };
    waiting.push(job);
    return () => {
      job.cancelled = true;
    };
  },
}));
const { default: SessionRedirect } = await import('../components/providers/SessionRedirect');
function render() {
  effects = [];
  SessionRedirect();
  return effects.map((effect) => effect());
}
function reset() {
  pending = false;
  auth = { isLoading: false, isAuthenticated: false };
  effects = [];
  waiting = [];
  replaces = 0;
  finishes = 0;
}

test('normal rendering never queues a redirect or updates auth state', () => {
  reset();
  render();
  render();
  expect(waiting).toHaveLength(0);
  expect(finishes).toBe(0);
});

test('pending redirect is consumed before navigation and stale callbacks cannot repeat it', () => {
  reset();
  pending = true;
  render();
  render();
  waiting.forEach((job) => job.action());
  render();
  expect(replaces).toBe(1);
  expect(finishes).toBe(1);
  expect(waiting).toHaveLength(2);
});

test('waits for auth initialization and cancels navigation on unmount', () => {
  reset();
  pending = true;
  auth.isLoading = true;
  render();
  expect(waiting).toHaveLength(0);
  auth.isLoading = false;
  const [cleanup] = render();
  cleanup();
  expect(waiting[0].cancelled).toBe(true);
  expect(pending).toBe(true);
  expect(replaces).toBe(0);
});
