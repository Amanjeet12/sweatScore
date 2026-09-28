import { router, Stack } from 'expo-router';
import { useEffect } from 'react';
import ScreenLoading from '~/components/core/ScreenLoading';

// Push permission is optional after Today; this old pre-payment route cannot skip questions.
export default function LegacyPushPermissionRoute() {
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
