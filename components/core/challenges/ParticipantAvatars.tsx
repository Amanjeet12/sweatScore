import { Image } from 'expo-image';
import { useWindowDimensions, View } from 'react-native';

import { prototypeTypography as type } from '~/components/core/design/prototypeStyles';
import { Text } from '~/components/ui/text';

type ParticipantAvatar = {
  userId: string;
  imageUrl?: string | null;
  initial: string;
};

const FALLBACK_COLORS = ['#D4774A', '#B5502F', '#D4774A', '#9C4128'];

export default function ParticipantAvatars({
  avatars,
  count,
  size = 34,
}: {
  avatars: ParticipantAvatar[];
  count: number;
  size?: number;
}) {
  const { fontScale } = useWindowDimensions();
  size = Math.max(size, 12 * fontScale + 12);
  const visible = avatars.slice(0, 4);
  const remaining = Math.max(0, count - visible.length);

  if (count === 0) {
    return <Text style={type.caption}>Be the first to join</Text>;
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
              marginLeft: index === 0 ? 0 : -10,
              backgroundColor: FALLBACK_COLORS[index % FALLBACK_COLORS.length],
              zIndex: visible.length - index,
            }}>
            {avatar.imageUrl ? (
              <Image source={{ uri: avatar.imageUrl }} style={{ width: '100%', height: '100%' }} />
            ) : (
              <Text style={[type.badge, { color: '#fff' }]}>{avatar.initial}</Text>
            )}
          </View>
        ))}

        {remaining > 0 ? (
          <View
            className="items-center justify-center rounded-full bg-[#B5502F]"
            style={{ minWidth: size, minHeight: size, paddingHorizontal: 6, marginLeft: -10 }}>
            <Text style={[type.badge, { color: '#fff' }]}>+{remaining}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}
