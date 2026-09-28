import { router, Stack, useLocalSearchParams } from 'expo-router';
import SafeAreaView from '~/components/core/CoachSafeAreaView';
import ScreenLoading from '~/components/core/ScreenLoading';
import CoachCheckInFlow from '~/components/core/dashboard/CoachCheckInFlow';
import { Text } from '~/components/ui/text';
import { useCoachRouteGuard } from '~/hooks/useCoachRouteGuard';
import { COACH_CATEGORIES } from '~/shared/coachFoundation';

export default function CoachCheckInPost() {
  const { category: rawCategory } = useLocalSearchParams<{ category: string }>();
  const category = COACH_CATEGORIES.find((item) => item === rawCategory);
  const { accepted } = useCoachRouteGuard(['today']);
  if (!accepted) return <ScreenLoading />;
  if (!category) return <Text>Unknown check-in category.</Text>;
  return (
    <SafeAreaView className="flex-1 bg-white">
      <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
      <CoachCheckInFlow
        category={category}
        mode="post"
        onClose={() => router.replace('/(tabs)/dashboard')}
        onOpenPlan={(status) =>
          router.replace(status === 'no_plan' ? '/coach-onboarding' : '/coach-plan')
        }
      />
    </SafeAreaView>
  );
}
