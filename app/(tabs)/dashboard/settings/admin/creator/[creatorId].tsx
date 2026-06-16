import { useQuery } from 'convex/react';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { FlatList, TouchableOpacity, View } from 'react-native';

import { BackButton } from '~/components/core/BackButton';
import SafeAreaView from '~/components/core/SafeAreaView';
import ScreenLoading from '~/components/core/ScreenLoading';
import CreatorRow from '~/components/core/creators/Row';
import CreatorVideoRow from '~/components/core/creators/VideoRow';
import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';
import { Id } from '~/convex/_generated/dataModel';

export default function AdminViewCreator() {
  const { creatorId } = useLocalSearchParams();
  const creator = useQuery(api.admin.getCreator, {
    creatorId: creatorId as Id<'creators'>,
  });

  const creatorVideos = useQuery(api.admin.getCreatorVideos, {
    creatorId: creatorId as Id<'creators'>,
  });

  return (
    <SafeAreaView className="flex-1 bg-white">
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitleAlign: 'center',
          title: '',
          headerTitle: () => (
            <Text className="text-center font-heading text-2xl font-bold text-[#1A1A1A]">
              Creator Hub
            </Text>
          ),
          headerShadowVisible: false,
          headerRight: () => (
            <TouchableOpacity
              onPress={() =>
                router.push({
                  pathname: '/creator-video/new',
                  params: { creatorId },
                })
              }>
              <Text className="text-xl font-semibold text-primary-500">+ Video</Text>
            </TouchableOpacity>
          ),
          headerLeft: () => (
            <BackButton
              onPress={() => {
                if (router.canGoBack()) {
                  router.back();
                } else {
                  router.replace('/(tabs)/dashboard/settings');
                }
              }}
            />
          ),
        }}
      />

      {!creator || !creatorVideos ? (
        <ScreenLoading />
      ) : (
        <View className="mx-4 mt-4 flex-1">
          <FlatList
            showsVerticalScrollIndicator={false}
            data={creatorVideos}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() =>
                  router.push({
                    pathname: '/creator-video/edit',
                    params: { creatorVideoId: item._id },
                  })
                }>
                <CreatorVideoRow creatorVideo={item} />
              </TouchableOpacity>
            )}
            keyExtractor={(item) => item._id.toString()}
            ListHeaderComponent={<CreatorRow creator={creator} />}
            ListEmptyComponent={<Text className="text-center text-2xl">No videos</Text>}
          />
        </View>
      )}
    </SafeAreaView>
  );
}
