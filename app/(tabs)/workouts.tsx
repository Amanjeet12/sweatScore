import { useQuery } from 'convex/react';
import { Image } from 'expo-image';
import { router, Stack } from 'expo-router';
import { ArrowRight, Barbell, LockKey } from 'phosphor-react-native';
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
    <SafeAreaView className="flex-1 bg-[#F9F9F9]">
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: Platform.OS === 'android' ? insets.top + 20 : 18,
          paddingBottom: insets.bottom + 32,
        }}>
        <View className="mb-5 mt-3 flex-row items-end justify-between">
          <Text style={{ fontFamily: 'Inter_700Bold' }} className="mt-1 text-[28px] text-[#1A1A1A]">
            Workouts
          </Text>
          {creators ? (
            <View className="mb-1 rounded-[20px] bg-[#FFF1E9] px-3 py-2">
              <Text style={{ fontFamily: 'Inter_600SemiBold' }} className="text-xs text-[#FF5C35]">
                {creators.length} {creators.length === 1 ? 'collection' : 'collections'}
              </Text>
            </View>
          ) : null}
        </View>

        <View className="mb-5 rounded-[24px] bg-white px-5 py-5">
          <Text className="font-body text-xs text-[#77716D]">Workout library</Text>
          <Text
            style={{ fontFamily: 'Inter_700Bold' }}
            className="mt-1 text-xl leading-7 text-[#1A1A1A]">
            Move with a coach you enjoy
          </Text>
          <Text className="mt-2 font-body text-sm leading-5 text-[#77716D]">
            Choose a collection and find a workout for your energy today.
          </Text>
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
              className="mb-4 overflow-hidden rounded-[26px] bg-white">
              {creator.posterImageUrl ? (
                <Image
                  source={{ uri: creator.posterImageUrl }}
                  contentFit="cover"
                  transition={180}
                  style={{ width: '100%', height: 190, backgroundColor: '#F1ECE7' }}
                />
              ) : (
                <View className="h-[190px] items-center justify-center bg-[#F1ECE7]">
                  <Barbell size={54} color="#C7BEB8" weight="duotone" />
                </View>
              )}
              <View className="flex-row items-center gap-4 p-5">
                <View className="min-w-0 flex-1">
                  <Text
                    numberOfLines={1}
                    className="font-heading text-[23px] font-semibold leading-8 text-[#1A1A1A]">
                    {creator.name}
                  </Text>
                  {creator.description ? (
                    <Text
                      numberOfLines={2}
                      className="mt-1 font-body text-sm leading-5 text-[#77716D]">
                      {creator.description}
                    </Text>
                  ) : (
                    <Text className="mt-1 font-body text-sm text-[#77716D]">
                      Open the full workout collection
                    </Text>
                  )}
                </View>
                <View className="h-11 w-11 items-center justify-center rounded-full bg-[#FFF1E9]">
                  <ArrowRight size={20} color="#FF5C35" weight="bold" />
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
