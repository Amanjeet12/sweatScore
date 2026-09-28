import { Stack } from 'expo-router';

import Paywall from '~/components/core/Paywall';
import SafeAreaView from '~/components/core/SafeAreaView';
import ScreenLoading from '~/components/core/ScreenLoading';
import { useCoachRouteGuard } from '~/hooks/useCoachRouteGuard';

const PAYWALL_ROUTE = ['paywall'] as const;

export default function SubscriptionScreen() {
  const { accepted } = useCoachRouteGuard(PAYWALL_ROUTE);
  if (!accepted) return <ScreenLoading />;
  return (
    <SafeAreaView className="flex-1 bg-white">
      <Stack.Screen
        options={{
          headerShown: false,
          gestureEnabled: false,
        }}
      />

      <Paywall onboarding />
    </SafeAreaView>
  );
}
