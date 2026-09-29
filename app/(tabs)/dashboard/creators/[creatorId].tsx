import { useQuery } from 'convex/react';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, ArrowRight, Barbell, PencilSimple, Play } from 'phosphor-react-native';
import { FlatList, TouchableOpacity, View } from 'react-native';

import SafeAreaView from '~/components/core/SafeAreaView';
import ScreenLoading from '~/components/core/ScreenLoading';
import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';
import { Doc, Id } from '~/convex/_generated/dataModel';
import { useAuthStore } from '~/store/useAuthStore';

function youtubeThumbnail(url?: string) {
  if (!url) return null;
  const match = url.match(/(?:youtu\.be\/|[?&]v=|youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/);
  return match ? `https://i.ytimg.com/vi/${match[1]}/hqdefault.jpg` : null;
}

function openVideo(videoId: Id<'creatorVideos'>) {
  router.push({
    pathname: '/dashboard/creators/videos/[videoId]',
    params: { videoId },
  });
}

function WorkoutCard({ video }: { video: Doc<'creatorVideos'> }) {
  const thumbnail = youtubeThumbnail(video.youtubeUrl);
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={`Open ${video.subtitle || video.title}`}
      activeOpacity={0.88}
      onPress={() => openVideo(video._id)}
      className="mb-3 flex-row overflow-hidden rounded-[22px] bg-white">
      <View className="relative h-[128px] w-[138px] bg-[#F1ECE7]">
        {thumbnail ? (
          <Image
            source={{ uri: thumbnail }}
            contentFit="cover"
            transition={180}
            style={{ width: '100%', height: '100%' }}
          />
        ) : (
          <View className="h-full w-full items-center justify-center">
            <Barbell size={34} color="#C7BEB8" weight="duotone" />
          </View>
        )}
        <View className="absolute bottom-3 left-3 h-9 w-9 items-center justify-center rounded-full bg-white">
          <Play size={16} color="#FF5C35" weight="fill" />
        </View>
      </View>
      <View className="min-w-0 flex-1 justify-center px-4 py-3">
        <Text className="font-body text-[10px] font-semibold uppercase tracking-widest text-[#FF5C35]">
          {video.title}
        </Text>
        <Text
          numberOfLines={3}
          className="mt-1 font-heading text-base font-semibold leading-5 text-[#1A1A1A]">
          {video.subtitle}
        </Text>
        <View className="mt-2 flex-row items-center justify-between">
          <Text className="font-body text-xs capitalize text-[#77716D]">
            {video.difficulty ?? video.category ?? 'Workout'}
          </Text>
          <ArrowRight size={17} color="#FF5C35" weight="bold" />
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function TabDashboardCreator() {
  const { creatorId } = useLocalSearchParams();
  const currentUser = useAuthStore((state) => state.currentUser);
  const creator = useQuery(api.admin.getCreator, {
    creatorId: creatorId as Id<'creators'>,
  });
  const creatorVideos = useQuery(api.admin.getCreatorVideos, {
    creatorId: creatorId as Id<'creators'>,
  });

  if (!creator || !creatorVideos) return <ScreenLoading />;

  const videos = [...creatorVideos]
    .filter((video) => video.isActive !== false)
    .sort((a, b) => a.order - b.order);
  const heroImage = creator.posterImageUrl ?? youtubeThumbnail(videos[0]?.youtubeUrl);

  return (
    <SafeAreaView className="flex-1 bg-[#F9F9F9]">
      <Stack.Screen options={{ headerShown: false }} />
      <FlatList
        data={videos}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => <WorkoutCard video={item} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 36 }}
        ListHeaderComponent={
          <View>
            <View className="mb-5 mt-3 flex-row items-center justify-between">
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Back to workout library"
                onPress={() => (router.canGoBack() ? router.back() : router.replace('/workouts'))}
                className="h-12 w-12 items-center justify-center rounded-full border border-[#E6E1DD] bg-white">
                <ArrowLeft size={22} color="#1A1A1A" weight="bold" />
              </TouchableOpacity>
              <Text style={{ fontFamily: 'Inter_700Bold' }} className="text-lg text-[#1A1A1A]">
                Workout collection
              </Text>
              <View className="h-12 w-12" />
            </View>

            <View className="relative mb-5 h-[220px] overflow-hidden rounded-[26px] bg-[#2D2926]">
              {heroImage ? (
                <Image
                  source={{ uri: heroImage }}
                  contentFit="cover"
                  transition={180}
                  style={{ width: '100%', height: '100%' }}
                />
              ) : (
                <View className="h-full w-full items-center justify-center">
                  <Barbell size={58} color="#665F5A" weight="duotone" />
                </View>
              )}
              <LinearGradient
                colors={['rgba(0,0,0,0.02)', 'rgba(0,0,0,0.82)']}
                locations={[0.2, 1]}
                className="absolute inset-0"
              />
              {currentUser?.isAdmin ? (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={`Edit ${creator.name}`}
                  onPress={() =>
                    router.push({ pathname: '/creator/edit', params: { creatorId: creator._id } })
                  }
                  className="absolute right-4 top-4 h-11 w-11 items-center justify-center rounded-full bg-black/60">
                  <PencilSimple size={20} color="#FFFFFF" weight="bold" />
                </TouchableOpacity>
              ) : null}
              <View className="absolute inset-x-0 bottom-0 p-5">
                <Text className="font-body text-[10px] font-semibold uppercase tracking-widest text-white/80">
                  {videos.length} {videos.length === 1 ? 'WORKOUT' : 'WORKOUTS'}
                </Text>
                <Text className="mt-1 font-heading text-[28px] font-semibold leading-9 text-white">
                  {creator.name}
                </Text>
              </View>
            </View>

            {creator.description ? (
              <Text className="mb-6 font-body text-base leading-6 text-[#716B67]">
                {creator.description}
              </Text>
            ) : null}

            <View className="mb-4 flex-row items-end justify-between">
              <View>
                <Text className="font-heading text-2xl font-semibold text-[#1A1A1A]">
                  Choose a workout
                </Text>
                <Text className="mt-1 font-body text-sm text-[#77716D]">
                  Opens safely through YouTube.
                </Text>
              </View>
              <View className="rounded-full bg-[#FFF1E9] px-3 py-2">
                <Text className="font-body text-xs font-semibold text-[#FF5C35]">
                  {videos.length} videos
                </Text>
              </View>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View className="items-center rounded-[24px] bg-white px-6 py-9">
            <Barbell size={34} color="#FF5C35" weight="duotone" />
            <Text className="mt-4 font-heading text-xl font-semibold text-[#1A1A1A]">
              No workouts yet
            </Text>
            <Text className="mt-2 text-center font-body text-sm text-[#77716D]">
              New videos will appear here when they are ready.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}
