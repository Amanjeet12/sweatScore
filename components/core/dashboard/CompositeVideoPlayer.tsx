import {
  VideoPlayer,
  useVideoPlayer,
  VideoView,
} from 'expo-video';
import { Play } from 'phosphor-react-native';
import { useState } from 'react';
import {
  Dimensions,
  Pressable,
  Text,
  View,
} from 'react-native';

const SCREEN_WIDTH = Dimensions.get('window').width;

interface CompositeVideoPlayerProps {
  leftVideoUrl: string;
  rightVideoUrl: string;

  // Examples:
  // Left: "Challenge" or "Day 1"
  // Right: "Day 1", "Day 2", etc.
  leftLabel?: string;
  rightLabel?: string;

  aspectRatio?: number;
  existingLeftPlayer?: VideoPlayer;
  mirrorRight?: boolean;
}

export default function CompositeVideoPlayer({
  leftVideoUrl,
  rightVideoUrl,
  leftLabel,
  rightLabel,
  aspectRatio = 1,
  existingLeftPlayer,
  mirrorRight = false,
}: CompositeVideoPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);

  const ownLeftPlayer = useVideoPlayer(
    existingLeftPlayer ? null : leftVideoUrl,
    (player) => {
      player.loop = true;
      player.volume = 0;
    }
  );

  const leftPlayer = existingLeftPlayer ?? ownLeftPlayer;

  const rightPlayer = useVideoPlayer(
    rightVideoUrl,
    (player) => {
      player.loop = false;
      player.volume = 0;
    }
  );

  const halfWidth = SCREEN_WIDTH / 2;
  const height = SCREEN_WIDTH * aspectRatio;

  const handlePress = () => {
    if (isPlaying) {
      leftPlayer.pause();
      rightPlayer.pause();
      setIsPlaying(false);
      return;
    }

    leftPlayer.currentTime = 0;
    rightPlayer.currentTime = 0;

    // The challenge or Day 1 video can repeat while
    // the current recorded video plays once.
    leftPlayer.loop = true;
    rightPlayer.loop = false;

    leftPlayer.play();
    rightPlayer.play();

    setIsPlaying(true);
  };

  const renderVideoLabel = (label?: string) => {
    if (!label) {
      return null;
    }

    return (
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: 10,
          bottom: 10,
          zIndex: 10,
          borderRadius: 999,
          backgroundColor: 'rgba(0, 0, 0, 0.65)',
          paddingHorizontal: 11,
          paddingVertical: 6,
        }}>
        <Text
          style={{
            color: '#FFFFFF',
            fontSize: 13,
            fontWeight: '700',
          }}>
          {label}
        </Text>
      </View>
    );
  };

  return (
    <View
      style={{
        width: SCREEN_WIDTH,
        height,
        position: 'relative',
        backgroundColor: '#000000',
      }}>
      {/* Left video */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: halfWidth,
          height,
          overflow: 'hidden',
          backgroundColor: '#000000',
        }}>
        <VideoView
          player={leftPlayer}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: halfWidth,
            height,
          }}
          contentFit="cover"
          nativeControls={false}
        />

        {renderVideoLabel(leftLabel)}
      </View>

      {/* Right video */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: halfWidth,
          width: halfWidth,
          height,
          overflow: 'hidden',
          backgroundColor: '#000000',
        }}>
        <VideoView
          player={rightPlayer}
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: halfWidth,
            height,
            transform: mirrorRight
              ? [{ scaleX: -1 }]
              : [],
          }}
          contentFit="cover"
          nativeControls={false}
        />

        {renderVideoLabel(rightLabel)}
      </View>

      {/* Optional centre separator */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: halfWidth - 0.5,
          width: 1,
          zIndex: 15,
          backgroundColor: 'rgba(255, 255, 255, 0.45)',
        }}
      />

      {/* Play/pause touch area */}
      <Pressable
        onPress={handlePress}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 20,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        {!isPlaying && (
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: 'rgba(26, 26, 26, 0.6)',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Play
              size={24}
              color="#FFFFFF"
              weight="fill"
            />
          </View>
        )}
      </Pressable>
    </View>
  );
}