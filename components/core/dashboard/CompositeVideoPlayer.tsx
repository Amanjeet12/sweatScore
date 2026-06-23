import { VideoPlayer, useVideoPlayer, VideoView } from 'expo-video';
import { Play } from 'phosphor-react-native';
import { useState } from 'react';
import { Dimensions, Pressable, View } from 'react-native';

const SCREEN_WIDTH = Dimensions.get('window').width;

interface CompositeVideoPlayerProps {
  leftVideoUrl: string;
  rightVideoUrl: string;
  aspectRatio?: number;
  existingLeftPlayer?: VideoPlayer;
  mirrorRight?: boolean;
}

export default function CompositeVideoPlayer({
  leftVideoUrl,
  rightVideoUrl,
  aspectRatio = 1,
  existingLeftPlayer,
  mirrorRight = false,
}: CompositeVideoPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);

  const ownLeftPlayer = useVideoPlayer(existingLeftPlayer ? null : leftVideoUrl, (p) => {
    p.loop = true;
  });

  const leftPlayer = existingLeftPlayer ?? ownLeftPlayer;

  const rightPlayer = useVideoPlayer(rightVideoUrl, (p) => {
    p.loop = true;
    p.volume = 0;
  });

  const halfWidth = SCREEN_WIDTH / 2;
  const height = SCREEN_WIDTH * aspectRatio;

  const handlePress = () => {
    if (isPlaying) {
      leftPlayer.pause();
      rightPlayer.pause();
      setIsPlaying(false);
    } else {
      leftPlayer.currentTime = 0;
      rightPlayer.currentTime = 0;
      leftPlayer.loop = true;
      leftPlayer.play();
      rightPlayer.play();
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
          player={leftPlayer}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: halfWidth,
            height,
          }}
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
          player={rightPlayer}
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            width: halfWidth,
            height,
            transform: mirrorRight ? [{ scaleX: -1 }] : [],
          }}
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
