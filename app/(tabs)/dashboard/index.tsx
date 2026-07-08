import { useMutation, useQuery } from 'convex/react';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import * as Icon from 'phosphor-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Linking,
  RefreshControl,
  ScrollView,
  View,
  Platform,
  AppState,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '~/components/core/Avatar';
import SafeAreaView from '~/components/core/SafeAreaView';
import Confetti from '~/components/core/dashboard/Confetti';
import { FirstTimeOnboardingModal } from '~/components/core/dashboard/FirstTimeOnboardingModal';
import MonthlyProgressCard from '~/components/core/dashboard/MonthlyProgressCard';
import MoveWithUs from '~/components/core/dashboard/MoveWithUs';
import WeeklyStreakCard from '~/components/core/dashboard/WeeklyStreakCard';
import { MyCardAlertDialog } from '~/components/core/dashboard/MyCard';
import TodaysSweat from '~/components/core/dashboard/TodaysSweat';
import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';
import { Id } from '~/convex/_generated/dataModel';
import { useAppVersionStatus } from '~/hooks/useAppVersionStatus';
import { useHealthSync } from '~/hooks/useHealthSync';
import { useRefreshStore } from '~/store/useRefreshStore';
import { CatchPromise } from '~/utils/catch-promise';
import { colors } from '~/utils/constants';
import { storage } from '~/utils/storage';
import DailyChallengeCard from '~/components/core/dashboard/DailyChallengeCard';

function getHealthConnect() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('react-native-health-connect') as typeof import('react-native-health-connect');
}

function getCurrentWeekMondayStr(): string {
  const now = new Date();
  const dow = now.getDay();
  const offset = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(now);
  monday.setDate(now.getDate() + offset);
  return monday.toISOString().split('T')[0];
}

async function openHealthConnectListing() {
  const marketUrl = 'market://details?id=com.google.android.apps.healthdata';
  const webUrl = 'https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata';

  try {
    const canOpenMarket = await Linking.canOpenURL(marketUrl);
    await Linking.openURL(canOpenMarket ? marketUrl : webUrl);
  } catch (error) {
    console.warn('Failed to open Health Connect listing:', error);
  }
}

