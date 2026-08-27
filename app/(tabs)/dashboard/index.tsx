import { useIsFocused } from '@react-navigation/native';
import { useMutation, useQuery } from 'convex/react';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import * as Icon from 'phosphor-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState,
  Dimensions,
  Linking,
  Platform,
  RefreshControl,
  ScrollView,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '~/components/core/Avatar';
import SafeAreaView from '~/components/core/SafeAreaView';
import AchievementPopupManager from '~/components/core/dashboard/AchievementPopupManager';
import CommunityGroupPreviewCard from '~/components/core/dashboard/CommunityGroupPreviewCard';
import Confetti from '~/components/core/dashboard/Confetti';
import DailyChallengeCard from '~/components/core/dashboard/DailyChallengeCard';
import { FirstTimeOnboardingModal } from '~/components/core/dashboard/FirstTimeOnboardingModal';
import { MyCardAlertDialog } from '~/components/core/dashboard/MyCard';
import TodayFeatureTour, { TodayTourTarget } from '~/components/core/dashboard/TodayFeatureTour';
import TodaysSweat from '~/components/core/dashboard/TodaysSweat';
// import WeeklyStreakCard from '~/components/core/dashboard/WeeklyStreakCard';
import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';
import { Id } from '~/convex/_generated/dataModel';
import { useAppVersionStatus } from '~/hooks/useAppVersionStatus';
import { useHealthSync } from '~/hooks/useHealthSync';
import { useRefreshStore } from '~/store/useRefreshStore';
import { CatchPromise } from '~/utils/catch-promise';
import { colors } from '~/utils/constants';
import { storage } from '~/utils/storage';

function getHealthConnect() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('react-native-health-connect') as typeof import('react-native-health-connect');
}

/*
 * Increment this only when the Today experience changes enough that both new
 * and upgrading users should be guided through it again. MMKV survives normal
 * app updates, so users who have seen an older version will receive this tour
 * once, while users who finish this version will not see it on every launch.
 */
const TODAY_FEATURE_TOUR_VERSION = 2;
const TODAY_FEATURE_TOUR_STORAGE_KEY = 'today_feature_tour_seen_version';
const TODAY_FEATURE_TOUR_STEP_COUNT = 3;

