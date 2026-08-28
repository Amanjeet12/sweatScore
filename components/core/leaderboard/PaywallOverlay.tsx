import { BlurView } from 'expo-blur';
import { router, useFocusEffect } from 'expo-router';
import { ArrowRight } from 'phosphor-react-native';
import { useCallback, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';

import { Text } from '~/components/ui/text';

export type PaywallOverlayProps = {
  children?: React.ReactNode;
};

export default function PaywallOverlay({ children }: PaywallOverlayProps) {
  const [isNavigating, setIsNavigating] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setIsNavigating(false);
    }, [])
  );

  const handlePress = () => {
    setIsNavigating(true);
    requestAnimationFrame(() => {
      router.push('/(tabs)/notifications/paywall');
    });
  };

  return (
    <View className="relative mt-2">
      <View pointerEvents="none">{children}</View>
      {isNavigating ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: '#FFFFFF',
          }}
        />
      ) : (
        <BlurView
          pointerEvents="none"
          intensity={Platform.OS === 'android' ? 40 : 28}
          tint="light"
          experimentalBlurMethod="dimezisBlurView"
          style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}
        />
      )}
      <Pressable
        onPress={handlePress}
        android_ripple={{ color: 'transparent' }}
        style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}>
        <View pointerEvents="none" className="flex-1 items-center justify-center px-6">
          <View className="items-center justify-center rounded-full bg-[#1A1A1A] px-4 py-1.5">
            <Text className="font-body text-sm font-semibold text-white">Pro</Text>
          </View>
          <Text className="mt-4 text-center font-heading text-lg font-bold text-[#1A1A1A]">
            See where you rank on this month's leaderboard
          </Text>
          <View className="mb-5 mt-4 flex-row items-center gap-x-2 rounded-xl bg-[#F76B1C] px-5 py-3">
            <Text className="font-heading text-sm font-bold text-white">Unlock your rank</Text>
            <ArrowRight size={16} color="#FFFFFF" weight="bold" />
          </View>
        </View>
      </Pressable>
    </View>
  );
}
