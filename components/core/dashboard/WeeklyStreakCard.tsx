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

export default function WeeklyStreakCard() {
  const [showStreakInfo, setShowStreakInfo] = useState(false);

  const { data: weekData } = useTanstackQuery(
    convexQuery(api.challengeCompletions.getUserCompletionsForWeek, {})
  );

  const { data: streakData } = useTanstackQuery(
    convexQuery(api.challengeCompletions.getUserStreaksForMonth, {})
  );

  const streakBonusPoints = useQuery(api.admin.getAppConfig, {
    key: 'streakBonusPoints',
  });

  return (
    <View className="mx-screen-x rounded-card bg-white p-5" style={{ marginHorizontal: 20 }}>
      {/* Header row */}
      <View className="flex-row items-start justify-between">
        {/* Left title */}
        <View className="flex-1 pr-2">
          <View className="flex-row items-center">
            <Text
              className="font-heading text-xl  font-bold text-[#1A1A1A]"
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.85}>
              Weekly Streak
            </Text>

            <TouchableOpacity
              onPress={() => setShowStreakInfo(true)}
              className="ml-1"
            >
              <Info size={20} color="#c7c7c7" weight="fill" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Right streak */}
        <View className="shrink-0 items-end">
          <View className="flex-row items-center">
            <Text className="font-body text-[9px] font-bold text-primary-500">
              {streakData?.weeklyStreaks ?? 0} Weeks Streak
            </Text>

            <Image
              source={require('~/assets/icons/Flame.png')}
              style={{ width: 11, height: 11, marginLeft: 2 }}
              contentFit="contain"
            />
          </View>

          <Text className="font-body text-[9px] text-[#313131]">
            {streakData?.currentWeekDays ?? 0}/5 days
          </Text>
        </View>
      </View>

      {/* Weekly streak row */}
      <View className="mt-4">
        <WeeklyStreakRow days={weekData?.days ?? []} />
      </View>

      {/* Streak info modal */}
      <StreakInfoModal
        isOpen={showStreakInfo}
        onClose={() => setShowStreakInfo(false)}
        streakBonusPoints={streakBonusPoints ?? null}
      />
    </View>
  );
}
