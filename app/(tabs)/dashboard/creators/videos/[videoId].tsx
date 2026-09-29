import { useQuery } from 'convex/react';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, ArrowSquareOut, Barbell, Play, Tag } from 'phosphor-react-native';
import { useState } from 'react';
import { Linking, ScrollView, TouchableOpacity, View } from 'react-native';

import { LinkPreview } from '~/components/core/LinkPreview';
import SafeAreaView from '~/components/core/SafeAreaView';
import ScreenLoading from '~/components/core/ScreenLoading';
import StartWorkoutPopup from '~/components/core/creators/StartWorkoutPopup';
import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';
import { Id } from '~/convex/_generated/dataModel';
import { getData } from '~/utils/storage';

export default function TabDashboardCreatorVideo() {
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
        <Stack.Screen options={{ headerShown: false }} />

        {!video ? (
          <ScreenLoading />
        ) : (
          <ScrollView
            className="flex-1"
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 36 }}
            showsVerticalScrollIndicator={false}>
            <View className="mb-5 mt-3 flex-row items-center justify-between">
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Back to workout collection"
                onPress={() =>
                  router.canGoBack() ? router.back() : router.replace('/(tabs)/workouts')
                }
                className="h-12 w-12 items-center justify-center rounded-full border border-[#E6E1DD] bg-white">
                <ArrowLeft size={22} color="#1A1A1A" weight="bold" />
              </TouchableOpacity>
              <Text style={{ fontFamily: 'Inter_700Bold' }} className="text-lg text-[#1A1A1A]">
                Workout video
              </Text>
              <View className="h-12 w-12" />
            </View>

            <View className="relative overflow-hidden rounded-[26px] bg-[#EDE8E4]">
              <LinkPreview
                text={video.youtubeUrl || ''}
                showCloseButton={false}
                onlyImage
                openLink={false}
                containerStyle={{
                  padding: 0,
                  backgroundColor: '#EDE8E4',
                  borderRadius: 26,
                  width: '100%',
                }}
              />
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Play workout on YouTube"
                activeOpacity={0.88}
                onPress={() => {
                  const skipPopup = getData('skipWorkoutPopup');
                  if (skipPopup) Linking.openURL(video.youtubeUrl || '');
                  else setShowStartWorkoutPopup(true);
                }}
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  width: 64,
                  height: 64,
                  marginLeft: -32,
                  marginTop: -32,
                }}
                className="items-center justify-center rounded-full bg-white shadow-lg">
                <Play size={27} color="#FF5C35" weight="fill" />
              </TouchableOpacity>
            </View>

            <View className="py-6">
              <Text className="font-body text-xs font-semibold uppercase tracking-[2px] text-[#FF5C35]">
                {video.title}
              </Text>
              <Text className="mt-2 font-heading text-[28px] font-semibold leading-9 text-[#1A1A1A]">
                {video.subtitle}
              </Text>
              {video.description ? (
                <Text className="mt-3 font-body text-base leading-6 text-[#716B67]">
                  {video.description}
                </Text>
              ) : null}

              <View className="mt-5 flex-row gap-3">
                {video.difficulty ? (
                  <View className="min-w-0 flex-1 rounded-[18px] bg-white p-4">
                    <Barbell size={21} color="#FF5C35" weight="duotone" />
                    <Text className="mt-3 font-body text-[10px] uppercase tracking-wider text-[#8A837E]">
                      Difficulty
                    </Text>
                    <Text className="mt-1 font-heading text-base font-semibold capitalize text-[#1A1A1A]">
                      {video.difficulty}
                    </Text>
                  </View>
                ) : null}
                {video.equipment ? (
                  <View className="min-w-0 flex-1 rounded-[18px] bg-white p-4">
                    <Tag size={21} color="#FF5C35" weight="duotone" />
                    <Text className="mt-3 font-body text-[10px] uppercase tracking-wider text-[#8A837E]">
                      Equipment
                    </Text>
                    <Text
                      numberOfLines={2}
                      className="mt-1 font-heading text-base font-semibold text-[#1A1A1A]">
                      {video.equipment}
                    </Text>
                  </View>
                ) : null}
              </View>
              {video.category ? (
                <View className="mt-3 self-start rounded-full bg-[#FFF1E9] px-4 py-2">
                  <Text className="font-body text-xs font-semibold text-[#D64A25]">
                    {video.category}
                  </Text>
                </View>
              ) : null}

              <TouchableOpacity
                accessibilityRole="link"
                accessibilityLabel={`Watch ${video.subtitle} on YouTube`}
                activeOpacity={0.88}
                onPress={() => {
                  const skipPopup = getData('skipWorkoutPopup');
                  if (skipPopup) Linking.openURL(video.youtubeUrl || '');
                  else setShowStartWorkoutPopup(true);
                }}
                className="mt-6 min-h-14 flex-row items-center justify-center gap-2 rounded-[18px] bg-[#FF5C35] px-5">
                <Text className="font-heading text-base font-semibold text-white">
                  Watch on YouTube
                </Text>
                <ArrowSquareOut size={20} color="#FFFFFF" weight="bold" />
              </TouchableOpacity>

              <Text className="mt-3 text-center font-body text-xs leading-4 text-[#8A837E]">
                Opens YouTube. Videos are provided by third-party creators.
              </Text>
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </>
  );
}
