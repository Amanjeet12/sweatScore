import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { TouchableOpacity, View } from 'react-native';

import { Text } from '~/components/ui/text';
import { formatName } from '~/utils/formatter';

export type PodiumSlotProps = {
  mode?: 'points' | 'streak';
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

const RANK_COLORS = { 1: '#F1C56F', 2: '#AAA6A3', 3: '#B87333' } as const;
const AVATAR_COLORS = { 1: '#FF5C35', 2: '#B4522E', 3: '#D77845' } as const;

export default function PodiumSlot({
  rank,
  isHero,
  entry,
  onPress,
  mode = 'points',
}: PodiumSlotProps) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [entry?.image]);

  const firstLetter = entry?.name ? entry.name.trim().substring(0, 1).toUpperCase() : '?';

  const avatarSize = isHero ? 68 : 58;
  const ringColor = isHero ? '#FF5C35' : '#FFFFFF';

  const Wrapper: any = entry && onPress ? TouchableOpacity : View;

  const wrapperProps =
    entry && onPress
      ? {
          onPress: () => onPress(entry.userId),
          activeOpacity: 0.7,
        }
      : {};

  return (
    <Wrapper
      {...wrapperProps}
      accessible={!entry}
      accessibilityLabel={!entry ? `Rank ${rank}: up for grabs` : undefined}
      className="items-center"
      style={{ width: isHero ? 116 : 92 }}>
      <View
        className="mb-1 h-6 w-6 items-center justify-center rounded-full"
        style={{ backgroundColor: RANK_COLORS[rank] }}>
        <Text style={{ fontFamily: 'Inter_600SemiBold' }} className="text-[11px] text-white">
          {rank}
        </Text>
      </View>

      <View
        style={{
          width: avatarSize,
          height: avatarSize,
          borderRadius: avatarSize / 2,
          borderWidth: entry ? 0 : 1,
          borderStyle: entry ? 'solid' : 'dashed',
          borderColor: entry ? ringColor : '#D8D2CD',
          backgroundColor: entry ? AVATAR_COLORS[rank] : '#F4F1EE',
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        {entry ? (
          entry.image && !imageFailed ? (
            <Image
              source={{ uri: entry.image }}
              style={{
                width: avatarSize,
                height: avatarSize,
                borderRadius: avatarSize / 2,
              }}
              contentFit="cover"
              onError={() => setImageFailed(true)}
            />
          ) : (
            <Text
              style={{
                fontSize: isHero ? 27 : 20,
                lineHeight: isHero ? 33 : 25,
                color: '#FFFFFF',
                fontFamily: 'Inter_700Bold',
                textAlign: 'center',
              }}>
              {firstLetter}
            </Text>
          )
        ) : (
          <Text style={{ fontFamily: 'Inter_600SemiBold' }} className="text-xl text-[#AAA39D]">
            —
          </Text>
        )}
      </View>

      <Text
        style={{ fontFamily: 'Inter_600SemiBold' }}
        className="mt-2 text-[11px] text-[#1A1A1A]"
        numberOfLines={1}>
        {entry ? formatName(entry.name) : 'Up for grabs'}
      </Text>
      <Text className="mt-0.5 font-body text-[10px] text-[#817A76]">
        {entry
          ? `${entry.displayTotalPoints.toLocaleString()} ${mode === 'streak' ? (entry.displayTotalPoints === 1 ? 'week' : 'weeks') : 'pts'}`
          : '—'}
      </Text>
    </Wrapper>
  );
}
