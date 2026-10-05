import { useQuery } from 'convex/react';
import { Stack, useLocalSearchParams } from 'expo-router';
import { ArrowSquareOut, Play } from 'phosphor-react-native';
import { useState } from 'react';
import { Linking, ScrollView, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LinkPreview } from '~/components/core/LinkPreview';
import ScreenLoading from '~/components/core/ScreenLoading';
import StartWorkoutPopup from '~/components/core/creators/StartWorkoutPopup';
import { WorkoutHeader, WorkoutImage } from '~/components/core/creators/WorkoutPresentation';
import {
  workoutStyles as styles,
  workoutTypography as type,
} from '~/components/core/design/WorkoutStyles';
import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';
import { Id } from '~/convex/_generated/dataModel';
import { getData } from '~/utils/storage';

export default function TabDashboardCreatorVideo() {
  const [showStartWorkoutPopup, setShowStartWorkoutPopup] = useState(false);
  const { videoId } = useLocalSearchParams();
  const { width, fontScale } = useWindowDimensions();
  const video = useQuery(api.admin.getCreatorVideo, {
    creatorVideoId: videoId as Id<'creatorVideos'>,
  });
  const openVideo = () => {
    if (getData('skipWorkoutPopup')) Linking.openURL(video?.youtubeUrl || '');
    else setShowStartWorkoutPopup(true);
  };
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
      <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={styles.screen}>
        <Stack.Screen options={{ headerShown: false }} />
        {!video ? (
          <ScreenLoading />
        ) : (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={[styles.content, { flexGrow: 1 }]}
            showsVerticalScrollIndicator={false}>
            <WorkoutHeader
              title="Workout Video"
              backLabel="Back to workout collection"
              fallback="/(tabs)/workouts"
            />
            <View
              style={[
                styles.thumbnail,
                { height: 195, borderRadius: 16, backgroundColor: '#d9c7bf' },
              ]}>
              <LinkPreview
                text={video.youtubeUrl || ''}
                showCloseButton={false}
                onlyImage
                openLink={false}
                containerStyle={{
                  padding: 0,
                  backgroundColor: '#d9c7bf',
                  width: '100%',
                  height: 195,
                  borderRadius: 16,
                }}
                renderImage={(image) => (
                  <View style={{ width: '100%', height: 195 }}>
                    <WorkoutImage uri={image.url} />
                  </View>
                )}
              />
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Play workout on YouTube"
                activeOpacity={0.88}
                onPress={openVideo}
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  width: 56,
                  height: 56,
                  marginLeft: -28,
                  marginTop: -28,
                  borderRadius: 28,
                  backgroundColor: 'rgba(0,0,0,0.5)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Play size={22} color="#fff" weight="fill" style={{ marginLeft: 3 }} />
              </TouchableOpacity>
            </View>
            <View style={{ marginTop: 22 }}>
              <Text style={type.detail}>{video.subtitle || video.title}</Text>
              {video.description ? (
                <Text style={[type.body, { marginTop: 14 }]}>{video.description}</Text>
              ) : null}
              <View
                style={[
                  styles.metadata,
                  (width < 350 || fontScale > 1.3) && { flexDirection: 'column' },
                ]}>
                {video.difficulty ? (
                  <View
                    style={[
                      styles.tile,
                      (width < 350 || fontScale > 1.3) && { flexBasis: 'auto', width: '100%' },
                    ]}>
                    <Text style={type.caption}>Difficulty</Text>
                    <Text style={[type.value, { textTransform: 'capitalize' }]}>
                      {video.difficulty}
                    </Text>
                  </View>
                ) : null}
                {video.equipment ? (
                  <View
                    style={[
                      styles.tile,
                      (width < 350 || fontScale > 1.3) && { flexBasis: 'auto', width: '100%' },
                    ]}>
                    <Text style={type.caption}>Equipment</Text>
                    <Text style={type.value}>{video.equipment}</Text>
                  </View>
                ) : null}
              </View>
            </View>
            <View style={{ flexGrow: 1, minHeight: 24 }} />
            <TouchableOpacity
              accessibilityRole="link"
              accessibilityLabel={`Watch ${video.subtitle || video.title} on YouTube`}
              activeOpacity={0.88}
              onPress={openVideo}
              style={styles.button}>
              <Text style={[type.button, { flexShrink: 1 }]}>Watch on YouTube</Text>
              <ArrowSquareOut size={20} color="#fff" />
            </TouchableOpacity>
          </ScrollView>
        )}
      </SafeAreaView>
    </>
  );
}
