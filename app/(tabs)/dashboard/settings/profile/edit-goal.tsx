import { useConvex, useMutation } from 'convex/react';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { ScrollView, TouchableOpacity, View } from 'react-native';
import { z } from 'zod';

import { BackButton } from '~/components/core/BackButton';
import { ErrorMessage } from '~/components/core/ErrorMessage';
import SafeAreaView from '~/components/core/SafeAreaView';
import { ButtonGroup, ButtonText, LoadingButton } from '~/components/ui/button';
import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';
import { useAuthStore } from '~/store/useAuthStore';
import { CatchPromise } from '~/utils/catch-promise';
import { cn } from '~/utils/cn';
import { activityGoals } from '~/utils/constants';
import { getErrorMessage, getZodErrorMessage } from '~/utils/error-message';

export default function ProfileEditGoal() {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const currentUser = useAuthStore((state) => state.currentUser);
  const setCurrentUser = useAuthStore((state) => state.setCurrentUser);

  const [activityGoal, setActivityGoal] = useState<string | null>(
    currentUser?.activityGoal ?? null
  );

  const convex = useConvex();
  const updateUser = useMutation(api.users.update);

  const updateActivityGoalSchema = z.object({
    activityGoal: z.string().min(1, 'Activity goal is required'),
  });

  const handleSubmit = async () => {
    setIsLoading(true);
    setError(null);

    if (!activityGoal) {
      setError('Please select an activity goal');
      setIsLoading(false);
      return;
    }

    const result = await updateActivityGoalSchema.safeParse({ activityGoal });

    if (!result.success) {
      setError(getZodErrorMessage(result.error));
      setIsLoading(false);
      return;
    }

    const [error, response] = await CatchPromise(
      updateUser({
        activityGoal: activityGoal ?? undefined,
      })
    );

    if (error) {
      setError(getErrorMessage(error.data));
      setIsLoading(false);
      return;
    }

    if (response) {
      const user = await convex.query(api.users.current);
      setCurrentUser(user);
      router.back();
    }

    setIsLoading(false);
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          flexGrow: 1,
        }}>
        <Stack.Screen
          options={{
            headerShown: true,
            title: '',
            headerTitleAlign: 'center',
            headerShadowVisible: false,
            headerLeft: () => <BackButton onPress={router.back} text="Back" />,
          }}
        />
        <View className="flex-1 flex-col">
          <View className="flex-col items-center gap-y-2">
            <View className="px-10">
              <Text className="mb-4 mt-8 text-center font-heading text-2xl font-black text-[#1A1A1A]">
                What's your goal right now?
              </Text>
            </View>
          </View>
          <View>
            <ErrorMessage error={error} className="mt-4" />
          </View>
          <View className="mt-8 w-full flex-col items-center gap-y-2 px-10">
            {activityGoals.map((goal) => (
              <TouchableOpacity
                key={goal}
                onPress={() => setActivityGoal(goal)}
                className={cn('w-full gap-x-2 rounded-3xl border border-primary-400 p-3', {
                  'bg-primary-500': activityGoal === goal,
                })}>
                <Text
                  className={cn('text-center text-lg font-bold', {
                    'text-white': activityGoal === goal,
                  })}>
                  {goal}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View className="mb-4 mt-4">
            <ButtonGroup className="w-full px-10">
              <LoadingButton
                variant="solid"
                size="xl"
                action="primary"
                className="h-16 w-full rounded-3xl"
                onPress={handleSubmit}
                loading={isLoading}>
                <ButtonText className="text-xl font-bold text-white">Update goal</ButtonText>
              </LoadingButton>
            </ButtonGroup>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
