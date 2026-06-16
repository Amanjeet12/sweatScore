import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { memo } from 'react';
import { Platform, TouchableOpacity, View } from 'react-native';

import { Avatar } from '~/components/core/Avatar';
import { useRevenueCat } from '~/components/providers/RevenueCatProvider';
import { Text } from '~/components/ui/text';
import { useAuthStore, UserWithImageUrl } from '~/store/useAuthStore';
import { useTabStore } from '~/store/useTabStore';
import { cn } from '~/utils/cn';
import { formatName, formatPoints } from '~/utils/formatter';

const UserCard = ({
  user,
  rank,
  totalPoints,
  index,
}: {
  user: UserWithImageUrl;
  rank: number;
  totalPoints: number;
  index: number;
}) => {
  const currentUser = useAuthStore((state) => state.currentUser);
  const isCurrentUser = currentUser?._id === user._id;
  const currentTab = useTabStore((state) => state.currentTab);
  const { isPro } = useRevenueCat();

  const cardContent = (
    <View className="flex-row items-center justify-between gap-x-2">
      <View className="w-10 items-center justify-center">
        {rank === 0 ? (
          <Text />
        ) : rank === 1 ? (
          <LinearGradient
            colors={['#FF5C1A', '#FF783C', '#FFA480']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Text
              className={cn('text-center font-bold text-white')}
              numberOfLines={1}
              adjustsFontSizeToFit>
              {rank}
            </Text>
          </LinearGradient>
        ) : (
          <View
            className="items-center justify-center rounded-full bg-[#ECE2DA]"
            style={{
              width: 36,
              height: 36,
            }}>
            <Text
              className={cn('text-center font-bold', {
                'text-base': rank < 100,
                'text-sm': rank >= 100 && rank < 1000,
                'text-xs': rank >= 1000,
              })}
              numberOfLines={1}
              adjustsFontSizeToFit>
              {rank}
            </Text>
          </View>
        )}
      </View>
      <Avatar uri={user.image ?? undefined} size={44} showGoldBorder />
      <View className="ml-1 flex-1 flex-row items-center justify-between gap-x-2">
        <View className="flex-1 flex-row items-center">
          {isCurrentUser ? (
            <View className="rounded-2xl bg-primary-500 px-2 py-1">
              <Text className="text-xl font-bold text-white">Me</Text>
            </View>
          ) : (
            <Text
              className={cn('flex-1 text-xl', {
                'font-bold text-white': rank === 1,
              })}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}>
              {formatName(user.name ?? 'Anonymous')}
            </Text>
          )}
        </View>
        <View className="flex-row items-center gap-x-1">
          {totalPoints >= 500 && (
            <Image
              source={require('~/assets/icons/trophy.png')}
              style={{ width: 25, height: undefined, aspectRatio: 1 }}
              contentFit="contain"
            />
          )}
          <Text
            className={cn('text-xl', {
              'text-white': rank === 1,
            })}>
            {formatPoints(totalPoints)} pts
          </Text>
        </View>
      </View>
    </View>
  );

  return (
    <>
      {rank === 1 ? (
        <TouchableOpacity
          onPress={() => {
            if (!isPro && currentUser?._id !== user._id) {
              router.push({
                pathname: `/(tabs)/${currentTab}/paywall` as any,
                params: { redirectTo: `/(tabs)/${currentTab}/user/${user._id}` },
              });
            } else {
              router.push({
                pathname: `/(tabs)/${currentTab}/user/[userId]` as any,
                params: { userId: user._id },
              });
            }
          }}
          style={{
            borderRadius: 35,
            ...(Platform.OS === 'ios'
              ? {
                  shadowColor: '#000000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.08,
                  shadowRadius: 4,
                }
              : {
                  elevation: 3,
                }),
          }}>
          <LinearGradient
            colors={['#C23E0C', '#FF5C1A', '#FFA480']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              borderRadius: 35,
              paddingHorizontal: 16,
              paddingVertical: 16,
            }}>
            {cardContent}
          </LinearGradient>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          onPress={() => {
            if (!isPro && currentUser?._id !== user._id) {
              router.push({
                pathname: `/(tabs)/${currentTab}/paywall` as any,
                params: { redirectTo: `/(tabs)/${currentTab}/user/${user._id}` },
              });
            } else {
              router.push({
                pathname: `/(tabs)/${currentTab}/user/[userId]` as any,
                params: { userId: user._id },
              });
            }
          }}
          className={cn('rounded-card border border-gray-200 bg-white px-4 py-4', {
            'border border-primary-300 bg-[#FFE6DA]': isCurrentUser,
          })}
          style={{
            ...(Platform.OS === 'ios'
              ? {
                  shadowColor: '#000000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.08,
                  shadowRadius: 4,
                }
              : {
                  elevation: 3,
                }),
          }}>
          {cardContent}
        </TouchableOpacity>
      )}
    </>
  );
};

export default memo(UserCard);
