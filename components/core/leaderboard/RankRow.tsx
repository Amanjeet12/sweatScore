import { Image } from 'expo-image';
import { useMemo, useState } from 'react';
import { TouchableOpacity, View } from 'react-native';

import { Text } from '~/components/ui/text';
import { formatName } from '~/utils/formatter';

export type RankRowProps = {
  rank?: number;
  name: string;
  avatarUri: string | null;
  displayTotalPoints: number;
  targetPoints: number;
  onPress?: () => void;
};

const AVATAR_COLORS = [
  '#F76B1C',
  '#7C3AED',
  '#2563EB',
  '#059669',
  '#DB2777',
  '#DC2626',
  '#0891B2',
  '#9333EA',
];

const getInitial = (name: string) => {
  const trimmedName = name?.trim();

  if (!trimmedName) return 'U';

  return trimmedName.charAt(0).toUpperCase();
};

const getAvatarBgColor = (name: string) => {
  const safeName = name?.trim() || 'User';

  const hash = safeName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);

  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
};

function RankAvatar({ name, uri }: { name: string; uri?: string | null }) {
  const [imageFailed, setImageFailed] = useState(false);

  const cleanUri = uri?.trim();
  const shouldShowImage = !!cleanUri && !imageFailed;

  const initial = useMemo(() => getInitial(name), [name]);
  const avatarBg = useMemo(() => getAvatarBgColor(name), [name]);

  return (
    <View
      style={{
        width: 44,
        height: 44,
        borderRadius: 22,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: shouldShowImage ? '#F3F4F6' : avatarBg,
      }}>
      {shouldShowImage ? (
        <Image
          source={{ uri: cleanUri }}
          style={{
            width: 44,
            height: 44,
          }}
          contentFit="cover"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <Text className="font-heading text-base font-extrabold text-white">{initial}</Text>
      )}
    </View>
  );
}

export default function RankRow({
  rank,
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
    <Wrapper {...wrapperProps} className="mt-3 flex-row items-center gap-x-3 bg-white p-3">
      <RankAvatar name={name} uri={avatarUri} />

      <View className="flex-1">
        <View className="flex-row items-center justify-between gap-x-3">
          <View className="flex-1 flex-row items-center gap-x-2">
            <Text className="shrink font-body text-base text-[#1A1A1A]" numberOfLines={1}>
              {formatName(name)}
            </Text>

            {!!rank && (
              <View className="rounded-full bg-[#FFF0E8] px-2 py-0.5">
                <Text className="font-heading text-xs font-bold text-[#F76B1C]">#{rank}</Text>
              </View>
            )}
          </View>

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