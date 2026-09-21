import { useQuery } from 'convex/react';
import { router, Stack } from 'expo-router';
import * as Updates from 'expo-updates';
import { ArrowLeft, ChartLineUp, Clock, Sparkle } from 'phosphor-react-native';
import { useRef } from 'react';
import { ScrollView, TouchableOpacity, View } from 'react-native';

import { goBackOrReplace } from '~/components/core/BackButton';
import {
  CoachButton as ActionButton,
  CoachCard,
  CoachFocusHero,
  CoachMark,
  CoachSaved,
} from '~/components/core/CoachPresentation';
import SafeAreaView from '~/components/core/SafeAreaView';
import ScreenLoading from '~/components/core/ScreenLoading';
import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';
import { useAuthStore } from '~/store/useAuthStore';

// Temporary test tooling for development and the client-testing preview APK only.
// The server independently restricts resets to the approved development deployment.
const showCoachTestTools =
  __DEV__ ||
  (Updates.channel === 'preview' &&
    process.env.EXPO_PUBLIC_CONVEX_URL === 'https://beloved-stoat-88.convex.cloud');
const DevelopmentCoachTools = showCoachTestTools
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
    (require('~/components/core/DevelopmentCoachTools')
      .default as typeof import('~/components/core/DevelopmentCoachTools').default)
  : null;

