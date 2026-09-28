import { router, Stack } from 'expo-router';
import { useEffect } from 'react';
import ScreenLoading from '~/components/core/ScreenLoading';

// Legacy coach deep links enter the persisted Stage 4 flow.
export default function LegacyCoachRoute() {
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
