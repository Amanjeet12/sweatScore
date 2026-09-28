import { useMutation, useQuery } from 'convex/react';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import {
  ArrowRight,
  Barbell,
  Camera,
  Check,
  Footprints,
  ForkKnife,
  Heartbeat,
  LockSimple,
  MoonStars,
  ShareNetwork,
} from 'phosphor-react-native';
import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '~/components/core/Avatar';
import CoachActionButton from '~/components/core/CoachActionButton';
import SafeAreaView from '~/components/core/SafeAreaView';
import ScreenLoading from '~/components/core/ScreenLoading';
import CoachCheckInFlow from '~/components/core/dashboard/CoachCheckInFlow';
import { checkInPostRoute } from '~/shared/coachCheckInPresentation';
import TodayWeeklyStreak from '~/components/core/dashboard/TodayWeeklyStreak';
import { useRevenueCat } from '~/components/providers/RevenueCatProvider';
import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';
import { Id } from '~/convex/_generated/dataModel';
import { useCoachRouteGuard } from '~/hooks/useCoachRouteGuard';
import { useHealthSync } from '~/hooks/useHealthSync';
import { TARGETS } from '~/shared/activityGoals';
import { COACH_CATEGORIES, CoachCategory } from '~/shared/coachFoundation';
import {
  activityProgressFraction,
  planBannerLabel,
  planBannerState,
  todayTiles,
  displayStepTarget,
  TODAY_PROGRESS_ROUTES,
  progressCardWeek,
} from '~/shared/coachToday';
import { useRefreshStore } from '~/store/useRefreshStore';

const ORANGE = '#FF5C35';
const ICONS = { workout: Barbell, meals: ForkKnife, sleep: MoonStars, steps: Footprints } as const;
const LABELS = { workout: 'Workout', meals: 'Meals', sleep: 'Sleep', steps: 'Steps' } as const;
const TODAY_ROUTE = ['today'] as const;

