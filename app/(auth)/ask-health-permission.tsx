import { Feather } from '@expo/vector-icons';
import { useConvex, useMutation } from 'convex/react';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, AppState, Linking, Platform, View } from 'react-native';

import ScreenLoading from '~/components/core/ScreenLoading';
import {
  PrototypeButton,
  PrototypeError,
  PrototypeOnboarding,
  onboardingStyles,
} from '~/components/core/auth/PrototypeOnboarding';
import {
  prototypeComponents as chrome,
  prototypeTypography as type,
} from '~/components/core/design/prototypeStyles';
import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';
import { useCoachRouteGuard } from '~/hooks/useCoachRouteGuard';
import { useAuthStore } from '~/store/useAuthStore';
import {
  canBypassAppleHealthAvailabilityCheck,
  initializeAppleHealthKit,
  isAppleHealthAvailable,
} from '~/utils/apple-health-kit';
import { resumeMember } from '~/utils/coachResumeNavigation';
import { healthPermissionsAndroid } from '~/utils/constants';
import { storeData } from '~/utils/storage';

const HEALTH_ROUTE = ['health'] as const;

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
  const { accepted } = useCoachRouteGuard(HEALTH_ROUTE);
  const appState = useRef(AppState.currentState);
  const convex = useConvex();
  const [, setHasPermission] = useState(false);
  const [, setSdkStatus] = useState<number | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSkipping, setIsSkipping] = useState(false);
  const [error, setError] = useState('');
  const healthProviderName = Platform.OS === 'ios' ? 'Apple Health' : 'Health Connect';
  const continueAfterHealth = useMutation(api.coachFoundation.continueAfterHealth);
  const updateUserAutoSyncEnabled = useMutation(api.users.updateUserAutoSyncEnabled);
  const setCurrentUser = useAuthStore((state) => state.setCurrentUser);

  const handleAllow = async () => {
    if (isConnecting || isSkipping) return;

    setError('');
    setIsConnecting(true);

    try {
      if (Platform.OS === 'ios') {
        const isAvailable = await isAppleHealthAvailable();
        const canBypassAvailability = canBypassAppleHealthAvailabilityCheck();

        if (!isAvailable) {
          if (!canBypassAvailability) {
            Alert.alert(
              'Apple Health not available',
              'You can continue without health data and connect it later.'
            );
            await handleSkip();
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
        await handleSkip();
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
      await handleSkip();
    } finally {
      setIsConnecting(false);
    }
  };

  const handleSuccess = async (_showSuccess: string) => {
    await continueAfterHealth({ result: 'connected' });
    await updateUserAutoSyncEnabled({ enabled: true });

    storeData('autoSync', { enabled: true });

    const user = await convex.query(api.users.current);
    await setCurrentUser(user);

    await resumeMember(convex);
  };

  const handleSkip = async () => {
    await continueAfterHealth({ result: 'declined' });
    await updateUserAutoSyncEnabled({ enabled: false });

    storeData('autoSync', { enabled: false });

    const user = await convex.query(api.users.current);
    await setCurrentUser(user);

    await resumeMember(convex);
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

  const handleSkipPress = async () => {
    if (isConnecting || isSkipping) return;
    setIsSkipping(true);
    setError('');
    try {
      await handleSkip();
    } catch {
      setError('Could not continue. Please try again.');
    } finally {
      setIsSkipping(false);
    }
  };

  if (!accepted) return <ScreenLoading />;
  const busy = isConnecting || isSkipping;

  return (
    <PrototypeOnboarding
      image={require('~/assets/onboarding/health-watch.jpg')}
      onBack={() => {
        if (!busy)
          router.replace({ pathname: '/coach-onboarding', params: { reviewProfile: '1' } });
      }}
      footer={
        <>
          <PrototypeError error={error} />
          <PrototypeButton
            label={`Connect ${healthProviderName}`}
            onPress={handleAllow}
            loading={isConnecting}
            disabled={isSkipping}
          />
          <PrototypeButton
            label="I'll do this later"
            onPress={handleSkipPress}
            secondary
            loading={isSkipping}
            disabled={isConnecting}
          />
        </>
      }>
      <Text accessibilityRole="header" style={onboardingStyles.heading}>
        Final step
      </Text>
      <Text style={onboardingStyles.subtitle}>
        Connect your health data so your steps and active minutes count toward your points.
      </Text>
      <View style={{ marginTop: 28, flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        <View
          style={{
            ...chrome.iconTile,
          }}>
          <Feather name={Platform.OS === 'ios' ? 'heart' : 'activity'} size={24} color="#e8541e" />
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              ...type.cardTitle,
            }}>
            {healthProviderName}
          </Text>
          <Text
            style={{
              marginTop: 2,
              ...type.caption,
            }}>
            Steps · Active minutes
          </Text>
        </View>
        <View
          style={{
            borderRadius: 14,
            backgroundColor: '#eaf6ee',
            paddingHorizontal: 12,
            paddingVertical: 6,
          }}>
          <Text style={[type.badge, { color: '#2f7d4f' }]}>SECURE</Text>
        </View>
      </View>
      <View style={{ marginTop: 24, flexDirection: 'row', gap: 10, alignItems: 'center' }}>
        <Feather name="shield" size={20} color="#8a8a8a" />
        <Text
          style={{
            flex: 1,
            ...type.caption,
          }}>
          Your health data is private and only used to calculate activity.
        </Text>
      </View>
    </PrototypeOnboarding>
  );
}
