import { LegendList } from '@legendapp/list';
import { useQuery } from 'convex/react';
import { router, Stack } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import SafeAreaView from '~/components/core/SafeAreaView';
import ScreenLoading from '~/components/core/ScreenLoading';
import LeaderboardHeader from '~/components/core/leaderboard/LeaderboardHeader';
import { LeaderboardPeriod } from '~/components/core/leaderboard/LeaderboardPeriodDropdown';
import MeRow from '~/components/core/leaderboard/MeRow';
import PaywallOverlay from '~/components/core/leaderboard/PaywallOverlay';
import Podium from '~/components/core/leaderboard/Podium';
import RankRow from '~/components/core/leaderboard/RankRow';
import { useRevenueCat } from '~/components/providers/RevenueCatProvider';
import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';
import { Id } from '~/convex/_generated/dataModel';
import { useHealthSync } from '~/hooks/useHealthSync';
import { useAuthStore } from '~/store/useAuthStore';

type Entry = {
  userId: Id<'users'>;
  rank: number;
  displayTotalPoints: number;
  name: string;
  image: string | null;
};

function formatLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function getPeriodWindow(period: LeaderboardPeriod, now: Date) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const month = String(today.getMonth() + 1).padStart(2, '0');
  let start = today;

  if (period === 'month') {
    start = new Date(today.getFullYear(), today.getMonth(), 1);
  } else if (period === 'week') {
    const dayOfWeek = today.getDay();
    const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    start = new Date(today);
    start.setDate(today.getDate() - daysSinceMonday);
  }

  return {
    startDate: formatLocalDate(start),
    endDate: formatLocalDate(today),
    yearMonth: `${today.getFullYear()}-${month}`,
  };
}

function getTimeLeft(period: LeaderboardPeriod, now: Date) {
  if (period === 'month') {
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const days = lastDay - now.getDate() + 1;

    return `${days} ${days === 1 ? 'day' : 'days'} left`;
  }

  if (period === 'week') {
    const dayOfWeek = now.getDay();
    const days = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;

    return `${days} ${days === 1 ? 'day' : 'days'} left`;
  }

  const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const minutesLeft = Math.max(1, Math.ceil((nextMidnight.getTime() - now.getTime()) / 60_000));
  const hours = Math.floor(minutesLeft / 60);
  const minutes = minutesLeft % 60;

  if (hours <= 0) return `${minutes} min left`;
  if (minutes === 0) return `${hours} ${hours === 1 ? 'hour' : 'hours'} left`;

  return `${hours}h ${minutes}m left`;
}

function LockedLeaderboardPreview() {
  return (
    <View className="h-[220px] justify-center gap-y-4 bg-white px-5">
      {[0.88, 0.72, 0.6].map((width, index) => (
        <View key={index} className="flex-row items-center gap-x-3 opacity-60">
          <View className="h-11 w-11 rounded-full bg-[#E9E5E1]" />
          <View className="flex-1 gap-y-2">
            <View className="h-3 rounded-full bg-[#DFDAD5]" style={{ width: `${width * 52}%` }} />
            <View className="h-2 rounded-full bg-[#EFEAE4]" style={{ width: `${width * 100}%` }} />
          </View>
        </View>
      ))}
    </View>
  );
}