export default function TabDashboard() {
  const appState = useRef(AppState.currentState);
  const { showSuccess } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const incrementRefreshKey = useRefreshStore((state) => state.incrementRefreshKey);
  const refreshKey = useRefreshStore((state) => state.refreshKey);
  const [showFirstTimeModal, setShowFirstTimeModal] = useState(false);
  const [showInstallDialog, setShowInstallDialog] = useState(false);
  const currentUser = useQuery(api.users.current);
  const rewardsBanner = useQuery(api.admin.getRewardsBanner);
  const yearMonth = useMemo(() => {
    const today = new Date();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    return `${today.getFullYear()}-${month}`;
  }, [refreshKey]);
  const leaderboard = useQuery(api.activities.getUserLeaderboardPosition, { yearMonth });
  const streakData = useQuery(api.challengeCompletions.getUserStreaksForMonth);
  const [confettiTrigger, setConfettiTrigger] = useState(0);
  const { syncAllMissedDays } = useHealthSync(
    currentUser?._id as Id<'users'>,
    undefined, // timezone will use default
    currentUser?.birthdate
  );
  const updateExpoPushToken = useMutation(api.users.updateExpoPushToken);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const { status: appVersionStatus } = useAppVersionStatus();
  const showUpdateBanner = appVersionStatus === 'update_available';

  const updatePushToken = async () => {
    let token;
    if (Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();

      if (existingStatus !== 'granted') {
        return;
      }

      token = await Notifications.getExpoPushTokenAsync({
        projectId: Constants.expoConfig?.extra?.eas.projectId,
      });
    } else {
      alert('Must be using a physical device for Push notifications');
    }

    if (token && token.data) {
      await CatchPromise(updateExpoPushToken({ expoPushToken: token.data }));
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);

    try {
      await syncAllMissedDays();
      incrementRefreshKey();
    } catch (error) {
    } finally {
      setIsRefreshing(false);
    }
  };

  const checkAvailability = async () => {
    if (Platform.OS !== 'android') return;

    const { getSdkStatus, SdkAvailabilityStatus } = getHealthConnect();
    const status = await getSdkStatus();
    if (status === SdkAvailabilityStatus.SDK_AVAILABLE) {
      return;
    }

    if (status === SdkAvailabilityStatus.SDK_UNAVAILABLE) {
      return;
    }

    if (status === SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) {
      setShowInstallDialog(true);
    }
  };

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        syncAllMissedDays().then(() => {
          incrementRefreshKey();
        });
      }

      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (showSuccess === 'yes') {
      // Wait until all data the modal needs is ready
      if (!currentUser || !rewardsBanner || !streakData) return;
      setShowFirstTimeModal(true);
      // Clear the route param so this effect doesn't fire again on
      // reactive query updates or when the user navigates back to this tab.
      router.setParams({ showSuccess: undefined });
    } else if (showSuccess === 'install' && Platform.OS === 'android') {
      checkAvailability();
      router.setParams({ showSuccess: undefined });
    }
  }, [showSuccess, currentUser, rewardsBanner, streakData]);

  // Sync is now handled by tab press listener in _layout.tsx
  // This prevents duplicate sync calls that were blocking UI

  useEffect(() => {
    updatePushToken();
  }, []);

  useEffect(() => {
    if (!streakData) return;
    if (streakData.currentWeekDays < streakData.currentWeekTarget) return;
    const key = `weekly_streak_confetti_${getCurrentWeekMondayStr()}`;
    if (storage.getBoolean(key)) return;
    storage.set(key, true);
    setConfettiTrigger((t) => t + 1);
  }, [streakData?.currentWeekDays, streakData?.currentWeekTarget]);

  return (
    <>
      <SafeAreaView className="flex-1 bg-white">
        <Stack.Screen
          options={{
            headerShown: false,
            headerShadowVisible: false,
          }}
        />
        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}>
          <View
            className="flex-1 flex-col bg-[#F9F9F9]"
            style={Platform.OS === 'android' ? { paddingTop: insets.top } : undefined}>
            <View className="flex-row items-center justify-between px-12 py-6">
              <View>
                <Text className="font-body text-base text-[#1A1A1A]">
                  {new Date().getHours() < 12
                    ? 'Good morning'
                    : new Date().getHours() < 17
                      ? 'Good afternoon'
                      : 'Good evening'}
                </Text>
                <Text className="font-heading text-2xl font-bold text-[#1A1A1A]">
                  {currentUser?.name?.split(' ')[0]}
                </Text>
              </View>
              <View>
                <Avatar uri={currentUser?.image ?? undefined} size={56} goToSettings />
              </View>
            </View>
            <View className="bg-[#F9F9F9]">
              <DailyChallengeCard />
            </View>
            <View className=" pv-5 mt-5 bg-[#F9F9F9]">
              <TodaysSweat refreshKey={refreshKey} />
            </View>
            <View className="mb-10 mt-4 bg-[#F9F9F9]">
              <WeeklyStreakCard />
            </View>
            {/* <View className="mt-4 bg-[#F9F9F9] px-5">
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => router.push('/(tabs)/dashboard/workouts')}
                className="my-4 overflow-hidden rounded-2xl"
                style={{
                  shadowColor: '#F97316',
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 0.18,
                  shadowRadius: 12,
                  elevation: 5,
                }}>
                <LinearGradient
                  colors={['#F97316', '#FB923C']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  className="rounded-2xl p-5">
                  <View className="flex-row items-center justify-between">
                    <View className="flex-1 pr-4">
                      <Text className="text-xl font-bold text-white">Learn from Creators</Text>

                      <Text className="mt-1 text-sm font-medium text-white/85">
                        Browse expert workouts made for you
                      </Text>
                    </View>

                    <View className="h-11 w-11 items-center justify-center rounded-full bg-white/20">
                      <ArrowRight size={22} color="white" weight="bold" />
                    </View>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            </View> */}
            {/* <View className="mb-5 mt-4 bg-[#F9F9F9]">
              <MoveWithUs />
            </View> */}

            {showUpdateBanner ? <View style={{ height: 64 }} /> : null}
          </View>
        </ScrollView>
      </SafeAreaView>
      {/* Floating Action Button */}
      {/* <TouchableOpacity
        onPress={() => {
          Linking.openURL('https://chat.whatsapp.com/EHAMrBMwny38j2besHjFew');
        }}
        activeOpacity={0.8}
        style={{
          transform: [{ rotate: '-90deg' }],
          position: 'absolute',
          bottom: 10, // adjust as needed
          right: 24, // adjust as needed
          backgroundColor: colors.primary,
          width: 50,
          height: 50,
          borderRadius: 25,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.2,
          shadowRadius: 4,
          elevation: 5,
          zIndex: 100, // ensure it's above other content
        }}>
        <ChatCircle size={36} color="#fff" weight="fill" />
      </TouchableOpacity> */}

      <FirstTimeOnboardingModal
        showAlertDialog={showFirstTimeModal}
        handleClose={() => setShowFirstTimeModal(false)}
        firstName={currentUser?.name?.split(' ')[0] ?? 'there'}
        challengeName={rewardsBanner?.title ?? ''}
        targetPoints={rewardsBanner?.targetPoints ?? 500}
        currentPoints={leaderboard?.displayTotalPoints ?? 0}
        missionTarget={10}
      />

      <MyCardAlertDialog
        showAlertDialog={showInstallDialog}
        handleClose={() => setShowInstallDialog(false)}
        handlePrimaryButtonPress={() => {
          openHealthConnectListing();
        }}
        title="Install Health Connect"
        body="To track your movement and earn Sweat Points, you’ll need to install Health Connect."
        primaryButtonText="Install"
        icon={<Icon.Heart size={16} weight="fill" color="white" />}
        iconBgColor={colors.primary}
      />

      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 9999,
          elevation: 9999,
        }}>
        <Confetti trigger={confettiTrigger} />
      </View>
    </>
  );
}
