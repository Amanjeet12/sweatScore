import { useQuery } from 'convex/react';
import { router, Stack } from 'expo-router';
import { ArrowLeft, Sparkle } from 'phosphor-react-native';
import { TouchableOpacity, View } from 'react-native';

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

  if (currentUser === undefined || coachHome === undefined) {
    return <ScreenLoading />;
  }

  return (
    <SafeAreaView className="flex-1 bg-[#F9F9F9]">
      <Stack.Screen options={{ headerShown: false }} />
      <View className="flex-1 px-5 pb-8 pt-4">
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Back to Today"
          onPress={() => router.back()}
          className="h-12 w-12 items-center justify-center rounded-full bg-white">
          <ArrowLeft size={22} color="#1A1A1A" weight="bold" />
        </TouchableOpacity>

        <View className="flex-1 justify-center">
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
              <Text
                allowFontScaling
                maxFontSizeMultiplier={1.4}
                className="font-body text-base leading-6 text-[#5A5551]">
                Progress Coach is not available for this account yet.
              </Text>
            </View>
          ) : coachHome.state === 'needs_profile' ? (
            <>
              <Text
                allowFontScaling
                maxFontSizeMultiplier={1.4}
                className="mt-4 font-body text-base leading-6 text-[#5A5551]">
                Answer a few short questions so your daily guidance can reflect your goals and
                routine. You can retake this profile whenever you choose.
              </Text>
              <View className="mt-8">
                <ActionButton
                  label="Plan my routine"
                  onPress={() => router.push('/progress-coach/profile' as any)}
                />
              </View>
            </>
          ) : (
            <>
              <View className="mt-5 rounded-[24px] bg-white p-5">
                <Text
                  allowFontScaling
                  maxFontSizeMultiplier={1.4}
                  className="font-heading text-lg font-semibold text-[#1A1A1A]">
                  Your profile is ready
                </Text>
                <Text
                  allowFontScaling
                  maxFontSizeMultiplier={1.4}
                  className="mt-2 font-body text-sm leading-5 text-[#5A5551]">
                  The daily check-in will be added in the next implementation step. No plan has been
                  submitted.
                </Text>
              </View>
              <View className="mt-8">
                <ActionButton
                  label="Retake profile"
                  onPress={() =>
                    router.push({
                      pathname: '/progress-coach/profile' as any,
                      params: { mode: 'retake' },
                    })
                  }
                />
              </View>
            </>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}
