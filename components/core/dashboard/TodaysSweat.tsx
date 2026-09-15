import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useQuery } from 'convex/react';
import * as ImagePicker from 'expo-image-picker';
import type { PermissionResponse } from 'expo-modules-core';
import { router, useFocusEffect } from 'expo-router';
import {
  CaretRight,
  ArrowLeft,
  ArrowRight,
  Barbell,
  Camera,
  Check,
  CrownSimple,
  Footprints,
  ForkKnife,
  Heartbeat,
  MoonStars,
  PersonArmsSpread,
  PersonSimpleRun,
  SneakerMove,
  Trophy,
  X,
} from 'phosphor-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ComponentType, RefObject } from 'react';
import {
  Alert,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DailyLimitReachedModal, SKIP_DAILY_LIMIT_POPUP_KEY } from './DailyLimitReachedModal';

import CapturePermissionGate from '~/components/core/permissions/CapturePermissionGate';
import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';
import { Id } from '~/convex/_generated/dataModel';
import { useRetainedQueryResult } from '~/hooks/useRetainedQueryResult';
import { useSubscriptionGuard } from '~/hooks/useSubscriptionGuard';
import {
  LOGGED_ACTIVITIES,
  LoggedActivityKey,
  getLoggedActivity,
  getRandomActivityCaption,
} from '~/shared/loggedActivities';
import { useAuthStore } from '~/store/useAuthStore';
import { useTabStore } from '~/store/useTabStore';
import { storage } from '~/utils/storage';
import { formatDateYYYYMMDD } from '~/utils/timezone';

const PRIMARY = '#FF5C35';
const PENDING_HABIT_ACTIVITY_KEY = 'pending_habit_activity_key';
const TODAY_WORKOUT_COMPLETED_CACHE_PREFIX = 'today_workout_completed';
const TODAY_HABIT_COMPLETED_CACHE_PREFIX = 'today_habit_completed';
const TODAY_ACTIVITY_TAB_PREFIX = 'today_activity_tab';

type ActivityTab = 'check_in' | 'quick_log';
type IconComponent = ComponentType<{ size?: number; color?: string; weight?: any }>;

function StrengthIcon({ size = 18, color = PRIMARY }: { size?: number; color?: string }) {
  return <MaterialCommunityIcons name="arm-flex-outline" size={size} color={color} />;
}

function getCheckInIcon(name: string): IconComponent {
  const normalized = name.toLowerCase();
  if (normalized.includes('strength')) return StrengthIcon;
  if (normalized.includes('core')) return Heartbeat;
  if (normalized.includes('cardio')) return PersonSimpleRun;
  if (normalized.includes('jump') || normalized.includes('rope')) return PersonArmsSpread;
  if (normalized.includes('dance')) return SneakerMove;
  return PersonSimpleRun;
}

function getQuickLogIcon(key: LoggedActivityKey): IconComponent {
  if (key === 'gym_workout') return Barbell;
  if (key === 'healthy_meal') return ForkKnife;
  if (key === 'sleep') return MoonStars;
  return Footprints;
}

