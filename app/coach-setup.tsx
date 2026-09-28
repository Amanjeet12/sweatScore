import { useConvex, useMutation } from 'convex/react';
import { Stack } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import CoachActionButton from '~/components/core/CoachActionButton';
import SafeAreaView from '~/components/core/CoachSafeAreaView';
import ScreenLoading from '~/components/core/ScreenLoading';
import CoachPlanPreparing from '~/components/core/dashboard/CoachPlanPreparing';
import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';
import { useCoachRouteGuard } from '~/hooks/useCoachRouteGuard';
import { resumeMember } from '~/utils/coachResumeNavigation';

export default function CoachSetup() {
  const { accepted } = useCoachRouteGuard(['setup']);
  const convex = useConvex();
  const finishSetup = useMutation(api.coachFoundation.finishCoachSetup);
  const [error, setError] = useState(false);
  const [working, setWorking] = useState(false);
  const complete = useCallback(async () => {
    if (working) return;
    setWorking(true);
    setError(false);
    try {
      await finishSetup({});
      await resumeMember(convex);
    } catch {
      setError(true);
    } finally {
      setWorking(false);
    }
  }, [convex, finishSetup, working]);

  useEffect(() => {
    if (!accepted || error) return;
    const timer = setTimeout(complete, 1800);
    return () => clearTimeout(timer);
  }, [accepted, complete, error]);

  if (!accepted) return <ScreenLoading />;
  return (
    <SafeAreaView className="flex-1 justify-center bg-[#FFF9F5] px-6">
      <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
      <View className="pb-20">
        <CoachPlanPreparing mode="profile" />
        {error ? (
          <View className="mt-6">
            <Text className="mb-4 text-center font-body text-sm text-[#655B55]">
              Your profile is safe. We couldn’t continue to the paywall yet.
            </Text>
            <CoachActionButton label="Continue" onPress={complete} disabled={working} />
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}
