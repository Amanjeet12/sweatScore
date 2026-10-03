import { useConvex, useMutation } from 'convex/react';
import { Image } from 'expo-image';
import { Stack } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';

import CoachActionButton from '~/components/core/CoachActionButton';
import CoachSetupLoading from '~/components/core/CoachSetupLoading';
import CoachPlanPreparing from '~/components/core/dashboard/CoachPlanPreparing';
import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';
import { useCoachRouteGuard } from '~/hooks/useCoachRouteGuard';
import { useAuthStore } from '~/store/useAuthStore';
import { resumeMember } from '~/utils/coachResumeNavigation';

export default function CoachSetup() {
  const { height } = useWindowDimensions();
  const firstName = useAuthStore((state) => state.currentUser?.name?.trim().split(' ')[0]);
  const { accepted } = useCoachRouteGuard(['setup']);
  const displayed = useRef(false);
  if (accepted) displayed.current = true;
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

  if (!accepted && !displayed.current) return <CoachSetupLoading />;
  return (
    <View className="flex-1 bg-white">
      <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <Image
          source={require('~/assets/onboarding/coach-onboarding.jpg')}
          contentFit="cover"
          contentPosition={{ top: '22%', left: '50%' }}
          style={{ width: '100%', height: height * 0.47 }}
        />
        <View className="flex-1 rounded-t-[34px] bg-white pb-12 pt-8" style={{ marginTop: -32 }}>
          <CoachPlanPreparing mode="profile" firstName={firstName} />
          {error ? (
            <View className="mt-6">
              <Text className="mb-4 text-center font-body text-sm text-[#655B55]">
                Your profile is safe. We couldn’t continue to the paywall yet.
              </Text>
              <CoachActionButton label="Continue" onPress={complete} disabled={working} />
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}
