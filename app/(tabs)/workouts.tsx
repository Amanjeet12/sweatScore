import { useQuery } from 'convex/react';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack } from 'expo-router';
import { Barbell, LockKey } from 'phosphor-react-native';
import { Platform, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import SafeAreaView from '~/components/core/SafeAreaView';
import ScreenLoading from '~/components/core/ScreenLoading';
import TabPageHeader from '~/components/core/TabPageHeader';
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
          paddingTop: Platform.OS === 'android' ? insets.top : 0,
          paddingBottom: insets.bottom + 32,
        }}>
        <View className="mb-5">
          <TabPageHeader
            title="Workouts"
            action={
              creators ? (
                <View className="rounded-[20px] bg-[#FFF1E9] px-3 py-2">
                  <Text
                    style={{ fontFamily: 'Inter_600SemiBold' }}
                    className="text-xs text-[#FF5C35]">
                    {creators.length} {creators.length === 1 ? 'collection' : 'collections'}
                  </Text>
                </View>
              ) : null
            }
          />
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
              className="relative mb-4 justify-end overflow-hidden rounded-[24px] bg-[#77716D]"
              style={{ width: '100%', aspectRatio: 1.6 }}>
              {creator.posterImageUrl ? (
                <Image
                  source={{ uri: creator.posterImageUrl }}
                  contentFit="cover"
                  transition={180}
                  style={StyleSheet.absoluteFillObject}
                />
              ) : (
                <View style={StyleSheet.absoluteFillObject} className="items-center justify-center">
                  <Barbell size={54} color="#C7BEB8" weight="duotone" />
                </View>
              )}
              <LinearGradient
                pointerEvents="none"
                colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.12)', 'rgba(0,0,0,0.7)']}
                locations={[0, 0.4, 1]}
                style={StyleSheet.absoluteFillObject}
              />
              <View className="p-5">
                <Text numberOfLines={2} className="font-heading text-xl font-semibold text-white">
                  {creator.name}
                </Text>
                <Text
                  numberOfLines={2}
                  className="mt-1.5 font-body text-sm leading-5 text-white/90">
                  {creator.description || 'Open the full workout collection'}
                </Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
