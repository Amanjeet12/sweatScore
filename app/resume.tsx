import { useConvex, useConvexAuth, useQuery } from 'convex/react';
import { router, Stack, useNavigationContainerRef } from 'expo-router';
import { useEffect } from 'react';

import { runWhenNavigationReady } from '~/shared/navigationReady';
import { clearMissingMemberSession } from '~/utils/clearMissingMemberSession';
import CoachSetupLoading from '~/components/core/CoachSetupLoading';
import { api } from '~/convex/_generated/api';
import { resumePathForDecision } from '~/utils/coachResumeNavigation';

export default function Resume() {
  const convex = useConvex();
  const navigationRef = useNavigationContainerRef();
  const { isLoading, isAuthenticated } = useConvexAuth();
  const decision = useQuery(api.coachResume.myDecision, isAuthenticated ? {} : 'skip');
  useEffect(() => {
    if (isAuthenticated && decision === null) {
      void clearMissingMemberSession(convex);
      return;
    }
    const destination =
      !isLoading && !isAuthenticated
        ? '/(auth)/email'
        : decision
          ? resumePathForDecision(decision)
          : null;
    if (!destination) return;
    return runWhenNavigationReady(navigationRef, () => router.replace(destination));
  }, [convex, decision, isAuthenticated, isLoading, navigationRef]);
  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
          presentation: 'transparentModal',
          animation: 'none',
          contentStyle: { backgroundColor: 'transparent' },
        }}
      />
      <CoachSetupLoading />
    </>
  );
}
