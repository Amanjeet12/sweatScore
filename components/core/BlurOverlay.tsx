import { BlurView } from 'expo-blur';
import { LockSimple } from 'phosphor-react-native';
import { Platform, View } from 'react-native';
import { Text } from '~/components/ui/text';

type BlurOverlayProps = {
  title?: string;
  subtitle?: string;
  buttonText?: string;
  redirectTo?: string;
};
export default function BlurOverlay({
  title = 'Premium access unavailable',
  subtitle = 'Your purchase must be verified before this feature is available.',
}: BlurOverlayProps) {
  return (
    <View className="absolute bottom-0 left-0 right-0 top-0 z-50">
      <BlurView
        intensity={Platform.OS === 'ios' ? 12 : 0}
        tint="light"
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(255,255,255,0.85)',
        }}>
        <View className="mx-6 items-center rounded-2xl bg-white p-7">
          <LockSimple color="#FF5C35" size={32} />
          <Text className="mt-3 text-center font-heading text-xl font-semibold">{title}</Text>
          <Text className="mt-2 text-center text-sm text-[#77716D]">{subtitle}</Text>
        </View>
      </BlurView>
    </View>
  );
}
