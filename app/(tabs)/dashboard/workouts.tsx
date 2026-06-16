import { convexQuery } from '@convex-dev/react-query';
import { useQuery } from '@tanstack/react-query';
import { router, Stack } from 'expo-router';
import { useCallback } from 'react';
import { FlatList, TouchableOpacity, View, ImageBackground } from 'react-native';

import { BackButton } from '~/components/core/BackButton';
import SafeAreaView from '~/components/core/SafeAreaView';
import ScreenLoading from '~/components/core/ScreenLoading';
import CreatorRow from '~/components/core/creators/Row';
import { useRevenueCat } from '~/components/providers/RevenueCatProvider';
import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';
import { Doc } from '~/convex/_generated/dataModel';

export default function TabDashboardWorkouts() {
  const { data, isPending } = useQuery(convexQuery(api.admin.getCreators, {}));
  const { isPro } = useRevenueCat();

  const handleCreatorPress = useCallback(
    (creator: Doc<'creators'>) => {
      if (creator.isPremium && !isPro) {
        router.push('/dashboard/paywall');
      } else {
        router.push({
          pathname: '/dashboard/creators/[creatorId]',
          params: { creatorId: creator._id },
        });
      }
    },
    [isPro]
  );

  return (
    <ImageBackground
      source={require('~/assets/backgrounds/sweat.png')}
      className="flex-1"
      resizeMode="cover">
      <SafeAreaView className="flex-1">
        <Stack.Screen
          options={{
            title: '',
            headerTitle: '',
            headerTitleAlign: 'center',
            headerShadowVisible: false,
            headerBackVisible: false,
            headerLeft: () => <BackButton text="Back" onPress={router.back} />,
          }}
        />

        {isPending ? (
          <ScreenLoading />
        ) : (
          <View className="flex-1 flex-col px-4">
            <View className="flex-1">
              <FlatList
                showsVerticalScrollIndicator={false}
                data={data}
                renderItem={({ item }) => (
                  <TouchableOpacity onPress={() => handleCreatorPress(item)}>
                    <CreatorRow creator={item} hideDescription />
                  </TouchableOpacity>
                )}
                keyExtractor={(item) => item._id}
                ListEmptyComponent={
                  <Text className="text-center text-2xl text-white">No creators</Text>
                }
                ListHeaderComponent={
                  <View className="mb-6 mt-8 flex-col items-center justify-center">
                    <Text className="text-center text-2xl font-bold text-white">
                      Find Your Next Sweat
                    </Text>
                  </View>
                }
              />
            </View>
          </View>
        )}
      </SafeAreaView>
    </ImageBackground>
  );
}