function SelectableCard({
  title,
  selected,
  completed,
  disabled = false,
  icon: Icon,
  onPress,
}: {
  title: string;
  selected: boolean;
  completed?: boolean;
  disabled?: boolean;
  icon: IconComponent;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.78}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={`${title}${completed ? ', completed' : ''}`}
      disabled={disabled}
      onPress={onPress}
      className="min-h-[64px] flex-1 flex-row items-center rounded-[20px] px-3 py-2"
      style={{
        borderWidth: 1,
        borderColor: '#E3E1DE',
        backgroundColor: disabled ? '#F6F4F2' : '#FFFFFF',
        opacity: disabled ? 0.55 : 1,
      }}>
      <View className="h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#FFF0E8]">
        <Icon size={18} color={completed || disabled ? '#8F8985' : PRIMARY} weight="regular" />
      </View>
      <View className="ml-2 min-w-0 flex-1">
        <Text
          numberOfLines={2}
          className="font-heading text-[13px] font-semibold leading-[18px]"
          style={{ color: completed || disabled ? '#8F8985' : '#1D1B1A' }}>
          {title}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function NextStepRow({
  icon: Icon,
  title,
  detail,
  action,
  onPress,
  divider,
  compactTitle = false,
  disabled = false,
}: {
  icon: IconComponent;
  title: string;
  detail: string;
  action: string;
  onPress: () => void;
  divider?: boolean;
  compactTitle?: boolean;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.72}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      className="min-h-[80px] flex-row items-center py-3"
      style={{
        ...(divider ? { borderBottomWidth: 1, borderBottomColor: '#E9E3DF' } : {}),
        opacity: disabled ? 0.55 : 1,
      }}>
      <View className="h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#FFF0E8]">
        <Icon size={21} color={disabled ? '#807A76' : PRIMARY} weight="regular" />
      </View>
      <View className="ml-3 min-w-0 flex-1 pr-2">
        <Text
          numberOfLines={1}
          ellipsizeMode="tail"
          className={`font-heading font-semibold text-[#1D1B1A] ${compactTitle ? 'text-[13px]' : 'text-sm'}`}>
          {title}
        </Text>
        <Text numberOfLines={1} className="mt-1 font-body text-xs text-[#807A76]">
          {detail}
        </Text>
      </View>
      <Text
        className="font-heading text-xs font-semibold"
        style={{ color: disabled ? '#807A76' : PRIMARY }}>
        {action}
      </Text>
      {!disabled ? (
        <CaretRight size={17} color={PRIMARY} weight="bold" style={{ marginLeft: 8 }} />
      ) : null}
    </TouchableOpacity>
  );
}

function HealthProgressRow({
  icon: Icon,
  value,
  target,
  points,
  unit,
}: {
  icon: IconComponent;
  value: number;
  target: number;
  points: number;
  unit: string;
}) {
  const percent = Math.min(100, Math.max(0, Math.round((value / target) * 100)));
  const roundedValue = Math.round(value);
  return (
    <View className="mt-5 flex-row items-center">
      <View className="h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#FFF0E8]">
        <Icon size={18} color={PRIMARY} weight="regular" />
      </View>
      <View className="ml-3 flex-1">
        <View className="flex-row items-center justify-between">
          <View className="min-w-0 flex-1 flex-row items-baseline pr-2">
            <Text
              className="font-heading text-sm font-semibold text-[#1D1B1A]"
              style={{ fontFamily: 'Inter_600SemiBold' }}>
              {roundedValue.toLocaleString()}
            </Text>
            <Text className="font-body text-xs text-[#807A76]">
              {` / ${target.toLocaleString()} ${unit}`}
            </Text>
          </View>
          <Text style={{ fontFamily: 'Inter_600SemiBold' }} className="text-[13px] text-[#FF4B1F]">
            {Math.floor(points)} {Math.floor(points) === 1 ? 'pt' : 'pts'}
          </Text>
        </View>
        <View className="mt-3 h-[3px] overflow-hidden rounded-full bg-[#EFEAE4]">
          <View className="h-full rounded-full bg-[#F76B1C]" style={{ width: `${percent}%` }} />
        </View>
      </View>
    </View>
  );
}

