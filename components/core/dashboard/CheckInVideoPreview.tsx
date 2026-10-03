import { useVideoPlayer, VideoView } from 'expo-video';
import { View } from 'react-native';

export function CheckInVideoPreview({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (instance) => {
    instance.loop = false;
  });

  return (
    <View className="w-full overflow-hidden rounded-[24px] bg-black" style={{ aspectRatio: 4 / 5 }}>
      <VideoView
        player={player}
        style={{ width: '100%', height: '100%' }}
        contentFit="contain"
        nativeControls
      />
    </View>
  );
}