export function ErrorBoundary({ retry }: { error: Error; retry: () => Promise<void> }) {
  return (
    <SafeAreaView className="flex-1 bg-[#F9F9F9]">
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}>
        <Text className="text-center font-heading text-xl font-semibold text-[#1A1A1A]">
          Progress Coach could not load
        </Text>
        <Text className="mt-2 text-center font-body text-sm leading-5 text-[#5A5551]">
          Check your connection and try again.
        </Text>
        <View className="mt-6">
          <ActionButton label="Try again" onPress={retry} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export default function ProgressCoachEntry() {
  const scrollRef = useRef<ScrollView>(null);
  const currentUser = useAuthStore((state) => state.currentUser);
  const coachHome = useQuery(api.progressCoach.getCoachHome, currentUser?._id ? {} : 'skip');
  const savedPlan = useQuery(
    api.progressCoach.getTodayPlan,
    currentUser?._id &&
      coachHome?.enabled &&
      (coachHome.state === 'plan_ready' || coachHome.state === 'fallback')
      ? {}
      : 'skip'
  );
  if (currentUser === undefined || coachHome === undefined) return <ScreenLoading />;

  const hasProfile = coachHome?.enabled && coachHome.state !== 'needs_profile';
  const planState = coachHome?.enabled ? coachHome.state : 'disabled';
  const primary =
    planState === 'ready_to_check_in'
      ? { label: 'Start today’s check-in', route: '/progress-coach/check-in' }
      : planState === 'generating'
        ? { label: 'Open today’s focus', route: '/progress-coach/plan' }
        : planState === 'plan_ready' || planState === 'fallback'
          ? { label: 'View today’s focus', route: '/progress-coach/plan' }
          : null;

  return (
    <SafeAreaView className="flex-1 bg-[#F9F9F9]">
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: 20,
          paddingBottom: 32,
          paddingTop: 16,
        }}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Back to Today"
          onPress={() => goBackOrReplace('/(tabs)/dashboard')}
          className="h-12 w-12 items-center justify-center rounded-full bg-white">
          <ArrowLeft size={22} color="#1A1A1A" weight="bold" />
        </TouchableOpacity>
        <View className={hasProfile ? 'flex-1 py-4' : 'flex-1 py-8'}>
          {hasProfile ? (
            <View className="flex-row items-center">
              <View className="mr-3 h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-[#FF5C35]">
                <Sparkle size={25} color="white" weight="fill" />
              </View>
              <View className="min-w-0 flex-1">
                <Text className="font-heading text-xs font-semibold uppercase tracking-widest text-[#FF4B1F]">
                  Your daily direction
                </Text>
                <Text className="mt-1 font-heading text-2xl font-semibold text-[#1A1A1A]">
                  Your daily Coach
                </Text>
              </View>
            </View>
          ) : (
            <>
              <View className="mb-6">
                <CoachMark />
              </View>
              <Text className="font-heading text-xs font-semibold uppercase tracking-widest text-[#FF4B1F]">
                Your daily direction
              </Text>
              <Text className="mt-3 font-heading text-[30px] font-semibold text-[#1A1A1A]">
                {coachHome?.enabled && coachHome.state === 'needs_profile'
                  ? 'Meet your SweatScore AI Coach'
                  : 'Your daily Coach'}
              </Text>
            </>
          )}
          {!coachHome?.enabled ? (
            <View className="mt-5 rounded-[24px] bg-white p-5">
              <Text className="font-body text-base leading-6 text-[#5A5551]">
                Progress Coach is not available for this account yet.
              </Text>
            </View>
          ) : coachHome.state === 'needs_profile' ? (
            <>
              <Text className="mt-4 font-body text-base leading-6 text-[#5A5551]">
                One clear focus, shaped by your readiness, your goals and the recent tracking
                progress SweatScore can verify.
              </Text>
              <View className="my-6 gap-y-3">
                <CoachCard
                  title="Quick daily readiness check"
                  icon={<Clock size={21} color="#FF4B1F" />}>
                  <Text className="font-body text-sm text-[#5A5551]">
                    Five questions about sleep, energy, mood, time and how your body feels.
                  </Text>
                </CoachCard>
                <CoachCard
                  title="Verified SweatScore progress"
                  icon={<ChartLineUp size={21} color="#FF4B1F" />}>
                  <Text className="font-body text-sm text-[#5A5551]">
                    Recent tracked steps and active minutes help put your answers in context.
                  </Text>
                </CoachCard>
                <CoachCard
                  title="One clear daily focus—not a chat"
                  icon={<Sparkle size={21} color="#FF4B1F" />}>
                  <Text className="font-body text-sm text-[#5A5551]">
                    Movement and supporting wellness targets, saved for your day.
                  </Text>
                </CoachCard>
              </View>
              <Text className="mb-5 font-body text-xs text-[#5A5551]">
                General wellness guidance only. Your Coach cannot assess symptoms or replace medical
                advice.
              </Text>
              <View>
                <ActionButton
                  label="Set up my profile"
                  onPress={() => router.push('/progress-coach/profile' as any)}
                />
              </View>
            </>
          ) : coachHome.state === 'failed' ? (
            <>
              <View className="mt-6">
                <CoachCard title="Today’s focus is unavailable" quiet>
                  <Text className="font-body text-sm text-[#5A5551]">
                    We couldn’t prepare today’s guidance. No conflicting focus was created. You can
                    safely return to Today.
                  </Text>
                </CoachCard>
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
              <View className="mt-6">
                {savedPlan?.output ? (
                  <>
                    <CoachFocusHero
                      output={savedPlan.output}
                      recovery={savedPlan.safetyState === 'pain_or_unwell'}
                      summary
                    />
                    {savedPlan.safetyState !== 'pain_or_unwell' &&
                    typeof savedPlan.output.steps.target === 'number' &&
                    Number.isFinite(savedPlan.output.steps.target) &&
                    savedPlan.output.steps.target > 0 ? (
                      <Text className="mt-4 font-body text-sm text-[#5A5551]">
                        Step target · {savedPlan.output.steps.target.toLocaleString()} steps
                      </Text>
                    ) : null}
                    <CoachSaved recovery={savedPlan.safetyState === 'pain_or_unwell'} />
                  </>
                ) : (
                  <CoachCard
                    title={
                      planState === 'ready_to_check_in'
                        ? 'Your profile is ready'
                        : planState === 'generating'
                          ? 'Shaping today’s focus'
                          : 'Your focus is ready'
                    }>
                    <Text className="font-body text-base text-[#5A5551]">
                      {planState === 'ready_to_check_in'
                        ? 'Take a quick five-question readiness check to create one saved focus for today.'
                        : planState === 'generating'
                          ? 'Your readiness and verified progress are coming together. Open your focus to follow along.'
                          : 'Open your saved focus for today. It will stay the same when you return.'}
                    </Text>
                  </CoachCard>
                )}
              </View>
              {primary ? (
                <View className="mt-3">
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
              <ActionButton
                label="Retake profile"
                secondary
                onPress={() =>
                  router.push({
                    pathname: '/progress-coach/profile' as any,
                    params: { mode: 'retake' },
                  })
                }
              />
              <Text className="mt-3 text-center font-body text-xs leading-5 text-[#807A76]">
                Profile changes apply to future plans and will not replace a plan already created
                today.
              </Text>
            </View>
          ) : null}
          {showCoachTestTools && coachHome?.testResetAllowed && DevelopmentCoachTools ? (
            <DevelopmentCoachTools
              onReset={() => scrollRef.current?.scrollTo({ y: 0, animated: false })}
            />
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
