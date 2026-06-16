import { BlurView } from 'expo-blur';
import { router, useFocusEffect } from 'expo-router';
import { ArrowRight } from 'phosphor-react-native';
import { useCallback, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';

import { Text } from '~/components/ui/text';

export type PaywallOverlayProps = {
  totalUsers: number;
  children: React.ReactNode;
};

export default function PaywallOverlay({ totalUsers, children }: PaywallOverlayProps) {
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
        <View
          pointerEvents="none"
          className="flex-1 items-center justify-center px-6">
          <View className="items-center justify-center rounded-full bg-[#1A1A1A] px-4 py-1.5">
            <Text className="font-body text-sm font-semibold text-white">Pro</Text>
          </View>
          <Text className="mt-4 text-center font-heading text-lg font-bold text-[#1A1A1A]">
            See how all {totalUsers} Sweat Sisters are progressing
          </Text>
          <View className="mt-3 flex-row items-center gap-x-1">
            <Text className="font-body text-base font-semibold text-[#F76B1C]">
              See everyone&apos;s progress
            </Text>
            <ArrowRight size={16} color="#F76B1C" weight="bold" />
          </View>
        </View>
      </Pressable>
    </View>
  );
}
