import { Pressable, View } from 'react-native';

import TabPageHeader from '~/components/core/TabPageHeader';
import { Text } from '~/components/ui/text';

type Props = {
  title: string;
  mode: 'points' | 'streak';
  timeLeft: string;
  onChangeMode: (mode: 'points' | 'streak') => void;
};
export default function LeaderboardHeader({ title, mode, timeLeft, onChangeMode }: Props) {
  return (
    <View className="px-5 pb-4">
      <TabPageHeader
        title={title}
        eyebrow={
          <View className="flex-row items-center justify-between gap-x-3">
            <Text className="font-body text-[13px] text-[#777777]">
              {new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(
                new Date()
              )}
            </Text>
            <Text className="font-body text-[13px] text-[#817A76]">
              {mode === 'points' ? timeLeft : 'Current streak'}
            </Text>
          </View>
        }
      />
      <View className="mt-5 flex-row border-b border-[#E8E8E8]">
        {(['points', 'streak'] as const).map((value) => (
          <Pressable
            key={value}
            onPress={() => onChangeMode(value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: mode === value }}
            className={`flex-1 items-center border-b-2 py-3 ${mode === value ? 'border-[#FF5C35]' : 'border-transparent'}`}>
            <Text
              style={{ fontFamily: 'Inter_600SemiBold' }}
              className={`text-base ${mode === value ? 'text-[#1A1A1A]' : 'text-[#777777]'}`}>
              {value === 'points' ? 'Points' : 'Streak'}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
