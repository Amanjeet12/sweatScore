import { convexQuery } from '@convex-dev/react-query';
import { useQuery } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import SafeAreaView from '~/components/core/SafeAreaView';
import ScreenLoading from '~/components/core/ScreenLoading';
import Profile from '~/components/core/user/Profile';
import ProfileHeader from '~/components/core/user/ProfileHeader';
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
          header: () => <ProfileHeader fallbackHref="/(tabs)/dashboard/settings" />,
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
