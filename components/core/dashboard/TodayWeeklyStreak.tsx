import { useQuery } from 'convex/react';
import { Fire } from 'phosphor-react-native';
import { View } from 'react-native';

import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';

export default function TodayWeeklyStreak({
  daysEarned = 0,
  target = 5,
  currentWeeklyStreak = 0,
}: {
  daysEarned?: number;
  target?: number;
  currentWeeklyStreak?: number;
}) {
  const week = useQuery(api.challengeCompletions.getUserCompletionsForWeek);

  return (
    <View className="mx-5 mb-4 rounded-[26px] bg-white px-4 py-4">
      <View className="flex-row items-center justify-between">
        <Text className="font-heading text-[11px] font-semibold uppercase tracking-[1.8px] text-[#FF4B1F]">
          Weekly streak
        </Text>
        <Text className="font-heading text-[13px] font-semibold text-[#1A1918]">
          {Math.min(daysEarned, target)} of {target} days
        </Text>
      </View>
      {currentWeeklyStreak > 0 ? (
        <Text className="mt-2 font-body text-xs text-[#807A76]">
          {currentWeeklyStreak} week streak
        </Text>
      ) : null}
      <View className="mt-3 flex-row justify-between">
        {(
          week?.days ??
          ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((dayLabel) => ({
            dayLabel,
            earned: false,
            isToday: false,
          }))
        ).map((day) => (
          <View key={day.dayLabel} className="items-center">
            <Text className="mb-2 font-heading text-xs font-semibold text-[#77716D]">
              {day.dayLabel.charAt(0)}
            </Text>
            <View
              className="h-9 w-9 items-center justify-center rounded-full"
              style={{
                backgroundColor: day.earned ? '#FF5C35' : '#F7F5F3',
              }}>
              {day.earned ? <Fire size={18} color="#FFFFFF" weight="fill" /> : null}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}
