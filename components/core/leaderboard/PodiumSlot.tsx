import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { TouchableOpacity, View } from 'react-native';

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

const RANK_LABEL = {
  1: '1st',
  2: '2nd',
  3: '3rd',
} as const;

export default function PodiumSlot({ rank, isHero, entry, onPress }: PodiumSlotProps) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [entry?.image]);

  const firstLetter = entry?.name ? entry.name.trim().substring(0, 1).toUpperCase() : '?';

  const avatarSize = isHero ? 96 : 80;
  const medalSize = isHero ? 36 : 28;
  const ringColor = isHero ? '#F76B1C' : '#E8DCD0';

  const Wrapper: any = entry && onPress ? TouchableOpacity : View;

  const wrapperProps =
    entry && onPress
      ? {
          onPress: () => onPress(entry.userId),
          activeOpacity: 0.7,
        }
      : {};

  return (
    <Wrapper {...wrapperProps} className="items-center" style={{ width: isHero ? 130 : 100 }}>
      <Image
        source={MEDAL_SRC[rank]}
        style={{
          width: medalSize,
          height: medalSize,
        }}
        contentFit="contain"
      />

      {/* Rank text */}
      <Text
        className="mt-1 text-xs font-bold text-[#6B6B6B]"
        style={{ fontFamily: 'Inter_700Bold' }}>
        {RANK_LABEL[rank]}
      </Text>

      {entry ? (
        <View
          className="rounded-full bg-[#F9F9F9] px-3 py-1"
          style={{
            marginTop: 4,
            marginBottom: -14,
            zIndex: 3,
            shadowColor: '#000',
            shadowOpacity: 0.08,
            shadowRadius: 4,
            shadowOffset: {
              width: 0,
              height: 2,
            },
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
          backgroundColor: '#F76B1C',
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        {entry ? (
          entry.image && !imageFailed ? (
            <Image
              source={{ uri: entry.image }}
              style={{
                width: avatarSize - 6,
                height: avatarSize - 6,
                borderRadius: (avatarSize - 6) / 2,
              }}
              contentFit="cover"
              onError={() => setImageFailed(true)}
            />
          ) : (
            <Text
              style={{
                fontSize: isHero ? 34 : 28,
                lineHeight: isHero ? 40 : 34,
                color: '#FFFFFF',
                fontFamily: 'Inter_700Bold',
                textAlign: 'center',
              }}>
              {firstLetter}
            </Text>
          )
        ) : null}
      </View>

      <Text className="mt-3 font-body text-base font-medium text-[#1A1A1A]" numberOfLines={1}>
        {entry?.name ? formatName(entry.name) : '-'}
      </Text>
    </Wrapper>
  );
}
