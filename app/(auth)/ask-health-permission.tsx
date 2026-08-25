import { Feather } from '@expo/vector-icons';
import { useConvex, useMutation } from 'convex/react';
import { Image } from 'expo-image';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  AppState,
  Linking,
  Platform,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OnboardingHeroChrome } from '~/components/core/auth/OnboardingHeroChrome';
import { OnboardingPrimaryButton } from '~/components/core/auth/OnboardingPrimaryButton';
import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';
import { useAuthStore } from '~/store/useAuthStore';
import {
  canBypassAppleHealthAvailabilityCheck,
  initializeAppleHealthKit,
  isAppleHealthAvailable,
} from '~/utils/apple-health-kit';
import { healthPermissionsAndroid } from '~/utils/constants';
import { hasPendingRevenueCatRedemption } from '~/utils/revenuecatRedemption';
import { storeData } from '~/utils/storage';

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
  const { height: windowHeight } = useWindowDimensions();
  const [, setHasPermission] = useState(false);
  const [, setSdkStatus] = useState<number | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const healthProviderName = Platform.OS === 'ios' ? 'Apple Health' : 'Health Connect';
  const heroHeight = Math.min(Math.max(windowHeight * 0.53, 390), 475);
  const updateOnboarded = useMutation(api.users.updateOnboarded);
  const updateUserAutoSyncEnabled = useMutation(api.users.updateUserAutoSyncEnabled);
  const setCurrentUser = useAuthStore((state) => state.setCurrentUser);

  const handleAllow = async () => {
    if (isConnecting) return;

    setIsConnecting(true);

    try {
      if (Platform.OS === 'ios') {
        const isAvailable = await isAppleHealthAvailable();
        const canBypassAvailability = canBypassAppleHealthAvailabilityCheck();

        if (!isAvailable) {
          if (!canBypassAvailability) {
            Alert.alert('Apple Health not available');
            return;
          }

          setHasPermission(true);
          await handleSuccess('yes');
          return;
        }

        const hasPermissions = await initializeAppleHealthKit();
        if (!hasPermissions) {
          Alert.alert(
            'Permissions not enabled',
            'Apple Health permissions were not enabled. Please allow Steps and Heart Rate for SweatScore in iOS Settings, then try again.',
            [
              { text: 'Not now', style: 'cancel' },
              { text: 'Open Settings', onPress: () => Linking.openSettings() },
            ]
          );
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
        'Could not connect health data',
        error instanceof Error
          ? error.message
          : 'Something went wrong while opening health permissions. Please try again.'
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

    if (hasPendingRevenueCatRedemption()) {
      return;
    }

    router.dismissAll();
    router.replace({
      pathname: '/(tabs)/dashboard',
      params: { showSuccess },
    });
  };

  const handleSkip = async () => {
    await updateOnboarded({ onboarded: true });
    await updateUserAutoSyncEnabled({ enabled: false });

    storeData('autoSync', { enabled: false });

    const user = await convex.query(api.users.current);
    await setCurrentUser(user);

    if (hasPendingRevenueCatRedemption()) {
      return;
    }

    router.dismissAll();
    router.replace('/(tabs)/dashboard');
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
      <StatusBar style="light" />

      <Image
        source={require('~/assets/onboarding/healthscreen-clean-v2.png')}
        contentFit="cover"
        style={{ position: 'absolute', top: 0, right: 0, left: 0, height: heroHeight }}
      />

      <OnboardingHeroChrome activeStep={6} onBack={router.back} />

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
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 28, paddingBottom: 8 }}>
          <View className="h-10 w-10 items-center justify-center rounded-xl bg-[#FFF0E8]">
            <Feather name="heart" size={20} color="#FF5C1A" />
          </View>

          <Text className="mt-3 font-body text-xs font-bold uppercase tracking-[1.5px] text-primary-500">
            Every move deserves credit
          </Text>
          <Text className="mt-2 font-heading text-3xl font-bold leading-9 text-[#1A1A1A]">
            Let&apos;s track your sweat
          </Text>
          <Text className="mt-2 font-body text-sm leading-5 text-[#838383]">
            Connect your health data so your steps and active minutes count toward your points.
          </Text>

          <View className="mt-3 h-[62px] flex-row items-center rounded-2xl border border-[#E8DDD6] bg-[#FFF9F6] px-3">
            <View className="h-10 w-10 items-center justify-center rounded-xl bg-primary-500">
              <Feather name="heart" size={20} color="#FFFFFF" />
            </View>
            <View className="ml-3 flex-1">
              <Text className="font-body text-sm font-bold text-[#1A1A1A]">
                {healthProviderName}
              </Text>
              <Text className="mt-0.5 font-body text-xs text-[#838383]">
                Steps · Active minutes
              </Text>
            </View>
            <View className="rounded-full bg-[#EAF7EC] px-2.5 py-1">
              <Text className="font-body text-[10px] font-bold uppercase text-[#4D8B59]">
                Secure
              </Text>
            </View>
          </View>

          <View className="mt-3 flex-row items-center px-1">
            <Feather name="shield" size={16} color="#FF5C1A" />
            <Text className="ml-2 flex-1 font-body text-xs leading-4 text-[#838383]">
              Your health data is private and only used to calculate activity.
            </Text>
          </View>

          <OnboardingPrimaryButton
            label={`Connect ${healthProviderName}`}
            onPress={handleAllow}
            isLoading={isConnecting}
            className="mt-4"
          />

          <TouchableOpacity
            accessibilityRole="button"
            activeOpacity={0.7}
            disabled={isConnecting}
            onPress={handleSkip}
            className="mt-2 h-14 items-center justify-center rounded-[17px] border border-[#E8DDD6] bg-white px-[22px]">
            <Text className="font-heading text-base font-bold text-[#1A1A1A]">
              I&apos;ll do this later
            </Text>
          </TouchableOpacity>
        </ScrollView>

        <SafeAreaView edges={['bottom']} />
      </View>
    </View>
  );
}
