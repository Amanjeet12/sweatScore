import { useQuery } from 'convex/react';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { FlatList, ScrollView, TouchableOpacity, View } from 'react-native';

import { BackButton } from '~/components/core/BackButton';
import SafeAreaView from '~/components/core/SafeAreaView';
import ScreenLoading from '~/components/core/ScreenLoading';
import ChallengeCard from '~/components/core/dashboard/ChallengeCard';
import { useRevenueCat } from '~/components/providers/RevenueCatProvider';
import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';
import { CHALLENGE_TAGS } from '~/convex/challenges';

const ALL_FILTERS = ['All', ...CHALLENGE_TAGS] as const;

function ChallengeCardWithData({ challenge, isPremium }: { challenge: any; isPremium: boolean }) {
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
      totalCompletions={challenge.userCompletedCount ?? 0}
      isPremium={isPremium}
      onPress={handlePress}
      fullWidth
    />
  );
}

export default function ChallengesScreen() {
  const [selectedTag, setSelectedTag] = useState<string>('All');
  const { isPro } = useRevenueCat();

  const challenges = useQuery(api.challengeCompletions.getPublishedChallenges, {
    tag: selectedTag === 'All' ? undefined : selectedTag,
  });

  return (
    <SafeAreaView className="flex-1 bg-[#F9F9F9]">
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitleAlign: 'center',
          title: '',
          headerTitle: () => (
            <Text className="text-center font-heading text-2xl font-bold text-[#1A1A1A]">
              Progress Videos{' '}
            </Text>
          ),
          headerShadowVisible: false,
          headerStyle: { backgroundColor: '#F9F9F9' },
          headerLeft: () => (
            <BackButton
              onPress={() => {
                if (router.canGoBack()) {
                  router.back();
                } else {
                  router.replace('/(tabs)/dashboard');
                }
              }}
            />
          ),
        }}
      />

      {/* Tag filter pills */}
      <View className="px-screen mt-2">
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row gap-x-2">
            {ALL_FILTERS.map((tag) => (
              <TouchableOpacity
                key={tag}
                onPress={() => setSelectedTag(tag)}
                className={`rounded-full border px-4 py-2 ${
                  selectedTag === tag
                    ? 'border-primary-500 bg-primary-500'
                    : 'border-gray-300 bg-white'
                }`}>
                <Text
                  className={`font-body text-sm font-medium ${
                    selectedTag === tag ? 'text-white' : 'text-[#313131]'
                  }`}>
                  {tag}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* Challenge list */}
      {challenges === undefined ? (
        <ScreenLoading />
      ) : (
        <FlatList
          className="mt-4"
          data={challenges}
          keyExtractor={(item) => item._id}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 16, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => <ChallengeCardWithData challenge={item} isPremium={isPro} />}
          ListEmptyComponent={
            <Text className="mt-8 text-center text-base text-gray-500">No challenges found</Text>
          }
        />
      )}
    </SafeAreaView>
  );
}
