import { useQuery } from 'convex/react';
import { router, Stack } from 'expo-router';
import { Barbell, LockKey } from 'phosphor-react-native';
import { ScrollView, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import ScreenLoading from '~/components/core/ScreenLoading';
import { CollectionHero } from '~/components/core/creators/WorkoutPresentation';
import {
  workoutStyles as styles,
  workoutTypography as type,
} from '~/components/core/design/WorkoutStyles';
import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';
import { Doc } from '~/convex/_generated/dataModel';
import { useCoachRouteGuard } from '~/hooks/useCoachRouteGuard';

function CollectionCard({
  creator,
}: {
  creator: Doc<'creators'> & { posterImageUrl: string | null };
}) {
  const videos = useQuery(api.admin.getCreatorVideos, { creatorId: creator._id });
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={`Open ${creator.name} collection`}
      activeOpacity={0.88}
      onPress={() =>
        router.push({
          pathname: '/(tabs)/workouts/creators/[creatorId]',
          params: { creatorId: creator._id },
        })
      }
      style={{ marginBottom: 14 }}>
      <CollectionHero
        name={creator.name}
        uri={creator.posterImageUrl}
        count={videos?.filter((video) => video.isActive !== false).length}
      />
    </TouchableOpacity>
  );
}

export default function WorkoutsTab() {
  const { accepted, decision } = useCoachRouteGuard(['today']);
  const creators = useQuery(
    api.admin.getCreators,
    accepted && decision?.verifiedAccess ? {} : 'skip'
  );
  if (!accepted || !decision) return <ScreenLoading />;
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Text style={[type.title, { marginTop: 8, marginBottom: 20 }]}>Workouts</Text>
        {!decision.verifiedAccess ? (
          <View
            style={{
              alignItems: 'center',
              padding: 24,
              borderRadius: 16,
              backgroundColor: '#f5f5f5',
            }}>
            <LockKey size={27} color="#e8541e" weight="duotone" />
            <Text style={[type.detail, { marginTop: 16, textAlign: 'center' }]}>
              Your library is waiting
            </Text>
            <Text style={[type.supporting, { marginTop: 8, textAlign: 'center' }]}>
              Verify Premium access to explore every creator and workout.
            </Text>
          </View>
        ) : creators === undefined ? (
          <ScreenLoading />
        ) : creators.length === 0 ? (
          <View
            style={{
              alignItems: 'center',
              padding: 24,
              borderRadius: 16,
              backgroundColor: '#f5f5f5',
            }}>
            <Barbell size={30} color="#e8541e" weight="duotone" />
            <Text style={[type.detail, { marginTop: 16, textAlign: 'center' }]}>
              New workouts are on the way
            </Text>
            <Text style={[type.supporting, { marginTop: 8, textAlign: 'center' }]}>
              Fresh creator collections will appear here when they are ready.
            </Text>
          </View>
        ) : (
          creators.map((creator) => <CollectionCard key={creator._id} creator={creator} />)
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
