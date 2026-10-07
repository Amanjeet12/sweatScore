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
      signOut: async () => {
        calls.push('signOut');
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
  expect(calls).toEqual(['delete', 'clear', 'signOut', 'billingLogout']);
});

test('cleanup failures after deletion do not report deletion failure', async () => {
  const { actions, calls } = fixture();
  actions.signOut = async () => {
    throw new Error('session already deleted');
  };
  actions.billingLogout = async () => {
    throw new Error('anonymous billing user');
  };
  await deleteAccountAndClearSession(actions);
  expect(calls).toEqual(['delete', 'clear', 'error:signOut', 'error:billingLogout']);
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
