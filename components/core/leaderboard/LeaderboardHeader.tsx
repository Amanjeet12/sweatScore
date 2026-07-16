import { View } from 'react-native';

import { Text } from '~/components/ui/text';
import { daysRemainingInMonth, formatMonthLong } from '~/utils/daysRemainingInMonth';

export default function LeaderboardHeader() {
  const now = new Date();
  const monthLabel = formatMonthLong(now);
  const days = daysRemainingInMonth(now);

  return (
    <View className="flex-row items-center justify-between px-4 pb-5 pt-5">
      <View>
        <Text className="font-heading text-2xl font-extrabold text-[#1A1A1A]">League</Text>
        <Text className="font-body text-base text-[#5A5A5A]">{monthLabel}</Text>
      </View>
      <Text className="font-body text-sm text-[#5A5A5A]">
        {days} {days === 1 ? 'day' : 'days'} left
      </Text>
    </View>
  );
}
