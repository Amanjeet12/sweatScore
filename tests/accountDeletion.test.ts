// @ts-nocheck -- Bun test types are outside the app TypeScript project.
import { expect, test } from 'bun:test';

import { deleteAccountAndClearSession } from '../shared/accountDeletion';

function fixture(result: { success: boolean } | undefined = { success: true }) {
  const calls: string[] = [];
  return {
    calls,
    actions: {
      deleteAccount: async () => {
        calls.push('delete');
        return result;
      },
      clearUser: () => {
        calls.push('clear');
      },
      clearSession: async () => {
        calls.push('clearSession');
      },
      onDeleted: () => {
        calls.push('welcome');
      },
      billingLogout: async () => {
        calls.push('billingLogout');
      },
      onCleanupError: (step: string) => {
        calls.push(`error:${step}`);
      },
    },
  };
}

test('successful deletion clears the session and billing login', async () => {
  const { actions, calls } = fixture();
  await deleteAccountAndClearSession(actions);
  expect(calls).toEqual(['delete', 'clearSession', 'clear', 'welcome', 'billingLogout']);
});

test('cleanup failures after deletion do not report deletion failure', async () => {
  const { actions, calls } = fixture();
  actions.clearSession = async () => {
    throw new Error('session already deleted');
  };
  actions.billingLogout = async () => {
    throw new Error('anonymous billing user');
  };
  await deleteAccountAndClearSession(actions);
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(calls).toEqual([
    'delete',
    'error:clearSession',
    'clear',
    'welcome',
    'error:billingLogout',
  ]);
});

test('backend deletion failure keeps the current session', async () => {
  const { actions, calls } = fixture();
  actions.deleteAccount = async () => {
    throw new Error('backend failed');
  };
  await expect(deleteAccountAndClearSession(actions)).rejects.toThrow('backend failed');
  expect(calls).toEqual([]);
});

test('unconfirmed deletion keeps the current session', async () => {
  const { actions, calls } = fixture({ success: false });
  await expect(deleteAccountAndClearSession(actions)).rejects.toThrow('not confirmed');
  expect(calls).toEqual(['delete']);
});

test('a stalled billing logout cannot keep the deleted account inside the app', async () => {
  const { actions, calls } = fixture();
  actions.billingLogout = () => new Promise(() => {});
  await deleteAccountAndClearSession(actions);
  expect(calls).toEqual(['delete', 'clearSession', 'clear', 'welcome']);
});

test('synchronous billing SDK failures do not block navigation', async () => {
  const { actions, calls } = fixture();
  actions.billingLogout = () => {
    throw new Error('not configured');
  };
  await deleteAccountAndClearSession(actions);
  await Promise.resolve();
  expect(calls).toContain('welcome');
  expect(calls).toContain('error:billingLogout');
});