export default function TabRank() {
  const insets = useSafeAreaInsets();
  const currentUser = useAuthStore((state) => state.currentUser);
  const { isPro } = useRevenueCat();
  const [period, setPeriod] = useState<LeaderboardPeriod>('month');
  const [now, setNow] = useState(() => new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { syncAllMissedDays } = useHealthSync(
    currentUser?._id as Id<'users'>,
    undefined,
    currentUser?.birthdate
  );

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const periodWindow = useMemo(() => getPeriodWindow(period, now), [now, period]);
  const timeLeft = useMemo(() => getTimeLeft(period, now), [now, period]);

  const leaderboard = useQuery(api.leaderboard.getLeaderboardForPeriod, {
    period,
    ...periodWindow,
  });

  const hasFullAccess =
    isPro ||
    currentUser?.isAdmin === true ||
    leaderboard?.access === 'paid' ||
    leaderboard?.access === 'admin';

  useEffect(() => {
    if (leaderboard?.access === 'free' && !isPro && period !== 'month') {
      setPeriod('month');
    }
  }, [isPro, leaderboard?.access, period]);

  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return;

    setIsRefreshing(true);
    setNow(new Date());

    try {
      await syncAllMissedDays();
    } catch (error) {
      console.error('Leaderboard refresh failed:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, syncAllMissedDays]);

  const goToUser = useCallback(
    (userId: string) => {
      const isCurrentUser = userId === currentUser?._id;

      if (!hasFullAccess && !isCurrentUser) {
        router.push({
          pathname: '/(tabs)/notifications/paywall' as any,
          params: { redirectTo: '/(tabs)/notifications' },
        });
        return;
      }

      router.push({
        pathname: '/(tabs)/notifications/user/[userId]' as any,
        params: { userId },
      });
    },
    [currentUser?._id, hasFullAccess]
  );

  if (!leaderboard) {
    return (
      <SafeAreaView className="flex-1 bg-[#F9F9F9]">
        <Stack.Screen options={{ headerShown: false, headerShadowVisible: false }} />
        <ScreenLoading />
      </SafeAreaView>
    );
  }

  const entries = leaderboard.entries as Entry[];
  const visibleEntries = hasFullAccess
    ? entries.filter((entry) => entry.userId !== currentUser?._id)
    : entries;
  const myRank = leaderboard.me?.rank || undefined;
  const userName = currentUser?.name?.trim().split(' ')[0] || 'User';

  const shownParticipantIds = new Set(entries.map((entry) => entry.userId));
  if (hasFullAccess && (leaderboard.me?.displayTotalPoints ?? 0) > 0 && currentUser?._id) {
    shownParticipantIds.add(currentUser._id);
  }
  const otherParticipantCount = Math.max(0, leaderboard.totalUsers - shownParticipantIds.size);

  const ListHeader = (
    <View>
      <View style={Platform.OS === 'android' ? { paddingTop: insets.top } : undefined}>
        <LeaderboardHeader
          period={period}
          timeLeft={timeLeft}
          canChangePeriod={hasFullAccess}
          onChangePeriod={setPeriod}
        />
      </View>

      <Podium podium={leaderboard.podium} onPressEntry={goToUser} />

      {hasFullAccess ? (
        <View className="overflow-hidden rounded-t-3xl bg-white">
          <MeRow
            rank={myRank}
            avatarUri={currentUser?.image ?? undefined}
            displayTotalPoints={leaderboard.me?.displayTotalPoints ?? 0}
            targetPoints={leaderboard.targetPoints}
            userName={userName}
            onPress={currentUser?._id ? () => goToUser(currentUser._id) : undefined}
          />
        </View>
      ) : (
        <View className="h-6 rounded-t-3xl bg-white" />
      )}
    </View>
  );

  const ListFooter = (
    <View className="bg-white pb-4">
      {!hasFullAccess ? (
        <PaywallOverlay>
          <LockedLeaderboardPreview />
        </PaywallOverlay>
      ) : otherParticipantCount > 0 ? (
        <View className="mx-4 mt-5 rounded-2xl bg-[#FFF7F1] px-4 py-3.5">
          <Text className="text-center font-body text-sm text-[#5A5A5A]">
            {otherParticipantCount}{' '}
            {otherParticipantCount === 1
              ? 'other is also participating'
              : 'others are also participating'}{' '}
            in this challenge.
          </Text>
        </View>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-[#F9F9F9]">
      <Stack.Screen options={{ headerShown: false, headerShadowVisible: false }} />

      <LegendList
        data={visibleEntries}
        keyExtractor={(item) => item.userId}
        renderItem={({ item }: { item: Entry }) => (
          <View className="bg-white">
            <RankRow
              rank={item.rank}
              name={item.name}
              avatarUri={item.image}
              displayTotalPoints={item.displayTotalPoints}
              targetPoints={leaderboard.targetPoints}
              onPress={() => goToUser(item.userId)}
            />
          </View>
        )}
        ListHeaderComponent={ListHeader}
        ListFooterComponent={ListFooter}
        estimatedItemSize={72}
        contentContainerStyle={{ paddingBottom: 0 }}
        showsVerticalScrollIndicator={false}
        refreshing={isRefreshing}
        onRefresh={handleRefresh}
      />
    </SafeAreaView>
  );
}
