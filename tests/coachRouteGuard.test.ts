// @ts-nocheck -- Bun-only test fixture; the app TypeScript config omits Bun types.
import { expect, test } from 'bun:test';
import { retainQueryResult } from '../hooks/useRetainedQueryResult';
import { enforceResumeAccess } from '../shared/coachResume';

test('old server Today response without purchase is accepted only by the paywall guard', () => {
  const decision = enforceResumeAccess({ screen: 'today', verifiedAccess: false });
  expect(['today'].includes(decision.screen)).toBe(false);
  expect(['paywall'].includes(decision.screen)).toBe(true);
  expect(enforceResumeAccess(decision)).toEqual(decision);
});

test('verified subscribers and admins keep Today access', () => {
  const decision = { screen: 'today', verifiedAccess: true };
  expect(enforceResumeAccess(decision)).toBe(decision);
});

test('first-time onboarding stays available but unpaid setup and daily routes require paywall', () => {
  for (const screen of ['bio', 'profile', 'health', 'paywall']) {
    expect(enforceResumeAccess({ screen, verifiedAccess: false }).screen).toBe(screen);
  }
  for (const screen of ['setup', 'daily']) {
    expect(enforceResumeAccess({ screen, verifiedAccess: false }).screen).toBe('paywall');
  }
});

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

test('missing member response clears the retained Today decision immediately', () => {
  const previous = { scope: 'member-a', result: { screen: 'today' } };
  const missing = retainQueryResult(previous, null, 'member-a');
  expect(missing.result).toBeNull();
  expect(retainQueryResult(missing, undefined, 'member-a').result).toBeNull();
});
