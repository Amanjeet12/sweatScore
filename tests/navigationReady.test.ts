// @ts-nocheck -- Deterministic scheduler fixtures; no mounted device navigation.
import { expect, test } from 'bun:test';
import { runWhenNavigationReady } from '../shared/navigationReady';

function fixture() {
  let ready = false;
  let actions = 0;
  let next = 0;
  const queued = new Map();
  const scheduler = {
    schedule: (callback) => {
      queued.set(++next, callback);
      return next;
    },
    cancel: (handle) => queued.delete(handle),
  };
  const tick = () => {
    const batch = [...queued.values()];
    queued.clear();
    batch.forEach((callback) => callback());
  };
  return {
    scheduler,
    tick,
    queued,
    navigation: { isReady: () => ready },
    ready: () => {
      ready = true;
    },
    action: () => {
      actions++;
    },
    count: () => actions,
  };
}

test('waits outside render and redirects exactly once after navigator mounts', () => {
  const f = fixture();
  runWhenNavigationReady(f.navigation, f.action, f.scheduler);
  expect(f.count()).toBe(0);
  f.tick();
  f.tick();
  expect(f.count()).toBe(0);
  f.ready();
  f.tick();
  f.tick();
  expect(f.count()).toBe(1);
  expect(f.queued.size).toBe(0);
});

test('unmount or changed destination cancels the pending redirect', () => {
  const f = fixture();
  const stop = runWhenNavigationReady(f.navigation, f.action, f.scheduler);
  f.tick();
  stop();
  f.ready();
  f.tick();
  expect(f.count()).toBe(0);
  expect(f.queued.size).toBe(0);
});

test('a ready navigator still redirects after render, and callback reentry cannot repeat it', () => {
  const f = fixture();
  f.ready();
  runWhenNavigationReady(
    f.navigation,
    () => {
      f.action();
      f.tick();
    },
    f.scheduler
  );
  expect(f.count()).toBe(0);
  f.tick();
  expect(f.count()).toBe(1);
});
