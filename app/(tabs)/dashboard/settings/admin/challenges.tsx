import { usePaginatedQuery } from 'convex/react';
import { router, Stack } from 'expo-router';
import { FlatList, TouchableOpacity, View } from 'react-native';

import { BackButton } from '~/components/core/BackButton';
import SafeAreaView from '~/components/core/SafeAreaView';
import ScreenLoading from '~/components/core/ScreenLoading';
import ChallengeRow from '~/components/core/admin/ChallengeRow';
import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';

export default function AdminViewChallenges() {
  const { results, status, loadMore } = usePaginatedQuery(
    api.admin.listChallenges,
    {},
    { initialNumItems: 20 }
  );

  return (
    <SafeAreaView className="flex-1 bg-white">
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitleAlign: 'center',
          title: '',
          headerTitle: () => (
            <Text className="text-center font-heading text-2xl font-bold text-[#1A1A1A]">
              Challenges
            </Text>
          ),
          headerShadowVisible: false,
          headerRight: () => (
            <TouchableOpacity onPress={() => router.push('/challenge/new')}>
              <Text className="text-xl font-semibold text-primary-500">+ Add</Text>
            </TouchableOpacity>
          ),
          headerLeft: () => <BackButton fallbackHref="/(tabs)/dashboard/settings/admin" />,
        }}
      />

      {status === 'LoadingFirstPage' ? (
        <ScreenLoading />
      ) : (
        <View className="mx-4 mt-4 flex-1">
          <FlatList
            showsVerticalScrollIndicator={false}
            data={results}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() =>
                  router.push({
                    pathname: '/challenge/[challengeId]',
                    params: { challengeId: item._id },
                  })
                }
                className="mb-3">
                <ChallengeRow challenge={item} />
              </TouchableOpacity>
            )}
            keyExtractor={(item) => item._id}
            ListEmptyComponent={
              <Text className="text-center text-xl text-gray-500">No challenges yet</Text>
            }
            onEndReached={() => {
              if (status === 'CanLoadMore') {
                loadMore(20);
              }
            }}
            onEndReachedThreshold={0.5}
          />
        </View>
      )}
    </SafeAreaView>
  );
}