function getTodayFeatureTourStorageKey(userId: string) {
  return `${TODAY_FEATURE_TOUR_STORAGE_KEY}_${userId}`;
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
  const isFocused = useIsFocused();
  const dashboardScrollRef = useRef<ScrollView>(null);
  const scrollOffsetRef = useRef(0);
  const checkInTourRef = useRef<View>(null);
  const communityTourRef = useRef<View>(null);
  const activityLogTourRef = useRef<View>(null);
  const sectionOffsetsRef = useRef({ community: 0 });
  const incrementRefreshKey = useRefreshStore((state) => state.incrementRefreshKey);
  const refreshKey = useRefreshStore((state) => state.refreshKey);
  const [showFirstTimeModal, setShowFirstTimeModal] = useState(false);
  const [showInstallDialog, setShowInstallDialog] = useState(false);
  const [todayTourStep, setTodayTourStep] = useState<number | null>(null);
  const [todayTourTarget, setTodayTourTarget] = useState<TodayTourTarget | null>(null);
  const currentUser = useQuery(api.users.current);
  const rewardsBanner = useQuery(api.admin.getRewardsBanner);
  const yearMonth = useMemo(() => {
    const today = new Date();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    return `${today.getFullYear()}-${month}`;
  }, [refreshKey]);
  const leaderboard = useQuery(api.activities.getUserLeaderboardPosition, { yearMonth });
  const streakData = useQuery(api.challengeCompletions.getUserStreaksForMonth);
  const trackOverview = useQuery(
    api.track.queries.getTrackOverview,
    currentUser?._id ? {} : 'skip'
  );
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
  const now = new Date();
  const greeting =
    now.getHours() < 12 ? 'Good morning' : now.getHours() < 17 ? 'Good afternoon' : 'Good evening';
  const formattedDate = now
    .toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })
    .toUpperCase();

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
      // Push tokens are unavailable in simulators; skip silently so local QA is uninterrupted.
      return;
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
    } catch {
      // Keep the existing dashboard data visible when a manual health refresh fails.
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

  useEffect(() => {
    if (
      !isFocused ||
      !currentUser?._id ||
      showSuccess ||
      showFirstTimeModal ||
      showInstallDialog ||
      todayTourStep !== null
    ) {
      return;
    }

    const storageKey = getTodayFeatureTourStorageKey(currentUser._id);
    const seenVersion = storage.getNumber(storageKey) ?? 0;
    if (seenVersion >= TODAY_FEATURE_TOUR_VERSION) return;

    const timer = setTimeout(() => setTodayTourStep(0), 900);
    return () => clearTimeout(timer);
  }, [
    currentUser?._id,
    isFocused,
    showFirstTimeModal,
    showInstallDialog,
    showSuccess,
    todayTourStep,
  ]);

  useEffect(() => {
    if (!isFocused || todayTourStep === null) {
      setTodayTourTarget(null);
      return;
    }

    let cancelled = false;
    let measureTimer: ReturnType<typeof setTimeout> | undefined;
    const targetRefs = [checkInTourRef, communityTourRef, activityLogTourRef];
    const targetRef = targetRefs[todayTourStep];

    setTodayTourTarget(null);

    if (todayTourStep === 0) {
      dashboardScrollRef.current?.scrollTo({ y: 0, animated: true });
    } else if (todayTourStep === 1) {
      dashboardScrollRef.current?.scrollTo({
        y: Math.max(0, sectionOffsetsRef.current.community - 110),
        animated: true,
      });
    } else {
      dashboardScrollRef.current?.scrollToEnd({ animated: true });
    }

    const measureTarget = (attempt: number) => {
      measureTimer = setTimeout(
        () => {
          if (cancelled || !targetRef.current) return;

          targetRef.current.measureInWindow((x, y, width, height) => {
            if (cancelled) return;

            if ((width < 40 || height < 40) && attempt < 8) {
              measureTarget(attempt + 1);
              return;
            }

            const screenHeight = Dimensions.get('window').height;
            const desiredTop = Math.max(insets.top + 84, 120);
            const isOutsideViewport =
              y < insets.top + 8 || y + height > screenHeight - insets.bottom - 24;

            if (isOutsideViewport && attempt < 8) {
              dashboardScrollRef.current?.scrollTo({
                y: Math.max(0, scrollOffsetRef.current + y - desiredTop),
                animated: true,
              });
              measureTarget(attempt + 1);
              return;
            }

            setTodayTourTarget({ x, y, width, height });
          });
        },
        attempt === 0 ? 480 : 240
      );
    };

    measureTarget(0);

    return () => {
      cancelled = true;
      if (measureTimer) clearTimeout(measureTimer);
    };
  }, [insets.bottom, insets.top, isFocused, todayTourStep]);

  const finishTodayTour = () => {
    if (currentUser?._id) {
      storage.set(getTodayFeatureTourStorageKey(currentUser._id), TODAY_FEATURE_TOUR_VERSION);
    }
    setTodayTourStep(null);
    setTodayTourTarget(null);
  };

  const advanceTodayTour = () => {
    if (todayTourStep === null || todayTourStep >= TODAY_FEATURE_TOUR_STEP_COUNT - 1) {
      finishTodayTour();
      return;
    }

    setTodayTourStep(todayTourStep + 1);
  };

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
          ref={dashboardScrollRef}
          className="flex-1"
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={(event) => {
            scrollOffsetRef.current = event.nativeEvent.contentOffset.y;
          }}
          contentContainerStyle={{ flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}>
          <View
            className="flex-1 flex-col bg-[#F9F9F9]"
            style={Platform.OS === 'android' ? { paddingTop: insets.top } : undefined}>
            <View className="px-5 pb-3 pt-3">
              <View className="flex-row items-center justify-between">
                <View className="min-w-0 flex-1 pr-4">
                  <Text className="font-heading text-[10px] font-extrabold tracking-[1.1px] text-[#FF4B1F]">
                    TODAY · {formattedDate}
                  </Text>
                  <Text
                    numberOfLines={1}
                    className="mt-1 font-heading text-[23px] font-extrabold leading-7 text-[#1A1A1A]">
                    {greeting}, {currentUser?.name?.split(' ')[0] ?? 'there'}
                  </Text>
                </View>
                <Avatar
                  uri={currentUser?.image ?? undefined}
                  size={44}
                  goToSettings
                  name={currentUser?.name}
                />
              </View>
            </View>
            <View ref={checkInTourRef} collapsable={false} className="bg-[#F9F9F9]">
              <DailyChallengeCard />
            </View>
            <View
              ref={communityTourRef}
              collapsable={false}
              className="mt-3 bg-[#F9F9F9]"
              onLayout={(event) => {
                sectionOffsetsRef.current.community = event.nativeEvent.layout.y;
              }}>
              <CommunityGroupPreviewCard />
            </View>
            <View className="mt-3 bg-[#F9F9F9]">
              <TodaysSweat
                refreshKey={refreshKey}
                streakDays={streakData?.currentWeekDays ?? 0}
                activityLogTourRef={activityLogTourRef}
              />
            </View>
            {/* <View className="mb-10 mt-4 bg-[#F9F9F9]">
              <WeeklyStreakCard />
            </View> */}
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

            <View style={{ height: showUpdateBanner ? 96 : 52 }} />
          </View>
        </ScrollView>
      </SafeAreaView>

      <TodayFeatureTour
        step={todayTourStep}
        target={todayTourTarget}
        onNext={advanceTodayTour}
        onSkip={finishTodayTour}
      />
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

      {currentUser?._id ? (
        <AchievementPopupManager
          key={currentUser._id}
          userId={currentUser._id}
          yearMonth={yearMonth}
          monthlyPoints={
            leaderboard === undefined ? undefined : (leaderboard.displayTotalPoints ?? 0)
          }
          monthlyChallengeTarget={
            rewardsBanner === undefined || rewardsBanner === null
              ? undefined
              : (rewardsBanner.targetPoints ?? 500)
          }
          lifetimePoints={trackOverview?.lifetime.points}
          currentWeeklyStreak={trackOverview?.lifetime.currentWeeklyStreak}
          enabled={
            showSuccess !== 'yes' &&
            showSuccess !== 'install' &&
            !showFirstTimeModal &&
            !showInstallDialog &&
            todayTourStep === null
          }
        />
      ) : null}

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
