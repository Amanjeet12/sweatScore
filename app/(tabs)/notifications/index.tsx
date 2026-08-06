import { LegendList } from '@legendapp/list';
import { usePaginatedQuery, useQuery } from 'convex/react';
import { router, Stack } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import SafeAreaView from '~/components/core/SafeAreaView';
import ScreenLoading from '~/components/core/ScreenLoading';
import CompletionFooter from '~/components/core/leaderboard/CompletionFooter';
import LeaderboardHeader from '~/components/core/leaderboard/LeaderboardHeader';
import MeRow from '~/components/core/leaderboard/MeRow';
import PaywallOverlay from '~/components/core/leaderboard/PaywallOverlay';
import Podium from '~/components/core/leaderboard/Podium';
import RankRow from '~/components/core/leaderboard/RankRow';
import { useRevenueCat } from '~/components/providers/RevenueCatProvider';
import { api } from '~/convex/_generated/api';
import { Id } from '~/convex/_generated/dataModel';
import { useHealthSync } from '~/hooks/useHealthSync';
import { useAuthStore } from '~/store/useAuthStore';

const FREE_VISIBLE_COUNT = 10;
const HIDDEN_PREVIEW_COUNT = 3;
const PREMIUM_PAGE_SIZE = 20;

type Entry = {
  userId: Id<'users'>;
  rank: number;
  displayTotalPoints: number;
  name: string;
  image: string | null;
};

