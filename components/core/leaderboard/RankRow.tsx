import { Image } from 'expo-image';
import { Fire } from 'phosphor-react-native';
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
}: RankRowProps) {
  const safeTarget = Math.max(1, targetPoints);
  const pct = Math.min(1, displayTotalPoints / safeTarget);
  const pctLabel = pct * 100;

  const Wrapper: any = onPress ? TouchableOpacity : View;
  const wrapperProps = onPress ? { onPress, activeOpacity: 0.7 } : {};

  return (
    <Wrapper
      {...wrapperProps}
      className={`mx-5 flex-row items-center gap-x-3 ${mode === 'streak' ? 'py-4' : 'py-3'} ${isFirst ? 'mt-1' : ''}`}>
      <Text className="w-4 text-center font-body text-sm text-[#888888]">{rank ?? '—'}</Text>
      <RankAvatar name={name} uri={avatarUri} />
      <View className="min-w-0 flex-1">
        <Text numberOfLines={1} className="font-heading text-base font-semibold text-[#1A1A1A]">
          {formatName(name)}
        </Text>
        {mode === 'points' ? (
          <View className="mt-2 h-1 overflow-hidden rounded-full bg-[#EFEFEF]">
            <View
              className="h-full rounded-full bg-[#FF5C35]"
              style={{ width: `${pctLabel}%`, minWidth: displayTotalPoints > 0 ? 2 : 0 }}
            />
          </View>
        ) : null}
      </View>
      {mode === 'streak' ? (
        <View className="flex-row items-center gap-x-1.5">
          <Fire size={16} weight="fill" color={displayTotalPoints > 0 ? '#FF5C35' : '#C4C4C4'} />
          <Text className="font-heading text-base font-semibold text-[#1A1A1A]">
            {displayTotalPoints}
          </Text>
          <Text className="font-body text-sm text-[#777777]">
            {displayTotalPoints === 1 ? 'week' : 'weeks'}
          </Text>
        </View>
      ) : (
        <Text className="font-heading text-base font-semibold text-[#1A1A1A]">
          {displayTotalPoints}
        </Text>
      )}
    </Wrapper>
  );
}
