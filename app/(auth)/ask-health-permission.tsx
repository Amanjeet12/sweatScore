import { Feather } from '@expo/vector-icons';
import { useConvex, useMutation } from 'convex/react';
import { Image } from 'expo-image';
import { router, Stack } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AppState, Platform, TouchableOpacity, View } from 'react-native';
import AppleHealthKit from 'react-native-health';
import {
  getSdkStatus,
  initialize,
  requestPermission,
  SdkAvailabilityStatus,
} from 'react-native-health-connect';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';
import { useAuthStore } from '~/store/useAuthStore';
import { healthPermissions, healthPermissionsAndroid } from '~/utils/constants';
import { storeData } from '~/utils/storage';
import { hasActiveSubscription } from '~/utils/subscription';

export default function AskHealthPermission() {
  const appState = useRef(AppState.currentState);
  const convex = useConvex();
  const insets = useSafeAreaInsets();
  const [, setHasPermission] = useState(false);
  const [, setSdkStatus] = useState<number | null>(null);
  const updateOnboarded = useMutation(api.users.updateOnboarded);
  const updateUserAutoSyncEnabled = useMutation(api.users.updateUserAutoSyncEnabled);
  const setCurrentUser = useAuthStore((state) => state.setCurrentUser);

  const handleAllow = async () => {
    if (Platform.OS === 'ios') {
      AppleHealthKit.isAvailable((err, isAvailable) => {
        if (err) {
          alert('Error checking availability');
          return;
        }
        if (!isAvailable) {
          alert('Apple Health not available');
          return;
        }
        AppleHealthKit.initHealthKit(healthPermissions, async (err) => {
          if (err) {
            return;
          }
          setHasPermission(true);
          handleSuccess('yes');
        });
      });
    } else {
      const status = await getSdkStatus();

      if (status === SdkAvailabilityStatus.SDK_UNAVAILABLE) {
        alert(
          'Health Connect is not available on this device. Upgrade your Android version to enable Health Connect.'
        );
        await handleSkip();
        return;
      }

      if (status === SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) {
        handleSuccess('install');
        return;
      }

      const isInitialized = await initialize();
      if (!isInitialized) {
        alert('Error initializing Health Connect');
        router.dismissAll();
        await handleSkip();
        return;
      }

      await requestPermission(healthPermissionsAndroid);
      setHasPermission(true);
      handleSuccess('yes');
    }
  };

  const handleSuccess = async (showSuccess: string) => {
    await updateOnboarded({ onboarded: true });
    await updateUserAutoSyncEnabled({ enabled: true });

    storeData('autoSync', { enabled: true });

    const user = await convex.query(api.users.current);
    await setCurrentUser(user);

    const isSubscribed = await hasActiveSubscription(user);

    router.dismissAll();

    if (isSubscribed) {
      router.replace({
        pathname: '/(tabs)/dashboard',
        params: { showSuccess },
      });
    } else {
      router.replace({
        pathname: '/subscription',
        params: {
          redirectTo: '/(tabs)/dashboard',
          showBackToLogin: 'true',
        },
      });
    }
  };

  const handleSkip = async () => {
    await updateOnboarded({ onboarded: true });
    await updateUserAutoSyncEnabled({ enabled: false });

    storeData('autoSync', { enabled: false });

    const user = await convex.query(api.users.current);
    await setCurrentUser(user);

    const isSubscribed = await hasActiveSubscription(user);

    router.dismissAll();

    if (isSubscribed) {
      router.replace('/(tabs)/dashboard');
    } else {
      router.replace({
        pathname: '/subscription',
        params: {
          redirectTo: '/(tabs)/dashboard',
          showBackToLogin: 'true',
        },
      });
    }
  };

  useEffect(() => {
    if (Platform.OS === 'android') {
      getSdkStatus().then((status) => {
        setSdkStatus(status);
      });
    }
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        if (Platform.OS === 'android') {
          getSdkStatus().then((status) => {
            setSdkStatus(status);
          });
        }
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, []);

  return (
    <View className="flex-1 bg-white">
      <Stack.Screen options={{ headerShown: false }} />

      {/* Image fixed at top — does NOT move */}
      <Image
        source={require('~/assets/onboarding/healthscreen.png')}
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
              Let&apos;s track your sweat
            </Text>
            <Text className="mb-5 text-center font-body text-base text-[#5A5A5A]">
              SweatScore needs these to count your daily points:
            </Text>

            <View className="mb-2 flex-row">
              <Text className="font-body text-base text-[#1A1A1A]">• </Text>
              <View className="flex-1">
                <Text className="font-body text-base text-[#1A1A1A]">
                  <Text className="font-bold">Steps</Text> — 1 point per 1,000 steps
                </Text>
              </View>
            </View>
            <View className="mb-2 flex-row">
              <Text className="font-body text-base text-[#1A1A1A]">• </Text>
              <View className="flex-1">
                <Text className="font-body text-base text-[#1A1A1A]">
                  <Text className="font-bold">Heart rate</Text> — to calculate Active Minutes (1
                  point per 5 min in your personal cardio zone). Required for the points on the Earn
                  and Track screens.
                </Text>
              </View>
            </View>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleAllow}
              className="mt-6"
              style={{
                backgroundColor: '#F76B1C',
                borderRadius: 9999,
                paddingVertical: 14,
                alignItems: 'center',
              }}>
              <Text className="text-2xl font-bold text-white">Connect</Text>
            </TouchableOpacity>
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
