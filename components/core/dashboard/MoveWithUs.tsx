import { useQuery } from 'convex/react';
import { router } from 'expo-router';
import { FlatList, TouchableOpacity, View } from 'react-native';

import ChallengeCard from './ChallengeCard';

import { useRevenueCat } from '~/components/providers/RevenueCatProvider';
import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';

export default function MoveWithUs() {
  const { isPro } = useRevenueCat();

  const challenges = useQuery(api.challengeCompletions.getPublishedChallenges, {});

  const displayChallenges = challenges?.slice(0, 3) ?? [];

  if (displayChallenges.length === 0) return null;

  return (
    <View className="mx-screen-x rounded-card bg-white p-5" style={{ marginHorizontal: 20 }}>
      {/* Header row */}
      <View className="flex-row items-center justify-between">
        <Text className="font-heading text-xl font-bold text-[#1A1A1A]">Move With Us</Text>
        <TouchableOpacity onPress={() => router.push('/(tabs)/dashboard/challenges')}>
          <Text className="font-body text-sm font-medium text-primary-500">See all</Text>
        </TouchableOpacity>
      </View>

      {/* Challenge cards */}
      <View className="mt-3" style={{ marginHorizontal: -16 }}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={displayChallenges}
          keyExtractor={(item) => item._id}
          contentContainerStyle={{ gap: 12, paddingHorizontal: 16 }}
          renderItem={({ item }) => (
            <ChallengeCardWithData challenge={item} isPremium={isPro} />
          )}
        />
      </View>
    </View>
  );
}

// Wrapper that fetches cooldown + count per challenge
function ChallengeCardWithData({
  challenge,
  isPremium,
}: {
  challenge: any;
  isPremium: boolean;
}) {
  const cooldown = useQuery(api.challengeCompletions.getChallengeCooldown, {
    challengeId: challenge._id,
  });

  const handlePress = () => {
    if (cooldown?.completedToday) return;
    router.push({
      pathname: '/challenge-view/[challengeId]' as any,
      params: { challengeId: challenge._id },
    });
  };

  return (
    <ChallengeCard
      challenge={challenge}
      completedToday={cooldown?.completedToday ?? false}
      lastCompletedAt={cooldown?.lastCompletedAt ?? null}
      totalCompletions={challenge.userCompletedCount  ?? 0}
      isPremium={isPremium}
      onPress={handlePress}
    />
  );
}
