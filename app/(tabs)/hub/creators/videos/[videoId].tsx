import { useQuery } from 'convex/react';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, Platform, ScrollView, TouchableOpacity, View } from 'react-native';

import { BackButton } from '~/components/core/BackButton';
import { LinkPreview } from '~/components/core/LinkPreview';
import SafeAreaView from '~/components/core/SafeAreaView';
import ScreenLoading from '~/components/core/ScreenLoading';
import StartWorkoutPopup from '~/components/core/creators/StartWorkoutPopup';
import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';
import { Id } from '~/convex/_generated/dataModel';
import { getData } from '~/utils/storage';

export default function TabHubCreatorVideo() {
  const [showStartWorkoutPopup, setShowStartWorkoutPopup] = useState(false);
  const { videoId } = useLocalSearchParams();
  const video = useQuery(api.admin.getCreatorVideo, {
    creatorVideoId: videoId as Id<'creatorVideos'>,
  });

  return (
    <>
      <StartWorkoutPopup
        showAlertDialog={showStartWorkoutPopup}
        handleClose={() => setShowStartWorkoutPopup(false)}
        handlePrimaryButtonPress={() => {
          setShowStartWorkoutPopup(false);
          Linking.openURL(video?.youtubeUrl || '');
        }}
      />
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
            headerLeft: () => <BackButton fallbackHref="/(tabs)/hub" text="Back" />,
          }}
        />

        {!video ? (
          <ScreenLoading />
        ) : (
          <ScrollView className="mx-8 flex-1" showsVerticalScrollIndicator={false}>
            <View className="my-8 flex-1">
              <View>
                <Text className="text-2xl font-semibold text-primary-500">{video.title}</Text>
              </View>
              <View className="mt-4">
                <LinkPreview
                  text={video.youtubeUrl || ''}
                  showCloseButton={false}
                  onlyImage
                  openLink
                  containerStyle={{
                    padding: 0,
                    backgroundColor: '#F9F9F9',
                    borderRadius: 10,
                    width: '100%',
                  }}
                />
              </View>
              <View className="mt-4">
                <Text className="text-2xl font-semibold text-primary-500">{video.subtitle}</Text>
              </View>
              <View className="mt-4">
                <Text className="text-justify text-lg font-medium text-gray-500">
                  {video.description}
                </Text>
              </View>
              {video.difficulty ? (
                <View className="mt-4">
                  <Text className="text-justify text-xl font-medium text-gray-500">
                    <Text className="text-xl font-semibold text-gray-900">Difficulty: </Text>
                    {video.difficulty.charAt(0).toUpperCase() + video.difficulty.slice(1)}
                  </Text>
                </View>
              ) : null}
              {video.equipment ? (
                <View className="mt-4">
                  <Text className="text-justify text-xl font-medium text-gray-500">
                    <Text className="text-xl font-semibold text-gray-900">Equipment: </Text>
                    {video.equipment.charAt(0).toUpperCase() + video.equipment.slice(1)}
                  </Text>
                </View>
              ) : null}
              {video.category ? (
                <View className="mt-4">
                  <Text className="text-justify text-xl font-medium text-gray-500">
                    <Text className="text-xl font-semibold text-gray-900">Category: </Text>
                    {video.category.charAt(0).toUpperCase() + video.category.slice(1)}
                  </Text>
                </View>
              ) : null}
              <View className="mt-4">
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => {
                    const skipPopup = getData('skipWorkoutPopup');
                    if (skipPopup) {
                      Linking.openURL(video.youtubeUrl || '');
                    } else {
                      setShowStartWorkoutPopup(true);
                    }
                  }}
                  style={{
                    borderRadius: 9999,
                    ...(Platform.OS === 'ios'
                      ? {
                          shadowColor: '#000000',
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: 0.08,
                          shadowRadius: 4,
                        }
                      : {
                          elevation: 3,
                        }),
                  }}>
                  <LinearGradient
                    colors={['#FFA480', '#FF5C1A']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={{
                      borderRadius: 9999,
                      paddingVertical: 16,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                    <Text className="text-xl font-bold text-white">Watch on YouTube</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </>
  );
}
