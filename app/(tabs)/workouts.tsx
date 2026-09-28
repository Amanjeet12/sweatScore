import { useQuery } from 'convex/react';
import { router, Stack } from 'expo-router';
import { Platform, ScrollView, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SafeAreaView from '~/components/core/SafeAreaView';
import ScreenLoading from '~/components/core/ScreenLoading';
import CreatorRow from '~/components/core/creators/Row';
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
        contentContainerStyle={{
          padding: 20,
          paddingTop: Platform.OS === 'android' ? insets.top + 20 : 20,
          paddingBottom: 36,
        }}>
        <Text className="font-heading text-[28px] font-semibold text-[#1A1A1A]">Workouts</Text>
        <Text className="mb-5 mt-1 text-sm text-[#77716D]">
          Explore workouts from SweatScore creators.
        </Text>
        {!decision.verifiedAccess ? (
          <View className="rounded-2xl bg-white p-5">
            <Text className="font-heading font-semibold">Premium access unavailable</Text>
            <Text className="mt-2 text-sm text-[#77716D]">
              Your workout library is locked until access is verified again.
            </Text>
          </View>
        ) : creators === undefined ? (
          <ScreenLoading />
        ) : creators.length === 0 ? (
          <Text className="rounded-2xl bg-white p-5 text-[#77716D]">
            No creator workouts are available yet.
          </Text>
        ) : (
          creators.map((creator) => (
            <TouchableOpacity
              key={creator._id}
              accessibilityRole="button"
              accessibilityLabel={`Open ${creator.name} workouts`}
              onPress={() =>
                router.push({
                  pathname: '/(tabs)/dashboard/creators/[creatorId]',
                  params: { creatorId: creator._id },
                })
              }
              className="mb-3 overflow-hidden rounded-2xl bg-white">
              <CreatorRow creator={creator} hideDescription />
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
