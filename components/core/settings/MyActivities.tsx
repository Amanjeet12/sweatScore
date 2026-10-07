import { useConvexAuth, useQuery } from 'convex/react';
import { router } from 'expo-router';
import { ReactElement, useEffect } from 'react';
import { View } from 'react-native';

import ScreenLoading from '~/components/core/ScreenLoading';
import { PrototypeButton } from '~/components/core/auth/PrototypeOnboarding';
import UserActivities from '~/components/core/user/Activities';
import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';
import { useAuthStore } from '~/store/useAuthStore';

export default function MyActivities({ header }: { header?: ReactElement }) {
  const currentUser = useAuthStore((state) => state.currentUser);
  const setCurrentUser = useAuthStore((state) => state.setCurrentUser);
  const { isAuthenticated, isLoading } = useConvexAuth();
  const sessionUser = useQuery(api.users.current, isAuthenticated && !currentUser ? {} : 'skip');
  useEffect(() => {
    if (isAuthenticated && sessionUser) setCurrentUser(sessionUser);
  }, [isAuthenticated, sessionUser, setCurrentUser]);

  const user = isAuthenticated ? (currentUser ?? sessionUser) : undefined;
  if (isLoading || (isAuthenticated && !currentUser && sessionUser === undefined))
    return <ScreenLoading />;
  if (!user)
    return (
      <View className="flex-1 justify-center gap-4 px-6">
        <Text className="text-center">Sign in to view your profile.</Text>
        <PrototypeButton label="Sign in" onPress={() => router.replace('/')} />
      </View>
    );
  return <UserActivities userId={user._id} header={header} />;
}
