import { Feather } from '@expo/vector-icons';
import { useConvex, useMutation } from 'convex/react';
import { Image } from 'expo-image';
import { router, Stack } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Platform, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';
import { useAuthStore } from '~/store/useAuthStore';
import { initializeAppleHealthKit, isAppleHealthAvailable } from '~/utils/apple-health-kit';
import { healthPermissionsAndroid } from '~/utils/constants';
import { storeData } from '~/utils/storage';
import { hasActiveSubscription } from '~/utils/subscription';

function getHealthConnect() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('react-native-health-connect') as typeof import('react-native-health-connect');
}

const HEALTH_CONNECT_CHECK_TIMEOUT_MS = 30000;
const HEALTH_CONNECT_PERMISSION_TIMEOUT_MS = 120000;

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMessage: string,
  timeoutMs = HEALTH_CONNECT_CHECK_TIMEOUT_MS
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>;

  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutId);
  });
}

export default function AskHealthPermission() {
  const appState = useRef(AppState.currentState);
  const convex = useConvex();
  const insets = useSafeAreaInsets();
  const [, setHasPermission] = useState(false);
  const [, setSdkStatus] = useState<number | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const updateOnboarded = useMutation(api.users.updateOnboarded);
  const updateUserAutoSyncEnabled = useMutation(api.users.updateUserAutoSyncEnabled);
  const setCurrentUser = useAuthStore((state) => state.setCurrentUser);

  const handleAllow = async () => {
    if (isConnecting) return;

    setIsConnecting(true);

    try {
      if (Platform.OS === 'ios') {
        const isAvailable = await isAppleHealthAvailable();

        if (!isAvailable) {
          Alert.alert('Apple Health not available');
          await handleSkip();
          return;
        }

        const hasPermissions = await initializeAppleHealthKit();
        if (!hasPermissions) {
          Alert.alert(
            'Permissions not enabled',
            'Apple Health permissions were not enabled. You can connect again later from settings.'
          );
          await handleSkip();
          return;
        }

        setHasPermission(true);
        await handleSuccess('yes');
        return;
      }

      const { getSdkStatus, initialize, requestPermission, SdkAvailabilityStatus } =
        getHealthConnect();
      const status = await withTimeout(
        getSdkStatus(),
        'Health Connect did not respond. Please try again.'
      );

      if (status === SdkAvailabilityStatus.SDK_UNAVAILABLE) {
        Alert.alert(
          'Health Connect not available',
          'Health Connect is not available on this device. Upgrade your Android version to enable Health Connect.'
        );
        await handleSkip();
        return;
      }

      if (status === SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) {
        await handleSuccess('install');
        return;
      }

      const isInitialized = await withTimeout(
        initialize(),
        'Health Connect did not finish opening. Please try again.'
      );

      if (!isInitialized) {
        Alert.alert('Error initializing Health Connect');
        return;
      }

      const grantedPermissions = await withTimeout(
        requestPermission(healthPermissionsAndroid),
        'Health Connect permissions did not finish. Please try again.',
        HEALTH_CONNECT_PERMISSION_TIMEOUT_MS
      );
      if (grantedPermissions.length === 0) {
        Alert.alert(
          'Permissions not enabled',
          'Health Connect permissions were not enabled. You can connect again later from settings.'
        );
        await handleSkip();
        return;
      }

      setHasPermission(true);
      await handleSuccess('yes');
    } catch (error) {
      console.warn('Health permission request failed:', error);
      Alert.alert(
        'Could not connect Health Connect',
        error instanceof Error
          ? error.message
          : 'Something went wrong while opening Health Connect. Please try again.'
      );
    } finally {
      setIsConnecting(false);
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
      const { getSdkStatus } = getHealthConnect();

      getSdkStatus().then((status) => {
        setSdkStatus(status);
      });
    }
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        if (Platform.OS === 'android') {
          const { getSdkStatus } = getHealthConnect();

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
              You earn points for daily activity. Connect your health data so your steps and active
              minutes count.{' '}
            </Text>

            {/* <View className="mb-2 flex-row">
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
            </View> */}

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleAllow}
              disabled={isConnecting}
              className="mt-6"
              style={{
                backgroundColor: '#F76B1C',
                borderRadius: 9999,
                paddingVertical: 14,
                alignItems: 'center',
                opacity: isConnecting ? 0.7 : 1,
              }}>
              {isConnecting ? (
                <View className="flex-row items-center gap-x-3">
                  <ActivityIndicator color="#FFFFFF" />
                  <Text className="text-2xl font-bold text-white">Connecting</Text>
                </View>
              ) : (
                <Text className="text-2xl font-bold text-white">Connect</Text>
              )}
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
