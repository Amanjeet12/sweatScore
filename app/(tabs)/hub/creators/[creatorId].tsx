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

export default function TabHubCreator() {
  const { creatorId } = useLocalSearchParams();
  const creator = useQuery(api.admin.getCreator, {
    creatorId: creatorId as Id<'creators'>,
  });

  const creatorVideos = useQuery(api.admin.getCreatorVideos, {
    creatorId: creatorId as Id<'creators'>,
  });

  return (
    <SafeAreaView className="flex-1 bg-[#F9F9F9]">
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitleAlign: 'center',
          title: '',
          headerShadowVisible: false,
          headerStyle: {
            backgroundColor: '#F9F9F9',
          },
          headerLeft: () => (
            <BackButton
              onPress={() => {
                if (router.canGoBack()) {
                  router.back();
                } else {
                  router.replace('/(tabs)/hub');
                }
              }}
              text="Back"
            />
          ),
        }}
      />

      {!creator || !creatorVideos ? (
        <ScreenLoading />
      ) : (
        <View className="flex-1">
          <View className="flex-1">
            <FlatList
              showsVerticalScrollIndicator={false}
              data={creatorVideos}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() =>
                    router.push({
                      pathname: '/hub/creators/videos/[videoId]',
                      params: { videoId: item._id },
                    })
                  }>
                  <CreatorVideoRow
                    creatorVideo={item}
                    onPress={() => {
                      router.push({
                        pathname: '/hub/creators/videos/[videoId]',
                        params: { videoId: item._id },
                      });
                    }}
                  />
                </TouchableOpacity>
              )}
              keyExtractor={(item) => item._id.toString()}
              ListHeaderComponent={<CreatorRow creator={creator} />}
              ListEmptyComponent={<Text className="text-center text-2xl">No videos</Text>}
            />
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}
