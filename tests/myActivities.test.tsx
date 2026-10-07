// @ts-nocheck -- Inert rendering fixtures, without device or backend access.
import { expect, mock, test } from 'bun:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

let auth = { isAuthenticated: true, isLoading: false };
let storedUser = null;
let sessionUser;
let queryArgs;
mock.module('convex/react', () => ({
  useConvexAuth: () => auth,
  useQuery: (_api, args) => {
    queryArgs = args;
    return args === 'skip' ? undefined : sessionUser;
  },
}));
mock.module('expo-router', () => ({ router: { replace: () => {} } }));
mock.module('react-native', () => ({
  View: ({ children }) => React.createElement('div', {}, children),
}));
mock.module('../store/useAuthStore', () => ({
  useAuthStore: (selector) => selector({ currentUser: storedUser, setCurrentUser: () => {} }),
}));
mock.module('../components/core/ScreenLoading', () => ({
  default: () => React.createElement('div', {}, 'Loading profile'),
}));
mock.module('../components/core/auth/PrototypeOnboarding', () => ({
  PrototypeButton: ({ label }) => React.createElement('button', {}, label),
}));
mock.module('../components/core/user/Activities', () => ({
  default: ({ userId, header }) => React.createElement('div', { 'data-user': userId }, header),
}));
mock.module('../components/ui/text', () => ({
  Text: ({ children }) => React.createElement('span', {}, children),
}));
const { default: MyActivities } = await import('../components/core/settings/MyActivities');
const render = () =>
  renderToStaticMarkup(
    React.createElement(MyActivities, { header: React.createElement('h1', {}, 'Activity history') })
  );
function reset() {
  auth = { isAuthenticated: true, isLoading: false };
  storedUser = null;
  sessionUser = undefined;
}

test('signed-in profile recovers its list from the session when the local user is absent', () => {
  reset();
  sessionUser = { _id: 'member' };
  const html = render();
  expect(html).toContain('data-user="member"');
  expect(html).toContain('Activity history');
  expect(queryArgs).toEqual({});
});

test('unresolved session profile shows loading rather than a blank body', () => {
  reset();
  expect(render()).toContain('Loading profile');
});

test('existing member keeps the list and skips unnecessary recovery reads', () => {
  reset();
  storedUser = { _id: 'member' };
  expect(render()).toContain('data-user="member"');
  expect(queryArgs).toBe('skip');
});

test('signed-out state does not expose a cached member activity list', () => {
  reset();
  storedUser = { _id: 'old-member' };
  auth.isAuthenticated = false;
  const html = render();
  expect(html).toContain('Sign in to view your profile.');
  expect(html).not.toContain('data-user');
  expect(queryArgs).toBe('skip');
});

test('missing or deleted account shows an actionable sign-in state', () => {
  reset();
  sessionUser = null;
  expect(render()).toContain('Sign in to view your profile.');
});
