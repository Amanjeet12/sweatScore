import { convexQuery } from '@convex-dev/react-query';
import { Feather } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useConvex, useMutation } from 'convex/react';
import { Image } from 'expo-image';
import { router, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ErrorMessage } from '~/components/core/ErrorMessage';
import ScreenLoading from '~/components/core/ScreenLoading';
import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';
import { useAuthStore } from '~/store/useAuthStore';
import { CatchPromise } from '~/utils/catch-promise';
import { activityGoals } from '~/utils/constants';
import { getErrorMessage } from '~/utils/error-message';

export default function SetupActivityGoal() {
  const convex = useConvex();
  const [error, setError] = useState<string | null>(null);
  const [activityGoal, setActivityGoal] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const insets = useSafeAreaInsets();

  const setCurrentUser = useAuthStore((state) => state.setCurrentUser);

  const updateUser = useMutation(api.users.update);

  const { data: currentUser, isPending } = useQuery(convexQuery(api.users.current, {}));

  const handleSelect = async (goal: string) => {
    if (isLoading) return;
    setActivityGoal(goal);
    setError(null);
    setIsLoading(true);

    const [err, response] = await CatchPromise(updateUser({ activityGoal: goal }));

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

  const firstName = currentUser?.name?.split(' ')[0] ?? 'there';

  return (
    <View className="flex-1 bg-white">
      <Stack.Screen options={{ headerShown: false }} />

      {/* Image fixed at top — does NOT move */}
      <Image
        source={require('~/assets/onboarding/goalscreen.png')}
        contentFit="cover"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          width: '100%',
          aspectRatio: 4044 / 3938,
        }}
      />

      <View className="flex-1">
        {/* Invisible spacer matching image height */}
        <View style={{ width: '100%', aspectRatio: 4044 / 3938 }} />

        {/* Form panel */}
        <View className="flex-1 bg-white">
          <ScrollView
            className="flex-1"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 32, paddingTop: 24, paddingBottom: 12 }}>
            <Text className="mb-4 text-center font-heading text-2xl font-bold text-[#1A1A1A]">
              What brings you here,{'\n'}
              {firstName}?
            </Text>

            <View className="gap-y-2">
              {activityGoals.map((goal) => {
                const selected = activityGoal === goal;
                return (
                  <TouchableOpacity
                    key={goal}
                    onPress={() => handleSelect(goal)}
                    disabled={isLoading}
                    activeOpacity={0.8}
                    style={{
                      borderRadius: 9999,
                      borderWidth: 1,
                      borderColor: '#F76B1C',
                      backgroundColor: selected ? '#F76B1C' : '#FFFFFF',
                      paddingVertical: 10,
                      alignItems: 'center',
                    }}>
                    {selected && isLoading ? (
                      <ActivityIndicator color="white" />
                    ) : (
                      <Text
                        className="font-body text-base font-semibold"
                        style={{ color: selected ? '#FFFFFF' : '#1A1A1A' }}>
                        {goal}
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            <View className="mt-2 items-center">
              <ErrorMessage error={error} />
            </View>
          </ScrollView>

          <SafeAreaView edges={['bottom']} className="bg-white">
            <View className="bg-white px-8 pb-4 pt-2">
              <Text className="text-center font-body text-base text-[#5A5A5A]">Choose one</Text>
            </View>
          </SafeAreaView>
        </View>
      </View>

      {/* Plain back button overlay */}
      <TouchableOpacity
        onPress={router.back}
        style={{
          position: 'absolute',
          top: insets.top + 8,
          left: 16,
          zIndex: 10,
        }}>
        <View className="flex-row items-center">
          <Feather name="chevron-left" size={32} color="#FFFFFF" />
          <Text className="ml-1 text-xl font-bold text-white">Back</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}
