import { useConvex, useMutation, useQuery } from 'convex/react';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import {
  ArrowRight,
  Barbell,
  CaretDown,
  CaretUp,
  Check,
  Footprints,
  ForkKnife,
  House,
  MoonStars,
  Sparkle,
  UserCircle,
} from 'phosphor-react-native';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, TouchableOpacity, View } from 'react-native';

import CoachActionButton from '~/components/core/CoachActionButton';
import SafeAreaView from '~/components/core/CoachSafeAreaView';
import ScreenLoading from '~/components/core/ScreenLoading';
import CoachPlanPreparing from '~/components/core/dashboard/CoachPlanPreparing';
import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';
import { useCoachRouteGuard } from '~/hooks/useCoachRouteGuard';
import type { CoachCategory } from '~/shared/coachFoundation';
import { COACH_CATEGORIES } from '~/shared/coachFoundation';
import { planCardRoute, planCardState } from '~/shared/coachPlanCards';
import { resumeMember } from '~/utils/coachResumeNavigation';

const categories = ['workout', 'steps', 'sleep', 'meals'] as const;
const titles = { workout: 'Workout', steps: 'Steps', sleep: 'Sleep', meals: 'Meals' };
const actions = {
  workout: 'Log workout',
  steps: 'Log steps',
  sleep: 'Log sleep',
  meals: 'Snap a meal',
};
const accents = {
  workout: { tint: '#FFF0E8', color: '#E9512A' },
  steps: { tint: '#EDF8F2', color: '#29855E' },
  sleep: { tint: '#F1EEFF', color: '#6E5BB7' },
  meals: { tint: '#FFF6DF', color: '#9A6A13' },
};
const icons = { workout: Barbell, steps: Footprints, sleep: MoonStars, meals: ForkKnife };

function concisePlanText(value: string) {
  const firstSentence = value.match(/^.*?[.!?](?:\s|$)/)?.[0]?.trim();
  return firstSentence || value;
}

