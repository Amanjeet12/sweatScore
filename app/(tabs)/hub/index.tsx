import { useMutation, useQuery } from 'convex/react';
import { router, Stack } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import SafeAreaView from '~/components/core/SafeAreaView';
import ScreenLoading from '~/components/core/ScreenLoading';
import CommunityChallengeCard from '~/components/core/challenges/CommunityChallengeCard';
import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';
import type { Id } from '~/convex/_generated/dataModel';
import { useRetainedQueryResult } from '~/hooks/useRetainedQueryResult';
import { useSubscriptionGuard } from '~/hooks/useSubscriptionGuard';
import { useAuthStore } from '~/store/useAuthStore';
import { getErrorMessage } from '~/utils/error-message';

type ChallengeListTab = 'joined' | 'not_joined';

export default function ChallengesScreen() {
  const insets = useSafeAreaInsets();
  const [selectedTab, setSelectedTab] = useState<ChallengeListTab>('not_joined');
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(() => Math.floor(Date.now() / 60000));
  const userId = useAuthStore((state) => state.currentUser?._id);
  const queryResult = useQuery(api.challengeCompletions.getCommunityChallenges, { refreshToken });
  const result = useRetainedQueryResult(queryResult, String(userId ?? 'guest'));
  const joinChallenge = useMutation(api.challengeCompletions.joinCommunityChallenge);
  const { requireSubscription } = useSubscriptionGuard();

  useEffect(() => {
    const interval = setInterval(() => {
      setRefreshToken(Math.floor(Date.now() / 60000));
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const visibleChallenges = useMemo(() => {
    if (!result) return [];
    return result.challenges.filter((challenge) =>
      selectedTab === 'joined' ? challenge.isJoined : !challenge.isJoined
    );
  }, [result, selectedTab]);

  const openChallenge = (challengeId: Id<'challenges'>) => {
    router.push({
      pathname: '/challenge-view/[challengeId]',
      params: { challengeId },
    });
  };

  const handleJoin = async (challenge: (typeof visibleChallenges)[number]) => {
    const redirectTo = `/challenge-view/${challenge._id}`;
    if (!requireSubscription({ redirectTo, source: 'community_challenge_join' })) {
      return;
    }

    setJoiningId(challenge._id);
    try {
      await joinChallenge({ challengeId: challenge._id });
      setSelectedTab('joined');
    } catch (error) {
      Alert.alert('Unable to join', getErrorMessage(error));
    } finally {
      setJoiningId(null);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#F9F9F9]">
      <Stack.Screen options={{ headerShown: false }} />

      {result === undefined ? (
        <ScreenLoading />
      ) : (
        <FlatList
          data={visibleChallenges}
          keyExtractor={(item) => item._id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 32, paddingHorizontal: 20 }}
          ListHeaderComponent={
            <View style={Platform.OS === 'android' ? { paddingTop: insets.top + 12 } : undefined}>
              <View className="mb-5 mt-3 flex-row items-end justify-between">
                <View>
                  <Text
                    style={{ fontFamily: 'Inter_700Bold' }}
                    className="mt-1 text-[28px] text-[#1A1A1A]">
                    Challenges
                  </Text>
                </View>
                <View className="mb-1 rounded-[20px] bg-[#FFF1E9] px-3 py-2">
                  <Text
                    style={{ fontFamily: 'Inter_600SemiBold' }}
                    className="text-xs text-[#FF5C35]">
                    {result.summary.liveCount} live
                  </Text>
                </View>
              </View>

              <View className="mb-4 flex-row items-center justify-between rounded-[24px] bg-white px-5 py-5">
                <View>
                  <Text className="font-body text-xs text-[#77716D]">Today&apos;s Progress</Text>
                  <Text
                    style={{ fontFamily: 'Inter_700Bold' }}
                    className="mt-1 text-base text-[#1A1A1A]">
                    {result.summary.completedToday}{' '}
                    {result.summary.completedToday === 1 ? 'challenge' : 'challenges'} completed
                  </Text>
                </View>

                <View className="h-[88px] w-[88px] items-center justify-center rounded-full border-[5px] border-[#FFD9C9]">
                  <Text style={{ fontFamily: 'Inter_700Bold' }} className="text-xl text-[#1A1A1A]">
                    {result.summary.monthPoints ?? '—'}
                  </Text>
                  <Text className="px-2 text-center font-body text-[9px] text-[#77716D]">
                    points added this month
                  </Text>
                </View>
              </View>

              <View className="mb-4 flex-row rounded-[24px] bg-[#F1ECE7] p-1">
                {(['joined', 'not_joined'] as const).map((tab) => {
                  const selected = selectedTab === tab;
                  const count =
                    tab === 'joined' ? result.summary.joinedCount : result.summary.notJoinedCount;
                  return (
                    <Pressable
                      key={tab}
                      onPress={() => setSelectedTab(tab)}
                      className={`flex-1 flex-row items-center justify-center rounded-[20px] py-3 ${
                        selected ? 'bg-white' : ''
                      }`}>
                      <Text
                        style={{ fontFamily: 'Inter_600SemiBold' }}
                        className={`text-xs ${selected ? 'text-[#1A1A1A]' : 'text-[#77716D]'}`}>
                        {tab === 'joined' ? 'Joined' : 'Not joined'}
                      </Text>
                      <Text
                        style={{ fontFamily: 'Inter_600SemiBold' }}
                        className="ml-2 text-xs text-[#FF5C35]">
                        {count}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          }
          renderItem={({ item }) => (
            <View className="mb-4">
              <CommunityChallengeCard
                challenge={item}
                joining={joiningId === item._id}
                onPress={() => openChallenge(item._id)}
                onJoin={() => handleJoin(item)}
              />
            </View>
          )}
          ListEmptyComponent={
            <View className="items-center rounded-[24px] bg-white px-6 py-12">
              {joiningId ? <ActivityIndicator color="#FF5C35" /> : null}
              <Text
                style={{ fontFamily: 'Inter_700Bold' }}
                className="text-center text-lg text-[#313131]">
                {selectedTab === 'joined'
                  ? 'No joined challenges yet'
                  : 'No challenges available to join'}
              </Text>
              {selectedTab === 'joined' && result.summary.notJoinedCount > 0 ? (
                <Pressable
                  onPress={() => setSelectedTab('not_joined')}
                  className="mt-4 rounded-[20px] bg-[#FF5C35] px-5 py-3">
                  <Text style={{ fontFamily: 'Inter_600SemiBold' }} className="text-sm text-white">
                    Explore challenges
                  </Text>
                </Pressable>
              ) : null}
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
