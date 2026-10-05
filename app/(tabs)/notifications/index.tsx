import { LegendList } from '@legendapp/list';
import { useQuery } from 'convex/react';
import { router, Stack } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import ScreenLoading from '~/components/core/ScreenLoading';
import { leagueStyles, leagueTypography } from '~/components/core/design/LeagueStyles';
import LeaderboardHeader from '~/components/core/leaderboard/LeaderboardHeader';
import MeRow from '~/components/core/leaderboard/MeRow';
import PaywallOverlay from '~/components/core/leaderboard/PaywallOverlay';
import Podium from '~/components/core/leaderboard/Podium';
import RankRow from '~/components/core/leaderboard/RankRow';
import { useRevenueCat } from '~/components/providers/RevenueCatProvider';
import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';
import { Id } from '~/convex/_generated/dataModel';
import { useHealthSync } from '~/hooks/useHealthSync';
import { useRetainedQueryResult } from '~/hooks/useRetainedQueryResult';
import {
  formatLocalDate,
  getPeriodWindow,
  getTimeLeft,
  LeaderboardPeriod,
} from '~/shared/leaguePeriod';
import { useAuthStore } from '~/store/useAuthStore';
import { storage } from '~/utils/storage';

type Entry = {
  userId: Id<'users'>;
  rank: number;
  displayTotalPoints: number;
  name: string;
  image: string | null;
};

export default function TabRank() {
  const currentUser = useAuthStore((state) => state.currentUser);
  const { isPro } = useRevenueCat();
  const [period, setPeriod] = useState<LeaderboardPeriod>('month');
  const [mode, setMode] = useState<'points' | 'streak'>('points');
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

  useEffect(() => {
    if (!currentUser?._id) return;
    storage.set(`today_leaderboard_viewed_${currentUser._id}_${formatLocalDate(new Date())}`, true);
  }, [currentUser?._id]);

  const periodWindow = useMemo(() => getPeriodWindow(period, now), [now, period]);
  const timeLeft = useMemo(() => getTimeLeft(period, now), [now, period]);

  const leaderboardResult = useQuery(api.leaderboard.getLeaderboardForPeriod, {
    period,
    mode,
    refreshToken: Math.floor(now.getTime() / 60000),
    ...periodWindow,
  });
  const leaderboard = useRetainedQueryResult(
    leaderboardResult,
    `${currentUser?._id ?? 'guest'}:${period}:${mode}`
  );

  const hasFullAccess =
    isPro ||
    currentUser?.isAdmin === true ||
    leaderboard?.access === 'paid' ||
    leaderboard?.access === 'admin';

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
      if (!hasFullAccess) {
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
    [hasFullAccess]
  );

  if (!leaderboard) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-white">
        <Stack.Screen options={{ headerShown: false, headerShadowVisible: false }} />
        <ScreenLoading />
      </SafeAreaView>
    );
  }

  const entries = leaderboard.entries as Entry[];
  const visibleEntries = currentUser?._id
    ? entries.filter((entry) => entry.userId !== currentUser._id)
    : entries;
  const myRank = leaderboard.me?.rank || undefined;
  const userName = currentUser?.name?.trim().split(' ')[0] || 'User';

  const ListHeader = (
    <View>
      <View>
        <LeaderboardHeader
          title={leaderboard.listTitle}
          mode={mode}
          timeLeft={timeLeft}
          now={now}
          period={period}
          onChangePeriod={setPeriod}
          onChangeMode={setMode}
        />
      </View>

      <Podium podium={leaderboard.podium} onPressEntry={goToUser} mode={mode} />

      {leaderboard.me ? (
        <View>
          <MeRow
            mode={mode}
            rank={myRank}
            avatarUri={currentUser?.image ?? undefined}
            displayTotalPoints={leaderboard.me?.displayTotalPoints ?? 0}
            targetPoints={leaderboard.targetPoints}
            userName={userName}
            onPress={currentUser?._id ? () => goToUser(currentUser._id) : undefined}
          />
        </View>
      ) : (
        <View className="h-1" />
      )}
    </View>
  );

  const ListFooter = (
    <View className={hasFullAccess ? 'bg-white pb-6' : 'bg-white pb-4'}>
      {!hasFullAccess ? (
        <PaywallOverlay />
      ) : leaderboard.totalUsers > 0 ? (
        <View style={leagueStyles.footer}>
          <Text style={[leagueTypography.caption, { textAlign: 'center' }]}>
            {leaderboard.totalUsers}{' '}
            {leaderboard.totalUsers === 1 ? 'sister is taking part' : 'sisters are taking part'}{' '}
            {mode === 'streak'
              ? 'with an active streak.'
              : period === 'today'
                ? 'today.'
                : `this ${period}.`}
          </Text>
        </View>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-white">
      <Stack.Screen options={{ headerShown: false, headerShadowVisible: false }} />

      <LegendList
        data={visibleEntries}
        keyExtractor={(item) => item.userId}
        renderItem={({ item }: { item: Entry }) => (
          <View className="bg-white">
            <RankRow
              mode={mode}
              rank={item.rank}
              name={item.name}
              avatarUri={item.image}
              displayTotalPoints={item.displayTotalPoints}
              targetPoints={leaderboard.targetPoints}
              onPress={() => goToUser(item.userId)}
              isFirst={item.rank === visibleEntries[0]?.rank}
              isLast={item.rank === visibleEntries[visibleEntries.length - 1]?.rank}
            />
          </View>
        )}
        ListHeaderComponent={ListHeader}
        ListFooterComponent={ListFooter}
        ListEmptyComponent={null}
        estimatedItemSize={72}
        contentContainerStyle={{ paddingBottom: 0 }}
        showsVerticalScrollIndicator={false}
        refreshing={isRefreshing}
        onRefresh={handleRefresh}
      />
    </SafeAreaView>
  );
}