export default function SavedCoachPlan() {
  const { nextCheckIn } = useLocalSearchParams<{ nextCheckIn?: string }>();
  const selectedCheckIn = COACH_CATEGORIES.find((item) => item === nextCheckIn);
  const convex = useConvex();
  const { accepted, decision } = useCoachRouteGuard(['today']);
  const refresh = decision ? Number(decision.day.replaceAll('-', '')) : 0;
  const saved = useQuery(api.revenueCatEntitlements.myPlan, accepted ? { refresh } : 'skip');
  const checkIns = useQuery(
    api.coachCheckIns.myToday,
    accepted && saved?.access ? { refresh } : 'skip'
  );
  const retry = useMutation(api.coachDailyService.retryFailedPlan);
  const resetAvailability = useQuery(
    api.coachFoundation.canResetMyTodayPlanForTesting,
    __DEV__ && accepted ? {} : 'skip'
  );
  const resetToday = useMutation(api.coachFoundation.resetMyTodayPlanForTesting);
  const beginReanswer = useMutation(api.coachFoundation.beginMyTodayReanswerForTesting);
  const [busy, setBusy] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [error, setError] = useState('');
  const [showWhy, setShowWhy] = useState(false);
  const existingMemberPreparing = Boolean(
    saved?.access &&
    !saved.plan &&
    (saved.requestStatus === 'pending' || saved.requestStatus === 'failed')
  );
  useEffect(() => {
    if (existingMemberPreparing) router.replace('/coach-plan-loading');
  }, [existingMemberPreparing]);
  if (existingMemberPreparing) return <ScreenLoading />;
  if (!accepted || !saved) return <ScreenLoading />;
  const plan = saved.plan;
  const output = plan?.output;
  const details = plan?.detailsV2;
  const rest = plan?.workout.type === 'rest';
  const open = (category: CoachCategory) => router.push(planCardRoute(category));
  const visibleCategories = categories.filter((category) => !(category === 'workout' && rest));
  const completedCategories = visibleCategories.filter((category) => {
    const assignment = checkIns?.assignments.find((item) => item.category === category);
    return (assignment?.consumedCount ?? 0) > 0;
  }).length;
  const completionPercent = visibleCategories.length
    ? Math.round((completedCategories / visibleCategories.length) * 100)
    : 0;
  const planDate = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  }).format(new Date(`${saved.day}T12:00:00`));
  return (
    <SafeAreaView className="flex-1 bg-[#F9F9F9]">
      <Stack.Screen options={{ title: "Today's plan" }} />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 56 }}>
        {output && plan ? (
          <>
            {saved.requestStatus === 'pending' ? (
              <View className="mb-4 rounded-2xl bg-[#FFF0E8] p-4">
                <Text className="font-body text-sm text-[#71432F]">
                  Your updated plan is preparing. The previous recommendation stays available until
                  it is ready.
                </Text>
              </View>
            ) : saved.requestStatus === 'failed' ? (
              <View className="mb-4 rounded-2xl bg-[#FFF0E8] p-4">
                <Text className="font-body text-sm text-[#71432F]">
                  The updated plan could not be prepared. Your previous plan and check-in history
                  remain saved.
                </Text>
              </View>
            ) : null}
            <LinearGradient
              colors={['#FF6A32', '#E74720', '#B92D16']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              className="mb-5 overflow-hidden rounded-[28px] p-6"
              style={{
                shadowColor: '#8D2A12',
                shadowOpacity: 0.2,
                shadowRadius: 14,
                elevation: 5,
              }}>
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center rounded-full bg-white/20 px-3 py-2">
                  <Sparkle size={15} color="#FFFFFF" weight="fill" />
                  <Text className="ml-2 font-body text-xs font-semibold uppercase tracking-wider text-white">
                    Made for your day
                  </Text>
                </View>
                <Text className="font-body text-xs font-medium text-white/80">{planDate}</Text>
              </View>
              <Text className="mt-6 font-heading text-[30px] font-semibold leading-9 text-white">
                {output.headline}
              </Text>
              <Text className="mt-2 font-body text-sm leading-5 text-white/85">
                Your Coach has balanced movement, recovery and fuel around today’s check-in.
              </Text>
              <View className="mt-6 rounded-2xl bg-black/15 p-4">
                <View className="flex-row items-center justify-between">
                  <Text className="font-body text-sm font-semibold text-white">
                    Today’s progress
                  </Text>
                  <Text className="font-body text-sm font-semibold text-white">
                    {completedCategories}/{visibleCategories.length} complete
                  </Text>
                </View>
                <View className="mt-3 h-2 overflow-hidden rounded-full bg-white/25">
                  <View
                    className="h-full rounded-full bg-white"
                    style={{ width: `${completionPercent}%` }}
                  />
                </View>
              </View>
            </LinearGradient>
            {selectedCheckIn && !(selectedCheckIn === 'workout' && rest) ? (
              <CoachActionButton
                label={`Continue to ${titles[selectedCheckIn]} check-in`}
                disabled={!checkIns?.assignments.some((item) => item.category === selectedCheckIn)}
                onPress={() => router.push(planCardRoute(selectedCheckIn))}
                className="mb-5"
              />
            ) : null}
            <View className="mb-3 flex-row items-end justify-between px-1">
              <View>
                <Text className="font-heading text-xl font-semibold text-[#211C19]">
                  Your focus
                </Text>
                <Text className="mt-1 font-body text-sm text-[#7B716B]">
                  Small actions chosen for how you feel today.
                </Text>
              </View>
            </View>
            {categories.map((category) => {
              const assignment = checkIns?.assignments.find((item) => item.category === category);
              const state = planCardState(category, rest, assignment?.consumedCount ?? 0);
              const fullBody =
                category === 'steps'
                  ? `${plan.stepTarget.toLocaleString('en-US')} steps`
                  : output[category];
              const body = concisePlanText(fullBody);
              const enabled = state.canOpen && Boolean(assignment);
              const action = state.canLog ? actions[category] : 'View check-in';
              const completed = (assignment?.consumedCount ?? 0) > 0;
              const Icon = icons[category];
              const accent = accents[category];
              return (
                <TouchableOpacity
                  key={category}
                  disabled={!enabled}
                  accessibilityRole={enabled ? 'button' : 'text'}
                  accessibilityLabel={`${titles[category]}. ${fullBody}. ${state.status}${enabled ? `. ${action}` : ''}`}
                  onPress={() => open(category)}
                  activeOpacity={0.82}
                  className="mb-3 rounded-[24px] border border-[#ECE6E2] bg-white p-4"
                  style={{ shadowColor: '#39251D', shadowOpacity: 0.05, shadowRadius: 10 }}>
                  <View className="flex-row items-center">
                    <View
                      className="h-14 w-14 items-center justify-center rounded-2xl"
                      style={{ backgroundColor: accent.tint }}>
                      <Icon size={27} color={accent.color} weight="duotone" />
                    </View>
                    <View className="ml-4 min-w-0 flex-1">
                      <View className="flex-row items-center justify-between gap-2">
                        <Text className="font-heading text-lg font-semibold text-[#211C19]">
                          {titles[category]}
                        </Text>
                        <View
                          className="flex-row items-center rounded-full px-2.5 py-1.5"
                          style={{ backgroundColor: completed ? '#EAF7F0' : '#F5F2F0' }}>
                          {completed ? <Check size={13} color="#29855E" weight="bold" /> : null}
                          <Text
                            className="font-body text-[11px] font-semibold"
                            style={{ color: completed ? '#247250' : '#756C67' }}>
                            {state.status}
                          </Text>
                        </View>
                      </View>
                      <Text
                        className="mt-1 font-body text-[15px] leading-5 text-[#655B55]"
                        numberOfLines={2}>
                        {body}
                      </Text>
                    </View>
                  </View>
                  {category === 'workout' && details?.workoutExamples.length ? (
                    <View className="mt-3 flex-row flex-wrap gap-2">
                      {details.workoutExamples.slice(0, 3).map((example) => (
                        <View key={example} className="rounded-full bg-[#FFF4EE] px-3 py-1.5">
                          <Text className="font-body text-xs text-[#9D4729]">{example}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                  {enabled ? (
                    <View className="mt-4 flex-row items-center justify-between border-t border-[#F1ECE8] pt-3">
                      <Text
                        className="font-body text-sm font-semibold"
                        style={{ color: accent.color }}>
                        {action}
                      </Text>
                      <View
                        className="h-8 w-8 items-center justify-center rounded-full"
                        style={{ backgroundColor: accent.tint }}>
                        <ArrowRight size={16} color={accent.color} weight="bold" />
                      </View>
                    </View>
                  ) : null}
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityState={{ expanded: showWhy }}
              accessibilityLabel={`${showWhy ? 'Hide' : 'Show'} why this plan fits today`}
              onPress={() => setShowWhy((value) => !value)}
              activeOpacity={0.85}
              className="mb-5 overflow-hidden rounded-[24px] border border-[#F1D9CC] bg-[#FFF8F4] p-5">
              <View className="flex-row items-center">
                <View className="h-11 w-11 items-center justify-center rounded-2xl bg-[#FFE9DC]">
                  <Sparkle size={22} color="#E9512A" weight="duotone" />
                </View>
                <View className="ml-3 min-w-0 flex-1">
                  <Text className="font-heading text-lg font-semibold text-[#2B211D]">
                    Why this fits you today
                  </Text>
                  {!showWhy ? (
                    <Text className="mt-1 font-body text-sm text-[#766A64]" numberOfLines={1}>
                      A plan shaped around your latest check-in
                    </Text>
                  ) : null}
                </View>
                {showWhy ? (
                  <CaretUp size={20} color="#A14A2C" />
                ) : (
                  <CaretDown size={20} color="#A14A2C" />
                )}
              </View>
              {showWhy ? (
                <Text className="mt-4 font-body text-[15px] leading-6 text-[#594D47]">
                  {output.why}
                </Text>
              ) : null}
            </TouchableOpacity>
          </>
        ) : saved.access && saved.requestStatus === 'pending' ? (
          <View className="mb-5 mt-3">
            <CoachPlanPreparing />
          </View>
        ) : (
          <View className="mb-5 rounded-2xl bg-white p-5">
            <Text className="font-heading text-xl font-semibold">
              {!saved.access
                ? 'Premium access unavailable'
                : saved.requestStatus === 'failed'
                  ? 'Your answers are saved'
                  : saved.requestStatus === 'none'
                    ? 'No plan for today yet'
                    : 'Preparing your plan'}
            </Text>
            <Text className="mt-2 text-sm text-[#6B665F]">
              {!saved.access
                ? 'Your plan remains private until access is verified again.'
                : saved.requestStatus === 'failed'
                  ? saved.canRetry
                    ? 'Plan preparation failed. Retry with your saved answers.'
                    : 'We cannot prepare a plan for these answers yet. Your answers are saved. Please contact support.'
                  : saved.requestStatus === 'none'
                    ? 'Answer today’s questions to prepare your plan.'
                    : 'You can return to Today while your saved plan is prepared.'}
            </Text>
          </View>
        )}
        {saved.access && saved.requestStatus === 'failed' && saved.canRetry && !output ? (
          <CoachActionButton
            label={busy ? 'Retrying…' : 'Retry plan preparation'}
            disabled={busy}
            onPress={async () => {
              setBusy(true);
              setError('');
              try {
                await retry({ requestKey: `retry_${saved.day.replaceAll('-', '')}_${Date.now()}` });
              } catch {
                setError('Retry is unavailable. Return to Today for the latest plan status.');
              } finally {
                setBusy(false);
              }
            }}
            className="mb-4"
          />
        ) : null}
        {saved.access && saved.requestStatus === 'none' && !output ? (
          <CoachActionButton
            label="Get today’s plan from Today"
            onPress={() => router.replace('/(tabs)/dashboard')}
            className="mb-4"
          />
        ) : null}
        {error ? <Text className="mb-3 text-red-600">{error}</Text> : null}
        <View className="flex-row gap-3">
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Back to Today"
            onPress={() => router.replace('/(tabs)/dashboard')}
            activeOpacity={0.8}
            className="min-h-[72px] flex-1 flex-row items-center rounded-[20px] border border-[#E7E1DD] bg-white px-4">
            <View className="h-10 w-10 items-center justify-center rounded-xl bg-[#FFF0E8]">
              <House size={21} color="#E9512A" weight="duotone" />
            </View>
            <Text className="ml-3 flex-1 font-body text-sm font-semibold text-[#302824]">
              Today
            </Text>
          </TouchableOpacity>
          {saved.access ? (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Update your profile"
              onPress={() => router.push('/coach-profile')}
              activeOpacity={0.8}
              className="min-h-[72px] flex-1 flex-row items-center rounded-[20px] border border-[#E7E1DD] bg-white px-4">
              <View className="h-10 w-10 items-center justify-center rounded-xl bg-[#F1EEFF]">
                <UserCircle size={22} color="#6E5BB7" weight="duotone" />
              </View>
              <Text className="ml-3 flex-1 font-body text-sm font-semibold text-[#302824]">
                Profile
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
        {__DEV__ && resetAvailability && saved.requestStatus !== 'none' ? (
          <View className="mt-8 rounded-2xl border border-[#E3E1DE] bg-white p-5">
            <Text className="font-heading text-base font-semibold text-[#1A1A1A]">
              Development testing
            </Text>
            <Text className="mt-2 font-body text-sm leading-5 text-[#6B665F]">
              Clear your own plan and answers for today, then answer today’s questions again.
              Earlier days and your profile stay saved.
            </Text>
            {resetAvailability.available ? (
              <CoachActionButton
                label={resetBusy ? 'Clearing today’s plan…' : 'Delete my plan for today'}
                variant="secondary"
                disabled={resetBusy}
                onPress={() =>
                  Alert.alert(
                    'Delete today’s plan?',
                    'This clears your saved plan and daily answers for today. You will answer today’s questions again.',
                    [
                      { text: 'Keep plan', style: 'cancel' },
                      {
                        text: 'Delete plan',
                        style: 'destructive',
                        onPress: async () => {
                          setResetBusy(true);
                          setError('');
                          try {
                            await resetToday({});
                            await resumeMember(convex);
                          } catch (caught) {
                            setError(
                              caught instanceof Error
                                ? caught.message
                                : 'Today’s plan could not be cleared.'
                            );
                          } finally {
                            setResetBusy(false);
                          }
                        },
                      },
                    ]
                  )
                }
                className="mt-4"
              />
            ) : (
              <>
                <Text className="mt-3 font-body text-sm text-[#8B5E4B]">
                  {resetAvailability.reason ===
                  'Today has check-in or reward records and cannot be reset safely'
                    ? 'A check-in, meal analysis or reward is linked to this plan. Deleting it would lose its original context or scan count.'
                    : resetAvailability.reason}
                </Text>
                {resetAvailability.reason ===
                'Today has check-in or reward records and cannot be reset safely' ? (
                  <CoachActionButton
                    label={resetBusy ? 'Opening questions…' : 'Re-answer today’s questions'}
                    variant="secondary"
                    disabled={resetBusy}
                    onPress={async () => {
                      setResetBusy(true);
                      setError('');
                      try {
                        await beginReanswer({});
                        router.push('/coach-onboarding?reanswer=1');
                      } catch (caught) {
                        setError(
                          caught instanceof Error ? caught.message : 'Could not reopen questions.'
                        );
                      } finally {
                        setResetBusy(false);
                      }
                    }}
                    className="mt-4"
                  />
                ) : null}
              </>
            )}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
