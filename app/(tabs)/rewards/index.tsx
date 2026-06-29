import { useQuery } from 'convex/react';
import { router, Stack } from 'expo-router';
import { Platform, ScrollView, TouchableOpacity, View } from 'react-native';
import { MenuProvider } from 'react-native-popup-menu';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '~/components/core/Avatar';
import SafeAreaView from '~/components/core/SafeAreaView';
import YourStreakCard from '~/components/core/track/YourStreakCard';
import YourMovesCard from '~/components/core/track/YourMovesCard';
import YourSweatCard from '~/components/core/track/YourSweatCard';
import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';
import { useAuthStore } from '~/store/useAuthStore';

const WEEKLY_TARGET_DAYS = 5;

function todayIndexMondayFirst(): number {
  const dow = new Date().getDay(); // 0=Sun..6=Sat
  return dow === 0 ? 6 : dow - 1;
}

export default function TabTrack() {
  const insets = useSafeAreaInsets();
  const currentUser = useAuthStore((state) => state.currentUser);
  const overview = useQuery(api.track.queries.getTrackOverview);

  const goToProfile = () => {
    if (!currentUser?._id) return;
    router.push({
      pathname: '/(tabs)/rewards/user/[userId]' as any,
      params: { userId: currentUser._id },
    });
  };

  const days = overview?.currentWeek.days ?? [];
  const daysMet = days.filter((d) => d.targetMet).length;

  return (
    <MenuProvider>
    <SafeAreaView className="flex-1 bg-[#F9F9F9]">
      <Stack.Screen
        options={{
          headerShown: false,
          headerShadowVisible: false,
        }}
      />
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 40 }}>
        <View
          className="flex-1 flex-col bg-[#F9F9F9]"
          style={Platform.OS === 'android' ? { paddingTop: insets.top } : undefined}>
          <View className="flex-row items-center justify-between px-12 py-6">
            <View>
              <Text className="font-heading text-2xl font-bold text-[#1A1A1A]">Track</Text>
              <Text className="font-body text-base text-[#838383]">Your Progress</Text>
            </View>
            {/* <TouchableOpacity onPress={goToProfile} activeOpacity={0.7}>
              <Avatar uri={currentUser?.image ?? undefined} size={56} />
            </TouchableOpacity> */}
          </View>

          <YourStreakCard
            currentWeeklyStreak={overview?.lifetime.currentWeeklyStreak ?? 0}
            longestWeeklyStreak={overview?.lifetime.longestWeeklyStreak ?? 0}
            days={days}
            daysMet={daysMet}
            targetDaysGoal={WEEKLY_TARGET_DAYS}
            todayIndex={todayIndexMondayFirst()}
          />

          <View className="mt-4">
            <YourSweatCard />
          </View>

          <View className="mt-4">
            <YourMovesCard />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
    </MenuProvider>
  );
}
