import { Stack } from 'expo-router';

import Paywall from '~/components/core/Paywall';
import SafeAreaView from '~/components/core/SafeAreaView';

export default function SubscriptionScreen() {
  return (
    <SafeAreaView className="flex-1 bg-white">
      <Stack.Screen
        options={{
          headerShown: false,
          gestureEnabled: false,
        }}
      />

      <Paywall />
    </SafeAreaView>
  );
}
