import { Image } from 'expo-image';
import { Sparkle } from 'phosphor-react-native';
import { ScrollView, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OnboardingPrimaryButton } from '~/components/core/auth/OnboardingPrimaryButton';
import { Text } from '~/components/ui/text';
import { useAuthStore } from '~/store/useAuthStore';

export function CoachSurveyBridge({ onStart }: { onStart: () => void }) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const name = useAuthStore((state) => state.currentUser?.name?.trim());

  return (
    <View className="flex-1 bg-white">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>
        <Image
          source={require('~/assets/onboarding/coach-onboarding.jpg')}
          contentFit="cover"
          contentPosition={{ top: '22%', left: '50%' }}
          accessibilityIgnoresInvertColors
          style={{ width: '100%', height: Math.min(height * 0.48, 440) }}
        />
        <View
          className="flex-1 items-start rounded-t-[34px] bg-white px-6 pt-7"
          style={{ marginTop: -32, paddingBottom: 24 }}>
          <View className="mb-4 h-14 w-14 items-center justify-center rounded-full bg-[#FFF3ED]">
            <Sparkle size={32} weight="fill" color="#FF5C1A" />
          </View>
          <Text
            accessibilityRole="header"
            className="text-left font-body text-base font-semibold text-primary-500">
            Account Verified!
          </Text>
          <Text
            accessibilityRole="header"
            className="mt-3 text-left font-heading text-3xl font-semibold leading-10 text-[#1A1A1A]">
            Let&apos;s personalise your AI Coach{name ? `, ${name}` : ''}
          </Text>
          <Text className="mt-4 text-left font-body text-base leading-7 text-[#77716D]">
            Answer 7 quick questions so your Coach can tailor your workouts, meals, and recovery
            targets.
          </Text>
        </View>
      </ScrollView>
      <View
        className="bg-white px-6 pt-4"
        style={{ paddingBottom: Math.max(insets.bottom, 16) + 16 }}>
        <OnboardingPrimaryButton label="Start 2-Minute Survey" onPress={onStart} />
      </View>
    </View>
  );
}
