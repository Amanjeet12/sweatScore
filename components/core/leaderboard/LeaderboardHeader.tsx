import { View } from 'react-native';

import { Text } from '~/components/ui/text';
import { daysRemainingInMonth, formatMonthLong } from '~/utils/daysRemainingInMonth';

export default function LeaderboardHeader() {
  const now = new Date();
  const monthLabel = formatMonthLong(now);
  const days = daysRemainingInMonth(now);

  return (
    <View className="flex-row items-center justify-between px-6 pb-4 pt-2">
      <View>
        <Text className="font-heading text-3xl font-bold text-[#1A1A1A]">Leaderboard</Text>
        <Text className="font-body text-base text-[#5A5A5A]">{monthLabel}</Text>
      </View>
      <Text className="font-body text-sm text-[#5A5A5A]">
        {days} {days === 1 ? 'day' : 'days'} left
      </Text>
    </View>
  );
}
