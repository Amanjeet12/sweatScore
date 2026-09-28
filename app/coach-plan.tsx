import { useConvex, useMutation, useQuery } from 'convex/react';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, TouchableOpacity, View } from 'react-native';
import SafeAreaView from '~/components/core/CoachSafeAreaView';
import CoachActionButton from '~/components/core/CoachActionButton';
import ScreenLoading from '~/components/core/ScreenLoading';
import CoachPlanPreparing from '~/components/core/dashboard/CoachPlanPreparing';
import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';
import { useCoachRouteGuard } from '~/hooks/useCoachRouteGuard';
import { planCardRoute, planCardState } from '~/shared/coachPlanCards';
import type { CoachCategory } from '~/shared/coachFoundation';
import { COACH_CATEGORIES } from '~/shared/coachFoundation';
import { resumeMember } from '~/utils/coachResumeNavigation';

const categories = ['workout', 'steps', 'sleep', 'meals'] as const;
const titles = { workout: 'Workout', steps: 'Steps', sleep: 'Sleep', meals: 'Meals' };
const actions = {
  workout: 'Log workout',
  steps: 'Log steps',
  sleep: 'Log sleep',
  meals: 'Snap a meal',
};

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
  return (
    <SafeAreaView className="flex-1 bg-[#F9F9F9]">
      <Stack.Screen options={{ title: "Today's plan" }} />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 56 }}>
        <Text className="font-body text-xs font-bold uppercase text-primary-500">TODAY’S PLAN</Text>
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
            <Text className="mb-5 mt-2 font-heading text-[27px] font-semibold leading-8 text-[#1A1A1A]">
              {output.headline}
            </Text>
            {selectedCheckIn && !(selectedCheckIn === 'workout' && rest) ? (
              <CoachActionButton
                label={`Continue to ${titles[selectedCheckIn]} check-in`}
                disabled={!checkIns?.assignments.some((item) => item.category === selectedCheckIn)}
                onPress={() => router.push(planCardRoute(selectedCheckIn))}
                className="mb-5"
              />
            ) : null}
            {categories.map((category) => {
              const assignment = checkIns?.assignments.find((item) => item.category === category);
              const state = planCardState(category, rest, assignment?.consumedCount ?? 0);
              const body =
                category === 'steps'
                  ? `${plan.stepTarget.toLocaleString('en-US')} steps`
                  : output[category];
              const explanation =
                category === 'workout'
                  ? details?.workoutReason
                  : category === 'steps'
                    ? details?.stepsReason
                    : undefined;
              const enabled = state.canOpen && Boolean(assignment);
              const action = state.canLog ? actions[category] : 'View check-in';
              return (
                <TouchableOpacity
                  key={category}
                  disabled={!enabled}
                  accessibilityRole={enabled ? 'button' : 'text'}
                  accessibilityLabel={`${titles[category]}. ${body}. ${state.status}${enabled ? `. ${action}` : ''}`}
                  onPress={() => open(category)}
                  className="mb-3 rounded-2xl border border-[#E3E1DE] bg-white p-5">
                  <View className="flex-row items-start justify-between">
                    <Text className="font-heading text-lg font-semibold text-[#1A1A1A]">
                      {titles[category]}
                    </Text>
                    <Text className="font-body text-xs text-[#706D69]">{state.status}</Text>
                  </View>
                  <Text className="mt-2 font-body text-base leading-6 text-[#4F4F4F]">{body}</Text>
                  {category === 'workout' && details?.workoutExamples.length ? (
                    <Text className="mt-2 font-body text-base leading-6 text-[#4F4F4F]">
                      Try {details.workoutExamples.join(', ')}.
                    </Text>
                  ) : null}
                  {explanation ? (
                    <Text className="mt-2 font-body text-sm leading-5 text-[#6B665F]">
                      {explanation}
                    </Text>
                  ) : null}
                  {enabled ? (
                    <Text className="mt-3 font-body text-sm font-semibold text-primary-500">
                      {action} →
                    </Text>
                  ) : null}
                </TouchableOpacity>
              );
            })}
            <View className="mb-5 rounded-2xl border border-[#E3E1DE] bg-white p-5">
              <Text className="font-heading text-lg font-semibold text-[#1A1A1A]">
                Why this was suggested
              </Text>
              <Text className="mt-2 font-body text-base leading-6 text-[#4F4F4F]">
                {output.why}
              </Text>
            </View>
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
        <CoachActionButton
          label="Back to Today"
          variant="secondary"
          onPress={() => router.replace('/(tabs)/dashboard')}
          className="mb-3"
        />
        {saved.access ? (
          <CoachActionButton
            label="Update your profile"
            variant="secondary"
            onPress={() => router.push('/coach-profile')}
          />
        ) : null}
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
