import { Image } from 'expo-image';
import { View } from 'react-native';

import { Text } from '~/components/ui/text';

const DAY_LABELS = ['Mon', 'Tues', 'Wed', 'Thr', 'Fri', 'Sat', 'Sun'];

export type DayCell = {
  date: string;
  targetMet: boolean;
};

export type YourStreakCardProps = {
  currentWeeklyStreak: number;
  longestWeeklyStreak: number;
  days: DayCell[];
  daysMet: number;
  targetDaysGoal: number;
  todayIndex: number; // 0=Mon ... 6=Sun
};

export default function YourStreakCard({
  currentWeeklyStreak,
  longestWeeklyStreak,
  days,
  daysMet,
  targetDaysGoal,
  todayIndex,
}: YourStreakCardProps) {
  return (
    <View className="mx-screen-x rounded-card bg-white p-5" style={{ marginHorizontal: 20 }}>
      {/* Title */}
      <Text className="font-heading text-xl font-bold text-[#1A1A1A]">Your Streak</Text>

      {/* Big fire icon with current streak number */}
      <View className="mt-4 items-center">
        <View style={{ width: 64, height: 64 }}>
          <Image
            source={require('~/assets/icons/Current Streak.png')}
            style={{ width: 64, height: 64 }}
            contentFit="contain"
          />
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 0,
              bottom: 0,
              alignItems: 'center',
              justifyContent: 'center',
              paddingTop: 24,
            }}>
            <Text
              className="font-heading font-bold text-white"
              style={{ fontSize: 24, lineHeight: 26 }}>
              {currentWeeklyStreak}
            </Text>
          </View>
        </View>
        <Text className="mt-2 font-heading text-lg font-bold text-[#1A1A1A]">
          Current weekly streak
        </Text>
      </View>

      {/* Day grid — matches earn screen WeeklyStreakRow */}
      <View className="mt-4 flex-row justify-between px-2">
        {DAY_LABELS.map((label, i) => {
          const day = days[i];
          const isToday = i === todayIndex;
          const isEarned = day?.targetMet ?? false;
          return (
            <View key={label} className="items-center" style={{ width: '14%' }}>
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
                style={{ fontFamily: isToday ? 'Inter_700Bold' : 'Inter_400Regular' }}>
                {label}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Days met line */}
      <Text className="mt-4 text-center font-body text-sm font-bold text-primary-500">
        {daysMet}/{targetDaysGoal} days this week
      </Text>

      {/* Longest Streak pill — hidden until the user completes their first streak */}
      {longestWeeklyStreak > 0 && (
        <>
          <View className="mt-4 h-px bg-[#EFEAE4]" />
          <View
            className="mt-4 flex-row items-center justify-between rounded-2xl px-4 py-3"
            style={{ backgroundColor: '#FFF1E6', borderWidth: 1, borderColor: '#FFD0B5' }}>
            <View className="flex-row items-center gap-x-3">
              <Image
                source={require('~/assets/icons/Streak cup.png')}
                style={{ width: 44, height: 44 }}
                contentFit="contain"
              />
              <View>
                <Text className="font-heading text-base font-bold text-primary-500">
                  Longest Streak
                </Text>
                <Text className="font-body text-sm text-[#5A5A5A]">Your personal best</Text>
              </View>
            </View>
            <View className="flex-row items-baseline gap-x-1">
              <Text className="font-heading text-3xl font-bold text-primary-500">
                {longestWeeklyStreak}
              </Text>
              <Text className="font-heading text-sm font-bold text-primary-500">WKS</Text>
            </View>
          </View>
        </>
      )}
    </View>
  );
}
