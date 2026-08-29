import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { ArrowRight } from 'phosphor-react-native';
import { useCallback, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';

import { Text } from '~/components/ui/text';

export default function PaywallOverlay() {
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
    <View className="relative min-h-[250px] overflow-hidden bg-white">
      <View
        pointerEvents="none"
        className="absolute left-0 right-0 top-0 h-[118px] justify-between px-5 py-1"
        style={{ opacity: 0.5 }}>
        <View className="h-14 flex-row items-center gap-x-3">
          <View className="h-11 w-11 rounded-full bg-[#D2CECA]" />
          <View className="flex-1 gap-y-2">
            <View className="h-3 w-[42%] rounded-full bg-[#AFA9A3]" />
            <View className="h-2 w-full overflow-hidden rounded-full bg-[#DED8D1]">
              <View className="h-full w-[24%] rounded-full bg-[#F76B1C]" />
            </View>
          </View>
          <View className="h-3 w-8 rounded-full bg-[#AFA9A3]" />
        </View>
        <View className="h-14 flex-row items-center gap-x-3">
          <View className="h-11 w-11 rounded-full bg-[#D8D4D0]" />
          <View className="flex-1 gap-y-2">
            <View className="h-3 w-[54%] rounded-full bg-[#AFA9A3]" />
            <View className="h-2 w-full overflow-hidden rounded-full bg-[#DED8D1]">
              <View className="h-full w-[16%] rounded-full bg-[#F76B1C]" />
            </View>
          </View>
          <View className="h-3 w-8 rounded-full bg-[#AFA9A3]" />
        </View>
      </View>

      <BlurView
        pointerEvents="none"
        intensity={Platform.OS === 'android' ? 14 : 7}
        tint="light"
        experimentalBlurMethod="dimezisBlurView"
        style={{ position: 'absolute', top: 0, right: 0, left: 0, height: 118 }}
      />
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(255,255,255,0.18)', 'rgba(255,255,255,0.82)', '#FFFFFF']}
        locations={[0, 0.55, 1]}
        style={{ position: 'absolute', top: 0, right: 0, left: 0, height: 145 }}
      />

      <Pressable
        disabled={isNavigating}
        onPress={handlePress}
        android_ripple={{ color: 'transparent' }}
        className="min-h-[250px] items-center justify-center px-8 pb-7 pt-16"
        style={{ opacity: isNavigating ? 0.7 : 1 }}>
        <View pointerEvents="none" className="items-center justify-center">
          <View className="items-center justify-center rounded-full bg-[#1A1A1A] px-4 py-1.5">
            <Text className="font-body text-sm font-semibold text-white">Pro</Text>
          </View>
          <Text className="mt-4 text-center font-heading text-lg font-bold text-[#1A1A1A]">
            See where you rank today, this week and this month
          </Text>
          <View className="mt-4 flex-row items-center gap-x-2 px-2 py-1">
            <Text className="font-heading text-sm font-bold text-[#F76B1C]">Unlock your rank</Text>
            <ArrowRight size={16} color="#F76B1C" weight="bold" />
          </View>
        </View>
      </Pressable>
    </View>
  );
}
