import { useQuery } from 'convex/react';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack } from 'expo-router';
import { ArrowRight, Barbell, LockKey, Sparkle } from 'phosphor-react-native';
import { Platform, ScrollView, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import SafeAreaView from '~/components/core/SafeAreaView';
import ScreenLoading from '~/components/core/ScreenLoading';
import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';
import { useCoachRouteGuard } from '~/hooks/useCoachRouteGuard';

export default function WorkoutsTab() {
  const insets = useSafeAreaInsets();
  const { accepted, decision } = useCoachRouteGuard(['today']);
  const creators = useQuery(
    api.admin.getCreators,
    accepted && decision?.verifiedAccess ? {} : 'skip'
  );
  if (!accepted || !decision) return <ScreenLoading />;
  return (
    <SafeAreaView className="flex-1 bg-white">
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: Platform.OS === 'android' ? insets.top + 20 : 18,
          paddingBottom: insets.bottom + 32,
        }}>
        <View className="mb-5">
          <Text className="font-body text-xs font-semibold uppercase tracking-[2px] text-[#E94E24]">
            WORKOUT LIBRARY
          </Text>
          <Text className="mt-2 font-heading text-[32px] font-semibold leading-[38px] text-[#171615]">
            Find movement that feels like you.
          </Text>
          <Text className="mt-2 max-w-[340px] font-body text-base leading-6 text-[#716B67]">
            Pick a creator, choose your energy, and move at your own pace.
          </Text>
        </View>

        <LinearGradient
          colors={['#FF693D', '#E9431A']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          className="mb-7 overflow-hidden rounded-[26px] px-5 py-5">
          <View className="flex-row items-center gap-4">
            <View className="h-14 w-14 items-center justify-center rounded-2xl bg-white/20">
              <Barbell size={28} color="#FFFFFF" weight="duotone" />
            </View>
            <View className="min-w-0 flex-1">
              <View className="flex-row items-center gap-1.5">
                <Sparkle size={15} color="#FFFFFF" weight="fill" />
                <Text className="font-body text-xs font-semibold uppercase tracking-widest text-white/90">
                  MOVE YOUR WAY
                </Text>
              </View>
              <Text className="mt-1 font-heading text-lg font-semibold leading-6 text-white">
                Joyful workouts, led by coaches who get it.
              </Text>
            </View>
          </View>
        </LinearGradient>

        <View className="mb-4 flex-row items-end justify-between">
          <View>
            <Text className="font-heading text-2xl font-semibold text-[#171615]">
              Choose your coach
            </Text>
            <Text className="mt-1 font-body text-sm text-[#817A75]">
              Explore every workout in their collection.
            </Text>
          </View>
          {creators ? (
            <Text className="font-body text-xs font-semibold text-[#C9532B]">
              {creators.length} {creators.length === 1 ? 'creator' : 'creators'}
            </Text>
          ) : null}
        </View>
        {!decision.verifiedAccess ? (
          <View className="items-center rounded-[24px] border border-[#EEE9E5] bg-[#FAF8F6] px-6 py-9">
            <View className="h-14 w-14 items-center justify-center rounded-2xl bg-[#FFF0E8]">
              <LockKey size={27} color="#E94E24" weight="duotone" />
            </View>
            <Text className="mt-4 text-center font-heading text-xl font-semibold text-[#171615]">
              Your library is waiting
            </Text>
            <Text className="mt-2 text-center font-body text-sm leading-5 text-[#716B67]">
              Verify Premium access to explore every creator and workout.
            </Text>
          </View>
        ) : creators === undefined ? (
          <ScreenLoading />
        ) : creators.length === 0 ? (
          <View className="items-center rounded-[24px] border border-[#EEE9E5] bg-[#FAF8F6] px-6 py-9">
            <Barbell size={30} color="#E94E24" weight="duotone" />
            <Text className="mt-4 text-center font-heading text-xl font-semibold text-[#171615]">
              New workouts are on the way
            </Text>
            <Text className="mt-2 text-center font-body text-sm leading-5 text-[#716B67]">
              Fresh creator collections will appear here when they are ready.
            </Text>
          </View>
        ) : (
          creators.map((creator) => (
            <TouchableOpacity
              key={creator._id}
              accessibilityRole="button"
              accessibilityLabel={`Open ${creator.name} workouts`}
              activeOpacity={0.88}
              onPress={() =>
                router.push({
                  pathname: '/(tabs)/dashboard/creators/[creatorId]',
                  params: { creatorId: creator._id },
                })
              }
              className="relative mb-4 h-[210px] overflow-hidden rounded-[26px] bg-[#211E1C]">
              {creator.posterImageUrl ? (
                <Image
                  source={{ uri: creator.posterImageUrl }}
                  contentFit="cover"
                  transition={180}
                  style={{ position: 'absolute', inset: 0 }}
                />
              ) : (
                <View className="absolute inset-0 items-center justify-center bg-[#2D2926]">
                  <Barbell size={54} color="#665F5A" weight="duotone" />
                </View>
              )}
              <LinearGradient
                colors={['rgba(0,0,0,0.06)', 'rgba(0,0,0,0.82)']}
                locations={[0.25, 1]}
                className="absolute inset-0"
              />
              <View className="absolute inset-x-0 bottom-0 flex-row items-end gap-4 p-5">
                <View className="min-w-0 flex-1">
                  <View className="mb-2 self-start rounded-full bg-white/20 px-3 py-1.5">
                    <Text className="font-body text-[10px] font-semibold uppercase tracking-widest text-white">
                      CREATOR COLLECTION
                    </Text>
                  </View>
                  <Text
                    numberOfLines={1}
                    className="font-heading text-[25px] font-semibold leading-8 text-white">
                    {creator.name}
                  </Text>
                  {creator.description ? (
                    <Text
                      numberOfLines={2}
                      className="mt-1 font-body text-sm leading-5 text-white/80">
                      {creator.description}
                    </Text>
                  ) : (
                    <Text className="mt-1 font-body text-sm text-white/80">
                      Open the full workout collection
                    </Text>
                  )}
                </View>
                <View className="h-11 w-11 items-center justify-center rounded-full bg-white">
                  <ArrowRight size={20} color="#E94E24" weight="bold" />
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
