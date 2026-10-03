import { useQuery } from 'convex/react';
import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { SectionList, Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import SafeAreaView from '~/components/core/SafeAreaView';
import ScreenLoading from '~/components/core/ScreenLoading';
import TabPageHeader from '~/components/core/TabPageHeader';
import CommunityChallengeCard from '~/components/core/challenges/CommunityChallengeCard';
import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';
import type { Id } from '~/convex/_generated/dataModel';
import { useRetainedQueryResult } from '~/hooks/useRetainedQueryResult';
import { useSubscriptionGuard } from '~/hooks/useSubscriptionGuard';
import { useAuthStore } from '~/store/useAuthStore';

export default function ChallengesScreen() {
  const insets = useSafeAreaInsets();
  const [refreshToken, setRefreshToken] = useState(() => Math.floor(Date.now() / 60000));
  const userId = useAuthStore((state) => state.currentUser?._id);
  const queryResult = useQuery(api.challengeCompletions.getCommunityChallenges, { refreshToken });
  const result = useRetainedQueryResult(queryResult, String(userId ?? 'guest'));
  const { requireSubscription } = useSubscriptionGuard();

  useFocusEffect(
    useCallback(() => {
      // Force a current participation snapshot whenever this tab is opened.
      setRefreshToken(Date.now());
    }, [])
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setRefreshToken(Math.floor(Date.now() / 60000));
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const visibleChallenges = useMemo(() => {
    if (!result) return [];
    return [...result.challenges].sort(
      (a, b) => Number(a.completedToday) - Number(b.completedToday)
    );
  }, [result]);

  const openChallenge = (challengeId: Id<'challenges'>) => {
    const redirectTo = `/challenge-view/${challengeId}`;
    if (!requireSubscription({ redirectTo, source: 'community_challenge_view' })) return;

    router.push({
      pathname: '/challenge-view/[challengeId]',
      params: { challengeId },
    });
  };

  const sections = [
    { title: 'Your challenges', data: visibleChallenges.filter((challenge) => challenge.isJoined) },
    {
      title: 'More challenges',
      data: visibleChallenges.filter((challenge) => !challenge.isJoined),
    },
  ].filter((section) => section.data.length > 0);

  return (
    <SafeAreaView className="flex-1 bg-white">
      <Stack.Screen options={{ headerShown: false }} />

      {result === undefined ? (
        <ScreenLoading />
      ) : (
        <SectionList
          sections={sections}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => (
            <Text className="mb-4 font-heading text-xl font-semibold text-[#1A1A1A]">
              {section.title}
            </Text>
          )}
          renderSectionFooter={() => <View className="h-3" />}
          keyExtractor={(item) => item._id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 32, paddingHorizontal: 20 }}
          ListHeaderComponent={
            <View
              className="mb-6"
              style={Platform.OS === 'android' ? { paddingTop: insets.top } : undefined}>
              <TabPageHeader
                title="Challenges"
                action={
                  <View className="rounded-[20px] bg-[#FFF1E9] px-3 py-2">
                    <Text
                      style={{ fontFamily: 'Inter_600SemiBold' }}
                      className="text-xs text-[#FF5C35]">
                      {result.summary.liveCount} live
                    </Text>
                  </View>
                }
              />
            </View>
          }
          renderItem={({ item }) => (
            <View className="mb-4">
              <CommunityChallengeCard challenge={item} onPress={() => openChallenge(item._id)} />
            </View>
          )}
          ListEmptyComponent={
            <View className="items-center rounded-[24px] bg-white px-6 py-8">
              <Text className="text-center font-body text-sm text-[#77716D]">
                No challenges available
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
