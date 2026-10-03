import { useConvexAuth, useQuery } from 'convex/react';
import { router, Stack } from 'expo-router';
import { useEffect } from 'react';

import CoachSetupLoading from '~/components/core/CoachSetupLoading';
import { api } from '~/convex/_generated/api';
import { resumePathForDecision } from '~/utils/coachResumeNavigation';

export default function Resume() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const decision = useQuery(api.coachResume.myDecision, isAuthenticated ? {} : 'skip');
  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace('/(auth)/email');
    else if (decision) router.replace(resumePathForDecision(decision));
  }, [decision, isAuthenticated, isLoading]);
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
