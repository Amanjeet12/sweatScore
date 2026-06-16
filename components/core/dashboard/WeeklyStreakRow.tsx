import { Image } from 'expo-image';
import { View } from 'react-native';

import { Text } from '~/components/ui/text';

interface DayData {
  date: string;
  dayLabel: string;
  count?: number;
  earned?: boolean;
  isToday: boolean;
}

interface WeeklyStreakRowProps {
  days: DayData[];
}

export default function WeeklyStreakRow({ days }: WeeklyStreakRowProps) {
  return (
    <View className="flex-row justify-between px-2">
      {days.map((day) => {
        // Backwards-compat: if `earned` flag isn't supplied (older clients
        // hitting the new server, or vice-versa), fall back to count-based.
        const isEarned = day.earned ?? (day.count ?? 0) > 0;
        return (
          <View key={day.date} className="items-center" style={{ width: '14%' }}>
            <View
              className="mb-2 items-center justify-center rounded-full"
              style={{
                width: 32,
                height: 32,
                backgroundColor: isEarned ? '#FFEDDF' : '#EEEAE5',
              }}>
              {isEarned && (
                <Image
                  source={require('~/assets/icons/Flame.png')}
                  style={{ width: 16, height: 16 }}
                  contentFit="contain"
                />
              )}
            </View>

            <Text
              className="text-xs text-[#313131]"
              style={{ fontFamily: day.isToday ? 'Inter_700Bold' : 'Inter_400Regular' }}>
              {day.dayLabel}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
