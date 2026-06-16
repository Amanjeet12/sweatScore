import { Image } from 'expo-image';
import { router } from 'expo-router';
import { PencilSimple } from 'phosphor-react-native';
import { TouchableOpacity, View } from 'react-native';

import { Text } from '~/components/ui/text';
import { Doc } from '~/convex/_generated/dataModel';
import { useAuthStore } from '~/store/useAuthStore';

export default function CreatorRow({
  creator,
  hideDescription = false,
}: {
  creator: Doc<'creators'> & { posterImageUrl: string | null };
  hideDescription?: boolean;
}) {
  const currentUser = useAuthStore((state) => state.currentUser);

  return (
    <View className="flex-col rounded-lg p-4">
      <View className="rounded-lg" style={{ position: 'relative' }}>
        <Image
          source={{ uri: creator.posterImageUrl }}
          contentFit="cover"
          style={{
            width: '100%',
            height: 'auto',
            aspectRatio: 370 / 200,
            borderRadius: 10,
          }}
        />
        {currentUser?.isAdmin ? (
          <TouchableOpacity
            onPress={() =>
              router.push({
                pathname: '/creator/edit',
                params: { creatorId: creator._id },
              })
            }
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              borderRadius: 20,
              padding: 8,
            }}>
            <PencilSimple size={20} color="white" weight="bold" />
          </TouchableOpacity>
        ) : null}
      </View>
      {currentUser?.isAdmin && !hideDescription ? (
        <>
          <View className="mt-4">
            <Text className="text-lg font-medium text-hint">{creator.description}</Text>
          </View>
        </>
      ) : null}
    </View>
  );
}
