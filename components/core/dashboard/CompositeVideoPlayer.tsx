import { VideoPlayer, useVideoPlayer, VideoView } from 'expo-video';
import { Play } from 'phosphor-react-native';
import { useState } from 'react';
import { Dimensions, Pressable, View } from 'react-native';

const SCREEN_WIDTH = Dimensions.get('window').width;

interface CompositeVideoPlayerProps {
  adminVideoUrl: string;
  userVideoUrl: string;
  aspectRatio?: number;
  existingAdminPlayer?: VideoPlayer;
  mirrorUser?: boolean;
}

export default function CompositeVideoPlayer({
  adminVideoUrl,
  userVideoUrl,
  aspectRatio = 1,
  existingAdminPlayer,
  mirrorUser = false,
}: CompositeVideoPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);

  const ownAdminPlayer = useVideoPlayer(existingAdminPlayer ? null : adminVideoUrl, (p) => {
    p.loop = true;
  });
  const adminPlayer = existingAdminPlayer ?? ownAdminPlayer;

  const userPlayer = useVideoPlayer(userVideoUrl, (p) => {
    p.loop = true;
    p.volume = 0;
  });

  const halfWidth = SCREEN_WIDTH / 2;
  const height = SCREEN_WIDTH * aspectRatio;

  const handlePress = () => {
    if (isPlaying) {
      adminPlayer.pause();
      userPlayer.pause();
      setIsPlaying(false);
    } else {
      adminPlayer.currentTime = 0;
      userPlayer.currentTime = 0;
      adminPlayer.loop = true;
      adminPlayer.play();
      userPlayer.play();
      setIsPlaying(true);
    }
  };

  return (
    <View style={{ width: SCREEN_WIDTH, height, position: 'relative' }}>
      {/* Admin side — left half */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: halfWidth,
          height,
          overflow: 'hidden',
        }}>
        <VideoView
          player={adminPlayer}
          style={{ width: halfWidth, height }}
          contentFit="cover"
          nativeControls={false}
        />
      </View>

      {/* User side — right half, flipped to un-mirror front camera recording */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: halfWidth,
          width: halfWidth,
          height,
          overflow: 'hidden',
        }}>
        <VideoView
          player={userPlayer}
          style={{ width: halfWidth, height, ...(mirrorUser ? { transform: [{ scaleX: -1 }] } : {}) }}
          contentFit="cover"
          nativeControls={false}
        />
      </View>

      {/* Tap overlay */}
      <Pressable
        onPress={handlePress}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        {!isPlaying && (
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: 'rgba(26, 26, 26, 0.5)',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Play size={24} color="#FFFFFF" weight="fill" />
          </View>
        )}
      </Pressable>
    </View>
  );
}
