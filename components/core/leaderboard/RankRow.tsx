import { Image } from 'expo-image';
import { TouchableOpacity, View } from 'react-native';

import { Avatar } from '~/components/core/Avatar';
import { Text } from '~/components/ui/text';
import { formatName } from '~/utils/formatter';

export type RankRowProps = {
  name: string;
  avatarUri: string | null;
  displayTotalPoints: number;
  targetPoints: number;
  onPress?: () => void;
};

export default function RankRow({
  name,
  avatarUri,
  displayTotalPoints,
  targetPoints,
  onPress,
}: RankRowProps) {
  const safeTarget = Math.max(1, targetPoints);
  const pct = Math.min(1, displayTotalPoints / safeTarget);
  const pctLabel = Math.round(pct * 100);
  const isComplete = displayTotalPoints >= safeTarget;

  const Wrapper: any = onPress ? TouchableOpacity : View;
  const wrapperProps = onPress ? { onPress, activeOpacity: 0.7 } : {};

  return (
    <Wrapper
      {...wrapperProps}
      className="mt-3 flex-row items-center gap-x-3 bg-white p-3">
      <Avatar uri={avatarUri ?? undefined} size={44} />
      <View className="flex-1">
        <View className="flex-row items-center justify-between">
          <Text className="font-body text-base text-[#1A1A1A]" numberOfLines={1}>
            {formatName(name)}
          </Text>
          <Text className="font-heading text-base font-bold text-[#1A1A1A]">
            {displayTotalPoints}
          </Text>
        </View>
        <View className="mt-2 flex-row items-center gap-x-2">
          <View className="h-2 flex-1 overflow-hidden rounded-full bg-[#EFEAE4]">
            <View className="h-full rounded-full bg-[#F76B1C]" style={{ width: `${pctLabel}%` }} />
          </View>
          {isComplete ? (
            <Image
              source={require('~/assets/icons/500points.png')}
              style={{ width: 22, height: 22 }}
              contentFit="contain"
            />
          ) : (
            <Text className="w-9 text-right font-body text-xs text-[#5A5A5A]">{pctLabel}%</Text>
          )}
        </View>
      </View>
    </Wrapper>
  );
}
