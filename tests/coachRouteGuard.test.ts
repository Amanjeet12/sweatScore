// @ts-nocheck -- Bun-only test fixture; the app TypeScript config omits Bun types.
import { expect, test } from 'bun:test';
import { retainQueryResult } from '../hooks/useRetainedQueryResult';

test('minute refresh retains the member decision until the new server result arrives', () => {
  const initial = { scope: 'member-a', result: { screen: 'today', day: '2026-09-28' } };
  const pending = retainQueryResult(initial, undefined, 'member-a');
  expect(pending).toBe(initial);
  expect(pending.result?.screen).toBe('today');

  const next = retainQueryResult(pending, { screen: 'paywall', day: '2026-09-29' }, 'member-a');
  expect(next.result).toEqual({ screen: 'paywall', day: '2026-09-29' });
});

test('sign-out or member change never retains the previous member decision', () => {
  const previous = { scope: 'member-a', result: { screen: 'today' } };
  expect(retainQueryResult(previous, undefined, 'signed-out').result).toBeUndefined();
  expect(retainQueryResult(previous, undefined, 'member-b').result).toBeUndefined();
});
