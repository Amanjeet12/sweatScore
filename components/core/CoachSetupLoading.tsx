import { Sparkle } from 'phosphor-react-native';
import { ActivityIndicator, View } from 'react-native';

import { Text } from '~/components/ui/text';

export default function CoachSetupLoading({
  title = 'Preparing your experience…',
  message = 'Checking whether your setup is complete.',
}: {
  title?: string;
  message?: string;
}) {
  return (
    <View className="flex-1 items-center justify-center bg-[#FFF9F5] px-8">
      <View className="h-24 w-24 items-center justify-center rounded-[32px] bg-[#FF5C1A] shadow-sm">
        <View className="h-16 w-16 items-center justify-center rounded-[24px] border border-white/30 bg-white/10">
          <Sparkle size={31} color="#FFFFFF" weight="fill" />
        </View>
      </View>
      <Text className="mt-7 text-center font-heading text-2xl font-semibold text-[#1A1A1A]">
        {title}
      </Text>
      <Text className="mt-3 max-w-[300px] text-center font-body text-sm leading-6 text-[#77716D]">
        {message}
      </Text>
      <View className="mt-7 rounded-full bg-white px-5 py-3 shadow-sm">
        <ActivityIndicator color="#FF5C1A" />
      </View>
    </View>
  );
}
