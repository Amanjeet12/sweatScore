import { router, Stack, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import SafeAreaView from '~/components/core/CoachSafeAreaView';
import ScreenLoading from '~/components/core/ScreenLoading';
import CoachCheckInFlow from '~/components/core/dashboard/CoachCheckInFlow';
import { Text } from '~/components/ui/text';
import { useCoachRouteGuard } from '~/hooks/useCoachRouteGuard';
import { COACH_CATEGORIES } from '~/shared/coachFoundation';

const TODAY_ROUTE = ['today'] as const;

export default function CoachCheckInRoute() {
  const { category: rawCategory } = useLocalSearchParams<{ category: string }>();
  const category = COACH_CATEGORIES.find((item) => item === rawCategory);
  const { accepted } = useCoachRouteGuard(TODAY_ROUTE);

  if (!accepted) return <ScreenLoading />;
  if (!category) return <Text>Unknown check-in category.</Text>;

  return (
    <SafeAreaView className="flex-1 bg-white">
      <Stack.Screen options={{ headerShown: false }} />
      <View className="flex-1">
        <CoachCheckInFlow
          category={category}
          onClose={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/dashboard'))}
          onOpenPlan={(status) =>
            router.replace(status === 'no_plan' ? '/coach-onboarding' : '/coach-plan')
          }
        />
      </View>
    </SafeAreaView>
  );
}
