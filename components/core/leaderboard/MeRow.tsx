import { Image } from 'expo-image';
import { Fire } from 'phosphor-react-native';
import { useMemo, useState } from 'react';
import { TouchableOpacity, View } from 'react-native';

import { Text } from '~/components/ui/text';

type MeRowProps = {
  rank?: number;
  avatarUri?: string;
  displayTotalPoints: number;
  targetPoints: number;
  mode?: 'points' | 'streak';
  userName: string;
  onPress?: () => void;
};

const getInitial = (name?: string) => {
  const safeName = name?.trim();

  if (!safeName) return 'U';

  return safeName.charAt(0).toUpperCase();
};

function MeAvatar({ avatarUri, userName }: { avatarUri?: string; userName: string }) {
  const [imageFailed, setImageFailed] = useState(false);

  const cleanUri = avatarUri?.trim();
  const shouldShowImage = !!cleanUri && !imageFailed;

  const initial = useMemo(() => getInitial(userName), [userName]);

  return (
    <View
      style={{
        width: 44,
        height: 44,
        borderRadius: 22,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: shouldShowImage ? '#F4D9C2' : '#F76B1C',
        borderWidth: 2,
        borderColor: '#FF5C35',
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

export default function MeRow({
  rank,
  avatarUri,
  displayTotalPoints,
  targetPoints,
  mode = 'points',
  userName,
  onPress,
}: MeRowProps) {
  const safeTarget = Math.max(1, targetPoints);
  const pct = Math.min(1, displayTotalPoints / safeTarget);
  const pctLabel = pct * 100;

  const Wrapper: any = onPress ? TouchableOpacity : View;
  const wrapperProps = onPress ? { onPress, activeOpacity: 0.7 } : {};

  return (
    <Wrapper
      {...wrapperProps}
      className="mx-5 mb-3 mt-1 flex-row items-center gap-x-3 rounded-[18px] bg-white px-4 py-4"
      style={{
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.09,
        shadowRadius: 10,
        elevation: 3,
      }}>
      <Text className="w-4 text-center font-body text-sm text-[#888888]">{rank ?? '—'}</Text>
      <MeAvatar avatarUri={avatarUri} userName={userName} />
      <View className="min-w-0 flex-1">
        <Text numberOfLines={1} className="font-heading text-base font-semibold text-[#1A1A1A]">
          You
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
        <Text className="font-heading text-base font-semibold text-[#FF5C35]">
          {displayTotalPoints}
        </Text>
      )}
    </Wrapper>
  );
}
