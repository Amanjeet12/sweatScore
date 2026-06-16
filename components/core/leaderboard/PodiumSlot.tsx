import { Image } from 'expo-image';
import { TouchableOpacity, View } from 'react-native';

import { Avatar } from '~/components/core/Avatar';
import { Text } from '~/components/ui/text';
import { formatName } from '~/utils/formatter';

export type PodiumSlotProps = {
  rank: 1 | 2 | 3;
  isHero?: boolean;
  entry: {
    userId: string;
    name: string;
    image: string | null;
    displayTotalPoints: number;
  } | null;
  onPress?: (userId: string) => void;
};

const MEDAL_SRC = {
  1: require('~/assets/icons/Gold cup.png'),
  2: require('~/assets/icons/Silver medal.png'),
  3: require('~/assets/icons/Bronze medal.png'),
} as const;

export default function PodiumSlot({ rank, isHero, entry, onPress }: PodiumSlotProps) {
  const avatarSize = isHero ? 96 : 80;
  const medalSize = isHero ? 36 : 28;
  const ringColor = isHero ? '#F76B1C' : '#E8DCD0';

  const Wrapper: any = entry && onPress ? TouchableOpacity : View;
  const wrapperProps =
    entry && onPress ? { onPress: () => onPress(entry.userId), activeOpacity: 0.7 } : {};

  return (
    <Wrapper
      {...wrapperProps}
      className="items-center"
      style={{ width: isHero ? 130 : 100 }}>
      <Image
        source={MEDAL_SRC[rank]}
        style={{ width: medalSize, height: medalSize, marginBottom: 4, zIndex: 2 }}
        contentFit="contain"
      />
      {entry ? (
        <View
          className="rounded-full bg-[#F9F9F9] px-3 py-1"
          style={{
            marginBottom: -14,
            zIndex: 3,
            shadowColor: '#000',
            shadowOpacity: 0.08,
            shadowRadius: 4,
            shadowOffset: { width: 0, height: 2 },
            elevation: 3,
          }}>
          <Text className="text-sm text-[#1A1A1A]" style={{ fontFamily: 'Inter_700Bold' }}>
            {entry.displayTotalPoints}
          </Text>
        </View>
      ) : null}
      <View
        style={{
          width: avatarSize,
          height: avatarSize,
          borderRadius: avatarSize / 2,
          borderWidth: 3,
          borderColor: ringColor,
          backgroundColor: '#EEE',
          overflow: 'hidden',
        }}>
        {entry ? <Avatar uri={entry.image ?? undefined} size={avatarSize - 6} /> : null}
      </View>
      <Text className="mt-3 font-body text-base font-medium text-[#1A1A1A]" numberOfLines={1}>
        {entry?.name ? formatName(entry.name) : '-'}
      </Text>
    </Wrapper>
  );
}
