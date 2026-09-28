import { useConvexAuth, useQuery } from 'convex/react';
import { router, Stack } from 'expo-router';
import { useEffect } from 'react';
import ScreenLoading from '~/components/core/ScreenLoading';
import { api } from '~/convex/_generated/api';
import { resumePath } from '~/utils/coachResumeNavigation';

export default function Resume() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const decision = useQuery(api.coachResume.myDecision, isAuthenticated ? {} : 'skip');
  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace('/(auth)/email');
    else if (decision) router.replace(resumePath(decision.screen));
  }, [decision, isAuthenticated, isLoading]);
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenLoading />
    </>
  );
}
