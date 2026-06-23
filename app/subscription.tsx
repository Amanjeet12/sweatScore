import { Stack } from 'expo-router';

import Paywall from '~/components/core/Paywall';
import SafeAreaView from '~/components/core/SafeAreaView';

export default function SubscriptionScreen() {
  return (
    <SafeAreaView style={{ flex: 1 }}>
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