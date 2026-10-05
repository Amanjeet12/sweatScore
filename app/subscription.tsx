import { Stack } from 'expo-router';
import { View } from 'react-native';

import Paywall from '~/components/core/Paywall';
import ScreenLoading from '~/components/core/ScreenLoading';
import { useCoachRouteGuard } from '~/hooks/useCoachRouteGuard';

const PAYWALL_ROUTE = ['paywall'] as const;

export default function SubscriptionScreen() {
  const { accepted } = useCoachRouteGuard(PAYWALL_ROUTE);
  if (!accepted) return <ScreenLoading />;
  return (
    <View className="flex-1 bg-white">
      <Stack.Screen
        options={{
          headerShown: false,
          gestureEnabled: false,
        }}
      />

      <Paywall onboarding />
    </View>
  );
}
