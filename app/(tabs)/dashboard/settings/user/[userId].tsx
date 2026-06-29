import { convexQuery } from '@convex-dev/react-query';
import { useQuery } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { View, Text } from 'react-native';

import { BackButton } from '~/components/core/BackButton';
import SafeAreaView from '~/components/core/SafeAreaView';
import ScreenLoading from '~/components/core/ScreenLoading';
import Profile from '~/components/core/user/Profile';
import { api } from '~/convex/_generated/api';
import { Id } from '~/convex/_generated/dataModel';

export default function TabSettingsUser() {
  const { userId } = useLocalSearchParams();
  const { data: user, isPending: isUserLoading } = useQuery(
    convexQuery(api.users.getUser, { userId: userId as Id<'users'> })
  );

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitleAlign: 'center',
          title: '',
          headerTitle: () => (
            <Text className="text-center text-xl font-bold text-[#1A1A1A]">User Profile</Text>
          ),
          headerStyle: {
            backgroundColor: '#F9F9F9',
          },
          headerShadowVisible: false,
          headerLeft: () => <BackButton text="Back" fallbackHref="/(tabs)/dashboard/settings" />,
        }}
      />
      {isUserLoading || !user ? (
        <ScreenLoading />
      ) : (
        <SafeAreaView className="flex-1 bg-[#F9F9F9]">
          <View className="flex-1">
            <Profile user={user} />
          </View>
        </SafeAreaView>
      )}
    </>
  );
}
