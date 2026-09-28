import { BlurView } from 'expo-blur';
import { LockSimple } from 'phosphor-react-native';
import { Platform, View } from 'react-native';
import { Text } from '~/components/ui/text';

export type TrackPaywallOverlayProps = { children: React.ReactNode };
export default function TrackPaywallOverlay({ children }: TrackPaywallOverlayProps) {
  return (
    <View className="relative">
      <View pointerEvents="none">{children}</View>
      <BlurView
        pointerEvents="none"
        intensity={Platform.OS === 'android' ? 40 : 28}
        tint="light"
        experimentalBlurMethod="dimezisBlurView"
        style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}
      />
      <View className="absolute bottom-0 left-0 right-0 top-0 items-center justify-center px-6">
        <LockSimple color="#FF5C35" size={25} />
        <Text className="mt-3 text-center font-heading text-lg font-semibold">
          Progress stats unavailable
        </Text>
        <Text className="mt-2 text-center text-sm text-[#77716D]">
          Verified Premium access is required.
        </Text>
      </View>
    </View>
  );
}
