import { useConvex } from 'convex/react';
import { Link, router, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ImageBackground, Platform, Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';
import SafeAreaView from '~/components/core/SafeAreaView';
import ScreenLoading from '~/components/core/ScreenLoading';
import { api } from '~/convex/_generated/api';
import { useActivateUser } from '~/hooks/useActivateUser';
import { useAuthStore } from '~/store/useAuthStore';
import { getData, storeData } from '~/utils/storage';

export default function Home() {
  const convex = useConvex();
  const [isLoading, setIsLoading] = useState(true);
  const setCurrentUser = useAuthStore((state) => state.setCurrentUser);
  const { activateUser } = useActivateUser();

  const authenticateUser = async () => {
    setIsLoading(true);
    const user = await convex.query(api.users.current);

    if (user) {
      await activateUser();
      setCurrentUser(user);
      storeData('autoSync', {
        enabled: user.autoSyncEnabled ?? true,
      });

      router.dismissAll();

      if (!user?.name || !user?.birthdate) {
        router.replace({ pathname: '/(auth)/setup-profile' });
      } else if (!user?.activityGoal) {
        router.replace({ pathname: '/(auth)/setup-activity-goal' });
      } else if (!user?.expoPushToken && !getData('skipPushPermission')) {
        router.replace({ pathname: '/(auth)/ask-push-permission' });
      } else if (!user?.onboarded) {
        router.replace({ pathname: '/(auth)/ask-health-permission' });
      } else {
        router.replace({ pathname: '/(tabs)/dashboard' });
      }
    }
    setIsLoading(false);
  };

  useEffect(() => {
    authenticateUser();
  }, []);

  return (
    <>
      <Stack.Screen
        options={{
          title: '',
          headerStyle: {
            backgroundColor: '#fff',
          },
          headerShadowVisible: false,
          headerLeft: () => null,
          headerBackVisible: false,
          header: () => null,
        }}
      />
      {isLoading ? (
        <ScreenLoading />
      ) : (
        <ImageBackground
          source={require('~/assets/backgrounds/signupscreen.png')}
          className="flex-1"
          resizeMode="cover">
          <SafeAreaView className="flex-1">
            <View className="flex-1 justify-end px-6 pb-6">
              {/* Heading */}
              <View className="mb-6 items-center">
                <Text
                  className="text-center text-3xl text-white"
                  style={{ fontFamily: 'Inter_700Bold' }}>
                  Move Together.{'\n'}Go Further.
                </Text>
              </View>

              {/* Start button */}
              <Pressable
                onPress={() => router.push('/email')}
                style={{
                  backgroundColor: '#F76B1C',
                  borderRadius: 9999,
                  paddingVertical: 18,
                  alignItems: 'center',
                  ...(Platform.OS === 'ios'
                    ? {
                        shadowColor: '#000000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.15,
                        shadowRadius: 6,
                      }
                    : { elevation: 4 }),
                }}>
                <Text
                  className="text-2xl text-white"
                  style={{ fontFamily: 'Inter_700Bold' }}>
                  Start Today
                </Text>
              </Pressable>

              {/* Legal */}
              <View className="mt-4">
                <Text className="text-center text-sm text-white">
                  By signing up, you agree to our{' '}
                  <Link href="/legals/terms">
                    <Text className="text-sm text-white" style={{ fontFamily: 'Inter_700Bold' }}>
                      Terms of Use
                    </Text>
                  </Link>
                </Text>
                <Text className="text-center text-sm text-white">
                  and{' '}
                  <Link href="/legals/privacy-policy">
                    <Text className="text-sm text-white" style={{ fontFamily: 'Inter_700Bold' }}>
                      Privacy Policy
                    </Text>
                  </Link>
                </Text>
              </View>

              {/* Login link */}
              <View className="mt-6 items-center">
                <Text className="text-lg text-white">
                  Back for more?{' '}
                  <Link href="/(auth)/email">
                    <Text
                      className="text-lg text-white"
                      style={{ fontFamily: 'Inter_700Bold' }}>
                      Log in here.
                    </Text>
                  </Link>
                </Text>
              </View>
            </View>
          </SafeAreaView>
        </ImageBackground>
      )}
    </>
  );
}
