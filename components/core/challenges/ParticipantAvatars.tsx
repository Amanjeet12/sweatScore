import { Image } from 'expo-image';
import { View } from 'react-native';

import { Text } from '~/components/ui/text';

type ParticipantAvatar = {
  userId: string;
  imageUrl?: string | null;
  initial: string;
};

const FALLBACK_COLORS = ['#C56A48', '#B94F29', '#D77A4C', '#A8492D'];

export default function ParticipantAvatars({
  avatars,
  count,
  size = 34,
}: {
  avatars: ParticipantAvatar[];
  count: number;
  size?: number;
}) {
  const visible = avatars.slice(0, 4);
  const remaining = Math.max(0, count - visible.length);

  if (count === 0) {
    return <Text className="font-body text-xs text-[#77716D]">Be the first to join</Text>;
  }

  return (
    <View className="flex-row items-center">
      <View className="flex-row items-center">
        {visible.map((avatar, index) => (
          <View
            key={avatar.userId}
            className="items-center justify-center overflow-hidden rounded-full border-2 border-white"
            style={{
              width: size,
              height: size,
              marginLeft: index === 0 ? 0 : -8,
              backgroundColor: FALLBACK_COLORS[index % FALLBACK_COLORS.length],
              zIndex: visible.length - index,
            }}>
            {avatar.imageUrl ? (
              <Image source={{ uri: avatar.imageUrl }} style={{ width: '100%', height: '100%' }} />
            ) : (
              <Text className="font-heading text-xs font-semibold text-white">
                {avatar.initial}
              </Text>
            )}
          </View>
        ))}

        {remaining > 0 ? (
          <View
            className="items-center justify-center rounded-full bg-[#B94F29]"
            style={{ width: size, height: size, marginLeft: -8 }}>
            <Text className="font-heading text-[10px] font-semibold text-white">+{remaining}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}
