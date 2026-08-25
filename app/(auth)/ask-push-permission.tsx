import { Feather } from '@expo/vector-icons';
import { useConvex, useMutation } from 'convex/react';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Image } from 'expo-image';
import * as Notifications from 'expo-notifications';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OnboardingHeroChrome } from '~/components/core/auth/OnboardingHeroChrome';
import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';
import { useAuthStore } from '~/store/useAuthStore';
import { CatchPromise } from '~/utils/catch-promise';
import { storeData } from '~/utils/storage';

export default function AskPushPermission() {
  const convex = useConvex();
  const { height: windowHeight } = useWindowDimensions();
  const [isLoading, setIsLoading] = useState(false);
  const heroHeight = Math.min(Math.max(windowHeight * 0.53, 390), 475);
  const updateExpoPushToken = useMutation(api.users.updateExpoPushToken);
  const setCurrentUser = useAuthStore((state) => state.setCurrentUser);

  const registerForPushNotificationsAsync = async () => {
    if (!Device.isDevice) {
      alert('Must be using a physical device for Push notifications');
      return;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      return;
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId;

    if (!projectId) {
      console.log('Expo projectId missing');
      return;
    }

    const token = await Notifications.getExpoPushTokenAsync({ projectId });

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    if (token?.data) {
      await CatchPromise(updateExpoPushToken({ expoPushToken: token.data }));
    }
  };

  const handleAllow = async () => {
    setIsLoading(true);

    try {
      await registerForPushNotificationsAsync();

      const user = await convex.query(api.users.current);

      if (user) {
        setCurrentUser(user);
      }
    } catch (error) {
      console.log('Push permission error:', error);
    } finally {
      setIsLoading(false);
      router.replace('/(auth)/ask-health-permission');
    }
  };

  const handleSkip = async () => {
    storeData('skipPushPermission', true);
    router.push('/(auth)/ask-health-permission');
  };

  return (
    <View className="flex-1 bg-white">
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style="light" />

      <Image
        source={require('~/assets/onboarding/notificationscreen-clean-v2.png')}
        contentFit="cover"
        style={{ position: 'absolute', top: 0, right: 0, left: 0, height: heroHeight }}
      />

      <OnboardingHeroChrome activeStep={5} onBack={router.back} />

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
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 22, paddingBottom: 8 }}>
          <View className="h-10 w-10 items-center justify-center rounded-xl bg-[#FFF0E8]">
            <Feather name="bell" size={20} color="#FF5C1A" />
          </View>

          <Text className="mt-3 font-body text-xs font-bold uppercase tracking-[1.5px] text-primary-500">
            A little nudge, right on time
          </Text>
          <Text className="mt-2 font-heading text-3xl font-bold leading-9 text-[#1A1A1A]">
            Turn on notifications
          </Text>
          <Text className="mt-1 font-body text-sm leading-5 text-[#838383]">
            Get check-in reminders, group replies and a little hype when it matters.
          </Text>

          <View className="mt-3 gap-y-2.5">
            <View className="flex-row items-center">
              <View className="h-6 w-6 items-center justify-center rounded-full bg-[#FFF0E8]">
                <Feather name="check" size={13} color="#FF5C1A" />
              </View>
              <View className="ml-3 flex-1">
                <Text className="font-body text-sm font-bold text-[#1A1A1A]">
                  Never miss today&apos;s check-in
                </Text>
                <Text className="font-body text-xs text-[#838383]">
                  Choose your reminder time later.
                </Text>
              </View>
            </View>

            <View className="flex-row items-center">
              <View className="h-6 w-6 items-center justify-center rounded-full bg-[#FFF0E8]">
                <Feather name="check" size={13} color="#FF5C1A" />
              </View>
              <View className="ml-3 flex-1">
                <Text className="font-body text-sm font-bold text-[#1A1A1A]">
                  Stay close to your community
                </Text>
                <Text className="font-body text-xs text-[#838383]">
                  Know when your Sweat Sisters reply.
                </Text>
              </View>
            </View>
          </View>

          <TouchableOpacity
            accessibilityRole="button"
            activeOpacity={0.82}
            disabled={isLoading}
            onPress={handleAllow}
            className="mt-4 h-[52px] flex-row items-center justify-center rounded-2xl bg-primary-500 px-5"
            style={{ shadowColor: '#FF5C1A', shadowOpacity: 0.22, shadowRadius: 10 }}>
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text className="font-body text-base font-bold text-white">
                Turn on notifications
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            accessibilityRole="button"
            activeOpacity={0.78}
            disabled={isLoading}
            onPress={handleSkip}
            className="mt-2 h-[46px] items-center justify-center rounded-2xl border border-[#E8DDD6] bg-white">
            <Text className="font-body text-base font-bold text-[#1A1A1A]">Maybe later</Text>
          </TouchableOpacity>

          <Text className="mt-2 text-center font-body text-[11px] text-[#9A9A9A]">
            You can change this anytime in Settings.
          </Text>
        </ScrollView>

        <SafeAreaView edges={['bottom']} />
      </View>
    </View>
  );
}