export default function TodaysSweat({
  refreshKey,
  activityLogTourRef,
  nextStepsTourRef,
  activityTourRef,
}: {
  refreshKey: number;
  streakDays?: number;
  streakTarget?: number;
  activityLogTourRef?: RefObject<View>;
  nextStepsTourRef?: RefObject<View>;
  activityTourRef?: RefObject<View>;
}) {
  const { requireSubscription } = useSubscriptionGuard();
  const currentUser = useAuthStore((state) => state.currentUser);
  const currentTab = useTabStore((state) => state.currentTab);
  const canLoad = Boolean(currentUser?._id);
  const [selectedActivityTab, setSelectedActivityTab] = useState<{
    scope: string;
    tab: ActivityTab;
  } | null>(null);
  const [selectedCheckInId, setSelectedCheckInId] = useState<Id<'challenges'> | null>(null);
  const insets = useSafeAreaInsets();
  const [showHabitDetails, setShowHabitDetails] = useState(false);
  const [showHabitPermission, setShowHabitPermission] = useState(false);
  const [habitCameraPermission, setHabitCameraPermission] = useState<PermissionResponse | null>(
    null
  );
  const [isRequestingHabitPermission, setIsRequestingHabitPermission] = useState(false);
  const launchHabitAfterDismiss = useRef(false);
  const launchHabitAfterPermissionDismiss = useRef(false);
  const habitPermissionCancelled = useRef(false);
  const habitLaunchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (habitLaunchTimer.current) clearTimeout(habitLaunchTimer.current);
    },
    []
  );
  const [selectedQuickLog, setSelectedQuickLog] = useState<LoggedActivityKey>('gym_workout');
  const [isOpeningCamera, setIsOpeningCamera] = useState(false);
  const [showDailyLimitModal, setShowDailyLimitModal] = useState(false);

  const openProgressPhoto = () => {
    if (
      !requireSubscription({
        redirectTo: '/progress-photo',
        source: 'today_progress_photo',
      })
    )
      return;
    router.push('/progress-photo');
  };

  const today = useMemo(
    () => formatDateYYYYMMDD(new Date(), Intl.DateTimeFormat().resolvedOptions().timeZone),
    [refreshKey]
  );
  const dailyCompletionCacheScope = `${currentUser?._id ?? 'guest'}_${today}`;
  const activityTabStorageKey = `${TODAY_ACTIVITY_TAB_PREFIX}_${dailyCompletionCacheScope}`;
  const workoutCompletedCacheKey = `${TODAY_WORKOUT_COMPLETED_CACHE_PREFIX}_${dailyCompletionCacheScope}`;
  const cachedWorkoutCompleted = storage.getBoolean(workoutCompletedCacheKey) ?? false;
  const cachedLoggedActivityKeys = useMemo(
    () =>
      LOGGED_ACTIVITIES.filter(
        (activity) =>
          storage.getBoolean(
            `${TODAY_HABIT_COMPLETED_CACHE_PREFIX}_${dailyCompletionCacheScope}_${activity.key}`
          ) === true
      ).map((activity) => activity.key),
    [dailyCompletionCacheScope]
  );
  const pointsToday = useQuery(
    api.challengeCompletions.getPointsEarnedToday,
    canLoad ? {} : 'skip'
  );
  const dailyChallengeResult = useQuery(api.challengeCompletions.getTodayDailyChallenge, {
    refreshToken: refreshKey,
  });
  const dailyChallenge = useRetainedQueryResult(dailyChallengeResult, dailyCompletionCacheScope);
  const availableCheckInsResult = useQuery(api.challengeCompletions.getAvailableCheckIns, {
    openedChallengeId: dailyChallenge?._id,
    refreshToken: refreshKey,
  });
  const availableCheckIns = useRetainedQueryResult(
    availableCheckInsResult,
    dailyCompletionCacheScope
  );
  const loggedActivityKeysResult = useQuery(
    api.posts.getLoggedActivityKeysToday,
    canLoad ? { refreshToken: refreshKey } : 'skip'
  );
  const loggedActivityKeys = useRetainedQueryResult(
    loggedActivityKeysResult,
    dailyCompletionCacheScope
  );
  const displayedLoggedActivityKeys = loggedActivityKeys ?? cachedLoggedActivityKeys;
  const weeklyProgress = useQuery(api.progressPhotos.getDashboard, canLoad ? {} : 'skip');
  const weeklyProgressLogged = weeklyProgress?.canLogCurrentWeek === false;
  const health = useQuery(api.activities.getPointsForDate, canLoad ? { date: today } : 'skip');

  const visibleCheckIns = useMemo(() => (availableCheckIns ?? []).slice(0, 4), [availableCheckIns]);
  const completedWorkoutFromServer =
    availableCheckIns?.some((item) => item.userCompletedToday) ?? cachedWorkoutCompleted;
  const checkInCompleted = completedWorkoutFromServer;
  const savedActivityTab = storage.getString(activityTabStorageKey);
  const activeTab: ActivityTab = completedWorkoutFromServer
    ? 'quick_log'
    : selectedActivityTab?.scope === dailyCompletionCacheScope
      ? selectedActivityTab.tab
      : savedActivityTab === 'quick_log'
        ? 'quick_log'
        : 'check_in';
  const completedCheckInId = visibleCheckIns.find(
    (item) => item.userCompletedThisCheckIn
  )?.challengeId;
  const selectedCheckIn =
    visibleCheckIns.find((item) => item.challengeId === selectedCheckInId) ?? visibleCheckIns[0];
  const selectedActivity = getLoggedActivity(selectedQuickLog);
  const SelectedHabitIcon = getQuickLogIcon(selectedQuickLog);
  const quickLogCompleted = displayedLoggedActivityKeys.includes(selectedQuickLog);
  const allHabitsCompleted =
    displayedLoggedActivityKeys.length > 0 &&
    LOGGED_ACTIVITIES.every((activity) => displayedLoggedActivityKeys.includes(activity.key));
  const checkInPoints = pointsToday?.checkInPoints ?? 0;
  const dailyChallengeLimitReached = pointsToday?.dailyChallengeLimitReached ?? false;
  const dailyChallengeCompletionCount = pointsToday?.dailyChallengeCompletionCount ?? 0;
  const dailyChallengeLimit = pointsToday?.dailyChallengeLimit ?? 3;

  const openHabitDetails = useCallback((activityKey: LoggedActivityKey) => {
    setSelectedQuickLog(activityKey);

    // Let Android commit the selected habit before mounting its native modal.
    // This avoids a blank/non-opening sheet seen on newer Pixel devices.
    if (Platform.OS === 'android') {
      requestAnimationFrame(() => setShowHabitDetails(true));
      return;
    }

    setShowHabitDetails(true);
  }, []);

  const openHabitPost = useCallback((activityKey: string, asset: ImagePicker.ImagePickerAsset) => {
    const activity = getLoggedActivity(activityKey);
    if (!activity) return;

    router.push({
      pathname: '/posts/new',
      params: {
        activityKey: activity.key,
        activityMode: 'take_photo',
        activityCaption: getRandomActivityCaption(activity.key),
        activityMediaUri: asset.uri,
        activityMediaType: 'image',
        activityMediaWidth: String(asset.width ?? 0),
        activityMediaHeight: String(asset.height ?? 0),
        activityMediaMimeType: asset.mimeType ?? 'image/jpeg',
        activityMediaFileName: asset.fileName ?? '',
      },
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'android') return;

      const pendingActivityKey = storage.getString(PENDING_HABIT_ACTIVITY_KEY);
      if (!pendingActivityKey) return;

      let cancelled = false;
      ImagePicker.getPendingResultAsync()
        .then((pendingResults) => {
          if (cancelled) return;
          if (!pendingResults.length) {
            storage.delete(PENDING_HABIT_ACTIVITY_KEY);
            return;
          }
          storage.delete(PENDING_HABIT_ACTIVITY_KEY);

          const recovered = pendingResults.find(
            (result): result is ImagePicker.ImagePickerSuccessResult =>
              'assets' in result && !result.canceled && Boolean(result.assets[0])
          );
          if (recovered?.assets[0]) {
            openHabitPost(pendingActivityKey, recovered.assets[0]);
            return;
          }

          const failure = pendingResults.find((result) => 'message' in result);
          Alert.alert(
            'Could not recover photo',
            failure && 'message' in failure
              ? failure.message
              : 'Please take your habit proof photo again.'
          );
        })
        .catch((error) => {
          console.warn('Unable to recover pending habit photo:', error);
          storage.delete(PENDING_HABIT_ACTIVITY_KEY);
          Alert.alert('Could not recover photo', 'Please take your habit proof photo again.');
        });

      return () => {
        cancelled = true;
      };
    }, [openHabitPost])
  );

  useEffect(() => {
    if (availableCheckInsResult === undefined) return;
    const completed = availableCheckInsResult.some((item) => item.userCompletedToday);
    if (currentUser?._id) storage.set(workoutCompletedCacheKey, completed);
    if (completed) {
      storage.set(activityTabStorageKey, 'quick_log');
      setSelectedActivityTab({ scope: dailyCompletionCacheScope, tab: 'quick_log' });
    }
  }, [
    activityTabStorageKey,
    availableCheckInsResult,
    currentUser?._id,
    dailyCompletionCacheScope,
    workoutCompletedCacheKey,
  ]);

  useEffect(() => {
    if (!currentUser?._id || loggedActivityKeysResult === undefined) return;
    LOGGED_ACTIVITIES.forEach((activity) => {
      storage.set(
        `${TODAY_HABIT_COMPLETED_CACHE_PREFIX}_${dailyCompletionCacheScope}_${activity.key}`,
        loggedActivityKeysResult.includes(activity.key)
      );
    });
  }, [currentUser?._id, dailyCompletionCacheScope, loggedActivityKeysResult]);

  useEffect(() => {
    if (!visibleCheckIns.length) return;
    const featured = visibleCheckIns.find((item) => item.challengeId === dailyChallenge?._id);
    setSelectedCheckInId((selected) =>
      visibleCheckIns.some((item) => item.challengeId === selected)
        ? selected
        : (featured?.challengeId ?? visibleCheckIns[0].challengeId)
    );
  }, [dailyChallenge?._id, visibleCheckIns]);

  useEffect(() => {
    if (!pointsToday || pointsToday.isPremium || !pointsToday.isCapped) return;
    if (storage.getBoolean(SKIP_DAILY_LIMIT_POPUP_KEY)) return;
    const shownKey = `daily_limit_popup_shown_${today}`;
    if (storage.getBoolean(shownKey)) return;
    storage.set(shownKey, true);
    setShowDailyLimitModal(true);
  }, [pointsToday, today]);

  const openCheckIn = (challengeId: Id<'challenges'>) => {
    setSelectedCheckInId(challengeId);
    if (checkInCompleted) return;
    const redirectTo = `/challenge-view/${challengeId}`;
    if (!requireSubscription({ redirectTo, source: 'today_check_in_category' })) return;
    router.push({
      pathname: '/challenge-view/[challengeId]',
      params: { challengeId },
    });
  };

  const launchQuickLogCamera = async () => {
    if (!selectedActivity || quickLogCompleted || isOpeningCamera) return;
    setIsOpeningCamera(true);
    try {
      storage.set(PENDING_HABIT_ACTIVITY_KEY, selectedActivity.key);
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.7,
        selectionLimit: 1,
      });
      storage.delete(PENDING_HABIT_ACTIVITY_KEY);
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      openHabitPost(selectedActivity.key, asset);
    } catch (error) {
      storage.delete(PENDING_HABIT_ACTIVITY_KEY);
      console.warn('Unable to open activity proof camera:', error);
      Alert.alert('Could not open camera', 'Please try capturing your activity proof again.');
    } finally {
      setIsOpeningCamera(false);
    }
  };

  const continueQuickLog = async () => {
    if (!selectedActivity || quickLogCompleted || isOpeningCamera) return;
    if (!requireSubscription({ redirectTo: '/(tabs)/dashboard', source: 'activity_log_proof' }))
      return;

    try {
      const permission = await ImagePicker.getCameraPermissionsAsync();
      if (permission.granted) {
        await launchQuickLogCamera();
        return;
      }
      setHabitCameraPermission(permission);
      habitPermissionCancelled.current = false;
      setShowHabitPermission(true);
    } catch (error) {
      console.warn('Unable to check habit camera permission:', error);
      Alert.alert('Could not check camera access', 'Please try taking your habit photo again.');
    }
  };

  const grantHabitPermission = async () => {
    if (isRequestingHabitPermission) return;
    setIsRequestingHabitPermission(true);
    try {
      const current = await ImagePicker.getCameraPermissionsAsync();
      if (current.granted) {
        setHabitCameraPermission(current);
        setShowHabitPermission(false);
        if (Platform.OS === 'ios') {
          launchHabitAfterPermissionDismiss.current = true;
        } else {
          if (habitLaunchTimer.current) clearTimeout(habitLaunchTimer.current);
          habitLaunchTimer.current = setTimeout(() => {
            habitLaunchTimer.current = null;
            launchQuickLogCamera();
          }, 350);
        }
        return;
      }

      if (current.status === 'denied' && current.canAskAgain === false) {
        setHabitCameraPermission(current);
        await Linking.openSettings();
        return;
      }

      const latest = await ImagePicker.requestCameraPermissionsAsync();
      setHabitCameraPermission(latest);
      if (!latest.granted || habitPermissionCancelled.current) return;

      setShowHabitPermission(false);
      if (Platform.OS === 'ios') {
        launchHabitAfterPermissionDismiss.current = true;
      } else {
        if (habitLaunchTimer.current) clearTimeout(habitLaunchTimer.current);
        habitLaunchTimer.current = setTimeout(() => {
          habitLaunchTimer.current = null;
          launchQuickLogCamera();
        }, 350);
      }
    } catch (error) {
      console.warn('Unable to grant habit camera permission:', error);
      Alert.alert('Could not request camera access', 'Please try again.');
    } finally {
      setIsRequestingHabitPermission(false);
    }
  };

  const cancelHabitPermission = () => {
    habitPermissionCancelled.current = true;
    setShowHabitPermission(false);
  };

  const habitPermissionPermanentlyDenied =
    habitCameraPermission?.status === 'denied' && habitCameraPermission.canAskAgain === false;

  return (
    <View className="px-5 pb-5 pt-2">
      <View
        ref={activityLogTourRef}
        collapsable={false}
        className="rounded-[24px] bg-white px-4 py-4">
        <View className="flex-row flex-wrap items-center justify-between gap-x-2 gap-y-1">
          <Text className="text-[18px] text-[#1A1A1A]" style={{ fontFamily: 'Inter_700Bold' }}>
            Your Check-ins
          </Text>
          <View className="flex-row items-baseline">
            <Text className="font-heading text-[13px] font-semibold text-[#FF4B1F]">
              {checkInPoints}
            </Text>
            <Text className="ml-1 font-heading text-[12px] font-semibold text-[#FF4B1F]">
              {checkInPoints === 1 ? 'pt' : 'pts'}
            </Text>
          </View>
        </View>

        <View className="mt-2.5 h-12 flex-row rounded-[24px] bg-[#F5F2F0] p-0.5">
          {(
            [
              ['check_in', 'Workout'],
              ['quick_log', 'Habits'],
            ] as const
          ).map(([value, label]) => {
            const selected = activeTab === value;
            const disabled = value === 'check_in' && checkInCompleted;
            const completed =
              value === 'check_in' ? completedWorkoutFromServer : allHabitsCompleted;
            return (
              <TouchableOpacity
                key={value}
                activeOpacity={0.8}
                accessibilityRole="tab"
                accessibilityState={{ selected, disabled }}
                disabled={disabled}
                onPress={() => {
                  storage.set(activityTabStorageKey, value);
                  setSelectedActivityTab({ scope: dailyCompletionCacheScope, tab: value });
                }}
                className="flex-1 items-center justify-center rounded-[20px]"
                style={{
                  backgroundColor: selected ? '#FFFFFF' : 'transparent',
                  opacity: disabled ? 0.45 : 1,
                }}>
                <View className="flex-row items-center gap-x-1.5">
                  <Text
                    className="font-heading text-sm font-semibold"
                    style={{ color: selected ? '#1D1B1A' : '#807A76' }}>
                    {label}
                  </Text>
                  {completed ? <Check size={17} color="#8F8985" weight="bold" /> : null}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <View className="mt-2.5 gap-y-2">
          {activeTab === 'check_in' ? (
            visibleCheckIns.length ? (
              [0, 2]
                .filter((start) => start < visibleCheckIns.length)
                .map((start) => (
                  <View key={start} className="flex-row gap-x-3">
                    {visibleCheckIns.slice(start, start + 2).map((checkIn) => (
                      <SelectableCard
                        key={checkIn.challengeId}
                        title={checkIn.categoryName}
                        icon={getCheckInIcon(checkIn.categoryName)}
                        selected={selectedCheckIn?.challengeId === checkIn.challengeId}
                        completed={completedCheckInId === checkIn.challengeId}
                        disabled={checkInCompleted}
                        onPress={() => openCheckIn(checkIn.challengeId)}
                      />
                    ))}
                    {visibleCheckIns.slice(start, start + 2).length === 1 ? (
                      <View className="flex-1" />
                    ) : null}
                  </View>
                ))
            ) : (
              <View className="min-h-[80px] items-center justify-center rounded-[22px] bg-white px-6">
                <Text className="text-center font-body text-sm text-[#807A76]">
                  No check-in categories are available today.
                </Text>
              </View>
            )
          ) : (
            [0, 2].map((start) => (
              <View key={start} className="flex-row gap-x-3">
                {LOGGED_ACTIVITIES.slice(start, start + 2).map((activity) => {
                  const completed = displayedLoggedActivityKeys.includes(activity.key);
                  return (
                    <SelectableCard
                      key={activity.key}
                      title={activity.title}
                      icon={getQuickLogIcon(activity.key)}
                      selected={selectedQuickLog === activity.key}
                      completed={completed}
                      onPress={() => openHabitDetails(activity.key)}
                    />
                  );
                })}
              </View>
            ))
          )}
        </View>
      </View>

      <View
        ref={nextStepsTourRef}
        collapsable={false}
        className="mt-5 rounded-[24px] bg-white px-5">
        <View className="flex-row items-center justify-between border-b border-[#E9E3DF] py-4">
          <Text className="text-[18px] text-[#1A1A1A]" style={{ fontFamily: 'Inter_700Bold' }}>
            Your Next Steps
          </Text>
        </View>
        <NextStepRow
          icon={Trophy}
          title="Complete a challenge"
          detail={
            dailyChallengeLimitReached
              ? `${dailyChallengeCompletionCount}/${dailyChallengeLimit} completed`
              : 'Earn more points'
          }
          action={dailyChallengeLimitReached ? 'Done today' : 'Open'}
          disabled={pointsToday === undefined || dailyChallengeLimitReached}
          onPress={() => router.push('/(tabs)/hub')}
          divider
        />
        <NextStepRow
          icon={CrownSimple}
          title="View the leaderboard"
          detail="See where you rank"
          action="View"
          onPress={() => {
            router.push('/(tabs)/notifications');
          }}
          divider
        />
        <NextStepRow
          icon={Camera}
          title="Upload a progress photo"
          detail={weeklyProgressLogged ? 'This week is logged' : 'Track your progress weekly'}
          action={weeklyProgressLogged ? 'Logged' : weeklyProgress === undefined ? '…' : 'Add'}
          disabled={weeklyProgress === undefined || weeklyProgressLogged}
          onPress={openProgressPhoto}
          compactTitle
        />
      </View>

      <View
        ref={activityTourRef}
        collapsable={false}
        className="mt-5 rounded-[24px] bg-white px-5 pb-5 pt-4">
        <Text className="text-[18px] text-[#1A1A1A]" style={{ fontFamily: 'Inter_700Bold' }}>
          Your Activity
        </Text>
        <HealthProgressRow
          icon={Footprints}
          value={health?.totalSteps ?? 0}
          target={5000}
          points={health?.stepsPoints ?? 0}
          unit="steps"
        />
        <HealthProgressRow
          icon={Heartbeat}
          value={health?.totalZone2Minutes ?? 0}
          target={30}
          points={health?.zone2Points ?? 0}
          unit="active mins"
        />
      </View>

      <Modal
        transparent
        visible={showHabitDetails}
        animationType="slide"
        presentationStyle="overFullScreen"
        hardwareAccelerated
        statusBarTranslucent
        onRequestClose={() => setShowHabitDetails(false)}
        onDismiss={() => {
          if (launchHabitAfterDismiss.current) {
            launchHabitAfterDismiss.current = false;
            continueQuickLog();
          }
        }}>
        <View className="flex-1 justify-end bg-black/40">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close habit details"
            className="absolute inset-0"
            onPress={() => setShowHabitDetails(false)}
          />
          <View
            accessibilityViewIsModal
            className="rounded-t-[28px] bg-white px-5 pt-2"
            style={{ paddingBottom: Math.max(insets.bottom, 16) + 8, maxHeight: '80%' }}>
            <View className="mb-2 h-1 w-10 self-center rounded-full bg-[#CEC7C2]" />
            <View className="flex-row items-center justify-between">
              <View className="min-w-0 flex-1 flex-row items-center">
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Back to habits"
                  onPress={() => setShowHabitDetails(false)}
                  className="h-11 w-9 items-start justify-center">
                  <View className="h-7 w-7 items-center justify-center rounded-full bg-[#FFF0E8]">
                    <ArrowLeft size={17} color={PRIMARY} weight="bold" />
                  </View>
                </TouchableOpacity>
                <Text className="font-heading text-[11px] font-semibold uppercase tracking-[1px] text-[#FF4B1F]">
                  Log activity
                </Text>
                <View className="ml-2 rounded-full bg-[#F1EFED] px-2.5 py-1">
                  <Text className="font-body text-[10px] font-medium text-[#77716D]">Optional</Text>
                </View>
              </View>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Close habit details"
                onPress={() => setShowHabitDetails(false)}
                className="h-11 w-11 items-center justify-center rounded-full bg-[#F5F2F0]">
                <X size={22} color="#77716D" />
              </TouchableOpacity>
            </View>
            <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
              <Text className="mt-1 font-heading text-[24px] font-semibold text-[#1A1A1A]">
                {quickLogCompleted ? 'Habit logged' : 'Add your proof'}
              </Text>
              <Text className="mt-1.5 font-body text-[13px] leading-[18px] text-[#77716D]">
                {quickLogCompleted
                  ? 'You’ve already logged this habit today.'
                  : selectedActivity?.proof}
              </Text>
              <View className="mt-5 flex-row items-center rounded-[22px] bg-[#FFF9F6] px-3 py-4">
                <View className="mr-3 h-11 w-11 items-center justify-center rounded-[16px] bg-[#FFF0E8]">
                  {quickLogCompleted ? (
                    <Check size={26} color={PRIMARY} weight="bold" />
                  ) : (
                    <SelectedHabitIcon size={26} color={PRIMARY} weight="regular" />
                  )}
                </View>
                <View className="min-w-0 flex-1">
                  <View className="flex-row flex-wrap items-center justify-between gap-x-2 gap-y-1">
                    <Text className="font-heading text-[13px] font-semibold text-[#1A1A1A]">
                      {selectedActivity?.detailTitle}
                    </Text>
                    <Text className="font-heading text-xs font-semibold text-[#FF4B1F]">
                      +{selectedActivity?.basePoints}{' '}
                      {selectedActivity?.basePoints === 1 ? 'pt' : 'pts'}
                    </Text>
                  </View>
                  <Text className="mt-1 font-body text-xs leading-[18px] text-[#77716D]">
                    {selectedActivity?.goal}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={
                  quickLogCompleted ? 'Done' : 'Take live photo, use the in-app camera'
                }
                disabled={isOpeningCamera}
                onPress={() => {
                  setShowHabitDetails(false);
                  if (quickLogCompleted) return;
                  if (Platform.OS === 'ios') {
                    launchHabitAfterDismiss.current = true;
                  } else {
                    habitLaunchTimer.current = setTimeout(() => {
                      continueQuickLog();
                    }, 350);
                  }
                }}
                className="mb-2 mt-3 min-h-[80px] flex-row items-center rounded-[22px] border border-[#E3E1DE] bg-white px-4 py-4">
                <View className="mr-3 h-11 w-11 items-center justify-center rounded-[16px] bg-[#FFF0E8]">
                  {quickLogCompleted ? (
                    <Check size={24} color={PRIMARY} />
                  ) : (
                    <Camera size={24} color={PRIMARY} />
                  )}
                </View>
                <View className="min-w-0 flex-1">
                  <Text className="font-heading text-sm font-semibold text-[#1A1A1A]">
                    {quickLogCompleted ? 'Done' : 'Take live photo'}
                  </Text>
                  {!quickLogCompleted ? (
                    <Text className="mt-1 font-body text-xs text-[#77716D]">
                      Use the in-app camera
                    </Text>
                  ) : null}
                </View>
                <ArrowRight size={22} color={PRIMARY} />
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showHabitPermission}
        animationType="fade"
        presentationStyle="overFullScreen"
        hardwareAccelerated
        statusBarTranslucent
        onRequestClose={cancelHabitPermission}
        onDismiss={() => {
          if (launchHabitAfterPermissionDismiss.current) {
            launchHabitAfterPermissionDismiss.current = false;
            launchQuickLogCamera();
          }
        }}>
        <CapturePermissionGate
          description={
            habitPermissionPermanentlyDenied
              ? 'Camera access is turned off. Enable it in Settings to take a photo for your habit proof.'
              : 'Camera permission is required to take a photo for your habit proof.'
          }
          onGrant={grantHabitPermission}
          onCancel={cancelHabitPermission}
          paddingTop={insets.top}
          loading={isRequestingHabitPermission}
          actionLabel={habitPermissionPermanentlyDenied ? 'Open Settings' : 'Grant Permissions'}
        />
      </Modal>

      <DailyLimitReachedModal
        showAlertDialog={showDailyLimitModal}
        handleClose={() => setShowDailyLimitModal(false)}
        handleUpgrade={() => router.push({ pathname: `/(tabs)/${currentTab}/paywall` as any })}
        cap={pointsToday?.cap ?? 10}
      />
    </View>
  );
}
