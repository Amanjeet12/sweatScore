import { useQuery } from 'convex/react';
import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { SectionList, View } from 'react-native';

import SafeAreaView from '~/components/core/CoachSafeAreaView';
import ScreenLoading from '~/components/core/ScreenLoading';
import CommunityChallengeCard from '~/components/core/challenges/CommunityChallengeCard';
import { prototypeTypography as type } from '~/components/core/design/prototypeStyles';
import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';
import type { Id } from '~/convex/_generated/dataModel';
import { useRetainedQueryResult } from '~/hooks/useRetainedQueryResult';
import { useSubscriptionGuard } from '~/hooks/useSubscriptionGuard';
import { useAuthStore } from '~/store/useAuthStore';

export default function ChallengesScreen() {
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
            <Text style={[type.sectionHeading, { marginBottom: 14 }]}>{section.title}</Text>
          )}
          renderSectionFooter={() => <View style={{ height: 8 }} />}
          keyExtractor={(item) => item._id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 32, paddingHorizontal: 22 }}
          ListHeaderComponent={
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                paddingTop: 12,
                marginBottom: 24,
              }}>
              <Text style={[type.planHeading, { flex: 1 }]}>Challenges</Text>
              <View
                style={{
                  backgroundColor: '#fdebe3',
                  borderRadius: 15,
                  paddingHorizontal: 14,
                  paddingVertical: 6,
                }}>
                <Text style={[type.caption, { fontFamily: 'Inter_600SemiBold', color: '#ff5a1f' }]}>
                  {result.summary.liveCount} live
                </Text>
              </View>
            </View>
          }
          renderItem={({ item }) => (
            <View className="mb-4">
              <CommunityChallengeCard challenge={item} onPress={() => openChallenge(item._id)} />
            </View>
          )}
          ListEmptyComponent={
            <View className="items-center rounded-[24px] bg-white px-6 py-8">
              <Text style={[type.supporting, { textAlign: 'center' }]}>
                No challenges available
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
