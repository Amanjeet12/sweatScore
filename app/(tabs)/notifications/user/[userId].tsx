import { convexQuery } from '@convex-dev/react-query';
import { useQuery } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '~/components/core/BackButton';
import ScreenLoading from '~/components/core/ScreenLoading';
import { leagueTypography as type } from '~/components/core/design/LeagueStyles';
import Profile from '~/components/core/user/Profile';
import { api } from '~/convex/_generated/api';
import { Id } from '~/convex/_generated/dataModel';

export default function TabNotificationsUser() {
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
          headerTitle: () => <Text style={type.heading}>User Profile</Text>,
          headerStyle: {
            backgroundColor: '#fff',
          },
          headerShadowVisible: false,
          headerLeft: () => (
            <BackButton
              text=""
              iconColor="#2a2a2a"
              iconSize={22}
              accessibilityLabel="Back to League"
              fallbackHref="/(tabs)/notifications"
            />
          ),
        }}
      />
      {isUserLoading || !user ? (
        <ScreenLoading />
      ) : (
        <SafeAreaView edges={['left', 'right', 'bottom']} className="flex-1 bg-white">
          <View className="flex-1">
            <Profile user={user} league />
          </View>
        </SafeAreaView>
      )}
    </>
  );
}
