import { Image } from 'expo-image';
import { useMemo, useState } from 'react';
import { TouchableOpacity, View } from 'react-native';

import { Text } from '~/components/ui/text';

type MeRowProps = {
  rank?: number;
  avatarUri?: string;
  displayTotalPoints: number;
  targetPoints: number;
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
        borderWidth: shouldShowImage ? 0 : 2,
        borderColor: '#FFFFFF',
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

export default function MeRow({
  rank,
  avatarUri,
  displayTotalPoints,
  targetPoints,
  userName,
  onPress,
}: MeRowProps) {
  const safeTarget = Math.max(1, targetPoints);
  const pct = Math.min(1, displayTotalPoints / safeTarget);
  const pctLabel = Math.round(pct * 100);
  const isComplete = displayTotalPoints >= safeTarget;

  const Wrapper: any = onPress ? TouchableOpacity : View;
  const wrapperProps = onPress ? { onPress, activeOpacity: 0.7 } : {};

  return (
    <Wrapper
      {...wrapperProps}
      className="flex-row items-center gap-x-3 bg-[#FFF1E6]"
      style={{ paddingHorizontal: 12, paddingVertical: 18, minHeight: 80 }}>
      <MeAvatar avatarUri={avatarUri} userName={userName} />

      <View className="flex-1">
        <View className="flex-row items-center justify-between">
          <View className="flex-1 flex-row items-center gap-x-2">
            <Text className="font-body text-base font-semibold text-[#1A1A1A]">You</Text>

            {!!rank && (
              <View className="rounded-full bg-white px-2 py-0.5">
                <Text className="font-heading text-xs font-bold text-[#F76B1C]">#{rank}</Text>
              </View>
            )}
          </View>

          <Text className="font-heading text-base font-bold text-[#1A1A1A]">
            {displayTotalPoints}
          </Text>
        </View>

        <View className="mt-2 flex-row items-center gap-x-2">
          <View className="h-2 flex-1 overflow-hidden rounded-full bg-[#F4D9C2]">
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