export default function TabRank() {
  const insets = useSafeAreaInsets();

  const currentUser = useAuthStore((state) => state.currentUser);
  const { isPro } = useRevenueCat();

  const [isRefreshing, setIsRefreshing] = useState(false);

  const { syncAllMissedDays } = useHealthSync(
    currentUser?._id as Id<'users'>,
    undefined,
    currentUser?.birthdate
  );

  const yearMonth = useMemo(() => {
    const today = new Date();
    const month = String(today.getMonth() + 1).padStart(2, '0');

    return `${today.getFullYear()}-${month}`;
  }, []);

  const header = useQuery(
    api.leaderboard.getMonthlyLeaderboardHeader,
    {
      yearMonth,
    }
  );

  const { results, status, loadMore } = usePaginatedQuery(
    api.leaderboard.listMonthlyLeaderboard,
    {
      yearMonth,
    },
    {
      initialNumItems: isPro
        ? PREMIUM_PAGE_SIZE
        : FREE_VISIBLE_COUNT + HIDDEN_PREVIEW_COUNT + 1,
    }
  );

  const handleRefresh = useCallback(async () => {
    if (isRefreshing) {
      return;
    }

    setIsRefreshing(true);

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

      if (!isPro && !isCurrentUser) {
        router.push({
          pathname: '/(tabs)/notifications/paywall' as any,
          params: {
            redirectTo: '/(tabs)/notifications',
          },
        });

        return;
      }

      router.push({
        pathname: '/(tabs)/notifications/user/[userId]' as any,
        params: {
          userId,
        },
      });
    },
    [currentUser?._id, isPro]
  );

  const handleEndReached = useCallback(() => {
    if (!isPro || status !== 'CanLoadMore') {
      return;
    }

    loadMore(PREMIUM_PAGE_SIZE);
  }, [isPro, loadMore, status]);

  /*
   * Keep every hook above this conditional return.
   */
  if (!header) {
    return (
      <SafeAreaView className="flex-1 bg-[#F9F9F9]">
        <Stack.Screen
          options={{
            headerShown: false,
            headerShadowVisible: false,
          }}
        />

        <ScreenLoading />
      </SafeAreaView>
    );
  }

  const allEntries = results as Entry[];

  const meEntryFromList = allEntries.find(
    (entry) => entry.userId === currentUser?._id
  );

  const myRank =
    (header.me as { rank?: number } | null | undefined)?.rank ??
    meEntryFromList?.rank;

  /*
   * Pro users can see every loaded leaderboard entry,
   * except their own entry because MeRow displays it separately.
   */
  const proEntries = allEntries.filter(
    (entry) => entry.userId !== currentUser?._id
  );

  /*
   * Free users can only see actual leaderboard ranks #1 through #10.
   *
   * We filter using entry.rank instead of slicing after removing the
   * current user. This prevents rank #11 from moving into the visible
   * section when the current user is ranked in the top 10.
   */
  const freeVisibleEntries = allEntries.filter(
    (entry) =>
      entry.rank <= FREE_VISIBLE_COUNT &&
      entry.userId !== currentUser?._id
  );

  /*
   * These entries appear behind the locked paywall preview.
   */
  const freeHiddenEntries = allEntries.filter(
    (entry) =>
      entry.rank > FREE_VISIBLE_COUNT &&
      entry.rank <= FREE_VISIBLE_COUNT + HIDDEN_PREVIEW_COUNT &&
      entry.userId !== currentUser?._id
  );

  const visibleEntries = isPro ? proEntries : freeVisibleEntries;
  const hiddenEntries = isPro ? [] : freeHiddenEntries;

  /*
   * Show the paywall when users exist below rank #10.
   */
  const shouldShowPaywall =
    !isPro &&
    (hiddenEntries.length > 0 ||
      header.totalUsers > FREE_VISIBLE_COUNT ||
      status === 'CanLoadMore');

  const userName =
    currentUser?.name?.trim().split(' ')[0] || 'User';

  const ListHeader = (
    <View>
      <View
        style={
          Platform.OS === 'android'
            ? {
                paddingTop: insets.top,
              }
            : undefined
        }>
        <LeaderboardHeader />
      </View>

      <Podium
        podium={header.podium}
        onPressEntry={goToUser}
      />

      {isPro ? (
        <View className="overflow-hidden rounded-t-3xl bg-white">
          <MeRow
            rank={myRank}
            avatarUri={currentUser?.image ?? undefined}
            displayTotalPoints={
              header.me?.displayTotalPoints ?? 0
            }
            targetPoints={header.targetPoints}
            userName={userName}
            onPress={
              currentUser?._id
                ? () => goToUser(currentUser._id)
                : undefined
            }
          />
        </View>
      ) : (
        /*
         * Keep the rounded top of the white leaderboard section
         * while hiding the current user's rank from free users.
         */
        <View className="h-6 rounded-t-3xl bg-white" />
      )}
    </View>
  );

  const ListFooter = (() => {
    if (shouldShowPaywall) {
      return (
        <View className="bg-white pb-4">
          <PaywallOverlay totalUsers={header.totalUsers}>
            {hiddenEntries.length > 0 ? (
              hiddenEntries.map((entry) => (
                <RankRow
                  key={entry.userId}
                  rank={entry.rank}
                  name={entry.name}
                  avatarUri={entry.image}
                  displayTotalPoints={
                    entry.displayTotalPoints
                  }
                  targetPoints={header.targetPoints}
                />
              ))
            ) : (
              /*
               * Provides height for PaywallOverlay when the preview
               * entries have not loaded yet.
               */
              <View className="h-[216px] bg-white" />
            )}
          </PaywallOverlay>
        </View>
      );
    }

    if (isPro && status === 'LoadingMore') {
      return (
        <View className="bg-white py-4">
          <ActivityIndicator color="#F76B1C" />
        </View>
      );
    }

    return <View className="bg-white pb-4" />;
  })();

  return (
    <SafeAreaView className="flex-1 bg-[#F9F9F9]">
      <Stack.Screen
        options={{
          headerShown: false,
          headerShadowVisible: false,
        }}
      />

      <View className="flex-1">
        <LegendList
          data={visibleEntries}
          keyExtractor={(item) => item.userId}
          renderItem={({ item }: { item: Entry }) => (
            <View className="bg-white">
              <RankRow
                rank={item.rank}
                name={item.name}
                avatarUri={item.image}
                displayTotalPoints={
                  item.displayTotalPoints
                }
                targetPoints={header.targetPoints}
                onPress={() => goToUser(item.userId)}
              />
            </View>
          )}
          ListHeaderComponent={ListHeader}
          ListFooterComponent={ListFooter}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.5}
          estimatedItemSize={72}
          contentContainerStyle={{
            paddingBottom: 0,
          }}
          showsVerticalScrollIndicator={false}
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
        />

        {isPro && header.completedCount > 0 ? (
          <View className="border-t border-[#EFEAE4] bg-white">
            <CompletionFooter
              completedCount={header.completedCount}
              targetPoints={header.targetPoints}
            />
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}