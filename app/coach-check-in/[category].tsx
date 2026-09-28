import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import ScreenLoading from '~/components/core/ScreenLoading';
import { Text } from '~/components/ui/text';
import { useCoachRouteGuard } from '~/hooks/useCoachRouteGuard';
import { COACH_CATEGORIES } from '~/shared/coachFoundation';

const TODAY_ROUTE = ['today'] as const;

export default function CoachCheckInRoute() {
  const { category: rawCategory } = useLocalSearchParams<{ category: string }>();
  const category = COACH_CATEGORIES.find((item) => item === rawCategory);
  const { accepted } = useCoachRouteGuard(TODAY_ROUTE);

  useEffect(() => {
    if (accepted && category)
      router.replace({ pathname: '/(tabs)/dashboard', params: { checkIn: category } });
  }, [accepted, category]);

  if (!accepted) return <ScreenLoading />;
  if (!category) return <Text>Unknown check-in category.</Text>;

  return <ScreenLoading />;
}
