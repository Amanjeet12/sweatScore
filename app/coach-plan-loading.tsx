import { useMutation, useQuery } from 'convex/react';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import CoachActionButton from '~/components/core/CoachActionButton';
import SafeAreaView from '~/components/core/CoachSafeAreaView';
import ScreenLoading from '~/components/core/ScreenLoading';
import CoachPlanPreparing from '~/components/core/dashboard/CoachPlanPreparing';
import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';
import { useCoachRouteGuard } from '~/hooks/useCoachRouteGuard';
import { COACH_CATEGORIES } from '~/shared/coachFoundation';

export default function CoachPlanLoading() {
  const { nextCheckIn } = useLocalSearchParams<{ nextCheckIn?: string }>();
  const selectedCheckIn = COACH_CATEGORIES.find((item) => item === nextCheckIn);
  const { accepted, decision } = useCoachRouteGuard(['today']);
  const saved = useQuery(
    api.revenueCatEntitlements.myPlan,
    accepted ? { refresh: Number(decision?.day.replaceAll('-', '') ?? 0) } : 'skip'
  );
  const retry = useMutation(api.coachDailyService.retryFailedPlan);
  const retryInFlight = useRef(false);
  const [retryBusy, setRetryBusy] = useState(false);
  const [retryRequestId, setRetryRequestId] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (saved?.access && saved.requestStatus === 'ready' && saved.plan)
      router.replace({
        pathname: '/coach-plan',
        params: selectedCheckIn ? { nextCheckIn: selectedCheckIn } : {},
      });
  }, [saved?.access, saved?.requestStatus, saved?.plan?.revisionId, selectedCheckIn]);

  if (!accepted || !saved) return <ScreenLoading />;
  const waitingForRetry = Boolean(retryRequestId && saved.requestId !== retryRequestId);
  const pending = saved.requestStatus === 'pending' || waitingForRetry;

  return (
    <SafeAreaView className="flex-1 bg-[#F9F9F9]">
      <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
      <View className="flex-1 justify-center px-5 pb-10">
        {pending ? (
          <CoachPlanPreparing />
        ) : saved.requestStatus === 'failed' ? (
          <View className="rounded-[28px] border border-[#E3E1DE] bg-white p-6">
            <Text className="font-heading text-2xl font-semibold text-[#1A1A1A]">
              Your answers are saved
            </Text>
            <Text className="mt-3 font-body text-base leading-6 text-[#5A554F]">
              We could not prepare today’s plan. Your five answers are still saved.
            </Text>
            {saved.canRetry && saved.requestId ? (
              <CoachActionButton
                label={retryBusy ? 'Retrying…' : 'Retry plan preparation'}
                disabled={retryBusy}
                onPress={async () => {
                  if (retryInFlight.current || !saved.requestId) return;
                  retryInFlight.current = true;
                  setRetryBusy(true);
                  setError('');
                  try {
                    const requestId = await retry({
                      failedRequestId: saved.requestId,
                      requestKey: `retry_${saved.day.replaceAll('-', '')}_${Date.now()}`,
                    });
                    setRetryRequestId(requestId);
                  } catch {
                    setError('Retry could not start. Your answers remain saved.');
                  } finally {
                    retryInFlight.current = false;
                    setRetryBusy(false);
                  }
                }}
                className="mt-6"
              />
            ) : null}
            {error ? <Text className="mt-3 font-body text-sm text-red-600">{error}</Text> : null}
          </View>
        ) : saved.requestStatus === 'ready' && saved.plan ? (
          <ScreenLoading />
        ) : (
          <View className="rounded-[28px] bg-white p-6">
            <Text className="font-heading text-xl font-semibold text-[#1A1A1A]">
              {saved.access ? 'No plan request for today' : 'Premium access unavailable'}
            </Text>
            <Text className="mt-3 font-body text-base text-[#5A554F]">
              {saved.access
                ? 'Your saved questions and plan status will appear here after submission.'
                : 'Your plan remains private until access is verified again.'}
            </Text>
          </View>
        )}
        {!pending ? (
          <CoachActionButton
            label="Back to Today"
            variant="secondary"
            onPress={() => router.replace('/(tabs)/dashboard')}
            className="mt-6"
          />
        ) : null}
      </View>
    </SafeAreaView>
  );
}
