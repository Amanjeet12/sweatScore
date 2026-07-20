import { Image } from 'expo-image';
import { View } from 'react-native';

import { Text } from '~/components/ui/text';

export type CompletionFooterProps = {
  completedCount: number;
  targetPoints: number;
};

export default function CompletionFooter({ completedCount }: CompletionFooterProps) {
  if (completedCount <= 0) return null;
  return (
    <View className="flex-row items-center justify-center gap-x-2 px-6 py-4">
      <Image
        source={require('~/assets/icons/500points.png')}
        style={{ width: 22, height: 22 }}
        contentFit="contain"
      />
      <Text className="font-body text-base text-[#1A1A1A]">
        <Text className="text-[#F76B1C]" >
          {completedCount} Sweat {completedCount === 1 ? 'Sister' : 'Sisters'}
        </Text>{' '}
        {completedCount === 1 ? 'has' : 'have'} completed the challenge!
      </Text>
    </View>
  );
}
