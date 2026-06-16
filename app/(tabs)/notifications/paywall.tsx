import { Stack } from 'expo-router';
import { Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Paywall from '~/components/core/Paywall';
import SafeAreaView from '~/components/core/SafeAreaView';

export default function NotificationsPaywallScreen() {
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView className="flex-1 bg-[#FFF7F6]">
      <Stack.Screen
        options={{
          headerShown: false,
          headerShadowVisible: false,
        }}
      />
      <View
        className="flex-1"
        style={Platform.OS === 'android' ? { paddingTop: insets.top } : undefined}>
        <Paywall />
      </View>
    </SafeAreaView>
  );
}
