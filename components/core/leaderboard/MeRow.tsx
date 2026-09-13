import { Image } from 'expo-image';
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
        width: 36,
        height: 36,
        borderRadius: 18,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: shouldShowImage ? '#F4D9C2' : '#F76B1C',
        borderWidth: 0,
        borderColor: '#FFFFFF',
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
  const pctLabel = Math.round(pct * 100);

  const Wrapper: any = onPress ? TouchableOpacity : View;
  const wrapperProps = onPress ? { onPress, activeOpacity: 0.7 } : {};

  return (
    <Wrapper
      {...wrapperProps}
      className="mx-5 mt-3 flex-row items-center gap-x-3 rounded-[24px] bg-[#FFF0E8]"
      style={{
        paddingHorizontal: 14,
        paddingVertical: 12,
        minHeight: 64,
      }}>
      <MeAvatar avatarUri={avatarUri} userName={userName} />

      <View className="flex-1">
        <View className="flex-row items-center justify-between">
          <View className="flex-1 flex-row items-center gap-x-1">
            <Text
              style={{ fontFamily: 'Inter_600SemiBold' }}
              className="font-body text-base text-[#1A1A1A]">
              You
            </Text>

            {rank || mode === 'points' ? (
              <View className="rounded bg-transparent px-0.5 py-0.5">
                <Text
                  style={{ fontFamily: 'Inter_600SemiBold' }}
                  className="text-xs text-[#F76B1C]">
                  {rank ? `#${rank}` : 'Not ranked'}
                </Text>
              </View>
            ) : null}
          </View>

          <Text style={{ fontFamily: 'Inter_600SemiBold' }} className="text-base text-[#1A1A1A]">
            {displayTotalPoints}
            {mode === 'streak' ? (displayTotalPoints === 1 ? ' week' : ' weeks') : ''}
          </Text>
        </View>

        {mode === 'points' && (
          <View className="mt-1.5 flex-row items-center gap-x-1">
            <View className="h-[3px] flex-1 overflow-hidden rounded-full bg-[#F4D9C2]">
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
