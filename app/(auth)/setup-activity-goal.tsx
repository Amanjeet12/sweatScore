import { router, Stack } from 'expo-router';
import { useEffect } from 'react';
import ScreenLoading from '~/components/core/ScreenLoading';

// Older onboarding links enter the persisted resume decision.
export default function LegacyActivityGoalRoute() {
  useEffect(() => {
    router.replace('/resume');
  }, []);
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenLoading />
    </>
  );
}
