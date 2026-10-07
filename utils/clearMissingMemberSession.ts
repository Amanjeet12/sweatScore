import type { ConvexReactClient } from 'convex/react';

import { useAuthStore } from '~/store/useAuthStore';
import { authSessionStorage } from './authSessionStorage';

let clearing: Promise<void> | undefined;

/** Multiple mounted route guards may observe the same deleted member. */
export function clearMissingMemberSession(convex: ConvexReactClient) {
  if (!clearing) {
    clearing = (async () => {
      convex.clearAuth();
      try {
        await authSessionStorage.reset();
      } catch (error) {
        console.warn('Expired member session cleanup failed', error);
      }
      useAuthStore.getState().resetSession();
    })().finally(() => {
      clearing = undefined;
    });
  }
  return clearing;
}
