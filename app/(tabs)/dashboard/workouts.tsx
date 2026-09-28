import { router, Stack } from 'expo-router';
import { useEffect } from 'react';
import ScreenLoading from '~/components/core/ScreenLoading';

// Preserve old workout links while the fifth tab is now Workouts.
export default function LegacyWorkoutsRoute() {
  useEffect(() => {
    router.replace('/(tabs)/workouts');
  }, []);
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenLoading />
    </>
  );
}
