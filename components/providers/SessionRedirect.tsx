import { useConvexAuth } from 'convex/react';
import { router, useNavigationContainerRef } from 'expo-router';
import { useEffect } from 'react';

import { runWhenNavigationReady } from '~/shared/navigationReady';
import { useAuthStore } from '~/store/useAuthStore';

/** Session reset remounts the provider and navigator; redirect only after both are ready. */
export default function SessionRedirect() {
  const pending = useAuthStore((state) => state.sessionRedirect);
  const finish = useAuthStore((state) => state.finishSessionRedirect);
  const { isLoading, isAuthenticated } = useConvexAuth();
  const navigationRef = useNavigationContainerRef();
  useEffect(() => {
    if (!pending || isLoading || isAuthenticated) return;
    return runWhenNavigationReady(navigationRef, () => {
      // Consume before navigation can synchronously notify subscribers.
      if (!useAuthStore.getState().sessionRedirect) return;
      finish();
      router.replace('/(auth)/email');
    });
  }, [finish, isAuthenticated, isLoading, navigationRef, pending]);
  return null;
}
