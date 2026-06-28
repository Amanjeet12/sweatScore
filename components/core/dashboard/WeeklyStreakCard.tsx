import { convexQuery } from '@convex-dev/react-query';
import { useQuery as useTanstackQuery } from '@tanstack/react-query';
import { useQuery } from 'convex/react';
import { Image } from 'expo-image';
import { Info } from 'phosphor-react-native';
import { useState } from 'react';
import { TouchableOpacity, View } from 'react-native';

import StreakInfoModal from './StreakInfoModal';
import WeeklyStreakRow from './WeeklyStreakRow';

import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';

const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thr', 'Fri', 'Sat', 'Sun'];

export default function WeeklyStreakCard() {
  const [showStreakInfo, setShowStreakInfo] = useState(false);

  const { data: weekData } = useTanstackQuery({
    ...convexQuery(api.challengeCompletions.getUserCompletionsForWeek, {}),
    placeholderData: (previousData) => previousData,
  });

  const { data: streakData } = useTanstackQuery({
    ...convexQuery(api.challengeCompletions.getUserStreaksForMonth, {}),
    placeholderData: (previousData) => previousData,
  });

  const streakBonusPoints = useQuery(api.admin.getAppConfig, {
    key: 'streakBonusPoints',
  });

  const weekDays = Array.isArray(weekData?.days) ? weekData.days : [];
  const shouldShowPlaceholder = weekDays.length === 0;

  const weeklyStreaks = streakData?.weeklyStreaks ?? 0;
  const currentWeekDays = streakData?.currentWeekDays ?? 0;

  const weekLabel = weeklyStreaks === 1 ? 'Week' : 'Weeks';

  return (
    <View className="rounded-card bg-white p-5" style={{ marginHorizontal: 20 }}>
      <View className="flex-row items-center justify-between">
        <View className="min-w-0 flex-1 pr-3">
          <View className="flex-row items-center">
            <Text className="font-heading text-xl font-bold text-[#1A1A1A]" numberOfLines={1}>
              Your Streak
            </Text>

            {/* <TouchableOpacity
              onPress={() => setShowStreakInfo(true)}
              className="ml-1"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Info size={18} color="#C7C7C7" weight="fill" />
            </TouchableOpacity> */}
          </View>
        </View>

        <View style={{ width: 92 }} className="items-end">
          <View className="flex-row items-center">
            <Text className="font-body text-xs font-bold text-primary-500" numberOfLines={1}>
              {weeklyStreaks} {weekLabel}
            </Text>

            <Image
              source={require('~/assets/icons/Flame.png')}
              style={{ width: 13, height: 13, marginLeft: 3 }}
              contentFit="contain"
            />
          </View>

          <Text className="mt-0.5 font-body text-[10px] text-[#313131]">
            {currentWeekDays}/5 days
          </Text>
        </View>
      </View>

      <View className="mt-4" style={{ minHeight: 56 }}>
        {shouldShowPlaceholder ? (
          <View className="flex-row items-center justify-between">
            {WEEK_DAYS.map((day) => (
              <View key={day} className="items-center">
                <View className="h-9 w-9 rounded-full bg-[#EFEFEF]" />

                <Text className="mt-1 font-body text-[10px] text-[#313131]">{day}</Text>
              </View>
            ))}
          </View>
        ) : (
          <WeeklyStreakRow days={weekDays} />
        )}
      </View>

      <StreakInfoModal
        isOpen={showStreakInfo}
        onClose={() => setShowStreakInfo(false)}
        streakBonusPoints={streakBonusPoints ?? null}
      />
    </View>
  );
}
