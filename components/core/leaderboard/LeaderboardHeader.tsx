import { Pressable, View } from 'react-native';

import { Text } from '~/components/ui/text';

type Props = {
  title: string;
  mode: 'points' | 'streak';
  timeLeft: string;
  onChangeMode: (mode: 'points' | 'streak') => void;
};
export default function LeaderboardHeader({ title, mode, timeLeft, onChangeMode }: Props) {
  return (
    <View className="px-5 pb-4 pt-5">
      <View className="mb-1 flex-row items-center justify-between gap-x-3">
        <Text className="font-body text-[10px] uppercase tracking-[0.5px] text-[#C65D32]">
          {new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(new Date())}
        </Text>
        <Text className="font-body text-[13px] text-[#817A76]">
          {mode === 'points' ? timeLeft : 'Active Streak'}
        </Text>
      </View>
      <Text style={{ fontFamily: 'Inter_700Bold' }} className="text-[25px] text-[#1A1A1A]">
        {title}
      </Text>
      <View className="mt-4 flex-row rounded-[24px] bg-[#EEEDE8] p-1">
        {(['points', 'streak'] as const).map((value) => (
          <Pressable
            key={value}
            onPress={() => onChangeMode(value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: mode === value }}
            className={`flex-1 items-center rounded-[20px] py-2 ${mode === value ? 'bg-white' : ''}`}>
            <Text style={{ fontFamily: 'Inter_600SemiBold' }} className="text-sm text-[#1A1A1A]">
              {value === 'points' ? 'Points' : 'Streak'}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