function localRemaining(nextMidnightAt: number, now: number) {
  const seconds = Math.max(0, Math.ceil((nextMidnightAt - now) / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${String(minutes).padStart(2, '0')}m left today`;
}
function photoDate(weekStart: string) {
  const [year, month, day] = weekStart.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export default function TodayScreen() {
  const { accepted, decision } = useCoachRouteGuard(TODAY_ROUTE);
  const dayRefresh = decision ? Number(decision.day.replaceAll('-', '')) : 0;
  const currentUser = useQuery(api.users.current, accepted ? {} : 'skip');
  const plan = useQuery(
    api.revenueCatEntitlements.myPlan,
    accepted ? { refresh: dayRefresh } : 'skip'
  );
  const beginPlanSetup = useMutation(api.coachFoundation.beginReturningPlanSetup);
  const checkIns = useQuery(api.coachCheckIns.myToday, accepted ? { refresh: dayRefresh } : 'skip');
  const banner = useQuery(api.coachToday.myBanner, accepted ? { refresh: dayRefresh } : 'skip');
  const progress = useQuery(
    api.progressPhotos.getDashboard,
    accepted && plan?.access ? {} : 'skip'
  );
  const activity = useQuery(
    api.activities.getPointsForDate,
    accepted && decision ? { date: decision.day } : 'skip'
  );
  const streak = useQuery(
    api.challengeCompletions.getUserStreaksForMonth,
    accepted ? { refresh: dayRefresh } : 'skip'
  );
  const points = useQuery(
    api.challengeCompletions.getPointsEarnedToday,
    accepted ? { refresh: dayRefresh } : 'skip'
  );
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const planBannerWidth = screenWidth - 40;
  const incrementRefreshKey = useRefreshStore((state) => state.incrementRefreshKey);
  const { syncAllMissedDays } = useHealthSync(
    currentUser?._id as Id<'users'>,
    undefined,
    currentUser?.birthdate
  );
  const [refreshing, setRefreshing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [openingSetup, setOpeningSetup] = useState(false);
  const openingSetupRef = useRef(false);
  const [setupError, setSetupError] = useState('');
  const [restoreMessage, setRestoreMessage] = useState('');
  const [activeCheckIn, setActiveCheckIn] = useState<CoachCategory | null>(null);
  const { checkIn } = useLocalSearchParams<{ checkIn?: string }>();
  const [checkInExpanded, setCheckInExpanded] = useState(false);
  const [checkInPreferredHeight, setCheckInPreferredHeight] = useState(0);
  const { restorePermissions } = useRevenueCat();
  const [now, setNow] = useState(Date.now());
  const [reduceMotion, setReduceMotion] = useState(true);
  useEffect(() => {
    const selected = COACH_CATEGORIES.find((item) => item === checkIn);
    if (!selected || !plan?.access) return;
    setCheckInPreferredHeight(0);
    setActiveCheckIn(selected);
    router.setParams({ checkIn: undefined });
  }, [checkIn, plan?.access]);
  const arrowOffset = useRef(new Animated.Value(0)).current;
  const bannerState = plan
    ? planBannerState({
        access: plan.access,
        requestStatus: plan.requestStatus,
        hasPlan: Boolean(plan.plan),
        canRetry: plan.canRetry,
      })
    : 'pending';
  const tiles = todayTiles(checkIns?.status === 'ready' ? checkIns.assignments : undefined);
  const stepAssignment = checkIns?.assignments.find((item) => item.category === 'steps');
  const stepTarget = displayStepTarget(stepAssignment);
  const numericStepTarget = stepAssignment?.stepTarget;
  const activeMinuteTarget = TARGETS.week.activeMinutes;
  const firstName = currentUser?.name?.trim().split(' ')[0] || 'there';
  const hour = Number(
    new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      hourCycle: 'h23',
      timeZone: currentUser?.timezone || 'UTC',
    }).format(new Date(now))
  );
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const photos = progress?.photos ?? [];
  const firstPhoto = photos[0];
  const latestPhoto = photos.length > 1 ? photos[photos.length - 1] : undefined;
  const canLogProgress = Boolean(progress?.canLogCurrentWeek);
  const progressWeek = progressCardWeek(photos.length, canLogProgress);
  const canShareProgress = Boolean(firstPhoto?.frontUrl && latestPhoto?.frontUrl);
  const nextPhotoAvailable = Boolean(
    firstPhoto && !latestPhoto && progressWeek > 1 && canLogProgress
  );

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setReduceMotion)
      .catch(() => {});
    const listener = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      clearInterval(timer);
      listener.remove();
    };
  }, []);
  useEffect(() => {
    arrowOffset.stopAnimation();
    arrowOffset.setValue(0);
    if (bannerState !== 'no_plan' || reduceMotion) return;
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(arrowOffset, { toValue: 5, duration: 650, useNativeDriver: true }),
        Animated.timing(arrowOffset, { toValue: 0, duration: 650, useNativeDriver: true }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [bannerState, reduceMotion, arrowOffset]);

  const openPlanSetup = async (category?: CoachCategory) => {
    if (openingSetupRef.current) return;
    openingSetupRef.current = true;
    setOpeningSetup(true);
    setSetupError('');
    try {
      await beginPlanSetup({});
      router.push({
        pathname: '/coach-onboarding',
        params: category ? { nextCheckIn: category } : {},
      });
    } catch {
      setSetupError('Could not open today’s questions. Please try again.');
    } finally {
      openingSetupRef.current = false;
      setOpeningSetup(false);
    }
  };
  const openPlan = () => {
    if (bannerState === 'locked') return;
    if (bannerState === 'no_plan') void openPlanSetup();
    else if (bannerState !== 'ready') router.push('/coach-plan-loading');
    else router.push('/coach-plan');
  };
  const openTile = (category: CoachCategory) => {
    if (!plan?.access) return;
    if (bannerState === 'no_plan') {
      void openPlanSetup(category);
      return;
    }
    if (bannerState !== 'ready') {
      router.push('/coach-plan-loading');
      return;
    }
    setCheckInPreferredHeight(0);
    setActiveCheckIn(category);
  };
  const closeCheckIn = () => {
    setActiveCheckIn(null);
    setCheckInExpanded(false);
    setCheckInPreferredHeight(0);
  };
  const refresh = async () => {
    setRefreshing(true);
    try {
      await syncAllMissedDays();
      incrementRefreshKey();
    } finally {
      setRefreshing(false);
    }
  };
  if (!accepted || !decision || !currentUser || !plan) return <ScreenLoading />;
  return (
    <SafeAreaView className="flex-1 bg-[#F8F8F8]">
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingTop: Platform.OS === 'android' ? insets.top + 12 : 12,
          paddingBottom: 40,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
        <View className="mx-5 mb-5 flex-row items-center justify-between">
          <View className="min-w-0 flex-1 pr-3">
            <Text className="font-heading text-xs font-semibold tracking-widest text-[#E9512A]">
              TODAY · {points ? points.earned : '—'} PTS
            </Text>
            <Text className="mt-1 font-heading text-[26px] font-semibold leading-8 text-[#1A1A1A]">
              {greeting}, {firstName}
            </Text>
          </View>
          <Avatar
            uri={currentUser.image ?? undefined}
            size={46}
            goToSettings
            name={currentUser.name}
          />
        </View>

        {streak ? (
          <TodayWeeklyStreak
            daysEarned={streak.currentWeekDays}
            target={streak.currentWeekTarget}
            refresh={dayRefresh}
          />
        ) : (
          <View className="mx-5 mb-4 rounded-[24px] bg-white p-5">
            <Text>Weekly streak is loading.</Text>
          </View>
        )}

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={`${planBannerLabel(bannerState)}. ${banner ? (banner.memberCount === 0 ? 'No sweat sisters checked in yet' : `${banner.memberCount} sweat ${banner.memberCount === 1 ? 'sister' : 'sisters'} checked in today`) : 'Community check-ins unavailable'}`}
          accessibilityState={{ disabled: bannerState === 'locked' || openingSetup }}
          disabled={bannerState === 'locked' || openingSetup}
          activeOpacity={0.88}
          onPress={openPlan}
          className="mx-5 mb-5 overflow-hidden rounded-[28px] bg-[#3B1A08]"
          style={{ minHeight: 190 }}>
          <Image
            source={require('~/assets/backgrounds/today-plan-banner.png')}
            contentFit="cover"
            style={{
              position: 'absolute',
              width: planBannerWidth,
              height: '100%',
              right: -planBannerWidth * 0.2,
              bottom: 0,
            }}
            accessibilityIgnoresInvertColors
          />
          <LinearGradient
            colors={['#3B1A08', '#3B1A08', '#3B1A08B8', '#3B1A0800']}
            locations={[0, 0.26, 0.58, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
          />
          <View
            style={{
              minHeight: 190,
              paddingHorizontal: 21,
              paddingVertical: 20,
              justifyContent: 'space-between',
            }}>
            <Text className="font-body text-sm text-white/85">
              {banner ? localRemaining(banner.nextMidnightAt, now) : 'Day timer unavailable'}
            </Text>
            <View>
              {banner?.avatarUrls.length ? (
                <View className="mb-2 flex-row items-center" accessible={false}>
                  {banner.avatarUrls.map((url, index) => (
                    <Image
                      key={`${url}-${index}`}
                      source={{ uri: url }}
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 16,
                        borderWidth: 2,
                        borderColor: 'white',
                        marginLeft: index ? -8 : 0,
                      }}
                      accessibilityIgnoresInvertColors
                    />
                  ))}
                  {banner.memberCount > banner.avatarUrls.length ? (
                    <View
                      className="items-center justify-center border-2 border-white bg-[#D7BBA4]"
                      style={{ width: 32, height: 32, borderRadius: 16, marginLeft: -8 }}>
                      <Text className="font-body text-xs text-white">
                        +{banner.memberCount - banner.avatarUrls.length}
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
              <Text className="mb-2 max-w-[82%] font-body text-sm font-medium text-white">
                {banner
                  ? banner.memberCount === 0
                    ? 'No sweat sisters checked in yet'
                    : `${banner.memberCount} sweat ${banner.memberCount === 1 ? 'sister' : 'sisters'} checked in today`
                  : 'Community check-ins unavailable'}
              </Text>
              <View className="flex-row items-center">
                <Text className="min-w-0 shrink font-heading text-[25px] font-semibold leading-[31px] text-white">
                  {planBannerLabel(bannerState)}
                </Text>
                {bannerState !== 'locked' ? (
                  <Animated.View
                    style={{
                      transform: [{ translateX: arrowOffset }],
                      marginLeft: 8,
                      flexShrink: 0,
                    }}>
                    <ArrowRight color="white" size={26} />
                  </Animated.View>
                ) : null}
              </View>
            </View>
          </View>
        </TouchableOpacity>
        {setupError ? (
          <Text className="mx-5 -mt-3 mb-5 font-body text-sm text-red-600">{setupError}</Text>
        ) : null}

        {!plan.access ? (
          <View className="mx-5 mb-5 rounded-2xl bg-white p-4">
            <Text className="font-heading font-semibold">Premium access is unavailable</Text>
            <Text className="mt-1 text-sm text-[#6B665F]">
              Your saved plan and check-ins remain private until a purchase is verified again.
            </Text>
            <CoachActionButton
              label={restoring ? 'Restoring…' : 'Restore purchases'}
              disabled={restoring || !restorePermissions}
              onPress={async () => {
                if (!restorePermissions) return;
                setRestoring(true);
                setRestoreMessage('');
                try {
                  const result = await restorePermissions();
                  setRestoreMessage(
                    result === 'active'
                      ? 'Purchase restored.'
                      : result === 'pending'
                        ? 'Verification is pending. Your access will update when it is verified.'
                        : 'No active purchase was found.'
                  );
                } catch {
                  setRestoreMessage('Restore failed. Please try again.');
                } finally {
                  setRestoring(false);
                }
              }}
              className="mt-3"
            />
            {restoreMessage ? (
              <Text className="mt-2 text-sm text-[#6B665F]">{restoreMessage}</Text>
            ) : null}
          </View>
        ) : null}

        <View className="mx-5 mb-5 rounded-[24px] bg-white p-4">
          <Text className="mb-3 font-heading text-xl font-semibold text-[#1A1A1A]">
            Your Check-ins
          </Text>
          <View className="flex-row flex-wrap justify-between">
            {tiles.map((tile) => {
              const Icon = ICONS[tile.category];
              const inactive = tile.completed || !tile.available || !plan.plan;
              const detail = !plan.access
                ? 'Premium access unavailable'
                : tile.category === 'steps' && stepTarget
                  ? `${stepTarget} steps`
                  : (tile.assignment?.label ??
                    (plan.plan ? 'Plan guidance unavailable' : 'Get today’s plan'));
              return (
                <TouchableOpacity
                  key={tile.category}
                  accessibilityRole="button"
                  accessibilityLabel={`${LABELS[tile.category]}, ${detail}${tile.category === 'meals' ? `, ${tile.earned} of 3 shared` : tile.completed ? ', completed' : ''}`}
                  accessibilityState={{ disabled: !plan.access || openingSetup }}
                  disabled={!plan.access || openingSetup}
                  onPress={() => openTile(tile.category)}
                  className="mb-3 min-h-[96px] justify-center rounded-[22px] border border-[#E6E3E0] p-3"
                  style={{ width: '48.4%', backgroundColor: tile.completed ? '#F3F2F0' : 'white' }}>
                  <View className="mb-1 flex-row items-center justify-between">
                    <View className="h-8 w-8 items-center justify-center rounded-full bg-[#FFF0E8]">
                      <Icon color={inactive ? '#99918C' : ORANGE} size={18} />
                    </View>
                    {tile.completed ? <Check color="#8E8A86" size={18} weight="bold" /> : null}
                  </View>
                  <Text
                    className="font-heading text-base font-semibold"
                    style={{ color: inactive ? '#77716D' : '#1A1A1A' }}>
                    {LABELS[tile.category]}
                  </Text>
                  <Text className="mt-1 font-body text-xs text-[#77716D]">
                    {tile.category === 'meals'
                      ? `${tile.earned} of 3 shared`
                      : tile.category === 'workout' && tile.assignment && !tile.assignment.mandatory
                        ? 'Rest guidance · no proof needed'
                        : detail}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View className="mx-5 mb-5 rounded-[24px] bg-white p-4">
          <View className="flex-row items-center justify-between">
            <Text className="font-heading text-xl font-semibold">Your Progress</Text>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="See all progress"
              onPress={() => router.push(TODAY_PROGRESS_ROUTES.seeAll)}>
              <Text className="font-body text-sm text-[#F05831]">See all</Text>
            </TouchableOpacity>
          </View>
          <Text className="mb-4 mt-1 font-body text-sm text-[#77716D]">
            Compare your progress over time.
          </Text>
          {!plan.access ? (
            <View className="rounded-2xl bg-[#F5F3F1] p-5">
              <LockSimple color={ORANGE} />
              <Text className="mt-2 text-[#77716D]">
                Progress comparison is locked while Premium access is unavailable.
              </Text>
            </View>
          ) : !progress ? (
            <Text className="py-8 text-center text-sm text-[#77716D]">
              Progress photos are loading.
            </Text>
          ) : (
            <>
              <View className="flex-row justify-between gap-3">
                {[firstPhoto, latestPhoto].map((photo, index) => (
                  <View
                    key={index}
                    accessible
                    accessibilityLabel={
                      photo
                        ? `Week ${index === 0 ? 1 : photos.length} progress photo, ${photoDate(photo.weekStart)}`
                        : index === 0 || nextPhotoAvailable
                          ? `Week ${index === 0 ? 1 : progressWeek}, add a photo`
                          : 'Next progress comparison unlocks after Week 1'
                    }
                    className="flex-1 overflow-hidden rounded-[26px]"
                    style={{
                      aspectRatio: 0.9,
                      backgroundColor: index === 0 ? '#FFF9F6' : '#F3F0ED',
                    }}>
                    {photo?.frontUrl ? (
                      <Image
                        source={{ uri: photo.frontUrl }}
                        contentFit="cover"
                        style={{ width: '100%', height: '100%' }}
                      />
                    ) : (
                      <View className="flex-1 items-center justify-center p-3">
                        {index === 0 || nextPhotoAvailable ? (
                          <Camera color={ORANGE} size={30} />
                        ) : (
                          <LockSimple color={ORANGE} size={27} />
                        )}
                        {index === 0 || nextPhotoAvailable ? (
                          <>
                            <Text className="mt-3 text-center font-heading text-sm font-semibold text-[#1A1A1A]">
                              Week {index === 0 ? 1 : progressWeek}
                            </Text>
                            <Text className="mt-1 text-center font-body text-xs text-[#77716D]">
                              {photo ? 'Photo unavailable' : 'Add a photo'}
                            </Text>
                          </>
                        ) : (
                          <Text className="mt-3 text-center font-body text-xs text-[#817A76]">
                            Unlocks after Week 1
                          </Text>
                        )}
                      </View>
                    )}
                    {photo ? (
                      <View className="absolute bottom-0 w-full bg-black/55 p-2">
                        <Text className="text-center text-xs text-white">
                          {photoDate(photo.weekStart)}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                ))}
              </View>
              <View className="mt-5 flex-row justify-between">
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={
                    canLogProgress
                      ? `Log Week ${progressWeek} photo`
                      : 'Progress photo already logged this week'
                  }
                  accessibilityState={{ disabled: !canLogProgress }}
                  disabled={!canLogProgress}
                  onPress={() => router.push(TODAY_PROGRESS_ROUTES.log)}
                  className="min-h-11 flex-1 flex-row items-center justify-center p-2"
                  style={{ opacity: canLogProgress ? 1 : 0.45 }}>
                  <Camera size={20} color={ORANGE} />
                  <Text className="ml-2 font-body text-sm font-medium text-[#1A1A1A]">
                    {canLogProgress ? `Log Week ${progressWeek}` : `Week ${progressWeek} logged`}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Share or save progress comparison"
                  accessibilityState={{ disabled: !canShareProgress }}
                  disabled={!canShareProgress}
                  onPress={() => router.push(TODAY_PROGRESS_ROUTES.share as any)}
                  className="min-h-11 flex-1 flex-row items-center justify-center p-2"
                  style={{ opacity: canShareProgress ? 1 : 0.45 }}>
                  <ShareNetwork size={20} color={ORANGE} />
                  <Text className="ml-2 font-body text-sm font-medium text-[#1A1A1A]">
                    Share / Save
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>

        <View className="mx-5 rounded-[24px] bg-white p-5">
          <Text className="mb-6 font-heading text-xl font-semibold text-[#1A1A1A]">
            Your Activity
          </Text>
          {activity ? (
            <>
              <View
                accessible
                accessibilityLabel={`${activity.totalSteps} of ${numericStepTarget ?? 'unavailable target'} steps, ${activity.stepsPoints} points`}
                className="mb-6 flex-row items-start">
                <View className="h-11 w-11 items-center justify-center rounded-full bg-[#FFF0E8]">
                  <Footprints color={ORANGE} size={23} />
                </View>
                <View className="ml-3 min-w-0 flex-1 pt-1">
                  <View className="flex-row items-start justify-between">
                    <Text className="min-w-0 flex-1 pr-2 font-body text-sm text-[#77716D]">
                      <Text className="font-semibold text-[#1A1A1A]">
                        {new Intl.NumberFormat('en-US').format(activity.totalSteps)}
                      </Text>
                      {stepTarget ? ` / ${stepTarget} steps` : ' steps'}
                    </Text>
                    <Text className="font-body text-sm font-semibold text-[#E9512A]">
                      {activity.stepsPoints} pts
                    </Text>
                  </View>
                  {numericStepTarget ? (
                    <View className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#ECE7E3]">
                      <View
                        className="h-full rounded-full bg-[#FF5C35]"
                        style={{
                          width:
                            `${Math.round(activityProgressFraction(activity.totalSteps, numericStepTarget) * 100)}%` as `${number}%`,
                        }}
                      />
                    </View>
                  ) : null}
                </View>
              </View>
              <View
                accessible
                accessibilityLabel={`${activity.totalZone2Minutes} of ${activeMinuteTarget} active minutes, ${activity.zone2Points} points`}
                className="flex-row items-start">
                <View className="h-11 w-11 items-center justify-center rounded-full bg-[#FFF0E8]">
                  <Heartbeat color={ORANGE} size={23} />
                </View>
                <View className="ml-3 min-w-0 flex-1 pt-1">
                  <View className="flex-row items-start justify-between">
                    <Text className="min-w-0 flex-1 pr-2 font-body text-sm text-[#77716D]">
                      <Text className="font-semibold text-[#1A1A1A]">
                        {activity.totalZone2Minutes}
                      </Text>
                      {` / ${activeMinuteTarget} active mins`}
                    </Text>
                    <Text className="font-body text-sm font-semibold text-[#E9512A]">
                      {activity.zone2Points} pts
                    </Text>
                  </View>
                  <View className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#ECE7E3]">
                    <View
                      className="h-full rounded-full bg-[#FF5C35]"
                      style={{
                        width:
                          `${Math.round(activityProgressFraction(activity.totalZone2Minutes, activeMinuteTarget) * 100)}%` as `${number}%`,
                      }}
                    />
                  </View>
                </View>
              </View>
            </>
          ) : (
            <Text className="text-sm text-[#77716D]">Activity is unavailable right now.</Text>
          )}
        </View>
      </ScrollView>
      <Modal
        visible={activeCheckIn !== null}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={closeCheckIn}>
        <View className="flex-1 justify-end bg-black/45" accessibilityViewIsModal>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Dismiss check-in"
            activeOpacity={1}
            onPress={closeCheckIn}
            style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
          />
          <View
            className="overflow-hidden rounded-t-[28px] bg-white"
            style={{
              height: checkInExpanded
                ? '88%'
                : Math.min(
                    Math.max(checkInPreferredHeight + insets.bottom, 360),
                    screenHeight - insets.top - 20
                  ),
              paddingBottom: insets.bottom,
            }}>
            {activeCheckIn ? (
              <CoachCheckInFlow
                category={activeCheckIn}
                onClose={closeCheckIn}
                onCaptured={() => {
                  const selected = activeCheckIn;
                  closeCheckIn();
                  router.push(checkInPostRoute(selected));
                }}
                onExpandedChange={setCheckInExpanded}
                onPreferredHeightChange={(height) =>
                  setCheckInPreferredHeight((previous) =>
                    Math.abs(previous - height) > 4 ? height : previous
                  )
                }
                onOpenPlan={(status) => {
                  closeCheckIn();
                  if (status === 'no_plan') void openPlanSetup(activeCheckIn ?? undefined);
                  else router.push(status === 'ready' ? '/coach-plan' : '/coach-plan-loading');
                }}
              />
            ) : null}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
