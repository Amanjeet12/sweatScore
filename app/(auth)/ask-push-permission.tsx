import { Feather } from '@expo/vector-icons';
import { useConvex, useMutation } from 'convex/react';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Image } from 'expo-image';
import * as Notifications from 'expo-notifications';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Platform, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';
import { useAuthStore } from '~/store/useAuthStore';
import { CatchPromise } from '~/utils/catch-promise';
import { storeData } from '~/utils/storage';

export default function AskPushPermission() {
  const convex = useConvex();
  const [isLoading, setIsLoading] = useState(false);
  const insets = useSafeAreaInsets();
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

    const token = await Notifications.getExpoPushTokenAsync({
      projectId,
    });

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

      {/* Image fixed at top — does NOT move */}
      <Image
        source={require('~/assets/onboarding/notificationscreen.png')}
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

        {/* Content panel */}
        <View className="flex-1 bg-white">
          <View className="px-8 pt-8">
            <Text className="mb-4 text-center font-heading text-3xl font-bold text-[#1A1A1A]">
              Turn on notifications
            </Text>
            <Text className="text-center font-body text-base text-[#5A5A5A]">
              Switch on notifications so we can hype you with reminders, and everything you need to
              stay consistent.
            </Text>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleAllow}
              disabled={isLoading}
              className="mt-8"
              style={{
                backgroundColor: '#F76B1C',
                borderRadius: 9999,
                paddingVertical: 14,
                alignItems: 'center',
              }}>
              {isLoading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-2xl font-bold text-white">Turn On</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleSkip}
              disabled={isLoading}
              className="mt-3"
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 9999,
                borderWidth: 1,
                borderColor: '#F76B1C',
                paddingVertical: 14,
                alignItems: 'center',
              }}>
              <Text className="text-2xl font-bold text-[#1A1A1A]">Skip</Text>
            </TouchableOpacity>

            <Text className="mt-4 text-center font-body text-sm text-[#5A5A5A]">
              You can update this anytime in your settings.
            </Text>
          </View>

          <View className="flex-1" />

          <SafeAreaView edges={['bottom']}>
            <View className="pb-2" />
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
