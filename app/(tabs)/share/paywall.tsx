import { router, Stack } from 'expo-router';
import { useEffect } from 'react';
import ScreenLoading from '~/components/core/ScreenLoading';

// Legacy in-app paywall links return through the persisted access decision.
export default function LegacyInAppPaywall() {
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
