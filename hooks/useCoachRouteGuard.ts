import { useConvex, useConvexAuth, useQuery } from 'convex/react';
import { router, useNavigationContainerRef } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { api } from '~/convex/_generated/api';
import { useRetainedQueryResult } from '~/hooks/useRetainedQueryResult';
import { runWhenNavigationReady } from '~/shared/navigationReady';
import { enforceResumeAccess, ResumeScreen } from '~/shared/coachResume';
import { useAuthStore } from '~/store/useAuthStore';
import { clearMissingMemberSession } from '~/utils/clearMissingMemberSession';
import { resumePathForDecision } from '~/utils/coachResumeNavigation';

export function useCoachRouteGuard(allowed: readonly ResumeScreen[], deferRedirect = false) {
  const convex = useConvex();
  const navigationRef = useNavigationContainerRef();
  const sessionRedirect = useAuthStore((state) => state.sessionRedirect);
  const { isAuthenticated, isLoading } = useConvexAuth();
  const memberId = useAuthStore((state) => state.currentUser?._id);
  const [refresh, setRefresh] = useState(0);
  const queryDecision = useQuery(
    api.coachResume.myDecision,
    isAuthenticated ? { refresh } : 'skip'
  );
  // Changing the refresh argument briefly clears a Convex query result. Keep
  // the last decision for this member so a clock refresh does not unmount the
  // entire tab navigator and send an open screen back to Today.
  const retainedDecision = useRetainedQueryResult(
    queryDecision,
    isAuthenticated ? String(memberId ?? 'auth-loading') : 'signed-out'
  );
  const decision = retainedDecision ? enforceResumeAccess(retainedDecision) : undefined;
  useEffect(() => {
    if (isAuthenticated && queryDecision === null) void clearMissingMemberSession(convex);
  }, [convex, isAuthenticated, queryDecision]);
  const lastRedirect = useRef<string | null>(null);
  useEffect(() => {
    const timer = setInterval(() => setRefresh((value) => value + 1), 60_000);
    return () => clearInterval(timer);
  }, []);
  const accepted = Boolean(isAuthenticated && decision && allowed.includes(decision.screen));
  const destination =
    !isLoading && !isAuthenticated
      ? '/(auth)/email'
      : decision && !accepted
        ? resumePathForDecision(decision)
        : null;
  useEffect(() => {
    if (sessionRedirect || !destination || (deferRedirect && isAuthenticated)) {
      lastRedirect.current = null;
      return;
    }
    return runWhenNavigationReady(navigationRef, () => {
      if (lastRedirect.current === destination) return;
      lastRedirect.current = destination;
      router.replace(destination);
    });
  }, [deferRedirect, destination, isAuthenticated, navigationRef, sessionRedirect]);
  return { decision, accepted };
}
