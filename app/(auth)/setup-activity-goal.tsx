import { convexQuery } from '@convex-dev/react-query';
import { Feather } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useConvex, useMutation } from 'convex/react';
import { Image } from 'expo-image';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ScrollView, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ErrorMessage } from '~/components/core/ErrorMessage';
import ScreenLoading from '~/components/core/ScreenLoading';
import { OnboardingHeroChrome } from '~/components/core/auth/OnboardingHeroChrome';
import { OnboardingPrimaryButton } from '~/components/core/auth/OnboardingPrimaryButton';
import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';
import { useAuthStore } from '~/store/useAuthStore';
import { CatchPromise } from '~/utils/catch-promise';
import { activityGoals } from '~/utils/constants';
import { getErrorMessage } from '~/utils/error-message';

const GOAL_PRESENTATION = [
  { label: 'Rebuild my routine', icon: 'rotate-ccw' },
  { label: 'Get stronger', icon: 'arrow-up-right' },
  { label: 'Feel confident', icon: 'square' },
  { label: 'Ease some stress', icon: 'wind' },
  { label: 'Make fitness fun', icon: 'star' },
  { label: 'Stay accountable', icon: 'check' },
] as const;

export default function SetupActivityGoal() {
  const convex = useConvex();
  const { height: windowHeight } = useWindowDimensions();
  const [error, setError] = useState<string | null>(null);
  const [activityGoal, setActivityGoal] = useState<string | null>(activityGoals[0] ?? null);
  const [isLoading, setIsLoading] = useState(false);
  const heroHeight = Math.min(Math.max(windowHeight * 0.53, 390), 475);

  const setCurrentUser = useAuthStore((state) => state.setCurrentUser);
  const updateUser = useMutation(api.users.update);
  const { data: currentUser, isPending } = useQuery(convexQuery(api.users.current, {}));

  const handleSelect = (goal: string) => {
    if (isLoading) return;
    setActivityGoal(goal);
    setError(null);
  };

  const handleSubmit = async () => {
    if (!activityGoal || isLoading) {
      setError('Choose a goal to continue');
      return;
    }

    setError(null);
    setIsLoading(true);

    const [err, response] = await CatchPromise(updateUser({ activityGoal }));

    if (err) {
      setError(getErrorMessage(err.data));
      setIsLoading(false);
      return;
    }

    if (response) {
      const user = await convex.query(api.users.current);
      setCurrentUser(user);
      router.push('/(auth)/ask-push-permission');
    }

    setIsLoading(false);
  };

  useEffect(() => {
    if (currentUser?.activityGoal) {
      setActivityGoal(currentUser.activityGoal);
    }
  }, [currentUser?.activityGoal]);

  if (isPending) return <ScreenLoading />;

  return (
    <View className="flex-1 bg-white">
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style="light" />

      <Image
        source={require('~/assets/onboarding/goalscreen-clean-v2.png')}
        contentFit="cover"
        style={{ position: 'absolute', top: 0, right: 0, left: 0, height: heroHeight }}
      />

      <OnboardingHeroChrome activeStep={4} onBack={router.back} />

      <View style={{ height: heroHeight }} />

      <View
        className="flex-1 bg-white"
        style={{
          marginTop: -30,
          borderTopLeftRadius: 32,
          borderTopRightRadius: 32,
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: -5 },
          shadowOpacity: 0.05,
          shadowRadius: 12,
        }}>
        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 28, paddingBottom: 8 }}>
          <Text className="font-body text-xs font-bold uppercase tracking-[1.5px] text-primary-500">
            Your reason, your rhythm
          </Text>
          <Text className="mt-2 font-heading text-3xl font-bold leading-9 text-[#1A1A1A]">
            What brings you here?
          </Text>
          <Text className="mt-2 font-body text-sm leading-5 text-[#838383]">
            Choose the one that feels most important today.
          </Text>

          <View className="mt-3 flex-row flex-wrap justify-between gap-y-2">
            {activityGoals.map((goal, index) => {
              const selected = activityGoal === goal;
              const presentation = GOAL_PRESENTATION[index] ?? {
                label: goal,
                icon: 'check' as const,
              };

              return (
                <TouchableOpacity
                  key={goal}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  activeOpacity={0.78}
                  disabled={isLoading}
                  onPress={() => handleSelect(goal)}
                  className="h-[52px] flex-row items-center rounded-2xl border px-2.5"
                  style={{
                    width: '48.7%',
                    borderColor: selected ? '#FF5C1A' : '#E8DDD6',
                    borderWidth: selected ? 1.5 : 1,
                    backgroundColor: selected ? '#FFF9F6' : '#FFFFFF',
                  }}>
                  <View
                    className="h-8 w-8 items-center justify-center rounded-xl"
                    style={{ backgroundColor: selected ? '#FF5C1A' : '#FFF0E8' }}>
                    <Feather
                      name={presentation.icon}
                      size={15}
                      color={selected ? '#FFFFFF' : '#FF5C1A'}
                    />
                  </View>
                  <Text
                    className="ml-2 flex-1 font-body text-[11px] font-bold leading-4 text-[#1A1A1A]"
                    numberOfLines={2}>
                    {presentation.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <ErrorMessage error={error} />

          <OnboardingPrimaryButton
            label="Continue"
            onPress={handleSubmit}
            isLoading={isLoading}
            className="mt-3"
          />
        </ScrollView>

        <SafeAreaView edges={['bottom']} />
      </View>
    </View>
  );
}
