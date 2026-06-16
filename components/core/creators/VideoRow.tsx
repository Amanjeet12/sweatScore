import { router } from 'expo-router';
import { View } from 'react-native';

import { LinkPreview } from '../LinkPreview';

import { Text } from '~/components/ui/text';
import { Doc } from '~/convex/_generated/dataModel';
import { useAuthStore } from '~/store/useAuthStore';

export default function CreatorVideoRow({
  creatorVideo,
  onPress,
}: {
  creatorVideo: Doc<'creatorVideos'>;
  onPress?: () => void;
}) {
  const currentUser = useAuthStore((state) => state.currentUser);

  const handleOnPress = () => {
    if (onPress) {
      onPress();
    } else {
      if (currentUser?.isAdmin) {
        router.push({
          pathname: '/creator-video/edit',
          params: { creatorVideoId: creatorVideo._id },
        });
      }
    }
  };

  return (
    <View className="flex-col gap-y-4 rounded-lg px-4">
      <View className="flex-row items-center justify-between">
        <Text className="text-xl font-semibold text-black">{creatorVideo.title}</Text>
      </View>
      <View className="flex-row gap-x-4 rounded-lg">
        <View className="w-1/2">
          <LinkPreview
            text={creatorVideo.youtubeUrl || ''}
            showCloseButton={false}
            onlyImage
            openLink={false}
            containerStyle={{
              padding: 0,
              backgroundColor: '#F9F9F9',
              borderRadius: 10,
              width: '100%',
            }}
            onPress={handleOnPress}
          />
        </View>
        <View className="w-1/2 pr-2">
          <Text className="text-lg font-semibold text-hint">{creatorVideo.subtitle}</Text>
        </View>
      </View>
    </View>
  );
}
