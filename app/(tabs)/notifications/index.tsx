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
const HIDDEN_PREVIEW = 3;
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

  const { syncAllMissedDays } = useHealthSync(
    currentUser?._id as Id<'users'>,
    undefined,
    currentUser?.birthdate
  );
  const [isRefreshing, setIsRefreshing] = useState(false);

  const yearMonth = useMemo(() => {
    const today = new Date();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    return `${today.getFullYear()}-${month}`;
  }, []);

  const header = useQuery(api.leaderboard.getMonthlyLeaderboardHeader, { yearMonth });

  const { results, status, loadMore } = usePaginatedQuery(
    api.leaderboard.listMonthlyLeaderboard,
    { yearMonth },
    { initialNumItems: isPro ? PREMIUM_PAGE_SIZE : FREE_VISIBLE_COUNT + HIDDEN_PREVIEW + 1 }
  );

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await syncAllMissedDays();
    setIsRefreshing(false);
  };

  const goToUser = useCallback(
    (userId: string) => {
      if (!isPro && userId !== currentUser?._id) {
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
    [isPro, currentUser?._id]
  );

  if (!header) {
    return (
      <SafeAreaView className="flex-1 bg-[#F9F9F9]">
        <ScreenLoading />
      </SafeAreaView>
    );
  }

  const entries = (results as Entry[]).filter((e) => e.userId !== currentUser?._id);
  const visibleEntries = isPro ? entries : entries.slice(0, FREE_VISIBLE_COUNT);
  const hiddenEntries = isPro
    ? []
    : entries.slice(FREE_VISIBLE_COUNT, FREE_VISIBLE_COUNT + HIDDEN_PREVIEW);

  const handleEndReached = () => {
    if (!isPro) return;
    if (status === 'CanLoadMore') loadMore(PREMIUM_PAGE_SIZE);
  };

  const ListHeader = (
    <View>
      <View style={Platform.OS === 'android' ? { paddingTop: insets.top } : undefined}>
        <LeaderboardHeader />
      </View>
      <Podium podium={header.podium} onPressEntry={goToUser} />
      <View className="overflow-hidden rounded-t-3xl bg-white">
        <MeRow
          avatarUri={currentUser?.image ?? undefined}
          displayTotalPoints={header.me?.displayTotalPoints ?? 0}
          targetPoints={header.targetPoints}
          onPress={currentUser?._id ? () => goToUser(currentUser._id) : undefined}
        />
      </View>
    </View>
  );

  const ListFooter = (() => {
    if (hiddenEntries.length > 0) {
      return (
        <View className="bg-white pb-4">
          <PaywallOverlay totalUsers={header.totalUsers}>
            {hiddenEntries.map((e) => (
              <RankRow
                key={e.userId}
                name={e.name}
                avatarUri={e.image}
                displayTotalPoints={e.displayTotalPoints}
                targetPoints={header.targetPoints}
              />
            ))}
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
      <Stack.Screen options={{ headerShown: false, headerShadowVisible: false }} />
      <View className="flex-1">
        <LegendList
          data={visibleEntries}
          keyExtractor={(item) => item.userId}
          renderItem={({ item }: { item: Entry }) => (
            <View className="bg-white">
              <RankRow
                name={item.name}
                avatarUri={item.image}
                displayTotalPoints={item.displayTotalPoints}
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
          contentContainerStyle={{ paddingBottom: 0 }}
          showsVerticalScrollIndicator={false}
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
        />
        {header.completedCount > 0 && (
          <View className="border-t border-[#EFEAE4] bg-white">
            <CompletionFooter
              completedCount={header.completedCount}
              targetPoints={header.targetPoints}
            />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
