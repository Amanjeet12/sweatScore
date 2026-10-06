import { useConvex, useMutation, useQuery } from 'convex/react';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, TouchableOpacity, View } from 'react-native';

import SafeAreaView from '~/components/core/CoachSafeAreaView';
import ScreenLoading from '~/components/core/ScreenLoading';
import { PrototypeButton as CoachActionButton } from '~/components/core/auth/PrototypeOnboarding';
import CoachPlanItems from '~/components/core/dashboard/CoachPlanItems';
import CoachPlanPreparing from '~/components/core/dashboard/CoachPlanPreparing';
import PlanExplanation from '~/components/core/dashboard/PlanExplanation';
import PlanFeedback from '~/components/core/dashboard/PlanFeedback';
import { PrototypeSheetControl } from '~/components/core/design/PrototypeControl';
import { prototypeTypography as type } from '~/components/core/design/prototypeStyles';
import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';
import { useCoachRouteGuard } from '~/hooks/useCoachRouteGuard';
import type { CoachCategory } from '~/shared/coachFoundation';
import { COACH_CATEGORIES } from '~/shared/coachFoundation';
import { planCardState } from '~/shared/coachPlanCards';
import { resumeMember } from '~/utils/coachResumeNavigation';

const categories = ['workout', 'steps', 'sleep', 'meals'] as const;
const titles = { workout: 'Workout', steps: 'Steps', sleep: 'Sleep', meals: 'Meals' };
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
  const rest = plan?.workout.type === 'rest';
  const open = (category: CoachCategory) =>
    router.dismissTo({ pathname: '/(tabs)/dashboard', params: { checkIn: category } });
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
    <SafeAreaView className="flex-1 bg-white">
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 22, paddingTop: 18, paddingBottom: 56 }}>
        <View className="mb-4 flex-row items-center justify-between">
          <View className="min-w-0 flex-1 pr-3">
            <Text style={type.supporting}>Here’s today’s plan</Text>
            <Text style={[type.smallCaption, { color: '#8A8A8A' }]} className="mt-1">
              {planDate}
            </Text>
          </View>
          <PrototypeSheetControl
            kind="close"
            label="Back to Today"
            onPress={() => router.dismissTo('/(tabs)/dashboard')}
          />
        </View>
        {output && plan ? (
          <>
            {saved.requestStatus === 'pending' ? (
              <View className="mb-4 rounded-2xl bg-[#FFF0E8] p-4">
                <Text style={[type.supporting, { color: '#71432F' }]}>
                  Your updated plan is preparing. The previous recommendation stays available until
                  it is ready.
                </Text>
              </View>
            ) : saved.requestStatus === 'failed' ? (
              <View className="mb-4 rounded-2xl bg-[#FFF0E8] p-4">
                <Text style={[type.supporting, { color: '#71432F' }]}>
                  The updated plan could not be prepared. Your previous plan and check-in history
                  remain saved.
                </Text>
              </View>
            ) : null}

            <Text style={type.planHeading}>{output.headline}</Text>
            <View className="mb-7 mt-[26px]">
              <View className="flex-row justify-between">
                <Text style={[type.progressLabel, { flex: 1, paddingRight: 12 }]}>
                  Today’s progress
                </Text>
                <Text style={[type.progressValue, { flexShrink: 1, textAlign: 'right' }]}>
                  {completedCategories}/{visibleCategories.length} complete
                </Text>
              </View>
              <View
                className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-[#F1F1F1]"
                accessibilityRole="progressbar"
                accessibilityLabel="Today’s plan progress"
                accessibilityValue={{ min: 0, max: 100, now: completionPercent }}>
                <View
                  style={{
                    height: '100%',
                    width: `${completionPercent}%`,
                    backgroundColor: '#ff5a1f',
                  }}
                />
              </View>
            </View>
            {selectedCheckIn && !(selectedCheckIn === 'workout' && rest) ? (
              <CoachActionButton
                label={`Continue to ${titles[selectedCheckIn]} check-in`}
                disabled={!checkIns?.assignments.some((item) => item.category === selectedCheckIn)}
                onPress={() => open(selectedCheckIn)}
                className="mb-5"
              />
            ) : null}
            <CoachPlanItems
              plan={plan}
              checkIns={checkIns}
              onCheckIn={open}
              canOpen={(category) =>
                planCardState(
                  category,
                  rest,
                  checkIns?.assignments.find((item) => item.category === category)?.consumedCount ??
                    0
                ).canOpen &&
                Boolean(checkIns?.assignments.some((item) => item.category === category))
              }
            />
            <PlanExplanation explanation={output.why} />
            <PlanFeedback revisionId={plan.revisionId} />
          </>
        ) : saved.access && saved.requestStatus === 'pending' ? (
          <View className="mb-5 mt-3">
            <CoachPlanPreparing prototype />
          </View>
        ) : (
          <View className="mb-5 rounded-2xl bg-white p-5">
            <Text style={type.planHeading}>
              {!saved.access
                ? 'Premium access unavailable'
                : saved.requestStatus === 'failed'
                  ? 'Your answers are saved'
                  : saved.requestStatus === 'none'
                    ? 'No plan for today yet'
                    : 'Preparing your plan'}
            </Text>
            <Text style={type.supporting} className="mt-2">
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

        {saved.access ? (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Update your profile"
            accessibilityHint="Review and change the seven answers used by your AI Coach"
            onPress={() => router.push('/coach-profile')}
            className="mb-5 mt-4 min-h-11 items-center justify-center">
            <Text style={[type.body, { color: '#E8541E', textAlign: 'center' }]}>
              Update profile to refresh your plan →
            </Text>
            <Text
              style={[type.smallCaption, { color: '#8A8A8A', textAlign: 'center' }]}
              className="mt-2">
              Saving changes may refresh today’s recommendation once.
            </Text>
          </TouchableOpacity>
        ) : null}
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
        {error ? (
          <Text style={type.error} accessibilityLiveRegion="polite" className="mb-3">
            {error}
          </Text>
        ) : null}
        {__DEV__ && resetAvailability && saved.requestStatus !== 'none' ? (
          <View className="mt-8 rounded-2xl border border-[#E3E1DE] bg-white p-5">
            <Text style={[type.cardTitle, { color: '#1A1A1A' }]}>Development testing</Text>
            <Text style={type.supporting} className="mt-2">
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
                          } catch {
                            setError('Today’s plan could not be cleared.');
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
                <Text style={type.supporting} className="mt-3">
                  {resetAvailability.reason ===
                  'Today has check-in or reward records and cannot be reset safely'
                    ? 'A check-in, meal analysis or reward is linked to this plan. Deleting it would lose its original context or scan count.'
                    : 'Today’s plan cannot be cleared right now.'}
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
                      } catch {
                        setError('Could not reopen questions.');
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
