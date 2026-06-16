import { Image } from 'expo-image';
import { View } from 'react-native';

import { Text } from '~/components/ui/text';
import { Doc } from '~/convex/_generated/dataModel';

export default function ChallengeRow({
  challenge,
}: {
  challenge: Doc<'challenges'> & { coverImageUrl: string | null };
}) {
  return (
    <View className="flex-row items-center gap-x-4 rounded-lg border border-gray-100 bg-white p-3">
      {challenge.coverImageUrl ? (
        <Image
          source={{ uri: challenge.coverImageUrl }}
          contentFit="cover"
          style={{
            width: 80,
            height: 80,
            borderRadius: 8,
          }}
        />
      ) : (
        <View className="h-20 w-20 items-center justify-center rounded-lg bg-gray-200">
          <Text className="text-xs text-gray-400">No image</Text>
        </View>
      )}
      <View className="flex-1 flex-col gap-y-1">
        <Text className="text-lg font-bold text-[#1A1A1A]" numberOfLines={1}>
          {challenge.name}
        </Text>
        <View className="flex-row items-center gap-x-2">
          <View className="rounded-full bg-primary-100 px-2 py-0.5">
            <Text className="text-xs font-semibold text-primary-600">{challenge.tag}</Text>
          </View>
          <Text className="text-sm text-gray-500">{challenge.points} pts</Text>
        </View>
        <View className="flex-row items-center gap-x-2">
          <View
            className={`h-2 w-2 rounded-full ${challenge.isPublished ? 'bg-green-500' : 'bg-gray-400'}`}
          />
          <Text className="text-xs text-gray-500">
            {challenge.isPublished ? 'Published' : 'Draft'}
          </Text>
          {challenge.isLocked && <Text className="text-xs text-amber-600">🔒 Premium</Text>}
        </View>
      </View>
    </View>
  );
}
