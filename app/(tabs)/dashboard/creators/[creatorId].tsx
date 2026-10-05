import { useQuery } from 'convex/react';
import { router, Stack, useLocalSearchParams, usePathname } from 'expo-router';
import { Barbell, PencilSimple } from 'phosphor-react-native';
import { FlatList, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import ScreenLoading from '~/components/core/ScreenLoading';
import {
  CollectionHero,
  WorkoutHeader,
  WorkoutImage,
  workoutThumbnail,
} from '~/components/core/creators/WorkoutPresentation';
import {
  workoutStyles as styles,
  workoutTypography as type,
} from '~/components/core/design/WorkoutStyles';
import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';
import { Doc, Id } from '~/convex/_generated/dataModel';
import { useAuthStore } from '~/store/useAuthStore';

function WorkoutCard({
  video,
  library = false,
}: {
  video: Doc<'creatorVideos'>;
  library?: boolean;
}) {
  const { width, fontScale } = useWindowDimensions();
  const stacked = width < 350 || fontScale > 1.3;
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={`Open ${video.subtitle || video.title}`}
      activeOpacity={0.88}
      onPress={() =>
        router.push({
          pathname: library
            ? '/workouts/creators/videos/[videoId]'
            : '/dashboard/creators/videos/[videoId]',
          params: { videoId: video._id },
        })
      }
      style={[styles.row, stacked && { flexDirection: 'column' }]}>
      <View
        style={{
          width: stacked ? '100%' : 148,
          borderRadius: 12,
          backgroundColor: '#eee',
          shadowColor: '#1e140a',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
          elevation: 2,
        }}>
        <View style={[styles.thumbnail, { width: '100%', aspectRatio: 148 / 83 }]}>
          <WorkoutImage uri={workoutThumbnail(video.youtubeUrl)} />
        </View>
      </View>
      <View style={{ flex: stacked ? undefined : 1, minWidth: 0, gap: 4, paddingTop: 1 }}>
        <Text style={type.video}>{video.subtitle || video.title}</Text>
        <Text style={[type.caption, { textTransform: 'capitalize' }]}>
          {video.difficulty ?? video.category ?? 'Workout'}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

export default function TabDashboardCreator() {
  const { creatorId, fromWorkouts } = useLocalSearchParams();
  const library = usePathname().startsWith('/workouts/');
  const currentUser = useAuthStore((state) => state.currentUser);
  const creator = useQuery(api.admin.getCreator, { creatorId: creatorId as Id<'creators'> });
  const creatorVideos = useQuery(api.admin.getCreatorVideos, {
    creatorId: creatorId as Id<'creators'>,
  });
  if (!creator || !creatorVideos) return <ScreenLoading />;
  const videos = [...creatorVideos]
    .filter((video) => video.isActive !== false)
    .sort((a, b) => a.order - b.order);
  return (
    <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <FlatList
        data={videos}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => <WorkoutCard video={item} library={library} />}
        ItemSeparatorComponent={() => <View style={{ height: 18 }} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View>
            <WorkoutHeader
              title="Workouts"
              backLabel="Back to workout library"
              fallback="/workouts"
              onBack={
                !library && fromWorkouts === '1'
                  ? () => router.replace('/(tabs)/workouts')
                  : undefined
              }
            />
            <CollectionHero
              name={creator.name}
              uri={creator.posterImageUrl ?? workoutThumbnail(videos[0]?.youtubeUrl)}
              count={videos.length}>
              {currentUser?.isAdmin ? (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={`Edit ${creator.name}`}
                  onPress={() =>
                    router.push({ pathname: '/creator/edit', params: { creatorId: creator._id } })
                  }
                  style={{
                    position: 'absolute',
                    right: 16,
                    top: 16,
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor: 'rgba(0,0,0,0.6)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  <PencilSimple size={20} color="#fff" weight="bold" />
                </TouchableOpacity>
              ) : null}
            </CollectionHero>
            {creator.description ? (
              <Text style={[type.supporting, { marginTop: 16 }]}>{creator.description}</Text>
            ) : null}
            <View style={{ height: 22 }} />
          </View>
        }
        ListEmptyComponent={
          <View style={{ alignItems: 'center', padding: 24 }}>
            <Barbell size={34} color="#e8541e" weight="duotone" />
            <Text style={[type.detail, { marginTop: 16 }]}>No workouts yet</Text>
            <Text style={[type.supporting, { textAlign: 'center', marginTop: 8 }]}>
              New videos will appear here when they are ready.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}
