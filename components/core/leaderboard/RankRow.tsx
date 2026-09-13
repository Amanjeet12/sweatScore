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
  mode?: 'points' | 'streak';
  onPress?: () => void;
  isFirst?: boolean;
  isLast?: boolean;
};

const AVATAR_COLORS = ['#C65D32', '#A94725', '#D77845', '#B4522E'];

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
        width: 36,
        height: 36,
        borderRadius: 18,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: shouldShowImage ? '#F3F4F6' : avatarBg,
      }}>
      {shouldShowImage ? (
        <Image
          source={{ uri: cleanUri }}
          style={{
            width: 36,
            height: 36,
          }}
          contentFit="cover"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <Text style={{ fontFamily: 'Inter_600SemiBold' }} className="text-base text-white">
          {initial}
        </Text>
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
  mode = 'points',
  onPress,
  isFirst = false,
  isLast = false,
}: RankRowProps) {
  const safeTarget = Math.max(1, targetPoints);
  const pct = Math.min(1, displayTotalPoints / safeTarget);
  const pctLabel = Math.round(pct * 100);

  const Wrapper: any = onPress ? TouchableOpacity : View;
  const wrapperProps = onPress ? { onPress, activeOpacity: 0.7 } : {};

  return (
    <Wrapper
      {...wrapperProps}
      className={`mx-5 flex-row items-center gap-x-3 bg-white px-3 py-3 ${isFirst ? 'mt-3 rounded-t-[24px]' : ''} ${isLast ? 'rounded-b-[24px]' : ''}`}
      style={isFirst ? {} : undefined}>
      <RankAvatar name={name} uri={avatarUri} />

      <View className="flex-1">
        <View className="flex-row items-center justify-between gap-x-3">
          <View className="flex-1 flex-row items-center gap-x-2">
            <Text
              style={{ fontFamily: 'Inter_600SemiBold' }}
              className="shrink font-body text-sm text-[#1A1A1A]"
              numberOfLines={1}>
              {formatName(name)}
            </Text>

            {!!rank && (
              <View className="rounded bg-[#FFF0E8] px-1 py-0.5">
                <Text
                  style={{ fontFamily: 'Inter_600SemiBold' }}
                  className="text-xs text-[#F76B1C]">
                  #{rank}
                </Text>
              </View>
            )}
          </View>

          <Text style={{ fontFamily: 'Inter_600SemiBold' }} className="text-base text-[#1A1A1A]">
            {displayTotalPoints}
            {mode === 'streak' ? (displayTotalPoints === 1 ? ' week' : ' weeks') : ''}
          </Text>
        </View>

        {mode === 'points' && (
          <View className="mt-3 flex-row items-center gap-x-2">
            <View className="h-[3px] flex-1 overflow-hidden rounded-full bg-[#EFEAE4]">
              <View
                className="h-full rounded-full bg-[#F76B1C]"
                style={{ width: `${pctLabel}%` }}
              />
            </View>
          </View>
        )}
      </View>
    </Wrapper>
  );
}
