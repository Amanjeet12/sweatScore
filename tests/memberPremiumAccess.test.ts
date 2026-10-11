// @ts-nocheck -- Bun-only entitlement regression tests.
import { expect, test } from 'bun:test';

import { hasMemberPremiumAccess } from '../convex/memberPremiumAccess';

test('completed legacy premium membership survives missing initial billing state', () => {
  expect(hasMemberPremiumAccess({ onboarded: true, isPremium: true }, null)).toBe(true);
  expect(hasMemberPremiumAccess({ onboarded: true, isPremium: false }, null)).toBe(false);
  expect(hasMemberPremiumAccess({ onboarded: false, isPremium: true }, null)).toBe(false);
  expect(hasMemberPremiumAccess(null, { status: 'active' })).toBe(false);
});

test('known billing results override legacy flags without bypassing expiration', () => {
  const member = { onboarded: true, isPremium: true };
  expect(hasMemberPremiumAccess(member, { status: 'inactive' }, 100)).toBe(false);
  expect(hasMemberPremiumAccess(member, { status: 'pending' }, 100)).toBe(false);
  expect(hasMemberPremiumAccess(member, { status: 'active', expiresAt: 0 }, 100)).toBe(false);
  expect(hasMemberPremiumAccess(member, { status: 'active', expiresAt: 100 }, 100)).toBe(false);
  expect(hasMemberPremiumAccess(member, { status: 'active', expiresAt: 101 }, 100)).toBe(true);
  expect(hasMemberPremiumAccess(member, { status: 'active' }, 100)).toBe(true);
  expect(hasMemberPremiumAccess({ isPremium: false }, { status: 'active' }, 100)).toBe(true);
  expect(hasMemberPremiumAccess({ isAdmin: true }, { status: 'inactive' }, 100)).toBe(true);
});
