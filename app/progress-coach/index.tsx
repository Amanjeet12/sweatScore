import { useQuery } from 'convex/react';
import { router, Stack } from 'expo-router';
import { ArrowLeft, Sparkle } from 'phosphor-react-native';
import { ScrollView, TouchableOpacity, View } from 'react-native';

import SafeAreaView from '~/components/core/SafeAreaView';
import ScreenLoading from '~/components/core/ScreenLoading';
import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';
import { useAuthStore } from '~/store/useAuthStore';

function ActionButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      activeOpacity={0.82}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      className="min-h-14 w-full items-center justify-center rounded-[20px] bg-[#FF5C35] px-5 py-3">
      <Text
        allowFontScaling
        maxFontSizeMultiplier={1.4}
        className="text-center font-heading text-base font-semibold text-white">
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export function ErrorBoundary({ retry }: { error: Error; retry: () => Promise<void> }) {
  return (
    <SafeAreaView className="flex-1 bg-[#F9F9F9]">
      <View className="flex-1 justify-center px-6">
        <Text className="text-center font-heading text-xl font-semibold text-[#1A1A1A]">
          Progress Coach could not load
        </Text>
        <Text className="mt-2 text-center font-body text-sm leading-5 text-[#5A5551]">
          Check your connection and try again.
        </Text>
        <View className="mt-6">
          <ActionButton label="Try again" onPress={retry} />
        </View>
      </View>
    </SafeAreaView>
  );
}

export default function ProgressCoachEntry() {
  const currentUser = useAuthStore((state) => state.currentUser);
  const coachHome = useQuery(api.progressCoach.getCoachHome, currentUser?._id ? {} : 'skip');
  if (currentUser === undefined || coachHome === undefined) return <ScreenLoading />;

  const hasProfile = coachHome?.enabled && coachHome.state !== 'needs_profile';
  const planState = coachHome?.enabled ? coachHome.state : 'disabled';
  const primary =
    planState === 'ready_to_check_in'
      ? { label: 'Start today’s check-in', route: '/progress-coach/check-in' }
      : planState === 'generating'
        ? { label: 'Open today’s plan', route: '/progress-coach/plan' }
        : planState === 'plan_ready' || planState === 'fallback'
          ? { label: 'View today’s plan', route: '/progress-coach/plan' }
          : null;

  return (
    <SafeAreaView className="flex-1 bg-[#F9F9F9]">
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: 20,
          paddingBottom: 32,
          paddingTop: 16,
        }}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Back to Today"
          onPress={() => router.back()}
          className="h-12 w-12 items-center justify-center rounded-full bg-white">
          <ArrowLeft size={22} color="#1A1A1A" weight="bold" />
        </TouchableOpacity>
        <View className="flex-1 justify-center py-8">
          <View className="mb-5 h-14 w-14 items-center justify-center rounded-full bg-[#FFF0E8]">
            <Sparkle size={28} color="#FF5C35" weight="fill" />
          </View>
          <Text
            allowFontScaling
            maxFontSizeMultiplier={1.4}
            className="font-heading text-[28px] font-semibold leading-9 text-[#1A1A1A]">
            Progress Coach
          </Text>
          {!coachHome?.enabled ? (
            <View className="mt-5 rounded-[24px] bg-white p-5">
              <Text className="font-body text-base leading-6 text-[#5A5551]">
                Progress Coach is not available for this account yet.
              </Text>
            </View>
          ) : coachHome.state === 'needs_profile' ? (
            <>
              <Text className="mt-4 font-body text-base leading-6 text-[#5A5551]">
                Answer a few short questions so your daily guidance can reflect your goals and
                routine.
              </Text>
              <View className="mt-8">
                <ActionButton
                  label="Plan my routine"
                  onPress={() => router.push('/progress-coach/profile' as any)}
                />
              </View>
            </>
          ) : coachHome.state === 'failed' ? (
            <>
              <View className="mt-5 rounded-[24px] bg-white p-5">
                <Text className="font-heading text-lg font-semibold text-[#1A1A1A]">
                  Today’s plan is unavailable
                </Text>
                <Text className="mt-2 font-body text-sm leading-5 text-[#5A5551]">
                  Your coach could not prepare today’s guidance. You can safely return to Today.
                </Text>
              </View>
              <View className="mt-8">
                <ActionButton
                  label="Return to Today"
                  onPress={() => router.replace('/(tabs)/dashboard' as any)}
                />
              </View>
            </>
          ) : (
            <>
              <View className="mt-5 rounded-[24px] bg-white p-5">
                <Text className="font-heading text-lg font-semibold text-[#1A1A1A]">
                  {planState === 'ready_to_check_in'
                    ? 'Ready for today’s check-in'
                    : planState === 'generating'
                      ? 'Today’s plan is being prepared'
                      : 'Today’s plan is ready'}
                </Text>
                <Text className="mt-2 font-body text-sm leading-5 text-[#5A5551]">
                  A quick five-question check-in helps shape guidance for your day.
                </Text>
              </View>
              {primary ? (
                <View className="mt-8">
                  <ActionButton
                    label={primary.label}
                    onPress={() => router.push(primary.route as any)}
                  />
                </View>
              ) : null}
            </>
          )}
          {hasProfile ? (
            <View className="mt-4">
              <TouchableOpacity
                accessibilityRole="button"
                onPress={() =>
                  router.push({
                    pathname: '/progress-coach/profile' as any,
                    params: { mode: 'retake' },
                  })
                }
                className="min-h-14 items-center justify-center rounded-[20px] border border-[#E3E1DE] bg-white px-5 py-3">
                <Text className="font-heading text-base font-semibold text-[#1A1A1A]">
                  Retake profile
                </Text>
              </TouchableOpacity>
              <Text className="mt-3 text-center font-body text-xs leading-5 text-[#807A76]">
                Profile changes apply to future plans and will not replace a plan already created
                today.
              </Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
